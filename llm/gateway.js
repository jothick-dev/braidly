// llm/gateway.js — THE ONLY module in Braidly that calls AI providers.
// (PROJECT.md §4 / instructions.md golden rule 1 — never call a model from anywhere else.)
//
// Routing: Groq (smart) → OpenRouter (fallback on 429/error) → Ollama (local, degraded).
// Streaming is normalized to onDelta(chunk). No API keys and no prompt content are ever
// logged. Prompt content is NOT sent to any training-tier service without warning
// (Gemini/AI Studio is intentionally NOT in the chat path — GOVERNANCE F4).

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const FACILITATOR_SYSTEM = [
  {
    role: 'system',
    content:
      'You are Braidly, the AI facilitator for a small team that is discussing a software app idea before building it. ' +
      'Guide the discussion productively: ask clarifying questions, surface assumptions, note risks and gaps, ' +
      'and when the idea has converged, summarize the agreed scope. Be concise (under ~180 words). ' +
      'Stay helpful, honest, and on-topic.',
  },
];

// ---- OpenAI-compatible streaming (Groq, OpenRouter): SSE "data: {...}" lines ----
async function readSSE(res, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const chunk =
          j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (typeof chunk === 'string' && chunk.length > 0) {
          full += chunk;
          if (onDelta) onDelta(chunk);
        }
      } catch (_) {
        /* ignore keep-alives and partial frames */
      }
    }
  }
  return full;
}

async function groqChat(messages, { onDelta, signal }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'allam-2-7b',
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`groq http ${res.status}`);
  return readSSE(res, onDelta);
}

async function openrouterChat(messages, { onDelta, signal }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const model = process.env.OPENROUTER_MODEL || 'cohere/north-mini-code:free';
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512,
    }),
  });
  if (!res.ok) throw new Error(`openrouter http ${res.status}`);
  return readSSE(res, onDelta);
}

async function ollamaChat(messages, { onDelta, signal }) {
  const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { temperature: 0.7, num_predict: 512 },
    }),
  });
  if (!res.ok) throw new Error(`ollama http ${res.status}`);
  // Ollama streams NDJSON lines: {"message":{"content":"..."},"done":false}
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const j = JSON.parse(line);
        const chunk = j.message && typeof j.message.content === 'string' ? j.message.content : '';
        if (chunk.length > 0) {
          full += chunk;
          if (onDelta) onDelta(chunk);
        }
      } catch (_) {
        /* ignore partial frames */
      }
    }
  }
  return full;
}

/**
 * chat({ messages, onDelta, signal }) → { text, provider }
 * - messages: [{role:'user'|'assistant', content}] — server-built, already validated
 * - onDelta(chunk): called for every streamed token
 * - signal: AbortSignal (stop button); aborts are NOT retried on other providers
 */
async function chat({ messages, onDelta, signal }) {
  const history = FACILITATOR_SYSTEM.concat(messages);
  const attempts = [
    { name: 'groq', fn: groqChat },
    { name: 'openrouter', fn: openrouterChat },
    { name: 'ollama', fn: ollamaChat },
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const text = await a.fn(history, { onDelta, signal });
      return { text, provider: a.name };
    } catch (err) {
      if (err && err.name === 'AbortError') throw err; // user pressed stop — don't fall back
      lastErr = err;
      console.error(`[gateway] ${a.name} failed:`, err.message); // keys/content never logged
    }
  }
  throw lastErr || new Error('all providers failed');
}

// ---- Structured output (Stage 2: PRD Factory) ----

/**
 * extractJSON(content) — robustly extract JSON from LLM output.
 * The model sometimes wraps JSON in markdown fences, adds explanation text,
 * or even returns JavaScript code. This tries multiple strategies.
 */
