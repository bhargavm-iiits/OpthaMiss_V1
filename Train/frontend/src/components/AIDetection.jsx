import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const API_DISPLAY_URL = API_BASE_URL || window.location.origin;

const buildApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

const diagnoseNetworkError = async (endpoint) => {
  try {
    await axios.get(buildApiUrl('/health'), { timeout: 10000 });
    return `Backend is reachable at ${API_DISPLAY_URL}, but the upload request to ${endpoint} failed before the server returned a response. This is usually a browser, CORS, proxy, or HTTPS issue rather than the API being down.`;
  } catch {
    if (API_BASE_URL) {
      return `Cannot connect to backend at ${API_DISPLAY_URL}. The configured API URL may be unavailable, sleeping, or blocked from this browser.`;
    }

    return 'Cannot connect to the backend through the local dev proxy. Make sure the frontend dev server is running and proxying requests to http://localhost:8000.';
  }
};

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

/* ── helpers ── */
const urgencyColor = (urgency) => {
  if (urgency === 'HIGH') return 'border-red-900/60 bg-red-950/20 text-red-400';
  if (urgency === 'MODERATE') return 'border-amber-900/60 bg-amber-950/20 text-amber-400';
  if (urgency === 'NONE') return 'border-green-900/60 bg-green-950/20 text-green-400';
  return 'border-green-900/60 bg-green-950/20 text-green-400';
};

const urgencyIcon = (urgency) => {
  if (urgency === 'HIGH') return '🔴';
  if (urgency === 'MODERATE') return '🟡';
  if (urgency === 'NONE') return '✅';
  return '🟢';
};

const riskBadgeStyle = (risk) => {
  if (risk === 'HIGH') return 'border-red-800/60 bg-red-950/30 text-red-300';
  if (risk === 'MODERATE') return 'border-amber-800/60 bg-amber-950/30 text-amber-300';
  return 'border-green-800/60 bg-green-950/30 text-green-300';
};

const riskEmoji = (risk) => {
  if (risk === 'HIGH') return '🔴';
  if (risk === 'MODERATE') return '🟡';
  if (risk === 'NORMAL') return '✅';
  if (risk === 'LOW') return '🟢';
  return '';
};

const getNow = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/* ── probability bar ── */
const ProbBar = ({ condition, probability, detected, watch, short_name, threshold }) => {
  const pct = Math.round(probability * 100);
  const barColor = detected
    ? 'bg-amber-600'
    : watch
      ? 'bg-neutral-500'
      : 'bg-neutral-700';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-neutral-400 flex items-center gap-1">
          {detected && <span className="text-amber-500">●</span>}
          {watch && !detected && <span className="text-neutral-500">◐</span>}
          {condition}
          {short_name && <span className="text-neutral-600">({short_name})</span>}
        </span>
        <span className="text-neutral-500">
          {pct}%
          {threshold !== undefined && (
            <span className="text-neutral-700 ml-1">/ {Math.round(threshold * 100)}%</span>
          )}
        </span>
      </div>
      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};


/* ── Image quality instructions per mode ── */
const AnteriorInstructions = () => (
  <div className="border border-neutral-800/60 rounded-xl p-5 bg-neutral-900/30 space-y-3">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg">📸</span>
      <h4 className="text-neutral-300 text-sm font-medium uppercase tracking-wider">
        Image Quality Instructions
      </h4>
    </div>
    <p className="text-neutral-500 text-sm leading-relaxed">
      For best results:
    </p>
    <ul className="space-y-2 text-sm text-neutral-500 leading-relaxed">
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Crop the image tightly around the eye (<span className="text-neutral-400">eye-centric framing</span>).</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Use a <span className="text-neutral-400">close-up shot with flash turned on</span> to minimise motion blur and ensure good illumination.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>The app will automatically remove most glare, but a well-exposed image yields the highest accuracy.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Preferred resolution: <span className="text-neutral-400">≥ 640×480 px</span> (higher is better, up to 2048×2048).</span>
      </li>
    </ul>

    <div className="pt-2 border-t border-neutral-800/40">
      <p className="text-neutral-700 text-xs leading-relaxed">
        Screened: {getNow()} | MISS-EyeScreen v4 | mAP: 0.922 | AUC: 0.982
      </p>
    </div>

    <div className="bg-neutral-900/50 border border-neutral-800/40 rounded-lg px-3 py-2">
      <p className="text-neutral-600 text-xs leading-relaxed">
        <span className="text-neutral-500">⚕️ DISCLAIMER:</span> AI-assisted screening only.
        All results must be confirmed by a qualified ophthalmologist.
        This is a screening tool, not a diagnostic device.
      </p>
    </div>
  </div>
);

