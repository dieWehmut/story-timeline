package controller

import (
	"fmt"
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

	code, expiresAt, err := ctrl.registrationService.GenerateInviteCode(c.Request.Context(), payload.TTLSeconds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	resp := gin.H{"ok": true, "code": code}
	if !expiresAt.IsZero() {
		resp["expiresAt"] = expiresAt.Format("2006-01-02T15:04:05Z")
	}
	c.JSON(http.StatusOK, resp)
}

// GetInviteCode handles GET /api/admin/invite-code
func (ctrl *RegistrationController) GetInviteCode(c *gin.Context) {
	code, expiresAt, err := ctrl.registrationService.GetInviteCode(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	resp := gin.H{"ok": true, "code": code}
	if !expiresAt.IsZero() {
		resp["expiresAt"] = expiresAt.Format("2006-01-02T15:04:05Z")
	}
	c.JSON(http.StatusOK, resp)
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

	var payload struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&payload)

	if err := ctrl.registrationService.ApproveUser(c.Request.Context(), login, strings.TrimSpace(payload.Reason)); err != nil {
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

// EmailApproveUserPage handles GET /api/admin/approve/:userID (shows confirmation form)
func (ctrl *RegistrationController) EmailApproveUserPage(c *gin.Context) {
	userID := c.Param("userID")
	token := c.Query("token")

	if userID == "" || token == "" {
		ctrl.renderErrorPage(c, "参数缺失")
		return
	}

	// Return a form page for the admin to fill in the reason
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>通过用户申请</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
               background: linear-gradient(135deg, #0b0b0f 0%%, #14141b 100%%); margin: 0; padding: 40px 20px; min-height: 100vh; box-sizing: border-box; }
        .container { max-width: 420px; margin: 0 auto; background: #14141b;
                    padding: 30px; border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,0.45); border: 1px solid #1f1f2a; }
        h1 { color: #f5f5f5; margin-bottom: 8px; font-size: 22px; text-align: center; }
        .subtitle { color: #9a9ab0; text-align: center; margin-bottom: 24px; font-size: 14px; }
        .user-info { background: #1a1a22; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; color: #e8e8ef; font-size: 14px; }
        label { display: block; color: #b7b7c8; margin-bottom: 8px; font-size: 14px; }
        textarea { width: 100%%; padding: 12px; border: 1px solid #3a3a4a; border-radius: 8px; background: #1a1a22;
                  color: #f5f5f5; font-size: 14px; font-family: inherit; resize: vertical; min-height: 80px; box-sizing: border-box; }
        textarea:focus { outline: none; border-color: #4ade80; }
        button { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; border: none;
                padding: 14px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
                width: 100%%; margin-top: 16px; font-family: inherit; transition: transform 0.1s; }
        button:hover { transform: scale(1.02); }
        button:active { transform: scale(0.98); }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ 通过用户申请</h1>
        <p class="subtitle">确认通过该用户的注册申请</p>
        <div class="user-info">用户: <strong>%s</strong></div>
        <form method="POST" action="">
            <input type="hidden" name="token" value="%s" />
            <label for="reason">欢迎理由 (选填)：</label>
            <textarea name="reason" id="reason" placeholder="欢迎加入~"></textarea>
            <button type="submit">确认通过</button>
        </form>
    </div>
</body>
</html>`, userID, token))
}

// EmailApproveUser handles POST /api/admin/approve/:userID (from email)
func (ctrl *RegistrationController) EmailApproveUser(c *gin.Context) {
	userID := c.Param("userID")
	if userID == "" {
		ctrl.renderErrorPage(c, "missing userID")
		return
	}

	token := c.PostForm("token")
	reason := c.PostForm("reason")

	if token == "" {
		ctrl.renderErrorPage(c, "missing token")
		return
	}

	if err := ctrl.registrationService.ApproveUserByEmail(c.Request.Context(), token, strings.TrimSpace(reason)); err != nil {
		ctrl.renderErrorPage(c, err.Error())
		return
	}

	// Success - return user-friendly HTML page
	ctrl.renderSuccessPage(c, "审核通过", "用户申请已通过，已发送通知邮件喵~", "#16a34a")
}

// EmailRejectUserPage handles GET /api/admin/reject/:userID (shows confirmation form)
func (ctrl *RegistrationController) EmailRejectUserPage(c *gin.Context) {
	userID := c.Param("userID")
	token := c.Query("token")

	if userID == "" || token == "" {
		ctrl.renderErrorPage(c, "参数缺失")
		return
	}

	// Return a form page for the admin to fill in the reason
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>拒绝用户申请</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
               background: linear-gradient(135deg, #0b0b0f 0%%, #14141b 100%%); margin: 0; padding: 40px 20px; min-height: 100vh; box-sizing: border-box; }
        .container { max-width: 420px; margin: 0 auto; background: #14141b;
                    padding: 30px; border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,0.45); border: 1px solid #1f1f2a; }
        h1 { color: #f5f5f5; margin-bottom: 8px; font-size: 22px; text-align: center; }
        .subtitle { color: #9a9ab0; text-align: center; margin-bottom: 24px; font-size: 14px; }
        .user-info { background: #1a1a22; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; color: #e8e8ef; font-size: 14px; }
        label { display: block; color: #b7b7c8; margin-bottom: 8px; font-size: 14px; }
        textarea { width: 100%%; padding: 12px; border: 1px solid #3a3a4a; border-radius: 8px; background: #1a1a22;
                  color: #f5f5f5; font-size: 14px; font-family: inherit; resize: vertical; min-height: 80px; box-sizing: border-box; }
        textarea:focus { outline: none; border-color: #ef4444; }
        button { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none;
                padding: 14px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
                width: 100%%; margin-top: 16px; font-family: inherit; transition: transform 0.1s; }
        button:hover { transform: scale(1.02); }
        button:active { transform: scale(0.98); }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ 拒绝用户申请</h1>
        <p class="subtitle">确认拒绝该用户的注册申请</p>
        <div class="user-info">用户: <strong>%s</strong></div>
        <form method="POST" action="">
            <input type="hidden" name="token" value="%s" />
            <label for="reason">拒绝理由 (必填)：</label>
            <textarea name="reason" id="reason" placeholder="请说明拒绝理由..." required></textarea>
            <button type="submit">确认拒绝</button>
        </form>
    </div>
</body>
</html>`, userID, token))
}

// EmailRejectUser handles POST /api/admin/reject/:userID (from email)
func (ctrl *RegistrationController) EmailRejectUser(c *gin.Context) {
	userID := c.Param("userID")
	if userID == "" {
		ctrl.renderErrorPage(c, "missing userID")
		return
	}

	token := c.PostForm("token")
	reason := c.PostForm("reason")

	if token == "" {
		ctrl.renderErrorPage(c, "missing token")
		return
	}

	if strings.TrimSpace(reason) == "" {
		ctrl.renderErrorPage(c, "拒绝理由不能为空喵~")
		return
	}

	if err := ctrl.registrationService.RejectUserByEmail(c.Request.Context(), token, strings.TrimSpace(reason)); err != nil {
		ctrl.renderErrorPage(c, err.Error())
		return
	}

	// Success
	ctrl.renderSuccessPage(c, "申请已拒绝", "用户申请已拒绝，已发送通知邮件喵~", "#dc2626")
}

// renderErrorPage renders a styled error page
func (ctrl *RegistrationController) renderErrorPage(c *gin.Context, message string) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusBadRequest, fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>操作失败</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
               background: linear-gradient(135deg, #0b0b0f 0%%, #14141b 100%%); margin: 0; padding: 40px 20px; min-height: 100vh; box-sizing: border-box; text-align: center; }
        .container { max-width: 400px; margin: 0 auto; background: #14141b;
                    padding: 30px; border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,0.45); border: 1px solid #1f1f2a; }
        h1 { color: #f5f5f5; margin-bottom: 20px; }
        .error { color: #ef4444; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>😿 操作失败</h1>
        <p class="error">%s</p>
    </div>
</body>
</html>`, message))
}

// renderSuccessPage renders a styled success page
func (ctrl *RegistrationController) renderSuccessPage(c *gin.Context, title, message, color string) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
               background: linear-gradient(135deg, #0b0b0f 0%%, #14141b 100%%); margin: 0; padding: 40px 20px; min-height: 100vh; box-sizing: border-box; text-align: center; }
        .container { max-width: 400px; margin: 0 auto; background: #14141b;
                    padding: 30px; border-radius: 16px; box-shadow: 0 24px 70px rgba(0,0,0,0.45); border: 1px solid #1f1f2a; }
        h1 { color: #f5f5f5; margin-bottom: 20px; }
        .message { color: %s; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>%s</h1>
        <p class="message">%s</p>
    </div>
</body>
</html>`, title, color, title, message))
}
