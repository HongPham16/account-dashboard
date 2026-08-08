require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const { initDb } = require('./database/db');
const { getSettings } = require('./services/settingsService');
const { stats } = require('./services/accountService');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const settingsRoutes = require('./routes/settings');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-session-secret';

if (isProduction && process.env.SESSION_SECRET === 'change-this-session-secret') {
  console.warn('[SECURITY] Hãy đặt SESSION_SECRET riêng trong Railway Variables.');
}

// Railway kết thúc HTTPS ở reverse proxy. trust proxy giúp secure cookie hoạt động đúng.
if (isProduction) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 12
  }
}));

// Healthcheck luôn mở để Railway kiểm tra service mà không bị redirect bởi mật khẩu.
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// /unlock luôn mở để người dùng có thể nhập mật khẩu khi chế độ bảo vệ được bật.
app.use(authRoutes);

// Chỉ chặn truy cập khi người quản trị bật "Bảo vệ bằng mật khẩu" trong Cài đặt.
async function optionalPasswordProtection(req, res, next) {
  try {
    const settings = await getSettings();
    if (settings.protect_home !== '1') return next();
    if (req.session.unlocked) return next();
    return res.redirect('/unlock');
  } catch (err) {
    next(err);
  }
}

app.use(optionalPasswordProtection);
app.use(accountRoutes);
app.use(settingsRoutes);
app.use('/api', apiRoutes);

function makeRandomAlias(baseEmail) {
  const email = String(baseEmail || '').trim();
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  let local = email.slice(0, at).split('+')[0];
  const domain = email.slice(at + 1);
  const suffix = crypto.randomBytes(6).toString('hex');
  return `${local}+${suffix}@${domain}`;
}

app.get('/', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const summary = await stats();
    const order = (settings.section_order || 'accounts,videos,quick_email,icloud,group')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    res.render('index', {
      settings,
      summary,
      order,
      quickEmailAlias: makeRandomAlias(settings.quick_email_base),
      isProtected: settings.protect_home === '1'
    });
  } catch (err) { next(err); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Lỗi hệ thống: ${err.message}`);
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Website đang chạy trên cổng ${PORT}`);
      console.log('Bảo vệ mật khẩu là tùy chọn và được điều khiển trong Cài đặt hệ thống.');
    });
  })
  .catch(err => {
    console.error('Không thể khởi tạo database:', err);
    process.exit(1);
  });
