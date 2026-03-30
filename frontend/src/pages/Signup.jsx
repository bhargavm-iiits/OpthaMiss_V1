import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

var Signup = function () {
  var navigate = useNavigate();
  var { register } = useAuth();
  var { addToast } = useToast();

  var [currentStep, setCurrentStep] = useState(1);
  var [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  var [loading, setLoading] = useState(false);
  var [errors, setErrors] = useState({});

  var totalSteps = 3;

  var handleChange = function (e) {
    var name = e.target.name;
    var value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(function (prev) { return Object.assign({}, prev, { [name]: value }); });
    setErrors(function (prev) { return Object.assign({}, prev, { [name]: '' }); });
  };

  var validateStep = function (step) {
    var newErrors = {};
    if (step === 1) {
      if (!formData.fullName.trim())
        newErrors.fullName = 'Full name is required';
      if (!formData.email.trim())
        newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email))
        newErrors.email = 'Enter a valid email address';
    }
    if (step === 2) {
      if (!formData.password)
        newErrors.password = 'Password is required';
      else if (formData.password.length < 8)
        newErrors.password = 'Must be at least 8 characters';
      if (formData.password !== formData.confirmPassword)
        newErrors.confirmPassword = 'Passwords do not match';
    }
    if (step === 3) {
      if (!formData.agreeToTerms)
        newErrors.agreeToTerms = 'You must agree to the terms to continue';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  var handleNext = function () {
    if (validateStep(currentStep) && currentStep < totalSteps) {
      setCurrentStep(function (s) { return s + 1; });
    }
  };

  var handleBack = function () {
    if (currentStep > 1) {
      setCurrentStep(function (s) { return s - 1; });
    }
  };

  var handleSubmit = async function (e) {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    setLoading(true);
    try {
      var user = await register(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.fullName.trim()
      );
      addToast('Account created! Welcome, ' + (user.name || 'there') + '!', 'success');
      navigate('/complete-profile');
    } catch (err) {
      var msg = (err && err.message) ? err.message : 'Registration failed. Please try again.';
      setErrors({ general: msg });
      addToast(msg, 'error');
    }
    setLoading(false);
  };

  var getPasswordStrength = function () {
    var p = formData.password;
    if (!p || p.length === 0) return { label: '', color: '#262626', width: '0%' };
    if (p.length < 6) return { label: 'Weak', color: '#ef4444', width: '25%' };
    if (p.length < 8) return { label: 'Fair', color: '#f59e0b', width: '50%' };
    if (p.length < 12) return { label: 'Good', color: '#3b82f6', width: '75%' };
    return { label: 'Strong', color: '#22c55e', width: '100%' };
  };

  var strength = getPasswordStrength();

  var inputStyle = function (field) {
    var hasError = !!errors[field];
    return {
      width: '100%',
      padding: '11px 14px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid ' + (hasError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.08)'),
      borderRadius: '10px',
      fontSize: '14px',
      color: '#e5e5e5',
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      boxShadow: hasError ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
    };
  };

  var labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#737373',
    marginBottom: '6px',
  };

  var errorStyle = {
    fontSize: '12px',
    color: '#fca5a5',
    marginTop: '5px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '4px',
    lineHeight: 1.4,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '15%', left: '20%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          animation: 'pulseGlow 9s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '15%',
          width: '360px', height: '360px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
          animation: 'pulseGlow 12s ease-in-out infinite 3s',
        }} />
      </div>

      {/* Back to home */}
      <Link to="/" style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: '#525252',
        textDecoration: 'none',
        transition: 'color 0.2s ease',
      }}
        onMouseEnter={function (e) { e.currentTarget.style.color = '#a3a3a3'; }}
        onMouseLeave={function (e) { e.currentTarget.style.color = '#525252'; }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Home
      </Link>

      {/* Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '420px',
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#111111',
            border: '1px solid #333333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#b0b0b0" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3.5" fill="#888" />
              <circle cx="12" cy="12" r="1.5" fill="#0a0a0a" />
              <circle cx="13.4" cy="10.6" r="0.9" fill="rgba(255,255,255,0.75)" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#e5e5e5',
            marginBottom: '6px',
            letterSpacing: '-0.02em',
          }}>
            Create your account
          </h1>
          <p style={{ fontSize: '13px', color: '#525252', lineHeight: 1.5 }}>
            Join OpthaMiss AI eye screening — free forever
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            {[1, 2, 3].map(function (step) {
              var isDone = step < currentStep;
              var isActive = step === currentStep;
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.3s ease',
                    background: isDone ? 'rgba(34,197,94,0.15)'
                      : isActive ? '#2a2a2a'
                        : '#111111',
                    border: isDone ? '1px solid rgba(34,197,94,0.4)'
                      : isActive ? '2px solid #404040'
                        : '1px solid #222222',
                    color: isDone ? '#86efac'
                      : isActive ? '#e5e5e5'
                        : '#404040',
                  }}>
                    {isDone ? (
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step}
                  </div>
                  {step < totalSteps && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      margin: '0 6px',
                      background: isDone ? 'rgba(34,197,94,0.35)' : '#1f1f1f',
                      transition: 'background 0.4s ease',
                      borderRadius: '1px',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {['Account Info', 'Set Password', 'Confirm'].map(function (label, i) {
              return (
                <span key={i} style={{
                  fontSize: '10px',
                  fontWeight: (i + 1) === currentStep ? 600 : 400,
                  color: (i + 1) === currentStep ? '#a3a3a3' : '#404040',
                  transition: 'color 0.3s ease',
                }}>
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* General error */}
        {errors.general && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(127,29,29,0.25)',
            border: '1px solid rgba(220,38,38,0.35)',
            marginBottom: '16px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" style={{ color: '#fca5a5', flexShrink: 0, marginTop: '1px' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ fontSize: '13px', color: '#fca5a5', lineHeight: 1.5, margin: 0 }}>
              {errors.general}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>

          {/* STEP 1 — Account Info */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label style={labelStyle}>Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Jane Doe"
                  style={inputStyle('fullName')}
                  onFocus={function (e) {
                    if (!errors.fullName) e.target.style.borderColor = '#404040';
                  }}
                  onBlur={function (e) {
                    if (!errors.fullName) e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
                {errors.fullName && (
                  <p style={errorStyle}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  style={inputStyle('email')}
                  onFocus={function (e) {
                    if (!errors.email) e.target.style.borderColor = '#404040';
                  }}
                  onBlur={function (e) {
                    if (!errors.email) e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
                {errors.email && (
                  <p style={errorStyle}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {errors.email}
                  </p>
                )}
              </div>

            </div>
          )}

          {/* STEP 2 — Password */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  style={inputStyle('password')}
                  onFocus={function (e) {
                    if (!errors.password) e.target.style.borderColor = '#404040';
                  }}
                  onBlur={function (e) {
                    if (!errors.password) e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
                {errors.password && (
                  <p style={errorStyle}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {errors.password}
                  </p>
                )}

                {/* Strength bar */}
                {formData.password.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '5px',
                    }}>
                      <span style={{ fontSize: '11px', color: '#525252' }}>Password strength</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: '4px',
                      background: '#1f1f1f', borderRadius: '2px', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: strength.width,
                        background: strength.color,
                        borderRadius: '2px',
                        transition: 'width 0.4s ease, background 0.4s ease',
                      }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  style={inputStyle('confirmPassword')}
                  onFocus={function (e) {
                    if (!errors.confirmPassword) e.target.style.borderColor = '#404040';
                  }}
                  onBlur={function (e) {
                    if (!errors.confirmPassword) e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
                {errors.confirmPassword && (
                  <p style={errorStyle}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {errors.confirmPassword}
                  </p>
                )}

                {formData.confirmPassword.length > 0 && !errors.confirmPassword && (
                  <p style={{
                    fontSize: '12px', color: '#86efac',
                    marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Passwords match
                  </p>
                )}
              </div>

              {/* Password tips */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #222222',
              }}>
                <p style={{ fontSize: '11px', color: '#525252', marginBottom: '6px', fontWeight: 600 }}>
                  Tips for a strong password:
                </p>
                {[
                  'Use 12 or more characters',
                  'Mix uppercase and lowercase letters',
                  'Include numbers and symbols',
                ].map(function (tip, i) {
                  return (
                    <p key={i} style={{
                      fontSize: '11px', color: '#404040', lineHeight: 1.5,
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <span style={{ color: '#333333' }}>•</span> {tip}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Summary */}
              <div style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #222222',
              }}>
                <p style={{
                  fontSize: '11px', fontWeight: 600, color: '#525252',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px',
                }}>
                  Account summary
                </p>
                {[
                  { label: 'Name', value: formData.fullName },
                  { label: 'Email', value: formData.email },
                ].map(function (item, i) {
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      paddingBottom: i < 1 ? '8px' : '0',
                      marginBottom: i < 1 ? '8px' : '0',
                      borderBottom: i < 1 ? '1px solid #1f1f1f' : 'none',
                    }}>
                      <span style={{ fontSize: '12px', color: '#404040', width: '40px', flexShrink: 0 }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#a3a3a3', wordBreak: 'break-all' }}>
                        {item.value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Info cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  {
                    icon: (
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                    iconColor: '#86efac',
                    iconBg: 'rgba(34,197,94,0.1)',
                    title: 'Stored locally',
                    desc: 'Your data is saved only in this browser.',
                  },
                  {
                    icon: (
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ),
                    iconColor: '#93c5fd',
                    iconBg: 'rgba(59,130,246,0.1)',
                    title: 'No data sent',
                    desc: 'Nothing is transmitted to any server.',
                  },
                ].map(function (item, i) {
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid #1f1f1f',
                    }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '7px',
                        background: item.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: item.iconColor,
                        flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#d4d4d4', marginBottom: '2px' }}>
                          {item.title}
                        </p>
                        <p style={{ fontSize: '12px', color: '#525252', lineHeight: 1.4 }}>
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Terms */}
              <div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <div
                    onClick={function () {
                      setFormData(function (p) {
                        return Object.assign({}, p, { agreeToTerms: !p.agreeToTerms });
                      });
                      setErrors(function (p) { return Object.assign({}, p, { agreeToTerms: '' }); });
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      marginTop: '1px',
                      background: formData.agreeToTerms ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid ' + (formData.agreeToTerms
                        ? 'rgba(34,197,94,0.45)'
                        : errors.agreeToTerms
                          ? 'rgba(239,68,68,0.5)'
                          : 'rgba(255,255,255,0.1)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {formData.agreeToTerms && (
                      <svg width="10" height="10" fill="none" stroke="#86efac" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: '13px', color: '#737373', lineHeight: 1.55, userSelect: 'none' }}>
                    I agree to the{' '}
                    <a href="#" style={{ color: '#a3a3a3', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" style={{ color: '#a3a3a3', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <p style={Object.assign({}, errorStyle, { marginTop: '6px', marginLeft: '26px' })}>
                    {errors.agreeToTerms}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>

            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#a3a3a3',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={function (e) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                ← Back
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: '#222222',
                  border: '1px solid #333333',
                  color: '#e5e5e5',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={function (e) {
                  e.currentTarget.style.background = '#2a2a2a';
                  e.currentTarget.style.borderColor = '#404040';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(212,212,212,0.06)';
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.background = '#222222';
                  e.currentTarget.style.borderColor = '#333333';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Continue →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: loading ? '#1a1a1a' : '#222222',
                  border: '1px solid ' + (loading ? '#2a2a2a' : '#333333'),
                  color: loading ? '#525252' : '#e5e5e5',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={function (e) {
                  if (!loading) {
                    e.currentTarget.style.background = '#2a2a2a';
                    e.currentTarget.style.borderColor = '#404040';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(212,212,212,0.06)';
                  }
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.background = loading ? '#1a1a1a' : '#222222';
                  e.currentTarget.style.borderColor = loading ? '#2a2a2a' : '#333333';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: '15px',
                      height: '15px',
                      borderRadius: '50%',
                      border: '2px solid #333333',
                      borderTopColor: '#a3a3a3',
                      animation: 'spin 1s linear infinite',
                    }} />
                    Creating account…
                  </>
                ) : 'Create Account'}
              </button>
            )}
          </div>
        </form>

        {/* Sign in link */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#525252' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: '#a3a3a3', textDecoration: 'none', fontWeight: 600 }}
              onMouseEnter={function (e) { e.currentTarget.style.color = '#e5e5e5'; }}
              onMouseLeave={function (e) { e.currentTarget.style.color = '#a3a3a3'; }}
            >
              Sign in →
            </Link>
          </p>
        </div>

        {/* Footer note */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          marginTop: '20px',
        }}>
          <svg width="11" height="11" fill="none" stroke="#86efac" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span style={{ fontSize: '11px', color: '#404040' }}>
            Data stored locally · No server required
          </span>
        </div>
      </div>
    </div>
  );
};

export default Signup;
