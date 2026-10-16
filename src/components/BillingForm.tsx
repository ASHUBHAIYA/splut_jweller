import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Download,
  FileCode2,
  FileSpreadsheet,
  RotateCcw,
  Send,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  Landmark,
  Edit2,
} from 'lucide-react';
import { SplitConfig, StockItemPreset } from '../types';
import { formatVoucherNo, parseStartNoInput } from '../utils/voucherNo';

interface BillingFormProps {
  config: SplitConfig;
  setConfig: React.Dispatch<React.SetStateAction<SplitConfig>>;
  postLedgers: string[];
  salesLedgers: string[];
  itemPresets: StockItemPreset[];
  onFetchInvoiceFromTally: () => void;
  isFetchingInvoice: boolean;
  onOpenBankImport: () => void;
  onGenerate: () => void;
  onPushToTally: () => void;
  onReset: () => void;
  onExportXml: () => void;
  onExportExcel: () => void;
  onOpenXmlInspector: () => void;
  onSelectPreset: (preset: StockItemPreset) => void;
  error: string | null;
  lastGeneratedAt: string;
  isPushing: boolean;
  billCount: number;
  bridgeConnected?: boolean;
  canPush: boolean;
  pushBlockedReason?: string;
}

export const BillingForm: React.FC<BillingFormProps> = ({
  config,
  setConfig,
  postLedgers,
  salesLedgers,
  itemPresets,
  onFetchInvoiceFromTally,
  isFetchingInvoice,
  onOpenBankImport,
  onGenerate,
  onPushToTally,
  onReset,
  onExportXml,
  onExportExcel,
  onOpenXmlInspector,
  onSelectPreset,
  error,
  lastGeneratedAt,
  isPushing,
  billCount,
  bridgeConnected = false,
  canPush,
  pushBlockedReason = '',
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // The Start No box is text so leading zeros survive; re-sync when the number changes from outside (Fetch from Tally).
  const [startNoText, setStartNoText] = useState(() => formatVoucherNo('', config.startingBillNo, config.billNoWidth));
  useEffect(() => {
    const cur = parseStartNoInput(startNoText);
    if (cur.n !== config.startingBillNo || cur.width !== (config.billNoWidth || 0)) {
      setStartNoText(formatVoucherNo('', config.startingBillNo, config.billNoWidth));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.startingBillNo, config.billNoWidth]);

  const handleFieldChange = <K extends keyof SplitConfig>(key: K, value: SplitConfig[K]) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate();
  };

  const activePreset = itemPresets.find((p) => p.name === config.itemName);

  return (
    <section
      aria-label="Bill Splitting Configuration Panel"
      className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-visible relative"
    >
      {/* Top Bar: Quick Bullion Presets in Grams, Bank Import CTA & Context */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-800 mr-1">Presets (g):</span>
          <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg">
            {itemPresets.map((preset) => {
              const isSelected = config.itemName === preset.name;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-950 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            type="button"
            onClick={onFetchInvoiceFromTally}
            disabled={isFetchingInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Fetch Sale Ledgers, Stock Items, Sales Accounts and latest voucher number from Tally Prime"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-800 ${isFetchingInvoice ? 'animate-spin' : ''}`} />
            <span>{isFetchingInvoice ? 'Fetching Masters...' : 'Fetch from Tally'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenBankImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Import Bank Statement Excel (.xlsx, .csv) to auto-fill total weight"
          >
            <Landmark className="w-3.5 h-3.5 text-emerald-700" />
            <span>Import Bank Excel</span>
          </button>

          <div className="flex items-center gap-2 text-slate-500 font-mono tabular-nums">
            <span className="hidden md:inline">HSN {activePreset?.hsnCode ?? '7108'}</span>
            <span className="hidden md:inline" aria-hidden="true">·</span>
            <span className="text-amber-800 font-bold">Up to 5,000 Bills</span>
          </div>
        </div>
      </div>

      {/* Main Responsive Form Grid (with noValidate to allow ANY valid number ranges) */}
      <form noValidate onSubmit={handleSubmit} className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3.5 items-end">
          {/* 1. Post Account Name */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="postAccountName"
                className="text-xs font-semibold text-slate-700 truncate"
              >
                Sale Ledger
              </label>
            </div>
            <select
              id="postAccountName"
              value={config.postAccountName}
              onChange={(e) => {
                {
                  handleFieldChange('postAccountName', e.target.value);
                }
              }}
              className="w-full h-10 px-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 truncate"
            >
              {config.postAccountName && !postLedgers.includes(config.postAccountName) && (
                <option value={config.postAccountName}>{config.postAccountName}</option>
              )}
              {postLedgers.map((ledger) => (
                <option key={ledger} value={ledger}>
                  {ledger}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Item Name */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="itemName" className="text-xs font-semibold text-slate-700 truncate">
                Item Name (g)
              </label>
            </div>
            <select
              id="itemName"
              value={config.itemName}
              onChange={(e) => {
                {
                  const match = itemPresets.find((p) => p.name === e.target.value);
                  if (match) {
                    onSelectPreset(match);
                  } else {
                    handleFieldChange('itemName', e.target.value);
                  }
                }
              }}
              className="w-full h-10 px-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 truncate"
            >
              {config.itemName && !itemPresets.some((p) => p.name === config.itemName) && (
                <option value={config.itemName}>{config.itemName}</option>
              )}
              {itemPresets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Item Sales Account */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="itemSalesAccount"
                className="text-xs font-semibold text-slate-700 truncate"
              >
                Sales Account
              </label>
            </div>
            <select
              id="itemSalesAccount"
              value={config.itemSalesAccount}
              onChange={(e) => {
                {
                  handleFieldChange('itemSalesAccount', e.target.value);
                }
              }}
              className="w-full h-10 px-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 truncate"
            >
              {config.itemSalesAccount && !salesLedgers.includes(config.itemSalesAccount) && (
                <option value={config.itemSalesAccount}>{config.itemSalesAccount}</option>
              )}
              {salesLedgers.map((ledger) => (
                <option key={ledger} value={ledger}>
                  {ledger}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Bill Date */}
          <div className="col-span-1">
            <label
              htmlFor="billDate"
              className="block text-xs font-semibold text-slate-700 mb-1.5 truncate"
            >
              Bill Date
            </label>
            <input
              id="billDate"
              type="date"
              value={config.billDate}
              onChange={(e) => handleFieldChange('billDate', e.target.value)}
              className="w-full h-10 px-2.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
            />
          </div>

          {/* 5. Bill Amount Range (Min & Max Limit ₹) - Any numeric value supported */}
          <div className="col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 truncate">
                Bill Limit (₹ Range)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Min–Max</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                aria-label="Minimum Bill Limit"
                type="number"
                step="any"
                value={config.minBillLimit === 0 ? '' : config.minBillLimit}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  handleFieldChange('minBillLimit', isNaN(val) ? 0 : val);
                }}
                placeholder="Min ₹"
                title="Minimum bill limit (e.g. 35000). Set to 0 or leave empty for ideal organic minimum."
                className="w-full h-10 px-2 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
              />
              <input
                aria-label="Maximum Bill Limit"
                type="number"
                step="any"
                value={config.maxBillLimit === 0 ? '' : config.maxBillLimit}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  handleFieldChange('maxBillLimit', isNaN(val) ? 0 : val);
                }}
                placeholder="Max ₹"
                title="Maximum statutory bill limit (e.g. 48500 or 45000)"
                className="w-full h-10 px-2 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
              />
            </div>
          </div>

          {/* 6. Rate Range (₹/g) */}
          <div className="col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 truncate">
                Rate Range (₹/g)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Min–Max</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                aria-label="Minimum Rate per gram"
                type="number"
                step="any"
                value={config.minRate === 0 ? '' : config.minRate}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  handleFieldChange('minRate', isNaN(val) ? 0 : val);
                }}
                placeholder="Min"
                title="Minimum unit rate (₹/g)"
                className="w-full h-10 px-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
              />
              <input
                aria-label="Maximum Rate per gram"
                type="number"
                step="any"
                value={config.maxRate === 0 ? '' : config.maxRate}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  handleFieldChange('maxRate', isNaN(val) ? 0 : val);
                }}
                placeholder="Max"
                title="Maximum unit rate (₹/g)"
                className="w-full h-10 px-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
              />
            </div>
          </div>

          {/* 7. GST Rate (%) */}
          <div className="col-span-1">
            <label
              htmlFor="gstRate"
              className="block text-xs font-semibold text-slate-700 mb-1.5 truncate"
            >
              GST Rate (%)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="gstRate"
                type="number"
                step="any"
                value={config.gstRate}
                onChange={(e) => handleFieldChange('gstRate', Number(e.target.value) || 0)}
                className="w-full h-10 px-2.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
              />
              <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                ({(config.gstRate / 2).toFixed(1)}%×2)
              </span>
            </div>
          </div>

          {/* 8. Total Weight (Strictly in Grams 'g') */}
          <div className="col-span-1">
            <label
              htmlFor="totalWeight"
              className="block text-xs font-bold text-amber-950 mb-1.5 truncate"
            >
              Total Weight (g)
            </label>
            <input
              id="totalWeight"
              type="number"
              step="any"
              value={config.totalWeight === 0 ? '' : config.totalWeight}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                handleFieldChange('totalWeight', isNaN(val) ? 0 : val);
              }}
              className="w-full h-10 px-2.5 text-xs font-mono font-bold tabular-nums text-slate-950 bg-amber-50 border-2 border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-600 shadow-xs"
            />
          </div>
        </div>

        {/* Validation Error Banner */}
        {error && (
          <div
            role="alert"
            className="mt-3.5 flex items-start gap-2.5 px-4 py-3 text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-lg"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Action Toolbar Row: Editable Initial Invoice No + Tally Fetch + Split Actions */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <label htmlFor="voucherPrefix" className="text-slate-600 font-bold pl-1 text-[11px]">
                Invoice Prefix:
              </label>
              <input
                id="voucherPrefix"
                type="text"
                value={config.voucherPrefix}
                onChange={(e) => handleFieldChange('voucherPrefix', e.target.value)}
                placeholder="Voucher prefix"
                title="Invoice Prefix (Editable anytime)"
                className="w-24 h-7 px-2 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded focus:border-amber-600 focus:outline-none"
              />
              <label htmlFor="startingBillNo" className="text-slate-600 font-bold pl-1 text-[11px]">
                Start No:
              </label>
              <input
                id="startingBillNo"
                type="text"
                inputMode="numeric"
                value={startNoText}
                onChange={(e) => {
                  const text = e.target.value.replace(/\D/g, '');
                  setStartNoText(text);
                  // Keep leading zeros: "0016" = number 16 padded to 4 digits.
                  const { n, width } = parseStartNoInput(text);
                  setConfig((prev) => ({ ...prev, startingBillNo: n, billNoWidth: width }));
                }}
                title="Initial Starting Invoice Number. Type 0016 to keep the leading zeros."
                className="w-20 h-7 px-2 text-xs font-mono font-bold tabular-nums text-slate-900 bg-white border border-slate-300 rounded focus:border-amber-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={onFetchInvoiceFromTally}
                disabled={isFetchingInvoice}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-900 bg-amber-300 hover:bg-amber-400 border border-amber-400 rounded transition-colors cursor-pointer"
                title="Fetch next sequential invoice number directly from Tally Prime XML"
              >
                <RefreshCw className={`w-3 h-3 ${isFetchingInvoice ? 'animate-spin text-amber-900' : 'text-slate-800'}`} />
                <span>{isFetchingInvoice ? 'Fetching...' : 'Fetch from Tally'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>

            <div className="relative flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span>Export XML/Excel</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportMenuOpen && (
                <>
                  {/* Backdrop to close menu on outside click */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setExportMenuOpen(false)}
                    aria-hidden="true"
                  />

                  <div
                    className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-slate-900/10 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        if (billCount === 0) onGenerate();
                        setTimeout(() => onExportXml(), 50);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left text-slate-700 hover:bg-amber-50 cursor-pointer transition-colors"
                    >
                      <FileCode2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900">Download Vouchers XML (.xml)</div>
                        <div className="text-[11px] text-slate-500">Alt+Z Sales Vouchers import</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        if (billCount === 0) onGenerate();
                        setTimeout(() => onExportExcel(), 50);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left text-slate-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900">Export Excel Sheet (.csv)</div>
                        <div className="text-[11px] text-slate-500">All rows + tax & weight summary</div>
                      </div>
                    </button>

                    <div className="my-1.5 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        onOpenXmlInspector();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <FileCode2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-medium">Inspect Live XML Envelope</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span>Generate Bills</span>
            </button>

            <button
              type="button"
              onClick={onPushToTally}
              disabled={isPushing || !canPush || !bridgeConnected}
              title={
                !bridgeConnected
                  ? 'Tally Bridge is Offline. Please start tally-bridge.exe & open company in Tally.'
                  : !canPush
                  ? pushBlockedReason || 'Generate bills first'
                  : 'Push vouchers to open Tally company'
              }
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:hover:bg-violet-600 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{bridgeConnected ? 'Push to Tally' : 'Tally Offline'}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
