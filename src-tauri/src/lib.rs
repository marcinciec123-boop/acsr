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

// ===== Grafiki (loga, zdjęcia) =====
// Każda grafika to zwykły plik binarny w %APPDATA%/<app>/media/<hex(klucz)>.<ext>,
// o ~1/3 mniejszy niż Base64. Nie jest wczytywana przy starcie aplikacji —
// tylko na żądanie, gdy pojawia się na ekranie.
const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn b64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(B64[(n >> 18) as usize & 63] as char);
        out.push(B64[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { B64[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { B64[n as usize & 63] as char } else { '=' });
    }
    out
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A', b'a'..=b'z' => c - b'a' + 26, b'0'..=b'9' => c - b'0' + 52,
            b'+' | b'-' => 62, b'/' | b'_' => 63, b'=' | b'\n' | b'\r' | b' ' => continue, _ => return None,
        };
        acc = (acc << 6) | v as u32;
        bits += 6;
        if bits >= 8 { bits -= 8; out.push((acc >> bits) as u8); }
    }
    Some(out)
}

const MEDIA_EXT: [(&str, &str); 6] = [
    ("webp", "image/webp"), ("png", "image/png"), ("jpg", "image/jpeg"),
    ("gif", "image/gif"), ("svg", "image/svg+xml"), ("bin", "application/octet-stream"),
];

fn media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("media");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn media_find(dir: &PathBuf, name: &str) -> Option<(PathBuf, &'static str)> {
    MEDIA_EXT.iter().map(|(ext, mime)| (dir.join(format!("{}.{}", name, ext)), *mime)).find(|(p, _)| p.exists())
}

fn media_remove_all(dir: &PathBuf, name: &str) {
    for (ext, _) in MEDIA_EXT.iter() { let _ = fs::remove_file(dir.join(format!("{}.{}", name, ext))); }
}

fn to_data_url(path: &PathBuf, mime: &str) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    Some(format!("data:{};base64,{}", mime, b64_encode(&bytes)))
}

#[tauri::command]
fn media_write(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let dir = media_dir(&app)?;
    let name = encode_key(&key);
    let (mime, bytes) = match value.strip_prefix("data:").and_then(|r| r.split_once(";base64,")) {
        Some((mime, data)) => (mime.to_string(), b64_decode(data).ok_or("invalid base64")?),
        None => ("application/octet-stream".to_string(), value.into_bytes()),
    };
    let ext = MEDIA_EXT.iter().find(|(_, m)| *m == mime).map(|(e, _)| *e).unwrap_or("bin");
    let tmp = dir.join(format!("{}.tmp", name));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    media_remove_all(&dir, &name);
    fs::rename(&tmp, dir.join(format!("{}.{}", name, ext))).map_err(|e| e.to_string())
}

#[tauri::command]
fn media_read(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let dir = media_dir(&app)?;
    Ok(media_find(&dir, &encode_key(&key)).and_then(|(p, mime)| to_data_url(&p, mime)))
}

#[tauri::command]
fn media_remove(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let dir = media_dir(&app)?;
    media_remove_all(&dir, &encode_key(&key));
    Ok(())
}

/// Pełna lista grafik — tylko do kopii zapasowych.
#[tauri::command]
fn media_load_all(app: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let dir = media_dir(&app)?;
    let mut out = HashMap::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else { continue };
        let Some((_, mime)) = MEDIA_EXT.iter().find(|(e, _)| *e == ext) else { continue };
        let Some(key) = path.file_stem().and_then(|s| s.to_str()).and_then(decode_key) else { continue };
        if let Some(url) = to_data_url(&path, mime) { out.insert(key, url); }
    }
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![store_load_all, store_write, store_remove,
            media_write, media_read, media_remove, media_load_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ACSR PORTAL");
}
