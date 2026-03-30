# Story Timeline Backend

`backend/` 是 Story Timeline 的 Go API 服务，负责认证、注册审核、动态流、帖子与评论、关注关系、Cloudinary 直传签名、通知公告，以及健康检查接口。

当前后端是一个标准的 Gin 服务，可按普通 Go 服务部署。

历史备注：

- `cmd/migrate_github_data（×）`：过去用于把旧 GitHub 存储迁移到 Supabase + Cloudinary 的一次性脚本，当前仓库已移除

## 运行要求

- Go 1.25+ 或 Docker
- Supabase
- Cloudinary

可选依赖：

- Redis：session 状态、登录限流、短期 token / nonce 存储
- Resend：Email 登录与审核邮件
- GitHub OAuth / Google OAuth：第三方登录与账号绑定
- Sentry：错误监控

## 环境变量

### 核心配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `7860` | HTTP 监听端口 |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | 前端公开地址，用于生成回调地址和邮件链接 |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS 允许来源；当前实现只支持单个 origin |
| `APP_URL_SCHEME` | `storytimeline.me` | 移动端 Deep Link scheme |
| `SESSION_SECRET` | `change-me` | Session 加密密钥；生产环境必须覆盖 |
| `SECURE_COOKIES` | `false` | 是否给 cookie 加 `Secure` 标记 |
| `GITHUB_REPO_OWNER` | — | 管理员 / 站点 owner 登录名，影响管理权限和部分前端展示 |

### 必需的外部服务

| 变量 | 说明 |
|------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |

说明：Cloudinary 配置缺失时，服务会在启动阶段直接失败。

