import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              flex items-center gap-3 p-4 rounded-xl shadow-2xl border
              animate-in fade-in slide-in-from-right-8 duration-300
              min-w-[300px] max-w-[400px]
              ${toast.type === 'success' ? 'bg-white border-success/30 text-gray-900' : 
                toast.type === 'error' ? 'bg-white border-danger/30 text-gray-900' : 
                toast.type === 'warning' ? 'bg-white border-warning/30 text-gray-900' : 
                'bg-white border-info/30 text-gray-900'}
            `}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center shrink-0
              ${toast.type === 'success' ? 'bg-success-bg text-success' : 
                toast.type === 'error' ? 'bg-danger-bg text-danger' : 
                toast.type === 'warning' ? 'bg-warning-bg text-warning' : 
                'bg-info-bg text-info'}
            `}>
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'warning' && <AlertTriangle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            <div className="flex-1 text-sm font-bold leading-snug">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-gray-100 rounded-lg text-muted transition-colors border-none bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
