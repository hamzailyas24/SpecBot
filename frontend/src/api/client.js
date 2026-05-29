import axios from "axios";
import { useAuthStore } from "../store/authStore.js";
import {
  refreshAccessToken,
  isAuthRequestUrl,
} from "./authSession.js";

const api = axios.create({ baseURL: "/", withCredentials: true });

export const getAccessToken = () => useAuthStore.getState().accessToken;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;
let queue = [];
const drain = (err) => {
  queue.forEach((p) => (err ? p.reject(err) : p.resolve()));
  queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config;

    if (!orig || isAuthRequestUrl(orig.url)) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !orig._retry) {
      if (refreshing) {
        return new Promise((res, rej) => queue.push({ resolve: res, reject: rej }))
          .then(() => api(orig))
          .catch((e) => Promise.reject(e));
      }
      orig._retry = true;
      refreshing = true;
      try {
        const session = await refreshAccessToken();
        useAuthStore.getState().setSession(session);
        drain(null);
        return api(orig);
      } catch (e) {
        drain(e);
        useAuthStore.getState().clearSession();
        return Promise.reject(e);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
