import { useEffect, useState } from 'react';
import { getCloudflareWorkerConfig, DEFAULT_CF_WORKER_URL, getAdminSessionPin } from './adminAuth';

export interface MaintenanceState {
  active: boolean;
  message: string;
  /** ISO time when the app is expected to be back, or '' */
  backAt: string;
}

function baseUrl(): string {
  const { workerUrl } = getCloudflareWorkerConfig();
  return (workerUrl || DEFAULT_CF_WORKER_URL).replace(/\/+$/, '');
}

export async function fetchMaintenance(): Promise<MaintenanceState | null> {
  const base = baseUrl();
  if (!/^https?:\/\//i.test(base)) return null;
  try {
    const res = await fetch(`${base}/maintenance`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = await res.json();
    return { active: !!d.active, message: String(d.message || ''), backAt: String(d.backAt || '') };
  } catch {
    return null; // Worker unreachable: do not block the app
  }
}

export async function saveMaintenance(m: MaintenanceState): Promise<{ success: boolean; message?: string }> {
  const base = baseUrl();
  if (!/^https?:\/\//i.test(base)) return { success: false, message: 'Worker URL is not set (VITE_CF_WORKER_URL).' };
  try {
    const res = await fetch(`${base}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-PIN': getAdminSessionPin() },
      body: JSON.stringify(m),
      signal: AbortSignal.timeout(8000),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: d.error || (res.status === 404 ? 'Redeploy the Worker (npx wrangler deploy) to enable downtime notices.' : `Failed (${res.status})`),
      };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not reach the Worker.' };
  }
}

/** Polls the downtime notice (every minute and whenever the tab gets focus). */
export function useMaintenance(): MaintenanceState | null {
  const [m, setM] = useState<MaintenanceState | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchMaintenance().then((r) => {
        if (alive && r) setM(r);
      });
    load();
    const t = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return m;
}
