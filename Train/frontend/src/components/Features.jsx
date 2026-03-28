import { useEffect, useRef, useState } from 'react';

const useReveal = (delay = 0) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTimeout(() => setVisible(true), delay); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);
  return [ref, visible];
};

const features = [
  { title: 'High Accuracy', desc: '95%+ accuracy on validation datasets.' },
  { title: 'Instant Results', desc: 'Predictions in under 5 seconds.' },
  { title: 'Easy to Use', desc: 'Simple drag-and-drop interface.' },
  { title: 'Secure', desc: 'Images are not stored on servers.' },
];

const Features = () => {
  const [titleRef, titleVisible] = useReveal();

  return (
    <section id="features" className="py-24 px-6 border-t border-neutral-800/50 relative z-10">
      <div className="max-w-5xl mx-auto">
        <div
          ref={titleRef}
          className="text-center mb-16"
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s ease-out',
          }}
        >
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-4">Features</p>
          <h2 className="text-3xl md:text-4xl font-light text-neutral-100">Why OpthaMiss</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <FeatureCard key={i} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

const FeatureCard = ({ feature, index }) => {
  const [ref, visible] = useReveal(index * 120);
  return (
    <div
      ref={ref}
      className="border border-neutral-800/50 rounded-lg p-6 text-center hover:border-neutral-700 hover:bg-neutral-900/30 transition-all duration-300 group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
        transition: `all 0.6s ease-out ${index * 0.1}s`,
      }}
    >
      <h3 className="text-neutral-200 font-medium mb-2 text-base group-hover:text-neutral-100 transition-colors">{feature.title}</h3>
      <p className="text-neutral-500 text-sm leading-relaxed">{feature.desc}</p>
    </div>
  );
};

export default Features;