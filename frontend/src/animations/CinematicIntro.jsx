import { useState, useEffect } from 'react';

const CinematicIntro = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 400),
      setTimeout(() => setStage(2), 2200),
      setTimeout(() => setStage(3), 4000),
      setTimeout(() => setStage(4), 5800),
      setTimeout(() => onComplete(), 6800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const eyeOpenAmount = stage >= 1 ? 1 : 0;
  const isZooming = stage >= 3;
  const isFading = stage >= 4;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      style={{
        opacity: isFading ? 0 : 1,
        transition: 'opacity 1s ease-in',
      }}
    >
      {/* Centered eye wrapper */}
      <div
        style={{
          transform: isZooming ? 'scale(6)' : 'scale(1)',
          opacity: isZooming ? 0 : 1,
          transition: isZooming
            ? 'transform 1.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 1.6s ease-in'
            : 'transform 0.3s ease',
        }}
      >
        {/* Eye almond shape container */}
        <div style={{ position: 'relative', width: '280px', height: '120px' }}>

          {/* Sclera (white of eye) — almond via border-radius */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 50%, #f2efe9 0%, #e6e0d6 50%, #d6cec4 100%)',
              borderRadius: '50%',
              overflow: 'hidden',
              transform: `scaleY(${eyeOpenAmount})`,
              transition: 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.08)',
            }}
          >
            {/* Subtle veins */}
            <svg width="280" height="120" style={{ position: 'absolute', inset: 0, opacity: 0.12 }}>
              <path d="M20,55 Q60,48 90,58" stroke="#c4756e" strokeWidth="0.6" fill="none" />
              <path d="M15,65 Q55,72 85,62" stroke="#b8696a" strokeWidth="0.5" fill="none" />
              <path d="M195,50 Q225,44 260,54" stroke="#c4756e" strokeWidth="0.6" fill="none" />
              <path d="M200,68 Q230,75 258,66" stroke="#b8696a" strokeWidth="0.5" fill="none" />
            </svg>

            {/* Iris */}
            <div
              style={{
                position: 'absolute',
                width: '76px',
                height: '76px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 40%, #6b7c5a 0%, #556b47 25%, #495e3d 50%, #3d5233 75%, #2f4228 100%)',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 0 8px rgba(60,70,50,0.2)',
              }}
            >
              {/* Iris fiber texture */}
              <div
                style={{
                  position: 'absolute',
                  inset: '3px',
                  borderRadius: '50%',
                  background: 'conic-gradient(from 30deg, rgba(100,120,80,0.15) 0deg, transparent 30deg, rgba(80,100,65,0.1) 60deg, transparent 90deg, rgba(100,120,80,0.15) 120deg, transparent 150deg, rgba(80,100,65,0.1) 180deg, transparent 210deg, rgba(100,120,80,0.15) 240deg, transparent 270deg, rgba(80,100,65,0.1) 300deg, transparent 330deg, rgba(100,120,80,0.15) 360deg)',
                }}
              />
              {/* Limbal ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(40,50,30,0.4)',
                }}
              />

              {/* Pupil */}
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '28px',
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) scale(${stage >= 1 ? 1 : 0.4})`,
                  transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #000 0%, #0a0a08 70%, #151510 100%)',
                  boxShadow: 'inset 0 0 4px rgba(0,0,0,0.8)',
                }}
              />

              {/* Main light reflection */}
              <div
                style={{
                  position: 'absolute',
                  width: '14px',
                  height: '16px',
                  top: '18%',
                  right: '22%',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.3) 60%, transparent 100%)',
                }}
              />
              {/* Secondary reflection */}
              <div
                style={{
                  position: 'absolute',
                  width: '6px',
                  height: '6px',
                  bottom: '25%',
                  left: '28%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 100%)',
                }}
              />
            </div>
          </div>

          {/* Upper eyelid */}
          <div
            style={{
              position: 'absolute',
              width: '280px',
              height: '70px',
              top: '-5px',
              left: 0,
              background: 'linear-gradient(180deg, #0c0a08 0%, #1a1714 50%, #25221e 100%)',
              borderRadius: '0 0 50% 50% / 0 0 100% 100%',
              transform: `translateY(${eyeOpenAmount ? '-55px' : '0px'})`,
              transition: 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
              zIndex: 2,
              boxShadow: '0 3px 12px rgba(0,0,0,0.6)',
            }}
          />

          {/* Lower eyelid */}
          <div
            style={{
              position: 'absolute',
              width: '280px',
              height: '40px',
              bottom: '-5px',
              left: 0,
              background: 'linear-gradient(0deg, #0c0a08 0%, #1a1714 50%, #25221e 100%)',
              borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
              transform: `translateY(${eyeOpenAmount ? '30px' : '0px'})`,
              transition: 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
              zIndex: 2,
              boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      </div>

      {/* Text overlay */}
      <div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center"
        style={{
          opacity: stage >= 2 && stage < 4 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        <p className="text-neutral-500 text-sm tracking-[0.3em] uppercase">OpthaMiss</p>
        <p className="text-neutral-600 text-xs mt-2 tracking-widest">AI Eye Disease Detection</p>
      </div>
    </div>
  );
};

export default CinematicIntro;