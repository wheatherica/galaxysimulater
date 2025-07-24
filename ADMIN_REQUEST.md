# 🔑 管理者依頼用 - Galaxy Simulator AWS権限設定

## 依頼内容
ユーザー `galaxysimulation` (アカウントID: 426229613300) に対して、以下のAWS権限追加をお願いします。

## 必要なAWS管理ポリシー
```
1. AmazonDynamoDBFullAccess
2. AmazonAPIGatewayAdministrator  
3. AmazonElastiCacheFullAccess
4. AWSStepFunctionsFullAccess
5. CloudWatchFullAccess
6. AmazonCognitoPowerUser
7. AmazonEventBridgeFullAccess
8. AmazonSNSFullAccess
```

## カスタムポリシー
- ポリシー名: `GalaxySimulatorDeploymentPolicy`
- JSONファイル: `/aws/iam/create-galaxy-policy.json` の内容
- 権限範囲: `galaxy-*` プレフィックスのリソースのみ

## 設定方法（コンソール）
1. IAM → Users → galaxysimulation → Permissions
2. 上記8つの管理ポリシーを順次追加
3. カスタムポリシーをJSONで作成・追加

## 設定方法（CLI）
```bash
# AWS管理ポリシー追加
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AmazonEventBridgeFullAccess
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess

# カスタムポリシー作成・追加
aws iam create-policy --policy-name GalaxySimulatorDeploymentPolicy --policy-document file://aws/iam/create-galaxy-policy.json
aws iam attach-user-policy --user-name galaxysimulation --policy-arn arn:aws:iam::426229613300:policy/GalaxySimulatorDeploymentPolicy
```

## 目的
高性能なN体銀河シミュレーションのAWSクラウドデプロイ
- 100,000+ 天体の並列計算
- Barnes-Hutアルゴリズム最適化
- グローバルスケール配信

## セキュリティ
- 権限は `galaxy-*` プレフィックスに限定
- 最小権限の原則を適用
- リソース制限による安全性確保

---
権限設定完了後、ワンコマンドで本格デプロイが可能になります！