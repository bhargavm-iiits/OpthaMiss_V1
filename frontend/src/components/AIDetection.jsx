import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/* ── API helpers ── */
var API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
var buildUrl = function (ep) { return API_BASE + ep; };

var diagnoseError = async function (ep) {
  try {
    await axios.get(buildUrl('/health'), { timeout: 8000 });
    return 'Backend reachable but upload failed. Check the server logs.';
  } catch {
    return API_BASE
      ? 'Cannot connect to ' + API_BASE + '. Ensure the backend is running.'
      : 'Cannot connect to backend. Make sure the dev server proxy is configured.';
  }
};

/* ── Model config ── */
var MODELS = {
  anterior: {
    label: 'Anterior Eye',
    subtitle: 'External eye surface',
    desc: 'Cornea, lens, conjunctiva, anterior segment',
    endpoint: '/predict/anterior',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="16" rx="14" ry="9" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="5.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="2.5" fill="currentColor" />
        <circle cx="18" cy="14" r="1" fill="currentColor" fillOpacity="0.5" />
      </svg>
    ),
    stats: [
      { label: 'Conditions', value: '13' },
      { label: 'AUC-ROC', value: '0.982' },
      { label: 'mAP', value: '0.922' },
    ],
    tta: '3-view TTA',
    hint: 'Use the rear camera close-up with flash. Crop tightly around the eye.',
  },
  fundus: {
    label: 'Fundus (Posterior)',
    subtitle: 'Retinal imaging',
    desc: 'Optic disc, macula, retinal vessels',
    endpoint: '/predict/fundus',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        <circle cx="22" cy="12" r="2.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
        <line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
        <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
      </svg>
    ),
    stats: [
      { label: 'Conditions', value: '8' },
      { label: 'AUC-ROC', value: '0.889' },
      { label: 'F1', value: '0.631' },
    ],
    tta: '5-view TTA',
    hint: 'Use a retinal fundus photograph. Well-focused with optic disc visible.',
  },
};

/* ── Risk helpers ── */
var riskBadgeClass = function (risk) {
  if (risk === 'HIGH') return 'ui-badge ui-badge-high';
  if (risk === 'MODERATE') return 'ui-badge ui-badge-moderate';
  return 'ui-badge ui-badge-low';
};

var urgencyBg = function (urgency) {
  if (urgency === 'HIGH') return { background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', color: 'var(--risk-high-text)' };
  if (urgency === 'MODERATE') return { background: 'var(--risk-mod-bg)', border: '1px solid var(--risk-mod-border)', color: 'var(--risk-mod-text)' };
  return { background: 'var(--risk-low-bg)', border: '1px solid var(--risk-low-border)', color: 'var(--risk-low-text)' };
};

var overallBg = function (risk) {
  if (risk === 'HIGH') return { background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', color: 'var(--risk-high-text)' };
  if (risk === 'MODERATE') return { background: 'var(--risk-mod-bg)', border: '1px solid var(--risk-mod-border)', color: 'var(--risk-mod-text)' };
  return { background: 'var(--risk-low-bg)', border: '1px solid var(--risk-low-border)', color: 'var(--risk-low-text)' };
};

var getNow = function () {
  var d = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
};

/* ── Step indicator ── */
var StepBar = function ({ step }) {
  var steps = ['Select Type', 'Upload Image', 'Results'];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        marginBottom: '40px',
      }}
    >
      {steps.map(function (label, i) {
        var idx = i + 1;
        var isDone = step > idx;
        var isActive = step === idx;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Step circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                  background: isDone
                    ? 'var(--risk-low-bg)'
                    : isActive
                      ? 'var(--color-bg-4)'
                      : 'var(--color-bg-2)',
                  border: isDone
                    ? '2px solid var(--risk-low-border)'
                    : isActive
                      ? '2px solid var(--color-border-2)'
                      : '2px solid var(--color-border)',
                  color: isDone
                    ? 'var(--risk-low-text)'
                    : isActive
                      ? 'var(--color-text)'
                      : 'var(--color-text-4)',
                }}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : idx}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-4)',
                  transition: 'color 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: '80px',
                  height: '2px',
                  marginBottom: '22px',
                  background: step > idx ? 'var(--risk-low-border)' : 'var(--color-border)',
                  transition: 'background 0.4s ease',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Prob bar ── */
