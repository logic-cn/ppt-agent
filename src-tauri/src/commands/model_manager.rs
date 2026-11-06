use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const PROGRESS_EVENT: &str = "model-download-progress";
const PROGRESS_MIN_INTERVAL_MS: u64 = 200;

/// 下载取消标志：由 model_download_cancel 置位，下载循环逐块检查。
/// 取消时保留 .part 断点文件，下次下载可续传。
static DOWNLOAD_CANCEL: AtomicBool = AtomicBool::new(false);

/// 下载互斥锁（try_lock）：防止两个并发 model_download 向同一 .part 交错写入
static DOWNLOAD_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// 随模型保存的许可声明（Apache-2.0 + llama.cpp MIT 第三方清单）
const MODEL_NOTICE: &str = include_str!("../../assets/model-notice.txt");

#[derive(Deserialize)]
pub struct DownloadOptions {
    /// 依次尝试的下载地址（主源失败自动切换到下一个）
    pub urls: Vec<String>,
    pub file_name: String,
    /// 小写十六进制 sha256
    pub sha256: String,
    /// 期望文件大小（字节）：用于磁盘剩余空间预检；缺省时跳过预检
    pub expected_size_bytes: Option<u64>,
}

#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    pub file_name: String,
    pub source_index: usize,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub phase: String, // "downloading" | "verifying"
}

#[derive(Serialize, Clone)]
pub struct DownloadResult {
    pub path: String,
    pub size_bytes: u64,
    pub source_index: usize,
}

#[derive(Serialize, Clone)]
pub struct InstalledInfo {
    pub path: String,
    pub size_bytes: u64,
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))?
        .join("models");
    Ok(dir)
}

/// 只允许纯文件名，防止路径穿越
fn sanitize_file_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name.starts_with('.')
    {
        return Err(format!("非法文件名: {name}"));
    }
    Ok(())
}

fn emit_progress(app: &AppHandle, p: &DownloadProgress) {
    let _ = app.emit(PROGRESS_EVENT, p);
}

fn encode_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// 模型校验通过后确保同目录存在许可声明文件（幂等，不覆盖已有文件）
async fn ensure_license_file(dir: &Path, file_name: &str) {
    let license = dir.join(format!("{file_name}.LICENSE.txt"));
    if !license.exists() {
        let _ = fs::write(&license, MODEL_NOTICE).await;
    }
}

