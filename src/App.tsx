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
  const { user, loading } = useAuth();
  const [simMode, setSimMode] = useState(true);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="font-display text-2xl text-[#1fa37a]">PAN<span className="text-[#f4f1ea]">DU</span></div>
      </div>
    );
  }

  if (!user && !simMode) {
    return <Login />;
  }

  return (
    <Layout simMode={simMode} setSimMode={setSimMode}>
      <Routes>
        <Route path="/" element={<MonitorPage simMode={simMode} />} />
        <Route path="/vest/:id" element={<DetailPage simMode={simMode} />} />
        <Route path="/log" element={<LogPage simMode={simMode} />} />
        <Route path="/incidents" element={<IncidentPage simMode={simMode} />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/system" element={<SystemHealthPage simMode={simMode} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
