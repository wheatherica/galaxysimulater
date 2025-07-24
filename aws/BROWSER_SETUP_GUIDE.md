# 🌐 AWS IAMコンソールでの権限設定手順

## ステップ1: AWS IAMコンソールにログイン

1. **https://console.aws.amazon.com** にアクセス
2. **管理者権限のあるユーザー**でログイン
3. **サービス** → **IAM** を選択

## ステップ2: カスタムポリシーを作成

### 2-1. ポリシー作成画面に移動
- 左メニューから **「Policies」** をクリック
- **「Create policy」** ボタンをクリック

### 2-2. JSON形式でポリシーを入力
1. **「JSON」** タブをクリック
2. 既存の内容を全て削除
3. 以下のJSONをコピー&ペースト：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "LambdaManagement",
            "Effect": "Allow",
            "Action": [
                "lambda:CreateFunction",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "lambda:GetFunction",
                "lambda:ListFunctions",
                "lambda:InvokeFunction",
                "lambda:CreateFunctionUrlConfig",
                "lambda:GetFunctionUrlConfig",
                "lambda:UpdateFunctionUrlConfig",
                "lambda:DeleteFunctionUrlConfig"
            ],
            "Resource": "*"
        },
        {
            "Sid": "IAMRoleManagement",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:GetRole",
                "iam:PassRole",
                "iam:AttachRolePolicy",
                "iam:PutRolePolicy",
                "iam:TagRole"
            ],
            "Resource": [
                "arn:aws:iam::426229613300:role/galaxy-sim-*",
                "arn:aws:iam::426229613300:role/GalaxySimLambdaRole-*"
            ]
        },
        {
            "Sid": "S3Management",
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:GetBucketLocation",
                "s3:ListBucket",
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:PutBucketPublicAccessBlock"
            ],
            "Resource": [
                "arn:aws:s3:::galaxy-sim-*",
                "arn:aws:s3:::galaxy-sim-*/*"
            ]
        },
        {
            "Sid": "APIGatewayManagement",
            "Effect": "Allow",
            "Action": [
                "apigateway:GET",
                "apigateway:POST",
                "apigateway:PUT",
                "apigateway:DELETE",
                "apigateway:PATCH"
            ],
            "Resource": "arn:aws:apigateway:*::/restapis/*"
        },
        {
            "Sid": "CloudFormationManagement",
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:UpdateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:GetTemplate",
                "cloudformation:ListStacks"
            ],
            "Resource": "arn:aws:cloudformation:*:426229613300:stack/galaxy-sim-*/*"
        }
    ]
}
```

### 2-3. ポリシーを完成させる
1. **「Next: Tags」** をクリック（タグは省略可能）
2. **「Next: Review」** をクリック
3. **Policy name** に `GalaxySimulatorPolicy` と入力
4. **Description** に `Galaxy Simulator deployment permissions` と入力
5. **「Create policy」** をクリック

## ステップ3: ユーザーにポリシーをアタッチ

### 3-1. ユーザー画面に移動
- 左メニューから **「Users」** をクリック
- **「galaxysimulation」** ユーザーをクリック

### 3-2. 権限を追加
1. **「Permissions」** タブを選択
2. **「Add permissions」** をクリック
3. **「Attach existing policies directly」** を選択

### 3-3. ポリシーを検索・選択
1. 検索ボックスに `GalaxySimulatorPolicy` と入力
2. 表示されたポリシーにチェックを入れる
3. **「Next: Review」** をクリック
4. **「Add permissions」** をクリック

## ステップ4: 設定完了の確認

### 4-1. ブラウザでの確認
- ユーザー「galaxysimulation」の **Permissions** タブで
- **「GalaxySimulatorPolicy」** がアタッチされていることを確認

### 4-2. ターミナルでの確認
```bash
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater/aws
./check-and-deploy.sh
```

## ステップ5: 自動デプロイ実行

権限設定が完了すると、以下のメッセージが表示されます：
```
🎉 デプロイ準備完了！
今すぐAWSリソースをデプロイしますか？ (y/N):
```

**「y」** を入力してEnterを押すと、AWS統合が自動的に有効になります！

---

## 📸 重要な画面のスクリーンショット参考

1. **IAM → Policies → Create policy → JSON**
2. **IAM → Users → galaxysimulation → Add permissions**
3. **最終確認：Attached policiesに「GalaxySimulatorPolicy」表示**

設定完了後は、Galaxy SimulatorでAWS Lambda による真のクラウド処理が利用可能になります！