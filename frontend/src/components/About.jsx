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

const About = () => {
  const items = [
    { title: 'Deep Learning', desc: 'CNN trained on thousands of retinal images to identify disease patterns with high accuracy.' },
    { title: 'Diverse Training Data', desc: 'Covers Cataract, Glaucoma, Diabetic Retinopathy, and healthy retinas with confidence scores.' },
    { title: 'Real-time Analysis', desc: 'Upload an image and receive results in seconds with full probability distribution.' },
  ];

  const [titleRef, titleVisible] = useReveal();

  return (
    <section id="about" className="py-24 px-6 border-t border-neutral-800/50 relative z-10">
      <div className="max-w-4xl mx-auto">
        <div
          ref={titleRef}
          className="text-center mb-16"
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s ease-out',
          }}
        >
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-4">Technology</p>
          <h2 className="text-3xl md:text-4xl font-light text-neutral-100">How It Works</h2>
        </div>
        <div className="space-y-6">
          {items.map((item, i) => (
            <AboutCard key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

const AboutCard = ({ item, index }) => {
  const [ref, visible] = useReveal(index * 150);
  return (
    <div
      ref={ref}
      className="border border-neutral-800/50 rounded-lg p-6 hover:border-neutral-700 hover:bg-neutral-900/30 transition-all duration-500 group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : `translateX(${index % 2 === 0 ? '-30px' : '30px'})`,
        transition: 'all 0.7s ease-out',
      }}
    >
      <h3 className="text-neutral-200 font-medium mb-2 group-hover:text-neutral-100 transition-colors">{item.title}</h3>
      <p className="text-neutral-500 text-sm leading-relaxed">{item.desc}</p>
    </div>
  );
};

export default About;