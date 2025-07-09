// Vercel Edge Function
// 更快的响应速度，全球边缘部署，但执行时间限制更短

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 
        'content-type': 'application/json',
        'access-control-allow-origin': '*'
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
      }
    });
  }

  try {
    // 准备请求头
    const headers = new Headers(request.headers);
    
    // 清理敏感头部
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');
    headers.delete('x-forwarded-proto');
    headers.delete('x-forwarded-host');
    headers.delete('host');
    
    // 设置目标主机
    const targetUrlObj = new URL(targetUrl);
    headers.set('host', targetUrlObj.hostname);

    // 准备请求体
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    // 发起代理请求
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
      redirect: 'follow',
    });

    // 准备响应头
    const responseHeaders = new Headers(proxyResponse.headers);
    
    // 添加 CORS 头
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // 移除可能导致问题的头部
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

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
        'access-control-allow-origin': '*'
      }
    });
  }
}