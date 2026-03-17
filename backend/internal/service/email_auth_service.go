package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/resend/resend-go/v3"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

//go:embed templates/magic_link_email.html
var magicLinkFS embed.FS

var magicLinkTmpl = template.Must(template.ParseFS(magicLinkFS, "templates/magic_link_email.html"))

const defaultEmailTokenTTL = storage.MagicLinkTokenTTL

type EmailAuthService struct {
	storage  *storage.SupabaseStorage
	client   *resend.Client
	from     string
	tokenTTL time.Duration
	redis    *storage.Store
}

func NewEmailAuthService(storage *storage.SupabaseStorage, apiKey string, from string, redisStore *storage.Store) *EmailAuthService {
	trimmedFrom := strings.TrimSpace(from)
	trimmedKey := strings.TrimSpace(apiKey)
	if storage == nil {
		return &EmailAuthService{storage: storage, redis: redisStore}
	}
	if trimmedKey == "" || trimmedFrom == "" {
		return &EmailAuthService{storage: storage, from: trimmedFrom, redis: redisStore}
	}
	return &EmailAuthService{
		storage:  storage,
		client:   resend.NewClient(trimmedKey),
		from:     trimmedFrom,
		tokenTTL: defaultEmailTokenTTL,
		redis:    redisStore,
	}
}

func (service *EmailAuthService) Enabled() bool {
	return service != nil && service.storage != nil && service.client != nil && service.from != ""
}

func (service *EmailAuthService) RequestMagicLink(ctx context.Context, email string, callbackURL string) (string, error) {
	if !service.Enabled() {
		return "", errors.New("email login not configured")
	}
	if strings.TrimSpace(callbackURL) == "" {
		return "", errors.New("missing callback url")
	}

	normalized, err := normalizeEmail(email)
	if err != nil {
		return "", err
	}

	token, tokenHash, err := newEmailToken()
	if err != nil {
		return "", err
	}

	login := loginFromEmail(normalized)
	avatarURL := avatarFromLogin(login)
	now := time.Now()
	record := model.EmailLogin{
		TokenHash: tokenHash,
		Email:     normalized,
		Login:     login,
		AvatarURL: avatarURL,
		CreatedAt: now,
		ExpiresAt: now.Add(service.tokenTTL),
	}

	if err := service.storage.CreateEmailLogin(ctx, record); err != nil {
		return "", err
	}

	if err := service.cacheMagicLink(ctx, token, record); err != nil {
		return "", err
	}

	link := appendToken(callbackURL, token)
	subject := "欢迎使用物語集喵"
	displayFrom := service.from
	if !strings.Contains(displayFrom, "<") && strings.Contains(displayFrom, "@") {
		displayFrom = fmt.Sprintf("hc <%s>", displayFrom)
	}
	var htmlBuf bytes.Buffer
	if err := magicLinkTmpl.Execute(&htmlBuf, struct {
		Login   string
		Minutes int
		Link    string
	}{
		Login:   login,
		Minutes: int(service.tokenTTL.Minutes()),
		Link:    link,
	}); err != nil {
		return "", fmt.Errorf("render email template: %w", err)
	}
	html := htmlBuf.String()

_, err = service.client.Emails.Send(&resend.SendEmailRequest{
		From:    displayFrom,
		To:      []string{normalized},
		Subject: subject,
		Html:    html,
	})
	if err != nil {
		return "", err
	}

	return tokenHash, nil
}

func (service *EmailAuthService) CompleteLogin(ctx context.Context, token string) (model.Session, error) {
	if !service.Enabled() {
		return model.Session{}, errors.New("email login not configured")
	}
	if strings.TrimSpace(token) == "" {
		return model.Session{}, errors.New("missing token")
	}

	if session, ok, err := service.completeLoginFromCache(ctx, token); err != nil {
		return model.Session{}, err
	} else if ok {
		return session, nil
	}

	return service.completeLoginFromStorage(ctx, token)
}

func (service *EmailAuthService) ConfirmLogin(ctx context.Context, token string) (model.Session, string, error) {
	session, err := service.CompleteLogin(ctx, token)
	if err != nil {
		return model.Session{}, "", err
	}
	tokenHash := hashToken(token)
	return session, tokenHash, nil
}

func (service *EmailAuthService) VerifyToken(ctx context.Context, token string) error {
	if !service.Enabled() {
		return errors.New("email login not configured")
	}
	if strings.TrimSpace(token) == "" {
		return errors.New("missing token")
	}

	tokenHash := hashToken(token)
	record, err := service.storage.GetEmailLogin(ctx, tokenHash)
	if err != nil {
		return err
	}
	if record.ConsumedAt != nil {
		return errors.New("magic link already used")
	}
	if time.Now().After(record.ExpiresAt) {
		return errors.New("magic link expired")
	}
	return nil
}

