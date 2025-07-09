// 高级版本：支持流式传输和更好的错误处理
export default async (request, context) => {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  // 验证 URL 格式
  try {
    new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    // 准备请求头
    const headers = new Headers();
    
    // 复制必要的请求头
    const allowedHeaders = [
      'accept',
      'accept-language',
      'content-type',
      'user-agent',
      'authorization',
      'cookie'
    ];
    
    for (const [key, value] of request.headers.entries()) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    
    // 设置目标主机
    const targetUrlObj = new URL(targetUrl);
    headers.set('host', targetUrlObj.hostname);

    // 获取请求体（如果有）
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    try {
      // 转发请求
      const proxyResponse = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: body,
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 准备响应头
      const responseHeaders = new Headers();
      
      // 复制安全的响应头
      const safeResponseHeaders = [
        'content-type',
        'cache-control',
        'expires',
        'last-modified',
        'etag'
      ];
      
      for (const [key, value] of proxyResponse.headers.entries()) {
        if (safeResponseHeaders.includes(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      }
      
      // 添加 CORS 头
      responseHeaders.set('access-control-allow-origin', '*');
      responseHeaders.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('access-control-allow-headers', '*');

      // 处理 OPTIONS 请求
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: responseHeaders
        });
      }

      // 返回流式响应
      return new Response(proxyResponse.body, {
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout',
          details: 'The proxy request took too long to complete'
        }), {
          status: 504,
          headers: { 'content-type': 'application/json' }
        });
      }
      
      throw error;
    }

  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Proxy request failed',
      details: error.message 
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
};

export const config = {
  path: "/edge-proxy-advanced"
};