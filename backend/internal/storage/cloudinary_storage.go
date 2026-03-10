package storage

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type CloudinaryConfig struct {
	CloudName string
	APIKey    string
	APISecret string
}

type CloudinaryStorage struct {
	cloudName  string
	apiKey     string
	apiSecret  string
	httpClient *http.Client
}

type cloudinaryUploadResponse struct {
	PublicID  string `json:"public_id"`
	SecureURL string `json:"secure_url"`
	Error     *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type cloudinaryDestroyResponse struct {
	Result string `json:"result"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func NewCloudinaryStorage(cfg CloudinaryConfig) (*CloudinaryStorage, error) {
	if strings.TrimSpace(cfg.CloudName) == "" {
		return nil, fmt.Errorf("CLOUDINARY_CLOUD_NAME is required")
	}
	if strings.TrimSpace(cfg.APIKey) == "" || strings.TrimSpace(cfg.APISecret) == "" {
		return nil, fmt.Errorf("Cloudinary API credentials are required")
	}

	return &CloudinaryStorage{
		cloudName:  strings.TrimSpace(cfg.CloudName),
		apiKey:     strings.TrimSpace(cfg.APIKey),
		apiSecret:  strings.TrimSpace(cfg.APISecret),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (storage *CloudinaryStorage) PutObject(ctx context.Context, publicID string, content []byte, contentType string) error {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"overwrite": "true",
		"public_id": strings.TrimSpace(publicID),
		"timestamp": timestamp,
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, key := range []string{"api_key", "overwrite", "public_id", "signature", "timestamp"} {
		value := ""
		switch key {
		case "api_key":
			value = storage.apiKey
		case "signature":
			value = signCloudinaryParams(params, storage.apiSecret)
		default:
			value = params[key]
		}
		if err := writer.WriteField(key, value); err != nil {
			return err
		}
	}

	fileWriter, err := writer.CreateFormFile("file", "upload")
	if err != nil {
		return err
	}
	if _, err := fileWriter.Write(content); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, storage.uploadEndpoint(), &body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if strings.TrimSpace(contentType) != "" {
		req.Header.Set("X-Content-Type", contentType)
	}

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var payload cloudinaryUploadResponse
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return fmt.Errorf("cloudinary upload failed: %s", strings.TrimSpace(string(responseBody)))
	}
	if resp.StatusCode >= http.StatusBadRequest {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return fmt.Errorf("cloudinary upload failed: %s", payload.Error.Message)
		}
		return fmt.Errorf("cloudinary upload failed: %s", strings.TrimSpace(string(responseBody)))
	}

	return nil
}

func (storage *CloudinaryStorage) GetObject(ctx context.Context, publicID string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, storage.URLFor(publicID), nil)
	if err != nil {
		return nil, "", err
	}

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("cloudinary get %s failed: %s", publicID, strings.TrimSpace(string(payload)))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = http.DetectContentType(body)
	}

	return body, contentType, nil
}

func (storage *CloudinaryStorage) DeleteObject(ctx context.Context, publicID string) error {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"invalidate": "true",
		"public_id":  strings.TrimSpace(publicID),
		"timestamp":  timestamp,
	}

	form := url.Values{}
	form.Set("api_key", storage.apiKey)
	form.Set("invalidate", params["invalidate"])
	form.Set("public_id", params["public_id"])
	form.Set("signature", signCloudinaryParams(params, storage.apiSecret))
	form.Set("timestamp", timestamp)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, storage.destroyEndpoint(), strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var payload cloudinaryDestroyResponse
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return fmt.Errorf("cloudinary delete failed: %s", strings.TrimSpace(string(responseBody)))
	}
	if resp.StatusCode >= http.StatusBadRequest {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return fmt.Errorf("cloudinary delete failed: %s", payload.Error.Message)
		}
		return fmt.Errorf("cloudinary delete failed: %s", strings.TrimSpace(string(responseBody)))
	}
	if payload.Result != "ok" && payload.Result != "not found" {
		return fmt.Errorf("cloudinary delete failed: %s", payload.Result)
	}

	return nil
}

func (storage *CloudinaryStorage) URLFor(publicID string) string {
	trimmed := strings.Trim(strings.TrimSpace(publicID), "/")
	if trimmed == "" {
		return ""
	}
	return fmt.Sprintf("https://res.cloudinary.com/%s/image/upload/%s", storage.cloudName, escapeCloudinaryPath(trimmed))
}

func (storage *CloudinaryStorage) uploadEndpoint() string {
	return fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", storage.cloudName)
}

func (storage *CloudinaryStorage) destroyEndpoint() string {
	return fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/destroy", storage.cloudName)
}

func signCloudinaryParams(params map[string]string, apiSecret string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, params[key]))
	}

	sum := sha1.Sum([]byte(strings.Join(parts, "&") + apiSecret))
	return hex.EncodeToString(sum[:])
}

func escapeCloudinaryPath(value string) string {
	parts := strings.Split(value, "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
