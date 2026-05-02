use std::fs::File;
use std::io::Write;
use tauri::Runtime;

#[tauri::command]
pub async fn save_file<R: Runtime>(
    _app: tauri::AppHandle<R>,
    path: String,
    content: String,
) -> Result<(), String> {
    let mut file = File::create(path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}
