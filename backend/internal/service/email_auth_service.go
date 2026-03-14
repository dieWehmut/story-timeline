package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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

	if err := service.cacheMagicLink(ctx, token, record); err != nil {
		return err
	}

	link := appendToken(callbackURL, token)
	subject := "欢迎使用物语集"
	displayFrom := service.from
	if !strings.Contains(displayFrom, "<") && strings.Contains(displayFrom, "@") {
		displayFrom = fmt.Sprintf("hc <%s>", displayFrom)
	}
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0b0b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif;color:#f5f5f5;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="background:#0b0b0f;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width:520px;background:#14141b;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#ffb3d1,#ff8ec5);color:#2a0e1a;text-align:center;font-size:20px;font-weight:700;letter-spacing:1px;">
                Welcome to Story-Timeline
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 10px;font-size:16px;line-height:1.6;">
                ??? %s?
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 18px;font-size:15px;line-height:1.7;color:#e8e8ef;">
                ???????????????????? / App ?????
                <span style="display:block;margin-top:10px;color:#b7b7c8;font-size:13px;">??? %d ??????????????</span>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 28px 24px;">
                <a href="%s" style="display:inline-block;padding:12px 28px;background:#ff7bbd;border-radius:999px;color:#2a0e1a;text-decoration:none;font-weight:700;font-size:15px;">
                  ????
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 26px;font-size:13px;line-height:1.7;color:#9a9ab0;">
                ???????????????????
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px;border-top:1px solid #22222a;font-size:12px;color:#7c7c90;text-align:center;">
                <br />
                ????????????????
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, login, int(service.tokenTTL.Minutes()), link)


_, err = service.client.Emails.Send(&resend.SendEmailRequest{
		From:    displayFrom,
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

	if session, ok, err := service.completeLoginFromCache(ctx, token); err != nil {
		return model.Session{}, err
	} else if ok {
		return session, nil
	}

	return service.completeLoginFromStorage(ctx, token)
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


