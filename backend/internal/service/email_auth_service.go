package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/resend/resend-go/v3"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

const defaultEmailTokenTTL = 15 * time.Minute

type EmailAuthService struct {
	storage  *storage.SupabaseStorage
	client   *resend.Client
	from     string
	tokenTTL time.Duration
}

func NewEmailAuthService(storage *storage.SupabaseStorage, apiKey string, from string) *EmailAuthService {
	trimmedFrom := strings.TrimSpace(from)
	trimmedKey := strings.TrimSpace(apiKey)
	if storage == nil {
		return &EmailAuthService{storage: storage}
	}
	if trimmedKey == "" || trimmedFrom == "" {
		return &EmailAuthService{storage: storage, from: trimmedFrom}
	}
	return &EmailAuthService{
		storage:  storage,
		client:   resend.NewClient(trimmedKey),
		from:     trimmedFrom,
		tokenTTL: defaultEmailTokenTTL,
	}
}

func (service *EmailAuthService) Enabled() bool {
	return service != nil && service.storage != nil && service.client != nil && service.from != ""
}

func (service *EmailAuthService) RequestMagicLink(ctx context.Context, email string, callbackURL string) error {
	if !service.Enabled() {
		return errors.New("email login not configured")
	}
	if strings.TrimSpace(callbackURL) == "" {
		return errors.New("missing callback url")
	}

	normalized, err := normalizeEmail(email)
	if err != nil {
		return err
	}

	token, tokenHash, err := newEmailToken()
	if err != nil {
		return err
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
		return err
	}

	link := appendToken(callbackURL, token)
	subject := "登录 Story Timeline"
	html := fmt.Sprintf(`<p>点击登录链接：</p><p><a href="%s">%s</a></p><p>此链接 %d 分钟内有效，如非本人操作请忽略。</p>`, link, link, int(service.tokenTTL.Minutes()))

	_, err = service.client.Emails.Send(&resend.SendEmailRequest{
		From:    service.from,
		To:      []string{normalized},
		Subject: subject,
		Html:    html,
	})
	if err != nil {
		return err
	}

	return nil
}

func (service *EmailAuthService) CompleteLogin(ctx context.Context, token string) (model.Session, error) {
	if !service.Enabled() {
		return model.Session{}, errors.New("email login not configured")
	}
	if strings.TrimSpace(token) == "" {
		return model.Session{}, errors.New("missing token")
	}

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
