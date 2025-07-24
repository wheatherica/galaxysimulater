#!/bin/bash

# 権限テストスクリプト
echo "🧪 Galaxy Simulator AWS権限テスト..."

echo "📋 現在のユーザー情報:"
aws sts get-caller-identity 2>/dev/null || echo "❌ STS権限なし"

echo ""
echo "📋 アタッチされたポリシー:"
aws iam list-attached-user-policies --user-name galaxysimulation 2>/dev/null || echo "❌ IAMポリシー確認権限なし"

echo ""
echo "🧪 Lambda権限テスト:"
aws lambda list-functions --region us-east-1 2>/dev/null && echo "✅ Lambda読み取り権限あり" || echo "❌ Lambda権限なし"

echo ""
echo "🧪 S3権限テスト:"
aws s3 ls 2>/dev/null && echo "✅ S3読み取り権限あり" || echo "❌ S3権限なし"

echo ""
echo "🧪 CloudFormation権限テスト:"
aws cloudformation list-stacks --region us-east-1 2>/dev/null && echo "✅ CloudFormation読み取り権限あり" || echo "❌ CloudFormation権限なし"

echo ""
echo "📊 権限テスト完了"