const FundusInstructions = () => (
  <div className="border border-neutral-800/60 rounded-xl p-5 bg-neutral-900/30 space-y-3">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg">📸</span>
      <h4 className="text-neutral-300 text-sm font-medium uppercase tracking-wider">
        For Best Results
      </h4>
    </div>
    <ul className="space-y-2 text-sm text-neutral-500 leading-relaxed">
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Use a <span className="text-neutral-400">retinal fundus photograph</span> (not an external eye photo).</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Ensure the image is <span className="text-neutral-400">well-focused</span> with the optic disc visible.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Images from smartphone-attached fundus cameras (e.g., <span className="text-neutral-400">D-Eye, Peek Retina</span>) work well.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>The system automatically <span className="text-neutral-400">enhances contrast</span> and <span className="text-neutral-400">removes dark borders</span>.</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-neutral-600 mt-0.5">•</span>
        <span>Preferred resolution: <span className="text-neutral-400">≥ 512×512 px</span> (optimal: 1024×1024 or higher).</span>
      </li>
    </ul>

    <div className="pt-2 border-t border-neutral-800/40">
      <p className="text-neutral-700 text-xs leading-relaxed">
        Screened: {getNow()} | Model: ViT-S/16 + CLS+GAP (v3) | AUC: 0.889 | F1: 0.631 | 5-view TTA
      </p>
    </div>

    <div className="bg-neutral-900/50 border border-neutral-800/40 rounded-lg px-3 py-2">
      <p className="text-neutral-600 text-xs leading-relaxed">
        <span className="text-neutral-500">⚕️ DISCLAIMER:</span> This is an AI-assisted screening tool,
        NOT a diagnostic device. All results must be confirmed by a qualified ophthalmologist.
        This system is designed for tele-ophthalmology screening in remote/underserved areas.
      </p>
    </div>
  </div>
);


/* ── Model mode config ── */
const MODEL_CONFIG = {
  anterior: {
    label: 'Anterior Eye',
    subtitle: 'External eye surface — cornea, lens, conjunctiva',
    endpoint: '/predict/anterior',
    description: 'Upload an anterior (external) eye image for AI screening.',
    stats: [
      { label: 'Conditions', value: '13' },
      { label: 'mAP Score', value: '0.922' },
      { label: 'AUC-ROC', value: '0.982' },
    ],
    conditionCount: '13 anterior eye conditions',
    fileHint: 'JPG, PNG — anterior eye images',
    icon: '👁️',
  },
  fundus: {
    label: 'Fundus (Posterior)',
    subtitle: 'Retinal fundus — optic disc, macula, vessels',
    endpoint: '/predict/fundus',
    description: 'Upload a retinal fundus photograph for AI screening.',
    stats: [
      { label: 'Conditions', value: '8' },
      { label: 'AUC-ROC', value: '0.889' },
      { label: 'F1 Score', value: '0.631' },
    ],
    conditionCount: '8 fundus eye conditions',
    fileHint: 'JPG, PNG — retinal fundus images',
    icon: '🔬',
  },
};


