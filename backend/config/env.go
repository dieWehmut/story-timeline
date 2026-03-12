package config

import (
	"os"
	"strings"
)

type Env struct {
	Port                string
	FrontendOrigin      string
	FrontendBaseURL     string
	GitHubClientID      string
	GitHubClientSecret  string
	GitHubCallbackURL   string
	GitHubRepoOwner     string
	GoogleClientID      string
	GoogleClientSecret  string
	GoogleCallbackURL   string
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
	frontendBaseURL := getEnv("FRONTEND_BASE_URL", "http://localhost:5173")
	defaultCallbackURL := strings.TrimRight(frontendBaseURL, "/") + "/api/auth/github/callback"

	return Env{
		Port:                getEnv("PORT", "7860"),
		FrontendOrigin:      getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
		FrontendBaseURL:     frontendBaseURL,
		GitHubClientID:      os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret:  os.Getenv("GITHUB_CLIENT_SECRET"),
		GitHubCallbackURL:   getEnv("GITHUB_CALLBACK_URL", defaultCallbackURL),
		GitHubRepoOwner:     os.Getenv("GITHUB_REPO_OWNER"),
		GoogleClientID:      os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:  os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleCallbackURL:   getEnv("GOOGLE_CALLBACK_URL", getEnv("FRONTEND_BASE_URL", "http://localhost:5173")+"/api/auth/google/callback"),
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
