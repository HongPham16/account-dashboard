const { all, run } = require('../database/db');

async function getSettings() {
  const rows = await all('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function saveSettings(values) {
  const entries = Object.entries(values);
  for (const [key, value] of entries) {
    await run(
      `INSERT INTO settings(key,value) VALUES(?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, String(value ?? '')]
    );
  }
}

module.exports = { getSettings, saveSettings };
