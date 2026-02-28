'use client';

import { useProgress } from '@react-three/drei';

export default function LoadingScreen() {
  const { progress, active } = useProgress();

  if (!active && progress >= 100) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'radial-gradient(ellipse at center, #1a2a1a 0%, #0a0e17 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        transition: 'opacity 0.5s',
      }}
    >
      {/* اللوغو */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 900, color: '#d4a843', fontFamily: 'Cairo, sans-serif' }}>
          تركس
        </h1>
        <p style={{ color: '#888', fontSize: '16px', marginTop: '4px' }}>لعبة الشدة ثلاثية الأبعاد</p>
      </div>

      {/* شريط التقدم */}
      <div style={{ width: '280px' }}>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.max(progress, 5)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #d4a843, #f0d078)',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: '12px', color: '#d4a843', fontSize: '18px', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
          {Math.round(progress)}%
        </div>
        <div style={{ textAlign: 'center', marginTop: '4px', color: '#666', fontSize: '13px' }}>
          جاري تحميل الموارد...
        </div>
      </div>

      {/* أنيميشن الكروت */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        {['♠', '♥', '♦', '♣'].map((suit, i) => (
          <div
            key={suit}
            style={{
              fontSize: '28px',
              color: suit === '♥' || suit === '♦' ? '#e74c3c' : '#fff',
              animation: `cardBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          >
            {suit}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes cardBounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-12px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}