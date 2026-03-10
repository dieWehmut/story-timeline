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

var hopByHopHeaders = map[string]struct{}{
	"Connection":          {},
	"Keep-Alive":          {},
	"Proxy-Authenticate":  {},
	"Proxy-Authorization": {},
	"Te":                  {},
	"Trailer":             {},
	"Transfer-Encoding":   {},
	"Upgrade":             {},
}

type proxyOptions struct {
	AllowedMethods map[string]struct{}
	TargetPath     string
	UserAgent      string
	Timeout        time.Duration
}

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

func proxyToHF(w http.ResponseWriter, r *http.Request, options proxyOptions) {
	if len(options.AllowedMethods) > 0 {
		if _, ok := options.AllowedMethods[r.Method]; !ok {
			w.Header().Set("Allow", joinAllowedMethods(options.AllowedMethods))
			writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
			return
		}
	}

	hfToken := strings.TrimSpace(os.Getenv("HF_TOKEN"))
	if hfToken == "" {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "HF_TOKEN is not configured"})
		return
	}

	targetBaseURL := strings.TrimRight(firstNonEmpty(
		os.Getenv("HF_SPACE_BASE_URL"),
		os.Getenv("HUGGINGFACE_SPACE_URL"),
		defaultHFSpaceBaseURL,
	), "/")
	targetPath := options.TargetPath
	if targetPath == "" {
		targetPath = "/"
	}

	targetURL := targetBaseURL + targetPath
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	timeout := options.Timeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}

	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, r.Method, targetURL, r.Body)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "failed to create upstream request"})
		return
	}

	copyRequestHeaders(req.Header, r.Header)
	req.Header.Set("Authorization", "Bearer "+hfToken)
	if options.UserAgent != "" {
		req.Header.Set("User-Agent", options.UserAgent)
	}

	client := &http.Client{
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	response, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorResponse{Error: "failed to reach private Hugging Face Space"})
		return
	}
	defer response.Body.Close()

	copyResponseHeaders(w.Header(), response.Header, targetBaseURL, publicBaseURL(r))
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(response.StatusCode)

	if r.Method == http.MethodHead {
		return
	}

	_, _ = io.Copy(w, response.Body)
}

func copyRequestHeaders(dst http.Header, src http.Header) {
	for key, values := range src {
		if shouldSkipHeader(key) || strings.EqualFold(key, "Authorization") {
			continue
		}

		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func copyResponseHeaders(dst http.Header, src http.Header, targetBaseURL string, publicBaseURL string) {
	for key, values := range src {
		if shouldSkipHeader(key) {
			continue
		}

		for _, value := range values {
			if strings.EqualFold(key, "Location") {
				value = rewriteLocation(value, targetBaseURL, publicBaseURL)
			}
			dst.Add(key, value)
		}
	}
}

func shouldSkipHeader(key string) bool {
	_, exists := hopByHopHeaders[http.CanonicalHeaderKey(key)]
	return exists
}

func rewriteLocation(location string, targetBaseURL string, publicBaseURL string) string {
	if location == "" || publicBaseURL == "" {
		return location
	}

	if strings.HasPrefix(location, targetBaseURL) {
		return publicBaseURL + strings.TrimPrefix(location, targetBaseURL)
	}

	return location
}

func publicBaseURL(r *http.Request) string {
	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	if host == "" {
		return ""
	}

	scheme := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
	if scheme == "" {
		scheme = "https"
	}

	return scheme + "://" + host
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

func joinAllowedMethods(methods map[string]struct{}) string {
	ordered := []string{http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions}
	allowed := make([]string, 0, len(methods))
	for _, method := range ordered {
		if _, ok := methods[method]; ok {
			allowed = append(allowed, method)
		}
	}

	for method := range methods {
		found := false
		for _, value := range allowed {
			if value == method {
				found = true
				break
			}
		}
		if !found {
			allowed = append(allowed, method)
		}
	}

	return strings.Join(allowed, ", ")
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}
