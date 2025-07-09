export default async (request, context) => {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    // 清理请求头
    const headers = new Headers(request.headers);
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');
    headers.delete('x-forwarded-proto');
    headers.delete('x-forwarded-host');
    headers.delete('host');
    
    // 设置目标主机
    const targetUrlObj = new URL(targetUrl);
    headers.set('host', targetUrlObj.hostname);

    // 转发请求
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.arrayBuffer() 
        : undefined,
      redirect: 'follow'
    });

    // 创建响应
    const responseHeaders = new Headers(proxyResponse.headers);
    responseHeaders.delete('content-encoding'); // 避免编码问题
    
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders
    });

  } catch (error) {
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
  path: "/edge-proxy"
};