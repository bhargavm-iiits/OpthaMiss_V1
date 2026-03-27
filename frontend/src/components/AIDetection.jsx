import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const useReveal = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
};

/* ── urgency colour helpers ── */
const urgencyColor = (urgency) => {
  if (urgency === 'HIGH')     return 'border-red-900/60 bg-red-950/20 text-red-400';
  if (urgency === 'MODERATE') return 'border-amber-900/60 bg-amber-950/20 text-amber-400';
  return 'border-green-900/60 bg-green-950/20 text-green-400';
};

const urgencyIcon = (urgency) => {
  if (urgency === 'HIGH')     return '🔴';
  if (urgency === 'MODERATE') return '🟡';
  return '🟢';
};

const riskBadgeStyle = (risk) => {
  if (risk === 'HIGH')     return 'border-red-800/60 bg-red-950/30 text-red-300';
  if (risk === 'MODERATE') return 'border-amber-800/60 bg-amber-950/30 text-amber-300';
  return 'border-green-800/60 bg-green-950/30 text-green-300';
};

/* ── probability bar ── */
const ProbBar = ({ condition, probability, detected, watch }) => {
  const pct = Math.round(probability * 100);
  const barColor = detected
    ? 'bg-amber-600'
    : watch
    ? 'bg-neutral-500'
    : 'bg-neutral-700';

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-neutral-400 flex items-center gap-1">
          {detected && <span className="text-amber-500">⚠</span>}
          {watch && !detected && <span className="text-neutral-500">👁</span>}
          {condition}
        </span>
        <span className="text-neutral-500">{pct}%</span>
      </div>
      <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════ */
const AIDetection = () => {
  const [image,   setImage]   = useState(null);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [tab,     setTab]     = useState('detected'); // 'detected' | 'all'
  const [sectionRef, visible] = useReveal();

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setTab('detected');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  const handlePredict = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', image);

    try {
      const response = await axios.post(`${API_BASE_URL}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      setTab('detected');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Failed to connect to backend. Check your VITE_API_URL and backend deployment.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="detection" className="py-24 px-6 relative z-10">
      <div
        ref={sectionRef}
        className="max-w-6xl mx-auto"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'translateY(0)' : 'translateY(40px)',
          transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
        }}
      >
        {/* header */}
        <div className="text-center mb-12">
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-4">
            Diagnosis
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-neutral-100 mb-3">
            AI Eye Disease Screening
          </h2>
          <p className="text-neutral-500 text-sm max-w-lg mx-auto leading-relaxed">
            Upload an anterior eye image. Our ViT-S/16 model screens for
            13 conditions with mAP 0.922 and AUC 0.982.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">

          {/* ── LEFT: upload ── */}
          <div className="space-y-4">

            {/* dropzone */}
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? 'border-neutral-400 bg-neutral-800/30 scale-[1.01]'
                  : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900/50'
              }`}
            >
              <input {...getInputProps()} aria-label="Upload eye image" />
              {preview ? (
                <div className="space-y-3">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-neutral-600 text-xs">
                    Click or drop to replace
                  </p>
                </div>
              ) : (
                <div className="py-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full border border-neutral-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-neutral-400 text-sm mb-1">
                    Drop an eye image here or click to browse
                  </p>
                  <p className="text-neutral-600 text-xs">
                    JPG, PNG — anterior eye images only
                  </p>
                </div>
              )}
            </div>

            {/* model info cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Conditions',  value: '13' },
                { label: 'mAP Score',   value: '0.922' },
                { label: 'AUC-ROC',     value: '0.982' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="border border-neutral-800/60 rounded-lg p-3 text-center bg-neutral-900/20"
                >
                  <p className="text-neutral-200 text-lg font-light">{stat.value}</p>
                  <p className="text-neutral-600 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* detect button */}
            <button
              onClick={handlePredict}
              disabled={!image || loading}
              className="w-full py-3 border border-neutral-700 text-neutral-300 text-sm tracking-wider uppercase hover:bg-neutral-800 hover:border-neutral-500 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg"
            >
              {loading ? 'Analysing…' : 'Screen Eye'}
            </button>

            {/* disclaimer */}
            <p className="text-neutral-700 text-xs text-center leading-relaxed">
              ⚕️ AI-assisted screening only. Must be confirmed by a qualified ophthalmologist.
            </p>
          </div>

          {/* ── RIGHT: results ── */}
          <div className="border border-neutral-800 rounded-xl bg-neutral-900/20 flex flex-col min-h-[400px]">

            {/* loading */}
            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                  <div className="absolute inset-1 border-2 border-transparent border-b-neutral-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 text-sm">Analysing image…</p>
                  <p className="text-neutral-600 text-xs mt-1">Running TTA inference on ViT-S/16</p>
                </div>
              </div>
            )}

            {/* error */}
            {error && !loading && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="border border-red-900/50 bg-red-950/20 rounded-lg p-4 text-red-400 text-sm w-full" style={{ animation: 'slideUp 0.3s ease-out' }}>
                  <p className="font-medium mb-1">Error</p>
                  <p className="text-red-500/70 text-xs">{error}</p>
                </div>
              </div>
            )}

            {/* empty state */}
            {!loading && !result && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-16 h-16 rounded-full border border-neutral-800 flex items-center justify-center text-2xl">
                  👁️
                </div>
                <p className="text-neutral-500 text-sm">
                  Upload an eye image and click Screen Eye
                </p>
                <p className="text-neutral-700 text-xs">
                  Screens for 13 anterior eye conditions
                </p>
              </div>
            )}

            {/* results */}
            {result && !loading && (
              <div className="flex-1 flex flex-col" style={{ animation: 'slideUp 0.5s ease-out' }}>

                {/* overall risk banner */}
                <div className={`px-5 py-4 border-b border-neutral-800 rounded-t-xl ${riskBadgeStyle(result.overall_risk)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider opacity-70 mb-0.5">
                        Overall Risk
                      </p>
                      <p className="text-xl font-medium">
                        {result.overall_risk === 'HIGH'     && '🔴 '}
                        {result.overall_risk === 'MODERATE' && '🟡 '}
                        {result.overall_risk === 'NORMAL'   && '✅ '}
                        {result.overall_risk === 'LOW'      && '🟢 '}
                        {result.overall_risk}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-60">{result.screened_at}</p>
                      <p className="text-xs opacity-60 mt-0.5">{result.model}</p>
                    </div>
                  </div>
                  <p className="text-xs mt-2 opacity-80">{result.risk_action}</p>
                </div>

                {/* tabs */}
                <div className="flex border-b border-neutral-800">
                  {['detected', 'all'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 py-2.5 text-xs uppercase tracking-wider transition-colors duration-200 ${
                        tab === t
                          ? 'text-neutral-200 border-b-2 border-neutral-400'
                          : 'text-neutral-600 hover:text-neutral-400'
                      }`}
                    >
                      {t === 'detected'
                        ? `Detected (${result.detected.length})`
                        : 'All Results'}
                    </button>
                  ))}
                </div>

                {/* tab content */}
                <div className="flex-1 overflow-y-auto p-5">

                  {/* detected tab */}
                  {tab === 'detected' && (
                    <div>
                      {result.detected.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-4xl mb-3">✅</p>
                          <p className="text-neutral-300 text-sm font-medium">
                            No significant conditions detected
                          </p>
                          <p className="text-neutral-600 text-xs mt-2">
                            Routine screening recommended in 12 months
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {result.detected.map((d, i) => (
                            <div
                              key={i}
                              className={`border rounded-lg p-4 ${urgencyColor(d.urgency)}`}
                              style={{ animation: `slideUp 0.4s ease-out ${i * 0.08}s both` }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span>{urgencyIcon(d.urgency)}</span>
                                  <span className="text-sm font-medium">{d.condition}</span>
                                </div>
                                <span className="text-xs opacity-70">
                                  {Math.round(d.probability * 100)}%
                                </span>
                              </div>
                              <p className="text-xs opacity-80 leading-relaxed">
                                {d.action}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* all results tab */}
                  {tab === 'all' && (
                    <div className="space-y-2">
                      <p className="text-neutral-600 text-xs uppercase tracking-wider mb-4">
                        All 13 Conditions
                      </p>
                      {result.all_results.map((r, i) => (
                        <ProbBar key={i} {...r} />
                      ))}
                    </div>
                  )}
                </div>

                {/* footer */}
                <div className="px-5 py-3 border-t border-neutral-800/50 bg-neutral-900/30 rounded-b-xl">
                  <p className="text-neutral-700 text-[10px] text-center leading-relaxed">
                    ⚕️ AI screening only — confirm with qualified ophthalmologist
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIDetection;
