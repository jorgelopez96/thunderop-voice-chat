; Pasos propios del instalador de Thunderop (bundle.windows.nsis.installerHooks en tauri.conf.json).
; Al instalar o actualizar, Windows puede seguir mostrando el ícono viejo en el acceso directo del Escritorio porque
; guarda los íconos en una caché: se le avisa que cambiaron y se refresca, así aparece el ícono nuevo sin reiniciar.
!macro NSIS_HOOK_POSTINSTALL
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ExecWait '"$SYSDIR\ie4uinit.exe" -show'
!macroend
