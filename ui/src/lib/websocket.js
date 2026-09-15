let ws = null
let reconnectTimer = null
let listeners = {}
let statusListeners = []
let connectionStatus = 'disconnected' // connected | reconnecting | disconnected
let currentSessionId = null

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

export function connect(userName, sessionId) {
  if (ws && ws.readyState <= 1) return
  currentSessionId = sessionId || null

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    connectionStatus = 'connected'
    notifyStatus()
    ws.send(JSON.stringify({ type: sessionId ? 'session.join' : 'presence.join', name: userName, sessionId: sessionId || undefined }))
    // Replay any pending messages
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      const handlers = listeners[data.type] || []
      handlers.forEach(fn => fn(data))
    } catch {}
  }

  ws.onclose = () => {
    connectionStatus = 'disconnected'
    notifyStatus()
    // Auto-reconnect after 3s
    if (reconnectTimer) clearTimeout(reconnectTimer)
    connectionStatus = 'reconnecting'
    notifyStatus()
    reconnectTimer = setTimeout(() => connect(userName, currentSessionId), 3000)
  }

  ws.onerror = () => {
    connectionStatus = 'disconnected'
    notifyStatus()
  }
}

export function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws) {
    ws.onclose = null
    ws.close()
    ws = null
  }
  connectionStatus = 'disconnected'
  currentSessionId = null
  notifyStatus()
}

export function send(payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload))
  }
}

export function sendChat(text, clientId) {
  send({ type: 'chat.message', text, clientId })
}

export function sendTyping() {
  send({ type: 'chat.typing' })
}

export function stopGeneration() {
  send({ type: 'chat.stop' })
}

export function on(type, fn) {
  if (!listeners[type]) listeners[type] = []
  listeners[type].push(fn)
  return () => {
    listeners[type] = listeners[type].filter(f => f !== fn)
  }
}

export function onStatus(fn) {
  statusListeners.push(fn)
  fn(connectionStatus)
  return () => {
    statusListeners = statusListeners.filter(f => f !== fn)
  }
}

function notifyStatus() {
  statusListeners.forEach(fn => fn(connectionStatus))
}

export function getConnectionStatus() {
  return connectionStatus
}
