package router

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/controller"
	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type Dependencies struct {
	AuthController   *controller.AuthController
	ImageController  *controller.ImageController
	HealthController *controller.HealthController
	AuthService      *service.AuthService
}

func New(deps Dependencies, allowedOrigins []string) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Recover())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS(allowedOrigins))

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.GET("/github/login", deps.AuthController.Login)
			auth.GET("/github/callback", deps.AuthController.Callback)
			auth.GET("/session", deps.AuthController.Session)
			auth.POST("/logout", deps.AuthController.Logout)
		}

		// Feed endpoints (public read, aggregated from multiple users)
		api.GET("/feed", deps.ImageController.Feed)
		api.GET("/feed/users", deps.ImageController.FeedUsers)

		images := api.Group("/images")
		{
			// Asset serving: /api/images/{ownerLogin}/{imageID}/asset/{assetIndex}
			images.GET("/:ownerLogin/:imageID/asset/:assetIndex", deps.ImageController.Asset)

			// Interactions (public read, auth write)
			images.GET("/:ownerLogin/:imageID/comments", deps.ImageController.GetComments)
			images.POST("/:ownerLogin/:imageID/like", middleware.RequireAuth(deps.AuthService), deps.ImageController.ToggleLike)
			images.POST("/:ownerLogin/:imageID/comments", middleware.RequireAuth(deps.AuthService), deps.ImageController.AddComment)

			// Write operations require authentication (any logged-in user)
			images.POST("/", middleware.RequireAuth(deps.AuthService), deps.ImageController.Create)
			images.PATCH("/:imageID", middleware.RequireAuth(deps.AuthService), deps.ImageController.Update)
			images.DELETE("/:imageID", middleware.RequireAuth(deps.AuthService), deps.ImageController.Delete)
		}

		comments := api.Group("/comments")
		{
			comments.GET("/:commenterLogin/:postOwner/:postID/:commentID/asset", deps.ImageController.CommentAsset)
		}

		api.GET("/health/stats", deps.HealthController.Stats)
		api.POST("/health/ping", deps.HealthController.Ping)
	}

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	return r
}