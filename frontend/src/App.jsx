import { useState, useEffect } from 'react';
import CinematicIntro from './animations/CinematicIntro';
import LoadingScreen from './animations/LoadingScreen';
import BackgroundEffects from './animations/BackgroundEffects';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AIDetection from './components/AIDetection';
import About from './components/About';
import Features from './components/Features';
import EyeGuide from './components/EyeGuide';
import './styles/globals.css'

function App() {
  const [loading, setLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1200);
  }, []);

  if (loading) return <LoadingScreen />;
  if (!introComplete) return <CinematicIntro onComplete={() => setIntroComplete(true)} />;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 relative">
      <BackgroundEffects />
      <Navbar />
      <Hero />
      <AIDetection />
      <EyeGuide />
      <About />
      <Features />
      <footer className="py-8 text-center text-neutral-600 border-t border-neutral-800 relative z-10">
        <p>&copy; 2024 OpthaMiss. AI-Powered Eye Disease Detection.</p>
      </footer>
    </div>
  );
}

export default App;