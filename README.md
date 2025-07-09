# Netlify 部署方案

## 方案说明

由于 Netlify 不支持长时间运行的服务器，我们提供了两种实现方案：

1. **Edge Functions**（推荐）：更快的响应速度，全球边缘部署
2. **Regular Functions**：更长的执行时间，适合慢速请求

### 方案对比

| 特性 | Edge Functions | Regular Functions | 原始 Go 版本 |
|-----|---------------|-------------------|------------|
| **响应速度** | 极快（边缘部署） | 快（有冷启动） | 快 |
| **执行时间** | 1-10 秒 | 最长 26 秒 | 无限制 |
| **全球分布** | ✅ 是 | ❌ 否 | ❌ 否 |
| **适合场景** | API 代理 | 复杂请求 | 所有场景 |
| **语言** | JavaScript | Node.js | Go |

### 选择建议

- **Edge Functions** (`/edge-proxy`)：适合快速 API 调用，延迟敏感的场景
- **Regular Functions** (`/api/proxy`)：适合需要较长处理时间的请求
- **Edge Functions Advanced** (`/edge-proxy-advanced`)：带超时控制和流式传输

### 功能对比

✅ **完全相同的功能**：
- 透明代理任意 URL
- 支持所有 HTTP 方法
- 转发请求头和请求体
- 清理隐私相关头部
- 支持 HTTPS（跳过证书验证）

⚠️ **限制**：
- 单个请求最长 26 秒
- 不适合大文件下载
- 每月有免费额度限制

## 部署步骤

1. **连接 GitHub 仓库到 Netlify**
   ```bash
   # 1. 将代码推送到 GitHub
   git add .
   git commit -m "Add Netlify deployment configuration"
   git push origin netlify-deployment
   ```

2. **在 Netlify 上创建新站点**
   - 登录 [Netlify](https://app.netlify.com)
   - 点击 "New site from Git"
   - 选择你的 GitHub 仓库
   - 选择 `netlify-deployment` 分支
   - 部署设置保持默认
   - 点击 "Deploy site"

3. **使用代理**
   ```bash
   # Edge Function (推荐，更快)
   curl 'https://your-site.netlify.app/edge-proxy?url=https://httpbin.org/ip'
   
   # Edge Function 高级版本（带超时控制）
   curl 'https://your-site.netlify.app/edge-proxy-advanced?url=https://httpbin.org/ip'
   
   # Regular Function (支持更长时间的请求)
   curl 'https://your-site.netlify.app/api/proxy?url=https://httpbin.org/ip'
   ```

## 使用示例

```javascript
// GET 请求
fetch('https://your-site.netlify.app/api/proxy?url=https://api.github.com/users/github')

// POST 请求
fetch('https://your-site.netlify.app/api/proxy?url=https://httpbin.org/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ test: 'data' })
})
```

## 注意事项

1. **免费额度**：Netlify Functions 每月有 125,000 次请求的免费额度
2. **执行时间**：超过 26 秒的请求会被终止
3. **日志**：可以在 Netlify 控制台查看函数执行日志
4. **环境变量**：如需配置，可在 Netlify 控制台设置

## 替代方案

如果 Netlify 的限制不满足需求，建议考虑：
- **Vercel**: 类似限制，但执行时间可达 60 秒（付费版）
- **Cloudflare Workers**: 更适合代理场景，执行时间限制更短
- **AWS Lambda**: 更灵活，可配置更长执行时间
- **VPS**: 完全控制，可运行原始 Go 版本