// public/app.js — Braidly Debate Room client.
// XSS-safety: all user/AI text is rendered via textContent, never innerHTML.
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const messagesEl = $('#messages');
  const emptyStateEl = $('#empty-state');
  const composerEl = $('#composer');
  const sendBtn = $('#send');
  const stopBtn = $('#stop');
  const membersEl = $('#members');
  const statusEl = $('#status');
  const typingEl = $('#typing');
  const overlayEl = $('#join-overlay');
  const joinForm = $('#join-form');
  const joinNameEl = $('#join-name');

  const STARTER_PROMPTS = [
    'I want to build an app that helps small teams plan their week together.',
    'What questions should we answer before we start coding?',
    'Let\u2019s define the problem we\u2019re solving — who is it for, and what does it save them?',
  ];

  // Read session ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlSessionId = urlParams.get('session');
  if (urlSessionId) {
    localStorage.setItem('braidly.currentSession', urlSessionId);
    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname);
  }
  // If no session in URL and no stored session, create one
  if (!localStorage.getItem('braidly.currentSession')) {
    const newSid = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('braidly.currentSession', newSid);
  }

  // Supabase client for auth tokens
  let sb = null;
  let sbToken = null;

  // Initialize Supabase auth
  async function initSupabase() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      if (cfg.supabase && cfg.supabase.url && cfg.supabase.anonKey) {
        sb = window.supabase.createClient(cfg.supabase.url, cfg.supabase.anonKey);
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
          sbToken = session.access_token;
          name = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || localStorage.getItem('braidly.name') || 'Guest';
          localStorage.setItem('braidly.name', name);
        }
        // Listen for auth changes
        sb.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            sbToken = null;
            window.location.href = '/';
          } else if (session) {
            sbToken = session.access_token;
          }
        });
      }
    } catch {
      // No Supabase — continue with localStorage name
    }
  }

  // Helper: fetch with auth header
  function authFetch(url, opts = {}) {
    if (sbToken) {
      opts.headers = opts.headers || {};
      opts.headers['Authorization'] = 'Bearer ' + sbToken;
    }
    return fetch(url, opts);
  }

  let name = localStorage.getItem('braidly.name') || '';
  let ws = null;
  let reconnectDelay = 1000;
  let members = new Map();
  let streaming = null; // { id, el }
  let pendingMsg = null; // optimistic human message awaiting server echo
  let typingTimer = null;

  // ---------- join ----------
  function showJoin() {
    overlayEl.classList.remove('hidden');
    joinNameEl.focus();
  }

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clean = joinNameEl.value.trim().slice(0, 24);
    if (!clean) return;
    name = clean;
    localStorage.setItem('braidly.name', name);
    overlayEl.classList.add('hidden');
    connect();
  });

  // Initialize Supabase first, then decide auth flow
  initSupabase().then(() => {
    if (sbToken && name) {
      // Logged in via Supabase — skip join overlay
      overlayEl.classList.add('hidden');
      connect();
    } else if (name) {
      // localStorage name only — skip join overlay
      overlayEl.classList.add('hidden');
      connect();
    } else {
      // No auth, no name — show join overlay
      showJoin();
    }
  });

  // ---------- connection ----------
  function setStatus(state, label) {
    statusEl.className = 'status ' + state;
    statusEl.textContent = label;
  }

  function connect() {
    setStatus('reconnecting', 'connecting…');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.addEventListener('open', () => {
      setStatus('online', 'connected');
      reconnectDelay = 1000;
      send({ type: 'presence.join', name });
      loadHistory();
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleServer(msg);
    });

    ws.addEventListener('close', () => {
      setStatus('reconnecting', 'reconnecting…');
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      /* close event follows; nothing to leak */
    });
  }

  function scheduleReconnect() {
    clearTimeout(scheduleReconnect._t);
    scheduleReconnect._t = setTimeout(() => {
      if (name) connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 5000);
  }

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  async function loadHistory() {
    try {
      const res = await authFetch('/api/messages');
      const data = await res.json();
      if (data.messages) {
        messagesEl.innerHTML = '';
        for (const m of data.messages) renderMessage(m);
        maybeShowEmpty();
        scrollToBottom();
      }
    } catch {
      /* history is best-effort; live messages still work */
    }
    // Also load existing briefs for workspace
    loadBriefs();
  }

  async function loadBriefs() {
    try {
      const res = await authFetch('/api/briefs');
      const data = await res.json();
      if (data.briefs && data.briefs.length > 0) {
        showWorkspace(data.analysis, data.briefs);
        // Restore last viewed module on refresh
        const lastModule = localStorage.getItem('braidly.lastModule');
        if (lastModule) {
          const match = data.briefs.find(b => b.module === lastModule);
          if (match) openModule(match);
        }
      }
    } catch {
      /* briefs are best-effort */
    }
  }

  // ---------- rendering (textContent only) ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderMessage(m) {
    if (m.role === 'system') {
      messagesEl.appendChild(el('div', 'msg system', ''));
      const b = el('div', 'bubble', m.text);
      messagesEl.lastChild.appendChild(b);
      return;
    }
    const wrap = el('div', `msg ${m.role === 'ai' ? 'ai' : 'human'}`);
    const meta = el('div', 'meta', m.sender || (m.role === 'ai' ? 'Braidly' : '?'));
    if (m.senderColor) meta.style.color = m.senderColor;
    const bubble = el('div', 'bubble', m.text || '');
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function maybeShowEmpty() {
    emptyStateEl.classList.toggle('hidden', messagesEl.children.length > 0);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------- server events ----------
  function handleServer(msg) {
    switch (msg.type) {
      case 'chat.message': {
        if (pendingMsg && msg.message.clientId && msg.message.clientId === pendingMsg.clientId) {
          pendingMsg.el.classList.remove('failed');
          pendingMsg.el.querySelector('.retry')?.remove();
          pendingMsg = null;
        } else {
          renderMessage(msg.message);
        }
        maybeShowEmpty();
        break;
      }
      case 'chat.stream': {
        if (!streaming || streaming.id !== msg.id) {
          if (streaming) finishStreaming();
          streaming = { id: msg.id, el: renderAIStream(msg.id) };
        }
        const bubble = streaming.el.querySelector('.bubble');
        bubble.textContent += msg.delta;
        scrollToBottom();
        break;
      }
      case 'chat.done': {
        if (streaming && streaming.id === msg.id) {
          if (msg.message && msg.message.text) {
            streaming.el.querySelector('.bubble').textContent = msg.message.text;
          }
          finishStreaming();
        } else if (msg.message && msg.message.text) {
          renderMessage(msg.message);
        }
        maybeShowEmpty();
        break;
      }
      case 'presence.update': {
        members = new Map(msg.members.map((m) => [m.id, m]));
        renderPresence();
        break;
      }
      case 'chat.typing': {
        typingEl.textContent = `${msg.sender} is typing…`;
        typingEl.classList.remove('hidden');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => typingEl.classList.add('hidden'), 2500);
        break;
      }
      case 'workspace.update': {
        showWorkspace(msg.analysis, msg.briefs);
        break;
      }
      case 'files.update': {
        handleFilesUpdate(msg);
        break;
      }
      case 'integration.update': {
        renderReport(msg.report);
        break;
      }
      case 'system.notice': {
        renderMessage({ role: 'system', text: msg.text });
        maybeShowEmpty();
        break;
      }
    }
  }

  function renderAIStream(id) {
    const wrap = el('div', 'msg ai');
    const meta = el('div', 'meta', 'Braidly');
    meta.style.color = '#9ece6a';
    const bubble = el('div', 'bubble', '');
    bubble.appendChild(el('span', 'caret', ''));
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    stopBtn.classList.remove('hidden');
    scrollToBottom();
    return wrap;
  }

  function finishStreaming() {
    if (streaming) {
      const caret = streaming.el.querySelector('.caret');
      if (caret) caret.remove();
      streaming = null;
    }
    stopBtn.classList.add('hidden');
  }

  function renderPresence() {
    membersEl.innerHTML = '';
    const hasSelf = [...members.values()].some((m) => m.name === name);
    const list = [...members.values()];
    if (!hasSelf) list.push({ name, color: '#7aa2f7', online: true });
    for (const m of list) {
      const li = el('li', '');
      li.appendChild(el('span', `dot ${m.online ? 'online' : 'offline'}`, ''));
      li.appendChild(el('span', 'color-swatch', ''));
      li.lastChild.style.background = m.color;
      li.appendChild(el('span', '', m.name));
      membersEl.appendChild(li);
    }
  }

  // ---------- composer ----------
  composerEl.addEventListener('input', () => {
    composerEl.style.height = 'auto';
    composerEl.style.height = Math.min(composerEl.scrollHeight, 140) + 'px';
    send({ type: 'chat.typing' });
  });

  composerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  function sendMessage() {
    const text = composerEl.value.trim();
    if (!text || !name) return;
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // optimistic render with a failure state
    const wrap = el('div', 'msg human');
    const meta = el('div', 'meta', name);
    const bubble = el('div', 'bubble', text);
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    pendingMsg = { clientId, el: wrap };
    maybeShowEmpty();
    scrollToBottom();

    composerEl.value = '';
    composerEl.style.height = 'auto';
    send({ type: 'chat.message', text, clientId });

    // failure fallback if no echo in 5s
    setTimeout(() => {
      if (pendingMsg && pendingMsg.clientId === clientId) {
        bubble.classList.add('failed');
        const retry = el('button', 'retry', 'Retry');
        retry.addEventListener('click', () => {
          retry.remove();
          bubble.classList.remove('failed');
          send({ type: 'chat.message', text, clientId });
        });
        wrap.appendChild(retry);
      }
    }, 5000);
  }

  // ---------- clear chat ----------
  const clearChatBtn = $('#clear-chat-btn');
  clearChatBtn.addEventListener('click', async () => {
    if (!confirm('Clear all messages, briefs, and submissions? This cannot be undone.')) return;
    try {
      const sessionId = localStorage.getItem('braidly.currentSession') || '';
      const res = await authFetch('/api/clear-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error('Clear failed');
      const data = await res.json();
      // Update to new session
      if (data.newSessionId) {
        localStorage.setItem('braidly.currentSession', data.newSessionId);
      }
      // Reset local state
      messagesEl.innerHTML = '';
      workspacePanel.classList.add('hidden');
      workspaceEditor.classList.add('hidden');
      prdView.classList.add('hidden');
      codingBtn.classList.add('hidden');
      moduleAssignment.classList.remove('hidden');
      integratePanel.classList.add('hidden');
      integrationReport.classList.add('hidden');
      currentBriefs = null;
      currentAnalysis = null;
      currentModule = null;
      localStorage.removeItem('braidly.lastModule');
      maybeShowEmpty();
    } catch (err) {
      alert('Failed to clear: ' + err.message);
    }
  });

  // ---------- stop ----------
  stopBtn.addEventListener('click', () => {
    send({ type: 'chat.stop' });
  });

  // ---------- starter prompts ----------
  const promptsEl = $('#starter-prompts');
  for (const p of STARTER_PROMPTS) {
    const btn = el('button', 'prompt', p);
    btn.addEventListener('click', () => {
      composerEl.value = p;
      composerEl.focus();
    });
    promptsEl.appendChild(btn);
  }

  // ---------- workspace (Stage 3: Vibe Coding) ----------
  const workspacePanel = $('#workspace-panel');
  const moduleAssignment = $('#module-assignment');
  const workspaceEditor = $('#workspace-editor');
  const prdView = $('#prd-view');
  const codingBtn = $('#coding-btn');
  const codeEditor = $('#code-editor');
  const readmeEditor = $('#readme-editor');
  const submitBtn = $('#submit-btn');
  const submitStatus = $('#submit-status');
  let currentBriefs = null;
  let currentAnalysis = null;
  let currentModule = null;

  function showWorkspace(analysis, briefs) {
    currentAnalysis = analysis;
    currentBriefs = briefs;
    // If cleared (no analysis), hide everything
    if (!analysis || !briefs || briefs.length === 0) {
      workspacePanel.classList.add('hidden');
      workspaceEditor.classList.add('hidden');
      prdView.classList.add('hidden');
      codingBtn.classList.add('hidden');
      integratePanel.classList.add('hidden');
      return;
    }
    workspacePanel.classList.remove('hidden');
    integratePanel.classList.remove('hidden');
    moduleAssignment.innerHTML = '';
    workspaceEditor.classList.add('hidden');
    prdView.classList.add('hidden');
    codingBtn.classList.add('hidden');

    // Show each module as a card
    for (const b of briefs) {
      const card = el('div', 'module-card');
      card.appendChild(el('h4', '', b.module));
      const desc = (b.brief && b.brief.prd && b.brief.prd.description) || '';
      if (desc) card.appendChild(el('p', '', desc.slice(0, 100) + (desc.length > 100 ? '...' : '')));
      const isAssigned = name && (b.owner === name || (b.brief && b.brief.owner === name));
      if (isAssigned) {
        card.appendChild(el('div', 'assigned', '\u2190 Your module'));
        card.style.borderColor = 'var(--ai)';
      }
      card.addEventListener('click', () => openModule(b));
      moduleAssignment.appendChild(card);
    }
  }

  function openModule(brief) {
    currentModule = brief;
    localStorage.setItem('braidly.lastModule', brief.module);
    // Hide module cards, show back button
    moduleAssignment.classList.add('hidden');
    codingBtn.classList.add('hidden');
    workspaceEditor.classList.add('hidden');

    // Build PRD view in main chat area
    prdView.innerHTML = '';
    prdView.classList.remove('hidden');

    // Header with module name and close button
    const header = el('div', 'prd-header');
    header.appendChild(el('h2', '', brief.module));
    const closeBtn = el('button', 'prd-close', '\u2190 Back to Modules');
    closeBtn.addEventListener('click', closePRD);
    header.appendChild(closeBtn);
    prdView.appendChild(header);

    // Owner
    const owner = brief.owner || (brief.brief && brief.brief.owner) || 'Unassigned';
    const ownerP = el('p', '', 'Owner: ' + owner);
    ownerP.style.color = 'var(--accent)';
    ownerP.style.marginBottom = '12px';
    prdView.appendChild(ownerP);

    const prd = (brief.brief && brief.brief.prd) || (brief.brief && brief.brief.product_requirements_document) || {};

    // Description
    if (prd.description) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Description'));
      sec.appendChild(el('p', '', prd.description));
      prdView.appendChild(sec);
    }

    // User Stories
    if (prd.user_stories) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'User Stories'));
      const ul = el('ul', '');
      const stories = Array.isArray(prd.user_stories) ? prd.user_stories : [];
      for (const s of stories) {
        const text = typeof s === 'string' ? s : (s.as_a ? 'As ' + s.as_a + ', I want ' + s.i_want + (s.so_that ? ' so that ' + s.so_that : '') : JSON.stringify(s));
        ul.appendChild(el('li', '', text));
      }
      sec.appendChild(ul);
      prdView.appendChild(sec);
    }

    // Acceptance Criteria (from contract)
    if (prd.acceptance_criteria && prd.acceptance_criteria.length > 0) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Acceptance Criteria'));
      const ul = el('ul', '');
      for (const c of prd.acceptance_criteria) {
        ul.appendChild(el('li', '', c));
      }
      sec.appendChild(ul);
      prdView.appendChild(sec);
    }

    // Functional Requirements (from contract)
    if (prd.requirements && prd.requirements.functional) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Functional Requirements'));
      const ul = el('ul', '');
      for (const r of prd.requirements.functional) {
        ul.appendChild(el('li', '', r));
      }
      sec.appendChild(ul);
      prdView.appendChild(sec);
    }

    // Non-Functional Requirements (from contract)
    if (prd.requirements && prd.requirements.non_functional) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Non-Functional Requirements'));
      const ul = el('ul', '');
      for (const r of prd.requirements.non_functional) {
        ul.appendChild(el('li', '', r));
      }
      sec.appendChild(ul);
      prdView.appendChild(sec);
    }

    // Build Instructions
    if (brief.brief && brief.brief.build_instructions) {
      const bi = brief.brief.build_instructions;
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Build Instructions'));
      if (bi.file_names) {
        const p = el('p', '', '');
        p.appendChild(el('strong', '', 'Files: '));
        p.appendChild(document.createTextNode(bi.file_names));
        sec.appendChild(p);
      }
      if (bi.file_structure) {
        const p = el('p', '', '');
        p.appendChild(el('strong', '', 'File Structure: '));
        p.appendChild(document.createTextNode(typeof bi.file_structure === 'object' ? Object.keys(bi.file_structure).join(', ') : bi.file_structure));
        sec.appendChild(p);
      }
      if (bi.exported_signatures || bi.exported_entities) {
        const p = el('p', '', '');
        p.appendChild(el('strong', '', 'Required Exports: '));
        p.appendChild(document.createTextNode(bi.exported_signatures || JSON.stringify(bi.exported_entities)));
        sec.appendChild(p);
      }
      if (bi.dependencies || bi.dependency_whitelist) {
        const p = el('p', '', '');
        p.appendChild(el('strong', '', 'Dependencies: '));
        const deps = bi.dependencies || bi.dependency_whitelist;
        p.appendChild(document.createTextNode(Array.isArray(deps) ? deps.join(', ') : deps));
        sec.appendChild(p);
      }
      if (bi.integration_steps && bi.integration_steps.length > 0) {
        const p = el('p', '', '');
        p.appendChild(el('strong', '', 'Integration Steps:'));
        sec.appendChild(p);
        const ol = el('ol', '');
        for (const step of bi.integration_steps) {
          ol.appendChild(el('li', '', step));
        }
        sec.appendChild(ol);
      }
      prdView.appendChild(sec);
    }

    // Definition of Done (full checklist)
    if (brief.brief && brief.brief.definition_of_done) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Definition of Done'));
      const ul = el('ul', '');
      const dod = brief.brief.definition_of_done;
      const checklist = dod.checklist || (Array.isArray(dod) ? dod : []);
      for (const item of checklist) {
        ul.appendChild(el('li', '', item));
      }
      sec.appendChild(ul);
      prdView.appendChild(sec);
    }

    // Risks / Notes
    if (prd.risks && prd.risks.length > 0) {
      const sec = el('div', 'prd-section');
      sec.appendChild(el('h4', '', 'Risks'));
      const ul = el('ul', '');
      for (const r of prd.risks) {
        ul.appendChild(el('li', '', typeof r === 'string' ? r : JSON.stringify(r)));
      }
      sec.appendChild(ul);
      prdView.appendChild(sec);
    }

    // Start Coding button
    const goBtn = el('button', 'prd-go-coding', 'Start Coding \u2192');
    goBtn.addEventListener('click', () => showCoding(brief));
    prdView.appendChild(goBtn);

    // Scroll PRD into view
    prdView.scrollTop = 0;

    // Fetch full contract and append shared contract details
    fetchContract(brief.module).then(contractData => {
      if (!contractData) return;
      const { contract, sharedContract } = contractData;

      // --- Shared Contract Section (only shown once per session) ---
      if (!document.getElementById('shared-contract-section')) {
        const sharedSec = el('div', 'prd-section');
        sharedSec.id = 'shared-contract-section';
        sharedSec.appendChild(el('h3', '', 'Shared Contract (All Modules)'));

        // App name & description
        if (sharedContract.app_name) {
          const p = el('p', '', '');
          p.appendChild(el('strong', '', 'App: '));
          p.appendChild(document.createTextNode(sharedContract.app_name));
          if (sharedContract.description) {
            p.appendChild(document.createTextNode(' — ' + sharedContract.description));
          }
          sharedSec.appendChild(p);
        }

        // Tech Stack
        if (sharedContract.tech_stack) {
          const p = el('p', '', '');
          p.appendChild(el('strong', '', 'Tech Stack: '));
          const ts = sharedContract.tech_stack;
          p.appendChild(document.createTextNode([ts.frontend, ts.backend, ts.database].filter(Boolean).join(' / ')));
          sharedSec.appendChild(p);
        }

        // Data Models
        if (sharedContract.data_models && sharedContract.data_models.length > 0) {
          const p = el('p', '', '');
          p.appendChild(el('strong', '', 'Data Models: '));
          p.appendChild(document.createTextNode(sharedContract.data_models.map(d => d.name + ' (' + d.fields + ')').join(', ')));
          sharedSec.appendChild(p);
        }

        // Security Constitution
        if (sharedContract.security_constitution) {
          const p = el('p', '', '');
          p.appendChild(el('strong', '', 'Security Rules: '));
          p.appendChild(document.createTextNode(Object.entries(sharedContract.security_constitution).map(([k, v]) => k + ': ' + v).join(' | ')));
          p.style.fontSize = '0.85em';
          p.style.color = 'var(--muted)';
          sharedSec.appendChild(p);
        }

        // Do Not Touch
        if (sharedContract.do_not_touch && sharedContract.do_not_touch.length > 0) {
          const p = el('p', '', '');
          p.appendChild(el('strong', '', 'Do Not Touch: '));
          p.appendChild(document.createTextNode(sharedContract.do_not_touch.join(', ')));
          p.style.color = '#f7768e';
          sharedSec.appendChild(p);
        }

        // Insert shared contract section before Start Coding button
        const goCodingBtn = prdView.querySelector('.prd-go-coding');
        if (goCodingBtn) prdView.insertBefore(sharedSec, goCodingBtn);
        else prdView.appendChild(sharedSec);
      }
    }).catch(() => {
      // Contract fetch failed — PRD view still has basic info from brief
    });
  }

  // Fetch contract for a module from the server
  async function fetchContract(moduleName) {
    try {
      const safeName = sanitizeModuleName(moduleName);
      const res = await authFetch('/api/contract/' + encodeURIComponent(safeName));
      const data = await res.json();
      return data.contract ? data : null;
    } catch {
      return null;
    }
  }

  // Sanitize module name: replace spaces with hyphens, strip invalid chars
  function sanitizeModuleName(n) {
    if (!n) return '';
    return n.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function showCoding(brief) {
    prdView.classList.add('hidden');
    codingBtn.classList.add('hidden');
    workspaceEditor.classList.remove('hidden');
    moduleAssignment.classList.remove('hidden');
    codeEditor.value = '';
    readmeEditor.value = '';
    submitStatus.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Code';
    const safeName = sanitizeModuleName(brief.module);
    codeEditor.dataset.module = safeName;
    codeEditor.dataset.owner = brief.owner || (brief.brief && brief.brief.owner) || name;
    loadModuleFiles(safeName);
    codeEditor.focus();
  }

  function closePRD() {
    prdView.classList.add('hidden');
    codingBtn.classList.add('hidden');
    workspaceEditor.classList.add('hidden');
    moduleAssignment.classList.remove('hidden');
    currentModule = null;
    localStorage.removeItem('braidly.lastModule');
  }

  codingBtn.addEventListener('click', () => {
    if (currentModule) showCoding(currentModule);
  });

  submitBtn.addEventListener('click', async () => {
    let module = codeEditor.dataset.module;
    const owner = codeEditor.dataset.owner;
    const content = codeEditor.value.trim();
    const readme = readmeEditor.value.trim();
    // If module not set, try to recover from currentModule
    if (!module && currentModule) {
      module = currentModule.module;
      codeEditor.dataset.module = module;
    }
    if (!module || !content) {
      submitStatus.className = 'submit-status error';
      submitStatus.textContent = !module ? 'Click a module first, then write code.' : 'Write some code first!';
      submitStatus.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    submitStatus.className = 'submit-status';
    submitStatus.textContent = 'Saving to disk...';
    submitStatus.classList.remove('hidden');

    try {
      const files = [{ path: 'index.js', content }];
      if (readme) files.push({ path: 'README.md', content: readme });
      const res = await authFetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          owner,
          files,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      submitStatus.className = 'submit-status success';
      submitStatus.textContent = 'Submitted ' + data.saved + ' file(s) for ' + module + '!';
      submitBtn.textContent = 'Resubmit';
      submitBtn.disabled = false;
      loadModuleFiles(module);
      send({ type: 'chat.message', text: owner + ' submitted module: ' + module });
    } catch (err) {
      submitStatus.className = 'submit-status error';
      submitStatus.textContent = 'Error: ' + err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Code';
    }
  });

  // ---------- file upload (Stage 4) ----------
  const fileInput = $('#file-input');
  const uploadArea = $('#upload-area');
  const uploadStatus = $('#upload-status');
  const fileList = $('#file-list');

  // File input change handler
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    await uploadFiles(fileInput.files);
    fileInput.value = '';
  });

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      await uploadFiles(e.dataTransfer.files);
    }
  });

  async function uploadFiles(fileListObj) {
    const module = codeEditor.dataset.module;
    const owner = codeEditor.dataset.owner;
    if (!module) return;

    uploadStatus.className = 'submit-status';
    uploadStatus.textContent = 'Uploading ' + fileListObj.length + ' file(s)...';
    uploadStatus.classList.remove('hidden');

    const formData = new FormData();
    formData.append('module', module);
    formData.append('owner', owner);
    for (const f of fileListObj) {
      formData.append('files', f);
    }

    try {
      const uploadHeaders = {};
      if (sbToken) uploadHeaders['Authorization'] = 'Bearer ' + sbToken;
      const res = await fetch('/api/upload', { method: 'POST', body: formData, headers: uploadHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      uploadStatus.className = 'submit-status success';
      uploadStatus.textContent = 'Uploaded ' + data.saved + ' file(s)!';
      loadModuleFiles(module);
    } catch (err) {
      uploadStatus.className = 'submit-status error';
      uploadStatus.textContent = 'Error: ' + err.message;
    }
  }

  async function loadModuleFiles(module) {
    try {
      const res = await authFetch('/api/files/' + module);
      const data = await res.json();
      renderFileList(data.files || []);
    } catch {
      fileList.innerHTML = '';
    }
  }

  function renderFileList(files) {
    fileList.innerHTML = '';
    if (!files.length) return;
    for (const f of files) {
      const item = el('div', 'file-item');
      const nameSpan = el('span', 'file-name', f.path);
      const sizeSpan = el('span', 'file-size', formatSize(f.size));
      const delBtn = el('button', 'file-delete', '\u2715');
      delBtn.title = 'Delete file';
      delBtn.addEventListener('click', () => deleteFile(f.path));
      item.appendChild(nameSpan);
      item.appendChild(sizeSpan);
      item.appendChild(delBtn);
      fileList.appendChild(item);
    }
  }

  async function deleteFile(filePath) {
    const module = codeEditor.dataset.module;
    if (!module) return;
    try {
      const res = await authFetch('/api/files/' + module + '/' + encodeURIComponent(filePath), { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadModuleFiles(module);
    } catch (err) {
      uploadStatus.className = 'submit-status error';
      uploadStatus.textContent = 'Delete failed: ' + err.message;
      uploadStatus.classList.remove('hidden');
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Handle files.update from other members
  function handleFilesUpdate(msg) {
    const module = codeEditor.dataset.module;
    if (module && msg.module === module) {
      loadModuleFiles(module);
    }
  }

  // ---------- finalize (Stage 2: PRD Factory) ----------
  const finalizeBtn = $('#finalize-btn');
  const finalizeStatus = $('#finalize-status');

  finalizeBtn.addEventListener('click', async () => {
    finalizeBtn.disabled = true;
    finalizeBtn.textContent = 'Generating…';
    finalizeStatus.className = 'finalize-status';
    finalizeStatus.textContent = 'Analyzing discussion and generating briefs…';
    finalizeStatus.classList.remove('hidden');

    try {
      const res = await authFetch('/api/finalize', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        finalizeStatus.className = 'finalize-status error';
        finalizeStatus.textContent = 'Error: ' + (data.error || 'Unknown error');
        finalizeBtn.disabled = false;
        finalizeBtn.textContent = 'Finalize Discussion';
        return;
      }

      finalizeStatus.className = 'finalize-status success';
      finalizeStatus.textContent = `Generated ${data.briefs.length} brief(s) for: ${data.briefs.map((b) => b.owner).join(', ')}`;

      // Show workspace with module assignments
      showWorkspace(data.analysis, data.briefs.map(b => ({ module: b.module, owner: b.owner, brief: b.brief })));

      finalizeBtn.textContent = 'Regenerate';
      finalizeBtn.disabled = false;
    } catch (err) {
      finalizeStatus.className = 'finalize-status error';
      finalizeStatus.textContent = 'Network error: ' + err.message;
      finalizeBtn.disabled = false;
      finalizeBtn.textContent = 'Finalize Discussion';
    }
  });

  // ---------- integrate (Stage 5: AI Tech Lead) ----------
  const integrateBtn = $('#integrate-btn');
  const integrateStatus = $('#integrate-status');
  const integratePanel = $('#integrate-panel');
  const integrationReport = $('#integration-report');
  const reportSummary = $('#report-summary');
  const reportModules = $('#report-modules');

  // Show integrate panel when workspace is visible
  const origShowWorkspace = showWorkspace;
  // We need to show the integrate panel when briefs exist
  function checkShowIntegrate() {
    if (currentBriefs && currentBriefs.length > 0) {
      integratePanel.classList.remove('hidden');
    }
  }

  // Also check on load
  async function loadReport() {
    try {
      const res = await authFetch('/api/reports');
      const data = await res.json();
      if (data.report) renderReport(data.report);
    } catch { /* no report yet */ }
  }

  integrateBtn.addEventListener('click', async () => {
    integrateBtn.disabled = true;
    integrateBtn.textContent = 'Integrating...';
    integrateStatus.className = 'finalize-status';
    integrateStatus.textContent = 'Running verification, security scans, and tests...';
    integrateStatus.classList.remove('hidden');

    try {
      const res = await authFetch('/api/integrate', { method: 'POST' });
      const data = await res.json();

      if (!res.ok && !data.overall_status) {
        integrateStatus.className = 'finalize-status error';
        integrateStatus.textContent = 'Error: ' + (data.error || 'Unknown error');
        integrateBtn.disabled = false;
        integrateBtn.textContent = 'Integrate Modules';
        return;
      }

      integrateStatus.className = 'finalize-status success';
      integrateStatus.textContent = `Integration complete: ${data.overall_status.toUpperCase()}`;
      integrateBtn.disabled = false;
      integrateBtn.textContent = 'Re-Integrate';

      renderReport(data);
    } catch (err) {
      integrateStatus.className = 'finalize-status error';
      integrateStatus.textContent = 'Network error: ' + err.message;
      integrateBtn.disabled = false;
      integrateBtn.textContent = 'Integrate Modules';
    }
  });

  function renderReport(report) {
    integrationReport.classList.remove('hidden');
    reportSummary.innerHTML = '';
    reportModules.innerHTML = '';

    // Summary stats
    const s = report.summary || {};
    const stats = [
      { label: 'Total', value: s.total || 0, cls: '' },
      { label: 'Passed', value: s.passed || 0, cls: 'pass' },
      { label: 'Fixed', value: s.fixed || 0, cls: 'pass' },
      { label: 'Failed', value: s.failed || 0, cls: 'fail' },
      { label: 'Missing', value: s.missing || 0, cls: 'miss' },
      { label: 'Warnings', value: s.warnings || 0, cls: 'warn' },
    ];
    for (const stat of stats) {
      const div = el('div', `report-stat ${stat.cls}`);
      div.appendChild(el('strong', '', String(stat.value)));
      div.appendChild(document.createTextNode(stat.label));
      reportSummary.appendChild(div);
    }

    // Module details
    if (!report.modules) return;
    for (const mod of report.modules) {
      const card = el('div', 'report-module');

      // Header
      const header = el('div', 'module-header');
      header.appendChild(el('span', 'module-name', mod.module));
      header.appendChild(el('span', `module-status ${mod.status}`, mod.status.toUpperCase()));
      card.appendChild(header);

      // Owner
      card.appendChild(el('div', '', 'Owner: ' + mod.owner));

      // Issues
      if (mod.issues && mod.issues.length > 0) {
        const issuesDiv = el('div', 'module-issues');
        for (const issue of mod.issues) {
          const issueEl = el('div', `issue-item ${issue.severity}`);
          const ruleTag = el('span', 'issue-rule', issue.rule);
          issueEl.appendChild(ruleTag);
          issueEl.appendChild(document.createTextNode(' ' + issue.desc));
          issuesDiv.appendChild(issueEl);
        }
        card.appendChild(issuesDiv);
      }

      // Test result
      if (mod.testResult && !mod.testResult.skipped) {
        const testDiv = el('div', 'issue-item');
        testDiv.appendChild(document.createTextNode(
          `Tests: ${mod.testResult.passed} passed, ${mod.testResult.failed} failed`
        ));
        card.appendChild(testDiv);
      }

      // AI fixes
      if (mod.aiFixes && mod.aiFixes.fixes && mod.aiFixes.fixes.length > 0) {
        const fixDiv = el('div', 'issue-item');
        fixDiv.appendChild(el('span', 'issue-rule', 'AI FIX'));
        fixDiv.appendChild(document.createTextNode(' ' + mod.aiFixes.summary));
        card.appendChild(fixDiv);
      }

      reportModules.appendChild(card);
    }

    // Show in chat as a system message
    renderMessage({
      role: 'system',
      text: `Integration report: ${report.overall_status.toUpperCase()} — ${s.passed || 0} passed, ${s.fixed || 0} fixed, ${s.failed || 0} failed, ${s.missing || 0} missing`
    });
    maybeShowEmpty();
  }

  // Handle integration.update from WebSocket
  // (already handled in handleServer via the integration.update case)

  // Check if we should show integrate panel on load
  setTimeout(checkShowIntegrate, 500);
  loadReport();
})();
