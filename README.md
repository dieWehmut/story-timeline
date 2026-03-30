# Story Timeline

一个围绕“时间线叙事”展开的社交应用。用户可以发布带时间点或时间段的故事内容，浏览动态与相册，上传图片和视频，点赞、评论、关注他人，并通过邀请码与审核流程完成注册。

## 功能概览

- 时间线动态、故事视图、相册视图
- 图片和视频内容发布
- 帖子点赞、评论、评论点赞、关注关系
- GitHub / Google / Email 登录
- 账号绑定与解绑
- 邀请码注册、管理员审核、通知公告
- Web、Capacitor Android，以及一个仍在整理中的 Expo React Native 客户端

## 仓库结构

```text
frontend/                 React SPA + Capacitor Android + 可选 Vercel 代理
  src/                    Web 前端（Vite + React 19 + Tailwind CSS 4）
  android/                Capacitor Android 壳
  react-native/           Expo React Native 客户端（实验中）
  api/proxy.go            可选的同源 API 代理

backend/                  Go API 服务（Gin）
  cmd/server/             服务入口
  internal/               controller / service / storage / router
  supabase/schema.sql     数据库 schema
  upstash/                Redis 初始化脚本

.github/workflows/        当前 CI/CD 工作流
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite 7 |
| 样式 | Tailwind CSS 4 |
| 路由 | React Router v6 |
| 移动端 | Capacitor 8（Android）、Expo React Native |
| 后端 | Go 1.25、Gin |
| 数据库 | Supabase（PostgreSQL） |
| 媒体存储 | Cloudinary |
| 缓存 / 状态 | Redis（可选） |
| 邮件 | Resend（可选） |
| 监控 | Sentry（可选） |

## 本地开发

### 前置依赖

- Node.js 22+
- pnpm
- Go 1.25+
- 一个可用的 Supabase 项目
- 一个可用的 Cloudinary 账号

Redis、Resend、GitHub / Google OAuth 都是可选项；不启用对应功能时可以先不配。

### 1. 启动后端

先按 [backend/README.md](backend/README.md) 配好 `backend/.env`，然后运行：

```bash
cd backend
go run ./cmd/server
```

默认监听 `http://localhost:7860`。

### 2. 启动前端

```bash
cd frontend
pnpm install
VITE_API_BASE=http://localhost:7860 pnpm dev
```

开发服务器默认监听 `http://localhost:5173`。

说明：

- 本地直接跑 Vite 时，建议显式设置 `VITE_API_BASE=http://localhost:7860`
- 如果不设置，浏览器会按同源请求 `/api/*`，而仓库当前没有为 Vite dev server 配置本地代理

### 3. Android（Capacitor）

```bash
cd frontend
pnpm build
npx cap sync android
npx cap open android
```

## 部署方式

### 后端

后端不再绑定任何特定平台，直接按普通 Go 服务部署即可：

```bash
cd backend
docker build -t story-timeline-backend .
docker run -p 7860:7860 --env-file .env story-timeline-backend
```

也可以直接编译后以二进制方式运行：

```bash
cd backend
go build -o server ./cmd/server
./server
```

适合的部署环境包括 VPS、Docker 主机、Coolify、Railway、Fly.io、Kubernetes 等。

### 前端静态部署

如果前端部署到 GitHub Pages、Netlify 或其他纯静态托管：

- 构建时把 `VITE_API_BASE` 指向你的后端公网地址
- 例如：`VITE_API_BASE=https://api.example.com pnpm build`

仓库里现有的 `deploy-gh-pages.yml` 会自动构建并推送 `gh-pages` 分支；启用前请把 workflow 中的 `VITE_API_BASE` 改成你自己的后端地址。

### Vercel 同源代理（可选）

`frontend/api/proxy.go` 可以把 `/api/*` 请求转发到后端，适合把静态前端和 API 代理一起放到 Vercel：

- Vercel 项目根目录设为 `frontend`
- 设置环境变量 `BACKEND_URL=https://api.example.com`
- 前端构建时可以不设置 `VITE_API_BASE`，让浏览器走同源 `/api/*`

## GitHub Actions

当前仓库里保留的工作流只有这些：

| 工作流 | 作用 |
|--------|------|
| `deploy-gh-pages.yml` | 构建前端并发布到 `gh-pages` |
| `apply-supabase-schema.yml` | 将 `backend/supabase/schema.sql` 应用到 Supabase |
| `redis-init.yml` | 初始化 Redis 所需数据结构 |

## 运行时依赖说明

- Supabase：存储用户、帖子、评论、关注、邀请码与站点设置
- Cloudinary：存储帖子和评论里的图片 / 视频资源
- Redis：可选，用于 session 状态、登录限流和部分短期状态
- Resend：可选，用于 Email 登录和审核邮件

## 现状备注

- `frontend/react-native/README.md` 还是 Expo 初始模板，暂时没有纳入这次文档重写范围
