import React from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_LINK } from '../utils/support';
import { navigate } from '../utils/router';

export type PushState = 'idle' | 'pushing' | 'done' | 'error';

interface PushStatusDialogProps {
  state: PushState;
  message?: string;
  onOk: () => void;
}

/** Simple push feedback: Pushing to Tally -> Pushed (Done) -> OK. No pipeline view. */
export const PushStatusDialog: React.FC<PushStatusDialogProps> = ({ state, message, onOk }) => {
  if (state === 'idle') return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-800/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
        {state === 'pushing' && (
          <>
            <RefreshCw className="w-9 h-9 mx-auto text-amber-500 animate-spin" />
            <p className="text-sm font-bold text-slate-900">Pushing to Tally...</p>
          </>
        )}
        {state === 'done' && (
          <>
            <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-600" />
            <p className="text-sm font-bold text-slate-900">Pushed. Done.</p>
            {message && <p className="text-xs text-slate-600">{message}</p>}
            <button
              type="button"
              onClick={onOk}
              className="w-full py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg cursor-pointer"
            >
              OK
            </button>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="w-9 h-9 mx-auto text-rose-600" />
            <p className="text-sm font-bold text-slate-900">Push failed</p>
            {message && <p className="text-xs text-slate-600 break-words">{message}</p>}
            <p className="text-[11px] text-slate-500">
              Try the steps in{' '}
              <button type="button" onClick={() => { onOk(); navigate('/help'); }} className="font-bold text-blue-700 hover:underline cursor-pointer">Help</button>.
              If it keeps drop mail to <a href={SUPPORT_PHONE_LINK} className="font-bold text-blue-700">{SUPPORT_PHONE_DISPLAY}</a>.
            </p>
            <button
              type="button"
              onClick={onOk}
              className="w-full py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 rounded-lg cursor-pointer"
            >
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
};
