use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct ProxyRequest {
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Serialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
}

/// 代理 HTTP 请求，绕过浏览器 CORS 限制
/// 仅用于 Tauri 桌面环境中连接 LLM API
#[tauri::command]
pub async fn http_proxy(req: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut request_builder = match req.method.to_uppercase().as_str() {
        "GET" => client.get(&req.url),
        "POST" => {
            let mut b = client.post(&req.url);
            if let Some(body) = &req.body {
                b = b.body(body.clone());
            }
            b
        }
        _ => return Err(format!("不支持的 HTTP 方法: {}", req.method)),
    };

    // 设置 headers
    if let Some(headers) = &req.headers {
        for (key, value) in headers {
            if let (Ok(name), Ok(val)) = (
                reqwest::header::HeaderName::from_bytes(key.as_bytes()),
                reqwest::header::HeaderValue::from_str(value),
            ) {
                request_builder = request_builder.header(name, val);
            }
        }
    }

    // 发送请求
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    Ok(ProxyResponse { status, body })
}