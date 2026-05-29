const GUEST_PATHS = new Set(["/login", "/register"]);
const PROTECTED_PATHS = ["/dashboard", "/compare", "/admin"];

export function normalizePath(pathname) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function isAuthenticated(user, accessToken) {
  return Boolean(user && accessToken);
}

/**
 * @returns {{ to: string, state?: object } | null}
 */
export function resolveAuthRedirect(pathname, user, accessToken) {
  const path = normalizePath(pathname);
  const authed = isAuthenticated(user, accessToken);
  const isGuest = GUEST_PATHS.has(path);
  const isProtected = PROTECTED_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (authed && isGuest) {
    return { to: user.role === "admin" ? "/admin" : "/dashboard" };
  }

  if (!authed && isProtected) {
    return { to: "/login", state: { from: path } };
  }

  if (authed && path === "/admin" && user.role !== "admin") {
    return { to: "/dashboard" };
  }

  return null;
}
