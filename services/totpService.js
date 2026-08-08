const { authenticator } = require('otplib');

authenticator.options = { step: 30, window: 1 };

function cleanSecret(secret) {
  return String(secret || '').replace(/\s+/g, '').toUpperCase();
}

function getTotp(secret) {
  const clean = cleanSecret(secret);
  if (!clean) return null;
  try {
    return authenticator.generate(clean);
  } catch (_) {
    return null;
  }
}

module.exports = { getTotp };
