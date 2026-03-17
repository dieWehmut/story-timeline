# 物語集 (Story Timeline)

社交圖片時間線應用 — 使用者可以發佈附帶時間標記的圖片故事，瀏覽動態、點讚、留言，並管理關注關係。

## 架構概覽

```
frontend/                 React SPA + Capacitor Android app
  ├── src/                Vite + React 19 + Tailwind CSS 4
  ├── android/            Capacitor Android 殼
  ├── react-native/       Expo React Native 客戶端（開發中）
  └── api/proxy.go        Vercel Go Serverless 反向代理

backend/                  Go API 伺服器（Gin）
  ├── cmd/server/         主入口
  ├── internal/           controller / service / storage / middleware
  └── supabase/           資料庫 schema

.github/workflows/        CI/CD
```

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19、TypeScript、Vite 7 |
| 樣式 | Tailwind CSS 4 |
| 路由 | React Router v6 |
| 行動端 | Capacitor 8（Android）、Expo React Native |
| 後端框架 | Go、Gin |
| 資料庫 | Supabase（PostgreSQL） |
| 圖片儲存 | Cloudinary |
| 快取 | Redis（Upstash） |
| 認證 | GitHub OAuth、Google OAuth、Email Magic Link |
| 郵件服務 | Resend |
| 錯誤監控 | Sentry |
| 前端部署 | GitHub Pages |
| 後端部署 | HuggingFace Space（Docker） |
| API 代理 | Vercel Go Serverless Function（可選） |

## 前端頁面

| 路由 | 說明 |
|------|------|
| `/` | 首頁動態 |
| `/story`、`/story/:id` | 時間線故事瀏覽 / 單篇故事 |
| `/album` | 相簿檢視 |
| `/post` | 發佈新故事 |
| `/following` | 關注列表 |
| `/follower` | 粉絲列表 |
| `/auth/email` | Email 登入 |

## CI/CD

| 工作流 | 觸發條件 | 作用 |
|--------|----------|------|
| `deploy-gh-pages.yml` | `frontend/**` 推送到 main | 建構前端並部署到 GitHub Pages |
| `hf-sync.yml` | `backend/**` 推送到 main | rsync 後端程式碼到 HuggingFace Space |
| `apply-supabase-schema.yml` | 推送到 main / 手動 | 透過 psql 套用 schema.sql 到 Supabase |
| `redis-init.yml` | `backend/upstash/**` 變更 / 手動 | 初始化 Redis 資料結構 |

## 本地開發

### 前提

- Node.js 22+、pnpm
- Go 1.25+

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

開發伺服器預設監聽 `http://localhost:5173`。

### 後端

在 `backend/` 建立 `.env` 檔案（環境變數說明見 [backend/README.md](backend/README.md)），然後：

```bash
cd backend
go run ./cmd/server
```

預設監聽 `:7860`。

### Android

```bash
cd frontend
pnpm build
npx cap sync android
npx cap open android
```

## 部署

### 1. Supabase

- 建立專案，取得 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。
- 建議關閉後端的 runtime schema apply（`AUTO_APPLY_SCHEMA=false`），改由 GitHub Actions 套用 [backend/supabase/schema.sql](backend/supabase/schema.sql)。
- 在 GitHub Secrets 設定 `SUPABASE_MIGRATION_DB_URL`，使用 Supabase pooler 連線字串（直連端點 `db.<ref>.supabase.co:5432` 預設僅 IPv6，GitHub Actions 等 IPv4 平台無法連線）。

### 2. Cloudinary

- 建立產品環境，取得 `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`。無需額外設定 bucket 或 region。

### 3. HuggingFace Space（後端）

- 以 Docker Space 部署。環境變數完整列表見 [backend/README.md](backend/README.md)。
- OAuth callback URL 應指向前端公開域名（如 `https://<your-site>/api/auth/github/callback`），而非 HF Space 域名。

### 4. GitHub Pages（前端）

- `main` 分支 `frontend/` 變更時自動部署。
- workflow 中 `VITE_API_BASE` 需指向 HF Space 後端地址。

### 5. Vercel API 代理（可選）

- 專案根目錄設為 `frontend`，Go proxy `api/proxy.go` 會將 `/api/*` 轉發到 HF 後端。
- 設定 `HF_TOKEN` 和 `HF_SPACE_BASE_URL`。

### 部署順序建議

1. 建立 Supabase 專案，透過 GitHub Actions 套用 schema。
2. 建立 Cloudinary 環境。
3. 部署 HF Space 後端並設定 secrets。
4. 部署前端（GitHub Pages 或 Vercel）。
5. 驗證登入、動態瀏覽、圖片上傳、留言和按讚功能。
