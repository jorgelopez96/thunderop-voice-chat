import { describe, expect, it } from 'vitest';
import { useBaselineH264 } from './sdp';

const answer = [
  'm=video 9 UDP/TLS/RTP/SAVPF 96 102',
  'a=rtpmap:96 VP8/90000',
  'a=rtpmap:102 H264/90000',
  'a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
  '',
].join('\r\n');

describe('useBaselineH264', () => {
  it('rewrites constrained baseline to baseline', () => {
    expect(useBaselineH264(answer)).toContain('profile-level-id=42001f');
    expect(useBaselineH264(answer)).not.toContain('42e01f');
  });

  it('leaves other profiles untouched', () => {
    const high = answer.replace('42e01f', '64001f');
    expect(useBaselineH264(high)).toBe(high);
  });

  it('is case-insensitive on the hex profile', () => {
    expect(useBaselineH264(answer.replace('42e01f', '42E01F'))).toContain('profile-level-id=42001f');
  });
});
