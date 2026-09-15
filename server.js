// server.js — Braidly Stage 1: the Debate Room (real-time team + AI chat).
// Security posture per GOVERNANCE.md A-rules; persistence per TECH-SPEC §4.
const path = require('path');
// Load .env from THIS script's folder, not the current working directory.
// Previously `dotenv.config()` defaulted to process.cwd(), so starting the
// server from another folder silently ran with no Supabase/AI keys.
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const fs = require('fs');
const express = require('express');
const { WebSocketServer } = require('ws');

const multer = require('multer');
const {
  securityHeaders,
  errorHandler,
  validateChatMessage,
  sanitizeName,
  rateLimiter,
  pickColor,
} = require('./lib/security');

// Sanitize module names: replace spaces with hyphens, strip invalid chars
function sanitizeModuleName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
}
const { createStore } = require('./lib/store');
const { serverClient: supabase, verifyToken, clientForToken, getAnonKey, getSupabaseUrl, isConfigured: isSupabaseConfigured } = require('./lib/supabase');
const { requireAuth, optionalAuth } = require('./lib/auth');
const gateway = require('./llm/gateway');

// ---- Multer config for file uploads ----
const uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 500 * 1024 }, // 500KB max per file
  fileFilter: (req, file, cb) => {
    // Reject node_modules, .env, hidden files
    const name = file.originalname;
    if (name === '.env' || name === 'node_modules' || name.startsWith('.')) {
      return cb(new Error('File not allowed: ' + name));
    }
    cb(null, true);
  },
});

// BRAIDLY_PORT wins; falls back to PORT (the host environment may set PORT=0); else 3000.
console.log('[env] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('[env] SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('[env] SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET');

const PORT = Number(process.env.BRAIDLY_PORT || process.env.PORT) || 3000;
const MAX_HISTORY = Number(process.env.MAX_HISTORY_MESSAGES || 20);
const HEARTBEAT_MS = 30000;
const GENERATION_TIMEOUT_MS = 90000;

// ---------------- HTTP ----------------
const app = express();
app.disable('x-powered-by');
// Behind one proxy hop (Railway edge / Vercel rewrite proxy). Makes req.ip the
// real client IP from X-Forwarded-For so the REST rate limiter buckets per user
// instead of lumping everyone behind the proxy into one bucket.
app.set('trust proxy', 1);
app.use(securityHeaders); // A8/A9: CSP + headers on everything
app.use(express.json({ limit: '50kb' })); // A4: bounded bodies
app.use('/api/', rateLimiter({ windowMs: 60000, max: 300 })); // A10: REST rate limit
// React UI (built from ui/) is the face of the app; public/ kept for legacy assets.
const UI_DIST = path.join(__dirname, 'ui', 'dist');
const UI_BUILT = fs.existsSync(path.join(UI_DIST, 'index.html'));
if (!UI_BUILT) {
  console.warn('[ui] ui/dist not built — run `npm run build:ui`. Serving the legacy vanilla UI from public/ instead.');
}
if (UI_BUILT) app.use(express.static(UI_DIST, { index: false }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ---- Supabase config endpoint (safe: anon key only) ----
app.get('/api/config', (req, res) => {
  // PUBLIC_WS_URL: where browsers should open the WebSocket when the API is
  // reverse-proxied (e.g. Vercel serves the UI and rewrites /api to Railway —
  // but Vercel rewrites can't upgrade WebSockets, so the client connects
  // directly). Accepts wss://host or wss://host/ws; unset = same-origin (local dev).
  let wsUrl = null;
  const rawWs = process.env.PUBLIC_WS_URL;
  if (rawWs) {
    const trimmed = rawWs.trim().replace(/\/+$/, '');
    wsUrl = trimmed.endsWith('/ws') ? trimmed : `${trimmed}/ws`;
  }
  res.json({
    supabase: isSupabaseConfigured() ? { url: getSupabaseUrl(), anonKey: getAnonKey() } : null,
    wsUrl,
  });
});

// Landing page at root, app at /app — React UI when built, legacy vanilla UI otherwise
app.get('/', (req, res) => {
  res.sendFile(UI_BUILT ? path.join(UI_DIST, 'index.html') : path.join(__dirname, 'public', 'landing.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(UI_BUILT ? path.join(UI_DIST, 'index.html') : path.join(__dirname, 'public', 'index.html'));
});

const store = createStore(path.join(__dirname, 'data'));

// ---- Session management ----
const sessionsDir = path.join(__dirname, 'data', 'sessions');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

function getSessionsIndex() {
  const indexPath = path.join(sessionsDir, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch { return []; }
}

function saveSessionsIndex(sessions) {
  fs.writeFileSync(path.join(sessionsDir, 'index.json'), JSON.stringify(sessions, null, 2));
}

// ---- Auth endpoints (Supabase) ----
// Get current user from token
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.user_metadata?.display_name || req.user.email?.split('@')[0] || 'User',
    }
  });
});

// List user's sessions (Supabase or local fallback)
app.get('/api/sessions', optionalAuth, async (req, res) => {
  try {
    // If not authenticated, return empty (landing page before login)
    if (!req.user) {
      return res.json({ sessions: [] });
    }
    // Try Supabase first
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json({ sessions: (data || []).map(s => ({
        id: s.id, title: s.title, members: s.member_names || [],
        messageCount: s.message_count, createdAt: new Date(s.created_at).getTime(),
      })) });
    }
    // Fallback: local files
    const sessions = getSessionsIndex();
    res.json({ sessions });
  } catch (err) {
    console.error('[sessions]', err.message);
    res.json({ sessions: [] });
  }
});

