package utils

import (
	"crypto/rand"
	"encoding/hex"
)

func NewID() string {
	buffer := make([]byte, 8)
	_, _ = rand.Read(buffer)
	return hex.EncodeToString(buffer)
}