// Vercel Serverless Function (API Route)
// 优化版本：尽量增加 IP 变化可能性

import { randomBytes } from 'crypto';

export const config = {
  maxDuration: 60, // 最大执行时间（秒）
};

// 强制创建新的 fetch 实例
function createFetch() {
  // 每次请求使用新的 AbortController
  const controller = new AbortController();
  
  // 自定义 fetch 包装器
  return async (url, options) => {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // 关键设置：禁用连接复用
      keepalive: false,
      // 禁用 HTTP/2 多路复用
      cache: 'no-store',
      mode: 'no-cors',
      credentials: 'omit',
    });
    
    // 立即中止控制器，确保连接不被复用
    setTimeout(() => controller.abort(), 0);
    
    return response;
  };
}

export default async function handler(req, res) {
  // 启用 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // 添加无缓存头部
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // 为每个请求添加唯一标识，防止任何形式的缓存
    const requestId = randomBytes(16).toString('hex');
    const timestamp = Date.now();
    
    // 修改 URL 添加随机参数
    const url = new URL(targetUrl);
    url.searchParams.set('_proxy_id', requestId);
    url.searchParams.set('_proxy_ts', timestamp);
    
    // 准备请求头
    const headers = new Headers();
    
    // 复制必要的请求头
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (![
        'host', 'connection', 'keep-alive', 'transfer-encoding',
        'x-forwarded-for', 'x-real-ip', 'x-forwarded-proto',
        'x-forwarded-host', 'content-length'
      ].includes(lowerKey)) {
        headers.set(key, value);
      }
    }
    
    // 设置自定义头部以防止缓存
    headers.set('Host', url.hostname);
    headers.set('Cache-Control', 'no-cache');
    headers.set('Pragma', 'no-cache');
    headers.set('X-Request-ID', requestId);
    headers.set('X-Timestamp', timestamp);
    headers.set('User-Agent', `Vercel-Proxy-${requestId}`);
    headers.set('Connection', 'close'); // 强制关闭连接

    // 准备请求选项
    const fetchOptions = {
      method: req.method,
      headers: headers,
      redirect: 'follow',
    };

    // 处理请求体
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      fetchOptions.body = Buffer.concat(chunks);
    }

    // 使用自定义 fetch 发起请求
    const customFetch = createFetch();
    const response = await customFetch(url.toString(), fetchOptions);
    
    // 设置响应头
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lowerKey)) {
        responseHeaders[key] = value;
      }
    });

    // 添加调试信息
    responseHeaders['X-Proxy-Request-ID'] = requestId;
    responseHeaders['X-Proxy-Timestamp'] = timestamp;

    // 设置状态码和头部
    res.status(response.status);
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // 流式传输响应
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    res.end();
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed',
      details: error.message 
    });
  }
}