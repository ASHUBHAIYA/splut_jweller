import React, { useEffect, useState, useCallback } from 'react';

/** Minimal History-API router (real paths like /logs and /admin, no hash). */
export type AppPath = '/' | '/bank' | '/logs' | '/admin' | '/help';

const KNOWN: AppPath[] = ['/', '/bank', '/logs', '/admin', '/help'];

export function normalizePath(p: string): AppPath {
  const clean = (p.replace(/\/+$/, '') || '/') as AppPath;
  return KNOWN.includes(clean) ? clean : '/';
}

export function navigate(to: AppPath, replace = false) {
  if (normalizePath(window.location.pathname) === to && window.location.pathname === to) return;
  if (replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath(): AppPath {
  const [path, setPath] = useState<AppPath>(() => normalizePath(window.location.pathname));
  useEffect(() => {
    const onPop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export const Link: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: AppPath }
> = ({ to, onClick, children, ...rest }) => {
  const handle = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    },
    [onClick, to]
  );
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
};
