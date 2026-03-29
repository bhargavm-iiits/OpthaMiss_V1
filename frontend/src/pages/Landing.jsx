import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';

/* Lazy-load heavy 3D canvas — avoids SSR issues */
var Background3D = lazy(function () {
  return import('../components/three/Background3D');
});

/* ── Intersection reveal hook ── */
var useReveal = function (delay) {
  var ref = useRef(null);
  var [v, sv] = useState(false);
  useEffect(function () {
    var el = ref.current;
    if (!el) return;
    var obs = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          setTimeout(function () { sv(true); }, delay || 0);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return function () { obs.disconnect(); };
  }, [delay]);
  return [ref, v];
};

/* ── Mouse parallax for hero ── */
var useParallax = function () {
  var ref = useRef({ x: 0, y: 0 });
  var [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(function () {
    var raf;
    var handler = function (e) {
      ref.current.x = ((e.clientX / window.innerWidth) - 0.5) * 18;
      ref.current.y = ((e.clientY / window.innerHeight) - 0.5) * 12;
    };
    var loop = function () {
      setPos(function (prev) {
        var nx = prev.x + (ref.current.x - prev.x) * 0.06;
        var ny = prev.y + (ref.current.y - prev.y) * 0.06;
        if (Math.abs(nx - prev.x) < 0.001 && Math.abs(ny - prev.y) < 0.001) return prev;
        return { x: nx, y: ny };
      });
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', handler, { passive: true });
    raf = requestAnimationFrame(loop);
    return function () {
      window.removeEventListener('mousemove', handler);
      cancelAnimationFrame(raf);
    };
  }, []);
  return pos;
};

/* ── CSS-only particle layer (zero GPU) ── */
var CssParticles = function () {
  var [particles] = useState(function () {
    return Array.from({ length: 24 }, function (_, i) {
      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 20,
        dur: 14 + Math.random() * 16,
        size: 1.2 + Math.random() * 2,
        opacity: 0.15 + Math.random() * 0.25,
      };
    });
  });
  return (
    <>
      {particles.map(function (p) {
        return (
          <div
            key={p.id}
            style={{
              position: 'fixed',
              left: p.left + '%',
              bottom: '-4px',
              width: p.size + 'px',
              height: p.size + 'px',
              borderRadius: '50%',
              background: 'rgba(160,160,170,' + p.opacity + ')',
              pointerEvents: 'none',
              zIndex: 0,
              animation: 'driftUp ' + p.dur + 's linear ' + p.delay + 's infinite',
            }}
          />
        );
      })}
    </>
  );
};

/* ── Eye illustration with 3D-ish layers ── */
var EyeIllustration = function ({ parallax }) {
  var px = parallax ? parallax.x : 0;
  var py = parallax ? parallax.y : 0;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outermost aura — moves slowest (depth = far) */}
      <div
        style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(70,70,80,0.14) 0%, transparent 68%)',
          animation: 'pulseGlow 8s ease-in-out infinite',
          transform: 'translate(' + (px * 0.08) + 'px, ' + (py * 0.08) + 'px)',
          transition: 'transform 0.1s linear',
        }}
      />
      {/* Mid aura */}
      <div
        style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,90,100,0.16) 0%, transparent 65%)',
          animation: 'pulseGlow 5.5s ease-in-out infinite 1.5s',
          transform: 'translate(' + (px * 0.18) + 'px, ' + (py * 0.18) + 'px)',
          transition: 'transform 0.1s linear',
        }}
      />
      {/* Inner glow */}
      <div
        style={{
          position: 'absolute',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(110,110,120,0.12) 0%, transparent 60%)',
          animation: 'pulseGlow 4s ease-in-out infinite 0.5s',
          transform: 'translate(' + (px * 0.28) + 'px, ' + (py * 0.28) + 'px)',
          transition: 'transform 0.1s linear',
        }}
      />

      {/* Orbiting ring 1 */}
      <div
        style={{
          position: 'absolute',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          border: '1px solid rgba(80,80,90,0.2)',
          transform: 'translate(' + (px * 0.15) + 'px, ' + (py * 0.15) + 'px) rotateX(72deg)',
          transition: 'transform 0.1s linear',
          animation: 'floatSlow 7s ease-in-out infinite',
        }}
      />
      {/* Orbiting ring 2 */}
      <div
        style={{
          position: 'absolute',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          border: '1px solid rgba(80,80,90,0.15)',
          transform: 'translate(' + (px * 0.22) + 'px, ' + (py * 0.22) + 'px) rotateX(72deg) rotateZ(45deg)',
          transition: 'transform 0.1s linear',
          animation: 'floatSlow 9s ease-in-out infinite 2s',
        }}
      />

      {/* Main eye — moves most (closest to viewer) */}
      <div
        className="animate-float-slow"
        style={{
          position: 'relative',
          zIndex: 10,
          transform: 'translate(' + (px * 0.35) + 'px, ' + (py * 0.35) + 'px)',
          transition: 'transform 0.1s linear',
        }}
      >
        <svg
          width="300"
          height="192"
          viewBox="0 0 300 192"
          style={{ filter: 'drop-shadow(0 0 28px rgba(100,100,110,0.25))' }}
        >
          {/* Sclera */}
          <ellipse
            cx="150" cy="96" rx="138" ry="84"
            fill="url(#sg)"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          {/* Iris outer */}
          <circle cx="150" cy="96" r="56" fill="url(#ig)" />
          {/* Iris texture ring */}
          <circle cx="150" cy="96" r="56" fill="none"
            stroke="rgba(0,0,0,0.3)" strokeWidth="3" />
          {/* Iris inner texture */}
          <circle cx="150" cy="96" r="42" fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <circle cx="150" cy="96" r="32" fill="none"
            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          {/* Pupil */}
          <circle cx="150" cy="96" r="28" fill="#060606" />
          {/* Primary specular */}
          <ellipse cx="163" cy="80" rx="11" ry="14"
            fill="rgba(255,255,255,0.80)" />
          {/* Secondary specular */}
          <circle cx="138" cy="110" r="5"
            fill="rgba(255,255,255,0.35)" />
          {/* Tertiary specular */}
          <circle cx="160" cy="110" r="2.5"
            fill="rgba(255,255,255,0.18)" />

          <defs>
            <radialGradient id="sg" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#e0e0e0" />
              <stop offset="55%" stopColor="#cacaca" />
              <stop offset="100%" stopColor="#b0b0b0" />
            </radialGradient>
            <radialGradient id="ig" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#737373" />
              <stop offset="30%" stopColor="#565656" />
              <stop offset="65%" stopColor="#3d3d3d" />
              <stop offset="100%" stopColor="#252525" />
            </radialGradient>
          </defs>
        </svg>

        {/* Scan line animation */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '14%',
            right: '14%',
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(180,180,190,0.35), transparent)',
            animation: 'scanLine 3s ease-in-out infinite',
          }}
        />
      </div>

      {/* Diagnostic chips — different parallax depths */}
      <DiagChip
        label="✓ Clear Fundus"
        color="var(--risk-low-text)"
        style={{
          position: 'absolute', right: '-16px', top: '12%',
          transform: 'translate(' + (px * 0.5) + 'px, ' + (py * 0.5) + 'px)',
          transition: 'transform 0.1s linear',
          animationDelay: '0.6s',
        }}
      />
      <DiagChip
        label="⚡ 0.98 AUC"
        color="var(--color-text-2)"
        style={{
          position: 'absolute', left: '-20px', bottom: '18%',
          transform: 'translate(' + (px * 0.45) + 'px, ' + (py * 0.45) + 'px)',
          transition: 'transform 0.1s linear',
          animationDelay: '1.0s',
        }}
      />
      <DiagChip
        label="🔬 Screening..."
        color="var(--color-text-3)"
        style={{
          position: 'absolute', left: '4px', top: '8%',
          transform: 'translate(' + (px * 0.4) + 'px, ' + (py * 0.4) + 'px)',
          transition: 'transform 0.1s linear',
          animationDelay: '1.4s',
        }}
      />
      <DiagChip
        label="⚠ Monitor AMD"
        color="var(--risk-mod-text)"
        style={{
          position: 'absolute', right: '8px', bottom: '10%',
          transform: 'translate(' + (px * 0.55) + 'px, ' + (py * 0.55) + 'px)',
          transition: 'transform 0.1s linear',
          animationDelay: '1.8s',
        }}
      />
    </div>
  );
};

