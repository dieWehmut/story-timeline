package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"strings"
	"time"

	"github.com/resend/resend-go/v3"

	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

//go:embed templates/admin_notify_email.html
var adminNotifyFS embed.FS

//go:embed templates/approval_email.html
var approvalFS embed.FS

//go:embed templates/rejection_email.html
var rejectionFS embed.FS

var (
	adminNotifyTmpl = template.Must(template.ParseFS(adminNotifyFS, "templates/admin_notify_email.html"))
	approvalTmpl    = template.Must(template.ParseFS(approvalFS, "templates/approval_email.html"))
	rejectionTmpl   = template.Must(template.ParseFS(rejectionFS, "templates/rejection_email.html"))
)

type RegistrationService struct {
	storage    *storage.SupabaseStorage
	redis      *storage.Store
	resend     *resend.Client
	from       string
	frontendURL string
}

func NewRegistrationService(supabaseStorage *storage.SupabaseStorage, redisStore *storage.Store, resendAPIKey string, resendFrom string, frontendURL string) *RegistrationService {
	trimmedKey := strings.TrimSpace(resendAPIKey)
	trimmedFrom := strings.TrimSpace(resendFrom)
	var client *resend.Client
	if trimmedKey != "" {
		client = resend.NewClient(trimmedKey)
	}
	return &RegistrationService{
		storage:     supabaseStorage,
		redis:       redisStore,
		resend:      client,
		from:        trimmedFrom,
		frontendURL: strings.TrimRight(frontendURL, "/"),
	}
}

type RegisterRequest struct {
	Username       string `json:"username"`
	Email          string `json:"email"`
	Purpose        string `json:"purpose"`
	InviteCode     string `json:"inviteCode"`
	RegisterMethod string `json:"registerMethod"` // "github", "google", "email"
}

// GenerateInviteCode creates a new global invite code and stores it in Redis.
func (s *RegistrationService) GenerateInviteCode(ctx context.Context, ttlSeconds int) (string, error) {
	if s.redis == nil || !s.redis.Enabled() {
		return "", errors.New("redis not configured")
	}
	code, err := randomCode(10)
	if err != nil {
		return "", err
	}
	var ttl time.Duration
	if ttlSeconds > 0 {
		ttl = time.Duration(ttlSeconds) * time.Second
	}
	if err := s.redis.SetInviteCode(ctx, code, ttl); err != nil {
		return "", err
	}
	return code, nil
}

// GetInviteCode returns the current global invite code and TTL.
func (s *RegistrationService) GetInviteCode(ctx context.Context) (string, time.Duration, error) {
	if s.redis == nil || !s.redis.Enabled() {
		return "", 0, errors.New("redis not configured")
	}
	code, err := s.redis.GetInviteCode(ctx)
	if err != nil {
		if storage.IsCacheMiss(err) {
			return "", 0, nil
		}
		return "", 0, err
	}
	ttl, err := s.redis.GetInviteCodeTTL(ctx)
	if err != nil {
		return code, 0, nil
	}
	return code, ttl, nil
}

// DeleteInviteCode removes the current global invite code.
func (s *RegistrationService) DeleteInviteCode(ctx context.Context) error {
	if s.redis == nil || !s.redis.Enabled() {
		return errors.New("redis not configured")
	}
	return s.redis.DeleteInviteCode(ctx)
}

// ValidateInviteCode checks whether the given code matches the stored one.
func (s *RegistrationService) ValidateInviteCode(ctx context.Context, code string) error {
	if s.redis == nil || !s.redis.Enabled() {
		return errors.New("redis not configured")
	}
	stored, err := s.redis.GetInviteCode(ctx)
	if err != nil {
		if storage.IsCacheMiss(err) {
			return errors.New("no active invite code")
		}
		return err
	}
	if stored != code {
		return errors.New("invalid invite code")
	}
	return nil
}

// Register creates a pending user after validating the invite code.
func (s *RegistrationService) Register(ctx context.Context, req RegisterRequest) error {
	// Validate invite code
	if err := s.ValidateInviteCode(ctx, req.InviteCode); err != nil {
		return fmt.Errorf("invite_code_invalid")
	}

	// Check if email already registered
	existing, err := s.storage.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return fmt.Errorf("database error: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("email_already_registered")
	}

	// Create pending user
	login := req.Username
	avatarURL := fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=0D1117&color=ffffff&size=128", login)

	if err := s.storage.CreatePendingUser(ctx, login, "", "", req.Email, req.Purpose, req.InviteCode, req.RegisterMethod, avatarURL, login); err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	// Notify admin asynchronously (best effort)
	go s.notifyAdmin(context.Background(), req)

	return nil
}

// ApproveUser sets a pending user to active and sends approval email.
func (s *RegistrationService) ApproveUser(ctx context.Context, login string) error {
	user, err := s.storage.GetUserFullByLogin(ctx, login)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	status, _ := user["status"].(string)
	if status != "pending" {
		return errors.New("user is not pending")
	}

	if err := s.storage.UpdateUserStatus(ctx, login, "active"); err != nil {
		return err
	}

	email, _ := user["email"].(string)
	if email != "" {
		go s.sendApprovalEmail(context.Background(), login, email)
	}

	return nil
}

