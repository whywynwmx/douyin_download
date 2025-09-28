# 抖音视频下载器 - React 版

这是一个使用 React 构建的现代化、响应式的前端界面，用于与后端的 `douyin-downloader` Go 程序进行交互，以分析和下载无水印的抖音视频。

## 功能

-   时尚且用户友好的界面。
-   响应式设计，适配桌面和移动设备。
-   通过粘贴分享链接，调用后端 API 分析视频。
-   在页面上优雅地展示视频标题、描述和可交互的预览。
-   提供“下载”按钮，方便用户保存视频。

## 技术栈

-   **前端**: React (使用 Vite 作为构建工具)
-   **后端**: Go

## 项目结构

```
web/
├── public/
│   └─── ... (公共静态资源)
├── src/
│   ├── components/
│   │   ├── Downloader.jsx
│   │   ├── Downloader.css
│   │   ├── Spinner.jsx
│   │   └── Spinner.css
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## 如何使用

1.  **启动后端服务**:
    -   确保 Go 环境已配置。
    -   进入 `go` 目录。
    -   运行 `go run main.go` 来启动后端 API 服务。
    -   服务将默认监听在 `http://localhost:8080`。

2.  **启动前端服务**:
    -   确保 Node.js 和 npm 已安装。
    -   进入 `web` 目录。
    -   运行 `npm install` 来安装项目依赖。
    -   运行 `npm run dev` 来启动开发服务器。
    -   在浏览器中打开提示的地址 (通常是 `http://localhost:5173`)。

3.  **使用**:
    -   将抖音分享链接粘贴到输入框中。
    -   点击“分析”。
    -   等待视频信息加载完毕后，即可预览或下载。