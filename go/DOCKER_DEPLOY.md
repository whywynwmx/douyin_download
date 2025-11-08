# Docker 镜像构建和部署指南

## 方法一：使用 GitHub Actions (推荐)

### 步骤：
1. **推送到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Add Docker support"
   git branch -M main
   git remote add origin https://github.com/你的用户名/douyin-downloader.git
   git push -u origin main
   ```

2. **自动构建**
   - 推送代码后，GitHub Actions 会自动构建 Docker 镜像
   - 镜像会推送到 GitHub Container Registry (ghcr.io)
   - 构建状态可在 GitHub 仓库的 Actions 页面查看

3. **拉取和运行镜像**
   ```bash
   # 拉取镜像
   docker pull ghcr.io/你的用户名/douyin-downloader:latest

   # 运行容器
   docker run -d -p 8080:8080 ghcr.io/你的用户名/douyin-downloader:latest
   ```

## 方法二：使用其他云平台

### 1. Railway (免费额度)
- 访问 [railway.app](https://railway.app)
- 连接 GitHub 账户
- 导入项目，选择 Docker 部署
- 自动部署，提供免费域名

### 2. Render (免费额度)
- 访问 [render.com](https://render.com)
- 连接 GitHub 仓库
- 选择 Docker Service
- 自动部署，提供免费域名

### 3. Fly.io (免费额度)
- 注册 [fly.io](https://fly.io)
- 安装 fly CLI
- 部署命令：
  ```bash
  fly launch
  fly deploy
  ```

### 4. Google Cloud Build (免费额度)
- 每月 120 分钟免费构建时间
- 可配置自动触发构建
- 推送到 Google Artifact Registry 或 Docker Hub

## 方法三：在线 Docker 构建器

### 1. Docker Hub Automated Builds
- 在 [hub.docker.com](https://hub.docker.com) 创建账户
- 连接 GitHub 仓库
- 配置自动构建规则

### 2. Codefresh (免费额度)
- 注册 [codefresh.io](https://codefresh.io)
- 连接 GitHub
- 配置 Docker 构建流水线

## 推荐方案

**最简单**: 使用 GitHub Actions + GitHub Container Registry
- 完全免费
- 与 GitHub 深度集成
- 支持多架构构建 (amd64/arm64)
- 自动版本管理

**最省心**: 使用 Railway 或 Render
- 无需配置 CI/CD
- 提供托管服务
- 自动 HTTPS 和域名

## 镜像使用示例

构建完成后，可以在任何支持 Docker 的服务器上运行：

```bash
# 使用 GitHub Container Registry
docker run -d \
  --name douyin-downloader \
  -p 8080:8080 \
  ghcr.io/你的用户名/douyin-downloader:latest

# 或使用 docker-compose
curl -O https://raw.githubusercontent.com/你的用户名/douyin-downloader/main/docker-compose.yml
docker-compose up -d
```

服务启动后可通过 `http://你的服务器IP:8080` 访问 API。