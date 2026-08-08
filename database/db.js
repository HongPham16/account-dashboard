const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { hashPassword } = require('../services/passwordService');

function resolveDbPath() {
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }

  // Railway tự cung cấp RAILWAY_VOLUME_MOUNT_PATH khi gắn Volume.
  // Nhờ vậy app không phụ thuộc vào một mount path cố định.
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'app.db');
  }

  // Chạy local: giữ nguyên database trong thư mục database/ như các bản trước.
  return path.join(__dirname, 'app.db');
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

console.log(`[DB] SQLite: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA busy_timeout = 5000');
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function createAccountsTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_data TEXT NOT NULL,
      username TEXT,
      password TEXT,
      twofa_secret TEXT,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','used','archived')),
      claimed_at TEXT,
      claimed_by TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
}

async function migrateAccountsForArchive() {
  const table = await get("SELECT sql FROM sqlite_master WHERE type='table' AND name='accounts'");
  if (!table) {
    await createAccountsTable();
    return;
  }

  const columns = await all('PRAGMA table_info(accounts)');
  const hasArchivedAt = columns.some(c => c.name === 'archived_at');
  const supportsArchived = /archived/i.test(table.sql || '');

  if (supportsArchived && hasArchivedAt) return;

  await run('BEGIN IMMEDIATE TRANSACTION');
  try {
    await run(`
      CREATE TABLE accounts_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_data TEXT NOT NULL,
        username TEXT,
        password TEXT,
        twofa_secret TEXT,
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','used','archived')),
        claimed_at TEXT,
        claimed_by TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    await run(`
      INSERT INTO accounts_v3(id,raw_data,username,password,twofa_secret,status,claimed_at,claimed_by,archived_at,created_at)
      SELECT id,raw_data,username,password,twofa_secret,status,claimed_at,claimed_by,NULL,created_at
      FROM accounts
    `);
    await run('DROP TABLE accounts');
    await run('ALTER TABLE accounts_v3 RENAME TO accounts');
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function initDb() {
  await migrateAccountsForArchive();

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  const defaults = {
    site_title: 'Cài thêm web mới - Quét mã Zalo',
    zalo_url: '#',
    quick_email_base: 'example@gmail.com',
    icloud_email: 'icloud@example.com',
    icloud_password: '',
    icloud_extra1_label: 'Thông tin 1',
    icloud_extra1_value: '',
    icloud_extra2_label: 'Thông tin 2',
    icloud_extra2_value: '',
    group_link: '#',
    video_custom: '#',
    video_normal_60: '#',
    video_normal_5: '#',
    video_normal_180: '#',
    video_lite_10: '#',
    video_lite_60: '#',
    video_lite_5: '#',
    video_lite_180: '#',
    show_accounts: '1',
    show_videos: '1',
    show_quick_email: '1',
    show_icloud: '1',
    show_group: '1',
    section_order: 'accounts,videos,quick_email,icloud,group',
    protect_home: '0',
    mail_reader: 'none',
    mail_reader_api_key: ''
  };

  for (const [key, value] of Object.entries(defaults)) {
    await run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', [key, value]);
  }

  const existingPasswordHash = await get("SELECT value FROM settings WHERE key='access_password_hash'");
  if (!existingPasswordHash || !existingPasswordHash.value) {
    await run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', ['access_password_hash', hashPassword('123456')]);
  }
  await run("DELETE FROM settings WHERE key='access_password'");
}

module.exports = { db, dbPath, run, get, all, initDb };
