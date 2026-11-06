use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 词法规范化路径：解析 `..`/`.` 组件（目标可能尚不存在，无法用 canonicalize）。
/// 用于把调用方路径与允许根做统一口径的前缀比较。
fn normalize_path(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// 读/列/删约束在应用数据目录内：这些命令只服务于本地项目存储
/// （decks/palettes/settings/models），放开等于把用户主目录交给 webview。
fn ensure_within_app_data(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))?;
    let target = normalize_path(Path::new(path));
    let base_norm = normalize_path(&base);
    if !target.starts_with(&base_norm) {
        return Err(format!("路径越出应用数据目录，已拒绝: {path}"));
    }
    Ok(target)
}

/// 读取文本文件（仅限应用数据目录）
#[tauri::command]
pub fn read_text_file(app: AppHandle, path: String) -> Result<String, String> {
    let path = ensure_within_app_data(&app, &path)?;
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入二进制文件（原子写：tmp + rename）。
/// 写不强制目录约束：导出等场景的路径来自用户保存对话框（用户显式授权）。
#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    let tmp_path = format!("{}.tmp", &path);
    fs::write(&tmp_path, &data).map_err(|e| format!("写入临时文件失败: {}", e))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("重命名文件失败: {}", e))
}

/// 写入文本文件（原子写：tmp + rename）。写不强制目录约束（同 write_binary_file）。
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    let tmp_path = format!("{}.tmp", &path);
    fs::write(&tmp_path, &content).map_err(|e| format!("写入临时文件失败: {}", e))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("重命名文件失败: {}", e))
}

/// 删除文件（仅限应用数据目录）
#[tauri::command]
pub fn delete_file(app: AppHandle, path: String) -> Result<(), String> {
    let path = ensure_within_app_data(&app, &path)?;
    fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))
}

/// 列出目录中的文件名（过滤 .json），目录不存在时自动创建（仅限应用数据目录）
#[tauri::command]
pub fn list_directory(app: AppHandle, path: String) -> Result<Vec<String>, String> {
    let path = ensure_within_app_data(&app, &path)?;
    // 目录不存在时自动创建（与 app_data_dir / write_* 行为一致），
    // 避免首次读取 themes/decks 等尚未生成的子目录时报 ENOENT
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let entries = fs::read_dir(&path).map_err(|e| format!("读取目录失败: {}", e))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    Ok(files)
}

/// 获取应用数据目录（用于持久化项目、配置等）
#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
    }
    dir.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "数据目录路径无效".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_resolves_parent_and_curdir() {
        let p = normalize_path(Path::new("/data/app/sub/../decks/./x.json"));
        assert_eq!(p, PathBuf::from("/data/app/decks/x.json"));
        // 越出根的 .. 不会反向逃出盘符/根
        let escaped = normalize_path(Path::new("/data/app/../../etc"));
        assert!(!escaped.starts_with("/data/app"));
    }

    #[test]
    fn normalized_prefix_check_blocks_traversal() {
        let base = normalize_path(Path::new("/data/app"));
        let inside = normalize_path(Path::new("/data/app/decks/a.json"));
        let outside = normalize_path(Path::new("/data/app/../../Users/x/.ssh/id_rsa"));
        assert!(inside.starts_with(&base));
        assert!(!outside.starts_with(&base));
    }
}
