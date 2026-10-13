import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login({ onUseSim }: { onUseSim?: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const error = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, name || email.split('@')[0]);
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-4xl tracking-widest">
            PAN<span className="text-safe">DU</span>
          </div>
          <p className="mt-1 text-sm text-white/40">Pilot Safety Dashboard</p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-ink-800 p-6">
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-ink-700 text-white' : 'text-white/40'
              }`}
            >
              Masuk
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-ink-700 text-white' : 'text-white/40'
              }`}
            >
              Daftar
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Nama"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-safe/50 focus:outline-none"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-safe/50 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-safe/50 focus:outline-none"
            />
            {err && <p className="text-xs text-alert">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-safe py-2.5 text-sm font-semibold text-white transition-colors hover:bg-safe/90 disabled:opacity-50"
            >
              {busy ? '...' : mode === 'signin' ? 'Masuk' : 'Daftar'}
            </button>
          </form>
        </div>

        {onUseSim && (
          <button
            id="use-sim-btn"
            onClick={onUseSim}
            className="mt-4 w-full text-center text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Kembali ke mode simulator (tanpa login)
          </button>
        )}
      </div>
    </div>
  );
}
