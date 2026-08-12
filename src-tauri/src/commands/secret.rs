/// API Key 安全存储：经系统 keychain（macOS Keychain / Linux Secret Service / Windows Credential Manager）。
fn entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("ppt-agent", key)
        .map_err(|e| format!("初始化密钥链失败: {e}"))
}

/// 读取密钥；不存在返回 None
#[tauri::command]
pub async fn secret_get(key: String) -> Result<Option<String>, String> {
    let entry = entry(&key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        // 「无密钥」不是错误
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取密钥失败: {e}")),
    }
}

/// 写入密钥
#[tauri::command]
pub async fn secret_set(key: String, value: String) -> Result<(), String> {
    let entry = entry(&key)?;
    entry
        .set_password(&value)
        .map_err(|e| format!("写入密钥失败: {e}"))
}

/// 删除密钥
#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), String> {
    let entry = entry(&key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("删除密钥失败: {e}")),
    }
}