import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui/index';

var menuItems = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', path: '/dashboard' },
  { id: 'scan',      icon: '📸', label: 'New Scan',  path: '/screen'   },
  { id: 'history',   icon: '🕐', label: 'History',   path: '/history'  },
  { id: 'reports',   icon: '📄', label: 'Reports',   path: '/reports'  },
  { id: 'profile',   icon: '👤', label: 'Profile',   path: '/profile'  },
  { id: 'settings',  icon: '⚙️', label: 'Settings',  path: '/settings' },
];

var DashboardLayout = function ({ children }) {
  var navigate = useNavigate();
  var location = useLocation();
  var { user, logout } = useAuth();
  var [showUserMenu, setShowUserMenu] = useState(false);
  var [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  var [search, setSearch] = useState('');

  var activeId = menuItems.find(function (m) {
    return location.pathname.startsWith(m.path);
  });
  var activeTab = activeId ? activeId.id : 'dashboard';

  var handleLogout = function () {
    logout();
    navigate('/login');
  };

  // Close mobile sidebar on route change
  useEffect(function () {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Close user menu on outside click
  useEffect(function () {
    if (!showUserMenu) return;
    var h = function (e) {
      if (!e.target.closest('#umenu')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', h);
    return function () { document.removeEventListener('mousedown', h); };
  }, [showUserMenu]);

  var SidebarContent = function () {
    return (
      <>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-bg-4)', border: '1px solid var(--color-border-2)' }}>
            <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>O</span>
          </div>
          <span className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>
            OpthaMiss
          </span>
        </div>

        {/* User info */}
        {user && (
          <div className="px-3 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3 px-2">
              <Avatar src={user.picture} name={user.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {user.name || 'User'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-3)' }}>
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="p-3 flex-1 overflow-y-auto space-y-0.5">
          {menuItems.map(function (item) {
            var isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={function () { navigate(item.path); }}
                className="ui-nav-item w-full"
                style={isActive ? {
                  background: 'var(--color-bg-4)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                } : {}}
              >
                <span className="text-lg leading-none flex-shrink-0">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* AI Status */}
          <div className="px-3 py-3 rounded-xl mb-2"
            style={{ background: 'var(--color-bg-4)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot flex-shrink-0" />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-2)' }}>
                AI Models Active
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-4)' }}>
              2 models ready for screening
            </p>
          </div>

          {/* Logout */}
          <button type="button" onClick={handleLogout}
            className="ui-nav-item w-full"
            style={{ color: 'var(--risk-high-text)' }}>
            <span className="text-lg leading-none">🚪</span>
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Desktop Sidebar */}
      <aside className="ui-sidebar hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={function () { setMobileSidebarOpen(false); }} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col animate-slide-in-left"
            style={{ background: 'var(--color-bg-2)', borderRight: '1px solid var(--color-border)' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:ml-64 min-h-screen flex flex-col">

        {/* Header */}
        <header className="ui-header">

          {/* Mobile hamburger */}
          <button type="button" className="lg:hidden p-2 rounded-lg mr-3 transition-colors"
            style={{ color: 'var(--color-text-2)' }}
            onClick={function () { setMobileSidebarOpen(true); }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mr-4">
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>OpthaMiss</span>
          </div>

          {/* Search */}
          <div className="hidden sm:flex flex-1 max-w-xs">
            <div className="relative w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: 'var(--color-text-4)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={function (e) { setSearch(e.target.value); }}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none transition-all duration-300"
                style={{
                  background: 'var(--color-bg-3)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 ml-auto">

            {/* New scan */}
            <button type="button" onClick={function () { navigate('/screen'); }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300"
              style={{
                background: 'var(--color-bg-4)',
                border: '1px solid var(--color-border-2)',
                color: 'var(--color-text)',
              }}
              onMouseEnter={function (e) { e.currentTarget.style.borderColor = 'var(--color-accent-2)'; }}
              onMouseLeave={function (e) { e.currentTarget.style.borderColor = 'var(--color-border-2)'; }}>
              <span>📸</span>
              <span>New Scan</span>
            </button>

            {/* Notification */}
            <button type="button" onClick={function () { navigate('/reports'); }}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--color-bg-3)'; }}
              onMouseLeave={function (e) { e.currentTarget.style.background = ''; }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse-dot" />
            </button>

            {/* User menu */}
            <div className="relative" id="umenu">
              <button type="button" onClick={function () { setShowUserMenu(function (v) { return !v; }); }}
                className="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
                onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--color-bg-3)'; }}
                onMouseLeave={function (e) { e.currentTarget.style.background = ''; }}>
                <Avatar src={user && user.picture} name={user && user.name} size="sm" />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-none" style={{ color: 'var(--color-text)' }}>
                    {user && user.name ? user.name.split(' ')[0] : 'User'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Patient</p>
                </div>
                <svg className="w-3.5 h-3.5 hidden md:block" style={{ color: 'var(--color-text-4)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden shadow-lg z-50 animate-scale-in"
                  style={{ background: 'var(--color-bg-3)', border: '1px solid var(--color-border-2)' }}>

                  {user && (
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {user.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-3)' }}>
                        {user.email}
                      </p>
                    </div>
                  )}

                  {[
                    { icon: '👤', label: 'Profile',  path: '/profile'  },
                    { icon: '📄', label: 'Reports',  path: '/reports'  },
                    { icon: '⚙️', label: 'Settings', path: '/settings' },
                  ].map(function (item) {
                    return (
                      <button key={item.path} type="button"
                        onClick={function () { setShowUserMenu(false); navigate(item.path); }}
                        className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors"
                        style={{ color: 'var(--color-text-2)' }}
                        onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--color-bg-4)'; }}
                        onMouseLeave={function (e) { e.currentTarget.style.background = ''; }}>
                        <span className="text-base leading-none">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}

                  <div style={{ borderTop: '1px solid var(--color-border)' }} />
                  <button type="button" onClick={function () { setShowUserMenu(false); handleLogout(); }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors"
                    style={{ color: 'var(--risk-high-text)' }}
                    onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--risk-high-bg)'; }}
                    onMouseLeave={function (e) { e.currentTarget.style.background = ''; }}>
                    <span className="text-base leading-none">🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-5 lg:p-7 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;