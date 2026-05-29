import { create } from "zustand";
import api from "../api/client.js";
import {
  buildSession,
  refreshAccessToken,
  resetRefreshPromise,
} from "../api/authSession.js";

let hydratePromise = null;

export function resetHydrate() {
  hydratePromise = null;
}

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  authReady: false,
  loading: false,
  navigate: null,

  setSession: (session) => {
    set({ user: session.user, accessToken: session.accessToken });
  },

  clearSession: () => {
    resetRefreshPromise();
    set({ user: null, accessToken: null });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const session = buildSession(data);
      get().setSession(session);
      return session.user;
    } finally {
      set({ loading: false });
    }
  },

  register: async (name, email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      const session = buildSession(data);
      get().setSession(session);
      return session.user;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await api.post("/auth/logout").catch(() => {});
    resetHydrate();
    get().clearSession();
    get().navigate?.("/", { replace: true });
  },

  hydrate: async () => {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        try {
          const session = await refreshAccessToken();
          get().setSession(session);
        } catch {
          get().clearSession();
        } finally {
          set({ authReady: true });
        }
      })();
    }
    await hydratePromise;
  },
}));
