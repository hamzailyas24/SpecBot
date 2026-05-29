import { useEffect, useLayoutEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore.js";
import {
  normalizePath,
  resolveAuthRedirect,
} from "./utils/authRedirect.js";
import AppLayout from "./layouts/AppLayout.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Compare from "./pages/Compare.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";

function AuthNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    useAuthStore.setState({
      navigate: (to, options) => navigate(to, options),
    });
    return () => useAuthStore.setState({ navigate: null });
  }, [navigate]);

  return null;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const pathname = normalizePath(location.pathname);
  const redirect = resolveAuthRedirect(pathname, user, accessToken);
  const needsRedirect = Boolean(redirect && redirect.to !== pathname);

  useLayoutEffect(() => {
    if (needsRedirect && redirect) {
      navigate(redirect.to, { replace: true, state: redirect.state });
    }
  }, [needsRedirect, redirect?.to, redirect?.state, pathname, navigate]);

  if (needsRedirect) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="compare" element={<Compare />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const authReady = useAuthStore((s) => s.authReady);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!authReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      <AuthNavigationBridge />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#13131a",
            color: "#e8e8f0",
            border: "1px solid #1e1e2a",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#6366f1", secondary: "#050507" } },
        }}
      />
      <AppShell />
    </>
  );
}