/* ══════════════════════════════════════════════════════════════ */
const AIDetection = () => {
  const [modelMode, setModelMode] = useState('anterior');

  const [anteriorState, setAnteriorState] = useState({
    image: null, preview: null, result: null, loading: false, error: null, tab: 'detected',
  });
  const [fundusState, setFundusState] = useState({
    image: null, preview: null, result: null, loading: false, error: null, tab: 'detected',
  });

  const state = modelMode === 'anterior' ? anteriorState : fundusState;
  const setState = modelMode === 'anterior' ? setAnteriorState : setFundusState;
  const config = MODEL_CONFIG[modelMode];

  const [sectionRef, visible] = useReveal();

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setState(prev => ({
        ...prev,
        image: file,
        preview: URL.createObjectURL(file),
        result: null,
        error: null,
        tab: 'detected',
      }));
    }
  }, [setState]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  const handleReset = (e) => {
    e.stopPropagation();
    setState(prev => ({
      ...prev,
      image: null,
      preview: null,
      result: null,
      error: null,
      tab: 'detected',
    }));
  };

  const handleModeSwitch = (mode) => {
    setModelMode(mode);
  };

  const handlePredict = async () => {
    if (!state.image) return;
    setState(prev => ({ ...prev, loading: true, error: null, result: null }));

    const formData = new FormData();
    formData.append('file', state.image);

    const url = buildApiUrl(config.endpoint);

    try {
      const response = await axios.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setState(prev => ({ ...prev, result: response.data, tab: 'detected', loading: false }));
    } catch (err) {
      let errorMsg;
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        errorMsg = await diagnoseNetworkError(config.endpoint);
      } else if (err.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. The model may be loading — try again in a few seconds.';
      } else if (err.response?.status === 500) {
        errorMsg = `Server error: ${err.response?.data?.detail || 'Model inference failed. Check backend logs.'}`;
      } else {
        errorMsg = err.response?.data?.detail || err.message || 'Unknown error occurred.';
      }
      setState(prev => ({ ...prev, error: errorMsg, loading: false }));
    }
  };

  const displayModelName = state.result?.model_name || state.result?.model || config.label;

  return (
    <section id="detection" className="py-24 px-6 relative z-10">
      <div
        ref={sectionRef}
        className="max-w-6xl mx-auto"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(40px)',
          transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
        }}
      >
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-4">
            Diagnosis
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-neutral-100 mb-3">
            AI Eye Disease Screening
          </h2>
          <p className="text-neutral-500 text-base max-w-xl mx-auto leading-relaxed">
            Select the type of eye image below, then upload for instant AI screening.
          </p>
        </div>

        {/* Mode switcher */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900/40 p-1 gap-1">
            {(['anterior', 'fundus']).map((mode) => {
              const mc = MODEL_CONFIG[mode];
              const isActive = modelMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleModeSwitch(mode)}
                  className={`
                    relative px-6 py-3 rounded-lg text-sm font-medium transition-all duration-300
                    ${isActive
                      ? 'bg-neutral-800 text-neutral-100 shadow-lg shadow-neutral-900/50'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40'
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{mc.icon}</span>
                    <span className="flex flex-col items-start">
                      <span className="leading-tight text-sm">{mc.label}</span>
                      <span className={`text-xs leading-tight ${isActive ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {mc.subtitle}
                      </span>
                    </span>
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-neutral-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* LEFT: upload + instructions */}
          <div className="space-y-5">

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`relative border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${isDragActive
                  ? 'border-neutral-400 bg-neutral-800/30 scale-[1.01]'
                  : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900/50'
                }`}
            >
              <input {...getInputProps()} aria-label={`Upload ${config.label} image`} />

              {state.preview ? (
                <div className="space-y-3 relative">
                  <button
                    onClick={handleReset}
                    className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-neutral-800 border border-neutral-600 
                               flex items-center justify-center text-neutral-400 hover:text-red-400 hover:border-red-500 
                               hover:bg-red-950/40 transition-all duration-200 shadow-lg"
                    title="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <img
                    src={state.preview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-neutral-600 text-sm">
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
                  <p className="text-neutral-400 text-base mb-1">
                    Drop an eye image here or click to browse
                  </p>
                  <p className="text-neutral-600 text-sm">
                    {config.fileHint}
                  </p>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {config.stats.map((stat, i) => (
                <div
                  key={i}
                  className="border border-neutral-800/60 rounded-lg p-3 text-center bg-neutral-900/20"
                >
                  <p className="text-neutral-200 text-xl font-light">{stat.value}</p>
                  <p className="text-neutral-600 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Screen button */}
            <button
              onClick={handlePredict}
              disabled={!state.image || state.loading}
              className="w-full py-3 border border-neutral-700 text-neutral-300 text-sm tracking-wider rounded-lg
                         hover:bg-neutral-800 hover:border-neutral-600 transition-all duration-300
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              {state.loading ? 'Analysing…' : `Screen ${config.label}`}
            </button>

            {/* Mode-specific instructions */}
            {modelMode === 'anterior' ? <AnteriorInstructions /> : <FundusInstructions />}

          </div>

          {/* RIGHT: results */}
          <div className="border border-neutral-800 rounded-xl bg-neutral-900/20 flex flex-col min-h-[420px]">

            {/* Loading */}
            {state.loading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                  <div className="absolute inset-1 border-2 border-transparent border-b-neutral-500 rounded-full animate-spin direction-reverse" />
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 text-sm">Analysing image…</p>
                  <p className="text-neutral-600 text-xs mt-1">
                    Running {modelMode === 'fundus' ? '5-view' : '3-view'} TTA inference on ViT-S/16
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {state.error && !state.loading && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="border border-red-900/50 bg-red-950/20 rounded-lg p-4 text-red-400 text-sm max-w-sm">
                  <p className="font-medium mb-1">Error</p>
                  <p className="text-red-500/70 text-xs">{state.error}</p>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!state.loading && !state.result && !state.error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-16 h-16 rounded-full border border-neutral-800 flex items-center justify-center text-2xl">
                  {config.icon}
                </div>
                <p className="text-neutral-500 text-base">
                  Upload an eye image and click Screen
                </p>
                <p className="text-neutral-700 text-sm">
                  Screens for {config.conditionCount}
                </p>
              </div>
            )}

            {/* Results */}
            {state.result && !state.loading && (
              <div className="flex-1 flex flex-col" style={{ animation: 'slideUp 0.5s ease-out' }}>

                {/* Risk banner */}
                <div className={`px-5 py-4 border-b border-neutral-800 rounded-t-xl ${riskBadgeStyle(state.result.overall_risk)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider opacity-70 mb-0.5">
                        Overall Risk
                      </p>
                      <p className="text-xl font-medium">
                        {riskEmoji(state.result.overall_risk)}{' '}
                        {state.result.overall_risk}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-60">{state.result.screened_at}</p>
                      <p className="text-xs opacity-60 mt-0.5">{displayModelName}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-2 opacity-80">{state.result.risk_action}</p>

                  {modelMode === 'fundus' && state.result.normal_probability !== undefined && (
                    <div className="mt-3 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs">
                        <span className="opacity-70">Normal Eye Probability</span>
                        <span className="font-medium">
                          {Math.round(state.result.normal_probability * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-black/20 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-green-500/60 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.round(state.result.normal_probability * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Result tabs */}
                <div className="flex border-b border-neutral-800">
                  {['detected', 'all'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setState(prev => ({ ...prev, tab: t }))}
                      className={`flex-1 py-2.5 text-xs uppercase tracking-wider transition-colors duration-200 ${state.tab === t
                          ? 'text-neutral-200 border-b-2 border-neutral-400'
                          : 'text-neutral-600 hover:text-neutral-400'
                        }`}
                    >
                      {t === 'detected'
                        ? `Detected (${state.result.detected.length})`
                        : 'All Results'}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-5">

                  {state.tab === 'detected' && (
                    <div>
                      {state.result.detected.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-4xl mb-3">✅</p>
                          <p className="text-neutral-300 text-base font-medium">
                            No significant conditions detected
                          </p>
                          <p className="text-neutral-600 text-sm mt-2">
                            Routine screening recommended in 12 months
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {state.result.detected.map((d, i) => (
                            <div
                              key={i}
                              className={`border rounded-lg p-4 ${urgencyColor(d.urgency)}`}
                              style={{ animation: `slideUp 0.4s ease-out ${i * 0.08}s both` }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span>{urgencyIcon(d.urgency)}</span>
                                  <span className="text-sm font-medium">{d.condition}</span>
                                  {d.short_name && (
                                    <span className="text-xs opacity-50">({d.short_name})</span>
                                  )}
                                </div>
                                <span className="text-sm opacity-70">
                                  {Math.round(d.probability * 100)}%
                                </span>
                              </div>
                              {d.description && (
                                <p className="text-xs opacity-60 leading-relaxed mb-1.5 italic">
                                  {d.description}
                                </p>
                              )}
                              <p className="text-sm opacity-80 leading-relaxed">
                                {d.action}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {state.tab === 'all' && (
                    <div className="space-y-2">
                      <p className="text-neutral-600 text-xs uppercase tracking-wider mb-4">
                        {modelMode === 'anterior' ? 'All 13 Conditions' : 'All 8 Conditions'}
                      </p>
                      {state.result.all_results.map((r, i) => (
                        <ProbBar key={i} {...r} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Results footer */}
                <div className="px-5 py-3 border-t border-neutral-800/50 bg-neutral-900/30 rounded-b-xl space-y-1">
                  <p className="text-neutral-700 text-xs text-center leading-relaxed">
                    {modelMode === 'anterior'
                      ? `Screened: ${getNow()} | MISS-EyeScreen v4 | mAP: 0.922 | AUC: 0.982`
                      : `Screened: ${getNow()} | ViT-S/16 + CLS+GAP (v3) | AUC: 0.889 | F1: 0.631 | 5-view TTA`
                    }
                  </p>
                  <p className="text-neutral-700 text-xs text-center leading-relaxed">
                    ⚕️ AI-assisted screening only — must be confirmed by a qualified ophthalmologist.
                    {modelMode === 'fundus' && ' Designed for tele-ophthalmology in remote/underserved areas.'}
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
