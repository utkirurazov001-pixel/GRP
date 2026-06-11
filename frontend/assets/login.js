(function () {
  'use strict';
  const { Session } = window.GERPI;

  if (Session.accessToken && Session.user) {
    location.href = '/dashboard.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Tekshirilmoqda…';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error ? body.error.message : 'Xato');
      Session.save(body.data);
      location.href = '/dashboard.html';
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Kirish';
    }
  });
})();
