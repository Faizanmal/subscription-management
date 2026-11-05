import { ImageResponse } from 'next/og';

export const alt = 'Subscription Waste Manager — find and cut wasted software subscriptions';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', background: '#0f172a', color: '#fff', padding: 80 }}>
      <div style={{ display: 'flex', color: '#93c5fd', fontSize: 28, marginBottom: 40 }}>SUBSCRIPTION WASTE MANAGER</div>
      <div style={{ display: 'flex', fontSize: 70, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>Find and cut wasted software subscriptions.</div>
      <div style={{ display: 'flex', fontSize: 28, color: '#cbd5e1', marginTop: 36 }}>Track spend. Review usage. Plan your savings.</div>
    </div>,
    size,
  );
}
