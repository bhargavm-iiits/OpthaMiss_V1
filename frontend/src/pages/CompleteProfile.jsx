import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

var BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
var COUNTRIES = [
  'United States', 'United Kingdom', 'India', 'Canada', 'Australia',
  'Germany', 'France', 'Pakistan', 'Bangladesh', 'Nigeria', 'Other',
];
var OCCUPATIONS = [
  'Healthcare Professional', 'Engineer', 'Teacher / Educator',
  'Student', 'Business / Entrepreneur', 'Government / Public Sector',
  'IT / Software', 'Agriculture', 'Retired', 'Other',
];

var CompleteProfile = function () {
  var navigate = useNavigate();
  var { user, updateProfile } = useAuth();  // ← real updateProfile
  var { addToast } = useToast();

  var [form, setForm] = useState({
    phone: '',
    age: '',
    dateOfBirth: '',
    bloodGroup: '',
    occupation: '',
    city: '',
    state: '',
    country: '',
  });
  var [errors, setErrors] = useState({});
  var [loading, setLoading] = useState(false);

  var handleChange = function (e) {
    var name = e.target.name;
    var value = e.target.value;
    setForm(function (prev) {
      var n = Object.assign({}, prev);
      n[name] = value;
      return n;
    });
    setErrors(function (prev) {
      var n = Object.assign({}, prev);
      n[name] = '';
      return n;
    });
  };

  var validate = function () {
    var e = {};
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phone)) {
      e.phone = 'Enter a valid phone number';
    }
    if (!form.age || isNaN(form.age) || Number(form.age) < 1 || Number(form.age) > 120) {
      e.age = 'Enter a valid age (1-120)';
    }
    if (!form.dateOfBirth) {
      e.dateOfBirth = 'Date of birth is required';
    } else {
      var dob = new Date(form.dateOfBirth);
      var today = new Date();
      if (dob >= today) e.dateOfBirth = 'Date of birth must be in the past';
    }
    if (!form.bloodGroup) e.bloodGroup = 'Blood group is required';
    if (!form.occupation) e.occupation = 'Occupation is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.country) e.country = 'Country is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Real save via AuthContext ── */
  var handleSubmit = async function (e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await updateProfile({
        phone: form.phone,
        age: form.age,
        dateOfBirth: form.dateOfBirth,
        bloodGroup: form.bloodGroup,
        occupation: form.occupation,
        city: form.city,
        state: form.state,
        country: form.country,
      });
      addToast('Profile completed! Welcome to OpthaMiss.', 'success');
      navigate('/dashboard');
    } catch (err) {
      addToast('Failed to save profile. Please try again.', 'error');
    }
    setLoading(false);
  };

  var isFormFilled =
    form.phone && form.age && form.dateOfBirth &&
    form.bloodGroup && form.occupation && form.city && form.country;

  var inputClass = function (field) {
    return (
      'w-full px-4 py-3 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 ' +
      'focus:outline-none transition-colors ' +
      (errors[field]
        ? 'bg-red-950/20 border border-red-700/50 focus:border-red-600'
        : 'bg-neutral-800/60 border border-neutral-700/50 focus:border-neutral-500')
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg-primary)' }}>

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-40"
          style={{ background: 'rgba(59,130,246,0.06)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-40"
          style={{ background: 'rgba(139,92,246,0.06)' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg">

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs text-neutral-400">Account Created</span>
          </div>
          <div className="flex-1 h-px mx-3" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-neutral-700 border-2 border-neutral-500
              flex items-center justify-center">
              <span className="text-xs font-bold text-neutral-200">2</span>
            </div>
            <span className="text-xs text-neutral-200 font-medium">Complete Profile</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

          {/* Header — uses real user.name */}
          <div className="text-center mb-8">
            {user && user.picture ? (
              <img src={user.picture} alt="avatar"
                className="w-16 h-16 rounded-full mx-auto mb-3 border-2 object-cover"
                style={{ borderColor: 'var(--border)' }} />
            ) : (
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center
                justify-center text-2xl font-bold"
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  color: 'var(--text-h)'
                }}>
                {user && user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>
              Complete Your Profile
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {user && user.name ? 'Hi ' + user.name.split(' ')[0] + '! ' : ''}
              We need a few more details to personalise your experience.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Phone Number <span className="text-red-400">*</span>
              </label>
              <input type="tel" name="phone" value={form.phone}
                onChange={handleChange} placeholder="+1 234 567 8900"
                className={inputClass('phone')} />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>

            {/* Age + DOB */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Age <span className="text-red-400">*</span>
                </label>
                <input type="number" name="age" value={form.age}
                  onChange={handleChange} placeholder="e.g. 35" min="1" max="120"
                  className={inputClass('age')} />
                {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <input type="date" name="dateOfBirth" value={form.dateOfBirth}
                  onChange={handleChange} className={inputClass('dateOfBirth')} />
                {errors.dateOfBirth && (
                  <p className="text-red-400 text-xs mt-1">{errors.dateOfBirth}</p>
                )}
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Blood Group <span className="text-red-400">*</span>
              </label>
              <select name="bloodGroup" value={form.bloodGroup}
                onChange={handleChange} className={inputClass('bloodGroup')}>
                <option value="">Select blood group</option>
                {BLOOD_GROUPS.map(function (bg) {
                  return <option key={bg} value={bg}>{bg}</option>;
                })}
              </select>
              {errors.bloodGroup && (
                <p className="text-red-400 text-xs mt-1">{errors.bloodGroup}</p>
              )}
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Occupation <span className="text-red-400">*</span>
              </label>
              <select name="occupation" value={form.occupation}
                onChange={handleChange} className={inputClass('occupation')}>
                <option value="">Select occupation</option>
                {OCCUPATIONS.map(function (o) {
                  return <option key={o} value={o}>{o}</option>;
                })}
              </select>
              {errors.occupation && (
                <p className="text-red-400 text-xs mt-1">{errors.occupation}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Location <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input type="text" name="city" value={form.city}
                      onChange={handleChange} placeholder="City *"
                      className={inputClass('city')} />
                    {errors.city && (
                      <p className="text-red-400 text-xs mt-1">{errors.city}</p>
                    )}
                  </div>
                  <input type="text" name="state" value={form.state}
                    onChange={handleChange} placeholder="State / Province"
                    className="w-full px-4 py-3 rounded-xl text-sm text-neutral-200
                      placeholder-neutral-600 focus:outline-none bg-neutral-800/60
                      border border-neutral-700/50 focus:border-neutral-500" />
                </div>
                <div>
                  <select name="country" value={form.country}
                    onChange={handleChange} className={inputClass('country')}>
                    <option value="">Select country *</option>
                    {COUNTRIES.map(function (c) {
                      return <option key={c} value={c}>{c}</option>;
                    })}
                  </select>
                  {errors.country && (
                    <p className="text-red-400 text-xs mt-1">{errors.country}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !isFormFilled}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all
                flex items-center justify-center gap-2 mt-2"
              style={{
                background: isFormFilled && !loading ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                border: '1px solid ' + (isFormFilled && !loading
                  ? 'var(--accent-border)' : 'var(--border)'),
                color: isFormFilled && !loading ? 'var(--text-h)' : 'var(--text-subtle)',
                cursor: loading || !isFormFilled ? 'not-allowed' : 'pointer',
                opacity: loading || !isFormFilled ? 0.6 : 1,
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Complete Profile & Go to Dashboard'}
            </button>

            <p className="text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
              All fields marked <span className="text-red-400">*</span> are required.
              Your data is stored locally in this browser.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;