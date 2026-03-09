package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	maxFiles     = 9
	maxFileSize  = 5 << 20  // 5 MB
	maxTotalSize = 25 << 20 // 25 MB
)

type ImageController struct {
	imageService *service.ImageService
}

func NewImageController(imageService *service.ImageService) *ImageController {
	return &ImageController{imageService: imageService}
}

func assetURLs(id string, count int) []string {
	urls := make([]string, count)
	for i := range count {
		urls[i] = fmt.Sprintf("/api/images/%s/asset/%d", id, i)
	}
	return urls
}

func (controller *ImageController) List(w http.ResponseWriter, r *http.Request) {
	items := controller.imageService.List()
	response := make([]dto.ImageResponse, 0, len(items))
	for _, item := range items {
		response = append(response, dto.NewImageResponse(item, assetURLs(item.ID, len(item.AllImagePaths()))))
	}

	dto.WriteJSON(w, http.StatusOK, response)
}

func (controller *ImageController) Create(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	files, err := readMultipartFiles(r)
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

	image, err := controller.imageService.Create(r.Context(), session.AccessToken, session.User, r.FormValue("description"), capturedAt, files)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusCreated, dto.NewImageResponse(image, assetURLs(image.ID, len(image.AllImagePaths()))))
}

func (controller *ImageController) Update(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	imageID := chi.URLParam(r, "imageID")
	capturedAt, err := utils.ParseBeijing(r.FormValue("capturedAt"))
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, "invalid capturedAt")
		return
	}

	files, err := readMultipartFiles(r)
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	image, err := controller.imageService.Update(r.Context(), session.AccessToken, imageID, r.FormValue("description"), capturedAt, files)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusOK, dto.NewImageResponse(image, assetURLs(image.ID, len(image.AllImagePaths()))))
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
	assetIndex, err := strconv.Atoi(chi.URLParam(r, "assetIndex"))
	if err != nil || assetIndex < 0 {
		dto.WriteError(w, http.StatusBadRequest, "invalid asset index")
		return
	}

	content, contentType, err := controller.imageService.ReadAsset(r.Context(), "", imageID, assetIndex)
	if err != nil {
		dto.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

func readMultipartFiles(r *http.Request) ([][]byte, error) {
	fileHeaders := r.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		// Also try legacy single "file" field
		fileHeaders = r.MultipartForm.File["file"]
	}
	if len(fileHeaders) > maxFiles {
		return nil, fmt.Errorf("最多上传 %d 张图片", maxFiles)
	}

	var totalSize int64
	var result [][]byte
	for _, fh := range fileHeaders {
		if fh.Size > maxFileSize {
			return nil, fmt.Errorf("单张图片不能超过 5MB: %s", fh.Filename)
		}
		totalSize += fh.Size
		if totalSize > maxTotalSize {
			return nil, fmt.Errorf("帖子总大小不能超过 25MB")
		}

		f, err := fh.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			return nil, err
		}
		result = append(result, data)
	}

	return result, nil
}