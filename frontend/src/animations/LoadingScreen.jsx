const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center z-50">
      <div className="w-12 h-12 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
      <p className="mt-6 text-neutral-500 text-xs tracking-[0.3em] uppercase">OpthaMiss</p>
    </div>
  );
};

export default LoadingScreen;