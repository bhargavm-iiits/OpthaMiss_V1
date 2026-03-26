import { useEffect, useRef, useState } from 'react';

const useReveal = (delay = 0) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTimeout(() => setVisible(true), delay); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);
  return [ref, visible];
};

const Reveal = ({ children, delay = 0, className = '' }) => {
  const [ref, visible] = useReveal(delay);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.7s ease-out ${delay}ms, transform 0.7s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

const EyeGuide = () => {

  const steps = [
    {
      number: '1',
      title: 'Set Up',
      items: [
        {
          label: 'Lighting',
          detail: 'Use your phone’s flashlight as the main light source. Face a window or bright lamp as well—light must shine on your face, not from behind.',
          icon: '💡',
        },
        {
          label: 'Camera',
          detail: 'Use the rear camera. Turn off beauty mode, HDR, and all filters.',
          icon: '📷',
        },
      ],
    },
    {
      number: '2',
      title: 'Take the Photo',
      items: [
        {
          label: 'Distance',
          detail: 'Hold the phone 10–15 cm (one hand-width) from your eye.',
          icon: '📏',
        },
        {
          label: 'Zoom',
          detail: 'Use 2× zoom to fill the frame without losing focus.',
          icon: '🔍',
        },
        {
          label: 'Focus',
          detail: 'Tap the screen on your eye. Keep your eye wide open.',
          icon: '🎯',
        },
        {
          label: 'Capture',
          detail: 'Take 3–5 shots and select the sharpest one.',
          icon: '📸',
        },
      ],
    },
  ];

  const checklist = [
    { text: 'Eye fills most of the frame',                           ok: true  },
    { text: 'Both the white (sclera) and colored (iris) parts are visible', ok: true  },
    { text: 'The problem area is clear and centered',                ok: true  },
    { text: 'Sharp enough to see the iris texture',                  ok: true  },
    { text: 'Colors look natural (no filters)',                      ok: true  },
    { text: 'If blurry, too dark, or eye mostly closed → retake',   ok: false },
  ];

  return (
    <section id="guide" className="py-24 px-6 border-t border-neutral-800/50 relative z-10">
      <div className="max-w-4xl mx-auto space-y-14">

        {/* ── Header ── */}
        <Reveal className="text-center">
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-4">
            Image Capture
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-neutral-100 mb-4">
            How to Capture Eye Images
          </h2>
          <p className="text-neutral-500 text-sm max-w-lg mx-auto leading-relaxed">
            Follow the two-step guide below to capture a clear, accurate eye photo
            for AI diagnosis.
          </p>
        </Reveal>

        {/* ── Step cards ── */}
        <div className="space-y-6">
          {steps.map((step, si) => (
            <Reveal key={si} delay={100 + si * 100}>
              <div className="border border-neutral-800 rounded-xl overflow-hidden">

                {/* card header */}
                <div className="flex items-center gap-4 px-6 py-4 bg-neutral-900/60 border-b border-neutral-800">
                  <div className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 text-sm font-medium shrink-0">
                    {step.number}
                  </div>
                  <h3 className="text-neutral-200 font-medium text-lg">
                    {step.title}
                  </h3>
                </div>

                {/* card body */}
                <div className="p-6 grid sm:grid-cols-2 gap-4">
                  {step.items.map((item, ii) => (
                    <div
                      key={ii}
                      className="flex items-start gap-4 border border-neutral-800/60 rounded-lg p-4 bg-neutral-900/20 hover:border-neutral-700 hover:bg-neutral-800/20 transition-all duration-300"
                    >
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-neutral-300 text-sm font-medium mb-1">
                          {item.label}
                        </p>
                        <p className="text-neutral-500 text-sm leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </Reveal>
          ))}
        </div>

        {/* ── Tip banner ── */}
        <Reveal delay={320}>
          <div className="border border-neutral-800/60 rounded-xl p-5 bg-neutral-900/20 flex items-start gap-4">
            <span className="text-xl shrink-0">💬</span>
            <p className="text-neutral-400 text-sm leading-relaxed">
              <span className="text-neutral-300 font-medium">Tip: </span>
              Have someone else take the photo for best results. If you're alone, use a
              well-lit mirror to frame your eye — hold the phone next to your face with the
              camera pointing at the mirror.
            </p>
          </div>
        </Reveal>

        {/* ── Photo Checklist ── */}
        <Reveal delay={400}>
          <div className="border border-neutral-800 rounded-xl overflow-hidden">

            {/* header */}
            <div className="px-6 py-4 bg-neutral-900/60 border-b border-neutral-800">
              <h3 className="text-neutral-200 font-medium">Photo Checklist</h3>
            </div>

            {/* list */}
            <div className="p-6 space-y-3">
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 pb-3 ${
                    i < checklist.length - 1 ? 'border-b border-neutral-800/40' : ''
                  }`}
                >
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                      item.ok
                        ? 'bg-green-950/60 border border-green-800/50 text-green-500/80'
                        : 'bg-red-950/60 border border-red-800/50 text-red-500/70'
                    }`}
                  >
                    {item.ok ? '✓' : '✗'}
                  </span>
                  <span
                    className={`text-sm leading-relaxed ${
                      item.ok ? 'text-neutral-400' : 'text-neutral-500 italic'
                    }`}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            {/* footer */}
            <div className="px-6 py-4 border-t border-neutral-800/40 bg-neutral-900/30 flex flex-col sm:flex-row items-center justify-center gap-2 text-sm">
              <span className="text-green-500/70">All yes →</span>
              <span className="text-neutral-400">Upload!</span>
              <span className="text-neutral-700 hidden sm:inline">|</span>
              <span className="text-red-500/60">Any no →</span>
              <span className="text-neutral-400">Retake</span>
            </div>

          </div>
        </Reveal>

      </div>
    </section>
  );
};

export default EyeGuide;