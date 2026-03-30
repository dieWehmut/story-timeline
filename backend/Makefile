.PHONY: build run docker-build docker-run clean

# Go build
build:
	go build -o server ./cmd/server

# 本地运行（需先配置好 .env 环境变量）
run: build
	./server

# Docker 构建镜像
docker-build:
	docker build -t story-timeline-backend .

# Docker 运行（需有 .env 文件）
docker-run:
	docker run -p 7860:7860 --env-file .env story-timeline-backend

# 清理构建产物
clean:
	rm -f server