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
  const [titleRef, titleVisible] = useReveal();

  const sections = [
    {
      title: 'Dual-Model Architecture',
      icon: '🧠',
      desc: 'Two specialized ViT-S/16 Vision Transformers — one for anterior (external) eye screening and one for retinal fundus analysis — each fine-tuned on domain-specific datasets for maximum accuracy.',
      details: [
        { label: 'Anterior Model', value: '13 conditions • mAP 0.922 • AUC 0.982' },
        { label: 'Fundus Model', value: '8 conditions • AUC 0.889 • F1 0.631' },
        { label: 'Architecture', value: 'ViT-S/16 + CLS+GAP Dual Features' },
      ],
    },
    {
      title: 'Training Data',
      icon: '📊',
      desc: 'Models are trained on large, diverse clinical datasets to ensure robust detection across different cameras, lighting conditions, and patient demographics.',
      details: [
        { label: 'Anterior', value: 'MISS dataset — anterior eye lesion images' },
        { label: 'Fundus', value: 'ODIR-5K + RFMiD — 9,592 retinal fundus images' },
        { label: 'Validation', value: 'Per-class F1-optimized thresholds on held-out sets' },
      ],
    },
    {
      title: 'Intelligent Preprocessing',
      icon: '🔬',
      desc: 'Each image type gets specialized preprocessing before analysis to maximize diagnostic accuracy.',
      details: [
        { label: 'Anterior', value: 'Automated glare removal via OpenCV inpainting' },
        { label: 'Fundus', value: 'Black border removal + CLAHE contrast enhancement' },
        { label: 'Both', value: 'Bicubic resize to 224×224, ImageNet normalization' },
      ],
    },
    {
      title: 'Test-Time Augmentation (TTA)',
      icon: '🔄',
      desc: 'Multiple augmented views of each image are analyzed and averaged to improve prediction robustness — reducing false positives and increasing confidence.',
      details: [
        { label: 'Anterior', value: '3-view TTA — original, horizontal flip, vertical flip' },
        { label: 'Fundus', value: '5-view TTA — original, hflip, vflip, rot90, rot270' },
        { label: 'Aggregation', value: 'Probability averaging across all views' },
      ],
    },
    {
      title: 'Clinical Risk Stratification',
      icon: '⚕️',
      desc: 'Each detected condition is mapped to a clinical urgency level with specific referral recommendations, helping healthcare workers prioritize patients effectively.',
      details: [
        { label: '🔴 HIGH', value: 'Urgent referral within 24-48 hours (e.g., Keratitis, Glaucoma, AMD)' },
        { label: '🟡 MODERATE', value: 'Referral within 2-4 weeks (e.g., Cataract, Hypertension)' },
        { label: '🟢 LOW / NORMAL', value: 'Monitor at next visit or routine screening in 12 months' },
      ],
    },
    {
      title: 'Real-Time Analysis',
      icon: '⚡',
      desc: 'Optimized for fast inference — suitable for deployment on smartphones and low-resource settings in remote and underserved communities.',
      details: [
        { label: 'Model Size', value: '~22.2M parameters (~85 MB per model)' },
        { label: 'GPU Inference', value: '~4.3ms per image' },
        { label: 'CPU / Smartphone', value: '~34ms per image' },
      ],
    },
  ];

  const conditions = {
    anterior: [
      'Cataract', 'Intraocular Lens', 'Lens Dislocation', 'Keratitis',
      'Corneal Scarring', 'Corneal Dystrophy', 'Corneal/Conjunctival Tumor',
      'Pinguecula', 'Pterygium', 'Subconjunctival Hemorrhage',
      'Conjunctival Injection', 'Conjunctival Cyst', 'Pigmented Nevus',
    ],
    fundus: [
      'Normal', 'Diabetic Retinopathy', 'Glaucoma', 'Cataract',
      'Age-related Macular Degeneration', 'Hypertensive Retinopathy',
      'Pathological Myopia', 'Other Pathology',
    ],
  };

  return (
    <section id="about" className="py-24 px-6 border-t border-neutral-800/50 relative z-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
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
          <h2 className="text-3xl md:text-4xl font-light text-neutral-100 mb-4">How It Works</h2>
          <p className="text-neutral-500 text-base max-w-2xl mx-auto leading-relaxed">
            OpthaMiss uses two specialized Vision Transformer models to screen for
            21 eye conditions across both anterior (external) and fundus (retinal) imaging —
            delivering clinical-grade AI screening accessible from any device.
          </p>
        </div>

        {/* Pipeline overview */}
        <PipelineOverview />

        {/* Detail cards */}
        <div className="space-y-5 mt-14">
          {sections.map((section, i) => (
            <SectionCard key={i} section={section} index={i} />
          ))}
        </div>

        {/* Conditions covered */}
        <ConditionsList conditions={conditions} />

        {/* Model comparison table */}
        <ModelComparison />

      </div>
    </section>
  );
};


