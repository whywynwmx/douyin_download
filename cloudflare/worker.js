// Cloudflare Workers 生产版本 - 抖音下载服务

// 模拟移动浏览器的请求头
const headers = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "identity",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Referer": "https://www.douyin.com/",
  "Origin": "https://www.douyin.com",
};

// 获取抖音下载链接的核心逻辑
async function getDouyinDownloadLink(shareText) {
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
    redirect: "manual",
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

  // 处理gzip压缩的响应
  let html;
  const contentEncoding = pageResponse.headers.get("content-encoding");

  if (contentEncoding === "gzip") {
    try {
      const buffer = await pageResponse.arrayBuffer();
      html = new TextDecoder().decode(buffer);
    } catch (error) {
      html = await pageResponse.text();
    }
  } else {
    html = await pageResponse.text();
  }

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
  for (const pageData of Object.values(routerData.loaderData || {})) {
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

// CORS处理函数
function addCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Range");
  response.headers.set("Access-Control-Expose-Headers", "Content-Length");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

// 主处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理OPTIONS预检请求
    if (request.method === "OPTIONS") {
      const response = new Response(null, { status: 200 });
      return addCorsHeaders(response);
    }

    try {
      // 根路径 - 服务状态检查
      if (url.pathname === "/") {
        const response = new Response(JSON.stringify({
          status: "running",
          service: "douyin-downloader",
          version: "cloudflare-workers-prod",
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
      if (url.pathname === "/api/v1/douyin" && request.method === "POST") {
        try {
          const body = await request.json();

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

      // 视频代理端点
      if (url.pathname === "/api/v1/douyin/proxy" && request.method === "GET") {
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
              "Accept": "*/*",
              "Range": request.headers.get("Range") || "",
            },
          });

          if (!videoResponse.ok) {
            throw new Error(`视频获取失败: ${videoResponse.status}`);
          }

          const videoData = await videoResponse.arrayBuffer();

          const videoResponseObj = new Response(videoData, {
            status: videoResponse.status,
            headers: {
              "Content-Type": videoResponse.headers.get("Content-Type") || "video/mp4",
              "Content-Length": videoResponse.headers.get("Content-Length") || "",
              "Accept-Ranges": videoResponse.headers.get("Accept-Ranges") || "",
              "Content-Range": videoResponse.headers.get("Content-Range") || "",
              "Cache-Control": "public, max-age=3600",
            },
          });
          return addCorsHeaders(videoResponseObj);

        } catch (error) {
          const response = new Response(JSON.stringify({
            error: error.message,
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
  },
};