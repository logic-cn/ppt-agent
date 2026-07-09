use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 读取文本文件
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入文本文件
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    // 确保父目录存在
    if let Some(parent) = PathBuf::from(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
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
