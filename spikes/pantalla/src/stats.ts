export type SenderSummary = {
  encoder: string;
  hardware: boolean | null;
  codec: string | null;
  width: number;
  height: number;
  fps: number;
  limitation: string;
};

const HARDWARE = /mediafoundation|nvenc|amf|quicksync|\(hw\)/i;
const SOFTWARE = /openh264|libvpx|libaom|\bsw\b/i;

export function summarizeSender(report: RTCStatsReport | Map<string, any>): SenderSummary | null {
  const stats = [...report.values()];
  const out = stats
    .filter((s) => s.type === 'outbound-rtp' && s.kind === 'video')
    .sort((a, b) => (b.frameWidth ?? 0) - (a.frameWidth ?? 0))[0];
  if (!out) return null;

  const encoder: string = out.encoderImplementation ?? 'desconocido';
  return {
    encoder,
    hardware: HARDWARE.test(encoder) ? true : SOFTWARE.test(encoder) ? false : null,
    codec: stats.find((s) => s.type === 'codec' && s.id === out.codecId)?.mimeType ?? null,
    width: out.frameWidth ?? 0,
    height: out.frameHeight ?? 0,
    fps: out.framesPerSecond ?? 0,
    limitation: out.qualityLimitationReason ?? 'none',
  };
}
