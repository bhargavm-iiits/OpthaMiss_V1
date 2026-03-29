import { useState } from 'react';

/* ══════════════════════════════════════════════
   BUTTON
══════════════════════════════════════════════ */
export var Button = function ({ children, variant, size, disabled, loading, onClick, type, className }) {
  var base = 'inline-flex items-center justify-center gap-1.5 font-medium font-sans transition-all duration-300 cursor-pointer select-none border outline-none';

  var variants = {
    default: 'bg-n-750 border-n-500 text-n-50 hover:bg-n-700 hover:border-n-400 hover:shadow-glow',
    ghost:   'bg-transparent border-n-700 text-n-200 hover:bg-n-800 hover:border-n-500',
    danger:  'bg-red-950/30 border-red-800/40 text-red-300 hover:bg-red-950/50 hover:border-red-700/60',
    success: 'bg-green-950/30 border-green-800/40 text-green-300 hover:bg-green-950/50',
  };

  var sizes = {
    xs: 'text-xs px-2.5 py-1.5 rounded-md',
    sm: 'text-xs px-3 py-2 rounded-md',
    md: 'text-sm px-4 py-2.5 rounded-lg',
    lg: 'text-sm px-6 py-3 rounded-xl',
    xl: 'text-base px-8 py-3.5 rounded-xl',
  };

  var v = variants[variant || 'default'];
  var s = sizes[size || 'md'];
  var dis = disabled || loading ? 'opacity-40 cursor-not-allowed pointer-events-none' : '';

  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled || loading}
      className={[base, v, s, dis, className || ''].join(' ')}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};

/* ══════════════════════════════════════════════
   CARD
══════════════════════════════════════════════ */
export var Card = function ({ children, className, hover, onClick, padding }) {
  var base = 'bg-n-800 border border-n-700 rounded-xl transition-all duration-300';
  var h = hover ? 'hover:border-n-500 hover:shadow-sm cursor-pointer' : '';
  var p = padding !== false ? 'p-5' : '';
  return (
    <div onClick={onClick} className={[base, h, p, className || ''].join(' ')}>
      {children}
    </div>
  );
};

export var CardHeader = function ({ children, className }) {
  return (
    <div className={['flex items-center justify-between pb-4 mb-4 border-b border-n-700', className || ''].join(' ')}>
      {children}
    </div>
  );
};

