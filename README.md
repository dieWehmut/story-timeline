# story-timeline

## Current architecture

- Frontend: Vite + React, deployed on Vercel
- Edge/API proxy: Vercel Go serverless function, forwards `/api/*` to HF backend when needed
- Backend runtime: Hugging Face Space Docker app
- App data: Supabase
- Image objects: Cloudflare R2
- Login and follow graph: GitHub OAuth + GitHub GraphQL

## One-time migration

From the `backend` directory:

```bash
go run ./cmd/migrate_github_data
```

This migrates old GitHub repo data into Supabase and R2.

## Deployment checklist

### 1. Supabase

- Create a new project.
- Open the SQL editor and run [backend/supabase/schema.sql](backend/supabase/schema.sql).
- Copy the project URL as `SUPABASE_URL`.
- Copy the service role key as `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Cloudflare R2

- Create a bucket for story images.
- Create an API token with read/write access to that bucket.
- Record these values:
	- `R2_ACCOUNT_ID`
	- `R2_ACCESS_KEY_ID`
	- `R2_SECRET_ACCESS_KEY`
	- `R2_BUCKET`
- Leave `R2_REGION=auto` unless you have a custom setup.
- If you prefer a custom endpoint, set `R2_ENDPOINT`; otherwise the backend derives it from `R2_ACCOUNT_ID`.

### 3. Hugging Face Space

- Keep the backend deployed as the Docker Space.
- In Space Variables / Secrets, configure:
	- `GITHUB_CLIENT_ID`
	- `GITHUB_CLIENT_SECRET`
	- `GITHUB_CALLBACK_URL`
	- `GITHUB_REPO_OWNER`
	- `SESSION_SECRET`
	- `SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- `R2_ACCOUNT_ID`
	- `R2_ACCESS_KEY_ID`
	- `R2_SECRET_ACCESS_KEY`
	- `R2_BUCKET`
	- `R2_REGION=auto`
- For migration only, also set:
	- `GITHUB_STORAGE_TOKEN`
	- `GITHUB_REPO_NAME=story-timeline-data`
	- `GITHUB_REPO_BRANCH=main`
- Make sure `GITHUB_CALLBACK_URL` points back to the HF backend domain, for example `https://<space>.hf.space/api/auth/github/callback`.
- Redeploy the Space after updating secrets.

### 4. Vercel

- Set the project root to `frontend`.
- Keep the existing Go proxy entry in `frontend/api/proxy.go`.
- In Vercel environment variables, set:
	- `HF_TOKEN`
	- `HF_SPACE_BASE_URL=https://<space>.hf.space`
- Redeploy after env updates.

## Suggested rollout order

1. Create Supabase tables.
2. Create the R2 bucket and credentials.
3. Update HF backend secrets and redeploy HF.
4. Run `go run ./cmd/migrate_github_data` once from the backend.
5. Update Vercel env vars and redeploy the frontend.
6. Verify login, feed loading, image upload, comment upload, and likes.
