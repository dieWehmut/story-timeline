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
	GitHubRepoName     string
	GitHubRepoBranch   string
	GitHubStorageToken string
	SessionSecret      string
	SecureCookies      bool
	CacheFile          string
}

func LoadEnv() Env {
	return Env{
		Port:               getEnv("PORT", "7860"),
		FrontendOrigin:     getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
		FrontendBaseURL:    getEnv("FRONTEND_BASE_URL", "http://localhost:5173"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		GitHubCallbackURL:  getEnv("GITHUB_CALLBACK_URL", "http://localhost:8080/api/auth/github/callback"),
		GitHubRepoOwner:    os.Getenv("GITHUB_REPO_OWNER"),
		GitHubRepoName:     getEnv("GITHUB_REPO_NAME", "story-images"),
		GitHubRepoBranch:   getEnv("GITHUB_REPO_BRANCH", "main"),
		GitHubStorageToken: os.Getenv("GITHUB_STORAGE_TOKEN"),
		SessionSecret:      getEnv("SESSION_SECRET", "change-me"),
		SecureCookies:      getEnv("SECURE_COOKIES", "false") == "true",
		CacheFile:          getEnv("CACHE_FILE", "data/cache.json"),
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}