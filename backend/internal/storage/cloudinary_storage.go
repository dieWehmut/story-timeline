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
	"net/textproto"
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

// SignedUpload contains the parameters needed for direct browser uploads.
type SignedUpload struct {
	PublicID    string `json:"publicId"`
	UploadURL   string `json:"uploadUrl"`
	APIKey      string `json:"apiKey"`
	Timestamp   string `json:"timestamp"`
	Signature   string `json:"signature"`
	ResourceType string `json:"resourceType"`
	Invalidate  string `json:"invalidate"`
	Overwrite   string `json:"overwrite"`
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
		// Video uploads can be large (<= 200MB). Keep this high to avoid client timeouts.
		httpClient: &http.Client{Timeout: 15 * time.Minute},
	}, nil
}

func (storage *CloudinaryStorage) PutObject(ctx context.Context, publicID string, content []byte, contentType string) error {
	return storage.PutObjectReader(ctx, publicID, bytes.NewReader(content), contentType)
}

func (storage *CloudinaryStorage) PutObjectReader(ctx context.Context, publicID string, reader io.Reader, contentType string) error {
	resourceType := storage.resourceTypeFor(publicID, contentType)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"invalidate": "true",
		"overwrite": "true",
		"public_id": strings.TrimSpace(publicID),
		"timestamp": timestamp,
	}

	pipeReader, pipeWriter := io.Pipe()
	writer := multipart.NewWriter(pipeWriter)
	writeErr := make(chan error, 1)
	go func() {
		defer close(writeErr)
		defer pipeWriter.Close()

		for _, key := range []string{"api_key", "invalidate", "overwrite", "public_id", "signature", "timestamp"} {
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
				_ = pipeWriter.CloseWithError(err)
				writeErr <- err
				return
			}
		}

		partHeader := make(textproto.MIMEHeader)
		partHeader.Set("Content-Disposition", `form-data; name="file"; filename="upload"`)
		if strings.TrimSpace(contentType) != "" {
			partHeader.Set("Content-Type", strings.TrimSpace(contentType))
		}

		fileWriter, err := writer.CreatePart(partHeader)
		if err != nil {
			_ = pipeWriter.CloseWithError(err)
			writeErr <- err
			return
		}

		if _, err := io.Copy(fileWriter, reader); err != nil {
			_ = pipeWriter.CloseWithError(err)
			writeErr <- err
			return
		}

		if err := writer.Close(); err != nil {
			_ = pipeWriter.CloseWithError(err)
			writeErr <- err
			return
		}

		writeErr <- nil
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, storage.uploadEndpoint(resourceType), pipeReader)
	if err != nil {
		_ = pipeWriter.CloseWithError(err)
		<-writeErr
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		_ = pipeWriter.CloseWithError(err)
		<-writeErr
		return err
	}
	defer resp.Body.Close()

	if err := <-writeErr; err != nil {
		return err
	}

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
	resourceType := storage.resourceTypeFor(publicID, "")
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

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, storage.destroyEndpoint(resourceType), strings.NewReader(form.Encode()))
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
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	resourceType := storage.resourceTypeFor(trimmed, "")
	base := fmt.Sprintf("https://res.cloudinary.com/%s/%s/upload/%s", storage.cloudName, resourceType, escapeCloudinaryPath(trimmed))
	if resourceType == "video" {
		base += ".mp4"
	}
	return base
}

// SignUpload returns the signed parameters for a direct upload.
func (storage *CloudinaryStorage) SignUpload(publicID string, resourceType string) SignedUpload {
	resolved := strings.TrimSpace(resourceType)
	if resolved != "video" {
		resolved = "image"
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"invalidate": "true",
		"overwrite":  "true",
		"public_id":  strings.TrimSpace(publicID),
		"timestamp":  timestamp,
	}

	return SignedUpload{
		PublicID:     params["public_id"],
		UploadURL:    storage.uploadEndpoint(resolved),
		APIKey:       storage.apiKey,
		Timestamp:    timestamp,
		Signature:    signCloudinaryParams(params, storage.apiSecret),
		ResourceType: resolved,
		Invalidate:   params["invalidate"],
		Overwrite:    params["overwrite"],
	}
}

func (storage *CloudinaryStorage) uploadEndpoint(resourceType string) string {
	resolved := strings.TrimSpace(resourceType)
	if resolved != "video" {
		resolved = "image"
	}
	return fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/upload", storage.cloudName, resolved)
}

func (storage *CloudinaryStorage) destroyEndpoint(resourceType string) string {
	resolved := strings.TrimSpace(resourceType)
	if resolved != "video" {
		resolved = "image"
	}
	return fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/destroy", storage.cloudName, resolved)
}

func (storage *CloudinaryStorage) resourceTypeFor(publicID string, contentType string) string {
	lowerID := strings.ToLower(strings.Trim(strings.TrimSpace(publicID), "/"))
	if strings.HasPrefix(lowerID, "videos/") || strings.HasPrefix(lowerID, "comment-videos/") {
		return "video"
	}

	ct := strings.ToLower(strings.TrimSpace(contentType))
	if strings.HasPrefix(ct, "video/") {
		return "video"
	}

	return "image"
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
