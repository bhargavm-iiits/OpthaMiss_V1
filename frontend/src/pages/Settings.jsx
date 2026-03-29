import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

var Settings = function () {
  var navigate = useNavigate();
  var { user, logout, getSettings, saveSettings } = useAuth();
  var { addToast } = useToast();

  var [activeTab, setActiveTab] = useState('account');
  var [settings, setSettings] = useState(getSettings());
  var [isDirty, setIsDirty] = useState(false);
  var [saving, setSaving] = useState(false);
  var [showDeleteModal, setShowDeleteModal] = useState(false);
  var [deleteConfirm, setDeleteConfirm] = useState('');

  var [accountForm, setAccountForm] = useState({
    name: (user && user.name) || '',
    phone: (user && user.phone) || '',
    language: 'en',
    timezone: 'UTC-5',
  });

  var [passwordForm, setPasswordForm] = useState({
    current: '', newPass: '', confirm: '',
  });

  var isOAuth = user && (user.provider === 'google' || user.provider === 'apple');

  /* Apply theme when it changes */
  useEffect(function () {
    if (settings.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  var handleSettingToggle = function (key) {
    setSettings(function (prev) {
      var next = Object.assign({}, prev);
      next[key] = !prev[key];
      return next;
    });
    setIsDirty(true);
  };

  var handleSettingChange = function (key, value) {
    setSettings(function (prev) {
      var next = Object.assign({}, prev);
      next[key] = value;
      return next;
    });
    setIsDirty(true);
  };

  var handleAccountChange = function (e) {
    var n = e.target.name;
    var v = e.target.value;
    setAccountForm(function (prev) {
      var next = Object.assign({}, prev);
      next[n] = v;
      return next;
    });
    setIsDirty(true);
  };

  var handleSaveSettings = function () {
    setSaving(true);
    setTimeout(function () {
      saveSettings(settings);
      /* Also update user account fields */
      var stored = JSON.parse(localStorage.getItem('optha_user') || '{}');
      stored.name = accountForm.name;
      stored.phone = accountForm.phone;
      localStorage.setItem('optha_user', JSON.stringify(stored));
      setSaving(false);
      setIsDirty(false);
      addToast('Settings saved successfully!', 'success');
    }, 800);
  };

  var handleChangePassword = function (e) {
    e.preventDefault();
    if (!passwordForm.current) { addToast('Enter your current password', 'error'); return; }
    if (passwordForm.newPass.length < 8) { addToast('New password must be at least 8 characters', 'error'); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { addToast('Passwords do not match', 'error'); return; }
    setSaving(true);
    setTimeout(function () {
      setSaving(false);
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      addToast('Password changed successfully!', 'success');
    }, 800);
  };

  var handleDeleteAccount = function () {
    if (deleteConfirm !== 'DELETE') {
      addToast('Type DELETE to confirm', 'error');
      return;
    }
    logout();
    addToast('Account deleted. Sorry to see you go.', 'info');
    navigate('/');
  };

  var tabClass = function (id) {
    return (
      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 ' +
      (activeTab === id
        ? 'text-neutral-200 border'
        : 'text-neutral-500 hover:text-neutral-300')
    );
  };

  var tabStyle = function (id) {
    if (activeTab === id) return { background: 'var(--bg-hover)', borderColor: 'var(--border)' };
    return {};
  };

  var inputClass = 'w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none transition-colors';
  var inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' };

  var tabs = [
    { id: 'account', label: 'Account' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'display', label: 'Display' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>Settings</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage your account and preferences</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="rounded-xl p-2 space-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {tabs.map(function (tab) {
                return (
                  <button key={tab.id} type="button" onClick={function () { setActiveTab(tab.id); }}
                    className={tabClass(tab.id)} style={tabStyle(tab.id)}>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            <div className="rounded-xl p-6 space-y-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              {/* ── ACCOUNT ── */}
              {activeTab === 'account' && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>Account Information</h2>

                  {/* OAuth badge */}
                  {isOAuth && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}>
                      <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Signed in via {user.provider === 'google' ? 'Google' : 'Apple'}. Some fields are managed by your provider.
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Display Name</label>
                      <input type="text" name="name" value={accountForm.name}
                        onChange={handleAccountChange} className={inputClass} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Email Address {isOAuth && <span className="text-xs opacity-50">(managed by {user.provider})</span>}
                      </label>
                      <input type="email" value={(user && user.email) || ''} readOnly
                        className={inputClass} style={Object.assign({}, inputStyle, { opacity: 0.6, cursor: 'not-allowed' })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
                      <input type="tel" name="phone" value={accountForm.phone}
                        onChange={handleAccountChange} placeholder="+1 234 567 8900"
                        className={inputClass} style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Language</label>
                        <select name="language" value={accountForm.language} onChange={handleAccountChange}
                          className={inputClass} style={inputStyle}>
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                          <option value="ar">Arabic</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Timezone</label>
                        <select name="timezone" value={accountForm.timezone} onChange={handleAccountChange}
                          className={inputClass} style={inputStyle}>
                          <option value="UTC-5">Eastern (UTC-5)</option>
                          <option value="UTC-6">Central (UTC-6)</option>
                          <option value="UTC-7">Mountain (UTC-7)</option>
                          <option value="UTC-8">Pacific (UTC-8)</option>
                          <option value="UTC+0">UTC+0</option>
                          <option value="UTC+5:30">IST (UTC+5:30)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Change Password (email only) */}
                  {!isOAuth && (
                    <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-h)' }}>Change Password</h3>
                      <form onSubmit={handleChangePassword} className="space-y-3">
                        <input type="password" placeholder="Current password" value={passwordForm.current}
                          onChange={function (e) { setPasswordForm(function (p) { return Object.assign({}, p, { current: e.target.value }); }); }}
                          className={inputClass} style={inputStyle} />
                        <input type="password" placeholder="New password (min. 8 chars)" value={passwordForm.newPass}
                          onChange={function (e) { setPasswordForm(function (p) { return Object.assign({}, p, { newPass: e.target.value }); }); }}
                          className={inputClass} style={inputStyle} />
                        <input type="password" placeholder="Confirm new password" value={passwordForm.confirm}
                          onChange={function (e) { setPasswordForm(function (p) { return Object.assign({}, p, { confirm: e.target.value }); }); }}
                          className={inputClass} style={inputStyle} />
                        <button type="submit" disabled={saving}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
                          Update Password
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* ── NOTIFICATIONS ── */}
              {activeTab === 'notifications' && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>Notification Preferences</h2>
                  <div className="space-y-3">
                    {[
                      { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive scan results and reports via email' },
                      { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Urgent alerts via text message' },
                      { key: 'highRiskAlerts', label: 'High Risk Alerts', desc: 'Immediate notification for high-risk detections' },
                      { key: 'weeklyReports', label: 'Weekly Summary Reports', desc: 'Receive a weekly health summary email' },
                    ].map(function (item) {
                      return (
                        <div key={item.key} className="flex items-start justify-between p-4 rounded-xl"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-h)' }}>{item.label}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                          </div>
                          <button type="button" onClick={function () { handleSettingToggle(item.key); }}
                            className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (settings[item.key] ? 'bg-neutral-600' : 'bg-neutral-800')}>
                            <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' + (settings[item.key] ? 'translate-x-6' : 'translate-x-1')} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── PRIVACY ── */}
              {activeTab === 'privacy' && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>Privacy & Data</h2>
                  <div className="space-y-3">
                    {[
                      { key: 'anonymizedResearch', label: 'Anonymous Research Data', desc: 'Help improve AI models by sharing anonymized scan data' },
                      { key: 'dataSharing', label: 'Third-Party Data Sharing', desc: 'Share data with partner institutions' },
                    ].map(function (item) {
                      return (
                        <div key={item.key} className="flex items-start justify-between p-4 rounded-xl"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-h)' }}>{item.label}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                          </div>
                          <button type="button" onClick={function () { handleSettingToggle(item.key); }}
                            className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (settings[item.key] ? 'bg-neutral-600' : 'bg-neutral-800')}>
                            <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' + (settings[item.key] ? 'translate-x-6' : 'translate-x-1')} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Data management */}
                  <div className="pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>Data Management</h3>
                    <button type="button" onClick={function () { addToast('Data export will be emailed to you within 24 hours.', 'info'); }}
                      className="text-sm transition-colors block" style={{ color: 'var(--text-muted)' }}>
                      Download All My Data →
                    </button>
                    <button type="button" onClick={function () { setShowDeleteModal(true); }}
                      className="text-sm block transition-colors" style={{ color: 'var(--risk-high-text)' }}>
                      Delete My Account →
                    </button>
                  </div>
                </div>
              )}

              {/* ── DISPLAY ── */}
              {activeTab === 'display' && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>Display Settings</h2>

                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Theme</label>
                    <div className="flex items-center gap-3">
                      {['dark', 'light'].map(function (t) {
                        return (
                          <button key={t} type="button" onClick={function () { handleSettingChange('theme', t); }}
                            className={'flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ' + (settings.theme === t ? 'border-2' : 'border')}
                            style={settings.theme === t
                              ? { background: 'var(--bg-hover)', borderColor: 'var(--accent-border)', color: 'var(--text-h)' }
                              : { background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-start justify-between p-4 rounded-xl"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-h)' }}>Compact View</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Show more content in less space</p>
                    </div>
                    <button type="button" onClick={function () { handleSettingToggle('compactView'); }}
                      className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (settings.compactView ? 'bg-neutral-600' : 'bg-neutral-800')}>
                      <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' + (settings.compactView ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={function () { navigate('/dashboard'); }}
                  className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveSettings}
                  disabled={!isDirty || saving}
                  className="px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: isDirty ? 'var(--bg-hover)' : 'var(--bg-secondary)', border: '1px solid ' + (isDirty ? 'var(--accent-border)' : 'var(--border)'), color: 'var(--text-h)' }}>
                  {saving ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--risk-high-border)' }}>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--risk-high-text)' }}>Delete Account</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                This will permanently delete your account and all data. This action cannot be undone.
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Type <span className="font-mono font-bold" style={{ color: 'var(--text-h)' }}>DELETE</span> to confirm:
              </p>
              <input type="text" value={deleteConfirm} onChange={function (e) { setDeleteConfirm(e.target.value); }}
                placeholder="Type DELETE" className="w-full px-4 py-2.5 rounded-lg text-sm mb-4 focus:outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' }} />
              <div className="flex gap-3">
                <button type="button" onClick={function () { setShowDeleteModal(false); setDeleteConfirm(''); }}
                  className="flex-1 py-2.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleDeleteAccount} disabled={deleteConfirm !== 'DELETE'}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', color: 'var(--risk-high-text)' }}>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Settings;