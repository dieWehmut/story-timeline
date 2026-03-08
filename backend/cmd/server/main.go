package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"story-backend/config"
	"story-backend/internal/controller"
	githuboauth "story-backend/internal/github"
	"story-backend/internal/router"
	"story-backend/internal/service"
	"story-backend/internal/storage"
)

func main() {
	env := config.LoadEnv()
	ctx := context.Background()

	oauthClient := githuboauth.NewOAuthClient(env.GitHubClientID, env.GitHubClientSecret, env.GitHubCallbackURL)
	authService := service.NewAuthService(oauthClient, env.SessionSecret, env.SecureCookies)
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

	log.Printf("story-backend listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}