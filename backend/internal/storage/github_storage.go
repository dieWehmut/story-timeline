package storage

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"strings"
)

type GitHubStorage struct {
	owner        string
	repo         string
	branch       string
	defaultToken string
	httpClient   *http.Client
}

type contentResponse struct {
	Content      string `json:"content"`
	Encoding     string `json:"encoding"`
	SHA          string `json:"sha"`
	DownloadURL  string `json:"download_url"`
	ContentType  string `json:"type"`
	Message      string `json:"message"`
}

func NewGitHubStorage(owner string, repo string, branch string, defaultToken string) *GitHubStorage {
	return &GitHubStorage{
		owner:        owner,
		repo:         repo,
		branch:       branch,
		defaultToken: defaultToken,
		httpClient:   &http.Client{},
	}
}

func (storage *GitHubStorage) Configured() bool {
	return storage.owner != "" && storage.repo != ""
}

func (storage *GitHubStorage) GetFile(ctx context.Context, token string, filePath string) ([]byte, string, string, error) {
	if !storage.Configured() {
		return nil, "", "", osErrNotFound(filePath)
	}

	endpoint := storage.contentsURL(filePath)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "", "", err
	}

	storage.applyHeaders(req, token)
	req.URL.RawQuery = fmt.Sprintf("ref=%s", storage.branch)

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return nil, "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, "", "", osErrNotFound(filePath)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(resp.Body)
		return nil, "", "", fmt.Errorf("github get %s failed: %s", filePath, strings.TrimSpace(string(payload)))
	}

	var payload contentResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, "", "", err
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(payload.Content, "\n", ""))
	if err != nil {
		return nil, "", "", err
	}

	contentType := mime.TypeByExtension(path.Ext(filePath))
	if contentType == "" {
		contentType = http.DetectContentType(decoded)
	}

	return decoded, payload.SHA, nilIfEmpty(contentType), nil
}

func (storage *GitHubStorage) PutFile(ctx context.Context, token string, filePath string, content []byte, message string) error {
	if !storage.Configured() {
		return fmt.Errorf("github storage is not configured")
	}

	sha, err := storage.lookupSHA(ctx, token, filePath)
	if err != nil && !isNotFound(err) {
		return err
	}

	payload := map[string]string{
		"message": message,
		"content": base64.StdEncoding.EncodeToString(content),
		"branch":  storage.branch,
	}
	if sha != "" {
		payload["sha"] = sha
	}

	return storage.sendJSON(ctx, token, http.MethodPut, storage.contentsURL(filePath), payload)
}

func (storage *GitHubStorage) DeleteFile(ctx context.Context, token string, filePath string, message string) error {
	if !storage.Configured() {
		return nil
	}

	sha, err := storage.lookupSHA(ctx, token, filePath)
	if err != nil {
		if isNotFound(err) {
			return nil
		}
		return err
	}

	payload := map[string]string{
		"message": message,
		"sha":     sha,
		"branch":  storage.branch,
	}

	return storage.sendJSON(ctx, token, http.MethodDelete, storage.contentsURL(filePath), payload)
}

func (storage *GitHubStorage) contentsURL(filePath string) string {
	trimmed := strings.TrimPrefix(filePath, "/")
	return fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", storage.owner, storage.repo, trimmed)
}

func (storage *GitHubStorage) lookupSHA(ctx context.Context, token string, filePath string) (string, error) {
	_, sha, _, err := storage.GetFile(ctx, token, filePath)
	if err != nil {
		return "", err
	}

	return sha, nil
}

func (storage *GitHubStorage) applyHeaders(req *http.Request, token string) {
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if resolvedToken := storage.resolveToken(token); resolvedToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", resolvedToken))
	}
}

func (storage *GitHubStorage) resolveToken(token string) string {
	if token != "" {
		return token
	}

	return storage.defaultToken
}

func (storage *GitHubStorage) sendJSON(ctx context.Context, token string, method string, url string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	storage.applyHeaders(req, token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		payloadBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github mutation failed: %s", strings.TrimSpace(string(payloadBytes)))
	}

	return nil
}

type notFoundError struct {
	path string
}

func osErrNotFound(filePath string) error {
	return notFoundError{path: filePath}
}

func (err notFoundError) Error() string {
	return fmt.Sprintf("%s not found", err.path)
}

func isNotFound(err error) bool {
	_, ok := err.(notFoundError)
	return ok
}

func nilIfEmpty(value string) string {
	if value == "" {
		return "application/octet-stream"
	}

	return value
}