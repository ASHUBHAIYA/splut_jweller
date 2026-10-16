export interface SplitConfig {
  postAccountName: string;
  itemName: string;
  itemSalesAccount: string;
  billDate: string;
  minBillLimit: number; // e.g. 35000 or 0 for ideal organic range
  maxBillLimit: number; // e.g. 45000 or 49500
  minRate: number;
  maxRate: number;
  gstRate: number;
  totalWeight: number; // in grams (g)
  voucherPrefix: string;
  startingBillNo: number;
  billNoWidth?: number; // digits to zero-pad the number to (0016 -> 4); 0/undefined = no padding
  unitLabel: string; // 'g' by default
}

export interface SplitBill {
  id: string;
  billNumber: number;
  voucherNo: string;
  billDate: string;
  postAccountName: string;
  itemName: string;
  itemSalesAccount: string;
  weight: number; // in grams (g)
  rate: number; // in INR per gram
  grossAmount: number;
  gstRate: number;
  gstAmount: number;
  netAmount: number;
  roundOff: number;
  finalBillAmount: number;
  syncStatus?: 'idle' | 'pending' | 'synced' | 'failed';
  tallyMasterId?: string;
}

export interface SplitSummary {
  billCount: number;
  totalWeightGenerated: number;
  targetWeight: number;
  weightDelta: number;
  isWeightMatched: boolean;
  totalTaxableAmount: number;
  totalGstCollected: number;
  totalNetAmount: number;
  totalRoundOff: number;
  grandTotalBillAmount: number;
  averageRate: number;
  minSingleBillAmount: number;
  maxSingleBillAmount: number;
  allWithinLimit: boolean;
  openingStockBalance: number;
  closingStockBalance: number;
}

export interface StockItemPreset {
  name: string;
  hsnCode: string;
  unit: string;
  openingStock: number; // in grams (g)
  defaultMinRate: number; // per gram
  defaultMaxRate: number; // per gram
  defaultMinBillLimit: number;
  defaultMaxBillLimit: number;
  defaultTotalWeight: number; // in grams (g)
  description: string;
}

export interface VoucherSyncLog {
  id: string;
  voucherNo: string;
  billNumber: number;
  itemName: string;
  weight: number;
  rate: number;
  finalBillAmount: number;
  status: 'success' | 'error';
  tallyMasterId: string;
  message: string;
  timestamp: string;
  transportMode: 'localhost-live' | 'bridge-simulator';
}

export interface BridgeStatus {
  /** True only when the bridge is running AND Tally is reachable. */
  connected: boolean;
  /** tally-bridge.exe is connected to the relay (Tally may still be closed). */
  bridgeRunning?: boolean;
  endpoint: string; // '127.0.0.1:8080' for tally-bridge.exe service or 'localhost:9000'
  serviceName: string; // 'tally-bridge.exe' Windows Background Service
  mode: 'live-localhost' | 'simulated-agent';
  companyName: string;
  lastPingTime: string;
  tallyVersion: string;
  latencyMs?: number;
}

export interface BankVoucherEntry {
  id: string;
  date: string;
  dateInvalid?: boolean;
  narration: string;
  refNo: string;
  type: 'Receipt' | 'Payment';
  amount: number;
  amountIn?: number;
  amountOut?: number;
  balance?: number | string;
  bankLedger: string;
  partyLedger: string;
  selected: boolean;
  syncStatus?: 'idle' | 'pending' | 'synced' | 'failed';
  tallyMasterId?: string;
}

export interface LicenseKeyRecord {
  id: string;
  licenseKey: string; // e.g. JWEL-8F92-K4M9-9182
  storeName: string;
  contactInfo: string;
  durationMonths: number; // e.g. 12
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired';
  generatedBy: string;
}
