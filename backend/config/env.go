package config

import "os"

type Env struct {
	Port               string
	FrontendOrigin     string
	FrontendBaseURL    string
	GitHubClientID     string
	GitHubClientSecret string
	GitHubCallbackURL  string
	GitHubRepoOwner    string
	SupabaseURL        string
	SupabaseServiceKey string
	R2AccountID        string
	R2AccessKeyID      string
	R2SecretAccessKey  string
	R2Bucket           string
	R2Endpoint         string
	R2Region           string
	SessionSecret      string
	SecureCookies      bool
}

func LoadEnv() Env {
	return Env{
		Port:               getEnv("PORT", "7860"),
		FrontendOrigin:     getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
		FrontendBaseURL:    getEnv("FRONTEND_BASE_URL", "http://localhost:5173"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		GitHubCallbackURL:  getEnv("GITHUB_CALLBACK_URL", "http://localhost:7860/api/auth/github/callback"),
		GitHubRepoOwner:    os.Getenv("GITHUB_REPO_OWNER"),
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		R2AccountID:        os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:      os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey:  os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:           os.Getenv("R2_BUCKET"),
		R2Endpoint:         os.Getenv("R2_ENDPOINT"),
		R2Region:           getEnv("R2_REGION", "auto"),
		SessionSecret:      getEnv("SESSION_SECRET", "change-me"),
		SecureCookies:      getEnv("SECURE_COOKIES", "false") == "true",
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}