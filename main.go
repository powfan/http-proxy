package main

import (
	"crypto/tls"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// 创建新的HTTP客户端 - 每次请求都创建新的，模拟Python的行为
func createNewClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
			MaxIdleConns:          0,    // 禁用连接池复用
			MaxIdleConnsPerHost:   0,    // 禁用每主机连接复用  
			IdleConnTimeout:       1 * time.Second,  // 快速释放连接
			DisableKeepAlives:     true, // 禁用Keep-Alive，强制新连接
			DisableCompression:    false,
			ResponseHeaderTimeout: 30 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

// transparentProxy 极限性能代理
func transparentProxy(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	
	// 快速获取URL参数 - 避免解析整个query
	query := r.URL.RawQuery
	if len(query) < 5 || query[:4] != "url=" { // 最快的前缀检查
		http.Error(w, "Missing 'url' parameter", http.StatusBadRequest)
		return
	}
	
	// 直接提取URL，避免url.ParseQuery的开销
	targetURL, err := url.QueryUnescape(query[4:]) // 跳过"url="
	if err != nil {
		http.Error(w, "Invalid URL encoding", http.StatusBadRequest)
		return
	}
	
	// 直接创建请求，让Go自己验证URL
	proxyReq, err := http.NewRequest(r.Method, targetURL, r.Body)
	if err != nil {
		http.Error(w, "Invalid request", http.StatusInternalServerError)
		return
	}
	
	// 复制请求头，但过滤掉暴露真实IP的头部
	proxyReq.Header = make(http.Header)
	for key, values := range r.Header {
		// 删除暴露真实IP的头部
		lowerKey := strings.ToLower(key)
		if lowerKey == "x-forwarded-for" || 
		   lowerKey == "x-real-ip" || 
		   lowerKey == "x-forwarded-proto" ||
		   lowerKey == "x-forwarded-host" {
			continue
		}
		proxyReq.Header[key] = values
	}
	
	// 设置Host头 - 从URL中快速提取
	if u, err := url.Parse(targetURL); err == nil {
		proxyReq.Header.Set("Host", u.Host)
	}
	
	// 每次请求创建新的客户端 - 模拟Python的urllib3.PoolManager()
	client := createNewClient()
	
	// 发送请求
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, "Request failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	
	// 快速复制响应头 - 直接赋值
	respHeader := w.Header()
	for key, values := range resp.Header {
		respHeader[key] = values
	}
	
	// 设置状态码
	w.WriteHeader(resp.StatusCode)
	
	// 直接复制响应体 - 零拷贝
	io.Copy(w, resp.Body)
	
	// 记录请求处理时间
	duration := time.Since(startTime)
	log.Printf("Request to %s completed in %v", targetURL, duration)
}

// healthCheck 精简健康检查
func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`)) // 直接写字节，避免fmt.Fprintf
}

func main() {
	port := os.Getenv("FC_SERVER_PORT")
	if port == "" {
		port = "9000"
	}
	
	// 精简的路由设置
	mux := http.NewServeMux()
	mux.HandleFunc("/", transparentProxy)
	mux.HandleFunc("/health", healthCheck)
	
	log.Printf("🚀 High-Performance HTTP Proxy on port %s", port)
	
	// 高性能服务器配置
	server := &http.Server{
		Addr:           ":" + port,
		Handler:        mux,
		ReadTimeout:    15 * time.Second,  // 减少超时
		WriteTimeout:   15 * time.Second,  // 减少超时
		IdleTimeout:    30 * time.Second,  // 减少空闲超时
		MaxHeaderBytes: 1 << 16,           // 64KB头部限制
	}
	
	log.Fatal(server.ListenAndServe())
}