import { ImageResponse } from 'next/og';

export const alt = 'Pusat Valas Indo — Money changer berizin Bank Indonesia';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(160deg, #c62828, #7f1d1d)',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85 }}>
          Berizin Bank Indonesia · sejak 2018
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>Pusat Valas Indo</div>
          <div style={{ fontSize: 36, marginTop: 24, opacity: 0.9 }}>
            Money changer di Cengkareng &amp; Tangerang · Kirim uang ke luar negeri
          </div>
        </div>
      </div>
    ),
    size,
  );
}
