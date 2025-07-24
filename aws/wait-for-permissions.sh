#!/bin/bash

# AWS権限設定を待機してデプロイするスクリプト

echo "⏳ AWS権限設定を待機中..."
echo "   ブラウザでAWS IAMコンソールでの設定をお願いします"
echo "   設定手順: QUICK_BROWSER_SETUP.md"
echo ""

COUNTER=0
while true; do
    COUNTER=$((COUNTER + 1))
    echo "🔍 権限チェック中... ($COUNTER回目)"
    
    # IAM権限をチェック
    if aws iam list-attached-user-policies --user-name galaxysimulation >/dev/null 2>&1; then
        # GalaxySimulatorPolicyがアタッチされているかチェック
        if aws iam list-attached-user-policies --user-name galaxysimulation | grep -q "GalaxySimulatorPolicy"; then
            echo ""
            echo "🎉 権限設定が確認されました！"
            echo "🚀 AWSリソースのデプロイを開始します..."
            
            # デプロイを実行
            ./deploy-when-ready.sh
            exit 0
        fi
    fi
    
    echo "   まだ権限が設定されていません。30秒後に再チェック..."
    sleep 30
    
    # 10回チェック後にユーザーに確認
    if [ $COUNTER -eq 10 ]; then
        echo ""
        read -p "🤔 権限設定は完了しましたか？手動でチェックしますか？ (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ./check-and-deploy.sh
            exit 0
        fi
        COUNTER=0
    fi
done