var DiagChip = function ({ label, color, style }) {
  return (
    <div
      className="animate-fade-in"
      style={Object.assign({
        padding: '5px 11px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: 500,
        background: 'rgba(26,26,26,0.90)',
        border: '1px solid var(--color-border-2)',
        color: color,
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
        animationFillMode: 'both',
        zIndex: 12,
      }, style)}
    >
      {label}
    </div>
  );
};

/* ── Stat item ── */
var StatItem = function ({ value, label, delay }) {
  var [ref, v] = useReveal(delay);
  return (
    <div
      ref={ref}
      className="text-center"
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity 0.55s ease ' + (delay || 0) + 'ms, transform 0.55s ease ' + (delay || 0) + 'ms',
      }}
    >
      <p className="text-2xl font-bold mb-0.5" style={{ color: 'var(--color-text)' }}>{value}</p>
      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-4)' }}>{label}</p>
    </div>
  );
};

/* ── Feature card ── */
var FeatureCard = function ({ icon, title, desc, stat, delay }) {
  var [ref, v] = useReveal(delay);
  return (
    <div
      ref={ref}
      className="ui-card p-6"
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.55s ease ' + (delay || 0) + 'ms, transform 0.55s ease ' + (delay || 0) + 'ms',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4"
        style={{ background: 'var(--color-bg-4)', border: '1px solid var(--color-border)' }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-3)' }}>
        {desc}
      </p>
      {stat && (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{
            background: 'var(--color-bg-4)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-2)',
          }}
        >
          {stat}
        </span>
      )}
    </div>
  );
};

