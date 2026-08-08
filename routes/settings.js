const express = require('express');
const { getSettings, saveSettings } = require('../services/settingsService');
const { hashPassword } = require('../services/passwordService');

const router = express.Router();

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.render('settings', { settings, saved: req.query.saved === '1' });
  } catch (err) { next(err); }
});

router.post('/settings', async (req, res, next) => {
  try {
    const body = req.body;
    const values = {
      site_title: body.site_title || '',
      zalo_url: body.zalo_url || '#',
      protect_home: body.protect_home ? '1' : '0',
      quick_email_base: body.quick_email_base || '',
      icloud_email: body.icloud_email || '',
      icloud_password: body.icloud_password || '',
      icloud_extra1_label: body.icloud_extra1_label || '',
      icloud_extra1_value: body.icloud_extra1_value || '',
      icloud_extra2_label: body.icloud_extra2_label || '',
      icloud_extra2_value: body.icloud_extra2_value || '',
      group_link: body.group_link || '#',
      video_custom: body.video_custom || '#',
      video_normal_60: body.video_normal_60 || '#',
      video_normal_5: body.video_normal_5 || '#',
      video_normal_180: body.video_normal_180 || '#',
      video_lite_10: body.video_lite_10 || '#',
      video_lite_60: body.video_lite_60 || '#',
      video_lite_5: body.video_lite_5 || '#',
      video_lite_180: body.video_lite_180 || '#',
      show_accounts: body.show_accounts ? '1' : '0',
      show_videos: body.show_videos ? '1' : '0',
      show_quick_email: body.show_quick_email ? '1' : '0',
      show_icloud: body.show_icloud ? '1' : '0',
      show_group: body.show_group ? '1' : '0',
      section_order: body.section_order || 'accounts,videos,quick_email,icloud,group',
      mail_reader: body.mail_reader || 'none',
      mail_reader_api_key: body.mail_reader_api_key || ''
    };
    if (String(body.access_password || '').trim()) {
      values.access_password_hash = hashPassword(String(body.access_password).trim());
    }
    await saveSettings(values);
    if (values.protect_home === '0') req.session.unlocked = false;
    res.redirect('/settings?saved=1');
  } catch (err) { next(err); }
});

module.exports = router;
