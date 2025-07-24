#!/bin/bash

# Galaxy Simulator IAM権限設定スクリプト
# 管理者権限のあるユーザーで実行してください

set -e

echo "🔐 Galaxy Simulator IAM権限設定中..."

USER_NAME="galaxysimulation"
POLICY_NAME="GalaxySimulatorPolicy"
POLICY_FILE="iam-policy.json"

echo "📝 IAMポリシーを作成中..."

# ポリシーを作成
aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file://$POLICY_FILE \
    --description "Galaxy Simulator AWS deployment permissions" \
    2>/dev/null || echo "ポリシーは既に存在する可能性があります"

# アカウントIDを取得
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

echo "🔗 ユーザーにポリシーをアタッチ中..."

# ユーザーにポリシーをアタッチ
aws iam attach-user-policy \
    --user-name $USER_NAME \
    --policy-arn $POLICY_ARN

echo "✅ 権限設定完了！"
echo "   ユーザー: $USER_NAME"
echo "   ポリシー: $POLICY_NAME"
echo "   ARN: $POLICY_ARN"
echo ""
echo "🚀 これで Galaxy Simulator のAWSデプロイが可能になりました"