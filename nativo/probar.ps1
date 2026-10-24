# Lanza la prueba de transmisión nativa. Las claves de LiveKit se leen del servidor (WSL) en el momento.
# Uso: .\probar.ps1 [sala] [pantalla|monitor:\\.\DISPLAYn|ventana:<hwnd>] [fps] [mbps]
#      (con comillas simples: .\probar.ps1 <sala> 'monitor:\\.\DISPLAY2')
param([string]$sala = "ltxwzwhtbp2ucx2", [string]$que = "pantalla", [int]$fps = 60, [int]$mbps = 12)

foreach ($linea in wsl -u root -- grep -e ^LIVEKIT_URL= -e ^LIVEKIT_API_KEY= -e ^LIVEKIT_API_SECRET= /opt/thunderop/thunderop.env) {
  $k, $v = $linea -split '=', 2
  Set-Item "env:$k" $v
}

& "$PSScriptRoot\..\.lkt\release\transmisor.exe" $sala $que $fps $mbps
exit $LASTEXITCODE
