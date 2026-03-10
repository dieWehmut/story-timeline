package config

import "os"

type Env struct {
	Port                string
	FrontendOrigin      string
	FrontendBaseURL     string
	GitHubClientID      string
	GitHubClientSecret  string
	GitHubCallbackURL   string
	GitHubRepoOwner     string
	SupabaseURL         string
	SupabaseServiceKey  string
	SupabaseDBURL       string
	AutoApplySchema     bool
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string
	SessionSecret       string
	SecureCookies       bool
}

func LoadEnv() Env {
	return Env{
		Port:                getEnv("PORT", "7860"),
		FrontendOrigin:      getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
		FrontendBaseURL:     getEnv("FRONTEND_BASE_URL", "http://localhost:5173"),
		GitHubClientID:      os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret:  os.Getenv("GITHUB_CLIENT_SECRET"),
		GitHubCallbackURL:   getEnv("GITHUB_CALLBACK_URL", "http://localhost:7860/api/auth/github/callback"),
		GitHubRepoOwner:     os.Getenv("GITHUB_REPO_OWNER"),
		SupabaseURL:         os.Getenv("SUPABASE_URL"),
		SupabaseServiceKey:  os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseDBURL:       os.Getenv("SUPABASE_DB_URL"),
		AutoApplySchema:     getEnv("AUTO_APPLY_SCHEMA", "false") == "true",
		CloudinaryCloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryAPIKey:    os.Getenv("CLOUDINARY_API_KEY"),
		CloudinaryAPISecret: os.Getenv("CLOUDINARY_API_SECRET"),
		SessionSecret:       getEnv("SESSION_SECRET", "change-me"),
		SecureCookies:       getEnv("SECURE_COOKIES", "false") == "true",
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}
