const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center px-6 pt-20 z-10">
      <div className="max-w-3xl mx-auto text-center" style={{ animation: 'slideUp 1s ease-out' }}>
        <p
          className="text-neutral-600 text-sm tracking-[0.3em] uppercase mb-6"
          style={{ animation: 'fadeIn 1s ease-out 0.3s both' }}
        >
          AI-Powered Diagnostics
        </p>
        <h1
          className="text-4xl md:text-6xl font-light text-neutral-100 leading-tight mb-6"
          style={{ animation: 'slideUp 0.8s ease-out 0.5s both' }}
        >
          Detect Eye Diseases
          <br />
          <span className="text-neutral-400">with Precision</span>
        </h1>
        <p
          className="text-neutral-500 text-lg max-w-xl mx-auto mb-10 leading-relaxed"
          style={{ animation: 'slideUp 0.8s ease-out 0.7s both' }}
        >
          Upload a retinal image and receive instant AI diagnosis for Cataract, Glaucoma, Diabetic Retinopathy, and more.
        </p>
        <div style={{ animation: 'slideUp 0.8s ease-out 0.9s both' }}>
          <a
            href="#detection"
            className="inline-block px-8 py-3 border border-neutral-600 text-neutral-300 text-sm tracking-wider uppercase hover:bg-neutral-800 hover:border-neutral-500 transition-all duration-300 group"
          >
            <span className="group-hover:tracking-[0.2em] transition-all duration-300">Start Detection</span>
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ animation: 'fadeIn 1s ease-out 1.5s both' }}
      >
        <p className="text-neutral-700 text-[10px] tracking-[0.3em] uppercase">Scroll</p>
        <div className="w-[1px] h-8 bg-gradient-to-b from-neutral-600 to-transparent animate-pulse" />
      </div>
    </section>
  );
};

export default Hero;