mod audio;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(audio::Captura::default())
        .invoke_handler(tauri::generate_handler![audio::iniciar_audio, audio::detener_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
