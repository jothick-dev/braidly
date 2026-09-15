import { useState, Suspense, lazy } from 'react'
import { Menu, X, ArrowRight, Play, MessageSquare, FileText, Code, Shield } from 'lucide-react'
const BraidBackground = lazy(() => import('./BraidBackground'))

export default function LandingView({ onLogin, onSignUp, onDemo }) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="min-h-screen text-text font-sans relative">
      <Suspense fallback={null}>
        <BraidBackground onReveal={() => setRevealed(true)} />
      </Suspense>
      <div className="relative" style={{ zIndex: 10 }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-ink/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-accent text-xl">⬡</span>
            <span className="text-sm font-bold tracking-wide">Braidly</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-text-dim">
            <a href="#home" className="hover:text-text transition-colors">Home</a>
            <a href="#about" className="hover:text-text transition-colors">About</a>
            <a href="#features" className="hover:text-text transition-colors">Features</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={onLogin} className="text-xs text-text-dim hover:text-text transition-colors px-3 py-1.5">Login</button>
            <button onClick={onSignUp} className="text-xs font-semibold bg-accent text-ink px-4 py-1.5 rounded-lg hover:brightness-110 transition-all">Sign Up</button>
          </div>
          <button className="md:hidden text-text-dim" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-border px-6 py-4 space-y-3">
            <a href="#home" className="block text-xs text-text-dim hover:text-text">Home</a>
            <a href="#about" className="block text-xs text-text-dim hover:text-text">About</a>
            <a href="#features" className="block text-xs text-text-dim hover:text-text">Features</a>
            <hr className="border-border" />
            <button onClick={onLogin} className="block text-xs text-text-dim hover:text-text">Login</button>
            <button onClick={onSignUp} className="block text-xs font-semibold bg-accent text-ink px-4 py-1.5 rounded-lg w-full">Sign Up</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section id="home" className="relative">
        <div className={`max-w-6xl mx-auto px-6 py-20 md:py-28 space-y-6 transition-opacity duration-1000 ${revealed ? 'opacity-100' : 'opacity-20'}`}>
            <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-1">
              <span className="text-[10px] text-text-dim">AI-powered team workspace</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              <span className="text-accent font-mono">{'{Braidly}'}</span>
            </h1>
            <p className="text-sm text-text-dim leading-relaxed max-w-lg">
              From idea to integrated code — Braidly takes your team through discussion, planning, coding, and verification, all guided by AI.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={onSignUp} className="flex items-center gap-2 bg-accent text-ink font-semibold text-sm px-6 py-3 rounded-lg hover:brightness-110 transition-all">
                Get Started <ArrowRight size={14} />
              </button>
              <button onClick={onDemo} className="flex items-center gap-2 bg-surface border border-border text-text text-sm px-6 py-3 rounded-lg hover:border-accent/50 transition-all">
                <Play size={12} /> Try Demo
              </button>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {['Debate', 'Plan', 'Code', 'Verify', 'Ship'].map((s, i) => (
                <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-dim">
                  {i + 1}. {s}
                </span>
              ))}
            </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-lg font-bold text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: MessageSquare, title: 'Debate Room', desc: 'Real-time team chat with AI facilitation guiding the discussion.', color: 'text-accent' },
              { icon: FileText, title: 'PRD Factory', desc: 'AI generates personalized PRDs and contracts from the conversation.', color: 'text-ai' },
              { icon: Code, title: 'Vibe Coding', desc: 'Code with full PRD context, file upload, and module tracking.', color: 'text-green' },
              { icon: Shield, title: 'AI Tech Lead', desc: 'Automated security scans, contract verification, and integration.', color: 'text-amber' },
            ].map(f => (
              <div key={f.title} className="bg-surface border border-border rounded-xl p-5 hover:border-accent/30 transition-colors group">
                <f.icon size={20} className={`${f.color} mb-3 group-hover:scale-110 transition-transform`} />
                <h3 className="text-sm font-semibold text-text mb-1.5">{f.title}</h3>
                <p className="text-[11px] text-text-dim leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-lg font-bold text-center mb-10">Contract-first development</h2>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {['Debate', 'PRD', 'Code', 'Submit', 'Integrate'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="bg-surface border border-border rounded-lg px-4 py-2.5 text-center">
                  <span className="text-[10px] font-mono text-accent block mb-0.5">Stage {i + 1}</span>
                  <span className="text-xs font-medium text-text">{step}</span>
                </div>
                {i < 4 && <span className="text-border text-sm">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-lg font-bold mb-3">Ready to build something together?</h2>
          <p className="text-xs text-text-dim mb-6">Start a team discussion and let AI handle the planning.</p>
          <button onClick={onSignUp} className="bg-accent text-ink font-semibold text-sm px-8 py-3 rounded-lg hover:brightness-110 transition-all">
            Start Building
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-accent text-sm">⬡</span>
            <span className="text-[10px] font-bold text-text-dim">Braidly</span>
          </div>
          <p className="text-[10px] text-text-dim/60">Built for the AI Builders Hackathon</p>
          <div className="flex gap-4 text-[10px] text-text-dim">
            <a href="#about" className="hover:text-text">About</a>
            <span className="text-border">·</span>
            <span className="text-text-dim/50">Privacy</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  )
}
