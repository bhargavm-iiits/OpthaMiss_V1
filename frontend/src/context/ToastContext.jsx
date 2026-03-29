import { createContext, useContext, useState, useCallback } from 'react';

var ToastContext = createContext(null);
export var useToast = function () { return useContext(ToastContext); };

export var ToastProvider = function ({ children }) {
  var [toasts, setToasts] = useState([]);

  var addToast = useCallback(function (message, type, duration) {
    var id = Date.now() + Math.random();
    var t = type || 'info';
    var d = duration || 3500;
    setToasts(function (prev) { return prev.concat([{ id: id, message: message, type: t }]); });
    setTimeout(function () {
      setToasts(function (prev) { return prev.filter(function (x) { return x.id !== id; }); });
    }, d);
  }, []);

  var icons = {
    success: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full px-3">
        {toasts.map(function (t) {
          return (
            <div key={t.id} className={'ui-toast ui-toast-' + t.type}>
              {icons[t.type] || icons.info}
              <span className="text-sm font-medium flex-1">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};