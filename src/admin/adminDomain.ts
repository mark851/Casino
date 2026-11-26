export function isAdminPortalContext(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  if (path === '/admin' || path.startsWith('/admin/') || path === '/admin.html') {
    return true;
  }
  return false;
}

export function getAdminPortalHref(subpath = '/admin/dashboard'): string {
  return subpath.startsWith('/') ? subpath : `/${subpath}`;
}

export function getPlayerSiteHref(subpath = '/'): string {
  return subpath.startsWith('/') ? subpath : `/${subpath}`;
}
