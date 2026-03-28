import { useState, useEffect } from 'react';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-500 ${
      scrolled
        ? 'bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/50'
        : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <a href="#home" className="text-lg font-semibold text-neutral-200 tracking-wide">
          OpthaMiss
        </a>
        <div className="hidden md:flex space-x-8 text-sm">
          {['Home', 'Detection', 'Guide', 'About', 'Features'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-neutral-500 hover:text-neutral-200 transition-colors duration-300"
            >
              {item}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;