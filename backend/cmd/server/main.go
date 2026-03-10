package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/dieWehmut/story-timeline/backend/config"
	"github.com/dieWehmut/story-timeline/backend/internal/controller"
	"github.com/dieWehmut/story-timeline/backend/internal/github"
	"github.com/dieWehmut/story-timeline/backend/internal/router"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

func main() {
	env := config.LoadEnv()
	ctx := context.Background()

	githubOAuthClient := github.NewOAuthClient(env.GitHubClientID, env.GitHubClientSecret, env.GitHubCallbackURL)
	graphqlClient := github.NewGraphQLClient()

	authService := service.NewAuthService(githubOAuthClient, graphqlClient, env.SessionSecret, env.SecureCookies, env.GitHubRepoOwner)
	supabaseStorage := storage.NewSupabaseStorage(env.SupabaseURL, env.SupabaseServiceKey)
	r2Storage, err := storage.NewR2Storage(ctx, storage.R2Config{
		AccountID:       env.R2AccountID,
		AccessKeyID:     env.R2AccessKeyID,
		SecretAccessKey: env.R2SecretAccessKey,
		Bucket:          env.R2Bucket,
		Endpoint:        env.R2Endpoint,
		Region:          env.R2Region,
	})
	if err != nil {
		log.Fatalf("failed to initialize R2 storage: %v", err)
	}

	userService := service.NewUserService(graphqlClient, supabaseStorage, env.GitHubRepoOwner)

	imageService, err := service.NewImageService(ctx, supabaseStorage, r2Storage, env.GitHubRepoOwner)
	if err != nil {
		log.Fatalf("failed to initialize image service: %v", err)
	}

	interactionService := service.NewInteractionService(supabaseStorage, r2Storage)

	server := &http.Server{
		Addr: ":" + env.Port,
		Handler: router.New(router.Dependencies{
			AuthController:   controller.NewAuthController(authService, env.FrontendBaseURL),
			ImageController:  controller.NewImageController(imageService, userService, authService, interactionService),
			HealthController: controller.NewHealthController(env.GitHubRepoOwner, authService),
			AuthService:      authService,
		}, config.AllowedOrigins(env)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("github.com/dieWehmut/story-timeline/backend listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}