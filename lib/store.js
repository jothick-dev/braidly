// lib/store.js — Braidly persistence (TECH-SPEC §4): JSON files on disk with a
// serialized write queue so concurrent writes never corrupt the file.

const fs = require('fs');
const path = require('path');

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const messagesFile = path.join(dataDir, 'messages.json');

  let messages = [];
  if (fs.existsSync(messagesFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
      if (Array.isArray(parsed)) messages = parsed;
    } catch (e) {
      console.error('[store] corrupt messages.json — backing it up and starting fresh');
      try {
        fs.renameSync(messagesFile, `${messagesFile}.bak`);
      } catch (_) {
        /* ignore */
      }
    }
  }

  // Serialized write queue: every write runs after the previous one finishes
  let queue = Promise.resolve();

  function persist() {
    queue = queue.then(
      () =>
        new Promise((resolve, reject) => {
          fs.writeFile(messagesFile, JSON.stringify(messages, null, 2), (err) =>
            err ? reject(err) : resolve()
          );
        })
    );
    return queue;
  }

  return {
    getMessages() {
      return messages.slice();
    },
    appendMessage(msg) {
      messages.push(msg);
      return persist();
    },
    clear() {
      messages = [];
      return persist();
    },
  };
}

module.exports = { createStore };
