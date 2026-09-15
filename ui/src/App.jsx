import { useState, useEffect } from 'react'
import { initSupabase, onAuthChange, signOut } from './lib/supabase'
import Sidebar from './Sidebar'
import LandingView from './LandingView'
import AuthView from './AuthView'
import DashboardView from './DashboardView'
import TeamChatView from './TeamChatView'
import ModuleSubmissionView from './ModuleSubmissionView'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [screen, setScreen] = useState('chat')
  const [authState, setAuthState] = useState('loading')
  const [user, setUser] = useState(null)
  const [activeSession, setActiveSession] = useState(null)

  useEffect(() => {
    initSupabase().then(async (sb) => {
      if (!sb) {
        // Check for session URL param before showing landing
        const urlSession = new URLSearchParams(window.location.search).get('session')
        if (urlSession) {
          const guest = { user_metadata: { display_name: 'Guest' }, email: 'guest@local', id: 'guest' }
          setUser(guest)
          localStorage.setItem('braidly.name', 'Guest')
          setAuthState('app')
          setActiveSession({ id: urlSession, title: 'Shared Session' })
          setScreen('chat')
          return
        }
        setAuthState('landing'); return
      }
      const { data: { session } } = await sb.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        const name = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Guest'
        localStorage.setItem('braidly.name', name)
        setAuthState('app')
        // Auto-join session from URL param
        const urlSession = new URLSearchParams(window.location.search).get('session')
        if (urlSession) {
          setActiveSession({ id: urlSession, title: 'Shared Session' })
          setScreen('chat')
        }
      } else {
        // Check for session URL param before showing landing
        const urlSession = new URLSearchParams(window.location.search).get('session')
        if (urlSession) {
          const guest = { user_metadata: { display_name: 'Guest' }, email: 'guest@local', id: 'guest' }
          setUser(guest)
          localStorage.setItem('braidly.name', 'Guest')
          setAuthState('app')
          setActiveSession({ id: urlSession, title: 'Shared Session' })
          setScreen('chat')
        } else { setAuthState('landing') }
      }
      onAuthChange((event, session) => {
        if (event === 'SIGNED_OUT') { setUser(null); setActiveSession(null); setAuthState('landing') }
        else if (session?.user) {
          setUser(session.user)
          const name = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Guest'
          localStorage.setItem('braidly.name', name)
          setAuthState('app')
        }
      })
    })
  }, [])

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest'

  const handleSignOut = async () => {
    if (user?.id !== 'guest') await signOut()
    setUser(null); setActiveSession(null); setAuthState('landing')
  }

  const handleStartChat = (sessionId, title) => {
    localStorage.setItem('braidly.currentSession', sessionId)
    setActiveSession({ id: sessionId, title })
    setScreen('chat')
    setActiveTab('projects')
  }

  const handleBackToDashboard = () => {
    setActiveSession(null)
    setActiveTab('dashboard')
  }

  const handleAuth = (u) => {
    setUser(u)
    const name = u?.user_metadata?.display_name || u?.email?.split('@')[0] || 'Guest'
    localStorage.setItem('braidly.name', name)
    setAuthState('app')
  }

  const handleDemo = () => {
    const guest = { user_metadata: { display_name: 'Guest' }, email: 'guest@local', id: 'guest' }
    setUser(guest)
    localStorage.setItem('braidly.name', 'Guest')
    setAuthState('app')
    // Auto-join session from URL param
    const urlSession = new URLSearchParams(window.location.search).get('session')
    if (urlSession) {
      setActiveSession({ id: urlSession, title: 'Shared Session' })
      setScreen('chat')
    }
  }

  if (authState === 'loading') {
    return <div className="min-h-screen app-bg flex items-center justify-center"><div className="text-text-dim text-sm animate-pulse">Loading…</div></div>
  }

  if (authState === 'landing') {
    return <LandingView onLogin={() => setAuthState('unauthed')} onSignUp={() => setAuthState('unauthed')} onDemo={handleDemo} />
  }

  if (authState === 'unauthed') {
    return <AuthView onAuth={handleAuth} onBack={() => setAuthState('landing')} onDemo={handleDemo} />
  }

  const renderMainContent = () => {
    if (activeSession) {
      return (
        <div className="flex-1 flex flex-col min-h-screen">
          <div className="h-11 flex items-center justify-between px-4 border-b border-border bg-ink/80 backdrop-blur-sm flex-shrink-0 z-40">
            <div className="flex items-center gap-3">
              <button onClick={handleBackToDashboard} className="text-text-dim hover:text-accent text-xs transition-colors">← Dashboard</button>
              <span className="text-border">|</span>
              <span className="text-xs text-text-dim">{activeSession.title}</span>
            </div>
            <div className="flex gap-1 bg-surface border border-border rounded-lg p-0.5">
              <button
                onClick={() => setScreen('chat')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${screen === 'chat' ? 'bg-accent text-ink' : 'text-text-dim hover:text-text'}`}
              >Team Chat</button>
              <button
                onClick={() => setScreen('modules')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${screen === 'modules' ? 'bg-accent text-ink' : 'text-text-dim hover:text-text'}`}
              >Modules</button>
            </div>
          </div>
          {screen === 'chat' && <TeamChatView userName={displayName} onSignOut={null} onBack={handleBackToDashboard} sessionTitle={activeSession?.title} sessionId={activeSession?.id} />}
          {screen === 'modules' && <ModuleSubmissionView userName={displayName} />}
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface border border-border flex items-center justify-center">
                <svg className="w-8 h-8 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h2 className="text-base font-semibold text-text mb-2">Dashboard</h2>
              <p className="text-sm text-text-dim">Still under construction — coming soon.</p>
            </div>
          </div>
        )
      case 'home':
        return <DashboardView user={user} onStartChat={handleStartChat} onSignOut={null} />
      case 'profile':
        return (
          <div className="flex-1 p-6">
            <div className="max-w-lg mx-auto bg-surface border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-text mb-4">Profile</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-accent text-ink flex items-center justify-center font-bold text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-semibold text-text">{displayName}</p>
                  <p className="text-xs text-text-dim">{user?.email || 'guest@local'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-dim">Display Name</span>
                  <span className="text-xs text-text">{displayName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-dim">Email</span>
                  <span className="text-xs text-text">{user?.email || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-text-dim">Account Type</span>
                  <span className="text-xs text-accent">{user?.id === 'guest' ? 'Guest' : 'Authenticated'}</span>
                </div>
              </div>
            </div>
          </div>
        )
      case 'projects':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface border border-border flex items-center justify-center">
                <svg className="w-8 h-8 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <h2 className="text-base font-semibold text-text mb-2">Projects</h2>
              <p className="text-sm text-text-dim">Still under construction — coming soon.</p>
            </div>
          </div>
        )
      case 'team':
        return (
          <div className="flex-1 p-6">
            <div className="max-w-lg mx-auto bg-surface border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-text mb-4">Team</h2>
              <p className="text-sm text-text-dim">Team management will be available when collaborating on projects.</p>
            </div>
          </div>
        )
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface border border-border flex items-center justify-center">
                <svg className="w-8 h-8 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <h2 className="text-base font-semibold text-text mb-2">Projects</h2>
              <p className="text-sm text-text-dim">Still under construction — coming soon.</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen app-bg">
      <Sidebar user={user} activeTab={activeTab} onTabChange={setActiveTab} onSignOut={user?.id !== 'guest' ? handleSignOut : null} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {renderMainContent()}
      </div>
    </div>
  )
}