// Create a new session
app.post('/api/sessions', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to create sessions' });
    }
    const { title } = req.body || {};
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: req.user.id,
          title: title || 'New Session',
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      return res.json({ session: { id: data.id, title: data.title, createdAt: new Date(data.created_at).getTime() } });
    }
    // Fallback: local files
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const meta = { id: sessionId, title: title || 'New Session', user_id: req.user.id, createdAt: Date.now() };
    const sessionDir = path.join(sessionsDir, sessionId);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'meta.json'), JSON.stringify(meta, null, 2));
    const sessions = getSessionsIndex();
    sessions.push(meta);
    saveSessionsIndex(sessions);
    res.json({ session: meta });
  } catch (err) {
    console.error('[session:create]', err.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get a specific session
app.get('/api/sessions/:id', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const sessionId = req.params.id;
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', req.user.id)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Session not found' });
      return res.json({
        id: data.id, title: data.title, members: data.member_names || [],
        messageCount: data.message_count, createdAt: new Date(data.created_at).getTime(),
      });
    }
    // Fallback: local files
    const sessionDir = path.join(sessionsDir, sessionId);
    if (!fs.existsSync(sessionDir)) return res.status(404).json({ error: 'Session not found' });
    const metaPath = path.join(sessionDir, 'meta.json');
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
    res.json(meta);
  } catch (err) {
    console.error('[session]', err.message);
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/sessions/:id/messages', optionalAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const sessionDir = path.join(sessionsDir, sessionId);
    const msgsFile = path.join(sessionDir, 'messages.json');
    if (!fs.existsSync(msgsFile)) return res.json({ messages: [] });
    const messages = JSON.parse(fs.readFileSync(msgsFile, 'utf8'));
    res.json({ messages });
  } catch (err) {
    res.json({ messages: [] });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/messages', (req, res) => res.json({ messages: store.getMessages() }));

// ---- Clear Chat: archive current session then wipe messages, briefs, submissions, reports ----
app.post('/api/clear-chat', async (req, res) => {
  try {
    // Archive current session if it has messages
    const currentMessages = store.getMessages();
    if (currentMessages.length > 0 && req.body && req.body.sessionId) {
      const sessionId = req.body.sessionId;
      const sessionDir = path.join(sessionsDir, sessionId);
      if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(path.join(sessionDir, 'messages.json'), JSON.stringify(currentMessages, null, 2));
      // Copy briefs if they exist
      const briefsDir = path.join(__dirname, 'data', 'briefs');
      if (fs.existsSync(briefsDir)) {
        const destBriefs = path.join(sessionDir, 'briefs');
        if (!fs.existsSync(destBriefs)) fs.mkdirSync(destBriefs, { recursive: true });
        for (const f of fs.readdirSync(briefsDir)) {
          fs.copyFileSync(path.join(briefsDir, f), path.join(destBriefs, f));
        }
      }
      // Save session metadata
      const firstHuman = currentMessages.find(m => m.role === 'human');
      const meta = {
        id: sessionId,
        title: firstHuman ? firstHuman.text.slice(0, 80) : 'Untitled Session',
        members: [...new Set(currentMessages.filter(m => m.sender).map(m => m.sender))],
        messageCount: currentMessages.length,
        createdAt: Date.now(),
        archivedAt: Date.now(),
      };
      fs.writeFileSync(path.join(sessionDir, 'meta.json'), JSON.stringify(meta, null, 2));
      // Update sessions index
      const sessions = getSessionsIndex();
      sessions.push(meta);
      saveSessionsIndex(sessions);
      console.log(`[clear-chat] Archived session: ${sessionId} (${currentMessages.length} messages)`);
    }

    // Clear messages (both in-memory and on disk)
    await store.clear();

    // Clear briefs
    const briefsDir = path.join(__dirname, 'data', 'briefs');
    if (fs.existsSync(briefsDir)) {
      for (const f of fs.readdirSync(briefsDir)) {
        fs.unlinkSync(path.join(briefsDir, f));
      }
    }

    // Clear submissions
    const submitDir = path.join(__dirname, 'data', 'submissions');
    if (fs.existsSync(submitDir)) {
      for (const f of fs.readdirSync(submitDir)) {
        const p = path.join(submitDir, f);
        if (fs.statSync(p).isDirectory()) {
          for (const file of fs.readdirSync(p)) fs.unlinkSync(path.join(p, file));
          fs.rmdirSync(p);
        }
      }
    }

    // Clear reports
    const reportsDir = path.join(__dirname, 'data', 'reports');
    if (fs.existsSync(reportsDir)) {
      for (const f of fs.readdirSync(reportsDir)) {
        fs.unlinkSync(path.join(reportsDir, f));
      }
    }

    // Broadcast workspace reset
    broadcast({ type: 'workspace.update', analysis: null, briefs: [] });
    broadcast({ type: 'system.notice', text: 'Chat has been cleared. Starting fresh!' });

    console.log('[clear-chat] All data cleared');
    const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    res.json({ ok: true, newSessionId });
  } catch (err) {
    console.error('[clear-chat]', err.message);
    res.status(500).json({ error: 'Clear failed: ' + err.message });
  }
});

// ---- Stage 2: PRD Factory ----
const prdFactory = require('./lib/prd-factory');
const orchestrator = require('./lib/orchestrator');
app.post('/api/finalize', async (req, res) => {
  try {
    const messages = store.getMessages();
    if (messages.length < 2) {
      return res.status(400).json({ error: 'Not enough discussion to finalize. Send at least a few messages first.' });
    }

    // 1. Analyze the discussion
    console.log('[finalize] Analyzing discussion...');
    const analysis = await prdFactory.analyzeDiscussion(messages);
    console.log('[finalize] Analysis result:', JSON.stringify({ app_name: analysis.app_name, modules_count: analysis.modules?.length }));

    // 2. Build shared contract
    const sharedContract = prdFactory.buildSharedContract(analysis);

    // 3. Generate personal briefs for each module (with delay to avoid rate limits)
    // Sanitize module names (AI may generate names with spaces)
    for (const mod of analysis.modules) {
      mod.name = sanitizeModuleName(mod.name);
    }

    const briefs = [];
    for (let i = 0; i < analysis.modules.length; i++) {
      const mod = analysis.modules[i];
      if (i > 0) {
        console.log(`[finalize] Waiting 3s before generating brief for ${mod.name}...`);
        await new Promise(r => setTimeout(r, 3000));
      }
      const brief = await prdFactory.generatePersonalBrief(
        analysis, mod.name, mod.owner, sharedContract
      );
      const contractJson = prdFactory.buildContractJson(mod.name, mod.owner, brief, sharedContract);
      const contractTest = prdFactory.buildContractTest(mod.name, mod.owner, analysis, sharedContract);
      briefs.push({ module: mod.name, owner: mod.owner, brief, contractJson, contractTest });
    }

    // 4. Save to data/briefs/
    const briefsDir = path.join(__dirname, 'data', 'briefs');
    if (!fs.existsSync(briefsDir)) fs.mkdirSync(briefsDir, { recursive: true });
    const ts = Date.now();
    fs.writeFileSync(path.join(briefsDir, `analysis-${ts}.json`), JSON.stringify(analysis, null, 2));
    fs.writeFileSync(path.join(briefsDir, `contract-${ts}.json`), JSON.stringify(sharedContract, null, 2));
    for (const b of briefs) {
      fs.writeFileSync(path.join(briefsDir, `${b.module}-brief-${ts}.json`), JSON.stringify(b.brief, null, 2));
      fs.writeFileSync(path.join(briefsDir, `${b.module}-contract-${ts}.json`), JSON.stringify(b.contractJson, null, 2));
      fs.writeFileSync(path.join(briefsDir, `${b.module}-test-${ts}.js`), b.contractTest);
    }

    // Broadcast workspace update to all connected clients
    broadcast({ type: 'workspace.update', analysis, briefs: briefs.map(b => ({ module: b.module, owner: b.owner, brief: b.brief })) });

    res.json({ analysis, sharedContract, briefs });
  } catch (err) {
    console.error('[finalize]', err.message);
    res.status(500).json({ error: 'Finalization failed. ' + err.message });
  }
});

// ---- Stage 3: Vibe Coding — Workspace & Submission ----

// Load latest briefs from disk (for new clients joining after finalize)
app.get('/api/briefs', (req, res) => {
  try {
    const briefsDir = path.join(__dirname, 'data', 'briefs');
    if (!fs.existsSync(briefsDir)) return res.json({ briefs: null });
    const files = fs.readdirSync(briefsDir).filter(f => f.startsWith('analysis-'));
    if (files.length === 0) return res.json({ briefs: null });
    const latest = files.sort().pop();
    const ts = latest.replace('analysis-', '').replace('.json', '');
    const analysis = JSON.parse(fs.readFileSync(path.join(briefsDir, `analysis-${ts}.json`), 'utf8'));
    const sharedContract = JSON.parse(fs.readFileSync(path.join(briefsDir, `contract-${ts}.json`), 'utf8'));
    const briefFiles = fs.readdirSync(briefsDir).filter(f => f.endsWith(`-brief-${ts}.json`));
    const briefs = briefFiles.map(f => {
      const module = f.replace(`-brief-${ts}.json`, '');
      const brief = JSON.parse(fs.readFileSync(path.join(briefsDir, f), 'utf8'));
      return { module, brief };
    });
    res.json({ analysis, sharedContract, briefs, timestamp: Number(ts) });
  } catch (err) {
    console.error('[api/briefs]', err.message);
    res.json({ briefs: null });
  }
});

// Submit code files for a module
app.post('/api/submit', (req, res) => {
  try {
    const { module: rawModule, owner, files } = req.body;
    if (!rawModule || !owner || !files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Missing required fields: module, owner, files[]' });
    }
    // Sanitize module name (replace spaces, strip invalid chars)
    const module = sanitizeModuleName(rawModule);
    if (!module) {
      return res.status(400).json({ error: 'Invalid module name' });
    }
    // Validate file count (max 20 files per submission)
    if (files.length > 20) {
      return res.status(400).json({ error: 'Too many files (max 20)' });
    }
    // Save files to data/submissions/<module>/
    const submitDir = path.join(__dirname, 'data', 'submissions', module);
    if (!fs.existsSync(submitDir)) fs.mkdirSync(submitDir, { recursive: true });
    let saved = 0;
    for (const f of files) {
      if (!f.path || typeof f.content !== 'string') continue;
      // Reject node_modules and dangerous paths
      if (f.path.includes('node_modules') || f.path.includes('..')) continue;
      const filePath = path.join(submitDir, f.path);
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, f.content);
      saved++;
    }
    // Save metadata
    const meta = { module, owner, files: files.map(f => f.path), submittedAt: Date.now() };
    fs.writeFileSync(path.join(submitDir, 'submission.json'), JSON.stringify(meta, null, 2));
    console.log(`[submit] ${owner} submitted ${saved} files for module: ${module}`);
    res.json({ ok: true, saved, module });
  } catch (err) {
    console.error('[submit]', err.message);
    res.status(500).json({ error: 'Submission failed: ' + err.message });
  }
});

