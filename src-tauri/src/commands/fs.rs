use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 读取文本文件
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入二进制文件（原子写：tmp + rename）
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

/// 写入文本文件（原子写：tmp + rename）
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

/// 删除文件
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))
}

/// 列出目录中的文件名（过滤 .json）
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<String>, String> {
    // 目录不存在时自动创建（与 app_data_dir / write_* 行为一致），
    // 避免首次读取 themes/decks 等尚未生成的子目录时报 ENOENT
    if !PathBuf::from(&path).exists() {
        fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let entries =
        fs::read_dir(&path).map_err(|e| format!("读取目录失败: {}", e))?;
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