function extractJSON(content) {
  if (typeof content !== 'string') throw new Error('No content to parse');
  let s = content.trim();
  if (!s) throw new Error('Empty content');

  // 1. Direct parse
  try { return JSON.parse(s); } catch (_) {}

  // 2. Strip markdown code fences
  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

  // 3. Find first { to last } (object)
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(s.slice(firstBrace, lastBrace + 1)); } catch (_) {}
  }

  // 4. Find first [ to last ] (array)
  const firstBracket = s.indexOf('[');
  const lastBracket = s.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try { return JSON.parse(s.slice(firstBracket, lastBracket + 1)); } catch (_) {}
  }

  // 5. Try progressively smaller substrings from first {
  if (firstBrace >= 0) {
    for (let end = lastBrace; end > firstBrace; end--) {
      if (s[end] === '}') {
        try { return JSON.parse(s.slice(firstBrace, end + 1)); } catch (_) {}
      }
    }
  }

  // 6. Handle TRUNCATED JSON — model ran out of tokens mid-output.
  // Try progressively removing trailing incomplete parts until we find valid JSON.
  if (firstBrace >= 0) {
    // Remove trailing incomplete string/array by chopping from the end
    let candidate = s.slice(firstBrace);
    // Strip any trailing text after the last }
    const lastCloseBrace = candidate.lastIndexOf('}');
    if (lastCloseBrace > 0) {
      candidate = candidate.slice(0, lastCloseBrace + 1);
      try { return JSON.parse(candidate); } catch (_) {}
    }
    // Try removing last key-value pair progressively
    // Find each top-level key and try parsing without the last ones
    const keyPattern = /"([^"]+)"\s*:/g;
    const keyPositions = [];
    let m;
    while ((m = keyPattern.exec(candidate)) !== null) {
      keyPositions.push(m.index);
    }
    // Try parsing with progressively fewer trailing keys
    for (let i = keyPositions.length - 1; i >= 1; i--) {
      const cutAt = keyPositions[i];
      // Find the value boundary — go back to the previous comma or open brace
      let trimTo = cutAt;
      while (trimTo > 0 && candidate[trimTo - 1] !== ',' && candidate[trimTo - 1] !== '{') trimTo--;
      if (trimTo > 0) {
        let partial = candidate.slice(0, trimTo);
        // Remove trailing comma if present
        partial = partial.replace(/,\s*$/, '');
        // Close any open structures
        const openBraces = (partial.match(/{/g) || []).length;
        const closeBraces = (partial.match(/}/g) || []).length;
        for (let b = 0; b < openBraces - closeBraces; b++) partial += '}';
        try { return JSON.parse(partial); } catch (_) {}
      }
    }
  }

  throw new Error('Could not extract JSON: ' + s.slice(0, 200));
}

/**
 * sleep(ms) — delay between retries
 */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function groqStructured(messages, { schema, signal }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const jsonInstruction = {
    role: 'system',
    content: 'CRITICAL: You MUST respond with ONLY a single valid JSON object. No code, no markdown, no explanation, no text outside the JSON. Your entire response must start with { and end with }. No imports, no comments, no variable declarations — ONLY the JSON object.',
  };
  const msgs = [jsonInstruction, ...messages];

  // Retry up to 2 times on rate limit (429) with exponential backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 5000; // 5s, 10s backoff
      console.log(`[gateway] groq structured retry ${attempt}/2 after ${delay/1000}s delay...`);
      await sleep(delay);
    }
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'groq/compound-mini',
        messages: msgs,
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });
    if (res.status === 429) {
      console.log('[gateway] groq structured rate limited (429), will retry...');
      continue; // retry
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`groq structured http ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return extractJSON(content);
  }
  throw new Error('groq structured: rate limited after 3 attempts');
}

async function allamStructured(messages, { schema, signal }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const jsonInstruction = {
    role: 'system',
    content: 'CRITICAL: You MUST respond with ONLY a single valid JSON object. No code, no markdown, no explanation, no text outside the JSON. Your entire response must start with { and end with }. No imports, no comments, no variable declarations — ONLY the JSON object.',
  };
  const msgs = [jsonInstruction, ...messages];
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'allam-2-7b',
      messages: msgs,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`allam structured http ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return extractJSON(content);
}

async function openrouterStructured(messages, { schema, signal }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const model = process.env.OPENROUTER_MODEL || 'cohere/north-mini-code:free';
  const jsonInstruction = {
    role: 'system',
    content: 'CRITICAL: You MUST respond with ONLY a single valid JSON object. No code, no markdown, no explanation, no text outside the JSON. Your entire response must start with { and end with }. No imports, no comments, no variable declarations — ONLY the JSON object.',
  };
  const msgs = [jsonInstruction, ...messages];
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: msgs,
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`openrouter structured http ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    // Reasoning models may put content in reasoning field — try to extract JSON from full response
    const fullText = JSON.stringify(data);
    return extractJSON(fullText);
  }
  return extractJSON(content);
}

async function ollamaStructured(messages, { schema, signal }) {
  const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: schema,
      options: { temperature: 0.3, num_predict: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`ollama structured http ${res.status}`);
  const data = await res.json();
  const content = data.message && data.message.content;
  if (typeof content !== 'string') throw new Error('ollama: no content in response');
  return JSON.parse(content);
}

/**
 * structured({ messages, schema, signal }) → parsed JSON object
 * - messages: [{role:'system'|'user', content}] — server-built
 * - schema: JSON Schema object (OpenAI format) for the desired output
 * - signal: AbortSignal
 * Uses json_object on Groq (gpt-oss-20b) + code-side validation.
 */
async function structured({ messages, schema, signal }) {
  const attempts = [
    { name: 'groq', fn: groqStructured },
    { name: 'allam', fn: allamStructured },
    { name: 'openrouter', fn: openrouterStructured },
    { name: 'ollama', fn: ollamaStructured },
  ];
  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    try {
      const result = await a.fn(messages, { schema, signal });
      return { result, provider: a.name };
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      lastErr = err;
      console.error(`[gateway] ${a.name} structured failed:`, err.message);
      // Brief delay before trying next provider
      if (i < attempts.length - 1) await sleep(1000);
    }
  }
  throw lastErr || new Error('all providers failed for structured output');
}

module.exports = { chat, structured };
