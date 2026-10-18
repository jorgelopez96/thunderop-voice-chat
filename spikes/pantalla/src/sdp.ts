// LiveKit negocia H.264 Constrained Baseline (42e0xx). Con ese perfil, Chromium/WebView2 codifica
// la pantalla con OpenH264 (CPU); con Baseline (4200xx) usa el codificador de la GPU (MediaFoundation/NVENC).
// Reescribir solo la respuesta remota cambia cómo se configura el codificador local; el servidor y los
// espectadores siguen viendo 42e01f y decodifican el flujo sin problema (verificado a 1080p58).
export function useBaselineH264(sdp: string): string {
  return sdp.replace(/profile-level-id=42e0([0-9a-f]{2})/gi, (_, level: string) => `profile-level-id=4200${level.toLowerCase()}`);
}

// ponytail: parche global del prototipo; en la app real va en un wrapper del PeerConnection de LiveKit.
export function installBaselineH264Patch(enabled: () => boolean) {
  const original = RTCPeerConnection.prototype.setRemoteDescription;
  RTCPeerConnection.prototype.setRemoteDescription = function (this: RTCPeerConnection, desc?: RTCSessionDescriptionInit) {
    if (enabled() && desc?.type === 'answer' && desc.sdp) desc = { type: desc.type, sdp: useBaselineH264(desc.sdp) };
    return Reflect.apply(original, this, [desc]);
  } as typeof original;
}
