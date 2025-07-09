// Vercel Edge Function
// 优化版本：尝试增加 IP 变化可能性

export const config = {
  runtime: 'edge',
};

// 生成随机字符串
function generateRandomString(length) {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store'
      }
    });
  }

  // 处理 CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': '*',
        'cache-control': 'no-store'
      }
    });
  }

  try {
    // 生成请求唯一标识
    const requestId = generateRandomString(32);
    const timestamp = Date.now();
    
    // 修改目标 URL，添加随机参数防止缓存
    const targetUrlObj = new URL(targetUrl);
    targetUrlObj.searchParams.set('_edge_proxy_id', requestId);
    targetUrlObj.searchParams.set('_edge_proxy_ts', timestamp);
    
    // 准备请求头
    const headers = new Headers();
    
    // 只复制必要的头部
    const allowedHeaders = [
      'accept', 'accept-language', 'content-type', 
      'authorization', 'cookie', 'referer'
    ];
    
    for (const [key, value] of request.headers.entries()) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    
    // 设置自定义头部
    headers.set('host', targetUrlObj.hostname);
    headers.set('user-agent', `Edge-Proxy-${requestId}`);
    headers.set('cache-control', 'no-cache, no-store');
    headers.set('pragma', 'no-cache');
    headers.set('x-request-id', requestId);
    headers.set('connection', 'close');

    // 准备请求体
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    // 创建 AbortController 以强制新连接
    const controller = new AbortController();
    
    // 发起代理请求
    const proxyResponse = await fetch(targetUrlObj.toString(), {
      method: request.method,
      headers: headers,
      body: body,
      redirect: 'follow',
      signal: controller.signal,
      // Edge Function 特定选项
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      keepalive: false,
    });

    // 准备响应头
    const responseHeaders = new Headers();
    
    // 复制安全的响应头
    for (const [key, value] of proxyResponse.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    }
    
    // 添加 CORS 和调试头
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('cache-control', 'no-store, no-cache');
    responseHeaders.set('x-edge-proxy-request-id', requestId);
    responseHeaders.set('x-edge-proxy-timestamp', timestamp.toString());

    // 立即中止控制器，尝试防止连接复用
    setTimeout(() => {
      try {
        controller.abort();
      } catch (e) {
        // 忽略错误
      }
    }, 0);

    // 返回响应
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Edge proxy error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Proxy request failed',
      details: error.message 
    }), {
      status: 500,
      headers: { 
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store'
      }
    });
  }
}