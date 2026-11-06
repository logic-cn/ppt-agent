use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 响应体大小上限：导入的网页正文足够用，同时防止超大响应拖垮内存
const MAX_BODY_BYTES: usize = 20 * 1024 * 1024;

#[derive(Deserialize)]
pub struct ProxyRequest {
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    /// false 时不跟随重定向，把 3xx 状态与 Location 返回给前端，
    /// 由前端对每一跳重新做内网地址（SSRF）校验后再发起下一跳
    pub follow_redirects: Option<bool>,
}

#[derive(Serialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
    /// follow_redirects=false 且响应为 3xx 时的 Location 头
    pub location: Option<String>,
}

/// 代理 HTTP 请求，绕过浏览器 CORS 限制
/// 仅用于 Tauri 桌面环境中连接 LLM API
#[tauri::command]
pub async fn http_proxy(req: ProxyRequest) -> Result<ProxyResponse, String> {
    let mut builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(120));
    if !req.follow_redirects.unwrap_or(true) {
        builder = builder.redirect(reqwest::redirect::Policy::none());
    }
    let client = builder
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

    // 默认浏览器头：绕过部分站点对程序化请求的基础拦截（如 WAF/UA 校验）。
    // 调用方显式传入的 header 会覆盖以下默认值。
    let mut merged: HashMap<String, String> = HashMap::from([
        (
            "User-Agent".to_string(),
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) \
Gecko/20100101 Firefox/124.0"
                .to_string(),
        ),
        (
            "Accept".to_string(),
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,\
image/webp,*/*;q=0.8"
                .to_string(),
        ),
        (
            "Accept-Language".to_string(),
            "zh-CN,zh;q=0.9,en;q=0.8".to_string(),
        ),
    ]);
    if let Some(headers) = &req.headers {
        for (key, value) in headers {
            merged.insert(key.clone(), value.clone());
        }
    }

    // 设置 headers
    for (key, value) in &merged {
        if let (Ok(name), Ok(val)) = (
            reqwest::header::HeaderName::from_bytes(key.as_bytes()),
            reqwest::header::HeaderValue::from_str(value),
        ) {
            request_builder = request_builder.header(name, val);
        }
    }

    // 发送请求
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    let status = response.status().as_u16();

    // 重定向关闭时把 Location 带回给前端做逐跳校验
    let location = if status >= 300 && status < 400 {
        response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
    } else {
        None
    };

    // 响应体大小封顶：Content-Length 直接拒绝，流式读取时累计超限即中止
    if let Some(len) = response.content_length() {
        if len as usize > MAX_BODY_BYTES {
            return Err(format!(
                "响应体过大（{} 字节），超过 {} MB 上限",
                len,
                MAX_BODY_BYTES / (1024 * 1024)
            ));
        }
    }
    let mut body_bytes: Vec<u8> = Vec::new();
    let mut stream = response;
    while let Some(chunk) = stream
        .chunk()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?
    {
        if body_bytes.len() + chunk.len() > MAX_BODY_BYTES {
            return Err(format!(
                "响应体超过 {} MB 上限，已中止读取",
                MAX_BODY_BYTES / (1024 * 1024)
            ));
        }
        body_bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8_lossy(&body_bytes).into_owned();

    Ok(ProxyResponse {
        status,
        body,
        location,
    })
}
