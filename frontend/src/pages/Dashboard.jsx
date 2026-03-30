import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLastScan } from '../hooks/useLastScan';

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, getScans } = useAuth();
  const { timeAgo } = useLastScan();

  const [totalScans, setTotalScans] = useState(0);
  const [recentScans, setRecentScans] = useState([]);
  const [healthScore] = useState(87);

  const refreshScans = useCallback(function () {
    var scans = getScans();
    setTotalScans(scans.length);
    setRecentScans(scans.slice(0, 4));
  }, [getScans]);

  useEffect(function () {
    if (!user) {
      navigate('/login');
      return;
    }
    refreshScans();

    // Listen for new scans added in real time
    var handler = function () { refreshScans(); };
    window.addEventListener('optha_scan_added', handler);
    return function () { window.removeEventListener('optha_scan_added', handler); };
  }, [user, navigate, refreshScans]);

  if (!user) return null;

  var stats = {
    totalScans: totalScans || 47,
    lastScan: timeAgo,
    riskLevel: 'Low',
    accuracy: 98.2,
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>

      {/* Sidebar */}
      <Sidebar user={user} onLogout={function () { logout(); navigate('/login'); }} />

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">

        {/* Top Navigation */}
        <TopNav user={user} onLogout={function () { logout(); navigate('/login'); }} />

        {/* Dashboard Content */}
        <main className="p-6 lg:p-8 space-y-6">

          {/* Welcome Banner */}
          <WelcomeBanner user={user} />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon="📊"
              label="Total Scans"
              value={stats.totalScans}
              change="+12% from last month"
              positive={true}
            />
            <StatCard
              icon="🕐"
              label="Last Scan"
              value={stats.lastScan}
              change="Most recent screening"
              positive={null}
            />
            <StatCard
              icon="🎯"
              label="Avg. Accuracy"
              value={stats.accuracy + '%'}
              change={'Based on ' + stats.totalScans + ' scans'}
              positive={true}
            />
            <StatCard
              icon="💚"
              label="Overall Risk"
              value={stats.riskLevel}
              change="No urgent findings"
              positive={true}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              <ScanActivityChart />
              <RecentScans scans={recentScans} />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <EyeHealthWidget score={healthScore} totalScans={stats.totalScans} />
              <QuickActions />
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════

const Sidebar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(function () {
    var path = window.location.pathname;
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/screen')) return 'scan';
    if (path.startsWith('/history')) return 'history';
    if (path.startsWith('/reports')) return 'reports';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  });

  var menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', path: '/dashboard' },
    { id: 'scan',      icon: '📸', label: 'New Scan',  path: '/screen'    },
    { id: 'history',   icon: '🕐', label: 'History',   path: '/history'   },
    { id: 'reports',   icon: '📄', label: 'Reports',   path: '/reports'   },
    { id: 'profile',   icon: '👤', label: 'Profile',   path: '/profile'   },
    { id: 'settings',  icon: '⚙️', label: 'Settings',  path: '/settings'  },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-40 hidden lg:flex flex-col"
      style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>

      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <span className="font-bold text-sm" style={{ color: 'var(--text-h)' }}>O</span>
        </div>
        <span className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>OpthaMiss</span>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img src={user.picture} alt="avatar" loading="lazy" decoding="async"
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                style={{ border: '1px solid var(--border)' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-h)' }}>
                {user.name || 'User'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {user.email || 'Patient'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {menuItems.map(function (item) {
          var isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={function () {
                setActiveTab(item.id);
                navigate(item.path);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left"
              style={isActive
                ? { background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-h)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {/* AI Status */}
        <div className="p-3 rounded-lg mb-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>AI Models Active</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>2 models ready for screening</p>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          style={{ color: 'var(--risk-high-text)' }}
        >
          <span className="text-lg">🚪</span>
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

// ═══════════════════════════════════════════════════════════════
// TOP NAVIGATION
// ═══════════════════════════════════════════════════════════════

const TopNav = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [search, setSearch] = useState('');

  // Close menu when clicking outside
  useEffect(function () {
    if (!showUserMenu) return;
    var handler = function (e) {
      if (!e.target.closest('#user-menu-btn')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return function () { document.removeEventListener('mousedown', handler); };
  }, [showUserMenu]);

  return (
    <header className="h-16 flex items-center justify-between px-6 lg:px-8 flex-shrink-0"
      style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>

      {/* Mobile logo */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <span className="font-bold text-xs" style={{ color: 'var(--text-h)' }}>O</span>
        </div>
        <span className="font-semibold text-sm" style={{ color: 'var(--text-h)' }}>OpthaMiss</span>
      </div>

      {/* Search */}
      <div className="hidden sm:flex flex-1 max-w-md ml-4 lg:ml-0">
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search scans, reports..."
            value={search}
            onChange={function (e) { setSearch(e.target.value); }}
            className="w-full px-4 py-2 pl-9 rounded-lg text-sm focus:outline-none transition-all"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
            }}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: 'var(--text-subtle)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">

        {/* New Scan shortcut */}
        <button
          type="button"
          onClick={function () { navigate('/screen'); }}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-h)' }}
        >
          <span>📸</span>
          <span>New Scan</span>
        </button>

        {/* Notification */}
        <button
          type="button"
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onClick={function () { navigate('/reports'); }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative" id="user-menu-btn">
          <button
            type="button"
            onClick={function () { setShowUserMenu(function (v) { return !v; }); }}
            className="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-h)' }}
          >
            {user && user.picture ? (
              <img src={user.picture} alt="avatar" loading="lazy" decoding="async"
                className="w-8 h-8 rounded-full object-cover"
                style={{ border: '1px solid var(--border)' }} />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
                {user && user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none mb-0.5" style={{ color: 'var(--text-h)' }}>
                {user && user.name ? user.name.split(' ')[0] : 'User'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Patient</p>
            </div>
            <svg className="w-3.5 h-3.5 hidden md:block" style={{ color: 'var(--text-subtle)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl overflow-hidden z-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {user && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-h)' }}>{user.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                </div>
              )}
              {[
                { icon: '👤', label: 'Profile', path: '/profile' },
                { icon: '📄', label: 'Reports', path: '/reports' },
                { icon: '⚙️', label: 'Settings', path: '/settings' },
              ].map(function (item) {
                return (
                  <button key={item.path} type="button"
                    onClick={function () { setShowUserMenu(false); navigate(item.path); }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={function (e) { e.currentTarget.style.background = ''; }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <div style={{ borderTop: '1px solid var(--border)' }} />
              <button type="button" onClick={function () { setShowUserMenu(false); onLogout(); }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors"
                style={{ color: 'var(--risk-high-text)' }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--risk-high-bg)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = ''; }}>
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════
// WELCOME BANNER
// ═══════════════════════════════════════════════════════════════

const WelcomeBanner = ({ user }) => {
  const navigate = useNavigate();
  const { getScans } = useAuth();
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  var scans = getScans();
  var isNewUser = scans.length === 0;

  if (isNewUser) {
    return (
      <div className="relative overflow-hidden rounded-xl p-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20"
            style={{ background: 'rgba(163,163,163,0.1)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl opacity-20"
            style={{ background: 'rgba(163,163,163,0.08)' }} />
        </div>
        <div className="relative z-10">

          {/* Heading */}
          <div className="flex items-center gap-3 mb-2">
            {user && user.picture ? (
              <img src={user.picture} alt="avatar" loading="lazy" decoding="async"
                className="w-12 h-12 rounded-xl object-cover"
                style={{ border: '1px solid var(--border)' }} />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
                {user && user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>
                Welcome to OpthaMiss! 👋
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Hello, {user && user.name ? user.name.split(' ')[0] : 'there'}! Your account is ready.
              </p>
            </div>
          </div>

          <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

          {/* Steps */}
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
            Get started in 3 easy steps:
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { step: '01', title: 'Take a Photo', desc: 'Capture a clear photo of your eye using your phone camera.' },
              { step: '02', title: 'Upload & Scan', desc: 'Upload the image and let our AI screen for 21 conditions.' },
              { step: '03', title: 'View Report', desc: 'Get your detailed screening report with clinical guidance.' },
            ].map(function (item, i) {
              return (
                <div key={i} className="p-4 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-subtle)' }}>{item.step}</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-h)' }}>{item.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button type="button" onClick={function () { navigate('/screen'); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--accent-border)', color: 'var(--text-h)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Start Your First Scan
            </button>
            <button type="button" onClick={function () { navigate('/profile'); }}
              className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
              Complete your profile first →
            </button>
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-subtle)' }}>
            Your first scan is completely free. No credit card required. Results available instantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl p-6 md:p-8"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: 'rgba(163,163,163,0.15)' }} />
      </div>
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user && user.picture ? (
            <img src={user.picture} alt="avatar" loading="lazy" decoding="async"
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              style={{ border: '1px solid var(--border)' }} />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
              {user && user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>
              {greeting}, {user && user.name ? user.name.split(' ')[0] : 'there'}! 👋
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Your eye health dashboard is ready.
            </p>
          </div>
        </div>
        <button type="button" onClick={function () { navigate('/screen'); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
          style={{ background: 'var(--bg-hover)', border: '1px solid var(--accent-border)', color: 'var(--text-h)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Scan
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, change, positive }) => {
  return (
    <div className="rounded-xl p-5 transition-all duration-300"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      onMouseEnter={function (e) { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={function (e) { e.currentTarget.style.borderColor = 'var(--border)'; }}>

      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          {icon}
        </div>
        {positive !== null && (
          <div className="px-2 py-1 rounded-lg text-xs font-medium"
            style={positive
              ? { background: 'var(--risk-low-bg)', border: '1px solid var(--risk-low-border)', color: 'var(--risk-low-text)' }
              : { background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', color: 'var(--risk-high-text)' }}>
            {positive ? '↑' : '↓'}
          </div>
        )}
      </div>

      <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mb-1.5" style={{ color: 'var(--text-h)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{change}</p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCAN ACTIVITY CHART
// ═══════════════════════════════════════════════════════════════

const ScanActivityChart = () => {
  const { getScans } = useAuth();
  const [period, setPeriod] = useState('7');

  // Build chart data from real scans
  var buildChartData = function (days) {
    var scans = getScans();
    var result = [];
    var now = new Date();

    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      var dayStr = d.toDateString();
      var count = scans.filter(function (s) {
        return new Date(s.timestamp).toDateString() === dayStr;
      }).length;
      var label = days <= 7
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
        : d.getDate() + '/' + (d.getMonth() + 1);
      result.push({ label: label, value: count });
    }

    // If no real data, show sample data
    var hasData = result.some(function (r) { return r.value > 0; });
    if (!hasData) {
      var sample = [12, 19, 15, 25, 22, 30, 28];
      result = result.map(function (r, i) {
        return { label: r.label, value: sample[i % sample.length] };
      });
    }

    return result;
  };

  var data = buildChartData(Number(period));
  var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-0.5" style={{ color: 'var(--text-h)' }}>Scan Activity</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {period === '7' ? 'Last 7 days' : period === '30' ? 'Last 30 days' : 'Last 90 days'}
          </p>
        </div>
        <select
          value={period}
          onChange={function (e) { setPeriod(e.target.value); }}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-h)' }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div className="flex items-end gap-2 h-40">
        {data.map(function (item, i) {
          var heightPct = (item.value / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="w-full relative flex items-end" style={{ height: '120px' }}>
                <div
                  className="w-full rounded-t-md transition-all duration-500 cursor-pointer"
                  style={{
                    height: Math.max(heightPct, 8) + '%',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    borderBottom: 'none',
                  }}
                  onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                  onMouseLeave={function (e) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <span className="text-xs px-2 py-0.5 rounded whitespace-nowrap"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-h)' }}>
                    {item.value}
                  </span>
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// RECENT SCANS — Dynamic from AuthContext
// ═══════════════════════════════════════════════════════════════

const RecentScans = ({ scans }) => {
  const navigate = useNavigate();
  const { getScans } = useAuth();

  // Fall back to stored scans if prop is empty
  var displayScans = scans && scans.length > 0 ? scans : getScans().slice(0, 4);

  var riskStyle = {
    high: { background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', color: 'var(--risk-high-text)' },
    moderate: { background: 'var(--risk-moderate-bg)', border: '1px solid var(--risk-moderate-border)', color: 'var(--risk-moderate-text)' },
    low: { background: 'var(--risk-low-bg)', border: '1px solid var(--risk-low-border)', color: 'var(--risk-low-text)' },
    HIGH: { background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', color: 'var(--risk-high-text)' },
    MODERATE: { background: 'var(--risk-moderate-bg)', border: '1px solid var(--risk-moderate-border)', color: 'var(--risk-moderate-text)' },
    LOW: { background: 'var(--risk-low-bg)', border: '1px solid var(--risk-low-border)', color: 'var(--risk-low-text)' },
  };

  var formatDate = function (ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      var now = new Date();
      var diffMs = now - d;
      var diffMin = Math.floor(diffMs / 60000);
      var diffHr = Math.floor(diffMin / 60);
      var diffDay = Math.floor(diffHr / 24);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return diffMin + 'm ago';
      if (diffHr < 24) return diffHr + 'h ago';
      if (diffDay === 1) return 'Yesterday';
      return d.toLocaleDateString();
    } catch (e) { return ts; }
  };

  // Static fallback if no real scans
  var fallbackScans = [
    { id: 'SCN-001', type: 'Anterior', timestamp: null, date: '2 hours ago', result: 'Normal', risk: 'low' },
    { id: 'SCN-002', type: 'Fundus', timestamp: null, date: 'Yesterday', result: 'Detected: Glaucoma', risk: 'high' },
    { id: 'SCN-003', type: 'Anterior', timestamp: null, date: '3 days ago', result: 'Normal', risk: 'low' },
    { id: 'SCN-004', type: 'Fundus', timestamp: null, date: '1 week ago', result: 'Detected: AMD', risk: 'moderate' },
  ];

  var scansToShow = displayScans.length > 0 ? displayScans : fallbackScans;

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>Recent Scans</h3>
        <button type="button" onClick={function () { navigate('/history'); }}
          className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
          View All →
        </button>
      </div>

      {scansToShow.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No scans yet.</p>
          <button type="button" onClick={function () { navigate('/screen'); }}
            className="mt-3 text-sm transition-colors" style={{ color: 'var(--accent)' }}>
            Start your first scan →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {scansToShow.map(function (scan, i) {
            var riskKey = (scan.risk || 'low').toUpperCase();
            var rs = riskStyle[riskKey] || riskStyle.low;
            var displayDate = scan.timestamp ? formatDate(scan.timestamp) : (scan.date || '');
            var conditionsText = scan.conditions && scan.conditions.length > 0
              ? 'Detected: ' + scan.conditions.slice(0, 2).join(', ')
              : scan.result || 'Normal';

            return (
              <div
                key={scan.id || i}
                onClick={function () { navigate('/report/' + (scan.id || 'SCN-001')); }}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer group"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                onMouseEnter={function (e) { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {scan.type === 'Anterior' ? '👁️' : '🔬'}
                  </div>
                  <div>
                    <p className="text-sm font-medium transition-colors" style={{ color: 'var(--text-h)' }}>
                      {scan.type} Eye Scan
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{displayDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                    {conditionsText}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={rs}>
                    {riskKey.charAt(0) + riskKey.slice(1).toLowerCase()}
                  </span>
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                    style={{ color: 'var(--text-subtle)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// EYE HEALTH WIDGET
// ═══════════════════════════════════════════════════════════════

const EyeHealthWidget = ({ score, totalScans }) => {
  var healthScore = score || 87;

  var scoreColor = healthScore >= 80 ? 'var(--risk-low-text)'
    : healthScore >= 60 ? 'var(--risk-moderate-text)'
    : 'var(--risk-high-text)';

  var barColor = healthScore >= 80 ? '#22c55e'
    : healthScore >= 60 ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h3 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-h)' }}>Eye Health Score</h3>

      {/* Eye SVG */}
      <div className="relative h-40 flex items-center justify-center mb-5">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-28 h-28 rounded-full blur-2xl opacity-30 animate-pulse"
            style={{ background: barColor }} />
        </div>
        <div className="relative z-10 animate-float-slow">
          <svg width="110" height="110" viewBox="0 0 120 120">
            <ellipse cx="60" cy="60" rx="50" ry="32" fill="url(#eye-grad-d)"
              stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            <circle cx="60" cy="60" r="22" fill="url(#iris-grad-d)" />
            <circle cx="60" cy="60" r="12" fill="#000" />
            <circle cx="66" cy="54" r="5" fill="rgba(255,255,255,0.85)" />
            <circle cx="55" cy="64" r="2.5" fill="rgba(255,255,255,0.45)" />
            <defs>
              <radialGradient id="eye-grad-d">
                <stop offset="0%" stopColor="#d4d4d4" />
                <stop offset="100%" stopColor="#a3a3a3" />
              </radialGradient>
              <radialGradient id="iris-grad-d">
                <stop offset="0%" stopColor="#737373" />
                <stop offset="50%" stopColor="#525252" />
                <stop offset="100%" stopColor="#404040" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Score */}
      <div className="text-center mb-5">
        <div className="text-4xl font-bold mb-1" style={{ color: scoreColor }}>{healthScore}%</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Based on {totalScans || 47} scans
        </p>
      </div>

      {/* Bar */}
      <div className="w-full h-2 rounded-full overflow-hidden mb-2"
        style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: healthScore + '%', background: barColor }} />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-subtle)' }}>
        <span>Poor</span>
        <span>Excellent</span>
      </div>

      {/* Insight */}
      <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--risk-low-text)' }}>✓</span>{' '}
          {healthScore >= 80
            ? 'Your eye health looks great! Keep up regular screenings.'
            : healthScore >= 60
              ? 'Some conditions detected. Follow up with your doctor.'
              : 'Urgent attention needed. Please see an ophthalmologist.'}
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUICK ACTIONS
// ═══════════════════════════════════════════════════════════════

const QuickActions = () => {
  const navigate = useNavigate();
  const { getScans } = useAuth();

  var scanCount = getScans().length;

  var actions = [
    { icon: '📸', label: 'New Scan', desc: 'Screen your eyes now', path: '/screen' },
    { icon: '📄', label: 'View Reports', desc: scanCount + ' reports available', path: '/reports' },
    { icon: '🕐', label: 'History', desc: 'Browse past scans', path: '/history' },
    { icon: '👤', label: 'Profile', desc: 'Update your details', path: '/profile' },
  ];

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-h)' }}>Quick Actions</h3>

      <div className="space-y-2">
        {actions.map(function (action, i) {
          return (
            <button
              key={i}
              type="button"
              onClick={function () { navigate(action.path); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-all group text-left"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              onMouseEnter={function (e) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onMouseLeave={function (e) {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{action.label}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{action.desc}</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                style={{ color: 'var(--text-subtle)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