async fn sha256_of_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .await
        .map_err(|e| format!("打开文件失败: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| format!("读取文件失败: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(encode_hex(&hasher.finalize()))
}

async fn try_download_one(
    app: &AppHandle,
    url: &str,
    source_index: usize,
    file_name: &str,
    part: &Path,
    total_hint: Option<u64>,
) -> Result<(), String> {
    let existing = fs::metadata(part).await.map(|m| m.len()).unwrap_or(0);

    let mut request = reqwest::Client::builder()
        .user_agent(concat!(
            env!("CARGO_PKG_NAME"),
            "/",
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?
        .get(url);

    if existing > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={existing}-"));
    }

    let resp = request.send().await.map_err(|e| format!("请求失败: {e}"))?;
    let status = resp.status();

    // 416 = 断点已到文件末尾但文件其实可能完整：保留 .part 交由调用方
    // 做 sha256 复核，完整则直接转正，不完整才换源重下
    if status.as_u16() == 416 && existing > 0 {
        return Err("PART_MAYBE_COMPLETE".into());
    }

    // 续传被拒绝（返回 200 全量）时从头下载
    let mut written = existing;
    let append = status.as_u16() == 206;
    if status.as_u16() == 200 && existing > 0 {
        written = 0;
    }
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }

    // 续传必须核对 Content-Range 起点 == 本地断点：行为异常的服务器
    // 返回错位 206 会拼出损坏文件（只靠最终 sha256 兜底会浪费整次下载）
    if append {
        let start_ok = resp
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split('/').next())
            .and_then(|r| r.strip_prefix("bytes "))
            .and_then(|r| r.split('-').next())
            .and_then(|s| s.parse::<u64>().ok())
            .map(|start| start == existing)
            .unwrap_or(false);
        if !start_ok {
            return Err("CONTENT_RANGE_MISMATCH".into());
        }
    }

    let total = resp
        .content_length()
        .map(|len| if append { len + existing } else { len })
        .or(total_hint);

    let mut file = if append {
        fs::OpenOptions::new()
            .append(true)
            .open(part)
            .await
            .map_err(|e| format!("打开断点文件失败: {e}"))?
    } else {
        fs::File::create(part)
            .await
            .map_err(|e| format!("创建下载文件失败: {e}"))?
    };

    emit_progress(
        app,
        &DownloadProgress {
            file_name: file_name.into(),
            source_index,
            downloaded: written,
            total,
            phase: "downloading".into(),
        },
    );

    let mut stream = resp.bytes_stream();
    let mut last_emit = Instant::now();
    while let Some(chunk) = stream.next().await {
        if DOWNLOAD_CANCEL.load(Ordering::Relaxed) {
            return Err("DOWNLOAD_CANCELLED".into());
        }
        let chunk = chunk.map_err(|e| format!("下载中断: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入失败: {e}"))?;
        written += chunk.len() as u64;
        if last_emit.elapsed().as_millis() as u64 >= PROGRESS_MIN_INTERVAL_MS {
            last_emit = Instant::now();
            emit_progress(
                app,
                &DownloadProgress {
                    file_name: file_name.into(),
                    source_index,
                    downloaded: written,
                    total,
                    phase: "downloading".into(),
                },
            );
        }
    }
    file.flush().await.map_err(|e| format!("落盘失败: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn model_download(
    app: AppHandle,
    opts: DownloadOptions,
) -> Result<DownloadResult, String> {
    if opts.urls.is_empty() {
        return Err("下载地址列表为空".into());
    }
    sanitize_file_name(&opts.file_name)?;
    let expected = opts.sha256.trim().to_lowercase();
    if expected.len() != 64 {
        return Err("sha256 校验值格式错误".into());
    }

    // 并发防重：同一时间只允许一个下载任务（否则两个流交错写同一 .part）
    let _guard = match DOWNLOAD_LOCK.try_lock() {
        Ok(g) => g,
        Err(_) => return Err("已有下载任务进行中".into()),
    };
    DOWNLOAD_CANCEL.store(false, Ordering::Relaxed);

    let dir = models_dir(&app)?;
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("创建模型目录失败: {e}"))?;
    let dest = dir.join(&opts.file_name);
    let part = dir.join(format!("{}.part", opts.file_name));

    // 磁盘剩余空间预检：1.5 GB 模型下到一半失败只剩一个含糊的写错误
    if let Some(expected_size) = opts.expected_size_bytes {
        if let Some(parent) = part.parent() {
            if let Ok(avail) = fs2::available_space(parent) {
                if avail < expected_size + 512 * 1024 * 1024 {
                    return Err(format!(
                        "磁盘剩余空间不足（需约 {} MB，含余量；仅剩 {} MB）",
                        (expected_size + 512 * 1024 * 1024) / 1024 / 1024,
                        avail / 1024 / 1024
                    ));
                }
            }
            // 无法查询时跳过预检，交由写盘错误兜底
        }
    }

    if dest.exists() {
        let sum = sha256_of_file(&dest).await?;
        if sum == expected {
            let size = fs::metadata(&dest).await.map_err(|e| e.to_string())?.len();
            ensure_license_file(&dir, &opts.file_name).await;
            return Ok(DownloadResult {
                path: dest.to_string_lossy().into_owned(),
                size_bytes: size,
                source_index: usize::MAX,
            });
        }
        // 已存在但校验失败：删除重下
        let _ = fs::remove_file(&dest).await;
    }

    let mut last_err = String::from("无可用下载源");
    for (idx, url) in opts.urls.iter().enumerate() {
        match try_download_one(&app, url, idx, &opts.file_name, &part, None).await {
            Ok(()) => {
                emit_progress(
                    &app,
                    &DownloadProgress {
                        file_name: opts.file_name.clone(),
                        source_index: idx,
                        downloaded: 0,
                        total: None,
                        phase: "verifying".into(),
                    },
                );
                let sum = sha256_of_file(&part).await?;
                if sum != expected {
                    let _ = fs::remove_file(&part).await;
                    last_err = format!("来源 {idx} 校验失败（sha256 不匹配），已换源");
                    continue;
                }
                fs::rename(&part, &dest)
                    .await
                    .map_err(|e| format!("移动文件失败: {e}"))?;
                let size = fs::metadata(&dest).await.map_err(|e| e.to_string())?.len();
                ensure_license_file(&dir, &opts.file_name).await;
                return Ok(DownloadResult {
                    path: dest.to_string_lossy().into_owned(),
                    size_bytes: size,
                    source_index: idx,
                });
            }
            Err(e) => {
                if e == "DOWNLOAD_CANCELLED" {
                    // 用户取消：保留 .part 断点，下次下载续传
                    return Err("下载已取消".into());
                }
                if e == "PART_MAYBE_COMPLETE" {
                    // 断点已到 EOF：.part 可能已完整，sha256 复核通过则直接转正
                    if let Ok(sum) = sha256_of_file(&part).await {
                        if sum == expected {
                            fs::rename(&part, &dest)
                                .await
                                .map_err(|e| format!("移动文件失败: {e}"))?;
                            let size = fs::metadata(&dest).await.map_err(|e| e.to_string())?.len();
                            ensure_license_file(&dir, &opts.file_name).await;
                            return Ok(DownloadResult {
                                path: dest.to_string_lossy().into_owned(),
                                size_bytes: size,
                                source_index: idx,
                            });
                        }
                    }
                    let _ = fs::remove_file(&part).await;
                    last_err = format!("来源 {idx} 断点复核失败，已换源");
                    continue;
                }
                // 其余错误删掉断点防止跨源混拼损坏文件
                let _ = fs::remove_file(&part).await;
                last_err = format!("来源 {idx} 失败: {e}");
            }
        }
    }
    Err(last_err)
}

/// 取消进行中的下载：置位取消标志，下载循环逐块检查后自行退出。
/// .part 断点保留，下次下载可续传。
#[tauri::command]
pub fn model_download_cancel() {
    DOWNLOAD_CANCEL.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub async fn model_installed(
    app: AppHandle,
    file_name: String,
) -> Result<Option<InstalledInfo>, String> {
    sanitize_file_name(&file_name)?;
    let dest = models_dir(&app)?.join(&file_name);
    match fs::metadata(&dest).await {
        Ok(m) => Ok(Some(InstalledInfo {
            path: dest.to_string_lossy().into_owned(),
            size_bytes: m.len(),
        })),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn model_delete(app: AppHandle, file_name: String) -> Result<bool, String> {
    sanitize_file_name(&file_name)?;
    let dir = models_dir(&app)?;
    let dest = dir.join(&file_name);
    let part = dir.join(format!("{}.part", file_name));
    let mut removed = false;
    if dest.exists() {
        fs::remove_file(&dest)
            .await
            .map_err(|e| format!("删除失败: {e}"))?;
        removed = true;
    }
    if part.exists() {
        let _ = fs::remove_file(part).await;
        removed = true;
    }
    let license = dir.join(format!("{file_name}.LICENSE.txt"));
    if license.exists() {
        let _ = fs::remove_file(license).await;
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("ppt-agent-mm-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sanitize_rejects_traversal_and_separators() {
        assert!(sanitize_file_name("ok-file_v1.gguf").is_ok());
        assert!(sanitize_file_name("../evil.gguf").is_err());
        assert!(sanitize_file_name("a/b.gguf").is_err());
        assert!(sanitize_file_name("a\\b.gguf").is_err());
        assert!(sanitize_file_name(".hidden").is_err());
        assert!(sanitize_file_name("").is_err());
    }

    #[test]
    fn encode_hex_matches_lowercase_sha256_form() {
        assert_eq!(encode_hex(&[0x0a, 0xff, 0x00]), "0aff00");
    }

    #[tokio::test]
    async fn sha256_of_file_computes_known_digest() {
        let dir = temp_dir("sha");
        let f = dir.join("hello.txt");
        fs::write(&f, b"hello").await.unwrap();
        assert_eq!(
            sha256_of_file(&f).await.unwrap(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn ensure_license_file_writes_once_and_never_clobbers() {
        let dir = temp_dir("lic");
        let name = "MiniCPM5-2B-Q4_K_M.gguf";
        ensure_license_file(&dir, name).await;
        let lic = dir.join(format!("{name}.LICENSE.txt"));
        assert!(lic.exists());
        // 用户改过的内容不被覆盖
        fs::write(&lic, "custom").await.unwrap();
        ensure_license_file(&dir, name).await;
        assert_eq!(fs::read_to_string(&lic).await.unwrap(), "custom");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
