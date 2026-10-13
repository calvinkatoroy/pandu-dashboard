import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Layout from './components/Layout';
import MonitorPage from './pages/MonitorPage';
import LogPage from './pages/LogPage';
import IncidentPage from './pages/IncidentPage';
import DetailPage from './pages/DetailPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import SystemHealthPage from './pages/SystemHealthPage';

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [simMode, setSimMode] = useState(false);
  const [simFleet, setSimFleet] = useState<1 | 8>(1);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="font-display text-2xl text-[#f4f1ea]">PAN<span className="text-[#1fa37a]">DU</span></div>
      </div>
    );
  }

  if (!user && !simMode) {
    return <Login onUseSim={() => setSimMode(true)} />;
  }

  // Mode Sim = demo tanpa login, semua kontrol aktif (peran admin lokal)
  const role = simMode ? 'admin' : user?.role ?? null;

  return (
    <Layout simMode={simMode} setSimMode={setSimMode} user={simMode ? null : user} onSignOut={signOut}>
      <Routes>
        <Route path="/" element={<MonitorPage simMode={simMode} role={role} simFleet={simFleet} setSimFleet={setSimFleet} />} />
        <Route path="/vest/:id" element={<DetailPage simMode={simMode} />} />
        <Route path="/log" element={<LogPage simMode={simMode} />} />
        <Route path="/incidents" element={<IncidentPage simMode={simMode} />} />
        <Route path="/admin" element={<AdminPage simMode={simMode} role={role} />} />
        <Route path="/settings" element={<SettingsPage simMode={simMode} role={role} />} />
        <Route path="/system" element={<SystemHealthPage simMode={simMode} role={role} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
