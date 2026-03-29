import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, tokenStore } from '../services/authService';

var AuthContext = createContext(null);

export var useAuth = function () {
  var ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export var AuthProvider = function ({ children }) {
  var [user, setUser] = useState(null);
  var [loading, setLoading] = useState(true);
  var [profileComplete, setProfileComplete] = useState(false);

  /* ── On mount: restore session, always re-read from users DB ── */
  useEffect(function () {
    var restore = async function () {
      try {
        var cached = tokenStore.getUser();
        if (!cached || !cached.email) {
          setLoading(false);
          return;
        }

        // Show cached data instantly while we verify
        setUser(cached);
        setProfileComplete(!!cached.profileComplete);

        // Re-read fresh data from optha_users
        var fresh = await authService.getMe();
        setUser(fresh);
        setProfileComplete(!!fresh.profileComplete);

        // Keep session cache in sync
        localStorage.setItem('optha_session', JSON.stringify(fresh));
      } catch (_) {
        // Session invalid — clear everything
        tokenStore.clear();
        setUser(null);
        setProfileComplete(false);
      }
      setLoading(false);
    };

    restore();
  }, []);

  /* ── Register ── */
  var register = useCallback(async function (email, password, name) {
    var data = await authService.register(email, password, name);
    tokenStore.setTokens(data.access_token, data.refresh_token, data.user, false);
    setUser(data.user);
    setProfileComplete(!!data.user.profileComplete);
    return data.user;
  }, []);

  /* ── Login ── */
  var login = useCallback(async function (email, password, rememberMe) {
    var data = await authService.login(email, password, rememberMe);
    tokenStore.setTokens(data.access_token, data.refresh_token, data.user, rememberMe);
    setUser(data.user);
    setProfileComplete(!!data.user.profileComplete);
    return data.user;
  }, []);

  /* ── OAuth ── */
  var oauthLogin = useCallback(async function (email, name, picture, provider, sub) {
    var data = await authService.oauthLogin(email, name, picture, provider, sub);
    tokenStore.setTokens(data.access_token, data.refresh_token, data.user, true);
    setUser(data.user);
    setProfileComplete(!!data.user.profileComplete);
    return data.user;
  }, []);

  /* ── Logout ── */
  var logout = useCallback(async function () {
    await authService.logout();
    setUser(null);
    setProfileComplete(false);
  }, []);

  /* ── Update profile ── */
  var updateProfile = useCallback(async function (profileData) {
    var data = await authService.updateProfile(profileData);
    tokenStore.setTokens(
      data.access_token,
      data.refresh_token,
      data.user,
      tokenStore.isRemembered()
    );
    setUser(data.user);
    setProfileComplete(true);
    return data.user;
  }, []);

  /* ── Scan helpers ── */
  var addScan = useCallback(function (scanData) {
    var scans = [];
    try { scans = JSON.parse(localStorage.getItem('optha_scans') || '[]'); } catch (_) { }
    var newScan = Object.assign({}, scanData, {
      timestamp: new Date().toISOString(),
      id: scanData.id || 'SCN-' + Date.now(),
    });
    scans.unshift(newScan);
    localStorage.setItem('optha_scans', JSON.stringify(scans.slice(0, 100)));
    window.dispatchEvent(new CustomEvent('optha_scan_added', { detail: newScan }));
    return newScan;
  }, []);

  var getScans = useCallback(function () {
    try { return JSON.parse(localStorage.getItem('optha_scans') || '[]'); }
    catch (_) { return []; }
  }, []);

  var getLastScan = useCallback(function () {
    var s = getScans();
    return s.length > 0 ? s[0] : null;
  }, [getScans]);

  /* ── Settings ── */
  var getSettings = useCallback(function () {
    try {
      var s = localStorage.getItem('optha_settings');
      return s ? JSON.parse(s) : {
        emailNotifications: true, smsNotifications: false,
        highRiskAlerts: true, weeklyReports: true,
        dataSharing: false, anonymizedResearch: true,
        theme: 'dark', compactView: false,
        language: 'en', timezone: 'UTC-5',
      };
    } catch (_) { return {}; }
  }, []);

  var saveSettings = useCallback(function (settings) {
    localStorage.setItem('optha_settings', JSON.stringify(settings));
    if (settings.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    window.dispatchEvent(new CustomEvent('optha_settings_changed', { detail: settings }));
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      profileComplete,
      login,
      register,
      oauthLogin,
      logout,
      updateProfile,
      addScan,
      getScans,
      getLastScan,
      getSettings,
      saveSettings,
      rememberedEmail: tokenStore.getRememberedEmail(),
      isRemembered: tokenStore.isRemembered(),
    }}>
      {children}
    </AuthContext.Provider>
  );
};