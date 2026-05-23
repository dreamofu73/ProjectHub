#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize, Deserialize, Default, Clone)]
struct AppConfig {
    backend_url: Option<String>,
}

struct ConfigState {
    config: Mutex<AppConfig>,
    config_path: Mutex<Option<PathBuf>>,
}

/// Returns the stored backend server URL, or `None` if not yet configured.
#[tauri::command]
fn get_backend_url(state: tauri::State<'_, ConfigState>) -> Result<Option<String>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.backend_url.clone())
}

/// Stores the backend server URL and persists it to disk.
#[tauri::command]
fn set_backend_url(
    state: tauri::State<'_, ConfigState>,
    url: String,
) -> Result<(), String> {
    // Snapshot the config path while holding the path lock briefly
    let path = state.config_path.lock().map_err(|e| e.to_string())?.clone();

    // Update in-memory config and serialize in a single lock
    let json = {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.backend_url = Some(url);
        serde_json::to_string_pretty(&*config).map_err(|e| e.to_string())?
    };

    // Persist to disk
    if let Some(ref p) = path {
        std::fs::write(p, json).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn load_config(path: &PathBuf) -> AppConfig {
    match std::fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data directory");

            let config_path = app_data_dir.join("config.json");
            let config = load_config(&config_path);

            app.manage(ConfigState {
                config: Mutex::new(config),
                config_path: Mutex::new(Some(config_path)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_url, set_backend_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
