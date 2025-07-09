# Vercel HTTP 代理部署方案

## 方案说明

使用 Vercel 的 Serverless Functions 和 Edge Functions 实现 HTTP 透明代理功能。

### 两种实现方式

1. **Serverless Function** (`/api/proxy`) - 更长执行时间
   - 免费版：最长 60 秒
   - Pro 版：最长 5 分钟
   - Enterprise：最长 15 分钟
   - 适合需要较长处理时间的请求

2. **Edge Function** (`/api/edge-proxy`) - 更快响应
   - 全球边缘部署，延迟更低
   - 执行时间限制较短（通常 30 秒内）
   - 适合快速 API 调用

### 功能特性

✅ **完整的代理功能**：
- 支持所有 HTTP 方法（GET, POST, PUT, DELETE 等）
- 透明转发请求头和请求体
- 自动处理重定向
- 流式传输响应
- CORS 支持

✅ **安全特性**：
- 清理隐私相关头部（X-Forwarded-For, X-Real-IP 等）
- 防止 Host 头污染

## 部署步骤

### 方法一：通过 Vercel CLI（推荐）

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **部署项目**
   ```bash
   vercel
   ```
   
   按照提示操作：
   - 登录 Vercel 账号
   - 选择项目名称
   - 确认部署

### 方法二：通过 GitHub 集成

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push origin vercel-deployment
   ```

2. **在 Vercel 导入项目**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "New Project"
   - 导入 GitHub 仓库
   - 选择 `vercel-deployment` 分支
   - 点击 "Deploy"

## 使用示例

部署后，假设你的项目 URL 是 `https://your-project.vercel.app`：

### 基础使用

```bash
# 使用 Serverless Function（更长执行时间）
curl 'https://your-project.vercel.app/api/proxy?url=https://httpbin.org/ip'

# 使用 Edge Function（更快响应）
curl 'https://your-project.vercel.app/api/edge-proxy?url=https://httpbin.org/ip'
```

### JavaScript 示例

```javascript
// GET 请求
const response = await fetch('https://your-project.vercel.app/api/proxy?url=https://api.github.com/users/github');
const data = await response.json();

// POST 请求
const response = await fetch('https://your-project.vercel.app/api/proxy?url=https://httpbin.org/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message: 'Hello World' })
});
```

### 使用建议

- **快速 API 调用**：使用 Edge Function (`/api/edge-proxy`)
- **大文件下载或慢速 API**：使用 Serverless Function (`/api/proxy`)
- **需要更长执行时间**：升级到 Pro 版获得 5 分钟执行时间

## 配置说明

### vercel.json 配置

```json
{
  "functions": {
    "api/proxy.js": {
      "maxDuration": 60  // 最大执行时间（秒）
    }
  }
}
```

### 环境变量

如需添加环境变量，可在 Vercel 控制台的 Settings → Environment Variables 中配置。

## 限制说明

1. **执行时间限制**
   - 免费版 Serverless：60 秒
   - Pro 版 Serverless：5 分钟
   - Edge Function：约 30 秒

2. **请求大小限制**
   - 请求体最大 4.5MB（Serverless）
   - Edge Function 限制更小

3. **并发限制**
   - 免费版有并发执行限制
   - Pro 版限制更宽松

4. **出口 IP**
   - 使用动态 IP 地址
   - 无法固定出口 IP

## 性能优化

1. **使用 Edge Function**：对于简单快速的请求，Edge Function 响应更快
2. **合理设置超时**：根据目标 API 的响应时间调整 maxDuration
3. **缓存策略**：可以配合 Vercel 的缓存功能提高性能

## 故障排查

1. **超时错误**：检查目标 URL 的响应时间，考虑使用更长的 maxDuration
2. **CORS 错误**：确保请求头中包含正确的 Origin
3. **大文件问题**：Edge Function 不适合大文件，使用 Serverless Function

## 对比 Netlify

| 特性 | Vercel | Netlify |
|-----|--------|---------|
| Serverless 执行时间 | 免费 60s / Pro 5分钟 | 26 秒 |
| Edge Function | 支持 | 支持 |
| 部署速度 | 极快 | 快 |
| 全球 CDN | ✅ | ✅ |
| 开发体验 | 优秀 | 良好 |

## 总结

Vercel 提供了比 Netlify 更长的执行时间（特别是付费版），更适合需要处理慢速请求的代理场景。同时保留了 Edge Function 选项用于快速响应的需求。