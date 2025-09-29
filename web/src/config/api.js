// API配置文件
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8080',
  ENDPOINTS: {
    DOUYIN_ANALYZE: '/api/v1/douyin',
    DOUYIN_PROXY: '/api/v1/douyin/proxy'
  }
};

// 便利函数来构建完整URL
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// 特定的API URL构建函数
export const getDouyinAnalyzeUrl = () => getApiUrl(API_CONFIG.ENDPOINTS.DOUYIN_ANALYZE);
export const getDouyinProxyUrl = (videoUrl) => {
  return `${getApiUrl(API_CONFIG.ENDPOINTS.DOUYIN_PROXY)}?url=${encodeURIComponent(videoUrl)}`;
};