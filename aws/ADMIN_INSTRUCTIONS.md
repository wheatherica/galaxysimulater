# Galaxy Simulator AWS権限設定手順

AWS管理者の方へ：Galaxy Simulatorのクラウドデプロイを有効にするため、以下の権限設定をお願いします。

## 必要な作業

### 1. IAMポリシーの作成
```bash
aws iam create-policy \
    --policy-name GalaxySimulatorPolicy \
    --policy-document file://iam-policy.json \
    --description "Galaxy Simulator AWS deployment permissions"
```

### 2. ユーザーへのポリシーアタッチ
```bash
aws iam attach-user-policy \
    --user-name galaxysimulation \
    --policy-arn arn:aws:iam::426229613300:policy/GalaxySimulatorPolicy
```

### 3. 権限確認
```bash
aws iam list-attached-user-policies --user-name galaxysimulation
```

## 付与される権限の概要

- **Lambda Functions**: 関数の作成・更新・実行
- **IAM Roles**: Lambda実行役割の作成・管理
- **S3 Buckets**: シミュレーションデータ保存用バケット管理
- **API Gateway**: REST API作成・管理
- **CloudFormation**: インフラストラクチャのデプロイ

## セキュリティ

- 権限はGalaxy Simulatorプロジェクト専用にスコープ制限
- リソース名プレフィックス `galaxy-sim-*` に限定
- 最小権限の原則に従った設計

## 完了後の確認方法

権限設定完了後、以下のコマンドでデプロイを実行：
```bash
cd aws
./simple-cloudformation-deploy.sh
```

---

**注意**: これらの権限はGalaxy Simulatorの開発・デプロイのためのものです。本番環境では更に制限的な権限設定を推奨します。