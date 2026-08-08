const express = require('express');
const { getSettings } = require('../services/settingsService');
const { verifyPassword } = require('../services/passwordService');
const router = express.Router();

router.get('/unlock', async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (settings.protect_home !== '1') return res.redirect('/');
    if (req.session.unlocked) return res.redirect('/');
    res.render('login', { error: null, siteTitle: settings.site_title });
  } catch (err) { next(err); }
});

router.post('/unlock', async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (settings.protect_home !== '1') return res.redirect('/');
    if (verifyPassword(req.body.password || '', settings.access_password_hash)) {
      req.session.unlocked = true;
      return res.redirect('/');
    }
    res.status(401).render('login', { error: 'Mật khẩu không đúng.', siteTitle: settings.site_title });
  } catch (err) { next(err); }
});

router.post('/lock', (req, res) => {
  req.session.destroy(() => res.redirect('/unlock'));
});

module.exports = router;
