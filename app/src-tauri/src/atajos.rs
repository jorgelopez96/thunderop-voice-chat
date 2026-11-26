#![cfg_attr(not(windows), allow(dead_code))] // los ganchos de teclado y mouse son de Windows
//! Atajos globales (silenciar, ensordecer, pulsar para hablar): ganchos de bajo nivel de teclado y mouse de Windows,
//! así andan con la app atrás o en la bandeja. A la página solo le llegan las teclas asignadas (no es un registro de todo
//! lo que se escribe), salvo la próxima que se apriete mientras se asigna una. Las teclas siguen llegando a donde iban.
//! Windows no le pasa a una app común lo que se hace sobre una ventana de administrador (juegos que corren así).

use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

// Botones del mouse: códigos fuera del rango de las teclas (1 a 255).
const RUEDA: u32 = 0x1_0004;
const LATERAL_ATRAS: u32 = 0x1_0005;
const LATERAL_ADELANTE: u32 = 0x1_0006;

#[derive(Default)]
struct Estado { asignadas: HashSet<u32>, apretadas: HashSet<u32>, capturando: bool }

static ESTADO: OnceLock<Mutex<Estado>> = OnceLock::new();
static APP: OnceLock<AppHandle> = OnceLock::new();
fn estado() -> std::sync::MutexGuard<'static, Estado> { ESTADO.get_or_init(Default::default).lock().unwrap_or_else(|e| e.into_inner()) }

#[derive(Clone, serde::Serialize)]
struct Atajo { codigo: u32, abajo: bool }
#[derive(Clone, serde::Serialize)]
struct Capturado { codigo: u32, nombre: String }

pub fn iniciar(app: AppHandle) {
    if APP.set(app).is_err() { return; }
    #[cfg(windows)]
    std::thread::spawn(|| unsafe { win::bucle() });
}

/// Lo llama el gancho con cada tecla o botón (sin las repeticiones de tener una tecla apretada).
fn llego(codigo: u32, abajo: bool, nombre: impl FnOnce() -> String) {
    let mut e = estado();
    if abajo && !e.apretadas.insert(codigo) { return; }
    if !abajo { e.apretadas.remove(&codigo); }
    let Some(app) = APP.get() else { return };
    if e.capturando && abajo {
        e.capturando = false;
        let _ = app.emit("atajo-capturado", Capturado { codigo, nombre: nombre() });
    } else if e.asignadas.contains(&codigo) {
        let _ = app.emit("atajo", Atajo { codigo, abajo });
    }
}

#[tauri::command]
pub fn atajos_asignar(codigos: Vec<u32>) { estado().asignadas = codigos.into_iter().collect(); }

/// `si`: la próxima tecla o botón que se apriete se manda como "atajo-capturado"; `false` cancela.
#[tauri::command]
pub fn atajos_capturar(si: bool) { estado().capturando = si; }

#[cfg(windows)]
mod win {
    use super::{llego, LATERAL_ADELANTE, LATERAL_ATRAS, RUEDA};

    #[repr(C)]
    struct Teclado { vk: u32, scan: u32, flags: u32, time: u32, extra: usize }
    #[repr(C)]
    struct Raton { x: i32, y: i32, data: u32, flags: u32, time: u32, extra: usize }
    #[repr(C)]
    struct Mensaje { hwnd: isize, message: u32, wparam: usize, lparam: isize, time: u32, x: i32, y: i32, privado: u32 }
    type Gancho = unsafe extern "system" fn(i32, usize, isize) -> isize;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn SetWindowsHookExW(id: i32, f: Gancho, modulo: isize, hilo: u32) -> isize;
        fn CallNextHookEx(h: isize, codigo: i32, w: usize, l: isize) -> isize;
        fn GetMessageW(m: *mut Mensaje, hwnd: isize, min: u32, max: u32) -> i32;
        fn GetKeyNameTextW(l: i32, texto: *mut u16, tam: i32) -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" { fn GetModuleHandleW(nombre: *const u16) -> isize; }

    unsafe extern "system" fn teclado(codigo: i32, w: usize, l: isize) -> isize {
        if codigo >= 0 && matches!(w, 0x100 | 0x101 | 0x104 | 0x105) { // WM_(SYS)KEYDOWN / WM_(SYS)KEYUP
            let k = unsafe { &*(l as *const Teclado) };
            llego(k.vk, matches!(w, 0x100 | 0x104), || nombre_tecla(k));
        }
        unsafe { CallNextHookEx(0, codigo, w, l) }
    }

    unsafe extern "system" fn raton(codigo: i32, w: usize, l: isize) -> isize {
        if codigo >= 0 {
            let r = unsafe { &*(l as *const Raton) };
            let boton = match w {
                0x207 | 0x208 => Some(RUEDA), // WM_MBUTTONDOWN / UP
                0x20B | 0x20C => Some(if r.data >> 16 == 1 { LATERAL_ATRAS } else { LATERAL_ADELANTE }), // WM_XBUTTONDOWN / UP
                _ => None, // movimientos y los otros botones: nada (este gancho tiene que volver rápido)
            };
            if let Some(b) = boton {
                let nombre = match b { RUEDA => "Botón de la rueda", LATERAL_ATRAS => "Botón lateral de atrás", _ => "Botón lateral de adelante" };
                llego(b, matches!(w, 0x207 | 0x20B), || nombre.to_string());
            }
        }
        unsafe { CallNextHookEx(0, codigo, w, l) }
    }

    /// El nombre que le da Windows en el idioma del teclado ("F13", "PAUSA", "Num 5").
    fn nombre_tecla(k: &Teclado) -> String {
        let l = ((k.scan << 16) | if k.flags & 1 != 0 { 1 << 24 } else { 0 }) as i32; // bit 24: tecla extendida
        let mut texto = [0u16; 64];
        let n = unsafe { GetKeyNameTextW(l, texto.as_mut_ptr(), texto.len() as i32) };
        if n > 0 { String::from_utf16_lossy(&texto[..n as usize]) } else { format!("Tecla {}", k.vk) }
    }

    pub unsafe fn bucle() {
        unsafe {
            let modulo = GetModuleHandleW(std::ptr::null());
            SetWindowsHookExW(13, teclado, modulo, 0); // WH_KEYBOARD_LL
            SetWindowsHookExW(14, raton, modulo, 0); // WH_MOUSE_LL
            // Los ganchos de bajo nivel se atienden en el hilo que los puso: necesita su bucle de mensajes.
            let mut m = std::mem::zeroed::<Mensaje>();
            while GetMessageW(&mut m, 0, 0, 0) > 0 {}
        }
    }
}
