# 🔑 AWS権限設定ガイド - Galaxy Simulator

Galaxy SimulatorのAWSデプロイに必要な権限設定方法を説明します。

## 📊 現在の権限状況

### ✅ 利用可能な権限
- **S3**: フルアクセス ✅
- **CloudFormation**: 基本操作 ✅  
- **Lambda**: 基本操作 ✅

### ❌ 不足している権限
- **DynamoDB**: アクセス制限 ❌
- **IAM**: 自己参照権限なし ❌
- **API Gateway**: 確認必要 ❌
- **ElastiCache**: 確認必要 ❌

## 🚀 権限設定方法（3つのオプション）

### オプション1: AWSコンソールで設定（推奨）

1. **AWSマネジメントコンソールにログイン**
   ```
   https://console.aws.amazon.com/iam/
   ```

2. **ユーザー権限の追加**
   - IAM → Users → `galaxysimulation` を選択
   - Permissions タブ → Add permissions
   - Attach policies directly を選択

3. **必要なAWS管理ポリシーを追加**
   ```
   ✅ AmazonDynamoDBFullAccess
   ✅ AmazonAPIGatewayAdministrator  
   ✅ AmazonElastiCacheFullAccess
   ✅ AWSStepFunctionsFullAccess
   ✅ AmazonCognitoPowerUser
   ✅ AmazonEventBridgeFullAccess
   ✅ AmazonSNSFullAccess
   ✅ CloudWatchFullAccess
   ```

4. **カスタムポリシーの追加**
   - Create policy → JSON
   - `aws/iam/galaxy-simulator-policy.json` の内容をコピー
   - Review policy → Name: `GalaxySimulatorCustomPolicy`
   - Create policy → ユーザーにアタッチ

### オプション2: AWS CLIで設定

```bash
# カスタムポリシーの作成
aws iam create-policy \
    --policy-name GalaxySimulatorPolicy \
    --policy-document file://aws/iam/galaxy-simulator-policy.json

# ポリシーをユーザーにアタッチ
aws iam attach-user-policy \
    --user-name galaxysimulation \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/GalaxySimulatorPolicy

# AWS管理ポリシーの追加
aws iam attach-user-policy \
    --user-name galaxysimulation \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-user-policy \
    --user-name galaxysimulation \
    --policy-arn arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator
```

### オプション3: 管理者に依頼

管理者に以下の権限追加を依頼してください：

```json
{
    "必要な権限": [
        "DynamoDB フルアクセス",
        "API Gateway 管理者権限", 
        "ElastiCache フルアクセス",
        "Step Functions フルアクセス",
        "CloudWatch フルアクセス",
        "IAM ロール作成権限（galaxy-* プレフィックス限定）"
    ]
}
```

## 🔒 セキュリティ考慮事項

### 最小権限の原則
作成したポリシーは以下に限定されています：
- **リソース制限**: `galaxy-*` プレフィックスのみ
- **アクション制限**: デプロイに必要な操作のみ
- **地域制限**: 指定したAWSリージョンのみ

### 権限の範囲
```
S3 Buckets:     galaxy-* のみ
DynamoDB Tables: galaxy-* のみ  
IAM Roles:      galaxy-* のみ
Lambda Functions: galaxy-* のみ
```

## ✅ 権限設定確認

権限設定後、以下で確認できます：

```bash
# DynamoDB アクセステスト
aws dynamodb list-tables

# API Gateway アクセステスト  
aws apigateway get-rest-apis

# CloudFormation デプロイテスト
./aws/deploy.sh -e development --dry-run
```

## 🚨 トラブルシューティング

### よくあるエラーと解決法

**1. AccessDenied エラー**
```
解決法: 該当サービスの管理ポリシーを追加
例: AmazonDynamoDBFullAccess
```

**2. CloudFormation権限エラー**
```
解決法: IAMロール作成権限を追加
aws/iam/galaxy-simulator-policy.json の IAMRoleManagement セクション
```

**3. Lambda作成エラー**
```
解決法: Lambda実行ロールのPassRole権限を確認
IAM → Roles → galaxy-* ロールの信頼関係
```

## 🎯 最速設定手順

**管理者がいる場合（5分）:**
1. 管理者に「AWS管理ポリシー」の追加を依頼
2. `AmazonDynamoDBFullAccess` など上記リストを提供
3. 設定完了後、デプロイ実行

**自分で設定する場合（10分）:**
1. AWSコンソール → IAM → Users → galaxysimulation
2. 上記の必要ポリシーを順次追加
3. カスタムポリシーをJSONで作成・追加
4. デプロイテスト実行

---

## 🚀 権限設定完了後

以下のコマンドでGalaxy Simulatorをデプロイできます：

```bash
# 開発環境デプロイ
./aws/deploy.sh -e development

# フル機能本番デプロイ  
./aws/deploy.sh -e production -m -c -n admin@company.com
```

権限設定は一度だけ必要です。設定後はワンコマンドでエンタープライズ級のN体シミュレーションがクラウドにデプロイされます！