# ダンプ運転手用 勤怠管理システム

ダンプ運転手の勤怠管理・日報管理を行うWebアプリケーションです。
スマートフォンからも利用可能なレスポンシブデザインで、現場からの打刻や日報入力に対応しています。

## 技術スタック

- **フロントエンド**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **バックエンド**: Next.js API Routes
- **データベース**: SQLite (Prisma ORM)
- **認証**: NextAuth.js (Credentials Provider)

## 機能一覧

### 運転手向け
- 出退勤打刻（出勤・退勤・休憩開始・休憩終了）
- 日報入力（車両番号、積込/荷卸場所、往復回数、走行距離、給油量）
- 勤怠履歴閲覧
- **勤怠入力漏れ対策**: 対象期間の未入力日を一覧表示し、クリックで該当日へ遷移

### 管理者向け
- ダッシュボード
- 社員管理
- 勤怠承認
- システム設定
- **運行管理者メール通知**:
  - **日次**: 運転手の勤怠入力完了時に、その日の全運転手の保存が完了したタイミングで、優先順位で指定された運行管理者にメール通知
  - **期間完了時**: 対象期間の勤怠をすべて承認したタイミングで、優先順位で指定された運行管理者および管理者全員にメール通知

## セットアップ

### 前提条件
- Node.js 18以上
- npm

### インストール

```bash
cd dump-attendance
npm install
```

### データベース初期化

```bash
npx prisma migrate dev
npx prisma db seed
```

### 環境変数（ローカル開発）

`.env.example` を `.env` にコピーして使用してください。

```bash
cp .env.example .env
```

ローカルホスト（http://localhost:3000）で動作するよう、`NEXTAUTH_URL` が設定されています。

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセスしてください。

### メール通知（任意）

運転手の勤怠入力完了時・承認完了時にメール通知する場合、**システム設定** → **メール（SMTP）設定** で以下を入力してください。

- SMTPホスト: smtp.gmail.com
- SMTPポート: 587
- SMTPユーザー: メールアドレス
- SMTPパスワード: App Password（Gmail の場合は2段階認証を有効化後に取得）

.env に設定することも可能です（システム設定が優先されます）。

### テスト用アカウント

| 役割 | 社員番号 | パスワード |
|------|----------|------------|
| 管理者 | ADMIN001 | admin123 |
| 運転手1 | DRV001 | driver123 |
| 運転手2 | DRV002 | driver123 |

## 便利なコマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run db:migrate   # マイグレーション実行
npm run db:seed      # シードデータ投入
npm run db:studio    # Prisma Studio（DB管理画面）
npm run db:reset     # DB初期化
```

## プロジェクト構成

```
dump-attendance/
├── prisma/
│   ├── schema.prisma    # DBスキーマ定義
│   ├── seed.ts          # シードデータ
│   └── migrations/      # マイグレーションファイル
├── src/
│   ├── app/
│   │   ├── api/         # APIルート
│   │   ├── dashboard/   # ダッシュボード画面
│   │   └── login/       # ログイン画面
│   ├── components/      # UIコンポーネント
│   ├── lib/             # ユーティリティ
│   └── types/           # 型定義
└── .env                 # 環境変数
```
