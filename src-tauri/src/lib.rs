use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

/// Każdy klucz zapisu to osobny plik w %APPDATA%/<app>/save/<hex(klucz)>.json.
/// Zapis atomowy: plik tymczasowy -> fsync -> rename, więc przerwanie zapisu
/// (crash, wyłączenie prądu) nigdy nie zostawia uszkodzonego pliku.
fn save_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("save");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn encode_key(key: &str) -> String {
    key.bytes().map(|b| format!("{:02x}", b)).collect()
}

fn decode_key(name: &str) -> Option<String> {
    if name.len() % 2 != 0 { return None; }
    let bytes: Option<Vec<u8>> = (0..name.len()).step_by(2)
        .map(|i| u8::from_str_radix(&name[i..i + 2], 16).ok())
        .collect();
    bytes.and_then(|b| String::from_utf8(b).ok())
}

#[tauri::command]
fn store_load_all(app: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let dir = save_dir(&app)?;
    let mut out = HashMap::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else { continue };
        let Some(key) = decode_key(stem) else { continue };
        if let Ok(value) = fs::read_to_string(&path) { out.insert(key, value); }
    }
    Ok(out)
}

#[tauri::command]
fn store_write(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let dir = save_dir(&app)?;
    let name = encode_key(&key);
    let tmp = dir.join(format!("{}.tmp", name));
    let target = dir.join(format!("{}.json", name));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(value.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &target).map_err(|e| e.to_string())
}

#[tauri::command]
fn store_remove(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let target = save_dir(&app)?.join(format!("{}.json", encode_key(&key)));
    if target.exists() { fs::remove_file(target).map_err(|e| e.to_string())?; }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![store_load_all, store_write, store_remove])
        .run(tauri::generate_context!())
        .expect("error while running ACSR PORTAL");
}
