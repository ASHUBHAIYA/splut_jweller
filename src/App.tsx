import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { BillingForm } from './components/BillingForm';
import { BillGrid } from './components/BillGrid';
import { PushStatusDialog, PushState } from './components/PushStatusDialog';
import { BankStatementManager } from './components/BankStatementManager';
import { AdminPage } from './pages/AdminPage';
import { HelpPage } from './pages/HelpPage';
import { DowntimePage } from './pages/DowntimePage';
import { useMaintenance } from './utils/maintenance';
import { SUPPORT_PHONE_DISPLAY } from './utils/support';
import { usePath, navigate, AppPath } from './utils/router';
import { CompanyProfileModal } from './components/CompanyProfileModal';
import { SyncLogsView } from './components/WorkspaceViews';
import { useBillSplitter } from './hooks/useBillSplitter';
import {
  generateTallyXmlEnvelope,
  generateExcelCsvContent,
  downloadFile,
  isEducationalMode,
  setEducationalMode,
} from './utils/tallyXmlGenerator';
import {
  getLicenseKey,
  saveLicenseKey,
  importToTally,
  fetchLastSalesVoucher,
  fetchTallyBillingMasters,
  getBridgeState,
} from './utils/tallyTransport';
import { BridgeStatus, VoucherSyncLog } from './types';
import { formatVoucherNo } from './utils/voucherNo';

const SYNC_LOGS_KEY = 'atits_sync_logs';

export default function App() {
  const path = usePath();
  const maintenance = useMaintenance();
  if (path === '/admin') return <AdminPage />;
  if (maintenance?.active) return <DowntimePage state={maintenance} />;
  return <Workspace path={path} />;
}