func normalizeEmail(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", errors.New("email is required")
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", errors.New("invalid email address")
	}
	email := strings.ToLower(strings.TrimSpace(parsed.Address))
	if email == "" {
		return "", errors.New("invalid email address")
	}
	return email, nil
}

func newEmailToken() (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(raw)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

type cachedMagicLink struct {
	TokenHash string    `json:"token_hash"`
	Email     string    `json:"email"`
	Login     string    `json:"login"`
	AvatarURL string    `json:"avatar_url"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (service *EmailAuthService) cacheMagicLink(ctx context.Context, token string, record model.EmailLogin) error {
	if service.redis == nil || !service.redis.Enabled() {
		return nil
	}

	payload := cachedMagicLink{
		TokenHash: record.TokenHash,
		Email:     record.Email,
		Login:     record.Login,
		AvatarURL: record.AvatarURL,
		ExpiresAt: record.ExpiresAt,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return service.redis.SetMagicLinkToken(ctx, token, string(encoded))
}

func (service *EmailAuthService) completeLoginFromCache(ctx context.Context, token string) (model.Session, bool, error) {
	if service.redis == nil || !service.redis.Enabled() {
		return model.Session{}, false, nil
	}

	payload, err := service.redis.ConsumeMagicLinkToken(ctx, token)
	if err != nil {
		if storage.IsCacheMiss(err) {
			return model.Session{}, false, nil
		}
		return model.Session{}, false, err
	}

	var cached cachedMagicLink
	if err := json.Unmarshal([]byte(payload), &cached); err != nil {
		return model.Session{}, false, err
	}
	if cached.TokenHash == "" {
		cached.TokenHash = hashToken(token)
	}
	if cached.Email == "" || cached.Login == "" {
		return model.Session{}, false, nil
	}
	if !cached.ExpiresAt.IsZero() && time.Now().After(cached.ExpiresAt) {
		return model.Session{}, false, errors.New("magic link expired")
	}

	now := time.Now()
	if err := service.storage.ConsumeEmailLogin(ctx, cached.TokenHash, now); err != nil {
		return model.Session{}, false, err
	}

	user := model.AuthUser{
		Provider:  "email",
		ID:        cached.Email,
		Login:     cached.Login,
		AvatarURL: cached.AvatarURL,
	}

	return model.Session{
		AccessToken: "",
		User:        user,
		ExpiresAt:   now.Add(7 * 24 * time.Hour),
	}, true, nil
}

func (service *EmailAuthService) completeLoginFromStorage(ctx context.Context, token string) (model.Session, error) {
	tokenHash := hashToken(token)
	record, err := service.storage.GetEmailLogin(ctx, tokenHash)
	if err != nil {
		return model.Session{}, err
	}

	if record.ConsumedAt != nil {
		return model.Session{}, errors.New("magic link already used")
	}
	if time.Now().After(record.ExpiresAt) {
		return model.Session{}, errors.New("magic link expired")
	}

	now := time.Now()
	if err := service.storage.ConsumeEmailLogin(ctx, tokenHash, now); err != nil {
		return model.Session{}, err
	}

	user := model.AuthUser{
		Provider:  "email",
		ID:        record.Email,
		Login:     record.Login,
		AvatarURL: record.AvatarURL,
	}

	return model.Session{
		AccessToken: "",
		User:        user,
		ExpiresAt:   now.Add(7 * 24 * time.Hour),
	}, nil
}

var loginSanitizeRe = regexp.MustCompile(`[^a-z0-9_-]+`)

func loginFromEmail(email string) string {
	parts := strings.Split(email, "@")
	local := strings.ToLower(strings.TrimSpace(parts[0]))
	safe := loginSanitizeRe.ReplaceAllString(local, "")
	if safe == "" {
		safe = "user"
	}
	suffix := shortHash(email, 6)
	return fmt.Sprintf("%s-%s", safe, suffix)
}

func avatarFromLogin(login string) string {
	return fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=0D1117&color=ffffff&size=128", url.QueryEscape(login))
}

func shortHash(value string, length int) string {
	if length <= 0 {
		return ""
	}
	sum := sha256.Sum256([]byte(value))
	hexed := hex.EncodeToString(sum[:])
	if length > len(hexed) {
		return hexed
	}
	return hexed[:length]
}

func appendToken(baseURL string, token string) string {
	sep := "?"
	if strings.Contains(baseURL, "?") {
		sep = "&"
	}
	return baseURL + sep + "token=" + url.QueryEscape(token)
}

