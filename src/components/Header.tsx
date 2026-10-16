import React, { useState } from 'react';
import { Link, AppPath } from '../utils/router';
import {
  RefreshCw,
  Menu,
  X,
  Layers,
  FileSpreadsheet,
  ScrollText,
  HelpCircle,
  Gem,
  Building2,
  Pencil,
} from 'lucide-react';
import { BridgeStatus } from '../types';


interface HeaderProps {
  path: AppPath;
  bridgeStatus: BridgeStatus;
  companyName: string;
  storeName: string;
  onOpenCompanyModal: () => void;
  onPingBridge: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  path,
  bridgeStatus,
  companyName,
  onOpenCompanyModal,
  onPingBridge,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { to: AppPath; label: string; icon: React.FC<{ className?: string }> }[] = [
    { to: '/', label: 'Splitter', icon: Layers },
    { to: '/bank', label: 'Bank Statement', icon: FileSpreadsheet },
    { to: '/logs', label: 'Logs', icon: ScrollText },
    { to: '/help', label: 'Help', icon: HelpCircle },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md text-slate-800 border-b border-violet-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between h-14 px-3 sm:px-6">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-1.5 text-slate-600 hover:text-violet-800 rounded-lg hover:bg-violet-100 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-700 to-violet-400 flex items-center justify-center text-white shadow-xs ring-1 ring-violet-300 group-hover:scale-105 transition-transform">
                <Gem className="w-4 h-4 fill-white/30" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-slate-900 group-hover:text-violet-700 transition-colors">
                    ATITS Split
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Center: Clean Segmented Navigation Bar */}
          <nav
            className="hidden md:flex items-center p-1 bg-violet-50 border border-violet-200 rounded-xl text-xs"
            aria-label="Main Workspace Navigation"
          >
            {navItems.map((item) => {
              const isActive = path === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-violet-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-violet-800 hover:bg-violet-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-violet-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Tally Company Badge + Status + Admin Key + Push Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Active Tally Company Badge (Click to Edit) */}
            <button
              type="button"
              onClick={onOpenCompanyModal}
              title={`Active Tally Company: ${companyName || 'Not Set'}. Click to change.`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-violet-50 hover:bg-violet-100 border border-violet-200 hover:border-violet-400 rounded-lg text-slate-700 transition-colors cursor-pointer max-w-[170px] sm:max-w-[220px]"
            >
              <Building2 className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span className="truncate font-semibold text-[11px] text-violet-800 sm:text-xs">
                {companyName || 'Set Tally Co.'}
              </span>
              <Pencil className="w-2.5 h-2.5 text-violet-400 shrink-0 ml-0.5" />
            </button>

            {/* Minimalist Live Status Pill (Connecting to tally-bridge.exe on 127.0.0.1:8080) */}
            <button
              type="button"
              onClick={onPingBridge}
              title={
                bridgeStatus.connected
                  ? `Connected to local service: ${bridgeStatus.serviceName} on http://${bridgeStatus.endpoint}`
                  : bridgeStatus.bridgeRunning
                  ? 'Bridge is running but Tally is not connected. Open Tally and your company, then click to re-check.'
                  : `Local service (${bridgeStatus.serviceName}) Offline on http://${bridgeStatus.endpoint}. Click to test connection.`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                bridgeStatus.connected
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                  : bridgeStatus.bridgeRunning
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {bridgeStatus.connected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    bridgeStatus.connected ? 'bg-emerald-400' : bridgeStatus.bridgeRunning ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="font-semibold hidden sm:inline">
                {bridgeStatus.connected ? 'Bridge Online' : bridgeStatus.bridgeRunning ? 'Tally Not Connected' : 'Bridge Offline'}
              </span>
              <span className="font-semibold sm:hidden">
                {bridgeStatus.connected ? 'Online' : bridgeStatus.bridgeRunning ? 'No Tally' : 'Offline'}
              </span>
              <RefreshCw className="w-3 h-3 ml-0.5 text-slate-500 hover:text-slate-900" />
            </button>

          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-violet-200 bg-white p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
            {navItems.map((item) => {
              const isActive = path === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
                    isActive ? 'bg-violet-600 text-white font-bold' : 'text-slate-700 hover:bg-violet-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-violet-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

    </>
  );
};
