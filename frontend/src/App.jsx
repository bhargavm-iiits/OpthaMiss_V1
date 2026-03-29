import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import CinematicIntro from './animations/CinematicIntro';
import LoadingScreen from './animations/LoadingScreen';
import BackgroundEffects from './animations/BackgroundEffects';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AIDetection from './components/AIDetection';
import About from './components/About';
import Features from './components/Features';
import EyeGuide from './components/EyeGuide';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CompleteProfile from './pages/CompleteProfile';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Reports from './pages/Reports';
import Report from './pages/Report';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import './styles/globals.css';

/* Apply saved theme on load */
var saved = localStorage.getItem('optha_settings');
if (saved) {
  try {
    var s = JSON.parse(saved);
    if (s.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}
}

var ProtectedRoute = function ({ children }) {
  var { user, loading, profileComplete } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profileComplete) return <Navigate to="/complete-profile" replace />;
  return children;
};

var ProfileGuard = function ({ children }) {
  var { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

var HomePage = function () {
  return (
    <div className="min-h-screen text-neutral-200 relative" style={{ background: 'var(--bg-primary)' }}>
      <BackgroundEffects />
      <Navbar />
      <Hero />
      <AIDetection />
      <EyeGuide />
      <About />
      <Features />
      <footer className="py-8 text-center border-t relative z-10"
        style={{ color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
        <p>&copy; 2025 OpthaMiss. AI-Powered Eye Disease Detection.</p>
      </footer>
    </div>
  );
};

function App() {
  var { loading } = useAuth();
  var [introComplete, setIntroComplete] = useState(false);
  var [showLoading, setShowLoading] = useState(true);

  useEffect(function () {
    var hasSeenIntro = sessionStorage.getItem('hasSeenIntro');
    if (hasSeenIntro) {
      setShowLoading(false);
      setIntroComplete(true);
    } else {
      setTimeout(function () { setShowLoading(false); }, 1200);
    }
  }, []);

  var handleIntroComplete = function () {
    setIntroComplete(true);
    sessionStorage.setItem('hasSeenIntro', 'true');
  };

  if (loading || showLoading) return <LoadingScreen />;
  if (!introComplete) return <CinematicIntro onComplete={handleIntroComplete} />;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/screen" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Profile completion — requires login but not completed profile */}
        <Route path="/complete-profile" element={
          <ProfileGuard><CompleteProfile /></ProfileGuard>
        } />

        {/* Protected routes — require login + completed profile */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/report/:id" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;