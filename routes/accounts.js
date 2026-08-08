const express = require('express');
const {
  addAccounts,
  syncAvailableAccounts,
  listAvailableAccounts,
  listArchivedAccounts,
  restoreArchivedAccount,
  deleteArchivedAccount,
  stats
} = require('../services/accountService');

const router = express.Router();

router.get('/accounts/add', async (req, res, next) => {
  try {
    const accounts = await listAvailableAccounts();
    res.render('add-account', { accounts, message: req.query.message || null, error: null });
  } catch (err) { next(err); }
});

router.post('/accounts/add', async (req, res, next) => {
  try {
    const count = await syncAvailableAccounts(req.body.accounts);
    res.redirect('/accounts/add?message=' + encodeURIComponent(`Đã lưu kho cấp với ${count} tài khoản.`));
  } catch (err) { next(err); }
});


router.get('/accounts/storage', async (req, res, next) => {
  try {
    const accounts = await listArchivedAccounts();
    const summary = await stats();
    res.render('storage', { accounts, summary, message: req.query.message || '' });
  } catch (err) { next(err); }
});

router.post('/accounts/storage/:id/restore', async (req, res, next) => {
  try {
    await restoreArchivedAccount(Number(req.params.id));
    res.redirect('/accounts/storage?message=' + encodeURIComponent('Đã khôi phục tài khoản về kho cấp.'));
  } catch (err) { next(err); }
});

router.post('/accounts/storage/:id/delete', async (req, res, next) => {
  try {
    await deleteArchivedAccount(Number(req.params.id));
    res.redirect('/accounts/storage?message=' + encodeURIComponent('Đã xóa tài khoản khỏi kho lưu trữ.'));
  } catch (err) { next(err); }
});

module.exports = router;
