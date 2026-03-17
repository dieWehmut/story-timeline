const PUBLIC_PATHS = ['/login', '/register'];

/**
 * Returns true if the given pathname is publicly accessible (no auth required).
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/invites/')) return true;
  if (pathname.startsWith('/auth/')) return true;
  return false;
}