/* ── Step ── */
var StepItem = function ({ number, title, desc, delay }) {
  var [ref, v] = useReveal(delay);
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.55s ease ' + (delay || 0) + 'ms, transform 0.55s ease ' + (delay || 0) + 'ms',
      }}
    >
      <div
        className="text-5xl font-black mb-3 select-none"
        style={{ color: 'var(--color-bg-4)', letterSpacing: '-0.04em', lineHeight: 1 }}
      >
        {number}
      </div>
      <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-3)' }}>
        {desc}
      </p>
    </div>
  );
};

/* ── Section helpers ── */
var Eyebrow = function ({ t }) { var [r, v] = useReveal(0); return <p ref={r} className="ui-eyebrow mb-3" style={{ opacity: v ? 1 : 0, transition: 'opacity 0.5s ease' }}>{t}</p>; };
var Headline = function ({ t }) { var [r, v] = useReveal(60); return <h2 ref={r} className="ui-h2 mb-4" style={{ opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(12px)', transition: 'all 0.5s ease 60ms' }}>{t}</h2>; };
var Sub = function ({ t }) { var [r, v] = useReveal(120); return <p ref={r} style={{ fontSize: '15px', color: 'var(--color-text-3)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7, opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(10px)', transition: 'all 0.5s ease 120ms' }}>{t}</p>; };

/* ── Primary CTA button ── */
var CtaButton = function ({ label, onClick, size }) {
  var [hov, setHov] = useState(false);
  var lg = size === 'lg';
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: lg ? '14px 36px' : '11px 28px',
        fontSize: lg ? '15px' : '13px',
        fontWeight: 600,
        color: 'var(--color-text)',
        background: hov ? 'var(--color-bg-hover)' : 'var(--color-bg-3)',
        border: '1px solid ' + (hov ? 'var(--color-accent-2)' : 'var(--color-border-2)'),
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        fontFamily: 'var(--font-sans)',
        boxShadow: hov ? 'var(--shadow-glow)' : 'none',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
        letterSpacing: '-0.01em',
      }}
    >
      {label}
      <svg
        style={{ width: lg ? '16px' : '14px', height: lg ? '16px' : '14px', transition: 'transform 0.25s ease', transform: hov ? 'translateX(2px)' : 'none' }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
  );
};

/* ── Condition pill group ── */
var ConditionGroup = function ({ label, items, delay }) {
  var [ref, v] = useReveal(delay);
  return (
    <div
      ref={ref}
      className="ui-card p-5"
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.55s ease ' + (delay || 0) + 'ms, transform 0.55s ease ' + (delay || 0) + 'ms',
      }}
    >
      <p className="ui-eyebrow mb-3">{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {items.map(function (item) {
          return (
            <span
              key={item}
              style={{
                padding: '2px 10px',
                fontSize: '12px',
                color: 'var(--color-text-2)',
                background: 'var(--color-bg-4)',
                border: '1px solid var(--color-border)',
                borderRadius: '99px',
              }}
            >
              {item}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   SCAN LINE KEYFRAME (inject once)
══════════════════════════════════════════════ */
var ScanLineStyle = function () {
  return (
    <style>{`
      @keyframes scanLine {
        0%   { top: 20%; opacity: 0; }
        10%  { opacity: 1; }
        90%  { opacity: 1; }
        100% { top: 80%; opacity: 0; }
      }
    `}</style>
  );
};

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
var Landing = function () {
  var navigate = useNavigate();
  var parallax = useParallax();
  var [scrolled, setScrolled] = useState(false);
  var [mobMenu, setMobMenu] = useState(false);
  var [heroVis, setHeroVis] = useState(false);
  var [isMobile, setIsMobile] = useState(false);

  useEffect(function () {
    var t = setTimeout(function () { setHeroVis(true); }, 120);
    return function () { clearTimeout(t); };
  }, []);

  useEffect(function () {
    var onScroll = function () { setScrolled(window.scrollY > 20); };
    var onResize = function () { setIsMobile(window.innerWidth < 768); };
    onResize();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return function () {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  var scrollTo = function (id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobMenu(false);
  };

  var handleCta = function () { navigate('/signup'); };

  var navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Conditions', id: 'conditions' },
  ];

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh', position: 'relative' }}>

      <ScanLineStyle />

      {/* ── 3D Background ── */}
      <Suspense fallback={null}>
        {!isMobile && <Background3D />}
      </Suspense>

      {/* ── CSS Particles (mobile fallback + supplemental) ── */}
      <CssParticles />

      {/* ════════════════════════════════
          NAVBAR
      ════════════════════════════════ */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: '60px',
          display: 'flex', alignItems: 'center',
          padding: '0 28px',
          transition: 'background 0.35s ease, border-color 0.35s ease',
          background: scrolled ? 'rgba(10,10,10,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--color-border)' : '1px solid transparent',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: '0 0 auto' }}>
          <div
            style={{
              width: '30px', height: '30px', borderRadius: '7px',
              background: 'var(--color-bg-3)',
              border: '1px solid var(--color-border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#c0c0c0" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3.5" fill="#888888" />
              <circle cx="12" cy="12" r="1.5" fill="#0a0a0a" />
              <circle cx="13.5" cy="10.5" r="1" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)', letterSpacing: '-0.015em' }}>
            OpthaMiss
          </span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1" style={{ margin: '0 auto' }}>
          {navLinks.map(function (link) {
            return (
              <button
                key={link.id}
                type="button"
                onClick={function () { scrollTo(link.id); }}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-3)',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={function (e) {
                  e.currentTarget.style.color = 'var(--color-text)';
                  e.currentTarget.style.background = 'var(--color-bg-3)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.color = 'var(--color-text-3)';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
          <button
            type="button"
            onClick={function () { navigate('/login'); }}
            className="hidden sm:block"
            style={{
              padding: '6px 14px', fontSize: '13px', fontWeight: 500,
              color: 'var(--color-text-3)', background: 'transparent',
              border: '1px solid transparent', borderRadius: '7px',
              cursor: 'pointer', transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={function (e) {
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.color = 'var(--color-text-3)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            Sign In
          </button>

          <CtaButton label="Get Started" onClick={handleCta} />

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={function () { setMobMenu(function (v) { return !v; }); }}
            className="md:hidden"
            style={{
              width: '34px', height: '34px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-bg-3)',
              border: '1px solid var(--color-border)',
              borderRadius: '7px', cursor: 'pointer',
              color: 'var(--color-text-2)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={mobMenu ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobMenu && (
        <div
          className="animate-slide-down md:hidden"
          style={{
            position: 'fixed', top: '60px', left: 0, right: 0, zIndex: 49,
            background: 'rgba(10,10,10,0.96)', backdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--color-border)', padding: '12px',
          }}
        >
          {navLinks.map(function (link) {
            return (
              <button
                key={link.id}
                type="button"
                onClick={function () { scrollTo(link.id); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: '14px', fontWeight: 500,
                  color: 'var(--color-text-2)', background: 'transparent',
                  border: 'none', borderRadius: '7px', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--color-bg-3)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = 'transparent'; }}
              >
                {link.label}
              </button>
            );
          })}
          <div style={{ height: '1px', background: 'var(--color-border)', margin: '8px 0' }} />
          <div style={{ padding: '8px 14px' }}>
            <CtaButton label="Get Started →" onClick={handleCta} />
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          HERO
      ════════════════════════════════ */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          paddingTop: '80px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div className="ui-container w-full">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '60px',
              alignItems: 'center',
            }}
          >
            {/* LEFT — copy */}
            <div
              style={{
                opacity: heroVis ? 1 : 0,
                transform: heroVis ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.7s ease, transform 0.7s ease',
              }}
            >
              {/* Trust badge */}
              <div
                className="inline-flex items-center gap-2 mb-6"
                style={{
                  padding: '5px 13px',
                  borderRadius: '99px',
                  background: 'var(--color-bg-3)',
                  border: '1px solid var(--color-border-2)',
                }}
              >
                <span
                  className="animate-pulse-dot"
                  style={{
                    display: 'inline-block',
                    width: '6px', height: '6px',
                    borderRadius: '50%',
                    background: 'var(--risk-low-text)',
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)', letterSpacing: '0.03em' }}>
                  Trusted by 10,000+ patients worldwide
                </span>
              </div>

              {/* Heading */}
              <h1
                style={{
                  fontSize: 'clamp(30px, 5.5vw, 52px)',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.028em',
                  color: 'var(--color-text)',
                  marginBottom: '18px',
                }}
              >
                AI-Powered
                <br />
                Eye Disease
                <br />
                <span style={{ color: 'var(--color-text-3)', fontWeight: 700 }}>
                  Screening
                </span>
              </h1>

              {/* Sub */}
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: 1.7,
                  color: 'var(--color-text-3)',
                  maxWidth: '420px',
                  marginBottom: '32px',
                }}
              >
                Detect 21 eye conditions in seconds using dual Vision Transformer models.
                Clinical-grade accuracy, accessible from any device.
              </p>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-4 mb-8">
                {[
                  { icon: '📊', val: '0.982', sub: 'AUC Score' },
                  { icon: '⚡', val: '<5s', sub: 'Per image' },
                  { icon: '🔬', val: '21', sub: 'Conditions' },
                ].map(function (item, i) {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div
                        style={{
                          width: '34px', height: '34px',
                          borderRadius: '8px',
                          background: 'var(--color-bg-3)',
                          border: '1px solid var(--color-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px',
                        }}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
                          {item.val}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-4)', marginTop: '2px' }}>
                          {item.sub}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SINGLE CTA */}
              <div>
                <CtaButton label="Start Screening — It's Free" onClick={handleCta} size="lg" />
                <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-4)' }}>
                  No credit card required &nbsp;·&nbsp; Results in under 5 seconds
                </p>
              </div>
            </div>

            {/* RIGHT — eye with parallax */}
            <div
              style={{
                height: '460px',
                position: 'relative',
                opacity: heroVis ? 1 : 0,
                transform: heroVis ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.9s ease 0.2s, transform 0.9s ease 0.2s',
              }}
            >
              <EyeIllustration parallax={isMobile ? null : parallax} />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5px',
            opacity: heroVis ? 0.45 : 0,
            transition: 'opacity 1.2s ease 1.8s',
          }}
        >
          <p style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-text-4)' }}>
            scroll
          </p>
          <div style={{ width: '1px', height: '26px', background: 'linear-gradient(to bottom, var(--color-border-2), transparent)' }} />
        </div>
      </section>

      {/* ════════════════════════════════
          STATS
      ════════════════════════════════ */}
      <section
        style={{
          position: 'relative', zIndex: 1,
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(17,17,17,0.85)',
          backdropFilter: 'blur(8px)',
          padding: '36px 0',
        }}
      >
        <div className="ui-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '28px',
            }}
          >
            <StatItem value="21" label="Conditions" delay={0} />
            <StatItem value="0.982" label="AUC-ROC" delay={70} />
            <StatItem value="< 5s" label="Analysis" delay={140} />
            <StatItem value="10k+" label="Patients" delay={210} />
            <StatItem value="2" label="AI Models" delay={280} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          FEATURES
      ════════════════════════════════ */}
      <section id="features" style={{ position: 'relative', zIndex: 1, padding: '90px 0' }}>
        <div className="ui-container">
          <div className="text-center mb-14">
            <Eyebrow t="Capabilities" />
            <Headline t="Advanced AI Features" />
            <Sub t="Two specialized Vision Transformer models screening 21 eye conditions with clinical-grade accuracy." />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '14px',
            }}
          >
            {[
              { icon: '🔬', title: 'Dual-Model AI', desc: 'ViT-S/16 models for anterior (13) and fundus (8) conditions, processing independently.', stat: '21 conditions', delay: 0 },
              { icon: '⚡', title: 'Instant Results', desc: '3-5 view TTA averaging delivers robust clinical predictions in under 5 seconds.', stat: '< 5s / image', delay: 80 },
              { icon: '🛡️', title: 'Private & Secure', desc: 'HIPAA-compliant. Images never stored after analysis. Zero data retention.', stat: '100% private', delay: 160 },
              { icon: '📱', title: 'Any Device', desc: 'Smartphone, tablet, desktop — designed for tele-ophthalmology in remote areas.', stat: 'All platforms', delay: 240 },
              { icon: '📊', title: 'Risk Stratification', desc: 'HIGH / MODERATE / LOW urgency mapping with specific clinical referral guidance per condition.', stat: '3 risk levels', delay: 320 },
              { icon: '🧪', title: 'Clinical Grade', desc: 'Trained on MISS, ODIR-5K, and RFMiD datasets with per-class F1-optimized thresholds.', stat: 'AUC 0.982', delay: 400 },
            ].map(function (f, i) {
              return <FeatureCard key={i} {...f} />;
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════ */}
      <section
        id="how-it-works"
        style={{
          position: 'relative', zIndex: 1, padding: '90px 0',
          background: 'rgba(17,17,17,0.6)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="ui-container">
          <div className="text-center mb-14">
            <Eyebrow t="Process" />
            <Headline t="How It Works" />
            <Sub t="Three simple steps from image to clinical report." />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '40px',
              position: 'relative',
            }}
          >
            <StepItem number="01" title="Upload Image" desc="Select or drag your eye image — anterior or fundus. JPG / PNG supported." delay={0} />
            <StepItem number="02" title="AI Analysis" desc="Our ViT-S/16 models preprocess, augment, and analyze your image across multiple views." delay={140} />
            <StepItem number="03" title="Get Your Report" desc="Receive a detailed report with detected conditions, risk level, and clinical recommendations." delay={280} />
          </div>

          <div className="text-center mt-12">
            <CtaButton label="Start Screening Now" onClick={handleCta} size="lg" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          CONDITIONS
      ════════════════════════════════ */}
      <section id="conditions" style={{ position: 'relative', zIndex: 1, padding: '90px 0' }}>
        <div className="ui-container">
          <div className="text-center mb-14">
            <Eyebrow t="Coverage" />
            <Headline t="21 Conditions Screened" />
            <Sub t="Comprehensive AI screening across anterior and fundus imaging modalities." />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            <ConditionGroup
              label="Anterior Eye — 13 conditions"
              delay={0}
              items={[
                'Cataract', 'Intraocular Lens', 'Lens Dislocation', 'Keratitis',
                'Corneal Scarring', 'Corneal Dystrophy', 'Corneal/Conjunctival Tumor',
                'Pinguecula', 'Pterygium', 'Subconjunctival Hemorrhage',
                'Conjunctival Injection', 'Conjunctival Cyst', 'Pigmented Nevus',
              ]}
            />
            <ConditionGroup
              label="Fundus / Retinal — 8 conditions"
              delay={100}
              items={[
                'Normal', 'Diabetic Retinopathy', 'Glaucoma', 'Cataract',
                'Age-related Macular Degeneration', 'Hypertensive Retinopathy',
                'Pathological Myopia', 'Other Pathology',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          CTA BANNER
      ════════════════════════════════ */}
      <section
        style={{
          position: 'relative', zIndex: 1, padding: '80px 0',
          background: 'rgba(17,17,17,0.7)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="ui-container text-center">
          <CtaBanner handleCta={handleCta} />
        </div>
      </section>

      {/* ════════════════════════════════
          FOOTER
      ════════════════════════════════ */}
      <footer
        style={{
          position: 'relative', zIndex: 1,
          borderTop: '1px solid var(--color-border)',
          padding: '44px 0 28px',
          background: 'var(--color-bg)',
        }}
      >
        <div className="ui-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '36px',
              marginBottom: '36px',
            }}
          >
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '26px', height: '26px', borderRadius: '6px',
                    background: 'var(--color-bg-3)',
                    border: '1px solid var(--color-border-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#a0a0a0" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="3" fill="#707070" />
                  </svg>
                </div>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>OpthaMiss</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-4)', lineHeight: 1.6 }}>
                AI-powered eye disease screening platform.
              </p>
            </div>

            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Roadmap'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'HIPAA', 'Cookies'] },
            ].map(function (col, i) {
              return (
                <div key={i}>
                  <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: '12px' }}>
                    {col.title}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {col.links.map(function (link) {
                      return (
                        <li key={link}>
                          <a
                            href="#"
                            style={{ fontSize: '13px', color: 'var(--color-text-4)', textDecoration: 'none', transition: 'color 0.2s ease' }}
                            onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text-2)'; }}
                            onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-4)'; }}
                          >
                            {link}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Bottom */}
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: '10px',
              paddingTop: '20px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <p style={{ fontSize: '12px', color: 'var(--color-text-4)' }}>
              © 2025 OpthaMiss. All rights reserved.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-4)' }}>
              AI screening only — not a substitute for clinical diagnosis.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

/* ── CTA Banner sub-component ── */
var CtaBanner = function ({ handleCta }) {
  var [ref, v] = useReveal(0);
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.6s ease',
      }}
    >
      <p className="ui-eyebrow mb-4" style={{ color: 'var(--color-text-4)' }}>Get started today</p>
      <h2
        className="ui-h2 mb-4"
        style={{ maxWidth: '460px', margin: '0 auto 14px' }}
      >
        Ready to screen your eyes?
      </h2>
      <p
        style={{
          fontSize: '15px', color: 'var(--color-text-3)',
          maxWidth: '380px', margin: '0 auto 32px', lineHeight: 1.7,
        }}
      >
        Join thousands of patients using AI-powered screening to detect eye diseases early.
        Free, fast, and private.
      </p>
      <CtaButton label="Create Free Account" onClick={handleCta} size="lg" />
      <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--color-text-4)' }}>
        No credit card &nbsp;·&nbsp; Results in &lt; 5 seconds &nbsp;·&nbsp; HIPAA compliant
      </p>
    </div>
  );
};

export default Landing;