### 按功能启用

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GITHUB_CLIENT_ID` | — | GitHub OAuth 登录 / 绑定 |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth 登录 / 绑定 |
| `GITHUB_CALLBACK_URL` | `FRONTEND_BASE_URL + /api/auth/github/callback` | GitHub OAuth 回调地址 |
| `GOOGLE_CLIENT_ID` | — | Google OAuth 登录 / 绑定 |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth 登录 / 绑定 |
| `GOOGLE_CALLBACK_URL` | `FRONTEND_BASE_URL + /api/auth/google/callback` | Google OAuth 回调地址 |
| `RESEND_API_KEY` | — | Email 登录与审核邮件 |
| `RESEND_EMAIL_FROM` | — | 邮件发件人地址 |
| `REDIS_URL` | — | Redis / Upstash 连接串 |
| `SENTRY_DSN` | — | Sentry DSN |
| `AUTO_APPLY_SCHEMA` | `false` | 启动时自动执行 `supabase/schema.sql` |
| `SUPABASE_DB_URL` | — | PostgreSQL 连接串，仅 `AUTO_APPLY_SCHEMA=true` 时使用 |

## 本地运行

在 `backend/.env` 中填好配置后运行：

```bash
cd backend
go run ./cmd/server
```

或者使用 Makefile：

```bash
cd backend
make run
```

默认监听 `:7860`。

可用的健康检查端点：

- `GET /`
- `GET /ping`
- `GET /healthz`

## Docker

```bash
cd backend
docker build -t story-timeline-backend .
docker run -p 7860:7860 --env-file .env story-timeline-backend
```

镜像采用多阶段构建：

- `golang:1.25-alpine` 负责编译
- `alpine:3.20` 作为运行时镜像
- 最终进程以非 root 用户 `appuser` 运行

## API 概览

下面列的是主要接口分组，便于快速定位，不是逐字逐句的完整 API 文档。

### 认证与账号绑定

| 路由 | 说明 |
|------|------|
| `GET /api/auth/github/login` | GitHub 登录入口 |
| `GET /api/auth/google/login` | Google 登录入口 |
| `POST /api/auth/email/login` | 发起 Email 登录 |
| `GET /api/auth/session` | 获取当前 session |
| `PATCH /api/auth/profile` | 更新个人资料 |
| `GET /api/auth/identities` | 获取已绑定身份 |
| `POST /api/auth/bind/*` | 绑定 GitHub / Google / Email |
| `DELETE /api/auth/unbind/:provider` | 解绑账号 |
| `POST /api/auth/logout` | 登出 |

### 动态、帖子与媒体

| 路由 | 说明 |
|------|------|
| `GET /api/feed` | 获取动态流 |
| `GET /api/feed/users` | 获取动态涉及的用户列表 |
| `POST /api/images` | 创建帖子 |
| `PATCH /api/my/images/:imageID` | 更新自己的帖子 |
| `DELETE /api/my/images/:imageID` | 删除自己的帖子 |
| `GET /api/images/:ownerLogin/:imageID/asset/:assetIndex` | 访问帖子媒体资源 |

### 评论、点赞与关注

| 路由 | 说明 |
|------|------|
| `GET /api/images/:ownerLogin/:imageID/comments` | 获取评论 |
| `POST /api/images/:ownerLogin/:imageID/comments` | 发表评论 |
| `POST /api/images/:ownerLogin/:imageID/like` | 切换帖子点赞 |
| `POST /api/images/:ownerLogin/:imageID/comments/:commentID/like` | 切换评论点赞 |
| `DELETE /api/images/:ownerLogin/:imageID/comments/:commentID` | 删除评论 |
| `GET /api/following` / `GET /api/followers` | 获取关注 / 粉丝列表 |
| `POST /api/follow/:login` / `DELETE /api/follow/:login` | 关注 / 取关 |

### 上传、注册与管理

| 路由 | 说明 |
|------|------|
| `POST /api/uploads/images` | 获取帖子媒体上传签名 |
| `POST /api/uploads/comments` | 获取评论媒体上传签名 |
| `POST /api/register` | 注册申请 |
| `GET/POST /api/admin/approve/:userID` | 邮件审批通过 |
| `GET/POST /api/admin/reject/:userID` | 邮件审批拒绝 |
| `GET/POST/DELETE /api/admin/invite-code` | 邀请码管理 |
| `GET /api/admin/pending-users` | 待审核用户列表 |
| `POST /api/admin/users/:login/approve` / `POST /api/admin/users/:login/reject` | 管理端审批接口 |

### 通知与健康检查

| 路由 | 说明 |
|------|------|
| `GET /api/notification` | 获取全站通知 |
| `PATCH /api/notification` | 更新全站通知（管理员） |
| `GET /api/health/stats` | 服务统计信息 |
| `POST /api/health/ping` | Ping |
| `GET /healthz` | 存活检查 |

## 数据存储

### Supabase

数据库 schema 位于 [supabase/schema.sql](supabase/schema.sql)。

核心表包括：

- `users`
- `images`
- `likes`
- `comments`
- `comment_likes`
- `follows`
- `email_logins`
- `settings`

另有统计 view 和函数供前后端使用。

### Cloudinary

媒体对象按以下路径组织：

| 类型 | 路径格式 |
|------|----------|
| 帖子图片 | `images/{authorLogin}/{imageID}/{assetIndex}` |
| 帖子视频 | `videos/{authorLogin}/{imageID}/{assetIndex}` |
| 评论图片 | `comments/{commenterLogin}/{postOwner}/{postID}/{commentID}/{assetIndex}` |
| 评论视频 | `comment-videos/{commenterLogin}/{postOwner}/{postID}/{commentID}/{assetIndex}` |

当前实现支持图片和视频；服务端为大文件上传保留了较长超时，前端对单个视频大小也有额外限制。

### Redis

如果配置了 `REDIS_URL`，后端会启用：

- 登录限流
- OAuth / Email 登录中的临时 state 与 token
- 部分 session 相关短期状态

未配置时服务仍可启动，但对应能力会降级。

## 运维建议

- 生产环境务必设置 `SESSION_SECRET`，并开启 `SECURE_COOKIES=true`
- `FRONTEND_BASE_URL` 和 `FRONTEND_ORIGIN` 要与真实前端域名一致
- 如果服务部署在反向代理后，请正确转发 `X-Forwarded-Proto` 和 `X-Forwarded-Host`
- 推荐通过仓库根目录的 `apply-supabase-schema.yml` 应用 schema，而不是让应用启动时自动执行
- 若必须在启动时自动执行 schema，需要设置 `AUTO_APPLY_SCHEMA=true` 和 `SUPABASE_DB_URL`
- GitHub Actions 连接 Supabase 时，优先使用 IPv4 可达的 pooler 连接串

## 与仓库其他部分的关系

- Web 前端位于 `../frontend`
- 可选同源代理位于 `../frontend/api/proxy.go`
- 更上层的项目说明见 [../README.md](../README.md)
