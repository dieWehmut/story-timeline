---
title: story-timeline
emoji: 🚀
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

story-timeline backend API service.

## Runtime setup

The backend now uses:

- GitHub OAuth and GraphQL only for login and follow relationships
- Supabase for posts, likes, and comments
- Cloudflare R2 for image object storage

### Required environment variables

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `GITHUB_REPO_OWNER` : admin login used for feed defaults and UI labeling
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID` or `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_REGION` : defaults to `auto`

### Supabase schema

Apply [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor before starting the backend.

### Storage layout

- Post images: `images/{authorLogin}/{imageID}/{assetIndex}.webp`
- Comment images: `comments/{commenterLogin}/{postOwner}/{postID}/{commentID}/{assetIndex}.webp`

### Notes

- Vercel frontend and Go proxy layout does not change.
- The HF backend should expose the same HTTP routes as before.
- GitHub repository storage is no longer used for application data.

## Legacy data migration

Use the one-time migration command to copy old GitHub repository data into Supabase and Cloudflare R2:

```bash
go run ./cmd/migrate_github_data
```

Additional environment variables required by the migration command:

- `GITHUB_STORAGE_TOKEN`
- `GITHUB_REPO_NAME` : defaults to `story-timeline-data`
- `GITHUB_REPO_BRANCH` : defaults to `main`

The migration command:

- scans all legacy `story-timeline-data` repositories visible to `GITHUB_STORAGE_TOKEN`
- copies post metadata into Supabase
- copies likes and comments into Supabase
- copies post and comment images into R2
- can be re-run safely because image, like, and comment writes are idempotent
