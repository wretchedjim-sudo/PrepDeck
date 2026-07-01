use std::time::Duration;

#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("PrepDeck/0.1")
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|error| format!("Could not create web client: {error}"))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Could not fetch URL: {error}"))?;

    let status = response.status();

    if !status.is_success() {
        return Err(format!("Request failed with status {status}"));
    }

    response
        .text()
        .await
        .map_err(|error| format!("Could not read response text: {error}"))
}



#[tauri::command]
fn save_prep_sheet_html(file_name: String, contents: String) -> Result<String, String> {
    let home = std::env::var("HOME")
        .map_err(|error| format!("Could not find home folder: {error}"))?;

    let safe_name: String = file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '-'
                || character == '_'
                || character == '.'
            {
                character
            } else {
                '-'
            }
        })
        .collect();

    let mut folder = std::path::PathBuf::from(home);
    folder.push("Documents");
    folder.push("PrepDeck");

    std::fs::create_dir_all(&folder)
        .map_err(|error| format!("Could not create PrepDeck folder: {error}"))?;

    folder.push(safe_name);

    std::fs::write(&folder, contents)
        .map_err(|error| format!("Could not save prep sheet: {error}"))?;

    Ok(folder.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_url, save_prep_sheet_html])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
