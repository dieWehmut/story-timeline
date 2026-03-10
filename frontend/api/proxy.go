package handler

import (
	"net/http"
	"time"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	targetPath := r.URL.Query().Get("target")
	if targetPath == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "missing target path"})
		return
	}

	options := proxyOptions{
		AllowedMethods: map[string]struct{}{
			http.MethodGet:     {},
			http.MethodHead:    {},
			http.MethodPost:    {},
			http.MethodPut:     {},
			http.MethodPatch:   {},
			http.MethodDelete:  {},
			http.MethodOptions: {},
		},
		TargetPath: targetPath,
		UserAgent:  "story-timeline-vercel-proxy/1.0",
	}

	if targetPath == "/ping" {
		options.AllowedMethods = map[string]struct{}{
			http.MethodGet:  {},
			http.MethodHead: {},
		}
		options.UserAgent = "story-timeline-vercel-ping/1.0"
		options.Timeout = 15 * time.Second
	}

	proxyToHF(w, r, options)
}
