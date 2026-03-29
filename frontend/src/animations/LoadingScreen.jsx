var LoadingScreen = function () {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{ background: 'var(--color-bg)' }}>

      {/* Spinner ring */}
      <div className="relative mb-8">
        <div className="w-14 h-14 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-text-2)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full animate-pulse-glow"
            style={{ background: 'var(--color-bg-4)' }} />
        </div>
      </div>

      <p className="text-xs tracking-[0.3em] uppercase animate-fade-in"
        style={{ color: 'var(--color-text-3)' }}>
        OpthaMiss
      </p>
    </div>
  );
};

export default LoadingScreen;