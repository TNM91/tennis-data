export function shouldUseFocusedSiteShell(pathname: string) {
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/login'
    || pathname === '/join'
    || pathname === '/forget-password'
    || pathname === '/reset-password'
}
