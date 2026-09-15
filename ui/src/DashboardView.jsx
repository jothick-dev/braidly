import { useState, useEffect } from 'react'
import { Plus, Clock, FolderKanban, MessageSquare, TrendingUp, ChevronRight } from 'lucide-react'
import { getSessions } from './lib/api'

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return diffMin + 'm ago'
  if (diffHr < 24) return diffHr + 'h ago'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-lg font-bold text-text">{value}</p>
        <p className="text-[11px] text-text-dim">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardView({ user, onStartChat, onSignOut }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [projectName, setProjectName] = useState('')

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest'

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    setLoading(true)
    try {
      const data = await getSessions()
      setSessions((data.sessions || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    } catch { setSessions([]) } finally { setLoading(false) }
  }

  const handleNewChat = (e) => {
    e.preventDefault()
    const title = projectName.trim() || 'New Session'
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('braidly.currentSession', sessionId)
    localStorage.setItem('braidly.name', displayName)
    onStartChat(sessionId, title)
  }

  const handleOpenSession = (session) => {
    localStorage.setItem('braidly.currentSession', session.id)
    localStorage.setItem('braidly.name', displayName)
    onStartChat(session.id, session.title)
  }

  const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-text">Welcome back, {displayName} 👋</h1>
          <p className="text-sm text-text-dim mt-1">Here's what's happening with your projects.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={FolderKanban} label="Projects" value={sessions.length} color="bg-accent/15 text-accent" />
          <StatCard icon={MessageSquare} label="Messages" value={totalMessages} color="bg-ai/15 text-ai" />
          <StatCard icon={TrendingUp} label="Active" value={sessions.length > 0 ? '1' : '0'} color="bg-green/15 text-green" />
          <StatCard icon={Clock} label="Last Active" value={sessions.length > 0 ? formatDate(sessions[0].createdAt) : '—'} color="bg-amber/15 text-amber" />
        </div>

        {/* New Chat + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* New Chat */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text mb-3">Start a new project</h3>
            <form onSubmit={handleNewChat} className="flex gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name (e.g., Calendar App)"
                className="flex-1 bg-ink border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent text-ink font-semibold text-sm hover:brightness-110 transition-all"
              >
                <Plus size={15} /> New Chat
              </button>
            </form>
          </div>

          {/* User Activity */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text mb-3">Activity</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    stroke="var(--color-accent)" strokeWidth="3"
                    strokeDasharray={`${Math.min(sessions.length * 15, 94)} 94`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
                  {sessions.length}
                </div>
              </div>
              <div>
                <p className="text-xs text-text-dim">Total projects</p>
                <p className="text-xs text-text-dim mt-1">{totalMessages} messages sent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Previous Projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text">Previous Projects</h3>
            {sessions.length > 0 && (
              <span className="text-[11px] text-text-dim">{sessions.length} total</span>
            )}
          </div>
          {loading ? (
            <div className="text-text-dim text-xs animate-pulse py-8 text-center">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl py-10 text-center">
              <FolderKanban size={28} className="mx-auto text-text-dim/40 mb-2" />
              <p className="text-sm text-text-dim">No projects yet. Start a new chat above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleOpenSession(s)}
                  className="w-full text-left bg-surface border border-border rounded-xl p-4 hover:border-accent/50 hover:bg-surface-hover transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate pr-2">
                      {s.title || 'Untitled Session'}
                    </h4>
                    <ChevronRight size={14} className="text-text-dim group-hover:text-accent transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-dim">
                    <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(s.createdAt)}</span>
                    {s.messageCount > 0 && <span>{s.messageCount} msgs</span>}
                  </div>
                  {s.members?.length > 0 && (
                    <p className="text-[10px] text-text-dim/70 mt-1.5 truncate">{s.members.join(', ')}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: '💬', title: 'Debate Room', desc: 'Real-time team chat with AI facilitation.' },
            { icon: '📋', title: 'PRD Factory', desc: 'AI generates PRDs and contracts.' },
            { icon: '💻', title: 'Vibe Coding', desc: 'Code with full PRD and file upload.' },
            { icon: '🔍', title: 'AI Tech Lead', desc: 'Security scans and integration testing.' },
          ].map((f) => (
            <div key={f.title} className="bg-surface border border-border rounded-xl p-4 text-center hover:border-accent/30 transition-colors">
              <div className="text-xl mb-1.5">{f.icon}</div>
              <h4 className="text-xs font-semibold text-text mb-0.5">{f.title}</h4>
              <p className="text-[10px] text-text-dim leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