// List submissions
app.get('/api/submissions', (req, res) => {
  try {
    const submitDir = path.join(__dirname, 'data', 'submissions');
    if (!fs.existsSync(submitDir)) return res.json({ submissions: [] });
    const modules = fs.readdirSync(submitDir).filter(d => {
      const p = path.join(submitDir, d);
      return fs.statSync(p).isDirectory();
    });
    const submissions = modules.map(m => {
      const metaPath = path.join(submitDir, m, 'submission.json');
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
      return { module: m, owner: 'unknown', submittedAt: 0 };
    });
    res.json({ submissions });
  } catch (err) {
    console.error('[submissions]', err.message);
    res.json({ submissions: [] });
  }
});

// ---- Stage 4: File Submission — upload, list, delete ----

// Upload files for a module (multipart form)
app.post('/api/upload', upload.array('files', 20), (req, res) => {
  try {
    const module = sanitizeModuleName(req.body.module);
    const owner = req.body.owner;
    if (!module || !owner) {
      return res.status(400).json({ error: 'Missing module or owner' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const moduleDir = path.join(__dirname, 'data', 'submissions', module);
    if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir, { recursive: true });

    const saved = [];
    for (const file of req.files) {
      const targetPath = path.join(moduleDir, file.originalname);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(file.path, targetPath);
      fs.unlinkSync(file.path); // remove temp file
      saved.push({ name: file.originalname, size: file.size });
    }

    // Update submission metadata
    const existingMeta = path.join(moduleDir, 'submission.json');
    let meta = { module, owner, files: [], submittedAt: Date.now() };
    if (fs.existsSync(existingMeta)) {
      try { meta = JSON.parse(fs.readFileSync(existingMeta, 'utf8')); } catch {}
    }
    meta.files = [...new Set([...meta.files, ...saved.map(f => f.name)])];
    meta.submittedAt = Date.now();
    fs.writeFileSync(existingMeta, JSON.stringify(meta, null, 2));

    console.log(`[upload] ${owner} uploaded ${saved.length} file(s) for module: ${module}`);
    broadcast({ type: 'files.update', module, owner, files: meta.files });
    res.json({ ok: true, saved: saved.length, files: meta.files });
  } catch (err) {
    console.error('[upload]', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// List files in a module
app.get('/api/files/:module', (req, res) => {
  try {
    const module = sanitizeModuleName(req.params.module);
    if (!module) return res.status(400).json({ error: 'Invalid module name' });
    const moduleDir = path.join(__dirname, 'data', 'submissions', module);
    if (!fs.existsSync(moduleDir)) return res.json({ files: [] });

    function listFiles(dir, prefix = '') {
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'submission.json') continue;
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          results.push(...listFiles(path.join(dir, entry.name), relPath));
        } else {
          const stat = fs.statSync(path.join(dir, entry.name));
          results.push({ path: relPath, size: stat.size, modified: stat.mtimeMs });
        }
      }
      return results;
    }

    const files = listFiles(moduleDir);
    res.json({ module, files });
  } catch (err) {
    console.error('[files]', err.message);
    res.json({ files: [] });
  }
});

// Delete a file from a module
app.delete('/api/files/:module/*', (req, res) => {
  try {
    const module = sanitizeModuleName(req.params.module);
    const filePath = req.params[0]; // wildcard match
    if (!module) return res.status(400).json({ error: 'Invalid module name' });
    if (!filePath || filePath.includes('..') || filePath.includes('node_modules')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    const fullPath = path.join(__dirname, 'data', 'submissions', module, filePath);
    // Ensure the path is within the module directory
    const moduleDir = path.join(__dirname, 'data', 'submissions', module);
    if (!fullPath.startsWith(moduleDir)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    fs.unlinkSync(fullPath);
    console.log(`[delete] Deleted ${filePath} from module: ${module}`);
    res.json({ ok: true, deleted: filePath });
  } catch (err) {
    console.error('[delete]', err.message);
    res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

// ---- Stage 5: AI Tech Lead — Integration ----
app.post('/api/integrate', async (req, res) => {
  try {
    console.log('[integrate] Starting integration...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
    
    const report = await orchestrator.integrate(controller.signal);
    clearTimeout(timeout);
    
    // Broadcast report to all clients
    broadcast({ type: 'integration.update', report });
    
    res.json(report);
  } catch (err) {
    console.error('[integrate]', err.message);
    res.status(500).json({ error: 'Integration failed: ' + err.message });
  }
});

// Get latest integration report
app.get('/api/reports', (req, res) => {
  try {
    const reportsDir = path.join(__dirname, 'data', 'reports');
    if (!fs.existsSync(reportsDir)) return res.json({ report: null });
    const files = fs.readdirSync(reportsDir).filter(f => f.startsWith('integration-'));
    if (files.length === 0) return res.json({ report: null });
    const latest = files.sort().pop();
    const report = JSON.parse(fs.readFileSync(path.join(reportsDir, latest), 'utf8'));
    res.json({ report });
  } catch (err) {
    console.error('[reports]', err.message);
    res.json({ report: null });
  }
});

// Load contract for a specific module
app.get('/api/contract/:module', (req, res) => {
  try {
    const module = sanitizeModuleName(req.params.module);
    if (!module) return res.status(400).json({ error: 'Invalid module name' });
    const briefsDir = path.join(__dirname, 'data', 'briefs');
    if (!fs.existsSync(briefsDir)) return res.json({ contract: null });
    const files = fs.readdirSync(briefsDir).filter(f => f.startsWith('analysis-'));
    if (files.length === 0) return res.json({ contract: null });
    const latest = files.sort().pop();
    const ts = latest.replace('analysis-', '').replace('.json', '');
    // Find contract file — match by sanitized module name
    const contractFiles = fs.readdirSync(briefsDir).filter(f => f.endsWith(`-contract-${ts}.json`));
    const contractFile = contractFiles.find(f => {
      const fileModuleName = f.replace(`-contract-${ts}.json`, '');
      return sanitizeModuleName(fileModuleName) === module;
    });
    if (!contractFile) return res.json({ contract: null });
    const contract = JSON.parse(fs.readFileSync(path.join(briefsDir, contractFile), 'utf8'));
    // Also load shared contract
    const sharedContract = JSON.parse(fs.readFileSync(path.join(briefsDir, `contract-${ts}.json`), 'utf8'));
    res.json({ contract, sharedContract });
  } catch (err) {
    console.error('[contract]', err.message);
    res.json({ contract: null });
  }
});

// SPA fallback: any non-API GET serves the React app (client-side views)
app.use((req, res, next) => {
  if (!UI_BUILT) return next();
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(UI_DIST, 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler); // A6: generic errors to client, details to log

const server = http.createServer(app);

// ---------------- WebSocket ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 }); // bounded frames

const members = new Map(); // id -> { id, name, color, online, ws, hits, violations, sessionId }

function broadcast(obj, sessionId) {
  const data = JSON.stringify(obj);
  for (const m of members.values()) {
    if (m.online && m.ws.readyState === 1 && (!sessionId || m.sessionId === sessionId)) m.ws.send(data);
  }
}

function sendTo(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function presenceUpdate(sessionId) {
  broadcast({
    type: 'presence.update',
    members: [...members.values()].filter(m => !sessionId || m.sessionId === sessionId).map(({ id, name, color, online }) => ({ id, name, color, online })),
  }, sessionId);
}

// ---------------- AI facilitator ----------------
let generating = false;
let pending = false;
let activeAbort = null;

async function runFacilitator() {
  if (generating) {
    pending = true;
    return;
  }
  generating = true;
  const history = store
    .getMessages()
    .slice(-MAX_HISTORY)
    .filter((m) => m.role === 'human' || m.role === 'ai')
    .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

  const controller = new AbortController();
  activeAbort = controller;
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(GENERATION_TIMEOUT_MS)]);
  const msgId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const { text, provider } = await gateway.chat({
      messages: history,
      onDelta: (d) => broadcast({ type: 'chat.stream', id: msgId, delta: d }),
      signal,
    });
    const reply = {
      id: msgId,
      role: 'ai',
      sender: 'Braidly',
      senderColor: '#9ece6a',
      text,
      provider,
      ts: Date.now(),
    };
    await store.appendMessage(reply);
    broadcast({ type: 'chat.done', id: msgId, message: reply });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      broadcast({ type: 'chat.done', id: msgId, stopped: true });
    } else {
      console.error('[facilitator]', err.message);
      broadcast({
        type: 'system.notice',
        text: 'Braidly is offline right now — check your API keys or that local Ollama is running.',
      });
      broadcast({ type: 'chat.done', id: msgId, failed: true });
    }
  } finally {
    generating = false;
    activeAbort = null;
    if (pending) {
      pending = false;
      runFacilitator();
    }
  }
}

// ---------------- Connection handling ----------------
wss.on('connection', (ws) => {
  const member = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: null,
    color: pickColor(),
    online: true,
    ws,
    hits: [],
    violations: 0,
    sessionId: null,
  };
  members.set(member.id, member);
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      return sendTo(ws, { type: 'system.notice', text: 'Malformed message.' });
    }
    if (!payload || typeof payload.type !== 'string') {
      return sendTo(ws, { type: 'system.notice', text: 'Malformed message.' });
    }

    switch (payload.type) {
      case 'session.join': {
        const name = sanitizeName(payload.name);
        if (!name) return sendTo(ws, { type: 'system.notice', text: 'Invalid name.' });
        if (member.name) return;
        member.name = name;
        member.sessionId = payload.sessionId || null;
        if (member.sessionId) {
          const sd = path.join(sessionsDir, member.sessionId);
          const mf = path.join(sd, 'messages.json');
          let em = [];
          if (fs.existsSync(mf)) { try { em = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch(e) {} }
          sendTo(ws, { type: 'session.history', messages: em });
        }
        broadcast({ type: 'system.notice', text: name+' joined the room.' }, member.sessionId);
        presenceUpdate(member.sessionId);
        break;
      }
      case 'presence.join': {
        const name = sanitizeName(payload.name);
        if (!name) return sendTo(ws, { type: 'system.notice', text: 'Invalid name.' });
        if (member.name) return; // already joined
        member.name = name;
        broadcast({ type: 'system.notice', text: `${name} joined the room.` });
        presenceUpdate();
        break;
      }

      case 'chat.message': {
        if (!member.name) return sendTo(ws, { type: 'system.notice', text: 'Join with a name first.' });
        // A10 — per-connection anti-flood (10 messages / 10 s; 3 strikes → kicked)
        const now = Date.now();
        member.hits = member.hits.filter((t) => now - t < 10000);
        if (member.hits.length >= 10) {
          member.violations += 1;
          sendTo(ws, { type: 'system.notice', text: 'Slow down — you are sending too fast.' });
          if (member.violations >= 3) ws.close(1008, 'rate limited');
          break;
        }
        member.hits.push(now);

        const v = validateChatMessage({ sender: member.name, text: payload.text, clientId: payload.clientId });
        if (!v.ok) return sendTo(ws, { type: 'system.notice', text: v.error });

        const msg = {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'human',
          sender: member.name,
          senderColor: member.color,
          text: v.text,
          clientId: v.clientId,
          ts: Date.now(),
        };
        store.appendMessage(msg).catch((e) => console.error('[store]', e.message));
        broadcast({ type: 'chat.message', message: msg });
        // AI only responds when someone types /ai (or /ai <prompt>)
        const trimmed = v.text.trim();
        if (trimmed.startsWith('/ai')) {
          // Strip ALL /ai prefixes — user might type /ai /ai ...
          let customPrompt = trimmed;
          while (customPrompt.startsWith('/ai')) customPrompt = customPrompt.slice(3).trim();
          if (customPrompt) {
            // Append custom prompt as a system context before calling AI
            store.appendMessage({
              id: `m-${Date.now()}-ctx`,
              role: 'system',
              text: `[User requested AI help: "${customPrompt}"]`,
              ts: Date.now(),
            });
          }
          runFacilitator();
        }
        break;
      }

      case 'chat.typing': {
        if (!member.name) break;
        for (const m of members.values()) {
          if (m.id !== member.id && m.online && m.ws.readyState === 1) {
            sendTo(m.ws, { type: 'chat.typing', sender: member.name });
          }
        }
        break;
      }

      case 'chat.stop': {
        if (activeAbort) activeAbort.abort();
        break;
      }

      default:
        sendTo(ws, { type: 'system.notice', text: 'Unknown message type.' });
    }
  });

  ws.on('close', () => {
    member.online = false;
    members.delete(member.id);
    if (member.name) {
      broadcast({ type: 'system.notice', text: `${member.name} left the room.` }, member.sessionId);
      presenceUpdate(member.sessionId);
    }
  });

  ws.on('error', () => {
    /* socket errors are expected; nothing to leak to the client */
  });
});

// Heartbeat: detect dead connections so presence stays honest
const heartbeat = setInterval(() => {
  for (const m of members.values()) {
    if (m.ws.isAlive === false) {
      m.ws.terminate();
      continue;
    }
    m.ws.isAlive = false;
    m.ws.ping();
  }
}, HEARTBEAT_MS);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Braidly (Stage 1 — Debate Room) running at http://localhost:${PORT}`);
});
