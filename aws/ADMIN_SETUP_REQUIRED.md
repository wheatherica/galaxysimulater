# ⚠️ 管理者権限が必要です

## 問題
現在のユーザー `galaxysimulation` には、自分自身に権限を付与する権限がありません。

## 解決方法

### オプション1: 管理者アクセスのあるユーザーで実行

**別のAWSユーザー（管理者権限あり）で以下を実行：**

```bash
# 管理者権限のあるAWSプロファイルに切り替え
aws configure --profile admin
# または
export AWS_PROFILE=admin

# 権限設定を実行
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater/aws
./setup-permissions.sh
```

### オプション2: AWS IAMコンソールで手動設定

1. **AWS IAMコンソール**にログイン（管理者権限で）
2. **Policies** → **Create Policy**
3. **JSON**タブで `iam-policy.json` の内容をペースト
4. ポリシー名: `GalaxySimulatorPolicy`
5. **Users** → `galaxysimulation` → **Add permissions**
6. **Attach existing policies directly** → `GalaxySimulatorPolicy` を選択

### オプション3: AWS CLIで管理者が実行

**管理者が以下のコマンドを実行：**

```bash
# 1. ポリシー作成
aws iam create-policy \
    --policy-name GalaxySimulatorPolicy \
    --policy-document file://iam-policy.json \
    --description "Galaxy Simulator deployment permissions"

# 2. ユーザーにポリシーをアタッチ
aws iam attach-user-policy \
    --user-name galaxysimulation \
    --policy-arn arn:aws:iam::426229613300:policy/GalaxySimulatorPolicy
```

## 権限設定完了後

管理者による権限設定が完了したら：

```bash
cd /Users/yutohatakawa/Developer/Projects/galaxysimulater/aws
./check-and-deploy.sh
```

## 一時的な解決策

管理者権限の設定まで、アプリケーションは**デモモード**で動作を続けます：
- 最大500,000星のシミュレーション
- AWS機能のシミュレート
- 実際のクラウド処理ではないが完全に機能

---

**次のステップ:** AWSアカウントの管理者に上記の権限設定を依頼してください。