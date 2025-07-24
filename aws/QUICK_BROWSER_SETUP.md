# 🚀 5分でできるブラウザ設定

## 現在の状況
❌ **IAM権限が不足** - ブラウザのAWSコンソールで設定が必要

## 🎯 今すぐやること

### 1️⃣ AWSコンソールにログイン
**https://console.aws.amazon.com** → **管理者権限でログイン**

### 2️⃣ IAMポリシー作成（2分）
1. **サービス** → **IAM** → **Policies** → **Create policy**
2. **JSON**タブをクリック
3. **以下をコピペ**：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:*",
                "iam:CreateRole",
                "iam:GetRole",
                "iam:PassRole",
                "iam:AttachRolePolicy",
                "iam:PutRolePolicy",
                "iam:TagRole",
                "s3:*",
                "apigateway:*",
                "cloudformation:*"
            ],
            "Resource": "*"
        }
    ]
}
```

4. **Policy name**: `GalaxySimulatorPolicy`
5. **Create policy**

### 3️⃣ ユーザーに権限付与（1分）
1. **Users** → **galaxysimulation**
2. **Add permissions** → **Attach existing policies directly**
3. **検索**: `GalaxySimulatorPolicy` → チェック
4. **Add permissions**

### 4️⃣ 確認・デプロイ（2分）
ターミナルで：
```bash
./check-and-deploy.sh
```

**「デプロイ準備完了！」** → **「y」を入力** → 🎉完了！

---

## 📸 参考画面

### ポリシー作成画面
- IAM → Policies → Create policy → **JSON**タブ

### ユーザー権限追加画面  
- IAM → Users → galaxysimulation → **Add permissions**

### 完了確認
- Attached policies に **「GalaxySimulatorPolicy」** が表示

---

⏰ **所要時間**: 約5分  
🎯 **完了後**: Galaxy SimulatorでAWS Lambda統合が有効になります！