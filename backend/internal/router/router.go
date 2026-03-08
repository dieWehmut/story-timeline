package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dieWehmut/inner/backend/internal/controller"
	"github.com/dieWehmut/inner/backend/internal/middleware"
	"github.com/dieWehmut/inner/backend/internal/service"
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

		api.Route("/images", func(images chi.Router) {
			images.Get("/", deps.ImageController.List)
			images.Get("/{imageID}/asset", deps.ImageController.Asset)
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