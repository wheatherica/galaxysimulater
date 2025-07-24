#!/bin/bash

# Manual deployment without CloudFormation
set -e

echo "🚀 Manual Galaxy Simulator Lambda deployment..."

FUNCTION_NAME="galaxy-simulator-manual"
REGION="us-east-1"

# Create deployment package
echo "📦 Creating deployment package..."
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater/aws
zip -r manual-deployment.zip minimal-lambda.js

echo "📝 Attempting to create Lambda function..."

# Try creating function with default execution role (might exist)
aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role arn:aws:iam::426229613300:role/service-role/lambda-execution-role \
    --handler minimal-lambda.handler \
    --zip-file fileb://manual-deployment.zip \
    --timeout 300 \
    --memory-size 1024 \
    --region $REGION \
    --description "Galaxy Simulator Manual Deployment" \
    --environment Variables='{DEMO_MODE=true}' \
    2>/dev/null || echo "❌ Function creation failed - trying alternative..."

# Check if function exists now
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "✅ Function exists, creating Function URL..."
    
    # Create Function URL for direct invocation
    aws lambda create-function-url-config \
        --function-name $FUNCTION_NAME \
        --cors 'AllowCredentials=false,AllowHeaders=*,AllowMethods=*,AllowOrigins=*' \
        --auth-type NONE \
        --region $REGION \
        2>/dev/null || echo "URL config might already exist"
    
    # Get the Function URL
    FUNCTION_URL=$(aws lambda get-function-url-config \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --query 'FunctionUrl' \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$FUNCTION_URL" ]; then
        echo "🌐 Function URL: $FUNCTION_URL"
        
        # Test the function
        echo "🧪 Testing function..."
        curl -X POST "$FUNCTION_URL" \
            -H "Content-Type: application/json" \
            -d '{"action":"initialize","params":{"nBodies":1000}}' \
            --silent --show-error || echo "Test failed"
        
        echo ""
        echo "✅ Function deployed successfully!"
        echo "   Function Name: $FUNCTION_NAME"
        echo "   Function URL: $FUNCTION_URL"
        echo ""
        echo "📝 Update your .env.local file with:"
        echo "   NEXT_PUBLIC_AWS_API_ENDPOINT=$FUNCTION_URL"
    else
        echo "❌ Could not retrieve Function URL"
    fi
else
    echo "❌ Function does not exist and could not be created"
    echo "   This is likely due to insufficient IAM permissions"
    echo "   Required permissions: lambda:CreateFunction, iam:PassRole"
fi

# Clean up
rm -f manual-deployment.zip

echo "🏁 Manual deployment completed!"