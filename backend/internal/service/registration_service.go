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
	storage     *storage.SupabaseStorage
	resend      *resend.Client
	from        string
	frontendURL string
	adminLogin  string
}

func NewRegistrationService(supabaseStorage *storage.SupabaseStorage, redisStore *storage.Store, resendAPIKey string, resendFrom string, frontendURL string, adminLogin string) *RegistrationService {
	trimmedKey := strings.TrimSpace(resendAPIKey)
	trimmedFrom := strings.TrimSpace(resendFrom)
	var client *resend.Client
	if trimmedKey != "" {
		client = resend.NewClient(trimmedKey)
	}
	return &RegistrationService{
		storage:     supabaseStorage,
		resend:      client,
		from:        trimmedFrom,
		frontendURL: strings.TrimRight(frontendURL, "/"),
		adminLogin:  strings.TrimSpace(adminLogin),
	}
}

type RegisterRequest struct {
	Username       string `json:"username"`
	Email          string `json:"email"`
	Purpose        string `json:"purpose"`
	InviteCode     string `json:"inviteCode"`
	RegisterMethod string `json:"registerMethod"` // "github", "google", "email"
}

const settingKeyInviteCode = "invite_code"

type inviteCodeEntry struct {
	Code      string     `json:"code"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

func (s *RegistrationService) loadInviteCode(ctx context.Context) (*inviteCodeEntry, error) {
	raw, err := s.storage.GetSetting(ctx, settingKeyInviteCode)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, nil
	}
	var entry inviteCodeEntry
	if err := json.Unmarshal(raw, &entry); err != nil {
		return nil, err
	}
	if entry.Code == "" {
		return nil, nil
	}
	return &entry, nil
}

// GenerateInviteCode creates a new global invite code and stores it in Supabase settings.
func (s *RegistrationService) GenerateInviteCode(ctx context.Context, ttlSeconds int) (string, time.Time, error) {
	code, err := randomCode(10)
	if err != nil {
		return "", time.Time{}, err
	}

	entry := inviteCodeEntry{Code: code}
	if ttlSeconds > 0 {
		exp := time.Now().Add(time.Duration(ttlSeconds) * time.Second)
		entry.ExpiresAt = &exp
	}

	raw, err := json.Marshal(entry)
	if err != nil {
		return "", time.Time{}, err
	}
	if err := s.storage.UpsertSetting(ctx, settingKeyInviteCode, raw); err != nil {
		return "", time.Time{}, err
	}

	var expiresAt time.Time
	if entry.ExpiresAt != nil {
		expiresAt = *entry.ExpiresAt
	}
	return code, expiresAt, nil
}

// GetInviteCode returns the current global invite code and its expiry.
func (s *RegistrationService) GetInviteCode(ctx context.Context) (string, time.Time, error) {
	entry, err := s.loadInviteCode(ctx)
	if err != nil {
		return "", time.Time{}, err
	}
	if entry == nil {
		return "", time.Time{}, nil
	}
	// Check if expired
	if entry.ExpiresAt != nil && time.Now().After(*entry.ExpiresAt) {
		// Expired — clean up
		_ = s.storage.DeleteSetting(ctx, settingKeyInviteCode)
		return "", time.Time{}, nil
	}
	var expiresAt time.Time
	if entry.ExpiresAt != nil {
		expiresAt = *entry.ExpiresAt
	}
	return entry.Code, expiresAt, nil
}

// DeleteInviteCode removes the current global invite code.
func (s *RegistrationService) DeleteInviteCode(ctx context.Context) error {
	return s.storage.DeleteSetting(ctx, settingKeyInviteCode)
}

// ValidateInviteCode checks whether the given code matches the stored one.
func (s *RegistrationService) ValidateInviteCode(ctx context.Context, code string) error {
	entry, err := s.loadInviteCode(ctx)
	if err != nil {
		return err
	}
	if entry == nil {
		return errors.New("no active invite code")
	}
	if entry.ExpiresAt != nil && time.Now().After(*entry.ExpiresAt) {
		_ = s.storage.DeleteSetting(ctx, settingKeyInviteCode)
		return errors.New("invite code expired")
	}
	if entry.Code != code {
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
	if raw != nil {
		var email string
		if err := json.Unmarshal(raw, &email); err != nil {
			email = strings.Trim(strings.TrimSpace(string(raw)), `"`)
		}
		email = strings.TrimSpace(email)
		if email != "" {
			return email, nil
		}
	}
	// Fallback: look up admin user's email from users table
	if s.adminLogin != "" {
		email, err := s.storage.GetUserEmail(ctx, s.adminLogin)
		if err == nil && email != "" {
			return email, nil
		}
	}
	return "", nil
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
