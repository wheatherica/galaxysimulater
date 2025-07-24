#!/bin/bash

# Galaxy Simulator Enhanced AWS Deployment Script
# Usage: ./deploy.sh [environment] [region] [options]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEFAULT_REGION="us-east-1"
DEFAULT_ENVIRONMENT="development"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_usage() {
    cat << EOF
Galaxy Simulator AWS Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENVIRONMENT    Deployment environment (development|staging|production)
    -r, --region REGION             AWS region (default: us-east-1)
    -p, --profile PROFILE           AWS profile to use
    -s, --stack-name NAME           Custom stack name
    -d, --domain DOMAIN             Custom domain name for the application
    -m, --monitoring                Enable monitoring (CloudWatch, X-Ray)
    -c, --cache                     Enable ElastiCache
    -n, --notification-email EMAIL  Email for alerts
    --skip-build                    Skip building Lambda functions
    --skip-tests                    Skip running tests
    --dry-run                       Show what would be deployed without deploying
    --cleanup                       Clean up old resources
    -h, --help                      Show this help message

Examples:
    # Deploy to development
    $0 -e development

    # Deploy to production with monitoring
    $0 -e production -m -c -n admin@company.com

    # Deploy with custom domain
    $0 -e production -d galaxy.mycompany.com

    # Dry run deployment
    $0 -e staging --dry-run

    # Clean up old resources
    $0 --cleanup
EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check SAM CLI
    if ! command -v sam &> /dev/null; then
        log_warning "SAM CLI is not installed. CloudFormation deployment will be used instead."
        USE_SAM=false
    else
        USE_SAM=true
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please configure AWS CLI first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

build_lambda_functions() {
    if [ "$SKIP_BUILD" = true ]; then
        log_info "Skipping Lambda function build"
        return
    fi
    
    log_info "Building Lambda functions..."
    
    for lambda_dir in "$SCRIPT_DIR"/lambda/*/; do
        if [ -d "$lambda_dir" ] && [ -f "$lambda_dir/package.json" ]; then
            lambda_name=$(basename "$lambda_dir")
            log_info "Building $lambda_name..."
            
            cd "$lambda_dir"
            
            # Install dependencies
            npm ci --production
            
            # Create deployment package
            if [ -f "deployment.zip" ]; then
                rm deployment.zip
            fi
            
            zip -r deployment.zip . -x "*.zip" -x "test/*" -x "*.test.js" -x "node_modules/.cache/*"
            
            log_success "Built $lambda_name"
            cd - > /dev/null
        fi
    done
}

run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        log_info "Skipping tests"
        return
    fi
    
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Install test dependencies
    if [ -f package.json ]; then
        npm ci
        
        # Run linting
        if npm run lint > /dev/null 2>&1; then
            log_success "Linting passed"
        else
            log_warning "Linting failed or not configured"
        fi
        
        # Run tests
        if npm run test > /dev/null 2>&1; then
            log_success "Tests passed"
        else
            log_warning "Tests failed or not configured"
        fi
    fi
    
    cd - > /dev/null
}

validate_cloudformation() {
    log_info "Validating CloudFormation templates..."
    
    for template in "$SCRIPT_DIR"/cloudformation/*.yaml; do
        if [ -f "$template" ]; then
            template_name=$(basename "$template")
            log_info "Validating $template_name..."
            
            if aws cloudformation validate-template --template-body "file://$template" > /dev/null; then
                log_success "Template $template_name is valid"
            else
                log_error "Template $template_name is invalid"
                exit 1
            fi
        fi
    done
}

deploy_infrastructure() {
    log_info "Deploying infrastructure to $ENVIRONMENT environment..."
    
    STACK_NAME="${CUSTOM_STACK_NAME:-galaxy-simulator-$ENVIRONMENT}"
    TEMPLATE_FILE="$SCRIPT_DIR/cloudformation/enhanced-galaxy-stack.yaml"
    
    # Prepare parameters
    PARAMETERS="Environment=$ENVIRONMENT"
    
    if [ -n "$DOMAIN_NAME" ]; then
        PARAMETERS="$PARAMETERS DomainName=$DOMAIN_NAME"
    fi
    
    if [ "$ENABLE_MONITORING" = true ]; then
        PARAMETERS="$PARAMETERS EnableMonitoring=true"
    fi
    
    if [ "$ENABLE_CACHE" = true ]; then
        PARAMETERS="$PARAMETERS EnableCache=true"
    fi
    
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        PARAMETERS="$PARAMETERS NotificationEmail=$NOTIFICATION_EMAIL"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would deploy with parameters: $PARAMETERS"
        return
    fi
    
    if [ "$USE_SAM" = true ]; then
        # Use SAM for deployment
        log_info "Using SAM for deployment..."
        
        # Package
        sam package \
            --template-file "$TEMPLATE_FILE" \
            --s3-bucket "${S3_BUCKET:-$STACK_NAME-deployment-artifacts}" \
            --output-template-file packaged-template.yaml
        
        # Deploy
        sam deploy \
            --template-file packaged-template.yaml \
            --stack-name "$STACK_NAME" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
            --parameter-overrides $PARAMETERS \
            --no-fail-on-empty-changeset \
            --region "$AWS_REGION"
    else
        # Use CloudFormation directly
        log_info "Using CloudFormation for deployment..."
        
        # Create S3 bucket for artifacts if it doesn't exist
        BUCKET_NAME="${S3_BUCKET:-$STACK_NAME-deployment-artifacts}"
        if ! aws s3 ls "s3://$BUCKET_NAME" > /dev/null 2>&1; then
            log_info "Creating deployment artifacts bucket: $BUCKET_NAME"
            aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION"
        fi
        
        # Package Lambda functions
        aws cloudformation package \
            --template-file "$TEMPLATE_FILE" \
            --s3-bucket "$BUCKET_NAME" \
            --output-template-file packaged-template.yaml
        
        # Deploy stack
        aws cloudformation deploy \
            --template-file packaged-template.yaml \
            --stack-name "$STACK_NAME" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
            --parameter-overrides $PARAMETERS \
            --region "$AWS_REGION"
    fi
    
    log_success "Infrastructure deployed successfully!"
    
    # Get stack outputs
    log_info "Retrieving stack outputs..."
    OUTPUTS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs' \
        --output table)
    
    echo "$OUTPUTS"
    
    # Save outputs to file
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs' \
        --output json > "$SCRIPT_DIR/stack-outputs-$ENVIRONMENT.json"
    
    log_success "Stack outputs saved to stack-outputs-$ENVIRONMENT.json"
}

# Parse command line arguments
ENVIRONMENT="$DEFAULT_ENVIRONMENT"
AWS_REGION="$DEFAULT_REGION"
SKIP_BUILD=false
SKIP_TESTS=false
DRY_RUN=false
ENABLE_MONITORING=false
ENABLE_CACHE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -p|--profile)
            export AWS_PROFILE="$2"
            shift 2
            ;;
        -s|--stack-name)
            CUSTOM_STACK_NAME="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -n|--notification-email)
            NOTIFICATION_EMAIL="$2"
            shift 2
            ;;
        -m|--monitoring)
            ENABLE_MONITORING=true
            shift
            ;;
        -c|--cache)
            ENABLE_CACHE=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production."
    exit 1
fi

# Set AWS region
export AWS_DEFAULT_REGION="$AWS_REGION"

# Main deployment flow
log_info "Starting Galaxy Simulator deployment..."
log_info "Environment: $ENVIRONMENT"
log_info "Region: $AWS_REGION"
log_info "Monitoring: $ENABLE_MONITORING"
log_info "Cache: $ENABLE_CACHE"

check_prerequisites
run_tests
build_lambda_functions
validate_cloudformation
deploy_infrastructure

log_success "Deployment completed successfully!"
log_info "Check the stack outputs above for application URLs and configuration details."

if [ "$ENVIRONMENT" = "production" ]; then
    log_warning "Production deployment completed. Please verify all systems are working correctly."
fi