use tauri::Manager;

pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(commands::local_llm::LocalLlmState::default())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text_file,
            commands::fs::write_text_file,
            commands::fs::write_binary_file,
            commands::fs::list_directory,
            commands::fs::delete_file,
            commands::fs::app_data_dir,
            commands::secret::secret_get,
            commands::secret::secret_set,
            commands::secret::secret_delete,
            commands::http::http_proxy,
            commands::local_llm::local_llm_load,
            commands::local_llm::local_llm_chat,
            commands::local_llm::local_llm_cancel,
            commands::local_llm::local_llm_unload,
            commands::local_llm::local_llm_status,
            commands::model_manager::model_download,
            commands::model_manager::model_installed,
            commands::model_manager::model_delete,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
