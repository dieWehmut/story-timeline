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
- Cloudinary for image object storage

### Required environment variables

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL` : optional, defaults to `FRONTEND_BASE_URL + /api/auth/github/callback`
- `GITHUB_REPO_OWNER` : admin login used for feed defaults and UI labeling
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` : Postgres connection string used only if you intentionally enable runtime schema apply
- `AUTO_APPLY_SCHEMA` : defaults to `false`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Supabase schema

The backend can automatically apply [supabase/schema.sql](supabase/schema.sql) during startup, but this is not recommended on IPv4-only platforms.

Required only if you explicitly enable runtime schema apply:

- `SUPABASE_DB_URL`
- `AUTO_APPLY_SCHEMA=true`

If `AUTO_APPLY_SCHEMA=true` and `SUPABASE_DB_URL` is missing, startup will fail fast.

Recommended setup:

- Keep `AUTO_APPLY_SCHEMA=false` on HF.
- Apply schema through GitHub Actions using `SUPABASE_MIGRATION_DB_URL`.
- Use the Supabase shared pooler / session pooler connection string for GitHub Actions, because the direct `db.<project-ref>.supabase.co:5432` endpoint is IPv6-only unless you purchase the dedicated IPv4 add-on.

For GitHub Actions schema sync, prefer a separate `SUPABASE_MIGRATION_DB_URL` secret that uses the Supabase shared pooler / session pooler connection string instead of the direct `db.<project-ref>.supabase.co:5432` host.

### Storage layout

- Post images: `images/{authorLogin}/{imageID}/{assetIndex}`
- Comment images: `comments/{commenterLogin}/{postOwner}/{postID}/{commentID}/{assetIndex}`

### Notes

- Vercel frontend and Go proxy layout does not change.
- GitHub OAuth callback should point to the public Vercel domain, not the HF Space domain.
- The HF backend should expose the same HTTP routes as before.
- GitHub repository storage is no longer used for application data.

## Legacy data migration

Use the one-time migration command to copy old GitHub repository data into Supabase and Cloudinary:

```bash
go run ./cmd/migrate_github_data
```

Additional environment variables required by the migration command:

- `GITHUB_STORAGE_TOKEN`
- `GITHUB_REPO_NAME` : defaults to `story-timeline-data`
- `GITHUB_REPO_BRANCH` : defaults to `main`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The migration command:

- scans all legacy `story-timeline-data` repositories visible to `GITHUB_STORAGE_TOKEN`
- copies post metadata into Supabase
- copies likes and comments into Supabase
- copies post and comment images into Cloudinary
- can be re-run safely because image, like, and comment writes are idempotent
