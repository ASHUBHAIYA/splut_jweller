import React, { useState } from 'react';
import { Phone, ChevronDown, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_LINK } from '../utils/support';
import { Link } from '../utils/router';

const STEPS: { title: string; body: string }[] = [
  { title: 'Open Tally and your company', body: 'Start Tally on your computer and open the company you want to work in. Keep it open while you use this software.' },
  { title: 'Start the ATITS Bridge', body: 'Double-click "tally-bridge.exe" (the file we gave you) on the same computer. A small window opens. Keep it running; you can minimise it.' },
  { title: 'Enter your licence key', body: 'Click the company name at the top of this page. Type your Tally company name exactly as it appears in Tally, your State, and the licence key we gave you. Click Save.' },
  { title: 'Wait for the green light', body: 'At the top right it should say "Bridge Online" in green. Now you are connected. Open Splitter or Bank Statement and start working.' },
];

const FIXES: { q: string; a: string[] }[] = [
  {
    q: 'It says "Bridge Offline" (red)',
    a: [
      'Check that Tally is open with your company loaded.',
      'Check that the tally-bridge.exe window is running on the same computer. If not, double-click it again.',
      'Check that this computer has internet.',
      'Click the red "Bridge Offline" button at the top once to test again.',
    ],
  },
  {
    q: 'Push to Tally is greyed out',
    a: [
      'Click "Generate Bills" first.',
      'The total weight of the bills must match the Total Weight you typed. Use the Reconcile option if there is a small difference.',
      'The Bridge must be online (green).',
    ],
  },
  {
    q: 'Tally says a ledger or item does not exist',
    a: [
      'The ledger, sales ledger, bank ledger or stock item must already exist in Tally with the same name.',
      'Create it in Tally first, then click "Fetch from Tally" or "Fetch Ledgers" here and select it.',
    ],
  },
  {
    q: 'Tally says the date is out of range',
    a: [
      'Tally only accepts dates inside the financial year of the company that is open.',
      'Open the company or financial year that covers those dates, then push again.',
    ],
  },
  {
    q: 'Some bank rows show INVALID date',
    a: ['Open your Excel file and make sure every row has a proper date (for example 02-Apr-25), then upload again.'],
  },
  {
    q: 'The invoice number is wrong or not updating',
    a: ['Click "Fetch from Tally" in the Splitter. The next number is read from Tally.'],
  },
  {
    q: 'The page looks stuck or something is not working',
    a: ['Refresh the page (press F5).', 'Close and reopen tally-bridge.exe.', 'Close and reopen Tally.', 'Try the push again.'],
  },
  {
    q: 'Using it from a mobile phone',
    a: ['Open this same website on your phone and enter the same licence key.', 'The computer with Tally and the Bridge must stay switched on and online.'],
  },
];

export const HelpPage: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <MonitorSmartphone className="w-5 h-5 text-blue-600" />
          <h1 className="text-base font-bold text-slate-900">How to connect</h1>
        </div>
        <p className="text-xs text-slate-500 mb-4">Four simple steps. You only need to do this once per computer.</p>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div>
                <div className="text-sm font-bold text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-600 leading-relaxed">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-3">Something not working? Try this first</h2>
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {FIXES.map((f, i) => (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
              >
                <span>{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <ul className="px-4 pb-3 space-y-1.5 bg-slate-50">
                  {f.a.map((line) => (
                    <li key={line} className="flex gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-sky-50 border border-sky-200 rounded-xl p-5 text-center space-y-2">
        <h2 className="text-sm font-bold text-slate-900">Still not working?</h2>
        <p className="text-xs text-slate-600">If the steps above do not fix it, or the problem is serious, please drop mail to <a href={SUPPORT_PHONE_LINK} className="font-bold text-blue-700">{SUPPORT_PHONE_DISPLAY}</a>. We will help you.</p>
        <div>
          <Link to="/" className="text-xs font-semibold text-blue-700 hover:underline">Back to the app</Link>
        </div>
      </section>
    </div>
  );
};
