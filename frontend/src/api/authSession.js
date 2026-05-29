import axios from "axios";

/** In-flight refresh — backend used to rotate tokens; keep a single promise. */
let refreshPromise = null;

function userFromJwt(accessToken) {
  const p = JSON.parse(atob(accessToken.split(".")[1]));
  return { id: p.id, email: p.email, role: p.role, name: p.name };
}

/**
 * @param {{ accessToken: string, user?: object }} data
 * @returns {{ accessToken: string, user: object }}
 */
export function buildSession(data) {
  const user = data.user ?? userFromJwt(data.accessToken);
  return { accessToken: data.accessToken, user };
}

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post("/auth/refresh", {}, { withCredentials: true })
      .then(({ data }) => buildSession(data))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function resetRefreshPromise() {
  refreshPromise = null;
}

export function isAuthRequestUrl(url) {
  const raw = url || "";
  const path = raw.startsWith("http") ? new URL(raw).pathname : raw.split("?")[0];
  return path.includes("/auth/");
}