function Workspace({ path }: { path: AppPath }) {
  const {
    config,
    setConfig,
    bills,
    setBills,
    error,
    summary,
    lastGeneratedAt,
    postLedgers,
    salesLedgers,
    itemPresets,
    generateBills,
    updateBillRow,
    deleteBillRow,
    reconcileWeightDelta,
    resetAll,
    applyStockPreset,
    mergeTallyMasters,
  } = useBillSplitter();

  const [billsGenerated, setBillsGenerated] = useState<boolean>(false);
  const [pushState, setPushState] = useState<PushState>('idle');
  const [pushMessage, setPushMessage] = useState<string>('');
  const [showCompanyModal, setShowCompanyModal] = useState<boolean>(() => {
    return !localStorage.getItem('atits_company_configured');
  });

  const [tallyCompany, setTallyCompany] = useState<string>(() => {
    return localStorage.getItem('atits_tally_company') || '';
  });
  const [storeName, setStoreName] = useState<string>(() => {
    return localStorage.getItem('atits_store_name') || '';
  });

  const [licenseKey, setLicenseKeyState] = useState<string>(() => getLicenseKey());
  const [eduMode, setEduMode] = useState<boolean>(() => isEducationalMode());

  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isFetchingInvoice, setIsFetchingInvoice] = useState<boolean>(false);
  // Voucher logs live in this browser's local storage (the bridge also writes its own log files)
  const [syncLogs, setSyncLogs] = useState<VoucherSyncLog[]>(() => {
    try {
      const raw = localStorage.getItem(SYNC_LOGS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(syncLogs.slice(0, 500)));
    } catch {}
  }, [syncLogs]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Connects with Windows Background Daemon (tally-bridge.exe on 127.0.0.1:8080 or Cloud Relay)
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    connected: false,
    endpoint: '127.0.0.1:8080',
    serviceName: 'tally-bridge.exe (Windows Daemon)',
    mode: 'live-localhost',
    companyName: localStorage.getItem('atits_tally_company') || '',
    lastPingTime: new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    tallyVersion: 'TallyPrime 4.x / ERP 9',
    latencyMs: 0,
  });

  const [tallyProfile, setTallyProfile] = useState<'prime' | 'erp9'>(() =>
    localStorage.getItem('atits_tally_profile') === 'erp9' ? 'erp9' : 'prime'
  );
  const [tallyUnit, setTallyUnit] = useState<string>(() => localStorage.getItem('atits_tally_unit') || 'GMS');
  const [tallyState, setTallyState] = useState<string>(() => localStorage.getItem('atits_tally_state') || '');

  const handleSaveCompanyProfile = (newCompany: string, newStore: string, newLicense: string, newEdu: boolean, newState: string, newProfile: 'prime' | 'erp9', newUnit: string) => {
    setTallyUnit(newUnit);
    localStorage.setItem('atits_tally_unit', newUnit);
    setTallyProfile(newProfile);
    localStorage.setItem('atits_tally_profile', newProfile);
    setTallyState(newState);
    localStorage.setItem('atits_tally_state', newState);
    if (newLicense.trim()) {
      saveLicenseKey(newLicense);
      setLicenseKeyState(newLicense.trim().toUpperCase());
    }
    setEducationalMode(newEdu);
    setEduMode(newEdu);
    setTallyCompany(newCompany);
    setStoreName(newStore);
    localStorage.setItem('atits_tally_company', newCompany);
    localStorage.setItem('atits_store_name', newStore);
    localStorage.setItem('atits_company_configured', 'true');
    setBridgeStatus((prev) => ({
      ...prev,
      companyName: newCompany,
    }));
    setConfig((prev) => ({
      ...prev,
      storeName: newStore,
    }));
    showToast(`Active Tally Company saved: "${newCompany}"`);
  };

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 5000);
  }, []);

  const gstOptions = useMemo(
    () => ({
      stateName: tallyState,
      profile: tallyProfile,
      unitName: tallyUnit,
      hsnByItem: Object.fromEntries(itemPresets.map((p) => [p.name, p.hsnCode])),
    }),
    [tallyState, tallyProfile, tallyUnit, itemPresets]
  );

  const xmlPayload = useMemo(
    () => {
      try {
        return generateTallyXmlEnvelope(bills, config, bridgeStatus.companyName, gstOptions);
      } catch {
        return ''; // names not filled in yet; push is blocked until they are
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bills, config, bridgeStatus.companyName, eduMode, gstOptions]
  );

  /**
   * Fetches the latest Sales voucher number, Post Accounts (party ledgers), Stock Items,
   * and Sales Accounts from Tally (via cloud relay -> tally-bridge.exe).
   */
  const handleFetchInvoiceFromTally = useCallback(
    async (silent: boolean = false) => {
      if (!getLicenseKey()) {
        if (!silent) showToast('Enter your license key in Company Settings to connect to Tally.');
        return;
      }
      if (!bridgeStatus.companyName?.trim()) {
        if (!silent) showToast('Enter your Tally company name in Company Settings before fetching.');
        return;
      }

      setIsFetchingInvoice(true);
      const [vchRes, mastersRes] = await Promise.all([
        fetchLastSalesVoucher(bridgeStatus.companyName, { force: !silent }),
        fetchTallyBillingMasters(bridgeStatus.companyName, { force: !silent }),
      ]);
      setIsFetchingInvoice(false);

      if (mastersRes && (mastersRes.postLedgers.length > 0 || mastersRes.stockItems.length > 0 || mastersRes.salesLedgers.length > 0)) {
        mergeTallyMasters({
          postLedgers: mastersRes.postLedgers,
          salesLedgers: mastersRes.salesLedgers,
          stockItems: mastersRes.stockItems.map((s) => ({ name: s.name, hsnCode: s.hsnCode })),
        });
      }

      const { voucher, error: fetchError } = vchRes;

      if (voucher) {
        const next = voucher.lastNumber + 1;
        setBridgeStatus((prev) => ({ ...prev, connected: true }));
        setConfig((prev) => ({ ...prev, voucherPrefix: voucher.prefix, startingBillNo: next, billNoWidth: voucher.width }));
        setBills((prev) =>
          prev.map((b, idx) => ({ ...b, voucherNo: formatVoucherNo(voucher.prefix, next + idx, voucher.width) }))
        );
        if (!silent) {
          const mCount = mastersRes
            ? ` · Loaded ${mastersRes.postLedgers.length} Accounts, ${mastersRes.stockItems.length} Items, ${mastersRes.salesLedgers.length} Sales`
            : '';
          showToast(`Connected to Tally (${bridgeStatus.companyName}) · Last: ${voucher.full} · Next: ${formatVoucherNo(voucher.prefix, next, voucher.width)}${mCount}`);
        }
      } else if (fetchError) {
        if (!silent) showToast(`Could not read last invoice: ${fetchError}`);
      } else {
        setBridgeStatus((prev) => ({ ...prev, connected: true }));
        const mCount = mastersRes
          ? ` · Loaded ${mastersRes.postLedgers.length} Accounts, ${mastersRes.stockItems.length} Items, ${mastersRes.salesLedgers.length} Sales`
          : '';
        if (!silent) showToast(`Connected to Tally (${bridgeStatus.companyName})${mCount}`);
      }
    },
    [bridgeStatus.companyName, setConfig, setBills, showToast, mergeTallyMasters]
  );

  /**
   * Bridge heartbeat check (the bridge polls the cloud relay, so this works from PC and phone alike).
   */
  const probeTallyConnection = useCallback(
    async (_endpoint: string, silent: boolean = false) => {
      const t0 = performance.now();
      const currentTime = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const hasKey = !!getLicenseKey();
      const state = hasKey ? await getBridgeState() : { bridge: false, tally: null as boolean | null, company: '' };
      // "Online" means the bridge is running AND Tally answers. Bridge alone is not enough to push.
      const online = state.bridge && state.tally !== false;
      setBridgeStatus((prev) => ({
        ...prev,
        connected: online,
        bridgeRunning: state.bridge,
        mode: 'live-localhost',
        lastPingTime: currentTime,
        latencyMs: online ? Math.round(performance.now() - t0) : prev.latencyMs,
      }));
      if (!silent) {
        showToast(
          !hasKey
            ? 'Enter your license key in Company Settings.'
            : online
            ? 'Tally Bridge online (via cloud relay).'
            : state.bridge
            ? 'Bridge is running, but Tally is not connected. Open Tally and your company (ODBC/XML port enabled).'
            : 'Bridge offline: start tally-bridge.exe on the shop PC and open the company in Tally.'
        );
      }
      return online;
    },
    [showToast]
  );

  // Initial mount: probe bridge and fetch invoice sequence
  // Runs once per endpoint/company. The callbacks in the dependency list can change identity on re-renders;
  // without this guard every such change queued another round of Tally queries through the relay.
  const initProbeKeyRef = useRef('');
  useEffect(() => {
    const runKey = `${bridgeStatus.endpoint}|${bridgeStatus.companyName}`;
    if (initProbeKeyRef.current === runKey) return;
    initProbeKeyRef.current = runKey;
    probeTallyConnection(bridgeStatus.endpoint, true).then((online) => {
      if (online) handleFetchInvoiceFromTally(true);
    });
  }, [bridgeStatus.endpoint, bridgeStatus.companyName, probeTallyConnection, handleFetchInvoiceFromTally]);

  // Fetch from Tally automatically whenever the Splitter or Bank page is opened
  const prevPathRef = useRef<AppPath>(path);
  useEffect(() => {
    if (prevPathRef.current === path) return;
    prevPathRef.current = path;
    if (path !== '/' && path !== '/bank') return;
    probeTallyConnection(bridgeStatus.endpoint, true).then((online) => {
      if (online && path === '/') handleFetchInvoiceFromTally(true);
    });
  }, [path, bridgeStatus.endpoint, probeTallyConnection, handleFetchInvoiceFromTally]);

  // Keep the status pill honest: re-check every 60 s while this tab is visible (costs one tiny status call).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !getLicenseKey()) return;
      getBridgeState().then((st) => {
        const online = st.bridge && st.tally !== false;
        setBridgeStatus((prev) =>
          prev.connected === online && prev.bridgeRunning === st.bridge ? prev : { ...prev, connected: online, bridgeRunning: st.bridge }
        );
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handleToggleBridgeConnection = useCallback(() => {
    handleFetchInvoiceFromTally(false);
  }, [handleFetchInvoiceFromTally]);

  const handlePingBridge = useCallback(async () => {
    const online = await probeTallyConnection(bridgeStatus.endpoint, false);
    if (online) handleFetchInvoiceFromTally(false);
  }, [bridgeStatus.endpoint, probeTallyConnection, handleFetchInvoiceFromTally]);

  const pushBlockedReason = !billsGenerated || bills.length === 0
    ? 'Click Generate Bills first.'
    : !summary.isWeightMatched
    ? 'Total weight is not reconciled. Reconcile the weight difference first.'
    : '';
  const canPush = pushBlockedReason === '';

  /**
   * Push sales vouchers to Tally (via cloud relay). Masters are never created from here:
   * ledgers, stock items and the party must already exist in Tally.
   */
  const handlePushToTally = useCallback(async () => {
    const fail = (msg: string, openCompany = false) => {
      showToast(msg);
      if (openCompany) setShowCompanyModal(true);
    };
    if (!getLicenseKey()) return fail('Enter your license key in Company Settings before pushing.', true);
    if (!tallyState.trim()) return fail('Enter the company State (as in Tally) in Company Settings before pushing.', true);
    if (!bridgeStatus.companyName.trim()) return fail('Enter the Tally company name in Company Settings before pushing.', true);
    if (!xmlPayload) return fail('XML could not be generated: check HSN code on the stock item and the ledger names.');
    if (bills.some((b) => !b.postAccountName?.trim() || !b.itemName?.trim() || !b.itemSalesAccount?.trim())) {
      return fail('Select the sale ledger, stock item and sales ledger before pushing.');
    }
    // Re-check right now instead of trusting a status that may be minutes old.
    const live = await getBridgeState();
    if (!live.bridge) return fail('Cannot push: bridge is offline. Start tally-bridge.exe on the shop PC.');
    if (live.tally === false) return fail('Cannot push: bridge is running but Tally is not connected. Open Tally and your company, then try again.');
    if (!canPush) return fail(pushBlockedReason);
    if (bills.length === 0 || isPushing) return;

    setIsPushing(true);
    setPushState('pushing');
    setPushMessage('');

    const vRes = await importToTally(xmlPayload);

    const imported = vRes.created + vRes.altered;
    const allOk = vRes.errors === 0 && imported >= bills.length;
    let failMessage = vRes.message;
    if (!allOk && imported > 0 && imported < bills.length) {
      failMessage = `Only ${imported} of ${bills.length} imported. ${vRes.message}`;
    }
    if (!allOk && isEducationalMode() === false && /date|educational/i.test(vRes.raw)) {
      failMessage += ' (If this Tally is in Educational mode, turn on "Educational mode" in Company Settings.)';
    }

    const stamp = new Date().toLocaleString('en-IN');
    const newLogs: VoucherSyncLog[] = bills.map((b, i) => ({
      id: `sync-${Date.now()}-${i}`,
      voucherNo: b.voucherNo,
      billNumber: b.billNumber,
      itemName: b.itemName,
      weight: b.weight,
      rate: b.rate,
      finalBillAmount: b.finalBillAmount,
      status: allOk ? 'success' : 'error',
      tallyMasterId: allOk ? '—' : 'N/A',
      message: allOk ? `Imported in Tally (${bridgeStatus.companyName})` : `Failed: ${failMessage}`,
      timestamp: stamp,
      transportMode: 'localhost-live',
    }));
    setSyncLogs((prev) => [...newLogs.reverse(), ...prev].slice(0, 500));

    setIsPushing(false);
    if (allOk) {
      setPushState('done');
      setPushMessage(`${imported} voucher${imported === 1 ? '' : 's'} pushed to "${bridgeStatus.companyName}".`);
      setBills([]); // nothing stays prefilled after a successful push
      setBillsGenerated(false);
      setConfig((prev) => ({ ...prev, totalWeight: 0 }));
      handleFetchInvoiceFromTally(true); // pick up the next voucher number
    } else {
      setPushState('error');
      setPushMessage(failMessage);
    }
  }, [
    bills,
    isPushing,
    bridgeStatus.companyName,
    bridgeStatus.connected,
    xmlPayload,
    tallyState,
    showToast,
    setBills,
    setConfig,
    canPush,
    pushBlockedReason,
    handleFetchInvoiceFromTally,
  ]);

  const handleExportXml = useCallback(() => {
    const filename = `TALLY_VOUCHERS_${config.billDate.replace(/-/g, '')}_${bills.length}_BILLS.xml`;
    downloadFile(xmlPayload, filename, 'application/xml');
    showToast(`Saved Tally Vouchers XML (${bills.length} vouchers). Ready for Alt+Z import in Tally.`);
  }, [bills.length, config.billDate, showToast, xmlPayload]);

  const handleExportExcel = useCallback(() => {
    const content = generateExcelCsvContent(bills, summary, config);
    const filename = `ATITS_BILLS_${config.billDate}_${bills.length}ROWS.csv`;
    downloadFile(content, filename, 'text/csv;charset=utf-8;');
    showToast(`Saved CSV spreadsheet with ${bills.length} bill rows.`);
  }, [bills, summary, config, showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Top Header */}
      <Header
        path={path}
        bridgeStatus={bridgeStatus}
        companyName={tallyCompany}
        storeName={storeName}
        onOpenCompanyModal={() => setShowCompanyModal(true)}
        onPingBridge={handlePingBridge}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xl border border-blue-400 animate-fade-in"
        >
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        {path === '/' && (
          <>
            {/* Tally Offline Warning Card */}
            {!bridgeStatus.connected && (
              <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <div>
                    <span className="font-bold">Tally is Offline: </span>
                    <span className="text-slate-600">
                      Open your company in TallyPrime / Tally.ERP 9 (Port 9000) and run <code>tally-bridge.exe</code> to sync the live invoice number.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFetchInvoiceFromTally(false)}
                  disabled={isFetchingInvoice}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 ml-3"
                >
                  {isFetchingInvoice ? 'Connecting...' : 'Connect & Fetch Tally'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/help')}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-lg cursor-pointer shrink-0 ml-2"
                >
                  How to connect
                </button>
              </div>
            )}

            <BillingForm
              config={config}
              setConfig={setConfig}
              postLedgers={postLedgers}
              salesLedgers={salesLedgers}
              itemPresets={itemPresets}
              onFetchInvoiceFromTally={() => handleFetchInvoiceFromTally(false)}
              isFetchingInvoice={isFetchingInvoice}
              onOpenBankImport={() => navigate('/bank')}
              onGenerate={() => {
                const r = generateBills();
                setBillsGenerated(!r.error);
              }}
              onPushToTally={handlePushToTally}
              onReset={() => {
                resetAll();
                setBillsGenerated(false);
              }}
              onExportXml={handleExportXml}
              onExportExcel={handleExportExcel}
              onOpenXmlInspector={() => navigate('/logs')}
              onSelectPreset={applyStockPreset}
              error={error}
              lastGeneratedAt={lastGeneratedAt}
              isPushing={isPushing}
              billCount={bills.length}
              bridgeConnected={bridgeStatus.connected}
              canPush={canPush}
              pushBlockedReason={pushBlockedReason}
            />

            <BillGrid
              bills={bills}
              config={config}
              summary={summary}
              onUpdateRow={updateBillRow}
              onDeleteRow={deleteBillRow}
              onReconcileDelta={reconcileWeightDelta}
              onGenerate={() => {
                const r = generateBills();
                setBillsGenerated(!r.error);
              }}
              onClearTable={() => {
                setBills([]);
                setBillsGenerated(false);
              }}
            />
          </>
        )}

        {path === '/bank' && (
          <BankStatementManager
            bridgeStatus={bridgeStatus}
          />
        )}

        {path === '/help' && <HelpPage />}

        {path === '/logs' && (
          <SyncLogsView
            logs={syncLogs}
            onClearLogs={() => setSyncLogs([])}
            onBackToWorkbench={() => navigate('/')}
          />
        )}
      </main>

      {/* Tally Company Setup & Edit Profile Modal */}
      <CompanyProfileModal
        currentState={tallyState}
        currentProfile={tallyProfile}
        currentUnit={tallyUnit}
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        currentCompany={tallyCompany}
        currentStoreName={storeName}
        onSave={handleSaveCompanyProfile}
        currentLicenseKey={licenseKey}
        currentEduMode={eduMode}
        isFirstTime={!localStorage.getItem('atits_company_configured')}
      />

      <footer className="text-center text-[11px] text-slate-500 py-3">
        Need help? <button type="button" onClick={() => navigate('/help')} className="font-semibold text-blue-700 hover:underline cursor-pointer">Open Help</button> or contact {SUPPORT_PHONE_DISPLAY}
      </footer>

      <PushStatusDialog
        state={pushState}
        message={pushMessage}
        onOk={() => setPushState('idle')}
      />
    </div>
  );
}
