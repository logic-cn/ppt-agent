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

#[cfg(test)]
mod tests {
    use super::*;
    use keyring::{mock, set_default_credential_builder};

    /// mock 存储是 EntryOnly 持久化：同一 key 必须复用同一 Entry 实例。
    fn mock_entry(key: &str) -> Result<keyring::Entry, String> {
        set_default_credential_builder(mock::default_credential_builder());
        entry(key)
    }

    #[test]
    fn secret_set_get_roundtrip() {
        let e = mock_entry("provider/openai/api-key").unwrap();
        e.set_password("sk-test-123")
            .map_err(|e| format!("写入密钥失败: {e}"))
            .unwrap();
        assert_eq!(
            e.get_password()
                .map_err(|e| format!("读取密钥失败: {e}"))
                .unwrap(),
            "sk-test-123"
        );
    }

    #[test]
    fn secret_get_missing_returns_none() {
        let e = mock_entry("provider/never-set").unwrap();
        match e.get_password() {
            Err(keyring::Error::NoEntry) => {}
            other => panic!("expected NoEntry, got {other:?}"),
        }
    }

    #[test]
    fn secret_delete_removes_value() {
        let e = mock_entry("provider/openai/api-key").unwrap();
        e.set_password("sk-test-123").unwrap();
        e.delete_credential().unwrap();
        match e.get_password() {
            Err(keyring::Error::NoEntry) => {}
            other => panic!("expected NoEntry after delete, got {other:?}"),
        }
    }

    #[test]
    fn secret_delete_missing_returns_noentry() {
        let e = mock_entry("provider/absent").unwrap();
        assert!(matches!(
            e.delete_credential(),
            Err(keyring::Error::NoEntry)
        ));
    }
}