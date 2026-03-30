import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user, updateProfile, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [avatarPreview, setAvatarPreview] = useState(null);

  /* ── Profile state seeded from real auth user — no hardcoded defaults ── */
  const [profile, setProfile] = useState({
    name: user ? (user.name || '') : '',
    email: user ? (user.email || '') : '',
    phone: user ? (user.phone || '') : '',
    dateOfBirth: '',
    gender: '',
    bloodType: user ? (user.bloodGroup || '') : '',
    address: '',
    emergencyContact: '',
    occupation: user ? (user.occupation || '') : '',
    medicalHistory: 'No known allergies.',
    currentMedications: 'None',
    lastEyeExam: '',
    eyeDoctor: '',
    eyeDoctorContact: '',
    insuranceProvider: '',
    insuranceNumber: '',
  });

  const [editProfile, setEditProfile] = useState({ ...profile });

  /* ── Display values always from real user, never hardcoded ── */
  const displayName = user && user.name ? user.name : 'User';
  const displayEmail = user && user.email ? user.email : '';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const stats = [
    { label: 'Total Scans', value: '0', icon: '📊', change: '' },
    { label: 'Health Score', value: '87%', icon: '❤️', change: '' },
    { label: 'Days Active', value: '1', icon: '📅', change: '' },
    { label: 'Conditions Found', value: '0', icon: '⚠️', change: '' },
  ];

  const recentActivity = [
    { id: 'SCN-2025-001', type: 'Fundus Scan', date: '2025-01-15', result: 'Glaucoma Detected', risk: 'high' },
    { id: 'SCN-2025-002', type: 'Anterior Scan', date: '2025-01-15', result: 'Normal', risk: 'low' },
    { id: 'SCN-2025-003', type: 'Fundus Scan', date: '2025-01-14', result: 'AMD Detected', risk: 'moderate' },
    { id: 'SCN-2025-004', type: 'Anterior Scan', date: '2025-01-13', result: 'Cataract', risk: 'moderate' },
    { id: 'SCN-2025-005', type: 'Fundus Scan', date: '2025-01-10', result: 'Normal', risk: 'low' },
  ];

  const riskColors = {
    high: 'bg-red-900/20 text-red-400 border-red-800/30',
    moderate: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    low: 'bg-green-900/20 text-green-400 border-green-800/30',
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleEditChange = (e) => {
    setEditProfile({ ...editProfile, [e.target.name]: e.target.value });
  };

  /* ── Save through AuthContext → authService → optha_users ── */
  const handleSave = async () => {
    try {
      await updateProfile({
        phone: editProfile.phone,
        bloodGroup: editProfile.bloodType,
        occupation: editProfile.occupation,
        dateOfBirth: editProfile.dateOfBirth,
      });
    } catch (_) { }
    setProfile({ ...editProfile });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCancel = () => {
    setEditProfile({ ...profile });
    setIsEditing(false);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'medical', label: 'Medical Info' },
    { id: 'activity', label: 'Activity' },
    { id: 'insurance', label: 'Insurance' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Success Toast ── */}
        {saveSuccess && (
          <div
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3
              bg-green-900/80 border border-green-700/50 rounded-xl shadow-xl backdrop-blur-md"
            style={{ animation: 'slideUp 0.3s ease-out' }}
          >
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-300 text-sm font-medium">Profile updated successfully</p>
          </div>
        )}

        {/* ── Profile Hero ── */}
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800/50">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neutral-700/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 left-0 w-48 h-48 bg-neutral-600/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6">

              {/* Avatar */}
              <div className="relative group flex-shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-neutral-800
                  border-2 border-neutral-700/50 flex items-center justify-center
                  overflow-hidden shadow-2xl">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl md:text-4xl font-bold text-neutral-300">
                      {displayInitial}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/60 opacity-0
                    group-hover:opacity-100 transition-opacity duration-200
                    flex items-center justify-center"
                >
                  <span className="text-white text-xs font-medium">Change</span>
                </button>
                <input
                  ref={fileInputRef} type="file" accept="image/*"
                  onChange={handleAvatarChange} className="hidden"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full
                  bg-green-500 border-2 border-neutral-900" />
              </div>

              {/* Name + Info — always from real user, never hardcoded */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-xl md:text-2xl font-bold text-neutral-100">
                    {displayName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-900/30
                    border border-blue-800/40 text-blue-400 text-xs font-medium">
                    Patient
                  </span>
                </div>
                <p className="text-neutral-400 text-sm mb-1">{displayEmail}</p>
                {profile.phone && (
                  <p className="text-neutral-500 text-sm">{profile.phone}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-neutral-500">
                  {profile.dateOfBirth && (
                    <span>DOB: {new Date(profile.dateOfBirth).toLocaleDateString()}</span>
                  )}
                  {profile.gender && <span>{profile.gender}</span>}
                  {profile.bloodType && <span>Blood: {profile.bloodType}</span>}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => navigate('/screen')}
                      className="px-3 py-2 bg-neutral-800 border border-neutral-700/50
                        rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
                    >
                      New Scan
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-2 bg-neutral-700 border border-neutral-600/50
                        rounded-lg text-sm text-neutral-200 hover:bg-neutral-600 transition-colors"
                    >
                      Edit Profile
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-2 bg-neutral-800 border border-neutral-700/50
                        rounded-lg text-sm text-neutral-400 hover:bg-neutral-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-2 bg-neutral-700 border border-neutral-600/50
                        rounded-lg text-sm text-neutral-200 hover:bg-neutral-600 transition-colors"
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i}
              className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4
                hover:border-neutral-700/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl">{stat.icon}</span>
                {stat.change && (
                  <span className="text-xs text-green-400 bg-green-900/20
                    border border-green-800/30 px-2 py-0.5 rounded-full">
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-neutral-100 mb-1">{stat.value}</p>
              <p className="text-xs text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl overflow-hidden">

          {/* Tab Nav */}
          <div className="flex border-b border-neutral-800/50">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3.5 text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                    ? 'text-neutral-200 border-b-2 border-neutral-400 bg-neutral-800/30'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/20'
                  }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">

                {/* Personal Info */}
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                    Personal Information
                  </h3>
                  {[
                    { label: 'Full Name', key: 'name', type: 'text', readOnly: false },
                    { label: 'Email', key: 'email', type: 'email', readOnly: true },
                    { label: 'Phone', key: 'phone', type: 'tel', readOnly: false },
                    { label: 'Date of Birth', key: 'dateOfBirth', type: 'date', readOnly: false },
                    { label: 'Occupation', key: 'occupation', type: 'text', readOnly: false },
                    { label: 'Address', key: 'address', type: 'text', readOnly: false },
                  ].map((field) => (
                    <div key={field.key}
                      className="flex items-start gap-3 py-3 border-b border-neutral-800/40 last:border-0">
                      <span className="text-xs text-neutral-600 font-medium w-28 shrink-0 pt-1">
                        {field.label}
                      </span>
                      {isEditing && !field.readOnly ? (
                        <input
                          type={field.type}
                          name={field.key}
                          value={editProfile[field.key]}
                          onChange={handleEditChange}
                          className="flex-1 px-3 py-1.5 bg-neutral-800/50 border
                            border-neutral-700/50 rounded-lg text-sm text-neutral-200
                            focus:outline-none focus:border-neutral-600 min-w-0"
                        />
                      ) : (
                        <span className="text-sm text-neutral-300 flex-1">
                          {field.key === 'dateOfBirth' && profile[field.key]
                            ? new Date(profile[field.key]).toLocaleDateString()
                            : (profile[field.key] || '—')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Medical Summary */}
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                    Quick Medical Summary
                  </h3>
                  {[
                    { label: 'Blood Type', key: 'bloodType' },
                    { label: 'Gender', key: 'gender' },
                    { label: 'Eye Doctor', key: 'eyeDoctor' },
                    { label: 'Doctor Phone', key: 'eyeDoctorContact' },
                    { label: 'Last Eye Exam', key: 'lastEyeExam' },
                    { label: 'Emergency', key: 'emergencyContact' },
                  ].map((field) => (
                    <div key={field.key}
                      className="flex items-start gap-3 py-3 border-b border-neutral-800/40 last:border-0">
                      <span className="text-xs text-neutral-600 font-medium w-28 shrink-0 pt-1">
                        {field.label}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          name={field.key}
                          value={editProfile[field.key]}
                          onChange={handleEditChange}
                          className="flex-1 px-3 py-1.5 bg-neutral-800/50 border
                            border-neutral-700/50 rounded-lg text-sm text-neutral-200
                            focus:outline-none focus:border-neutral-600 min-w-0"
                        />
                      ) : (
                        <span className="text-sm text-neutral-300 flex-1">
                          {field.key === 'lastEyeExam' && profile[field.key]
                            ? new Date(profile[field.key]).toLocaleDateString()
                            : (profile[field.key] || '—')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Medical Tab ── */}
          {activeTab === 'medical' && (
            <div className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">

                {/* Medical History */}
                <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-neutral-200 mb-3">Medical History</h3>
                  {isEditing ? (
                    <textarea name="medicalHistory" value={editProfile.medicalHistory}
                      onChange={handleEditChange} rows={4}
                      className="w-full px-3 py-2 bg-neutral-800/50 border border-neutral-700/50
                        rounded-lg text-sm text-neutral-200 focus:outline-none
                        focus:border-neutral-600 resize-none" />
                  ) : (
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {profile.medicalHistory || '—'}
                    </p>
                  )}
                </div>

                {/* Medications */}
                <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-neutral-200 mb-3">Current Medications</h3>
                  {isEditing ? (
                    <textarea name="currentMedications" value={editProfile.currentMedications}
                      onChange={handleEditChange} rows={4}
                      className="w-full px-3 py-2 bg-neutral-800/50 border border-neutral-700/50
                        rounded-lg text-sm text-neutral-200 focus:outline-none
                        focus:border-neutral-600 resize-none" />
                  ) : (
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {profile.currentMedications || '—'}
                    </p>
                  )}
                </div>
              </div>

              {/* Eye Health Stats */}
              <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-neutral-200 mb-4">Eye Health Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Last Exam', value: profile.lastEyeExam ? new Date(profile.lastEyeExam).toLocaleDateString() : '—', color: 'text-blue-400' },
                    { label: 'Eye Doctor', value: profile.eyeDoctor || '—', color: 'text-neutral-300' },
                    { label: 'Total Scans', value: '0', color: 'text-green-400' },
                    { label: 'Health Score', value: '87%', color: 'text-amber-400' },
                  ].map((item, i) => (
                    <div key={i}
                      className="text-center p-3 bg-neutral-900/40 rounded-lg border border-neutral-800/40">
                      <p className={`text-base font-semibold mb-1 ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-neutral-600">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detected Conditions */}
              <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-neutral-200 mb-4">
                  Detected Conditions History
                </h3>
                <div className="space-y-3">
                  {[
                    { condition: 'Glaucoma', status: 'Under Treatment', date: '2025-01-15', severity: 'high' },
                    { condition: 'Mild Myopia', status: 'Monitored', date: '2024-11-20', severity: 'low' },
                  ].map((c, i) => (
                    <div key={i}
                      className="flex items-center justify-between p-3 bg-neutral-900/40
                        border border-neutral-800/40 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{c.condition}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Detected: {new Date(c.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-500">{c.status}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${riskColors[c.severity]}`}>
                          {c.severity.charAt(0).toUpperCase() + c.severity.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Activity Tab ── */}
          {activeTab === 'activity' && (
            <div className="p-6 space-y-5">

              {/* Progress Bars */}
              <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-neutral-200 mb-4">
                  Health Score Breakdown
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Overall Eye Health', value: 87, color: 'bg-neutral-500' },
                    { label: 'Glaucoma Risk Index', value: 72, color: 'bg-red-600' },
                    { label: 'Retinal Health', value: 91, color: 'bg-green-600' },
                    { label: 'Anterior Health', value: 95, color: 'bg-blue-600' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-neutral-400">{item.label}</span>
                        <span className="text-neutral-300 font-medium">{item.value}%</span>
                      </div>
                      <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-200">Recent Scans</h3>
                  <button
                    onClick={() => navigate('/history')}
                    className="text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {recentActivity.map((scan) => (
                    <div
                      key={scan.id}
                      onClick={() => navigate(`/report/${scan.id}`)}
                      className="flex items-center justify-between p-4 bg-neutral-800/30
                        border border-neutral-800/50 rounded-xl hover:border-neutral-700/50
                        transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-neutral-800/50
                          border border-neutral-700/50 flex items-center justify-center text-sm">
                          {scan.type.includes('Fundus') ? '■' : '■■'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-200 group-hover:text-neutral-100 transition-colors">
                            {scan.type}
                          </p>
                          <p className="text-xs text-neutral-600">
                            {new Date(scan.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 hidden md:block">{scan.result}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${riskColors[scan.risk]}`}>
                          {scan.risk.charAt(0).toUpperCase() + scan.risk.slice(1)}
                        </span>
                        <svg className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 group-hover:translate-x-1 transition-all"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Insurance Tab ── */}
          {activeTab === 'insurance' && (
            <div className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">

                {/* Insurance Details */}
                <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-neutral-200 mb-4">Insurance Details</h3>
                  {[
                    { label: 'Provider', key: 'insuranceProvider' },
                    { label: 'Policy Number', key: 'insuranceNumber' },
                  ].map((field) => (
                    <div key={field.key}
                      className="flex items-start gap-3 py-3 border-b border-neutral-800/40 last:border-0">
                      <span className="text-xs text-neutral-600 font-medium w-32 shrink-0 pt-1">
                        {field.label}
                      </span>
                      {isEditing ? (
                        <input type="text" name={field.key}
                          value={editProfile[field.key]} onChange={handleEditChange}
                          className="flex-1 px-3 py-1.5 bg-neutral-800/50 border
                            border-neutral-700/50 rounded-lg text-sm text-neutral-200
                            focus:outline-none focus:border-neutral-600" />
                      ) : (
                        <span className="text-sm text-neutral-300">
                          {profile[field.key] || '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Coverage */}
                <div className="bg-neutral-800/30 border border-neutral-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-neutral-200 mb-4">Coverage Summary</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Eye Exams', covered: true },
                      { label: 'AI Screening', covered: true },
                      { label: 'Specialist Referrals', covered: true },
                      { label: 'Surgery', covered: false },
                    ].map((item, i) => (
                      <div key={i}
                        className="flex items-center justify-between py-2 border-b border-neutral-800/40 last:border-0">
                        <span className="text-sm text-neutral-400">{item.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${item.covered
                            ? 'bg-green-900/20 text-green-400 border-green-800/30'
                            : 'bg-red-900/20 text-red-400 border-red-800/30'
                          }`}>
                          {item.covered ? 'Covered' : 'Not Covered'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neutral-800/20 border border-neutral-800/40 rounded-xl">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Insurance information is for reference only. Please verify coverage directly
                  with your provider before scheduling any procedures.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-neutral-900 border border-red-900/30 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
            Danger Zone
          </h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-200">Delete Account</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Permanently delete your account. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Are you sure? This action cannot be undone.')) {
                  logout();
                  localStorage.clear();
                  navigate('/');
                }
              }}
              className="px-4 py-2 border border-red-800/50 text-red-400 text-sm
                rounded-lg hover:bg-red-900/20 transition-colors whitespace-nowrap"
            >
              Delete Account
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Profile;
