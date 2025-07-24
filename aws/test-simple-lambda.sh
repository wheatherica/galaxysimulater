#!/bin/bash

# 最も簡単なLambda権限テスト

echo "🧪 Lambda作成権限を直接テスト中..."

# 簡単なLambda関数を作成してみる
echo 'exports.handler = async () => ({ statusCode: 200, body: "test" });' > test-function.js
zip test-function.zip test-function.js

# 作成を試行
if aws lambda create-function \
    --function-name galaxy-test-permissions \
    --runtime nodejs18.x \
    --role arn:aws:iam::426229613300:role/service-role/lambda-basic-execution-role \
    --handler test-function.handler \
    --zip-file fileb://test-function.zip \
    --region us-east-1 2>/dev/null; then
    
    echo "✅ Lambda作成権限: OK"
    
    # テスト関数を削除
    aws lambda delete-function --function-name galaxy-test-permissions --region us-east-1 2>/dev/null
    
    echo "🚀 権限確認完了！AWSデプロイを実行します..."
    ./deploy-when-ready.sh
else
    echo "❌ Lambda作成権限: 不足"
    echo ""
    echo "📋 確認事項:"
    echo "1. ブラウザのAWS IAMコンソールで GalaxySimulatorPolicy が作成されているか"
    echo "2. galaxysimulation ユーザーに GalaxySimulatorPolicy がアタッチされているか" 
    echo "3. ポリシーのJSONが正しくコピーされているか"
fi

# クリーンアップ
rm -f test-function.js test-function.zip