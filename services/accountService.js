const { db, all, get, run } = require('../database/db');

function parseAccount(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const parts = text.includes('|')
    ? text.split('|').map(v => v.trim())
    : text.split(/\s+/).map(v => v.trim());
  return {
    raw_data: text,
    username: parts[0] || '',
    password: parts[1] || '',
    twofa_secret: parts[2] || ''
  };
}

async function addAccounts(multiline) {
  const lines = String(multiline || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  let inserted = 0;
  for (const line of lines) {
    const acc = parseAccount(line);
    if (!acc) continue;
    await run(
      `INSERT INTO accounts(raw_data,username,password,twofa_secret,status)
       VALUES(?,?,?,?, 'available')`,
      [acc.raw_data, acc.username, acc.password, acc.twofa_secret]
    );
    inserted++;
  }
  return inserted;
}

function syncAvailableAccounts(multiline) {
  const lines = String(multiline || '')
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(Boolean);

  const parsed = lines.map(parseAccount).filter(Boolean);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', err => {
        if (err) return reject(err);

        db.run("DELETE FROM accounts WHERE status='available'", [], err => {
          if (err) return db.run('ROLLBACK', () => reject(err));

          const stmt = db.prepare(
            `INSERT INTO accounts(raw_data,username,password,twofa_secret,status)
             VALUES(?,?,?,?, 'available')`
          );

          let failed = null;
          for (const acc of parsed) {
            stmt.run([acc.raw_data, acc.username, acc.password, acc.twofa_secret], err => {
              if (err && !failed) failed = err;
            });
          }

          stmt.finalize(err => {
            if (err && !failed) failed = err;
            if (failed) return db.run('ROLLBACK', () => reject(failed));
            db.run('COMMIT', err => err ? reject(err) : resolve(parsed.length));
          });
        });
      });
    });
  });
}

function claimAccount(clientId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', err => {
        if (err) return reject(err);
        db.get(
          `SELECT * FROM accounts WHERE status='available' ORDER BY id ASC LIMIT 1`,
          [],
          (err, row) => {
            if (err) return db.run('ROLLBACK', () => reject(err));
            if (!row) return db.run('COMMIT', e => e ? reject(e) : resolve(null));

            db.run(
              `UPDATE accounts
               SET status='used', claimed_at=datetime('now','localtime'), claimed_by=?, archived_at=NULL
               WHERE id=? AND status='available'`,
              [clientId || 'unknown', row.id],
              function (err) {
                if (err) return db.run('ROLLBACK', () => reject(err));
                if (this.changes !== 1) return db.run('ROLLBACK', () => reject(new Error('Account was claimed concurrently')));
                db.run('COMMIT', e => e ? reject(e) : resolve({ ...row, status: 'used', claimed_by: clientId || 'unknown' }));
              }
            );
          }
        );
      });
    });
  });
}

// "Kho lưu trữ" là kho riêng. Tài khoản chuyển vào đây KHÔNG thể được nút Lấy tài khoản cấp lại.
async function archiveClaimedAccount(id, clientId) {
  const result = await run(
    `UPDATE accounts
     SET status='archived', archived_at=datetime('now','localtime')
     WHERE id=? AND status='used' AND claimed_by=?`,
    [id, clientId]
  );
  return result.changes === 1;
}

async function listAvailableAccounts(limit = 1000) {
  return all(`SELECT * FROM accounts WHERE status='available' ORDER BY id ASC LIMIT ?`, [limit]);
}

async function updateAvailableAccount(id, raw) {
  const acc = parseAccount(raw);
  if (!acc) return false;
  const result = await run(
    `UPDATE accounts
     SET raw_data=?, username=?, password=?, twofa_secret=?
     WHERE id=? AND status='available'`,
    [acc.raw_data, acc.username, acc.password, acc.twofa_secret, id]
  );
  return result.changes === 1;
}

async function deleteAvailableAccount(id) {
  const result = await run("DELETE FROM accounts WHERE id=? AND status='available'", [id]);
  return result.changes === 1;
}

async function listArchivedAccounts(limit = 500) {
  return all(`SELECT * FROM accounts WHERE status='archived' ORDER BY archived_at DESC, id DESC LIMIT ?`, [limit]);
}

async function restoreArchivedAccount(id) {
  const result = await run(
    `UPDATE accounts
     SET status='available', claimed_at=NULL, claimed_by=NULL, archived_at=NULL
     WHERE id=? AND status='archived'`, [id]
  );
  return result.changes === 1;
}

async function deleteArchivedAccount(id) {
  const result = await run("DELETE FROM accounts WHERE id=? AND status='archived'", [id]);
  return result.changes === 1;
}

async function stats() {
  const rows = await all(`SELECT status, COUNT(*) AS c FROM accounts GROUP BY status`);
  const map = Object.fromEntries(rows.map(r => [r.status, r.c]));
  const available = map.available || 0;
  const used = map.used || 0;
  const archived = map.archived || 0;
  return { total: available + used + archived, available, used, archived };
}

module.exports = {
  parseAccount,
  addAccounts,
  syncAvailableAccounts,
  claimAccount,
  archiveClaimedAccount,
  listAvailableAccounts,
  updateAvailableAccount,
  deleteAvailableAccount,
  listArchivedAccounts,
  restoreArchivedAccount,
  deleteArchivedAccount,
  stats
};
