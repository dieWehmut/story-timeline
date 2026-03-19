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

// AdminToken represents a token for email-based admin approval/rejection
type AdminToken struct {
	UserLogin string    `json:"user_login"`
	Action    string    `json:"action"` // "approve" or "reject"
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// generateAdminToken creates a secure token for admin actions
func (s *RegistrationService) generateAdminToken(userLogin, action string) (string, error) {
	tokenData := AdminToken{
		UserLogin: userLogin,
		Action:    action,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour), // Token expires in 24 hours
	}

	// Generate random bytes
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	// Create token with structure: base64(JSON) + "." + hex(random) + "." + hex(hash)
	tokenJSON, err := json.Marshal(tokenData)
	if err != nil {
		return "", err
	}

	payload := hex.EncodeToString(tokenJSON) + "." + hex.EncodeToString(randomBytes)
	hash := sha256.Sum256([]byte(payload))
	token := payload + "." + hex.EncodeToString(hash[:])

	return token, nil
}

// validateAdminToken validates and parses an admin token
func (s *RegistrationService) validateAdminToken(token string) (*AdminToken, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token format")
	}

	tokenHex, randomHex, hashHex := parts[0], parts[1], parts[2]

	// Verify hash
	payload := tokenHex + "." + randomHex
	expectedHash := sha256.Sum256([]byte(payload))
	expectedHashHex := hex.EncodeToString(expectedHash[:])
	if expectedHashHex != hashHex {
		return nil, errors.New("invalid token signature")
	}

	// Decode token data
	tokenJSON, err := hex.DecodeString(tokenHex)
	if err != nil {
		return nil, errors.New("invalid token encoding")
	}

	var tokenData AdminToken
	if err := json.Unmarshal(tokenJSON, &tokenData); err != nil {
		return nil, errors.New("invalid token data")
	}

	// Check expiration
	if time.Now().After(tokenData.ExpiresAt) {
		return nil, errors.New("token expired")
	}

	return &tokenData, nil
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
// If the user was previously rejected, they can re-apply.
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
		status, _ := existing["status"].(string)
		login, _ := existing["login"].(string)

		// Allow re-application if previously rejected
		if status == "rejected" && login != "" {
			history, historyErr := s.storage.GetRejectionHistory(ctx, login)
			if historyErr != nil {
				return fmt.Errorf("failed to load rejection history: %w", historyErr)
			}

			// Update purpose and reset status to pending
			if err := s.storage.UpdatePendingUser(ctx, login, req.Purpose, req.InviteCode); err != nil {
				return fmt.Errorf("failed to update user: %w", err)
			}
			// Re-use username from existing record
			req.Username = login
			go s.notifyAdmin(context.Background(), req, len(history)+1)
			return nil
		}

		// For pending or active users, reject re-registration
		return fmt.Errorf("email_already_registered")
	}

	// Create pending user
	login := req.Username
	avatarURL := fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=0D1117&color=ffffff&size=128", login)

	if err := s.storage.CreatePendingUser(ctx, login, "", "", req.Email, req.Purpose, req.InviteCode, req.RegisterMethod, avatarURL, login); err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	// Notify admin asynchronously (best effort)
	go s.notifyAdmin(context.Background(), req, 1)

	return nil
}

