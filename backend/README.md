---
title: story-timeline
emoji: 🚀
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# Story Timeline Backend

Go API 伺服器，基於 Gin 框架，部署為 HuggingFace Space Docker 應用。

## 環境變數

### 必要

| 變數 | 說明 |
|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_REPO_OWNER` | 管理員帳號，用於動態預設排序和 UI 標記 |
| `SESSION_SECRET` | Session 加密金鑰 |
| `SUPABASE_URL` | Supabase 專案 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |

### 可選

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `7860` | HTTP 監聽埠 |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | 前端 URL，用於產生 OAuth callback 地址 |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS 允許來源 |
| `APP_URL_SCHEME` | `storytimeline.me` | 行動端 Deep Link scheme |
| `GITHUB_CALLBACK_URL` | `FRONTEND_BASE_URL + /api/auth/github/callback` | GitHub OAuth callback |
| `GOOGLE_CLIENT_ID` | — | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `FRONTEND_BASE_URL + /api/auth/google/callback` | Google OAuth callback |
| `RESEND_API_KEY` | — | Resend API Key（Email Magic Link） |
| `RESEND_EMAIL_FROM` | — | 寄件人地址 |
| `REDIS_URL` | — | Redis/Upstash 連線字串（session 快取、登入限流） |
| `SENTRY_DSN` | — | Sentry DSN |
| `AUTO_APPLY_SCHEMA` | `false` | 啟動時自動套用 schema.sql（需搭配 `SUPABASE_DB_URL`） |
| `SUPABASE_DB_URL` | — | PostgreSQL 直連字串，僅 `AUTO_APPLY_SCHEMA=true` 時使用 |
| `SECURE_COOKIES` | `false` | 是否為 cookie 設定 Secure 旗標 |

## API 路由

### 認證

| 方法 | 路由 | 說明 |
|------|------|------|
| GET | `/api/auth/github/login` | 發起 GitHub OAuth |
| GET | `/api/auth/github/callback` | GitHub OAuth callback |
| GET | `/api/auth/google/login` | 發起 Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/auth/email/login` | 發送 Email Magic Link |
| GET | `/api/auth/email/callback` | Email 登入 callback |
| POST | `/api/auth/email/exchange` | 交換 email token |
| POST | `/api/auth/email/verify` | 驗證 email token |
| POST | `/api/auth/email/confirm` | 確認 email 登入 |
| POST | `/api/auth/email/poll` | 輪詢 email 登入狀態 |
| POST | `/api/auth/app/poll` | 行動端 OAuth 輪詢 |
| POST | `/api/auth/exchange` | 交換 session |
| GET | `/api/auth/session` | 取得目前 session |
| PATCH | `/api/auth/profile` | 更新個人檔案 |
| POST | `/api/auth/logout` | 登出 |

### 動態與內容

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/feed` | — | 取得動態列表 |
| GET | `/api/feed/users` | — | 取得動態使用者列表 |
| POST | `/api/images` | 需要 | 建立新貼文 |
| PATCH | `/api/my/images/:imageID` | 需要 | 更新自己的貼文 |
| DELETE | `/api/my/images/:imageID` | 需要 | 刪除自己的貼文 |
| GET | `/api/images/:ownerLogin/:imageID/asset/:assetIndex` | — | 取得貼文圖片 |

### 互動

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/images/:ownerLogin/:imageID/like` | 需要 | 切換按讚 |
| GET | `/api/images/:ownerLogin/:imageID/comments` | — | 取得留言 |
| POST | `/api/images/:ownerLogin/:imageID/comments` | 需要 | 新增留言 |
| POST | `/api/images/:ownerLogin/:imageID/comments/:commentID/like` | 需要 | 切換留言按讚 |
| DELETE | `/api/images/:ownerLogin/:imageID/comments/:commentID` | 需要 | 刪除留言 |
| GET | `/api/comments/:commenterLogin/:postOwner/:postID/:commentID/asset/:assetIndex` | — | 取得留言圖片 |

### 關注

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/following` | 需要 | 取得關注列表 |
| GET | `/api/followers` | 需要 | 取得粉絲列表 |
| POST | `/api/follow/:login` | 需要 | 關注使用者 |
| DELETE | `/api/follow/:login` | 需要 | 取消關注 |

### 上傳

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/uploads/images` | 需要 | 取得貼文圖片上傳簽名 |
| POST | `/api/uploads/comments` | 需要 | 取得留言圖片上傳簽名 |

### 通知與健康檢查

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/notification` | — | 取得全站通知 |
| PATCH | `/api/notification` | 管理員 | 更新全站通知 |
| GET | `/api/health/stats` | — | 伺服器統計 |
| POST | `/api/health/ping` | — | Ping |
| GET | `/healthz` | — | 健康檢查端點 |

## 資料庫 Schema

定義在 [supabase/schema.sql](supabase/schema.sql)：

| 資料表 | 說明 |
|--------|------|
| `images` | 貼文（時間標記、描述、標籤、圖片路徑） |
| `likes` | 貼文按讚 |
| `comments` | 留言（支援巢狀回覆：`parent_id`、`reply_to_user_login`） |
| `comment_likes` | 留言按讚 |
| `follows` | 關注關係 |
| `users` | 使用者資料（支援多 provider：github、google、email） |
| `email_logins` | Email Magic Link token（含過期與消費時間） |
| `settings` | 全站設定（JSON value） |

View：`tag_counts`、`user_logins`。函數：`get_tag_counts(filter_author)`。

Schema 建議透過 GitHub Actions（`apply-supabase-schema.yml`）套用，而非啟動時自動執行。如需啟動時套用，設定 `AUTO_APPLY_SCHEMA=true` 和 `SUPABASE_DB_URL`，但需注意 Supabase 直連端點預設僅 IPv6。

## Cloudinary 儲存路徑

| 類型 | 路徑格式 |
|------|----------|
| 貼文圖片 | `images/{authorLogin}/{imageID}/{assetIndex}` |
| 留言圖片 | `comments/{commenterLogin}/{postOwner}/{postID}/{commentID}/{assetIndex}` |

## Docker

```bash
docker build -t story-timeline-backend .
docker run -p 7860:7860 --env-file .env story-timeline-backend
```

多階段建構：`golang:1.25-alpine` 編譯靜態 binary，`alpine:3.20` 作為最終映像，以非 root 使用者（`appuser`）執行。

## 歷史資料遷移

從舊版 GitHub repository 儲存遷移至 Supabase + Cloudinary（一次性操作，冪等可重複執行）：

```bash
go run ./cmd/migrate_github_data
```

額外需要：`GITHUB_STORAGE_TOKEN`、`GITHUB_REPO_NAME`（預設 `story-timeline-data`）、`GITHUB_REPO_BRANCH`（預設 `main`）。

遷移內容：掃描舊 repository，將貼文 metadata、按讚、留言寫入 Supabase，圖片上傳至 Cloudinary。
