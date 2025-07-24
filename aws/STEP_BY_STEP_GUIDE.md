# Galaxy Simulator AWS統合 - 完全ガイド

## 🎯 目標
Galaxy SimulatorでAWS Lambdaを使用した真のクラウド処理を有効にする

## 📋 現在の状況
- ✅ アプリケーションは動作中（デモモード）
- ❌ 実際のAWSリソースは未デプロイ
- ❌ 必要なIAM権限が不足

---

## ステップ1: AWS管理者による権限設定

### 管理者が実行するコマンド

```bash
# 現在のディレクトリに移動
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater/aws

# 1. IAMポリシーを作成
aws iam create-policy \
    --policy-name GalaxySimulatorPolicy \
    --policy-document file://iam-policy.json \
    --description "Galaxy Simulator deployment permissions"

# 2. ユーザーにポリシーをアタッチ
aws iam attach-user-policy \
    --user-name galaxysimulation \
    --policy-arn arn:aws:iam::426229613300:policy/GalaxySimulatorPolicy

# 3. 権限確認
aws iam list-attached-user-policies --user-name galaxysimulation
```

### 確認方法
```bash
# 権限テストを実行
./test-permissions.sh
```

---

## ステップ2: AWSリソースのデプロイ

### 権限設定完了後、以下を実行：

```bash
# CloudFormationでインフラをデプロイ
aws cloudformation deploy \
    --template-file simple-cloudformation.yaml \
    --stack-name galaxy-simulator-production \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1
```

### デプロイ確認
```bash
# スタック状態を確認
aws cloudformation describe-stacks \
    --stack-name galaxy-simulator-production \
    --region us-east-1

# API Gatewayエンドポイントを取得
aws cloudformation describe-stacks \
    --stack-name galaxy-simulator-production \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
    --output text
```

---

## ステップ3: アプリケーション設定の更新

### API Gatewayエンドポイントを.env.localに設定

```bash
# 取得したエンドポイントURLで.env.localを更新
# 例: NEXT_PUBLIC_AWS_API_ENDPOINT=https://abc123.execute-api.us-east-1.amazonaws.com/prod/simulate
```

---

## ステップ4: 動作確認

### 1. アプリケーションを再起動
```bash
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater
npm run dev
```

### 2. AWS統合をテスト
- ブラウザでアプリケーションを開く
- 「AWS High-Performance Mode」をオンにする
- 星の数を増やしてシミュレーション開始
- コンソールでAWS Lambda呼び出しを確認

### 3. ログ確認
```bash
# Lambda関数のログを確認
aws logs describe-log-groups --region us-east-1
aws logs tail /aws/lambda/galaxy-simulator-production --follow
```

---

## 🚨 トラブルシューティング

### エラー: "User is not authorized to perform: iam:CreateRole"
→ ステップ1の権限設定が必要

### エラー: "Stack creation failed"
→ CloudFormationエラーを確認：
```bash
aws cloudformation describe-stack-events --stack-name galaxy-simulator-production
```

### アプリでAWS接続エラー
→ .env.localのエンドポイントURLを確認

---

## 💰 AWS料金の目安

- **Lambda**: $0.20 per 1M requests + $0.0000166667/GB-second
- **API Gateway**: $3.50 per million requests
- **S3**: $0.023/GB/month

50,000星 × 1時間の使用で約$0.01-0.05程度