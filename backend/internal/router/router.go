package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"

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

func New(deps Dependencies, allowedOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recover)
	r.Use(middleware.Logger)
	r.Use(middleware.CORS(allowedOrigins))

	r.Route("/api", func(api chi.Router) {
		api.Route("/auth", func(auth chi.Router) {
			auth.Get("/github/login", deps.AuthController.Login)
			auth.Get("/github/callback", deps.AuthController.Callback)
			auth.Get("/session", deps.AuthController.Session)
			auth.Post("/logout", deps.AuthController.Logout)
		})

		// Feed endpoints (public read, aggregated from multiple users)
		api.Get("/feed", deps.ImageController.Feed)
		api.Get("/feed/users", deps.ImageController.FeedUsers)

		api.Route("/images", func(images chi.Router) {
			// Asset serving: /api/images/{ownerLogin}/{imageID}/asset/{assetIndex}
			images.Get("/{ownerLogin}/{imageID}/asset/{assetIndex}", deps.ImageController.Asset)

			// Interactions (public read, auth write)
			images.Get("/{ownerLogin}/{postID}/comments", deps.ImageController.GetComments)
			images.With(middleware.RequireAuth(deps.AuthService)).Post("/{ownerLogin}/{postID}/like", deps.ImageController.ToggleLike)
			images.With(middleware.RequireAuth(deps.AuthService)).Post("/{ownerLogin}/{postID}/comments", deps.ImageController.AddComment)

			// Write operations require authentication (any logged-in user)
			images.With(middleware.RequireAuth(deps.AuthService)).Post("/", deps.ImageController.Create)
			images.With(middleware.RequireAuth(deps.AuthService)).Patch("/{imageID}", deps.ImageController.Update)
			images.With(middleware.RequireAuth(deps.AuthService)).Delete("/{imageID}", deps.ImageController.Delete)
		})

		api.Get("/health/stats", deps.HealthController.Stats)
		api.Post("/health/ping", deps.HealthController.Ping)
	})

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	return r
}