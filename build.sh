#!/bin/bash

# 设置交叉编译环境变量
export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64

# 清理旧文件
rm -f main
rm -f http-proxy.zip

# 编译
go build -ldflags="-s -w" -o main main.go

if [ $? -ne 0 ]; then
    echo "编译失败"
    exit 1
fi

# 设置权限
chmod +x main

# 创建部署包
zip -r http-proxy.zip main

echo "构建完成: http-proxy.zip"