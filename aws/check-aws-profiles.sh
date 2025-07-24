#!/bin/bash

# 利用可能なAWSプロファイルをチェック

echo "🔍 利用可能なAWSプロファイルを確認中..."

echo ""
echo "📋 現在のAWS設定:"
echo "   現在のユーザー: $(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || echo '取得できません')"
echo "   現在のプロファイル: ${AWS_PROFILE:-default}"

echo ""
echo "📋 設定済みプロファイル:"
if [ -f ~/.aws/credentials ]; then
    grep '^\[' ~/.aws/credentials | sed 's/\[//g' | sed 's/\]//g' | while read profile; do
        echo "   - $profile"
    done
else
    echo "   ~/.aws/credentials が見つかりません"
fi

echo ""
echo "🧪 管理者権限チェック:"

# デフォルトプロファイルで管理者権限をチェック
echo "   デフォルトプロファイル:"
if aws iam list-users --max-items 1 >/dev/null 2>&1; then
    echo "     ✅ 管理者権限あり"
    ADMIN_AVAILABLE=true
else
    echo "     ❌ 管理者権限なし"
    ADMIN_AVAILABLE=false
fi

# 他のプロファイルをチェック
if [ -f ~/.aws/credentials ]; then
    grep '^\[' ~/.aws/credentials | sed 's/\[//g' | sed 's/\]//g' | while read profile; do
        if [ "$profile" != "default" ]; then
            echo "   プロファイル: $profile"
            if AWS_PROFILE=$profile aws iam list-users --max-items 1 >/dev/null 2>&1; then
                echo "     ✅ 管理者権限あり - 使用可能!"
                echo ""
                echo "🚀 このプロファイルで権限設定を実行:"
                echo "   AWS_PROFILE=$profile ./setup-permissions.sh"
                exit 0
            else
                echo "     ❌ 管理者権限なし"
            fi
        fi
    done
fi

echo ""
if [ "$ADMIN_AVAILABLE" != "true" ]; then
    echo "❌ 管理者権限のあるプロファイルが見つかりません"
    echo ""
    echo "📋 次のステップ:"
    echo "1. AWS管理者に連絡してGalaxySimulatorPolicyの設定を依頼"
    echo "2. または管理者権限のあるAWSアクセスキーを取得"
    echo "3. 設定完了後: ./check-and-deploy.sh を実行"
fi