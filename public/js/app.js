(() => {
  const toast = document.getElementById('toast');
  let currentSecret = '';
  let totpTimer = null;
  let currentAccountId = null;

  function notify(text, type = 'default') {
    if (!toast) return;
    toast.textContent = text;
    toast.dataset.type = type;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function clientId() {
    let id = localStorage.getItem('client_id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      localStorage.setItem('client_id', id);
    }
    return id;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Đã sao chép', 'success');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      notify('Đã sao chép', 'success');
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const el = document.querySelector(btn.dataset.copy);
    if (el) copyText(el.textContent.trim());
  });

  async function refreshTotp() {
    if (!currentSecret) return;
    try {
      const r = await fetch('/api/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: currentSecret })
      });
      const data = await r.json();
      if (!data.ok) return;
      const codeEl = document.getElementById('rTotp');
      const timeEl = document.getElementById('rTotpTime');
      if (codeEl) codeEl.textContent = data.code;
      if (timeEl) timeEl.textContent = `còn ${data.seconds}s`;
    } catch (_) {}
  }

  function startTotp(secret) {
    currentSecret = secret || '';
    clearInterval(totpTimer);
    if (!currentSecret) return;
    refreshTotp();
    totpTimer = setInterval(refreshTotp, 1000);
  }

  function updateStock(deltaAvailable = 0, deltaArchived = 0, deltaUsed = 0) {
    const available = document.getElementById('availableCount');
    const archived = document.getElementById('archiveCount');
    const used = document.getElementById('usedCount');
    const stockText = document.getElementById('stockText');
    if (available) available.textContent = Math.max(0, Number(available.textContent || 0) + deltaAvailable);
    if (archived) archived.textContent = Math.max(0, Number(archived.textContent || 0) + deltaArchived);
    if (used) used.textContent = Math.max(0, Number(used.textContent || 0) + deltaUsed);
    if (stockText && available) stockText.textContent = `${available.textContent} tài khoản khả dụng`;
  }

  const claimBtn = document.getElementById('claimBtn');
  const archiveBtn = document.getElementById('archiveBtn');

  if (claimBtn) {
    claimBtn.addEventListener('click', async () => {
      claimBtn.disabled = true;
      const old = claimBtn.textContent;
      claimBtn.textContent = 'Đang lấy tài khoản...';
      try {
        const r = await fetch('/api/accounts/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientId() })
        });
        const data = await r.json();
        if (!data.ok) throw new Error(data.message || 'Không thể lấy tài khoản');

        const a = data.account;
        currentAccountId = a.id;
        document.getElementById('accountEmpty')?.classList.add('hidden');
        document.getElementById('accountResult')?.classList.remove('hidden');
        document.getElementById('rUsername').textContent = a.username || '-';
        document.getElementById('rPassword').textContent = a.password || '-';
        document.getElementById('rRaw').textContent = a.raw_data || '-';
        const twofaRow = document.getElementById('twofaRow');
        if (a.has2fa) {
          twofaRow?.classList.remove('hidden');
          startTotp(a.twofa_secret);
        } else {
          twofaRow?.classList.add('hidden');
          startTotp('');
        }
        archiveBtn?.classList.remove('hidden');
        updateStock(-1, 0, 1);
        notify('Đã cấp tài khoản', 'success');
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        claimBtn.disabled = false;
        claimBtn.textContent = old;
      }
    });
  }

  if (archiveBtn) {
    archiveBtn.addEventListener('click', async () => {
      if (!currentAccountId) return;
      if (!confirm('Đưa tài khoản vừa lấy vào KHO LƯU TRỮ RIÊNG? Tài khoản sẽ không được cấp lại tự động.')) return;
      archiveBtn.disabled = true;
      const old = archiveBtn.textContent;
      archiveBtn.textContent = 'Đang chuyển...';
      try {
        const r = await fetch('/api/accounts/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentAccountId, clientId: clientId() })
        });
        const data = await r.json();
        if (!data.ok) throw new Error(data.message || 'Không thể chuyển tài khoản');
        currentAccountId = null;
        startTotp('');
        document.getElementById('accountResult')?.classList.add('hidden');
        document.getElementById('accountEmpty')?.classList.remove('hidden');
        archiveBtn.classList.add('hidden');
        updateStock(0, 1, -1);
        notify('Đã chuyển sang kho lưu trữ riêng', 'success');
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        archiveBtn.disabled = false;
        archiveBtn.textContent = old;
      }
    });
  }
})();
