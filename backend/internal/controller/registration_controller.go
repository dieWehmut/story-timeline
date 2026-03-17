package controller

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type RegistrationController struct {
	registrationService *service.RegistrationService
}

func NewRegistrationController(registrationService *service.RegistrationService) *RegistrationController {
	return &RegistrationController{registrationService: registrationService}
}

// Register handles POST /api/register
func (ctrl *RegistrationController) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Purpose = strings.TrimSpace(req.Purpose)
	req.InviteCode = strings.TrimSpace(req.InviteCode)
	req.RegisterMethod = strings.TrimSpace(req.RegisterMethod)

	if req.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username_required"})
		return
	}
	if req.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email_required"})
		return
	}
	if len([]rune(req.Purpose)) < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "purpose_too_short"})
		return
	}
	if req.InviteCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invite_code_required"})
		return
	}
	if req.RegisterMethod == "" {
		req.RegisterMethod = "email"
	}

	if err := ctrl.registrationService.Register(c.Request.Context(), req); err != nil {
		errMsg := err.Error()
		switch errMsg {
		case "invite_code_invalid":
			c.JSON(http.StatusBadRequest, gin.H{"error": "invite_code_invalid"})
		case "email_already_registered":
			c.JSON(http.StatusConflict, gin.H{"error": "email_already_registered"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "registration_pending"})
}

// --- Admin endpoints ---

// GenerateInviteCode handles POST /api/admin/invite-code
func (ctrl *RegistrationController) GenerateInviteCode(c *gin.Context) {
	var payload struct {
		TTLSeconds int `json:"ttlSeconds"`
	}
	_ = c.ShouldBindJSON(&payload)

	code, err := ctrl.registrationService.GenerateInviteCode(c.Request.Context(), payload.TTLSeconds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "code": code})
}

// GetInviteCode handles GET /api/admin/invite-code
func (ctrl *RegistrationController) GetInviteCode(c *gin.Context) {
	code, ttl, err := ctrl.registrationService.GetInviteCode(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ttlSeconds := int(ttl.Seconds())
	if ttlSeconds < 0 {
		ttlSeconds = -1 // no expiry
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "code": code, "ttlSeconds": ttlSeconds})
}

// DeleteInviteCode handles DELETE /api/admin/invite-code
func (ctrl *RegistrationController) DeleteInviteCode(c *gin.Context) {
	if err := ctrl.registrationService.DeleteInviteCode(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ListPendingUsers handles GET /api/admin/pending-users
func (ctrl *RegistrationController) ListPendingUsers(c *gin.Context) {
	users, err := ctrl.registrationService.ListPendingUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "users": users})
}

// ApproveUser handles POST /api/admin/users/:login/approve
func (ctrl *RegistrationController) ApproveUser(c *gin.Context) {
	login := c.Param("login")
	if login == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing login"})
		return
	}
	if err := ctrl.registrationService.ApproveUser(c.Request.Context(), login); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// RejectUser handles POST /api/admin/users/:login/reject
func (ctrl *RegistrationController) RejectUser(c *gin.Context) {
	login := c.Param("login")
	if login == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing login"})
		return
	}
	var payload struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&payload)

	if err := ctrl.registrationService.RejectUser(c.Request.Context(), login, strings.TrimSpace(payload.Reason)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// SetAdminEmail handles POST /api/admin/email
func (ctrl *RegistrationController) SetAdminEmail(c *gin.Context) {
	var payload struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.TrimSpace(payload.Email)
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email required"})
		return
	}
	if err := ctrl.registrationService.SetAdminEmail(c.Request.Context(), email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GetAdminEmail handles GET /api/admin/email
func (ctrl *RegistrationController) GetAdminEmail(c *gin.Context) {
	email, err := ctrl.registrationService.GetAdminEmailPublic(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "email": email})
}
