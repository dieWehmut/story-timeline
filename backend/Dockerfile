FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy module metadata first so dependency downloads stay cached.
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source after dependencies.
COPY . .

# Build a static Linux binary for the Space container.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -o server ./cmd/server


FROM alpine:3.20

RUN apk add --no-cache ca-certificates
RUN adduser -D -u 10001 appuser

WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/supabase ./supabase

RUN mkdir -p /app/data && chown appuser:appuser /app/data

ENV PORT=7860

USER appuser

EXPOSE 7860

CMD ["./server"]