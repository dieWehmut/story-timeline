package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	Endpoint        string
	Region          string
}

type R2Storage struct {
	bucket string
	client *s3.Client
}

func NewR2Storage(ctx context.Context, cfg R2Config) (*R2Storage, error) {
	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, fmt.Errorf("R2_BUCKET is required")
	}
	if strings.TrimSpace(cfg.AccessKeyID) == "" || strings.TrimSpace(cfg.SecretAccessKey) == "" {
		return nil, fmt.Errorf("R2 access credentials are required")
	}

	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = "auto"
	}

	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint == "" {
		if strings.TrimSpace(cfg.AccountID) == "" {
			return nil, fmt.Errorf("R2_ACCOUNT_ID or R2_ENDPOINT is required")
		}
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
	)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.UsePathStyle = true
		options.BaseEndpoint = aws.String(endpoint)
	})

	return &R2Storage{bucket: cfg.Bucket, client: client}, nil
}

func (storage *R2Storage) PutObject(ctx context.Context, objectKey string, content []byte, contentType string) error {
	resolvedContentType := strings.TrimSpace(contentType)
	if resolvedContentType == "" {
		resolvedContentType = http.DetectContentType(content)
	}

	_, err := storage.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(storage.bucket),
		Key:         aws.String(strings.TrimPrefix(objectKey, "/")),
		Body:        bytes.NewReader(content),
		ContentType: aws.String(resolvedContentType),
	})
	return err
}

func (storage *R2Storage) GetObject(ctx context.Context, objectKey string) ([]byte, string, error) {
	resp, err := storage.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(storage.bucket),
		Key:    aws.String(strings.TrimPrefix(objectKey, "/")),
	})
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	contentType := "application/octet-stream"
	if resp.ContentType != nil && strings.TrimSpace(*resp.ContentType) != "" {
		contentType = *resp.ContentType
	}

	return payload, contentType, nil
}

func (storage *R2Storage) DeleteObject(ctx context.Context, objectKey string) error {
	_, err := storage.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(storage.bucket),
		Key:    aws.String(strings.TrimPrefix(objectKey, "/")),
	})
	return err
}