package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultHFSpaceBaseURL = "https://REDACTED.hf.space"

type errorResponse struct {
	Error string `json:"error"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
		return
	}

	hfToken := strings.TrimSpace(os.Getenv("HF_TOKEN"))
	if hfToken == "" {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "HF_TOKEN is not configured"})
		return
	}

	targetURL := strings.TrimRight(firstNonEmpty(
		os.Getenv("HF_SPACE_BASE_URL"),
		os.Getenv("HUGGINGFACE_SPACE_URL"),
		os.Getenv("VITE_API_BASE"),
		defaultHFSpaceBaseURL,
	), "/") + "/ping"

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, r.Method, targetURL, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to create upstream request"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+hfToken)
	req.Header.Set("Accept", "application/json, text/plain;q=0.9, */*;q=0.8")
	req.Header.Set("User-Agent", "story-timeline-vercel-ping/1.0")

	response, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorResponse{Error: "failed to reach private Hugging Face Space"})
		return
	}
	defer response.Body.Close()

	copyHeader(w.Header(), response.Header, "Content-Type")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(response.StatusCode)

	if r.Method == http.MethodHead {
		return
	}

	_, _ = io.Copy(w, response.Body)
}

func copyHeader(dst http.Header, src http.Header, key string) {
	if value := src.Get(key); value != "" {
		dst.Set(key, value)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}

	return ""
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}
