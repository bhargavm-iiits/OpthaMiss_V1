import { useState } from 'react';

const BackgroundEffects = function ({ intensity }) {
  var op = intensity === 'high' ? 1 : intensity === 'low' ? 0.4 : 0.65;

  var [particles] = useState(function () {
    return Array.from({ length: 35 }, function (_, i) {
      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 18,
        duration: 10 + Math.random() * 14,
        size: 1.5 + Math.random() * 3,
      };
    });
  });

  var orbs = [
    { left: '5%',  top: '10%', size: 400, color: 'rgba(80,80,120,0.14)',  dur: 22, anim: 'float1' },
    { left: '65%', top: '30%', size: 480, color: 'rgba(60,100,80,0.10)',  dur: 28, anim: 'float2' },
    { left: '35%', top: '60%', size: 340, color: 'rgba(100,80,100,0.12)', dur: 20, anim: 'float3' },
    { left: '75%', top: '5%',  size: 280, color: 'rgba(70,70,110,0.10)', dur: 26, anim: 'float1' },
    { left: '15%', top: '75%', size: 420, color: 'rgba(90,80,70,0.10)',  dur: 32, anim: 'float2' },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" style={{ opacity: op }}>

      {/* Orbs */}
      {orbs.map(function (orb, i) {
        return (
          <div key={i} style={{
            position: 'absolute',
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, ' + orb.color + ' 0%, transparent 70%)',
            animation: orb.anim + ' ' + orb.dur + 's ease-in-out infinite',
            filter: 'blur(24px)',
          }} />
        );
      })}

      {/* Grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
      }} />

      {/* Particles */}
      {particles.map(function (p) {
        return (
          <div key={p.id} style={{
            position: 'absolute',
            left: p.left + '%',
            bottom: '-8px',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: 'rgba(200,200,220,0.35)',
            animation: 'driftUp ' + p.duration + 's linear ' + p.delay + 's infinite',
            boxShadow: '0 0 ' + (p.size * 2) + 'px rgba(200,200,220,0.2)',
          }} />
        );
      })}

      {/* Corner glows */}
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(70,75,110,0.18) 0%, transparent 60%)',
        animation: 'pulseGlow 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-100px',
        width: '420px', height: '420px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(90,70,65,0.14) 0%, transparent 60%)',
        animation: 'pulseGlow 11s ease-in-out infinite 4s',
      }} />
    </div>
  );
};

export default BackgroundEffects;