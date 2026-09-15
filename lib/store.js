// lib/store.js — Braidly persistence (TECH-SPEC §4)
// Supabase-first storage with JSON file fallback

const fs = require('fs');
const path = require('path');

function createStore(dataDir, supabaseClient, sessionId) {
  fs.mkdirSync(dataDir, { recursive: true });
  const messagesFile = path.join(dataDir, 'messages.json');

  let messages = [];
  if (fs.existsSync(messagesFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
      if (Array.isArray(parsed)) messages = parsed;
    } catch (e) {
      console.error('[store] corrupt messages.json — backing up');
      try { fs.renameSync(messagesFile, `${messagesFile}.bak`); } catch (_) {}
    }
  }

  let queue = Promise.resolve();
  function persist() {
    queue = queue.then(() => new Promise((resolve, reject) => {
      fs.writeFile(messagesFile, JSON.stringify(messages, null, 2), err =>
        err ? reject(err) : resolve()
      );
    }));
    return queue;
  }

  return {
    getMessages() { return messages.slice(); },

    async appendMessage(msg) {
      messages.push(msg);

      // Try Supabase if available
      if (supabaseClient && sessionId) {
        try {
          await supabaseClient.from('messages').upsert({
            id: msg.id,
            session_id: sessionId,
            role: msg.role,
            sender: msg.sender || null,
            sender_color: msg.senderColor || null,
            text_content: msg.text || null,
            provider: msg.provider || null,
            client_id: msg.clientId || null,
            ts: msg.ts || Date.now(),
          });
        } catch (err) {
          console.error('[store:supabase] append failed, writing to file:', err.message);
        }
      }

      // Always persist to local file as backup
      return persist();
    },

    async clear() {
      messages = [];

      // Clear Supabase messages for this session
      if (supabaseClient && sessionId) {
        try {
          await supabaseClient
            .from('messages')
            .delete()
            .eq('session_id', sessionId);
        } catch (err) {
          console.error('[store:supabase] clear failed:', err.message);
        }
      }

      return persist();
    },

    // Load messages from Supabase for a given session
    async loadFromSupabase(sid) {
      if (!supabaseClient || !sid) return;
      try {
        const { data, error } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('session_id', sid)
          .order('ts', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          messages = data.map(m => ({
            id: m.id,
            role: m.role,
            sender: m.sender,
            senderColor: m.sender_color,
            text: m.text_content,
            provider: m.provider,
            clientId: m.client_id,
            ts: m.ts,
          }));
          return persist();
        }
      } catch (err) {
        console.error('[store:supabase] load failed:', err.message);
      }
    },
  };
}

module.exports = { createStore };