const PipelineOverview = () => {
  const [ref, visible] = useReveal(100);

  const steps = [
    { icon: '📸', label: 'Upload', sub: 'Eye image' },
    { icon: '🔧', label: 'Preprocess', sub: 'Enhance & clean' },
    { icon: '🤖', label: 'AI Model', sub: 'ViT-S/16 + TTA' },
    { icon: '📋', label: 'Results', sub: 'Risk & referral' },
  ];

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.7s ease-out',
      }}
    >
      <div className="border border-neutral-800 rounded-xl p-6 bg-neutral-900/30">
        <p className="text-neutral-600 text-sm uppercase tracking-wider mb-5 text-center">
          Screening Pipeline
        </p>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full border border-neutral-700 bg-neutral-800/50 flex items-center justify-center text-xl mb-2">
                  {step.icon}
                </div>
                <p className="text-neutral-300 text-sm font-medium">{step.label}</p>
                <p className="text-neutral-600 text-xs mt-0.5">{step.sub}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="mx-3 md:mx-6 flex-shrink-0">
                  <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


const SectionCard = ({ section, index }) => {
  const [ref, visible] = useReveal(index * 120);

  return (
    <div
      ref={ref}
      className="border border-neutral-800/50 rounded-xl overflow-hidden hover:border-neutral-700 transition-all duration-300 group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : `translateX(${index % 2 === 0 ? '-25px' : '25px'})`,
        transition: 'all 0.7s ease-out',
      }}
    >
      <div className="flex items-center gap-3 px-6 py-4 bg-neutral-900/40 border-b border-neutral-800/50">
        <span className="text-xl">{section.icon}</span>
        <h3 className="text-neutral-200 text-lg font-medium group-hover:text-neutral-100 transition-colors">
          {section.title}
        </h3>
      </div>

      <div className="px-6 py-5">
        <p className="text-neutral-500 text-sm leading-relaxed mb-4">
          {section.desc}
        </p>
        <div className="space-y-2.5">
          {section.details.map((detail, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-neutral-600 font-medium min-w-[100px] shrink-0 pt-0.5">
                {detail.label}
              </span>
              <span className="text-neutral-400 leading-relaxed">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


const ConditionsList = ({ conditions }) => {
  const [ref, visible] = useReveal(200);
  const [activeTab, setActiveTab] = useState('anterior');

  return (
    <div
      ref={ref}
      className="mt-14"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(25px)',
        transition: 'all 0.7s ease-out',
      }}
    >
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-neutral-900/40 border-b border-neutral-800">
          <h3 className="text-neutral-200 text-lg font-medium">Conditions Screened</h3>
          <p className="text-neutral-600 text-sm mt-1">
            21 total conditions across both imaging modalities
          </p>
        </div>

        <div className="flex border-b border-neutral-800">
          {[
            { key: 'anterior', label: '👁️ Anterior Eye (13)' },
            { key: 'fundus', label: '🔬 Fundus / Retinal (8)' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors duration-200 ${activeTab === tab.key
                  ? 'text-neutral-200 border-b-2 border-neutral-400 bg-neutral-800/20'
                  : 'text-neutral-600 hover:text-neutral-400'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {conditions[activeTab].map((condition, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-neutral-800/40 
                           bg-neutral-900/20 hover:border-neutral-700 hover:bg-neutral-800/20 transition-all duration-200"
                style={{ animation: `slideUp 0.3s ease-out ${i * 0.04}s both` }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0" />
                <span className="text-neutral-400 text-sm">{condition}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


const ModelComparison = () => {
  const [ref, visible] = useReveal(300);

  return (
    <div
      ref={ref}
      className="mt-14"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(25px)',
        transition: 'all 0.7s ease-out',
      }}
    >
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-neutral-900/40 border-b border-neutral-800">
          <h3 className="text-neutral-200 text-lg font-medium">Model Comparison</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="text-left px-5 py-3 text-neutral-500 font-medium uppercase tracking-wider">
                  Specification
                </th>
                <th className="text-center px-5 py-3 text-neutral-500 font-medium uppercase tracking-wider">
                  👁️ Anterior
                </th>
                <th className="text-center px-5 py-3 text-neutral-500 font-medium uppercase tracking-wider">
                  🔬 Fundus
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {[
                ['Architecture', 'ViT-S/16 + CLS+GAP', 'ViT-S/16 + CLS+GAP'],
                ['Parameters', '~22.2M (~85 MB)', '~22.2M (~85 MB)'],
                ['Training Data', 'MISS Dataset', 'ODIR-5K + RFMiD (9,592 images)'],
                ['Classes', '13 lesion types', '8 (Normal + 7 conditions)'],
                ['AUC-ROC', '0.982', '0.889'],
                ['mAP', '0.922', '0.665'],
                ['F1 Score', '—', '0.631'],
                ['TTA Views', '3 (orig, hflip, vflip)', '5 (orig, hflip, vflip, rot90, rot270)'],
                ['Preprocessing', 'Glare removal', 'Border removal + CLAHE'],
                ['Thresholds', 'Per-class optimized', 'Per-class F1-optimized'],
                ['GPU Inference', '~4ms', '~4.3ms'],
              ].map(([spec, anterior, fundus], i) => (
                <tr key={i} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="px-5 py-3 text-neutral-400 font-medium">{spec}</td>
                  <td className="px-5 py-3 text-neutral-500 text-center">{anterior}</td>
                  <td className="px-5 py-3 text-neutral-500 text-center">{fundus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-neutral-800/40 bg-neutral-900/30">
          <p className="text-neutral-700 text-xs text-center leading-relaxed">
            Both models use EMA (Exponential Moving Average) weights for improved generalization.
            Thresholds are independently optimized per class on validation sets.
          </p>
        </div>
      </div>
    </div>
  );
};


export default About;