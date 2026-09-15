import { getSupabase } from './supabase'

async function authHeaders() {
  const sb = getSupabase()
  if (!sb) return {}
  const { data: { session } } = await sb.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function getSessions() {
  const headers = await authHeaders()
  const res = await fetch('/api/sessions', { headers })
  if (!res.ok) return { sessions: [] }
  return res.json()
}

export async function createSession(title) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}

export async function getBriefs() {
  const res = await fetch('/api/briefs')
  if (!res.ok) return { briefs: null }
  return res.json()
}

export async function getSubmissions() {
  const res = await fetch('/api/submissions')
  if (!res.ok) return { submissions: [] }
  return res.json()
}

export async function getContract(module) {
  const res = await fetch(`/api/contract/${encodeURIComponent(module)}`)
  if (!res.ok) return { contract: null }
  return res.json()
}

export async function getMessages() {
  const res = await fetch('/api/messages')
  if (!res.ok) return { messages: [] }
  return res.json()
}

export async function finalizeDiscussion() {
  const res = await fetch('/api/finalize', { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Finalize failed' }))
    throw new Error(err.error || 'Finalize failed')
  }
  return res.json()
}

export async function submitModule(module, owner, files) {
  const headers = { 'Content-Type': 'application/json' }
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers,
    body: JSON.stringify({ module, owner, files }),
  })
  if (!res.ok) throw new Error('Submit failed')
  return res.json()
}

export async function uploadFiles(module, owner, fileList) {
  const formData = new FormData()
  formData.append('module', module)
  formData.append('owner', owner)
  for (const f of fileList) formData.append('files', f)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

export async function runIntegration() {
  const res = await fetch('/api/integrate', { method: 'POST' })
  if (!res.ok) throw new Error('Integration failed')
  return res.json()
}

export async function clearChat(sessionId) {
  const res = await fetch('/api/clear-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  if (!res.ok) throw new Error('Clear failed')
  return res.json()
}
