#!/bin/bash

# Galaxy Simulator AWS Deployment Script

set -e

echo "🚀 Deploying Galaxy Simulator AWS Infrastructure..."

# Configuration
STACK_NAME="galaxy-simulator-stack"
REGION="us-east-1"
ENVIRONMENT="dev"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "📦 Packaging Lambda function..."
cd lambda/galaxy-simulator
npm install --production
zip -r galaxy-simulator.zip . -x "*.git*" "node_modules/.cache/*"
cd ../..

echo "☁️ Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file cloudformation/galaxy-simulator-stack.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides Environment=$ENVIRONMENT \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo "📝 Updating Lambda function code..."
FUNCTION_NAME="galaxy-simulator-$ENVIRONMENT"
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://lambda/galaxy-simulator/galaxy-simulator.zip \
    --region $REGION

echo "🔍 Getting deployment outputs..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
    --output text)

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

echo "✅ Deployment complete!"
echo ""
echo "📋 Deployment Information:"
echo "  API Endpoint: $API_ENDPOINT"
echo "  S3 Bucket: $S3_BUCKET"
echo "  Region: $REGION"
echo ""
echo "🔧 Next steps:"
echo "  1. Update your .env.local file with:"
echo "     NEXT_PUBLIC_AWS_API_ENDPOINT=$API_ENDPOINT"
echo "  2. Redeploy your Next.js application to Vercel"
echo ""
echo "💰 Cost Estimate:"
echo "  - Lambda: ~$0.20 per 1M requests"
echo "  - S3: ~$0.023 per GB/month"
echo "  - API Gateway: ~$3.50 per 1M requests"
echo ""
echo "🧪 Test your deployment:"
echo "  curl -X POST $API_ENDPOINT -H 'Content-Type: application/json' -d '{\"action\":\"test\"}'"

# Cleanup
rm -f lambda/galaxy-simulator/galaxy-simulator.zip

echo "🎉 Galaxy Simulator AWS infrastructure is ready!"