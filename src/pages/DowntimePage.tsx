import React, { useState } from 'react';
import { Wrench, RefreshCw, Phone } from 'lucide-react';
import { MaintenanceState, fetchMaintenance } from '../utils/maintenance';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_LINK } from '../utils/support';

function formatBack(iso: string): { when: string; left: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const when = d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  let left = 'It should be back any moment now.';
  if (mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    left = `About ${h > 0 ? `${h} hr ` : ''}${m > 0 || h === 0 ? `${m} min` : ''} from now.`.replace('  ', ' ');
  }
  return { when, left };
}

/** Shown instead of the app while the admin has switched on downtime. */
export const DowntimePage: React.FC<{ state: MaintenanceState }> = ({ state }) => {
  const [checking, setChecking] = useState(false);
  const back = formatBack(state.backAt);

  const check = async () => {
    setChecking(true);
    const r = await fetchMaintenance();
    setChecking(false);
    if (r && !r.active) window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50 p-4">
      <div className="bg-white border border-sky-200 rounded-2xl shadow-lg max-w-md w-full p-7 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
          <Wrench className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">We'll be back soon</h1>
        <p className="text-sm text-slate-600 whitespace-pre-line">
          {state.message || 'The app is under maintenance right now. Your data on this computer is safe.'}
        </p>
        {back && (
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
            <div className="text-[11px] font-semibold text-sky-800 uppercase tracking-wide">Expected back</div>
            <div className="text-base font-bold text-slate-900">{back.when}</div>
            <div className="text-xs text-slate-600">{back.left}</div>
          </div>
        )}
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Checking...' : 'Check again'}</span>
        </button>
        <a href={SUPPORT_PHONE_LINK} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
          <Phone className="w-3.5 h-3.5" />
          <span>Urgent? Drop mail to {SUPPORT_PHONE_DISPLAY}</span>
        </a>
      </div>
    </div>
  );
};
