# Galaxy Simulator AWS Infrastructure

この設定により、AWS Lambda、S3、API Gatewayを使用して最大500,000個の星を持つ高性能銀河シミュレーションが可能になります。

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│  API Gateway    │───▶│  Lambda Function│
│  (Frontend)     │    │  (REST API)     │    │  (N-body calc)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   Amazon S3     │
                                               │  (Data Cache)   │
                                               └─────────────────┘
```

## 機能

- **高性能計算**: AWS Lambdaで最大15分、3GB RAMでの並列N体計算
- **自動スケーリング**: 需要に応じた自動リソース調整
- **データキャッシュ**: S3でシミュレーション状態の永続化
- **コスト最適化**: 使用分のみ課金、アイドル時はコストゼロ

## デプロイ手順

### 1. 前提条件

```bash
# AWS CLI のインストール (macOS)
brew install awscli

# AWS 認証情報の設定
aws configure
```

### 2. デプロイ実行

```bash
cd aws
./deploy.sh
```

### 3. 環境変数の更新

デプロイ後に表示されるAPI EndpointをNext.jsアプリに設定：

```bash
# .env.local
NEXT_PUBLIC_AWS_API_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/simulate
```

### 4. フロントエンドの再デプロイ

```bash
npx vercel --prod
```

## パフォーマンス比較

| モード | 最大星数 | 処理場所 | 制限 |
|-------|---------|----------|------|
| ローカル | 50,000 | ブラウザ | CPU、メモリ制限 |
| AWS | 500,000 | Lambda | 15分タイムアウト |

## コスト見積もり

### 10万星、1時間シミュレーション:
- Lambda実行: ~$0.05
- API Gateway: ~$0.01
- S3ストレージ: ~$0.001
- **合計: ~$0.06/時間**

### 50万星、1時間シミュレーション:
- Lambda実行: ~$0.25
- API Gateway: ~$0.05
- S3ストレージ: ~$0.005
- **合計: ~$0.30/時間**

## 技術仕様

### Lambda関数
- **Runtime**: Node.js 18.x
- **Memory**: 3,008 MB (最大)
- **Timeout**: 900秒 (15分)
- **Concurrency**: 10並列実行

### API Gateway
- **Type**: REST API
- **CORS**: 有効
- **Rate Limiting**: なし

### S3バケット
- **Versioning**: 有効
- **Public Access**: ブロック
- **CORS**: 設定済み

## 監視とデバッグ

### CloudWatch ログ
```bash
aws logs tail /aws/lambda/galaxy-simulator-dev --follow
```

### パフォーマンス監視
- Lambda Duration
- Lambda Memory Usage
- API Gateway 4XX/5XX errors
- S3 Request metrics

## セキュリティ

- IAM最小権限の原則
- S3バケットのパブリックアクセスブロック
- API Gateway CORS設定
- Lambda実行ロールの制限

## トラブルシューティング

### よくある問題

1. **Lambda Timeout**
   - 星の数を削減
   - 計算アルゴリズムの最適化

2. **Memory Limit**
   - メモリサイズの増加（最大3GB）
   - データ圧縮の改善

3. **API Gateway 429 Error**
   - Rate limitingの調整
   - リクエスト頻度の削減

### デバッグコマンド

```bash
# Lambda関数のテスト
aws lambda invoke \
  --function-name galaxy-simulator-dev \
  --payload '{"body":"{\"action\":\"initialize\",\"params\":{\"nBodies\":10000}}"}' \
  response.json

# S3バケット内容の確認
aws s3 ls s3://galaxy-simulator-data-dev-YOUR-ACCOUNT-ID/simulations/
```

## 本番環境への展開

本番環境では以下の変更を推奨：

1. **環境分離**
   ```bash
   ./deploy.sh prod
   ```

2. **監視強化**
   - CloudWatch Alarms
   - X-Ray tracing
   - Custom metrics

3. **セキュリティ強化**
   - API Key認証
   - WAF設定
   - VPC内配置

## クリーンアップ

リソースの削除：

```bash
aws cloudformation delete-stack --stack-name galaxy-simulator-stack
```

## サポート

問題が発生した場合は、以下の情報を含めてお問い合わせください：

- AWS Account ID
- Region
- Error messages
- CloudWatch logs