/* ══════════════════════════════════════════════
   INPUT
══════════════════════════════════════════════ */
export var Input = function ({ label, error, type, name, value, onChange, placeholder, disabled, required, className }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-n-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <input
        type={type || 'text'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={[
          'w-full px-4 py-2.5 text-sm rounded-lg outline-none transition-all duration-300',
          'bg-n-900 border text-n-50 placeholder-n-400',
          error
            ? 'border-red-700/60 bg-red-950/10 focus:border-red-600 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]'
            : 'border-n-700 focus:border-n-500 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          className || '',
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export var Select = function ({ label, error, name, value, onChange, children, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-n-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={[
          'w-full px-4 py-2.5 text-sm rounded-lg outline-none transition-all duration-300 cursor-pointer',
          'bg-n-900 border text-n-50',
          error
            ? 'border-red-700/60'
            : 'border-n-700 focus:border-n-500',
        ].join(' ')}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export var Textarea = function ({ label, error, name, value, onChange, placeholder, rows, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-n-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows || 4}
        required={required}
        className={[
          'w-full px-4 py-2.5 text-sm rounded-lg outline-none transition-all duration-300 resize-vertical',
          'bg-n-900 border text-n-50 placeholder-n-400',
          error ? 'border-red-700/60' : 'border-n-700 focus:border-n-500',
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

/* ══════════════════════════════════════════════
   BADGE
══════════════════════════════════════════════ */
export var Badge = function ({ children, variant, className }) {
  var variants = {
    default:  'bg-n-750 border-n-600 text-n-200',
    high:     'bg-red-950/25 border-red-800/35 text-red-300',
    moderate: 'bg-amber-950/25 border-amber-800/35 text-amber-300',
    low:      'bg-green-950/25 border-green-800/35 text-green-300',
    info:     'bg-blue-950/25 border-blue-800/35 text-blue-300',
  };
  return (
    <span className={['inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border', variants[variant || 'default'], className || ''].join(' ')}>
      {children}
    </span>
  );
};

/* ══════════════════════════════════════════════
   TOGGLE
══════════════════════════════════════════════ */
export var Toggle = function ({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 bg-n-900 border border-n-700 rounded-xl">
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && <p className="text-sm font-medium text-n-50">{label}</p>}
          {description && <p className="text-xs text-n-300 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      )}
      <button
        type="button"
        onClick={function () { onChange(!checked); }}
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 flex-shrink-0 border',
          checked ? 'bg-n-700 border-n-500' : 'bg-n-850 border-n-700',
        ].join(' ')}
      >
        <span className={[
          'inline-block h-4 w-4 rounded-full transition-all duration-300',
          checked ? 'translate-x-6 bg-n-50' : 'translate-x-1 bg-n-400',
        ].join(' ')} />
      </button>
    </div>
  );
};

/* ══════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════ */
export var StatCard = function ({ icon, label, value, change, positive }) {
  return (
    <div className="bg-n-800 border border-n-700 rounded-xl p-5 transition-all duration-300 hover:border-n-500 hover:shadow-sm hover:-translate-y-px">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-lg bg-n-900 border border-n-700 flex items-center justify-center text-xl">
          {icon}
        </div>
        {positive !== null && positive !== undefined && (
          <Badge variant={positive ? 'low' : 'high'}>
            {positive ? '↑' : '↓'}
          </Badge>
        )}
      </div>
      <p className="text-xs text-n-300 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-n-50 mb-1">{value}</p>
      {change && <p className="text-xs text-n-400">{change}</p>}
    </div>
  );
};

/* ══════════════════════════════════════════════
   DIVIDER
══════════════════════════════════════════════ */
export var Divider = function ({ label, className }) {
  if (label) {
    return (
      <div className={['relative flex items-center', className || ''].join(' ')}>
        <div className="flex-1 h-px bg-n-700" />
        <span className="px-4 text-xs text-n-400 uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-n-700" />
      </div>
    );
  }
  return <div className={['h-px bg-n-700', className || ''].join(' ')} />;
};

/* ══════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════ */
export var Skeleton = function ({ className, height }) {
  return (
    <div
      className={['rounded-md animate-shimmer bg-gradient-to-r from-n-800 via-n-750 to-n-800 bg-[length:200%_auto]', className || ''].join(' ')}
      style={{ height: height || '16px' }}
    />
  );
};

/* ══════════════════════════════════════════════
   PROGRESS BAR
══════════════════════════════════════════════ */
export var ProgressBar = function ({ value, max, color, label, showPct }) {
  var pct = Math.min(100, Math.round((value / (max || 100)) * 100));
  var barColor = color || 'bg-n-500';

  return (
    <div className="w-full">
      {(label || showPct) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-n-300">{label}</span>}
          {showPct && <span className="text-xs text-n-200 font-medium">{pct}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-n-900 rounded-full overflow-hidden">
        <div
          className={['h-full rounded-full transition-all duration-1000', barColor].join(' ')}
          style={{ width: pct + '%', animation: 'progressFill 1s cubic-bezier(0.4,0,0.2,1) both' }}
        />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════ */
export var EmptyState = function ({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-n-800 border border-n-700 flex items-center justify-center text-3xl mb-4">
          {icon}
        </div>
      )}
      {title && <p className="text-base font-semibold text-n-100 mb-2">{title}</p>}
      {description && <p className="text-sm text-n-300 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

/* ══════════════════════════════════════════════
   SOCIAL BUTTONS
══════════════════════════════════════════════ */
export var GoogleButton = function ({ onClick, loading, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="ui-social-btn ui-social-btn-google w-full"
      style={{ fontFamily: 'inherit' }}
    >
      {loading ? (
        <svg className="animate-spin w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      <span className="text-sm font-medium text-gray-700">
        {loading ? 'Connecting...' : (children || 'Continue with Google')}
      </span>
    </button>
  );
};

export var AppleButton = function ({ onClick, loading, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="ui-social-btn ui-social-btn-apple w-full"
      style={{ fontFamily: 'inherit' }}
    >
      {loading ? (
        <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="white">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      )}
      <span className="text-sm font-medium text-white">
        {loading ? 'Connecting...' : (children || 'Continue with Apple')}
      </span>
    </button>
  );
};

/* ══════════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════════ */
export var StepIndicator = function ({ steps, current }) {
  return (
    <div className="flex items-center justify-between mb-2">
      {steps.map(function (step, i) {
        var isDone   = i < current - 1;
        var isActive = i === current - 1;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className={[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300 flex-shrink-0',
              isDone   ? 'bg-green-950/40 border-green-700/50 text-green-300' :
              isActive ? 'bg-n-750 border-n-500 text-n-50' :
                         'bg-n-900 border-n-700 text-n-400',
            ].join(' ')}>
              {isDone ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={['flex-1 h-0.5 mx-2 transition-all duration-500', isDone ? 'bg-green-700/50' : 'bg-n-700'].join(' ')} />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ══════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════ */
export var Modal = function ({ open, onClose, title, children, maxWidth }) {
  if (!open) return null;
  return (
    <div className="ui-overlay" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      <div className={['ui-modal', maxWidth || 'max-w-md'].join(' ')}>
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-n-50">{title}</h3>
            <button type="button" onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-n-300 hover:text-n-50 hover:bg-n-750 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   LOADING SPINNER
══════════════════════════════════════════════ */
export var Spinner = function ({ size, className }) {
  var s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <svg className={['animate-spin', s, className || 'text-n-300'].join(' ')} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

/* ══════════════════════════════════════════════
   PAGE HEADER
══════════════════════════════════════════════ */
export var PageHeader = function ({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-n-50 mb-0.5">{title}</h1>
        {description && <p className="text-sm text-n-300">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

/* ══════════════════════════════════════════════
   SECTION CARD (with header + content)
══════════════════════════════════════════════ */
export var SectionCard = function ({ title, description, action, children, className }) {
  return (
    <div className={['bg-n-800 border border-n-700 rounded-xl overflow-hidden', className || ''].join(' ')}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-n-700">
          <div>
            {title && <h3 className="text-sm font-semibold text-n-50">{title}</h3>}
            {description && <p className="text-xs text-n-300 mt-0.5">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   BACK BUTTON
══════════════════════════════════════════════ */
export var BackButton = function ({ onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 text-n-300 hover:text-n-50 transition-colors duration-300 group">
      <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-300"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm">{label || 'Back'}</span>
    </button>
  );
};

/* ══════════════════════════════════════════════
   AVATAR
══════════════════════════════════════════════ */
export var Avatar = function ({ src, name, size }) {
  var sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : size === 'xl' ? 'w-16 h-16 text-2xl' : 'w-9 h-9 text-sm';
  var initial = name ? name.charAt(0).toUpperCase() : 'U';
  return src ? (
    <img src={src} alt={name || 'avatar'}
      className={[sz, 'rounded-full object-cover border border-n-700 flex-shrink-0'].join(' ')} />
  ) : (
    <div className={[sz, 'rounded-full bg-n-750 border border-n-700 flex items-center justify-center font-semibold text-n-100 flex-shrink-0'].join(' ')}>
      {initial}
    </div>
  );
};

/* ══════════════════════════════════════════════
   RISK BANNER
══════════════════════════════════════════════ */
export var RiskBanner = function ({ risk, action, scanId, date }) {
  var styles = {
    HIGH:     { wrap: 'bg-red-950/30 border-red-800/40 text-red-200',    dot: 'bg-red-500' },
    MODERATE: { wrap: 'bg-amber-950/30 border-amber-800/40 text-amber-200', dot: 'bg-amber-500' },
    LOW:      { wrap: 'bg-green-950/20 border-green-800/30 text-green-200', dot: 'bg-green-500' },
    NORMAL:   { wrap: 'bg-green-950/20 border-green-800/30 text-green-200', dot: 'bg-green-500' },
  };
  var s = styles[risk] || styles.LOW;
  return (
    <div className={['border rounded-xl px-5 py-4', s.wrap].join(' ')}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={['w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse-dot', s.dot].join(' ')} />
          <div>
            <p className="text-xs uppercase tracking-wider opacity-60 mb-0.5">Overall Risk Level</p>
            <p className="text-2xl font-bold">{risk}</p>
          </div>
        </div>
        <div className="sm:text-right text-xs opacity-60">
          {scanId && <p>ID: {scanId}</p>}
          {date && <p>{date}</p>}
        </div>
      </div>
      {action && <p className="text-sm opacity-80 mt-3 leading-relaxed">{action}</p>}
    </div>
  );
};