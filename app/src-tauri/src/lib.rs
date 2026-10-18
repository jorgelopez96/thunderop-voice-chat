mod audio;

use tauri::webview::{PageLoadEvent, PermissionKind, PermissionResponse};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Como Discord: la app se da sola el micrófono (los ajustes de privacidad de Windows siguen mandando).
        .on_permission_request(|_, kind| match kind {
            PermissionKind::Microphone => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .on_page_load(|w, p| {
            #[cfg(windows)]
            if p.event() == PageLoadEvent::Started {
                permitir_microfono(w, p.url().origin().ascii_serialization());
            }
        })
        .manage(audio::Captura::default())
        .invoke_handler(tauri::generate_handler![audio::iniciar_audio, audio::detener_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Un "bloquear" guardado en el perfil de WebView2 no vuelve a preguntar (ni pasa por `on_permission_request`):
/// se pisa con "permitir" para el origen de la página en cada carga.
#[cfg(windows)]
fn permitir_microfono(w: &tauri::Webview, origen: String) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Profile4, ICoreWebView2SetPermissionStateCompletedHandler, ICoreWebView2_13,
        COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use windows::core::{Interface, HSTRING};

    let _ = w.with_webview(move |pw| {
        let r = unsafe {
            pw.controller().CoreWebView2().and_then(|c| {
                c.cast::<ICoreWebView2_13>()?.Profile()?.cast::<ICoreWebView2Profile4>()?.SetPermissionState(
                    COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, &HSTRING::from(origen), COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                    None::<&ICoreWebView2SetPermissionStateCompletedHandler>)
            })
        };
        if let Err(e) = r { eprintln!("no se pudo permitir el micrófono: {e}"); }
    });
}
