import { describe, expect, it } from 'vitest';
import { summarizeSender } from './stats';

const video = (extra: Record<string, unknown>) => ({
  id: 'O1', type: 'outbound-rtp', kind: 'video',
  frameWidth: 1920, frameHeight: 1080, framesPerSecond: 60, ...extra,
});
const report = (...stats: Record<string, any>[]) => new Map(stats.map((s) => [s.id, s]));

describe('summarizeSender', () => {
  it('classifies hardware encoder', () => {
    const s = summarizeSender(report(video({ encoderImplementation: 'MediaFoundationVideoEncoder' })));
    expect(s).toMatchObject({ hardware: true, width: 1920, height: 1080, fps: 60 });
  });

  it('classifies software encoders', () => {
    expect(summarizeSender(report(video({ encoderImplementation: 'OpenH264' })))?.hardware).toBe(false);
    expect(summarizeSender(report(video({ encoderImplementation: 'libvpx' })))?.hardware).toBe(false);
  });

  it('unknown encoder is null', () => {
    expect(summarizeSender(report(video({})))).toMatchObject({ encoder: 'desconocido', hardware: null });
  });

  it('returns null without video outbound', () => {
    expect(summarizeSender(report({ id: 'A1', type: 'outbound-rtp', kind: 'audio' }))).toBeNull();
  });

  it('reports quality limitation', () => {
    expect(summarizeSender(report(video({ qualityLimitationReason: 'cpu' })))?.limitation).toBe('cpu');
  });

  it('resolves codec', () => {
    const s = summarizeSender(report(video({ codecId: 'C1' }), { id: 'C1', type: 'codec', mimeType: 'video/H264' }));
    expect(s?.codec).toBe('video/H264');
  });
});
