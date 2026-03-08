package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/dieWehmut/inner/backend/config"
	"github.com/dieWehmut/inner/backend/internal/controller"
	"github.com/dieWehmut/inner/backend/internal/github"
	"github.com/dieWehmut/inner/backend/internal/router"
	"github.com/dieWehmut/inner/backend/internal/service"
	"github.com/dieWehmut/inner/backend/internal/storage"
)

func main() {
	env := config.LoadEnv()
	ctx := context.Background()
	githubOAuthClient := github.NewOAuthClient(env.GitHubClientID, env.GitHubClientSecret, env.GitHubCallbackURL)
	authService := service.NewAuthService(githubOAuthClient, env.SessionSecret, env.SecureCookies)
	gitHubStorage := storage.NewGitHubStorage(env.GitHubRepoOwner, env.GitHubRepoName, env.GitHubRepoBranch, env.GitHubStorageToken)
	imageService, err := service.NewImageService(ctx, gitHubStorage, env.CacheFile)
	if err != nil {
		log.Fatalf("failed to initialize image service: %v", err)
	}

	server := &http.Server{
		Addr:              ":" + env.Port,
		Handler:           router.New(router.Dependencies{
			AuthController:   controller.NewAuthController(authService, env.FrontendBaseURL),
			ImageController:  controller.NewImageController(imageService),
			HealthController: controller.NewHealthController(env.GitHubRepoOwner),
			AuthService:      authService,
		}, config.AllowedOrigins(env)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("github.com/dieWehmut/inner/backend listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}