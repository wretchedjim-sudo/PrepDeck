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
async fn ollama_generate(prompt: String, model: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(240))
        .build()
        .map_err(|error| format!("Could not create local AI client: {error}"))?;

    let selected_model = choose_ollama_model(&client, &model).await?;

    let payload = serde_json::json!({
        "model": selected_model,
        "prompt": prompt,
        "stream": false,
        "options": {
            "temperature": 0.9,
            "top_p": 0.92,
            "repeat_penalty": 1.15,
            "num_ctx": 8192,
            "num_predict": 2200
        }
    });

    let response = client
        .post("http://127.0.0.1:11434/api/generate")
        .header("Content-Type", "application/json")
        .body(payload.to_string())
        .send()
        .await
        .map_err(|error| format!("Could not reach local AI at 127.0.0.1:11434: {error}"))?;

    let status = response.status();

    let response_text = response
        .text()
        .await
        .map_err(|error| format!("Could not read local AI response: {error}"))?;

    if !status.is_success() {
        return Err(format!("Local AI returned {status}: {response_text}"));
    }

    let parsed: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|error| format!("Could not parse local AI response: {error}. Raw response: {response_text}"))?;

    let output = parsed
        .get("response")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if output.is_empty() {
        return Err("Local AI returned an empty response.".to_string());
    }

    Ok(output)
}

async fn choose_ollama_model(client: &reqwest::Client, requested_model: &str) -> Result<String, String> {
    let requested = requested_model.trim();

    if !requested.is_empty() {
        return Ok(requested.to_string());
    }

    let response = client
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
        .map_err(|error| format!("Ollama is not reachable at 127.0.0.1:11434: {error}"))?;

    let status = response.status();

    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read Ollama model list: {error}"))?;

    if !status.is_success() {
        return Err(format!("Could not read Ollama model list. Status {status}: {body}"));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body)
        .map_err(|error| format!("Could not parse Ollama model list: {error}. Raw response: {body}"))?;

    let models = parsed
        .get("models")
        .and_then(|value| value.as_array())
        .ok_or_else(|| format!("Ollama model list did not include models. Raw response: {body}"))?;

    let names: Vec<String> = models
        .iter()
        .filter_map(|model| model.get("name").and_then(|name| name.as_str()))
        .map(|name| name.to_string())
        .collect();

    if names.is_empty() {
        return Err("Ollama is running, but no local models are installed.".to_string());
    }

    let preferred_prefixes = [
        "llama3.2",
        "llama3.1",
        "llama3",
        "qwen2.5",
        "qwen3",
        "mistral",
        "gemma3",
        "gemma2",
        "phi4",
        "phi3",
    ];

    for prefix in preferred_prefixes {
        if let Some(name) = names.iter().find(|name| name.starts_with(prefix)) {
            return Ok(name.clone());
        }
    }

    Ok(names[0].clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_url, ollama_generate])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
