#!/bin/bash

# Simplified Galaxy Simulator AWS Deployment

set -e

echo "🚀 Deploying Simplified Galaxy Simulator..."

FUNCTION_NAME="galaxy-simulator-simple"
REGION="us-east-1"

# Create simple Lambda function
echo "📦 Creating Lambda function..."

# Create a simple deployment package
cd lambda/galaxy-simulator
zip -r simple-deployment.zip index.js package.json -x "node_modules/*"

# Create the Lambda function directly
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime nodejs18.x \
  --role arn:aws:iam::426229613300:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://simple-deployment.zip \
  --memory-size 1024 \
  --timeout 300 \
  --region $REGION \
  --environment Variables='{S3_BUCKET=galaxy-sim-temp-bucket}' \
  2>/dev/null || echo "Function already exists, updating..."

# Update function code if it already exists
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://simple-deployment.zip \
  --region $REGION

echo "✅ Lambda function deployed!"
echo "Function ARN: $(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)"

rm simple-deployment.zip
cd ../..

echo "🎉 Simplified deployment complete!"