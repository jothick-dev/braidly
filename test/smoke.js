// test/smoke.js — Stage 1 smoke test. Run: node test/smoke.js [wsUrl]
// Verifies: join → presence → chat echo → AI graceful-degradation notice.
'use strict';
const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:3000/ws';
const ws = new WebSocket(url);
const timeout = setTimeout(() => {
  console.error('FAIL: timed out');
  process.exit(1);
}, 15000);

const steps = [];
let clientId = `c-${Date.now()}`;

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'presence.join', name: 'SmokeBot' }));
});

ws.on('message', (raw) => {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  console.log('  <-', msg.type, msg.sender || msg.text || (msg.message && msg.message.text) || '');

  if (msg.type === 'presence.update') {
    const me = msg.members.find((m) => m.name === 'SmokeBot');
    if (me) {
      steps.push('presence: joined as SmokeBot');
      ws.send(JSON.stringify({ type: 'chat.message', text: 'hello braidly', clientId }));
    }
  }
  if (msg.type === 'chat.message' && msg.message && msg.message.clientId === clientId) {
    steps.push('chat: echo received');
    if (msg.message.text !== 'hello braidly') {
      console.error('FAIL: echo text mismatch');
      process.exit(1);
    }
    // send a malformed payload to confirm it is rejected gracefully
    ws.send('not json');
    ws.send(JSON.stringify({ type: 'bogus' }));
  }
  if (msg.type === 'system.notice') {
    // Either the join notice, the malformed notice, or the AI-offline notice — all fine.
    if (msg.text && msg.text.toLowerCase().includes('offline')) steps.push('ai: graceful degradation notice');
  }
  if (msg.type === 'chat.done') {
    steps.push(msg.failed ? 'ai: failed (no keys configured — expected)' : 'ai: reply completed');
    finish();
  }
});

function finish() {
  clearTimeout(timeout);
  ws.close();
  const missing = ['presence: joined as SmokeBot', 'chat: echo received', 'ai: graceful degradation notice'];
  const ok = missing.every((s) => steps.includes(s));
  console.log('\nsteps:', steps.join(' | '));
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
}

ws.on('error', (e) => {
  console.error('FAIL: ws error', e.message);
  process.exit(1);
});
