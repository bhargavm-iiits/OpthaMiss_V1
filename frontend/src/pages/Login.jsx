import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { parseError } from '../services/authService';
import { useToast } from '../context/ToastContext';

var Login = function () {
  var navigate = useNavigate();
  var { login, user, loading, rememberedEmail } = useAuth();
  var { addToast } = useToast();

  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [rememberMe, setRememberMe] = useState(false);
  var [showPass, setShowPass] = useState(false);
  var [submitting, setSubmitting] = useState(false);
  var [mounted, setMounted] = useState(false);

  var [errors, setErrors] = useState({ email: '', password: '', general: '' });

  /* ── Redirect if already logged in ── */
  useEffect(function () {
    if (!loading && user) {
      if (user.profileComplete) navigate('/dashboard', { replace: true });
      else navigate('/complete-profile', { replace: true });
    }
  }, [user, loading, navigate]);

  /* ── Pre-fill remembered email ── */
  useEffect(function () {
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
    var t = setTimeout(function () { setMounted(true); }, 60);
    return function () { clearTimeout(t); };
  }, [rememberedEmail]);

  /* ── Validate ── */
  var validate = function () {
    var e = { email: '', password: '', general: '' };
    var ok = true;
    if (!email.trim()) {
      e.email = 'Email is required';
      ok = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      e.email = 'Enter a valid email address';
      ok = false;
    }
    if (!password) {
      e.password = 'Password is required';
      ok = false;
    } else if (password.length < 6) {
      e.password = 'Password must be at least 6 characters';
      ok = false;
    }
    setErrors(e);
    return ok;
  };

  /* ── Submit ── */
  var handleSubmit = async function (e) {
    e.preventDefault();
    setErrors({ email: '', password: '', general: '' });
    if (!validate()) return;

    setSubmitting(true);
    try {
      var loggedUser = await login(email.trim().toLowerCase(), password, rememberMe);
      addToast('Welcome back, ' + (loggedUser.name || 'there') + '!', 'success');
      if (loggedUser.profileComplete) navigate('/dashboard');
      else navigate('/complete-profile');
    } catch (err) {
      var msg = parseError(err);
      var status = err && err.response && err.response.status;

      if (status === 404) {
        setErrors(function (p) {
          return Object.assign({}, p, {
            email: 'No account found with this email.',
            general: '',
          });
        });
      } else if (status === 401) {
        setErrors(function (p) {
          return Object.assign({}, p, {
            password: 'Incorrect password. Please try again.',
            general: '',
          });
        });
      } else if (status === 400) {
        setErrors(function (p) {
          return Object.assign({}, p, { general: msg });
        });
      } else {
        setErrors(function (p) {
          return Object.assign({}, p, { general: msg });
        });
      }
    }
    setSubmitting(false);
  };

  /* ── Loading screen ── */
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '2px solid var(--color-border)',
            borderTopColor: 'var(--color-text-2)',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ fontSize: '13px', color: 'var(--color-text-4)' }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (user) return null;

  /* ── Input style helper ── */
  var inputStyle = function (field) {
    return {
      width: '100%',
      padding: '10px 14px',
      fontSize: '14px',
      fontFamily: 'var(--font-sans)',
      background: 'var(--color-bg-2)',
      border: '1px solid ' + (errors[field] ? 'rgba(220,38,38,0.5)' : 'var(--color-border)'),
      borderRadius: '8px',
      color: 'var(--color-text)',
      outline: 'none',
      transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
      boxShadow: errors[field] ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
      boxSizing: 'border-box',
    };
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '20%', left: '25%',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(60,60,70,0.12) 0%, transparent 65%)',
          animation: 'pulseGlow 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '20%',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(50,50,60,0.10) 0%, transparent 65%)',
          animation: 'pulseGlow 11s ease-in-out infinite 3s',
        }} />
      </div>

      {/* Back to home */}
      <Link to="/" style={{
        position: 'absolute', top: '20px', left: '20px',
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '13px', color: 'var(--color-text-4)',
        textDecoration: 'none', transition: 'color 0.2s ease',
      }}
        onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text-2)'; }}
        onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-4)'; }}
      >
        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Home
      </Link>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '400px',
        background: 'var(--color-bg-3)',
        border: '1px solid var(--color-border-2)',
        borderRadius: '18px',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-lg)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '11px',
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#c0c0c0" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3.5" fill="#888" />
              <circle cx="12" cy="12" r="1.5" fill="#0a0a0a" />
              <circle cx="13.4" cy="10.6" r="0.9" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '22px', fontWeight: 700,
            color: 'var(--color-text)', marginBottom: '6px',
            letterSpacing: '-0.02em',
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-4)', lineHeight: 1.5 }}>
            {rememberedEmail
              ? 'Signing in as ' + rememberedEmail
              : 'Sign in to your OpthaMiss account'}
          </p>
        </div>

        {/* Demo hint */}
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.2)',
          marginBottom: '20px',
          fontSize: '12px',
          color: 'rgba(147,197,253,0.9)',
          lineHeight: 1.5,
        }}>
          <strong>Demo mode:</strong> Register first, then log in with your credentials.
          All data is stored locally in your browser.
        </div>

        {/* General error */}
        {errors.general && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--risk-high-bg)',
            border: '1px solid var(--risk-high-border)',
            marginBottom: '16px',
            display: 'flex', gap: '8px', alignItems: 'flex-start',
          }}>
            <svg style={{ width: '14px', height: '14px', color: 'var(--risk-high-text)', flexShrink: 0, marginTop: '1px' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ fontSize: '13px', color: 'var(--risk-high-text)', lineHeight: 1.5 }}>
              {errors.general}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--color-text-3)', marginBottom: '6px',
              }}>
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={function (e) {
                  setEmail(e.target.value);
                  setErrors(function (p) { return Object.assign({}, p, { email: '', general: '' }); });
                }}
                placeholder="you@example.com"
                style={inputStyle('email')}
              />
              {errors.email && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginTop: '5px' }}>
                  <svg style={{ width: '12px', height: '12px', color: 'var(--risk-high-text)', flexShrink: 0, marginTop: '1px' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p style={{ fontSize: '12px', color: 'var(--risk-high-text)', lineHeight: 1.4 }}>
                    {errors.email}
                  </p>
                </div>
              )}
              {errors.email && errors.email.includes('No account') && (
                <p style={{ fontSize: '12px', color: 'var(--color-text-4)', marginTop: '4px' }}>
                  New here?{' '}
                  <Link to="/signup" style={{
                    color: 'var(--color-text-2)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}>
                    Create a free account
                  </Link>
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{
                  fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--color-text-3)',
                }}>
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={function (e) {
                    setPassword(e.target.value);
                    setErrors(function (p) { return Object.assign({}, p, { password: '', general: '' }); });
                  }}
                  placeholder="Your password"
                  style={Object.assign({}, inputStyle('password'), { paddingRight: '40px' })}
                />
                <button
                  type="button"
                  onClick={function () { setShowPass(function (v) { return !v; }); }}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-4)', display: 'flex', alignItems: 'center',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text-2)'; }}
                  onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-4)'; }}
                >
                  {showPass ? (
                    <svg style={{ width: '15px', height: '15px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg style={{ width: '15px', height: '15px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginTop: '5px' }}>
                  <svg style={{ width: '12px', height: '12px', color: 'var(--risk-high-text)', flexShrink: 0, marginTop: '1px' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p style={{ fontSize: '12px', color: 'var(--risk-high-text)', lineHeight: 1.4 }}>
                    {errors.password}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Remember me */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <div
                onClick={function () { setRememberMe(function (v) { return !v; }); }}
                style={{
                  width: '16px', height: '16px', borderRadius: '4px',
                  background: rememberMe ? 'var(--color-bg-hover)' : 'var(--color-bg-2)',
                  border: '1px solid ' + (rememberMe ? 'var(--color-border-2)' : 'var(--color-border)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0,
                }}
              >
                {rememberMe && (
                  <svg style={{ width: '10px', height: '10px', color: 'var(--color-text)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--color-text-3)', userSelect: 'none' }}>
                Remember me
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: '9px',
              fontSize: '14px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              transition: 'all 0.25s ease',
              background: 'var(--color-bg-4)',
              border: '1px solid var(--color-border-2)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={function (e) {
              if (!submitting) {
                e.currentTarget.style.background = 'var(--color-bg-hover)';
                e.currentTarget.style.borderColor = 'var(--color-accent-2)';
                e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
              }
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = 'var(--color-bg-4)';
              e.currentTarget.style.borderColor = 'var(--color-border-2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {submitting ? (
              <>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: '2px solid var(--color-border-2)',
                  borderTopColor: 'var(--color-text)',
                  animation: 'spin 1s linear infinite',
                }} />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-4)' }}>
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              style={{
                color: 'var(--color-text-2)', textDecoration: 'none',
                fontWeight: 600, transition: 'color 0.2s ease',
              }}
              onMouseEnter={function (e) { e.currentTarget.style.color = 'var(--color-text)'; }}
              onMouseLeave={function (e) { e.currentTarget.style.color = 'var(--color-text-2)'; }}
            >
              Sign up free →
            </Link>
          </p>
        </div>

        {/* Local storage notice */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '5px', marginTop: '20px',
        }}>
          <svg style={{ width: '12px', height: '12px', color: 'var(--risk-low-text)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span style={{ fontSize: '11px', color: 'var(--color-text-4)' }}>
            Data stored locally in your browser
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;