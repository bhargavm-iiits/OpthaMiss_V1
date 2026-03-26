import { useState } from 'react';

const BackgroundEffects = () => {
  const [particles] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 8 + Math.random() * 14,
      size: 2 + Math.random() * 4,
      opacity: 0.25 + Math.random() * 0.45,
    }))
  );

  const [orbs] = useState(() => [
    { left: '5%',  top: '15%', size: 420, color: 'rgba(80,80,120,0.18)',  duration: 22, anim: 'float1' },
    { left: '65%', top: '35%', size: 520, color: 'rgba(60,100,80,0.14)',  duration: 28, anim: 'float2' },
    { left: '35%', top: '65%', size: 360, color: 'rgba(100,80,100,0.16)', duration: 20, anim: 'float3' },
    { left: '75%', top: '5%',  size: 300, color: 'rgba(70,70,110,0.13)',  duration: 26, anim: 'float1' },
    { left: '15%', top: '80%', size: 450, color: 'rgba(90,80,70,0.15)',   duration: 32, anim: 'float2' },
    { left: '50%', top: '45%', size: 280, color: 'rgba(75,95,85,0.12)',   duration: 18, anim: 'float3' },
  ]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">

      {/* Gradient orbs — more visible */}
      {orbs.map((orb, i) => (
        <div
          key={`orb-${i}`}
          style={{
            position: 'absolute',
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            animation: `${orb.anim} ${orb.duration}s ease-in-out infinite`,
            filter: 'blur(30px)',
          }}
        />
      ))}

      {/* Floating particles — more visible */}
      {particles.map((p) => (
        <div
          key={`p-${p.id}`}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: `rgba(200, 200, 220, ${p.opacity})`,
            animation: `driftUp ${p.duration}s linear ${p.delay}s infinite`,
            boxShadow: `0 0 ${p.size * 2}px rgba(200,200,220,${p.opacity * 0.5})`,
          }}
        />
      ))}

      {/* Subtle grid overlay — slightly more visible */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Corner accent glow — top right */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          right: '-150px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(70,75,110,0.22) 0%, transparent 60%)',
          animation: 'pulse-glow 8s ease-in-out infinite',
        }}
      />

      {/* Corner accent glow — bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-150px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,70,65,0.18) 0%, transparent 60%)',
          animation: 'pulse-glow 10s ease-in-out infinite 3s',
        }}
      />

      {/* Centre ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '40%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(60,80,90,0.10) 0%, transparent 70%)',
          animation: 'pulse-glow 14s ease-in-out infinite 6s',
        }}
      />
    </div>
  );
};

export default BackgroundEffects;