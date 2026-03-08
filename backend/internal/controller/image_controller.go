package controller

import (
	"fmt"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dieWehmut/inner/backend/internal/dto"
	"github.com/dieWehmut/inner/backend/internal/middleware"
	"github.com/dieWehmut/inner/backend/internal/service"
	"github.com/dieWehmut/inner/backend/internal/utils"
)

type ImageController struct {
	imageService *service.ImageService
}

func NewImageController(imageService *service.ImageService) *ImageController {
	return &ImageController{imageService: imageService}
}

func (controller *ImageController) List(w http.ResponseWriter, r *http.Request) {
	items := controller.imageService.List()
	response := make([]dto.ImageResponse, 0, len(items))
	for _, item := range items {
		response = append(response, dto.NewImageResponse(item, fmt.Sprintf("/api/images/%s/asset", item.ID)))
	}

	dto.WriteJSON(w, http.StatusOK, response)
}

func (controller *ImageController) Create(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	fileBytes, err := readMultipartFile(r, true)
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	capturedAt, err := utils.ParseBeijing(r.FormValue("capturedAt"))
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, "invalid capturedAt")
		return
	}

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	image, err := controller.imageService.Create(r.Context(), session.AccessToken, r.FormValue("description"), capturedAt, fileBytes)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusCreated, dto.NewImageResponse(image, fmt.Sprintf("/api/images/%s/asset", image.ID)))
}

func (controller *ImageController) Update(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	imageID := chi.URLParam(r, "imageID")
	capturedAt, err := utils.ParseBeijing(r.FormValue("capturedAt"))
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, "invalid capturedAt")
		return
	}

	fileBytes, err := readMultipartFile(r, false)
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	image, err := controller.imageService.Update(r.Context(), session.AccessToken, imageID, r.FormValue("description"), capturedAt, fileBytes)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusOK, dto.NewImageResponse(image, fmt.Sprintf("/api/images/%s/asset", image.ID)))
}

func (controller *ImageController) Delete(w http.ResponseWriter, r *http.Request) {
	imageID := chi.URLParam(r, "imageID")
	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	if err := controller.imageService.Delete(r.Context(), session.AccessToken, imageID); err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (controller *ImageController) Asset(w http.ResponseWriter, r *http.Request) {
	imageID := chi.URLParam(r, "imageID")
	content, contentType, err := controller.imageService.ReadAsset(r.Context(), "", imageID)
	if err != nil {
		dto.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

func readMultipartFile(r *http.Request, required bool) ([]byte, error) {
	file, _, err := r.FormFile("file")
	if err != nil {
		if required {
			return nil, err
		}
		return nil, nil
	}
	defer file.Close()

	return io.ReadAll(file)
}