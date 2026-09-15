import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getSupabase } from './lib/supabase'

export default function AuthView({ onAuth, onBack, onDemo }) {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const sb = getSupabase()
      if (!sb) { setError('Supabase not configured. Add keys to .env'); setLoading(false); return }

      let result
      if (mode === 'signup') {
        result = await sb.auth.signUp({ email, password, options: { data: { display_name: name } } })
      } else {
        result = await sb.auth.signInWithPassword({ email, password })
      }

      if (result.error) {
        setError(result.error.message)
      } else if (result.data?.user) {
        onAuth(result.data.user)
      }
    } catch (err) {
      setError(err.message || 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-text-dim hover:text-text mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-accent">⬡</span>
            <span className="text-sm font-bold">Braidly</span>
          </div>

          <div className="flex gap-1 bg-ink rounded-lg p-0.5 mb-5">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'signin' ? 'bg-surface text-text' : 'text-text-dim hover:text-text'}`}
            >Sign In</button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'signup' ? 'bg-surface text-text' : 'text-text-dim hover:text-text'}`}
            >Sign Up</button>
          </div>

          {error && <div className="bg-red/10 border border-red/30 text-red text-[11px] px-3 py-2 rounded-lg mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-ink border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent transition-colors"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-ink border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-ink border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-ink font-semibold text-sm py-2.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? 'Loading…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <span className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-text-dim uppercase tracking-wider">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={onDemo}
            className="w-full bg-surface border border-border text-text text-sm py-2.5 rounded-lg hover:border-accent/50 hover:text-accent transition-all"
          >
            Skip for now — explore as Guest
          </button>
          <p className="text-[10px] text-text-dim/70 text-center mt-2">
            No sign-up needed. Great for hackathon judges and quick demos.
          </p>
        </div>
      </div>
    </div>
  )
}
