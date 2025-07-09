// Vercel Serverless Function (API Route)
// 支持更长的执行时间（免费版最长60秒，Pro版最长5分钟）

export const config = {
  maxDuration: 60, // 最大执行时间（秒）
};

export default async function handler(req, res) {
  // 启用 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const headers = { ...req.headers };
    // 清理敏感头部
    delete headers['x-forwarded-for'];
    delete headers['x-real-ip'];
    delete headers['x-forwarded-proto'];
    delete headers['x-forwarded-host'];
    delete headers['host'];
    delete headers['content-length'];
    
    // 设置目标主机
    const url = new URL(targetUrl);
    headers.host = url.hostname;

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

    // 发起代理请求
    const response = await fetch(targetUrl, fetchOptions);
    
    // 设置响应头
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      // 跳过某些头部以避免冲突
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

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