/** Cookie options for refresh token (http://localhost Docker needs secure: false). */
export function refreshCookieOptions() {
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}
