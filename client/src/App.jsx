import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DialogProvider } from "./components/Dialog";
import Account from "./pages/Account";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Repairs from "./pages/Repairs";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import Team from "./pages/Team";
import Support from "./pages/Support";
import ToVerify from "./pages/ToVerify";

function Protected({ children }) {
  const { user, profile, loading, logout } = useAuth();

  if (loading) return <div className="splash">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile)
    return (
      <div className="splash">
        <p>Your account has no profile yet. Please contact an admin.</p>
        <button className="btn" onClick={logout}>Sign out</button>
      </div>
    );
  return children;
}

function AdminOnly({ children }) {
  const { profile } = useAuth();
  return profile?.role === "admin" ? children : <Navigate to="/" replace />;
}

function StaffOnly({ children }) {
  const { profile } = useAuth();
  return profile?.role !== "technician" ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <DialogProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/support" element={<Support />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<Repairs />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="to-verify" element={<StaffOnly><ToVerify /></StaffOnly>} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="account" element={<Account />} />
              <Route
                path="team"
                element={
                  <AdminOnly>
                    <Team />
                  </AdminOnly>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </DialogProvider>
  );
}