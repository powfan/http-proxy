# HTTP透明代理

一个简单的HTTP透明代理服务。

## 使用

```bash
# 构建
./build.sh

# 运行
./main

# 使用代理
curl 'http://localhost:9000/?url=https://httpbin.org/ip'
```

## 说明

通过 `?url=` 参数指定要访问的目标地址，代理会返回目标地址的响应内容。