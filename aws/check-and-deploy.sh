#!/bin/bash

# 権限をチェックしてデプロイ可能かを判定

echo "🔍 Galaxy Simulator AWS権限チェック..."

# 必要な権限をテスト
echo "1️⃣ Lambda権限チェック..."
if aws lambda list-functions --region us-east-1 >/dev/null 2>&1; then
    echo "   ✅ Lambda読み取り権限: OK"
else
    echo "   ❌ Lambda権限なし"
    exit 1
fi

echo "2️⃣ IAM権限チェック..."
if aws iam list-attached-user-policies --user-name galaxysimulation >/dev/null 2>&1; then
    echo "   ✅ IAM読み取り権限: OK"
    
    # GalaxySimulatorPolicyがアタッチされているかチェック
    if aws iam list-attached-user-policies --user-name galaxysimulation | grep -q "GalaxySimulatorPolicy"; then
        echo "   ✅ GalaxySimulatorPolicy: アタッチ済み"
        READY_TO_DEPLOY=true
    else
        echo "   ❌ GalaxySimulatorPolicy: 未アタッチ"
        READY_TO_DEPLOY=false
    fi
else
    echo "   ❌ IAM権限なし"
    READY_TO_DEPLOY=false
fi

echo "3️⃣ CloudFormation権限チェック..."
if aws cloudformation list-stacks --region us-east-1 >/dev/null 2>&1; then
    echo "   ✅ CloudFormation読み取り権限: OK"
else
    echo "   ❌ CloudFormation権限なし"
    exit 1
fi

echo ""
if [ "$READY_TO_DEPLOY" = "true" ]; then
    echo "🎉 デプロイ準備完了！"
    echo ""
    read -p "今すぐAWSリソースをデプロイしますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 デプロイ開始..."
        ./deploy-when-ready.sh
    else
        echo "後でデプロイする場合: ./deploy-when-ready.sh"
    fi
else
    echo "❌ デプロイ準備未完了"
    echo ""
    echo "📋 必要なアクション:"
    echo "1. AWS管理者にSTEP_BY_STEP_GUIDE.mdを共有"
    echo "2. 管理者にiam-policy.jsonと setup-permissions.sh を実行依頼"
    echo "3. 権限設定完了後、このスクリプトを再実行"
    echo ""
    echo "💬 管理者への依頼メッセージ例:"
    echo "「Galaxy SimulatorのAWS統合のため、/aws/setup-permissions.sh の実行をお願いします」"
fi