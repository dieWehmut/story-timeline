package main

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/dieWehmut/story-timeline/backend/config"
	"github.com/dieWehmut/story-timeline/backend/internal/controller"
	"github.com/dieWehmut/story-timeline/backend/internal/github"
	"github.com/dieWehmut/story-timeline/backend/internal/google"
	"github.com/dieWehmut/story-timeline/backend/internal/router"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/getsentry/sentry-go"
	"go.uber.org/zap"
)

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer func() {
		_ = logger.Sync()
	}()
	zap.ReplaceGlobals(logger)

	env := config.LoadEnv()
	ctx := context.Background()

	if env.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn: env.SentryDSN,
		}); err != nil {
			zap.L().Warn("failed to initialize sentry", zap.Error(err))
		} else {
			defer sentry.Flush(2 * time.Second)
		}
	}

	if env.AutoApplySchema {
		if err := storage.ApplySchemaFile(ctx, env.SupabaseDBURL, "supabase/schema.sql"); err != nil {
			zap.L().Fatal("failed to apply Supabase schema", zap.Error(err))
		}
	}

	var redisStore *storage.Store
	if redisClient, err := storage.NewClient(env.RedisURL); err != nil {
		if !errors.Is(err, storage.ErrRedisNotConfigured) {
			zap.L().Warn("failed to initialize redis", zap.Error(err))
		}
	} else {
		redisStore = storage.NewStore(redisClient)
	}

	githubOAuthClient := github.NewOAuthClient(env.GitHubClientID, env.GitHubClientSecret, env.GitHubCallbackURL)
	googleOAuthClient := google.NewOAuthClient(env.GoogleClientID, env.GoogleClientSecret, env.GoogleCallbackURL)
	graphqlClient := github.NewGraphQLClient()

	authService := service.NewAuthService(githubOAuthClient, googleOAuthClient, graphqlClient, env.SessionSecret, env.SecureCookies, env.GitHubRepoOwner, redisStore)
	supabaseStorage := storage.NewSupabaseStorage(env.SupabaseURL, env.SupabaseServiceKey)

	loginLimiter := service.NewLoginLimiter(redisStore, 0)
	emailService := service.NewEmailAuthService(supabaseStorage, env.ResendAPIKey, env.ResendEmailFrom, redisStore)
	cloudinaryStorage, err := storage.NewCloudinaryStorage(storage.CloudinaryConfig{
		CloudName: env.CloudinaryCloudName,
		APIKey:    env.CloudinaryAPIKey,
		APISecret: env.CloudinaryAPISecret,
	})
	if err != nil {
		zap.L().Fatal("failed to initialize Cloudinary storage", zap.Error(err))
	}

	userService := service.NewUserService(graphqlClient, supabaseStorage, env.GitHubRepoOwner)

	imageService, err := service.NewImageService(ctx, supabaseStorage, cloudinaryStorage, env.GitHubRepoOwner)
	if err != nil {
		zap.L().Fatal("failed to initialize image service", zap.Error(err))
	}

	interactionService := service.NewInteractionService(supabaseStorage, cloudinaryStorage)

	server := &http.Server{
		Addr: ":" + env.Port,
		Handler: router.New(router.Dependencies{
			AuthController:         controller.NewAuthController(authService, userService, emailService, loginLimiter, redisStore, env.FrontendBaseURL, env.AppURLScheme),
			FollowController:       controller.NewFollowController(userService),
			ImageController:        controller.NewImageController(imageService, userService, authService, interactionService, cloudinaryStorage),
			HealthController:       controller.NewHealthController(env.GitHubRepoOwner, authService, userService),
			UploadController:       controller.NewUploadController(cloudinaryStorage),
			NotificationController: controller.NewNotificationController(supabaseStorage),
			AuthService:            authService,
		}, config.AllowedOrigins(env)),
		ReadHeaderTimeout: 5 * time.Second,
		// Support large uploads (videos <= 200MB).
		ReadTimeout:  10 * time.Minute,
		WriteTimeout: 10 * time.Minute,
		IdleTimeout:  2 * time.Minute,
	}

	zap.L().Info("story-timeline backend listening", zap.String("addr", server.Addr))
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		zap.L().Fatal("server failed", zap.Error(err))
	}
}
