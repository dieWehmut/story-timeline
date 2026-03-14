package router

import (
	"net/http"
	"time"

	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/controller"
	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type Dependencies struct {
	AuthController   *controller.AuthController
	FollowController *controller.FollowController
	ImageController  *controller.ImageController
	HealthController *controller.HealthController
	UploadController *controller.UploadController
	AuthService      *service.AuthService
}

func New(deps Dependencies, allowedOrigins []string) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(sentrygin.New(sentrygin.Options{
		Repanic: true,
	}))
	r.Use(middleware.Recover())
	r.Use(middleware.Logger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	statusJSON := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}

	rootJSON := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "story-timeline backend",
			"status":  "ok",
		})
	}

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.GET("/github/login", deps.AuthController.GitHubLogin)
			auth.GET("/github/callback", deps.AuthController.GitHubCallback)
			auth.GET("/google/login", deps.AuthController.GoogleLogin)
			auth.GET("/google/callback", deps.AuthController.GoogleCallback)
			auth.POST("/email/login", deps.AuthController.EmailLogin)
			auth.GET("/email/callback", deps.AuthController.EmailCallback)
			auth.POST("/email/exchange", deps.AuthController.EmailExchange)
			auth.POST("/email/verify", deps.AuthController.EmailVerify)
			auth.POST("/email/confirm", deps.AuthController.EmailConfirm)
			auth.POST("/email/poll", deps.AuthController.EmailPoll)
			auth.POST("/exchange", deps.AuthController.ExchangeSession)
			auth.GET("/session", deps.AuthController.Session)
			auth.PATCH("/profile", deps.AuthController.UpdateProfile)
			auth.POST("/logout", deps.AuthController.Logout)
		}

		// Feed endpoints (public read, aggregated from multiple users)
		api.GET("/feed", deps.ImageController.Feed)
		api.GET("/feed/users", deps.ImageController.FeedUsers)

		// Follow relationships (auth required)
		api.GET("/following", middleware.RequireAuth(deps.AuthService), deps.FollowController.Following)
		api.GET("/followers", middleware.RequireAuth(deps.AuthService), deps.FollowController.Followers)
		api.POST("/follow/:login", middleware.RequireAuth(deps.AuthService), deps.FollowController.Follow)
		api.DELETE("/follow/:login", middleware.RequireAuth(deps.AuthService), deps.FollowController.Unfollow)

		uploads := api.Group("/uploads", middleware.RequireAuth(deps.AuthService))
		{
			uploads.POST("/images", deps.UploadController.SignImageUploads)
			uploads.POST("/comments", deps.UploadController.SignCommentUploads)
		}

		images := api.Group("/images")
		{
			// Asset serving: /api/images/{ownerLogin}/{imageID}/asset/{assetIndex}
			images.GET("/:ownerLogin/:imageID/asset/:assetIndex", deps.ImageController.Asset)

			// Interactions (public read, auth write)
			images.GET("/:ownerLogin/:imageID/comments", deps.ImageController.GetComments)
			images.POST("/:ownerLogin/:imageID/like", middleware.RequireAuth(deps.AuthService), deps.ImageController.ToggleLike)
			images.POST("/:ownerLogin/:imageID/comments", middleware.RequireAuth(deps.AuthService), deps.ImageController.AddComment)
			images.POST("/:ownerLogin/:imageID/comments/:commentID/like", middleware.RequireAuth(deps.AuthService), deps.ImageController.ToggleCommentLike)
			images.DELETE("/:ownerLogin/:imageID/comments/:commentID", middleware.RequireAuth(deps.AuthService), deps.ImageController.DeleteComment)

			// Create — register both "" and "/" so POST /api/images and POST /api/images/ both
			// hit the same handler; avoids redirect loop when proxy forwards to /api/images/.
			images.POST("", middleware.RequireAuth(deps.AuthService), deps.ImageController.Create)
			images.POST("/", middleware.RequireAuth(deps.AuthService), deps.ImageController.Create)
		}

		// Update/delete use a separate prefix to avoid wildcard conflict with /:ownerLogin routes
		my := api.Group("/my/images", middleware.RequireAuth(deps.AuthService))
		{
			my.PATCH("/:imageID", deps.ImageController.Update)
			my.DELETE("/:imageID", deps.ImageController.Delete)
		}

		comments := api.Group("/comments")
		{
			comments.GET("/:commenterLogin/:postOwner/:postID/:commentID/asset/:assetIndex", deps.ImageController.CommentAsset)
			comments.GET("/:commenterLogin/:postOwner/:postID/:commentID/asset", deps.ImageController.CommentAsset)
		}

		api.GET("/health/stats", deps.HealthController.Stats)
		api.POST("/health/ping", deps.HealthController.Ping)
	}

	r.GET("/", rootJSON)
	r.HEAD("/", rootJSON)

	r.GET("/ping", statusJSON)
	r.HEAD("/ping", statusJSON)

	r.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	return r
}
