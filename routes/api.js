const express = require('express');
const crypto = require('crypto');
const { claimAccount, archiveClaimedAccount, stats } = require('../services/accountService');
const { getTotp } = require('../services/totpService');

const router = express.Router();

router.post('/accounts/claim', async (req, res) => {
  try {
    const clientId = req.body.clientId || req.ip || crypto.randomUUID();
    const account = await claimAccount(clientId);
    if (!account) return res.status(404).json({ ok: false, message: 'Kho cấp hiện đã hết tài khoản.' });
    res.json({
      ok: true,
      account: {
        id: account.id,
        raw_data: account.raw_data,
        username: account.username,
        password: account.password,
        has2fa: Boolean(account.twofa_secret),
        twofa_secret: account.twofa_secret || ''
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Không thể lấy tài khoản. Vui lòng thử lại.' });
  }
});

router.post('/accounts/archive', async (req, res) => {
  try {
    const id = Number(req.body.id);
    const clientId = String(req.body.clientId || '');
    if (!Number.isInteger(id) || id <= 0 || !clientId) {
      return res.status(400).json({ ok: false, message: 'Thiếu thông tin tài khoản.' });
    }
    const archived = await archiveClaimedAccount(id, clientId);
    if (!archived) {
      return res.status(409).json({ ok: false, message: 'Không thể đưa tài khoản này vào kho lưu trữ.' });
    }
    res.json({ ok: true, message: 'Đã chuyển tài khoản sang kho lưu trữ riêng.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Không thể chuyển tài khoản vào kho lưu trữ.' });
  }
});

router.post('/totp', (req, res) => {
  const code = getTotp(req.body.secret);
  if (!code) return res.status(400).json({ ok: false, message: 'Secret 2FA không hợp lệ.' });
  const seconds = 30 - (Math.floor(Date.now() / 1000) % 30);
  res.json({ ok: true, code, seconds });
});

router.get('/stats', async (req, res) => res.json({ ok: true, ...(await stats()) }));
module.exports = router;
