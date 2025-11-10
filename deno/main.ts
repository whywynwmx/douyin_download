// 🚀 注意：已移除 import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// 模拟移动浏览器的请求头
const headers = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

// 请求体类型定义
interface ShareLinkRequest {
  share_link: string;
}

// 视频信息类型定义
interface VideoInfo {
  url: string;
  title: string;
  video_id: string;
}

// 获取抖音下载链接的核心逻辑
async function getDouyinDownloadLink(shareText: string): Promise<VideoInfo> {
  // 1. 从分享文本中提取短URL
  const urlRegex = /https?:\/\/[^\s]+/g;
  const shortURLMatch = shareText.match(urlRegex);
  if (!shortURLMatch) {
    throw new Error("未在文本中找到有效的分享链接");
  }

  const shortURL = shortURLMatch[0];

  // 2. 请求短URL获取重定向URL
  const response1 = await fetch(shortURL, {
    headers,
    redirect: "manual", // 不自动跟随重定向
  });

  const redirectURL = response1.headers.get("location");
  if (!redirectURL) {
    throw new Error("无法获取重定向地址");
  }

  // 3. 从重定向URL中提取视频ID
  let videoId = "";
  const urlParts = redirectURL.split("?")[0].split("/");
  videoId = urlParts[urlParts.length - 1];

  if (!videoId) {
    const videoIdMatch = redirectURL.match(/\/video\/(\d+)/);
    if (videoIdMatch) {
      videoId = videoIdMatch[1];
    } else {
      throw new Error(`无法从URL中提取视频ID: ${redirectURL}`);
    }
  }

  // 4. 请求最终URL获取页面HTML
  const pageURL = `https://www.iesdouyin.com/share/video/${videoId}`;
  const pageResponse = await fetch(pageURL, { headers });

  if (!pageResponse.ok) {
    throw new Error(`请求页面失败: ${pageResponse.status}`);
  }

  const html = await pageResponse.text();

  // 5. 在HTML中查找 _ROUTER_DATA_ JSON对象
  const routerDataMatch = html.match(/window\._ROUTER_DATA\s*=\s*(.*?)<\/script>/s);
  if (!routerDataMatch) {
    throw new Error("无法在HTML中找到 _ROUTER_DATA_");
  }

  // 6. 解析JSON
  let jsonStr = routerDataMatch[1];
  const appIndex = jsonStr.indexOf('{"app":');
  if (appIndex !== -1) {
    jsonStr = jsonStr.substring(appIndex);
  }

  let routerData;
  try {
    routerData = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`JSON解析失败: ${error.message}`);
  }

  // 7. 从解析的数据中提取视频信息
  let originalVideoInfo = null;
  for (const pageData of Object.values(routerData.loaderData || {}) as any[]) {
    if (pageData?.videoInfoRes?.item_list?.length > 0) {
      originalVideoInfo = pageData.videoInfoRes;
      break;
    }
  }

  if (!originalVideoInfo?.item_list?.length) {
    throw new Error("无法从JSON数据中解析视频信息");
  }

  const item = originalVideoInfo.item_list[0];
  if (!item?.video?.play_addr?.url_list?.length) {
    throw new Error("在解析的数据中未找到视频URL");
  }

  // 8. 构建无水印URL并获取标题
  const videoURL = item.video.play_addr.url_list[0].replace("playwm", "play");
  let title = item.desc || `douyin_${videoId}`;

  // 清理标题中的无效字符
  title = title.replace(/[\/:*?"<>|]/g, "_");

  return {
    url: videoURL,
    title,
    video_id: videoId,
  };
}

// 通用的 CORS 处理函数 (用于非代理响应)
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Range");
  headers.set("Access-Control-Expose-Headers", "Content-Length");
  headers.set("Access-Control-Max-Age", "86400");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// 处理OPTIONS预检请求
function handleOptions(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Origin, Content-Type, Accept, Range",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// 请求处理器
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 处理OPTIONS预检请求
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  try {

    // 根路径 - 服务状态检查
    if (url.pathname === "/") {
      const response = new Response(JSON.stringify({
        status: "running",
        service: "douyin-downloader",
        version: "deno-deploy-v2", // 版本号更新，便于追踪
        endpoints: [
          "GET /",
          "POST /api/v1/douyin",
          "GET /api/v1/douyin/proxy",
        ],
      }), {
        headers: { "Content-Type": "application/json" },
      });
      return addCorsHeaders(response);
    }

    // 获取视频下载链接的API
    if (url.pathname === "/api/v1/douyin" && req.method === "POST") {
      try {
        const body: ShareLinkRequest = await req.json();

        if (!body.share_link) {
          const response = new Response(JSON.stringify({
            status: "error",
            error: "缺少 share_link 参数",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
          return addCorsHeaders(response);
        }

        const videoInfo = await getDouyinDownloadLink(body.share_link);

        const response = new Response(JSON.stringify({
          status: "success",
          video_id: videoInfo.video_id,
          title: videoInfo.title,
          download_url: videoInfo.url,
        }), {
          headers: { "Content-Type": "application/json" },
        });
        return addCorsHeaders(response);

      } catch (error) {
        const response = new Response(JSON.stringify({
          status: "error",
          error: error.message,
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
        return addCorsHeaders(response);
      }
    }

    // 视频代理端点 (已优化为 Stream 转发)
    if (url.pathname === "/api/v1/douyin/proxy" && req.method === "GET") {
      const videoURL = url.searchParams.get("url");

      if (!videoURL) {
        const response = new Response(JSON.stringify({
          error: "缺少URL参数",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
        return addCorsHeaders(response);
      }

      try {
        const videoResponse = await fetch(videoURL, {
          headers: {
            ...headers,
            // 确保 Referer 和 Origin 正确模拟以绕过部分抖音限制
            "Referer": "https://www.douyin.com/",
            "Origin": "https://www.douyin.com",
            "Accept": "*/*",
            // 转发 Range Header 以支持视频流拖拽
            "Range": req.headers.get("Range") || "",
          },
        });

        if (!videoResponse.ok || !videoResponse.body) {
          // 如果视频服务器拒绝连接或返回非 2xx 状态，抛出错误
          throw new Error(`视频获取失败: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        // 🚀 核心优化：使用 videoResponse.body (ReadableStream)
        const responseHeaders = new Headers(videoResponse.headers);
        
        // 转发所有关键响应头，并添加 CORS 支持
        responseHeaders.set("Content-Type", videoResponse.headers.get("Content-Type") || "video/mp4");
        // Content-Length 必须转发
        if (videoResponse.headers.get("Content-Length")) {
          responseHeaders.set("Content-Length", videoResponse.headers.get("Content-Length")!);
        }
        // Range 相关的头必须转发，以支持流式传输
        responseHeaders.set("Accept-Ranges", videoResponse.headers.get("Accept-Ranges") || "bytes");
        if (videoResponse.headers.get("Content-Range")) {
          responseHeaders.set("Content-Range", videoResponse.headers.get("Content-Range")!);
        }
        responseHeaders.set("Cache-Control", "public, max-age=3600");

        // 代理响应的 CORS 头
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Range");
        responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");


        // 直接返回 Stream，避免内存溢出
        return new Response(videoResponse.body, {
            status: videoResponse.status,
            statusText: videoResponse.statusText,
            headers: responseHeaders,
        });

      } catch (error) {
        const response = new Response(JSON.stringify({
          error: `代理请求失败或超时: ${error.message}`,
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
        return addCorsHeaders(response);
      }
    }

    // 404 - 未找到路径
    const notFoundResponse = new Response(JSON.stringify({
      error: "未找到请求的路径",
      available_endpoints: [
        "GET /",
        "POST /api/v1/douyin",
        "GET /api/v1/douyin/proxy",
      ],
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
    return addCorsHeaders(notFoundResponse);

  } catch (error) {
    const errorResponse = new Response(JSON.stringify({
      status: "error",
      error: `服务器内部错误: ${error.message}`,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    return addCorsHeaders(errorResponse);
  }
}

// 🚀 最终的启动逻辑：使用 Deno.serve()，Deno Deploy 自动接管 HTTP 端口。
Deno.serve(handler);