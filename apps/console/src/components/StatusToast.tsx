import { CheckCircle2 } from 'lucide-react';
import type { StatusMsg } from '@church/shared/types';

interface StatusToastProps {
  statusMsg: StatusMsg;
  onDismiss: () => void;
}

export default function StatusToast({ statusMsg, onDismiss }: StatusToastProps) {
  if (!statusMsg.text) return null;

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
      <div
        className={`p-4 rounded-xl font-bold shadow-2xl border-2 flex items-center justify-between gap-3 ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'bg-rose-50 text-rose-800 border-rose-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
          ) : (
            <div className="text-rose-500 font-black shrink-0 text-xl">⚠️</div>
          )}
          <span className="text-sm md:text-base">{statusMsg.text}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="關閉通知"
          className={`shrink-0 p-2.5 rounded-full hover:bg-black/5 transition-colors ${
            statusMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