var ProbBar = function ({ condition, probability, detected }) {
  var pct = Math.round((probability || 0) * 100);
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-2)' }}>
          {detected && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--risk-high-text)', display: 'inline-block', flexShrink: 0 }} />
          )}
          {!detected && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-border-2)', display: 'inline-block', flexShrink: 0 }} />
          )}
          {condition}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-3)' }}>
          {pct}%
        </span>
      </div>
      <div className="ui-progress">
        <div
          className="ui-progress-fill"
          style={{
            width: pct + '%',
            background: detected ? 'var(--risk-high-text)' : 'var(--color-border-2)',
          }}
        />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
var AIDetection = function () {
  var navigate = useNavigate();
  /* Steps: 1 = select, 2 = upload, 3 = results */
  var [step, setStep] = useState(1);
  var [modelMode, setModelMode] = useState(null);   /* 'anterior' | 'fundus' */
  var [image, setImage] = useState(null);
  var [preview, setPreview] = useState(null);
  var [result, setResult] = useState(null);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var [tab, setTab] = useState('detected');
  var [shakeErr, setShakeErr] = useState(false);
  var [mounted, setMounted] = useState(false);

  var errorRef = useRef(null);

  useEffect(function () {
    var t = setTimeout(function () { setMounted(true); }, 50);
    return function () { clearTimeout(t); };
  }, []);

  /* Step 1 → 2 */
  var handleSelectModel = function (mode) {
    setModelMode(mode);
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setTimeout(function () { setStep(2); }, 120);
  };

  /* Step 2 → upload */
  var onDrop = useCallback(function (accepted) {
    var file = accepted[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }, []);

  var { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  var handleRemoveImage = function (e) {
    e.stopPropagation();
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  /* Step 2 → 3 (scan) */
  var handleScan = async function () {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    var config = MODELS[modelMode];
    var formData = new FormData();
    formData.append('file', image);

    try {
      var res = await axios.post(buildUrl(config.endpoint), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });

      /* Save to localStorage for dashboard / reports */
      var scanId = res.data.scan_id || ('SCN-' + Date.now());
      var scans = [];
      try { scans = JSON.parse(localStorage.getItem('optha_scans') || '[]'); } catch (_) { }
      scans.unshift({
        id: scanId, type: modelMode === 'anterior' ? 'Anterior' : 'Fundus',
        timestamp: new Date().toISOString(),
        risk: res.data.overall_risk || 'LOW',
        conditions: (res.data.detected || []).map(function (d) { return d.condition; }),
      });
      localStorage.setItem('optha_scans', JSON.stringify(scans.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('optha_scan_added', { detail: scans[0] }));

      setResult({ ...res.data, scan_id: scanId });
      setTab('detected');
      setStep(3);
    } catch (err) {
      var msg = '';
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        msg = await diagnoseError(config.endpoint);
      } else if (err.code === 'ECONNABORTED') {
        msg = 'Request timed out. Model may still be loading — try again.';
      } else if (err.response?.status === 500) {
        msg = 'Server error: ' + (err.response?.data?.detail || 'Inference failed.');
      } else {
        msg = err.response?.data?.detail || err.message || 'Unknown error.';
      }
      setError(msg);
      setShakeErr(true);
      setTimeout(function () { setShakeErr(false); }, 600);
    }
    setLoading(false);
  };

  /* Reset all */
  var handleReset = function () {
    setStep(1);
    setModelMode(null);
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setTab('detected');
  };

  var handleGoBack = function () {
    if (step === 2) { setStep(1); setModelMode(null); setImage(null); setPreview(null); setError(null); }
    if (step === 3) { setStep(2); setResult(null); setError(null); }
  };

  var config = modelMode ? MODELS[modelMode] : null;

  return (
    <section
      id="detection"
      style={{
        minHeight: '100vh',
        padding: '60px 0 80px',
        background: 'var(--color-bg)',
        position: 'relative',
      }}
    >
      <div
        className="ui-container-md"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* ── Page header ── */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p className="ui-eyebrow" style={{ marginBottom: '10px' }}>AI Screening</p>
          <h1 className="ui-h2" style={{ marginBottom: '10px' }}>Eye Disease Detection</h1>
          <p className="ui-text" style={{ maxWidth: '440px', margin: '0 auto' }}>
            Upload an eye image for instant AI-powered screening across 21 conditions.
          </p>
        </div>

        {/* ── Step indicator ── */}
        <StepBar step={step} />

        {/* ════════════════════════════════
            STEP 1 — Select model
        ════════════════════════════════ */}
        {step === 1 && (
          <div
            className="animate-slide-up"
            style={{ maxWidth: '600px', margin: '0 auto' }}
          >
            <p
              style={{
                textAlign: 'center',
                fontSize: '13px',
                color: 'var(--color-text-3)',
                marginBottom: '20px',
              }}
            >
              Choose the type of eye image you want to screen:
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              {Object.entries(MODELS).map(function ([key, cfg]) {
                return (
                  <SelectionCard
                    key={key}
                    cfg={cfg}
                    onSelect={function () { handleSelectModel(key); }}
                  />
                );
              })}
            </div>

            {/* Disclaimer */}
            <div
              style={{
                marginTop: '28px',
                padding: '14px 16px',
                borderRadius: '10px',
                background: 'var(--color-bg-2)',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                color: 'var(--color-text-4)',
                lineHeight: 1.6,
                textAlign: 'center',
              }}
            >
              AI-assisted screening only — not a substitute for clinical diagnosis.
              All findings must be confirmed by a qualified ophthalmologist.
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            STEP 2 — Upload
        ════════════════════════════════ */}
        {step === 2 && config && (
          <div className="animate-slide-up" style={{ maxWidth: '560px', margin: '0 auto' }}>

            {/* Back + model label */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <button type="button" onClick={handleGoBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', color: 'var(--color-text-3)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', transition: 'color 0.2s ease',
                }}
                onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-3)'; }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 12px', borderRadius: '99px',
                  background: 'var(--color-bg-3)',
                  border: '1px solid var(--color-border-2)',
                }}
              >
                <span style={{ color: 'var(--color-text-2)', display: 'flex' }}>{config.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)' }}>
                  {config.label}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              {config.stats.map(function (s, i) {
                return (
                  <div
                    key={i}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      borderRadius: '10px',
                      background: 'var(--color-bg-3)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                      {s.value}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-4)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              style={{
                borderRadius: '14px',
                border: '2px dashed ' + (isDragActive ? 'var(--color-border-2)' : 'var(--color-border)'),
                background: isDragActive ? 'var(--color-bg-4)' : 'var(--color-bg-2)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                overflow: 'hidden',
                position: 'relative',
                minHeight: '220px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
              onMouseEnter={function (e) {
                if (!preview) {
                  e.currentTarget.style.borderColor = 'var(--color-border-2)';
                  e.currentTarget.style.background = 'var(--color-bg-3)';
                }
              }}
              onMouseLeave={function (e) {
                if (!preview) {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = 'var(--color-bg-2)';
                }
              }}
            >
              <input {...getInputProps()} />

              {preview ? (
                /* Image preview */
                <div style={{ width: '100%', position: 'relative' }}>
                  <img
                    src={preview}
                    alt="Preview"
                    loading="lazy"
                    decoding="async"
                    style={{
                      maxHeight: '260px',
                      width: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: 'rgba(10,10,10,0.75)',
                      border: '1px solid var(--color-border-2)',
                      color: 'var(--color-text-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={function (e) { e.currentTarget.style.background = 'rgba(127,29,29,0.7)'; }}
                    onMouseLeave={function (e) { e.currentTarget.style.background = 'rgba(10,10,10,0.75)'; }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      padding: '8px 12px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                      Click or drag to replace
                    </p>
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '52px', height: '52px',
                      borderRadius: '12px',
                      background: 'var(--color-bg-3)',
                      border: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <svg
                      style={{ width: '24px', height: '24px', color: 'var(--color-text-4)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-2)', marginBottom: '6px' }}>
                    {isDragActive ? 'Drop your image here' : 'Drag & drop or click to browse'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-4)' }}>
                    JPG, PNG — {config.label} images
                  </p>
                </div>
              )}
            </div>

            {/* Tip */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--color-bg-2)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <svg style={{ width: '15px', height: '15px', color: 'var(--color-text-4)', flexShrink: 0, marginTop: '1px' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontSize: '12px', color: 'var(--color-text-4)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--color-text-3)' }}>Tip:</strong> {config.hint}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                ref={errorRef}
                className={shakeErr ? 'animate-shake' : ''}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--risk-high-bg)',
                  border: '1px solid var(--risk-high-border)',
                  marginBottom: '16px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <svg style={{ width: '15px', height: '15px', color: 'var(--risk-high-text)', flexShrink: 0, marginTop: '1px' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p style={{ fontSize: '13px', color: 'var(--risk-high-text)', lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            {/* Scan button */}
            <button
              type="button"
              onClick={handleScan}
              disabled={!image || loading}
              style={{
                width: '100%',
                padding: '13px 24px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: !image || loading ? 'not-allowed' : 'pointer',
                opacity: !image || loading ? 0.45 : 1,
                transition: 'all 0.25s ease',
                background: 'var(--color-bg-3)',
                border: '1px solid var(--color-border-2)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={function (e) {
                if (image && !loading) {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--color-accent-2)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }
              }}
              onMouseLeave={function (e) {
                e.currentTarget.style.background = 'var(--color-bg-3)';
                e.currentTarget.style.borderColor = 'var(--color-border-2)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing — {config.tta}…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {image ? 'Scan Image' : 'Upload an image first'}
                </>
              )}
            </button>

            {/* Loading details */}
            {loading && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--color-bg-2)',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center',
                }}
              >
                <div
                  className="animate-pulse-glow"
                  style={{
                    width: '48px', height: '48px',
                    borderRadius: '50%',
                    background: 'var(--color-bg-4)',
                    border: '2px solid var(--color-border-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: '20px',
                  }}
                >
                  👁️
                </div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-2)', marginBottom: '4px' }}>
                  Analysing image…
                </p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-4)' }}>
                  Running {config.tta} inference on ViT-S/16
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════
            STEP 3 — Results
        ════════════════════════════════ */}
        {step === 3 && result && config && (
          <div className="animate-scale-in" style={{ maxWidth: '640px', margin: '0 auto' }}>

            {/* Back */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button type="button" onClick={handleGoBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', color: 'var(--color-text-3)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', transition: 'color 0.2s ease',
                }}
                onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-3)'; }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Upload
              </button>

              <button
                type="button"
                onClick={handleReset}
                style={{
                  fontSize: '12px', color: 'var(--color-text-4)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', transition: 'color 0.2s ease',
                }}
                onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text-2)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-4)'; }}
              >
                New Scan ↺
              </button>
            </div>

            {/* Overall risk banner */}
            <div
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                marginBottom: '16px',
                border: overallBg(result.overall_risk).border,
                background: overallBg(result.overall_risk).background,
              }}
            >
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: overallBg(result.overall_risk).color, opacity: 0.7, marginBottom: '4px' }}>
                      Overall Risk
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 700, color: overallBg(result.overall_risk).color }}>
                      {result.overall_risk}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '11px', opacity: 0.6, color: overallBg(result.overall_risk).color }}>
                      {result.screened_at || getNow()}
                    </p>
                    <p style={{ fontSize: '11px', opacity: 0.6, color: overallBg(result.overall_risk).color, marginTop: '2px' }}>
                      {config.label}
                    </p>
                  </div>
                </div>
                {result.risk_action && (
                  <p style={{ fontSize: '13px', opacity: 0.85, color: overallBg(result.overall_risk).color, lineHeight: 1.5, paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {result.risk_action}
                  </p>
                )}
              </div>

              {/* Normal probability (fundus) */}
              {result.normal_probability !== undefined && (
                <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.7, color: overallBg(result.overall_risk).color }}>Normal Eye Probability</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: overallBg(result.overall_risk).color }}>
                      {Math.round(result.normal_probability * 100)}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'rgba(255,255,255,0.4)', borderRadius: '2px', width: Math.round(result.normal_probability * 100) + '%', transition: 'width 1s ease' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Results card */}
            <div
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                background: 'var(--color-bg-3)',
                border: '1px solid var(--color-border)',
                marginBottom: '14px',
              }}
            >
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
                {['detected', 'all'].map(function (t) {
                  var label = t === 'detected'
                    ? 'Detected (' + (result.detected?.length || 0) + ')'
                    : 'All Results';
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={function () { setTab(t); }}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: tab === t ? 600 : 400,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: tab === t ? '2px solid var(--color-border-2)' : '2px solid transparent',
                        color: tab === t ? 'var(--color-text)' : 'var(--color-text-4)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>

                {/* Detected */}
                {tab === 'detected' && (
                  <div>
                    {!result.detected || result.detected.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
                        <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                          No significant conditions detected
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-4)' }}>
                          Routine screening recommended in 12 months
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {result.detected.map(function (d, i) {
                          var ubs = urgencyBg(d.urgency);
                          return (
                            <div
                              key={i}
                              style={{
                                borderRadius: '10px',
                                overflow: 'hidden',
                                border: ubs.border,
                                background: ubs.background,
                              }}
                            >
                              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 600, color: ubs.color }}>
                                        {d.condition}
                                      </span>
                                      {d.short_name && (
                                        <span style={{ fontSize: '11px', color: ubs.color, opacity: 0.5 }}>
                                          ({d.short_name})
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, color: ubs.color }}>
                                      {d.urgency} urgency
                                    </span>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: '20px', fontWeight: 700, color: ubs.color }}>
                                      {Math.round(d.probability * 100)}%
                                    </p>
                                    <p style={{ fontSize: '10px', opacity: 0.6, color: ubs.color }}>confidence</p>
                                  </div>
                                </div>
                              </div>
                              <div style={{ padding: '12px 16px' }}>
                                {d.description && (
                                  <p style={{ fontSize: '12px', fontStyle: 'italic', opacity: 0.7, color: ubs.color, marginBottom: '8px', lineHeight: 1.5 }}>
                                    {d.description}
                                  </p>
                                )}
                                <div
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(0,0,0,0.15)',
                                  }}
                                >
                                  <p style={{ fontSize: '11px', opacity: 0.55, color: ubs.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                                    Recommended Action
                                  </p>
                                  <p style={{ fontSize: '13px', opacity: 0.9, color: ubs.color, lineHeight: 1.5 }}>
                                    {d.action}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* All results */}
                {tab === 'all' && (
                  <div>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
                      All {result.all_results?.length || 0} conditions — probability scores
                    </p>
                    {result.all_results
                      ? [...result.all_results]
                        .sort(function (a, b) { return b.probability - a.probability; })
                        .map(function (r, i) {
                          return <ProbBar key={i} {...r} />;
                        })
                      : (
                        <p style={{ color: 'var(--color-text-4)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                          No detailed results available.
                        </p>
                      )
                    }
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--color-border)',
                  background: 'var(--color-bg-2)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '4px',
                }}
              >
                <p style={{ fontSize: '11px', color: 'var(--color-text-4)' }}>
                  {config.label} · AUC {config.stats.find(function (s) { return s.label === 'AUC-ROC'; })?.value} · {config.tta}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-4)' }}>
                  {result.screened_at || getNow()}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={function () {
                  var scanId = result.scan_id || 'SCN-' + Date.now();
                  navigate('/report/' + scanId);
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  background: 'var(--color-bg-3)',
                  border: '1px solid var(--color-border-2)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={function (e) {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--color-accent-2)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.background = 'var(--color-bg-3)';
                  e.currentTarget.style.borderColor = 'var(--color-border-2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Full Report
              </button>

              <button
                type="button"
                onClick={handleReset}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-3)',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={function (e) {
                  e.currentTarget.style.background = 'var(--color-bg-3)';
                  e.currentTarget.style.borderColor = 'var(--color-border-2)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.color = 'var(--color-text-3)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Scan
              </button>
            </div>

            {/* Disclaimer */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--color-bg-2)',
                border: '1px solid var(--color-border)',
                fontSize: '11px',
                color: 'var(--color-text-4)',
                lineHeight: 1.6,
                textAlign: 'center',
              }}
            >
              AI-assisted screening only. All findings must be confirmed by a qualified ophthalmologist before any treatment decisions.
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

/* ── Selection card (Step 1) ── */
var SelectionCard = function ({ cfg, onSelect }) {
  var [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}
      style={{
        width: '100%',
        padding: '24px 20px',
        borderRadius: '14px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        background: hov ? 'var(--color-bg-4)' : 'var(--color-bg-3)',
        border: '2px solid ' + (hov ? 'var(--color-border-2)' : 'var(--color-border)'),
        boxShadow: hov ? 'var(--shadow-glow)' : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '48px', height: '48px',
          borderRadius: '12px',
          background: 'var(--color-bg-2)',
          border: '1px solid ' + (hov ? 'var(--color-border-2)' : 'var(--color-border)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: hov ? 'var(--color-text)' : 'var(--color-text-3)',
          transition: 'all 0.25s ease',
          flexShrink: 0,
        }}
      >
        {cfg.icon}
      </div>

      {/* Text */}
      <div>
        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
          {cfg.label}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '8px' }}>
          {cfg.subtitle}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-4)', lineHeight: 1.5 }}>
          {cfg.desc}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {cfg.stats.map(function (s, i) {
          return (
            <div
              key={i}
              style={{
                padding: '3px 9px',
                borderRadius: '99px',
                background: 'var(--color-bg-2)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-text-3)', fontWeight: 500 }}>
                {s.value} {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: hov ? 'var(--color-text-2)' : 'var(--color-text-4)', transition: 'color 0.2s ease' }}>
          Select this type →
        </span>
      </div>
    </button>
  );
};

export default AIDetection;