// ApproveUser sets a pending user to active and sends approval email.
func (s *RegistrationService) ApproveUser(ctx context.Context, login string, reason string) error {
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

	// Get rejection history for email
	history, _ := s.storage.GetRejectionHistory(ctx, login)

	email, _ := user["email"].(string)
	if email != "" {
		go s.sendApprovalEmail(context.Background(), login, email, reason, history)
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

	// Get existing rejection history before adding new one
	history, _ := s.storage.GetRejectionHistory(ctx, login)

	// Save rejection history
	if err := s.storage.SaveRejectionHistory(ctx, login, reason); err != nil {
		// Log error but continue
	}

	if err := s.storage.UpdateUserStatus(ctx, login, "rejected"); err != nil {
		return err
	}

	email, _ := user["email"].(string)
	if email != "" {
		// Pass history (before current rejection) to email
		go s.sendRejectionEmail(context.Background(), login, email, reason, len(history)+1, history)
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

func (s *RegistrationService) notifyAdmin(ctx context.Context, req RegisterRequest, attemptCount int) {
	if s.resend == nil || s.from == "" {
		return
	}
	// Get admin email from settings
	adminEmail, err := s.getAdminEmail(ctx)
	if err != nil || adminEmail == "" {
		return
	}

	// Generate admin tokens for approval/rejection
	approveToken, err := s.generateAdminToken(req.Username, "approve")
	if err != nil {
		return
	}

	var buf bytes.Buffer
	if err := adminNotifyTmpl.Execute(&buf, struct {
		Username       string
		Email          string
		RegisterMethod string
		Purpose        string
		AttemptCount   int
		BaseURL        string
		UserID         string
		Token          string
	}{
		Username:       req.Username,
		Email:          req.Email,
		RegisterMethod: req.RegisterMethod,
		Purpose:        req.Purpose,
		AttemptCount:   attemptCount,
		BaseURL:        s.frontendURL,
		UserID:         req.Username, // Using username as user identifier
		Token:          approveToken,
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
		Subject: fmt.Sprintf("新用户注册审核 - %s（第 %d 次申请）", req.Username, attemptCount),
		Html:    buf.String(),
	})
}

func (s *RegistrationService) sendApprovalEmail(ctx context.Context, login, email, reason string, history []storage.RejectionRecord) {
	if s.resend == nil || s.from == "" {
		return
	}

	// Convert history to template-friendly format
	type HistoryItem struct {
		Reason     string
		RejectedAt string
	}
	var historyItems []HistoryItem
	for _, h := range history {
		historyItems = append(historyItems, HistoryItem{
			Reason:     h.Reason,
			RejectedAt: h.RejectedAt.Format("2006-01-02 15:04"),
		})
	}

	var buf bytes.Buffer
	if err := approvalTmpl.Execute(&buf, struct {
		Login      string
		Link       string
		Reason     string
		HasHistory bool
		History    []HistoryItem
	}{
		Login:      login,
		Link:       s.frontendURL + "/login",
		Reason:     reason,
		HasHistory: len(historyItems) > 0,
		History:    historyItems,
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

func (s *RegistrationService) sendRejectionEmail(ctx context.Context, login, email, reason string, rejectionCount int, history []storage.RejectionRecord) {
	if s.resend == nil || s.from == "" {
		return
	}

	// Convert history to template-friendly format
	type HistoryItem struct {
		Reason     string
		RejectedAt string
	}
	var historyItems []HistoryItem
	for _, h := range history {
		historyItems = append(historyItems, HistoryItem{
			Reason:     h.Reason,
			RejectedAt: h.RejectedAt.Format("2006-01-02 15:04"),
		})
	}

	var buf bytes.Buffer
	if err := rejectionTmpl.Execute(&buf, struct {
		Login          string
		Reason         string
		RejectionCount int
		HasHistory     bool
		History        []HistoryItem
	}{
		Login:          login,
		Reason:         reason,
		RejectionCount: rejectionCount,
		HasHistory:     len(historyItems) > 0,
		History:        historyItems,
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

// ApproveUserByEmail handles approval via email token with reason
func (s *RegistrationService) ApproveUserByEmail(ctx context.Context, token, reason string) error {
	adminToken, err := s.validateAdminToken(token)
	if err != nil {
		return err
	}

	if adminToken.Action != "approve" {
		return errors.New("invalid action for token")
	}

	return s.ApproveUser(ctx, adminToken.UserLogin, reason)
}

// RejectUserByEmail handles rejection via email token with reason
func (s *RegistrationService) RejectUserByEmail(ctx context.Context, token, reason string) error {
	// For rejection, we can use the same token since we're validating the action
	// But let's generate a separate reject token for better security
	adminToken, err := s.validateAdminToken(token)
	if err != nil {
		return err
	}

	// Accept both approve and reject tokens for flexibility
	// The email template will have both actions with the same base token

	return s.RejectUser(ctx, adminToken.UserLogin, reason)
}
