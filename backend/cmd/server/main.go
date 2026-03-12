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

	if env.AutoApplySchema {
		if err := storage.ApplySchemaFile(ctx, env.SupabaseDBURL, "supabase/schema.sql"); err != nil {
			log.Fatalf("failed to apply Supabase schema: %v", err)
		}
	}

	githubOAuthClient := github.NewOAuthClient(env.GitHubClientID, env.GitHubClientSecret, env.GitHubCallbackURL)
	graphqlClient := github.NewGraphQLClient()

	authService := service.NewAuthService(githubOAuthClient, graphqlClient, env.SessionSecret, env.SecureCookies, env.GitHubRepoOwner)
	supabaseStorage := storage.NewSupabaseStorage(env.SupabaseURL, env.SupabaseServiceKey)
	cloudinaryStorage, err := storage.NewCloudinaryStorage(storage.CloudinaryConfig{
		CloudName: env.CloudinaryCloudName,
		APIKey:    env.CloudinaryAPIKey,
		APISecret: env.CloudinaryAPISecret,
	})
	if err != nil {
		log.Fatalf("failed to initialize Cloudinary storage: %v", err)
	}

	userService := service.NewUserService(graphqlClient, supabaseStorage, env.GitHubRepoOwner)

	imageService, err := service.NewImageService(ctx, supabaseStorage, cloudinaryStorage, env.GitHubRepoOwner)
	if err != nil {
		log.Fatalf("failed to initialize image service: %v", err)
	}

	interactionService := service.NewInteractionService(supabaseStorage, cloudinaryStorage)

	server := &http.Server{
		Addr: ":" + env.Port,
		Handler: router.New(router.Dependencies{
			AuthController:   controller.NewAuthController(authService, env.FrontendBaseURL),
			ImageController:  controller.NewImageController(imageService, userService, authService, interactionService, cloudinaryStorage),
			HealthController: controller.NewHealthController(env.GitHubRepoOwner, authService),
			AuthService:      authService,
		}, config.AllowedOrigins(env)),
		ReadHeaderTimeout: 5 * time.Second,
		// Support large uploads (videos <= 200MB).
		ReadTimeout:  10 * time.Minute,
		WriteTimeout: 10 * time.Minute,
		IdleTimeout:  2 * time.Minute,
	}

	log.Printf("github.com/dieWehmut/story-timeline/backend listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}