// RejectUser sets a pending user to rejected and sends rejection email.
func (s *RegistrationService) RejectUser(ctx context.Context, login string, reason string) error {
	user, err := s.storage.GetUserFullByLogin(ctx, login)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	status, _ := user["status"].(string)
	if status != "pending" {
		return errors.New("user is not pending")
	}

	if err := s.storage.UpdateUserStatus(ctx, login, "rejected"); err != nil {
		return err
	}

	email, _ := user["email"].(string)
	if email != "" {
		go s.sendRejectionEmail(context.Background(), login, email, reason)
	}

	return nil
}

// ListPendingUsers returns all users with pending status.
func (s *RegistrationService) ListPendingUsers(ctx context.Context) ([]map[string]any, error) {
	return s.storage.ListPendingUsers(ctx)
}

// GetUserStatus returns status for a login.
func (s *RegistrationService) GetUserStatus(ctx context.Context, login string) (string, error) {
	return s.storage.GetUserStatus(ctx, login)
}

// GetUserByEmail returns user by email.
func (s *RegistrationService) GetUserByEmail(ctx context.Context, email string) (map[string]any, error) {
	return s.storage.GetUserByEmail(ctx, email)
}

func (s *RegistrationService) notifyAdmin(ctx context.Context, req RegisterRequest) {
	if s.resend == nil || s.from == "" {
		return
	}
	// Get admin email from settings
	adminEmail, err := s.getAdminEmail(ctx)
	if err != nil || adminEmail == "" {
		return
	}

	var buf bytes.Buffer
	if err := adminNotifyTmpl.Execute(&buf, struct {
		Username       string
		Email          string
		RegisterMethod string
		Purpose        string
	}{
		Username:       req.Username,
		Email:          req.Email,
		RegisterMethod: req.RegisterMethod,
		Purpose:        req.Purpose,
	}); err != nil {
		return
	}

	from := s.from
	if !strings.Contains(from, "<") && strings.Contains(from, "@") {
		from = fmt.Sprintf("hc <%s>", from)
	}

	_, _ = s.resend.Emails.Send(&resend.SendEmailRequest{
		From:    from,
		To:      []string{adminEmail},
		Subject: fmt.Sprintf("新用户注册审核 - %s", req.Username),
		Html:    buf.String(),
	})
}

func (s *RegistrationService) sendApprovalEmail(ctx context.Context, login, email string) {
	if s.resend == nil || s.from == "" {
		return
	}

	var buf bytes.Buffer
	if err := approvalTmpl.Execute(&buf, struct {
		Login string
		Link  string
	}{
		Login: login,
		Link:  s.frontendURL + "/login",
	}); err != nil {
		return
	}

	from := s.from
	if !strings.Contains(from, "<") && strings.Contains(from, "@") {
		from = fmt.Sprintf("hc <%s>", from)
	}

	_, _ = s.resend.Emails.Send(&resend.SendEmailRequest{
		From:    from,
		To:      []string{email},
		Subject: "Story-Timeline 入站审核通过啦喵~",
		Html:    buf.String(),
	})
}

func (s *RegistrationService) sendRejectionEmail(ctx context.Context, login, email, reason string) {
	if s.resend == nil || s.from == "" {
		return
	}

	var buf bytes.Buffer
	if err := rejectionTmpl.Execute(&buf, struct {
		Login  string
		Reason string
	}{
		Login:  login,
		Reason: reason,
	}); err != nil {
		return
	}

	from := s.from
	if !strings.Contains(from, "<") && strings.Contains(from, "@") {
		from = fmt.Sprintf("hc <%s>", from)
	}

	_, _ = s.resend.Emails.Send(&resend.SendEmailRequest{
		From:    from,
		To:      []string{email},
		Subject: "Story-Timeline 入站审核结果",
		Html:    buf.String(),
	})
}

func (s *RegistrationService) getAdminEmail(ctx context.Context) (string, error) {
	raw, err := s.storage.GetSetting(ctx, "admin_email")
	if err != nil {
		return "", err
	}
	if raw == nil {
		return "", nil
	}
	var email string
	if err := json.Unmarshal(raw, &email); err != nil {
		return strings.Trim(strings.TrimSpace(string(raw)), `"`), nil
	}
	return strings.TrimSpace(email), nil
}

func randomCode(length int) (string, error) {
	raw := make([]byte, length)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	// Use base62-like characters for a clean invite code
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, length)
	for i, b := range raw {
		code[i] = charset[int(b)%len(charset)]
	}
	return string(code), nil
}

// SetAdminEmail stores the admin email in settings.
func (s *RegistrationService) SetAdminEmail(ctx context.Context, email string) error {
	raw := []byte(fmt.Sprintf("%q", email))
	return s.storage.UpsertSetting(ctx, "admin_email", raw)
}

// GetAdminEmail returns the admin email from settings (public method).
func (s *RegistrationService) GetAdminEmailPublic(ctx context.Context) (string, error) {
	return s.getAdminEmail(ctx)
}

// Enabled returns true if the service is operational.
func (s *RegistrationService) Enabled() bool {
	return s != nil && s.storage != nil
}
