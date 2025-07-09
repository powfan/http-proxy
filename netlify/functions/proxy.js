const https = require('https');
const http = require('http');
const { URL } = require('url');

exports.handler = async (event) => {
  const targetUrl = event.queryStringParameters?.url;
  
  if (!targetUrl) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing url parameter' })
    };
  }

  try {
    const response = await proxyRequest(targetUrl, {
      method: event.httpMethod,
      headers: cleanHeaders(event.headers),
      body: event.body
    });

    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
      isBase64Encoded: response.isBase64Encoded
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function cleanHeaders(headers) {
  const cleaned = { ...headers };
  delete cleaned['x-forwarded-for'];
  delete cleaned['x-real-ip'];
  delete cleaned['x-forwarded-proto'];
  delete cleaned['x-forwarded-host'];
  delete cleaned['host'];
  delete cleaned['content-length'];
  return cleaned;
}

function proxyRequest(targetUrl, options) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method,
      headers: {
        ...options.headers,
        host: url.hostname
      },
      rejectUnauthorized: false // 等同于 Go 中的 InsecureSkipVerify
    };

    const req = protocol.request(reqOptions, (res) => {
      const chunks = [];
      
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const isBase64 = !isTextContent(res.headers['content-type']);
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: isBase64 ? body.toString('base64') : body.toString(),
          isBase64Encoded: isBase64
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(25000); // Netlify 函数最大执行时间
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function isTextContent(contentType) {
  if (!contentType) return true;
  return contentType.includes('text/') || 
         contentType.includes('application/json') ||
         contentType.includes('application/xml');
}