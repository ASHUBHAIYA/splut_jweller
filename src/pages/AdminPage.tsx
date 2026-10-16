import React, { useState } from 'react';
import { Lock, RefreshCw, AlertCircle, CheckCircle2, KeyRound, Wrench } from 'lucide-react';
import { MaintenanceState, fetchMaintenance, saveMaintenance } from '../utils/maintenance';
import { AdminKeyGenerator } from '../components/AdminKeyGenerator';
import { verifyAdminPinWithCloudflareKV, saveAdminPinToCloudflareKV } from '../utils/adminAuth';
import { navigate } from '../utils/router';

/** /admin : PIN gate, then the license key generator. Not linked from the main UI. */
export const AdminPage: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);
    setIsVerifying(true);

    if (isSettingNewPin) {
      const trimmed = pinInput.trim();
      if (trimmed.length < 4) {
        setPinError('PIN must be at least 4 characters or digits.');
        setIsVerifying(false);
        return;
      }
      if (trimmed !== confirmPinInput.trim()) {
        setPinError('PIN confirmation does not match.');
        setIsVerifying(false);
        return;
      }
      const res = await saveAdminPinToCloudflareKV(trimmed);
      setIsVerifying(false);
      if (res.success) {
        setPinSuccess('Master PIN saved.');
        setTimeout(() => setUnlocked(true), 600);
      } else {
        setPinError(res.message || 'Failed to save PIN.');
      }
      return;
    }

    const result = await verifyAdminPinWithCloudflareKV(pinInput);
    setIsVerifying(false);
    if (result.success) {
      setUnlocked(true);
      setPinInput('');
      return;
    }
    const msg = (result.message || '').toLowerCase();
    if (msg.includes('no pin') || msg.includes('empty')) {
      setIsSettingNewPin(true);
      setPinError('No Master PIN set yet. Enter your desired PIN below.');
    } else {
      setPinError(result.message || 'Incorrect Master PIN.');
    }
  };

  if (unlocked) return <AdminPanel />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-800 p-4">
      <div className="bg-blue-700 text-slate-100 rounded-2xl border border-blue-400 shadow-2xl max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
          <Lock className="w-4 h-4" />
          <span>{isSettingNewPin ? 'Set Master PIN' : 'Admin Security Access'}</span>
        </div>
        <p className="text-xs text-blue-100 leading-relaxed">
          {isSettingNewPin ? 'Choose a Master PIN (min. 4 characters).' : 'Enter the Master Admin PIN.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            maxLength={24}
            autoFocus
            disabled={isVerifying}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder={isSettingNewPin ? 'New PIN' : 'PIN'}
            className="w-full h-10 px-3 text-center text-base font-mono tracking-widest bg-blue-800 border border-blue-400 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
          />
          {isSettingNewPin && (
            <input
              type="password"
              maxLength={24}
              disabled={isVerifying}
              value={confirmPinInput}
              onChange={(e) => setConfirmPinInput(e.target.value)}
              placeholder="Confirm PIN"
              className="w-full h-10 px-3 text-center text-base font-mono tracking-widest bg-blue-800 border border-blue-400 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
            />
          )}
          {pinError && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}
          {pinSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{pinSuccess}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 py-2 text-xs font-semibold text-blue-100 hover:text-white bg-blue-600 rounded-lg cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isVerifying || !pinInput.trim() || (isSettingNewPin && !confirmPinInput.trim())}
              className="flex-1 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>{isSettingNewPin ? 'Save PIN' : 'Open'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const QUICK_MINUTES: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: 'Tomorrow', minutes: 24 * 60 },
];

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const AdminPanel: React.FC = () => {
  const [showKeys, setShowKeys] = useState(false);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const [backAt, setBackAt] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    fetchMaintenance().then((m) => {
      if (m) {
        setActive(m.active);
        setMessage(m.message);
        setBackAt(m.backAt);
      }
      setLoaded(true);
    });
  }, []);

  const save = async (next: MaintenanceState) => {
    setSaving(true);
    setNote(null);
    const r = await saveMaintenance(next);
    setSaving(false);
    if (r.success) {
      setActive(next.active);
      setNote({ ok: true, text: next.active ? 'Downtime page is now ON for all users.' : 'Downtime page is OFF. The app is live again.' });
    } else {
      setNote({ ok: false, text: r.message || 'Could not save.' });
    }
  };

  const setIn = (minutes: number) => setBackAt(new Date(Date.now() + minutes * 60000).toISOString());

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900">Admin</h1>
          <button type="button" onClick={() => navigate('/')} className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer">
            Back to app
          </button>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span>Downtime page</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {!loaded ? '...' : active ? 'ON: users see downtime' : 'OFF: app is live'}
            </span>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Message for users
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="We are updating the system. Please try again later."
              className="mt-1 w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </label>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Back online in</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MINUTES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setIn(q.minutes)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-sky-50 border border-slate-300 rounded-md cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <label className="block text-xs font-semibold text-slate-700 mt-2">
              Or pick exact date and time
              <input
                type="datetime-local"
                value={toLocalInput(backAt)}
                onChange={(e) => setBackAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="mt-1 block px-3 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg"
              />
            </label>
            {backAt && (
              <div className="text-[11px] text-slate-500 mt-1">
                Users will see: back at {new Date(backAt).toLocaleString('en-IN')}
              </div>
            )}
          </div>

          {note && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${note.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
              {note.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{note.text}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ active: true, message, backAt })}
              className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {active ? 'Update downtime' : 'Turn downtime ON'}
            </button>
            <button
              type="button"
              disabled={saving || !active}
              onClick={() => save({ active: false, message, backAt })}
              className="flex-1 py-2 text-xs font-bold text-slate-900 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              Turn OFF (app is live)
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            When ON, everyone sees the downtime page instead of the app. This /admin page keeps working so you can switch it off.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <button
            type="button"
            onClick={() => setShowKeys(true)}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Open licence key generator</span>
          </button>
        </section>
      </div>
      <AdminKeyGenerator isOpen={showKeys} onClose={() => setShowKeys(false)} />
    </div>
  );
};
