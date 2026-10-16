import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { VoucherSyncLog } from '../types';

interface SyncLogsViewProps {
  logs: VoucherSyncLog[];
  onClearLogs: () => void;
  onBackToWorkbench: () => void;
}

export const SyncLogsView: React.FC<SyncLogsViewProps> = ({
  logs,
  onClearLogs,
  onBackToWorkbench,
}) => {
  const [daemonLogs, setDaemonLogs] = useState<Array<{ timestamp: string; level: string; source: string; message: string }>>([]);
  const [daemonLogFile, setDaemonLogFile] = useState<string>('');
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState<'vouchers' | 'daemon'>('vouchers');

  const fetchLiveDaemonLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const res = await fetch('http://127.0.0.1:8080/logs', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data.logs) setDaemonLogs(data.logs);
        if (data.logFile) setDaemonLogFile(data.logFile);
      }
    } catch (_) {
      // Bridge may be offline
    } finally {
      setIsFetchingLogs(false);
    }
  };

  useEffect(() => {
    if (activeLogTab === 'daemon') {
      fetchLiveDaemonLogs();
    }
  }, [activeLogTab]);

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToWorkbench}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workbench</span>
          </button>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveLogTab('vouchers')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeLogTab === 'vouchers'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Voucher Dispatch Logs ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveLogTab('daemon')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeLogTab === 'daemon'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Live Daemon Logs ({daemonLogs.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeLogTab === 'daemon' ? (
            <button
              type="button"
              onClick={fetchLiveDaemonLogs}
              disabled={isFetchingLogs}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Daemon Logs</span>
            </button>
          ) : (
            logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                Clear Logs
              </button>
            )
          )}
        </div>
      </div>

      {activeLogTab === 'daemon' ? (
        <div className="p-4 space-y-3 bg-blue-800 text-slate-200 font-mono text-xs">
          {daemonLogFile && (
            <div className="text-[11px] text-slate-400 pb-1 border-b border-blue-500 flex justify-between items-center">
              <span>Local Log File: <strong className="text-amber-300">{daemonLogFile}</strong></span>
              <span className="text-emerald-400">Daemon Active on Port 8080</span>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto space-y-1.5 leading-relaxed">
            {daemonLogs.length === 0 ? (
              <div className="text-slate-500 py-8 text-center font-sans">
                No daemon logs received yet. Ensure <code className="text-amber-400">tally-bridge.exe</code> is running, then click &ldquo;Refresh Daemon Logs&rdquo;.
              </div>
            ) : (
              daemonLogs.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-500 select-none">{item.timestamp}</span>
                  <span className={`font-bold select-none ${
                    item.level === 'SUCCESS' || item.level === 'READY'
                      ? 'text-emerald-400'
                      : item.level === 'ERROR'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}>
                    [{item.source}]
                  </span>
                  <span className="text-slate-200">{item.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
              <tr>
                <th className="py-2.5 pl-4 pr-2">Timestamp</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2">Voucher No</th>
                <th className="py-2.5 px-2">Item</th>
                <th className="py-2.5 px-2 text-right">Weight (g)</th>
                <th className="py-2.5 px-2 text-right">Rate (₹/g)</th>
                <th className="py-2.5 px-2 text-right">Bill Amt</th>
                <th className="py-2.5 px-2">Tally Master ID</th>
                <th className="py-2.5 pl-2 pr-4">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-mono tabular-nums">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center font-sans text-slate-500">
                    No voucher dispatch logs recorded yet. Click &ldquo;Push to Tally&rdquo; to dispatch your split bills.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2 pl-4 pr-2 text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status === 'success' ? 'Created' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-semibold text-slate-900 whitespace-nowrap">
                      {log.voucherNo}
                    </td>
                    <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{log.itemName}</td>
                    <td className="py-2 px-2 text-right text-slate-900 whitespace-nowrap">
                      {log.weight.toFixed(3)} g
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 whitespace-nowrap">
                      ₹{log.rate.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-950 whitespace-nowrap">
                      ₹{log.finalBillAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{log.tallyMasterId}</td>
                    <td className="py-2 pl-2 pr-4 text-slate-600 text-xs truncate max-w-xs font-sans">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
