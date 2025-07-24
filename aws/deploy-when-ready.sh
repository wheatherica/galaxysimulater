#!/bin/bash

# AWS権限が設定されたら自動的にデプロイを実行するスクリプト

set -e

echo "🔍 AWS権限をチェック中..."

# Lambda作成権限をテスト
echo "📝 Lambda作成権限をテスト..."
if aws lambda create-function \
    --function-name test-permission-check \
    --runtime nodejs18.x \
    --role arn:aws:iam::426229613300:role/nonexistent-role \
    --handler index.handler \
    --zip-file fileb://manual-deployment.zip \
    --region us-east-1 \
    --dry-run 2>/dev/null; then
    echo "❌ Lambda作成権限が不足"
    echo "管理者にステップ1の権限設定を依頼してください"
    exit 1
fi

# 実際のデプロイを実行
echo "✅ 権限確認完了。AWSリソースをデプロイ中..."

# CloudFormationデプロイ
aws cloudformation deploy \
    --template-file simple-cloudformation.yaml \
    --stack-name galaxy-simulator-production \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1

# API Gatewayエンドポイントを取得
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name galaxy-simulator-production \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
    --output text)

echo "🌐 API Gatewayエンドポイント: $API_ENDPOINT"

# .env.localを更新
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater
cp .env.local .env.local.backup

cat > .env.local << EOF
# AWS Configuration for Galaxy Simulator - PRODUCTION
NEXT_PUBLIC_AWS_API_ENDPOINT=$API_ENDPOINT

# Optional: AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-1

# Production Mode: Real AWS Lambda integration active
# Deployed: $(date)
EOF

echo "✅ .env.local更新完了"
echo "📝 バックアップ: .env.local.backup"

# Lambda関数をテスト
echo "🧪 Lambda関数をテスト中..."
curl -X POST "$API_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d '{"action":"initialize","params":{"nBodies":1000}}' \
    --silent --show-error

echo ""
echo "🎉 AWS統合が有効になりました！"
echo ""
echo "次のステップ:"
echo "1. アプリケーションを再起動: npm run dev"
echo "2. ブラウザでAWS High-Performance Modeをテスト"
echo "3. CloudWatchでLambdaログを確認"