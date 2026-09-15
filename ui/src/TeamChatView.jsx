import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip, RotateCcw, Zap, FileText, Upload, Trash2, CheckCircle, Copy, Check, Link2 } from 'lucide-react'
import { connect, disconnect, sendChat, sendTyping, on, onStatus, getConnectionStatus } from './lib/websocket'
import { getBriefs, getSubmissions, finalizeDiscussion, clearChat } from './lib/api'

export default function TeamChatView({ userName, onSignOut, onBack, sessionTitle, sessionId }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [input, setInput] = useState('')
  const [connStatus, setConnStatus] = useState('disconnected')
  const [briefs, setBriefs] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [finalizing, setFinalizing] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const [expandedPRD, setExpandedPRD] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const threadRef = useRef(null)
  const inputRef = useRef(null)
  const streamBuffer = useRef({})
  const typingTimeout = useRef(null)

  // Connect WebSocket
  useEffect(() => {
    connect(userName, sessionId)
    const unsubs = [
      onStatus((s) => setConnStatus(s)),
      on('presence.update', (d) => setMembers(d.members)),
      on('chat.message', (d) => {
        setMessages(prev => [...prev, d.message])
      }),
      on('chat.stream', (d) => {
        if (!streamBuffer.current[d.id]) streamBuffer.current[d.id] = ''
        streamBuffer.current[d.id] += d.delta
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === d.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], text: streamBuffer.current[d.id] }
            return updated
          }
          return [...prev, { id: d.id, role: 'ai', sender: 'Braidly', text: streamBuffer.current[d.id], ts: Date.now() }]
        })
      }),
      on('chat.done', (d) => {
        delete streamBuffer.current[d.id]
      }),
      on('system.notice', (d) => {
        setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: d.text, ts: Date.now() }])
      }),
      on('chat.typing', (d) => {
        setTypingUser(d.sender)
        setTimeout(() => setTypingUser(null), 3000)
      }),
      on('session.history',(d)=>{if(d.messages&&d.messages.length>0)setMessages(d.messages)}),
      on('workspace.update', (d) => {
        if (d.briefs) setBriefs(d)
        loadSubmissions()
      }),
    ]
    // Load existing briefs
    getBriefs().then(d => { if (d.analysis) setBriefs(d) }).catch(() => {})
    getSubmissions().then(d => { if (d.submissions) setSubmissions(d.submissions) }).catch(() => {})
    return () => { unsubs.forEach(u => u()); disconnect() }
  }, [userName])

  // Auto-scroll
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    sendChat(input.trim(), Date.now().toString())
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const handleTyping = () => {
    sendTyping()
  }

  const handleCopyPrd = (b, e) => {
    e.stopPropagation()
    const prd = b.brief?.prd || b.brief?.PRD
    const buildInstructions = b.brief?.build_instructions || b.brief?.BuildInstructions
    const dod = b.brief?.definition_of_done || b.brief?.DefinitionOfDone
    const lines = []
    lines.push(`PRD: ${b.module}`)
    lines.push(`Owner: ${b.owner || 'N/A'}`)
    lines.push('')
    if (prd?.title) { lines.push(`Title: ${prd.title}`); lines.push('') }
    if (prd?.description) { lines.push('Description:'); lines.push(prd.description); lines.push('') }
    if (prd?.user_stories?.length) {
      lines.push('User Stories:')
      prd.user_stories.forEach((s, i) => {
        if (typeof s === 'string') lines.push(`  ${i + 1}. ${s}`)
        else lines.push(`  ${i + 1}. As a ${s.as_a}, I want to ${s.i_want}${s.so_that ? ', so that ' + s.so_that : ''}`)
      })
      lines.push('')
    }
    if (prd?.objectives?.length) {
      lines.push('Objectives:')
      prd.objectives.forEach((o, i) => lines.push(`  ${i + 1}. ${typeof o === 'string' ? o : o.objective || JSON.stringify(o)}`))
      lines.push('')
    }
    if (prd?.acceptance_criteria?.length) {
      lines.push('Acceptance Criteria:')
      prd.acceptance_criteria.forEach((c, i) => lines.push(`  ${i + 1}. ${typeof c === 'string' ? c : c.criterion || JSON.stringify(c)}`))
      lines.push('')
    }
    if (prd?.ui_behavior) { lines.push('UI / Behavior:'); lines.push(prd.ui_behavior); lines.push('') }
    if (buildInstructions) {
      lines.push('Build Instructions:')
      Object.entries(buildInstructions).forEach(([key, val]) => {
        if (!val) return
        const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase())
        if (typeof val === 'object') {
          const text = Array.isArray(val)
            ? val.map(v => typeof v === 'string' ? v : v.name || v.file || JSON.stringify(v)).join(', ')
            : JSON.stringify(val, null, 2)
          lines.push(`  ${label}: ${text}`)
        } else {
          lines.push(`  ${label}: ${String(val)}`)
        }
      })
      lines.push('')
    }
    if (dod?.length) {
      lines.push('Definition of Done:')
      dod.forEach((item, i) => lines.push(`  ${i + 1}. ${typeof item === 'string' ? item : item.criterion || item.item || JSON.stringify(item)}`))
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedIndex(b.module)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      await finalizeDiscussion()
    } catch (err) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', text: `Finalize failed: ${err.message}`, ts: Date.now() }])
    } finally {
      setFinalizing(false)
    }
  }

  const handleShareLink=()=>{var sid=sessionId||localStorage.getItem("braidly.currentSession")||"";var url=window.location.origin+"/?session="+sid;navigator.clipboard.writeText(url).then(()=>{setCopiedLink(true);setTimeout(()=>setCopiedLink(false),2000)}).catch(()=>{})}

  const handleClearChat = async () => {
    if (!window.confirm('Are you sure you want to clear the chat? This will archive the current session and start fresh.')) return
    try {
      const sessionId = localStorage.getItem('braidly.currentSession')
      const result = await clearChat(sessionId)
      setMessages([])
      setBriefs(null)
      setSubmissions([])
      if (result.newSessionId) {
        localStorage.setItem('braidly.currentSession', result.newSessionId)
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', text: `Clear failed: ${err.message}`, ts: Date.now() }])
    }
  }

  async function loadSubmissions() {
    try {
      const d = await getSubmissions()
      if (d.submissions) setSubmissions(d.submissions)
    } catch {}
  }

  const connColor = connStatus === 'connected' ? 'bg-green' : connStatus === 'reconnecting' ? 'bg-amber' : 'bg-red'

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left sidebar — People in Chat */}
      <div className="w-60 border-r border-border bg-ink/50 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-text-dim uppercase tracking-wider">People in Chat</h3>
            <button onClick={handleShareLink} title="Copy shareable link" className="p-1 rounded text-text-dim hover:text-accent transition-colors">
              {copiedLink ? <Check size={12} className="text-green" /> : <Link2 size={12} />}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {members.filter(m => m.online).map(m => (
            <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <div className="relative">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: m.color + '30', color: m.color }}>
                  {m.name?.charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-ink ${connColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text truncate">{m.name}</p>
                {m.name === 'Braidly' && <span className="text-[9px] font-mono text-ai">AI</span>}
              </div>
            </div>
          ))}
          {members.filter(m => m.online).length === 0 && (
            <p className="text-[11px] text-text-dim/50 px-2 py-4">No one here yet…</p>
          )}
        </div>
        <div className="p-2 border-t border-border">
          <button
            onClick={handleClearChat}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-red/80 hover:text-red hover:bg-red/10 border border-red/20 transition-colors"
          >
            <Trash2 size={12} /> Clear Chat
          </button>
        </div>
      </div>

      {/* Center — Message Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-2xl mb-2">💬</div>
                <p className="text-sm text-text-dim">Start chatting to begin your project.</p>
                <p className="text-[11px] text-text-dim/60 mt-1">Type <span className="font-mono text-ai">/ai</span> to ask Braidly for help.</p>
              </div>
            </div>
          )}
          {messages.map((m) => {
            if (m.role === 'system') {
              return (
                <div key={m.id} className="text-center py-1">
                  <span className="text-[10px] text-text-dim/50 bg-surface px-3 py-1 rounded-full">{m.text}</span>
                </div>
              )
            }
            const isAI = m.role === 'ai'
            return (
              <div key={m.id} className={`flex gap-2.5 ${isAI ? 'justify-start' : 'justify-end'}`}>
                {isAI && (
                  <div className="w-7 h-7 rounded-full bg-ai/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap size={12} className="text-ai" />
                  </div>
                )}
                <div className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${isAI ? 'bg-surface border border-border bubble-ai' : 'bg-accent/10 border border-accent/20 bubble-human'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold ${isAI ? 'text-ai' : 'text-accent'}`}>{m.sender || 'You'}</span>
                    {isAI && <span className="text-[8px] font-mono bg-ai/15 text-ai px-1.5 py-0.5 rounded">AI</span>}
                    <span className="text-[9px] text-text-dim/40">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-text leading-relaxed whitespace-pre-wrap">{m.text}</p>
                </div>
                {!isAI && (
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-accent">{userName?.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
            )
          })}
          {typingUser && (
            <div className="text-[10px] text-text-dim/50 italic px-2">{typingUser} is typing…</div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <button type="button" className="p-2 text-text-dim hover:text-text transition-colors">
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); handleTyping() }}
              onKeyDown={handleKeyDown}
              placeholder="Enter to send, Shift+Enter for newline…"
              rows={1}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-dim outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 bg-accent text-ink rounded-lg hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Right sidebar — PRD Showcase + Doc Submission */}
      <div className="w-72 border-l border-border bg-ink/50 flex flex-col flex-shrink-0">
        {/* PRD Factory */}
        <div className="p-3 border-b border-border">
          <h3 className="text-[11px] font-semibold text-ai uppercase tracking-wider mb-2">PRD Factory</h3>
          <button
            onClick={handleFinalize}
            disabled={finalizing || messages.length < 2}
            className="w-full px-3 py-2 bg-ai/15 text-ai text-[11px] font-medium rounded-lg hover:bg-ai/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {finalizing ? 'Finalizing…' : 'Finalize Discussion'}
          </button>
        </div>

        {/* PRD Showcase */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <h3 className="text-[11px] font-semibold text-ai uppercase tracking-wider">PRD Showcase</h3>
          {briefs?.briefs?.length > 0 ? (
            briefs.briefs.map((b, i) => {
              const isExpanded = expandedPRD === i
              // Normalize: LLM may return PascalCase (PRD) or snake_case (prd)
              const prd = b.brief?.prd || b.brief?.PRD
              const buildInstructions = b.brief?.build_instructions || b.brief?.BuildInstructions
              const dod = b.brief?.definition_of_done || b.brief?.DefinitionOfDone
              const summary = prd?.ui_behavior || prd?.description || (prd?.user_stories?.[0] ? (typeof prd.user_stories[0] === 'string' ? prd.user_stories[0] : prd.user_stories[0].i_want || prd.user_stories[0].as_a) : 'Module brief')

              return (
                <div
                  key={i}
                  onClick={() => setExpandedPRD(isExpanded ? null : i)}
                  className={`index-card bg-surface border rounded-lg shadow-lg relative cursor-pointer transition-all duration-200 ${isExpanded ? 'border-accent/50 p-3' : 'border-border p-3 hover:border-accent/30'}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]">📌</span>
                        <h4 className="text-[11px] font-semibold text-text font-mono truncate">{b.module}</h4>
                        {b.owner && <span className="text-[9px] text-accent">{b.owner}</span>}
                      </div>
                      {!isExpanded && (
                        <p className="text-[10px] text-text-dim mt-1 leading-relaxed line-clamp-2">{summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleCopyPrd(b, e)}
                        className="p-1 rounded hover:bg-surface transition-colors"
                        title="Copy PRD to clipboard"
                      >
                        {copiedIndex === b.module
                          ? <Check size={12} className="text-green" />
                          : <Copy size={12} className="text-text-dim/50 hover:text-text-dim" />
                        }
                      </button>
                      <span className="text-[9px] text-text-dim/50">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 text-[10px]" onClick={(e) => e.stopPropagation()}>
                      {/* Title */}
                      {prd?.title && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-accent uppercase tracking-wider mb-1">Title</h5>
                          <p className="text-text leading-relaxed">{prd.title}</p>
                        </div>
                      )}

                      {/* Description */}
                      {prd?.description && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-ai uppercase tracking-wider mb-1">Description</h5>
                          <p className="text-text-dim leading-relaxed">{prd.description}</p>
                        </div>
                      )}

                      {/* User Stories */}
                      {prd?.user_stories?.length > 0 && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-accent uppercase tracking-wider mb-1">User Stories</h5>
                          <ul className="space-y-1.5 pl-3 list-disc text-text-dim leading-relaxed">
                            {prd.user_stories.map((story, j) => {
                              // Handle both string stories and object stories { as_a, i_want, so_that }
                              if (typeof story === 'string') return <li key={j}>{story}</li>
                              return (
                                <li key={j}>
                                  <span className="text-text">As a {story.as_a},</span>{' '}
                                  <span className="text-text-dim">I want to {story.i_want}</span>
                                  {story.so_that && <span className="text-text-dim">, so that {story.so_that}</span>}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Objectives */}
                      {prd?.objectives?.length > 0 && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-green uppercase tracking-wider mb-1">Objectives</h5>
                          <ul className="space-y-1 pl-3 list-disc text-text-dim leading-relaxed">
                            {prd.objectives.map((o, j) => <li key={j}>{typeof o === 'string' ? o : o.objective || JSON.stringify(o)}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Acceptance Criteria */}
                      {prd?.acceptance_criteria?.length > 0 && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-green uppercase tracking-wider mb-1">Acceptance Criteria</h5>
                          <ul className="space-y-1 pl-3 list-disc text-text-dim leading-relaxed">
                            {prd.acceptance_criteria.map((c, j) => <li key={j}>{typeof c === 'string' ? c : c.criterion || JSON.stringify(c)}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* UI Behavior */}
                      {prd?.ui_behavior && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-ai uppercase tracking-wider mb-1">UI / Behavior</h5>
                          <p className="text-text-dim leading-relaxed">{prd.ui_behavior}</p>
                        </div>
                      )}

                      {/* Build Instructions */}
                      {buildInstructions && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-amber uppercase tracking-wider mb-1">Build Instructions</h5>
                          <div className="space-y-1 text-text-dim leading-relaxed">
                            {/* Render whatever keys the LLM actually returned */}
                            {Object.entries(buildInstructions).map(([key, val]) => {
                              if (!val) return null
                              // Convert snake_case / PascalCase to readable label
                              const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase())
                              // Handle nested objects/arrays
                              if (typeof val === 'object') {
                                const text = Array.isArray(val)
                                  ? val.map(v => typeof v === 'string' ? v : v.name || v.file || JSON.stringify(v)).join(', ')
                                  : typeof val === 'string' ? val : JSON.stringify(val, null, 2)
                                return <p key={key}><span className="text-text">{label}:</span> {text}</p>
                              }
                              return <p key={key}><span className="text-text">{label}:</span> {String(val)}</p>
                            })}
                          </div>
                        </div>
                      )}

                      {/* Definition of Done */}
                      {dod?.length > 0 && (
                        <div>
                          <h5 className="text-[9px] font-semibold text-red uppercase tracking-wider mb-1">Definition of Done</h5>
                          <ul className="space-y-1 pl-3 list-disc text-text-dim leading-relaxed">
                            {dod.map((item, j) => <li key={j}>{typeof item === 'string' ? item : item.criterion || item.item || JSON.stringify(item)}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-[10px] text-text-dim/50 py-4 text-center">No PRDs yet. Finalize the discussion to generate them.</p>
          )}

          {/* Doc Submission */}
          <div className="mt-4">
            <h3 className="text-[11px] font-semibold text-text-dim uppercase tracking-wider mb-2">Doc Submission</h3>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-accent/30 transition-colors cursor-pointer">
              <Upload size={16} className="mx-auto text-text-dim/40 mb-1" />
              <p className="text-[10px] text-text-dim">Drop files or click to upload</p>
            </div>
            {submissions.length > 0 && (
              <div className="mt-2 space-y-1">
                {submissions.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface border border-border">
                    <FileText size={10} className="text-text-dim" />
                    <span className="text-[10px] text-text truncate">{s.module}</span>
                    <CheckCircle size={10} className="text-green ml-auto" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
