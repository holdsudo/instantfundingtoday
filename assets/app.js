/* Instant Funding Today — front-end. No dependencies, nothing typed is stored in the browser. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The live API. A ?api= override is honoured ONLY on localhost, for testing against a mock.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const base = (local && new URLSearchParams(location.search).get('api')) || 'https://api.instantfundingtoday.net';
  const ENDPOINT = base.replace(/\/$/, '') + '/api/applications';

  const fmtMoney = (v) => { const d = String(v).replace(/[^\d]/g, ''); return d ? Number(d).toLocaleString('en-US') : ''; };
  const digits = (v) => String(v).replace(/[^\d]/g, '');
  const short = (n) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + n);
  $('[data-year]') && ($('[data-year]').textContent = new Date().getFullYear());

  /* ---------- shared state (the request) ---------- */
  const DEFAULT_AMOUNT = 250000, MIN = 10000, MAX = 1000000;
  const state = { amount: DEFAULT_AMOUNT, uses: new Set(['Payroll']), business: '' };

  /* ---------- amount in words ---------- */
  const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const chunk = (n) => {
    let out = '';
    if (n >= 100) { out += ONES[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n) out += ' '; }
    if (n >= 20) { out += TENS[Math.floor(n / 10)]; if (n % 10) out += '-' + ONES[n % 10]; } else if (n > 0) out += ONES[n];
    return out;
  };
  const words = (v) => {
    const n = Math.min(Math.floor(Number(v) || 0), 999999999999);
    if (n <= 0) return 'Zero';
    const parts = [];
    const b = Math.floor(n / 1e9), m = Math.floor((n % 1e9) / 1e6), t = Math.floor((n % 1e6) / 1e3), r = n % 1e3;
    if (b) parts.push(chunk(b) + ' billion'); if (m) parts.push(chunk(m) + ' million'); if (t) parts.push(chunk(t) + ' thousand'); if (r) parts.push(chunk(r));
    const txt = parts.join(' ');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };
  const now = new Date();
  const ymd = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  $$('[data-date]').forEach((el) => { el.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); });

  /* ---------- header ---------- */
  const top = $('[data-top]');
  const onScroll = () => top && top.classList.toggle('is-stuck', !$('.hero') || window.scrollY > 6);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- reveal ---------- */
  const rev = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const sibs = [...e.target.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
      e.target.style.setProperty('--d', Math.min(sibs.indexOf(e.target), 5) * 0.08 + 's');
      e.target.classList.add('is-in'); io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rev.forEach((el) => io.observe(el));
  } else rev.forEach((el) => el.classList.add('is-in'));

  /* ---------- the route: a line that fills as you read ---------- */
  const rail = $('[data-rail]');
  if (rail) {
    const steps = $$('.rstep', rail);
    const upd = () => {
      const r = rail.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.6 - r.top) / r.height));
      rail.style.setProperty('--p', p.toFixed(3));
      steps.forEach((st) => st.classList.toggle('is-lit', st.offsetTop + 17 <= p * rail.offsetHeight));
    };
    upd(); window.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd);
  }

  /* ---------- the draft (hero) ---------- */
  const heroForm = $('[data-hero-form]');
  const heroNum = $('#hero-amount-num');
  const heroRange = $('[data-hero-range]');
  const heroName = $('#hero-name');

  const setFill = () => { if (!heroRange) return; const p = ((Math.min(Math.max(state.amount, MIN), MAX) - MIN) / (MAX - MIN)) * 100; heroRange.style.setProperty('--fill', p + '%'); };
  function syncAmount(from) {
    const f = fmtMoney(state.amount);
    if (heroNum && from !== 'hero-num') heroNum.value = f;
    if (heroRange && from !== 'range') heroRange.value = Math.min(MAX, Math.max(MIN, state.amount || MIN));
    $$('[data-words]').forEach((el) => { el.textContent = words(state.amount); });
    $$('[data-micr]').forEach((el) => { el.textContent = '⑆ ' + ymd + ' ⑆ ' + String(state.amount || 0).padStart(10, '0') + ' ⑈'; });
    const fa = $('#f-requestedAmount'); if (fa && from !== 'form') fa.value = f;
    setFill(); renderMini();
  }
  if (heroNum) heroNum.addEventListener('input', () => { state.amount = Number(digits(heroNum.value)) || 0; heroNum.value = fmtMoney(heroNum.value); syncAmount('hero-num'); });
  if (heroRange) heroRange.addEventListener('input', () => { state.amount = Number(heroRange.value); syncAmount('range'); });
  if (heroName) heroName.addEventListener('input', () => {
    state.business = heroName.value;
    const fb = $('#f-legalBusinessName'); if (fb) fb.value = heroName.value;
    renderMini();
  });

  const useGroups = $$('[data-hero-uses], [data-form-uses]');
  function paintUses() { useGroups.forEach((g) => $$('.chip', g).forEach((c) => c.setAttribute('aria-pressed', String(state.uses.has(c.dataset.use))))); }
  useGroups.forEach((g) => g.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    state.uses.has(c.dataset.use) ? state.uses.delete(c.dataset.use) : state.uses.add(c.dataset.use);
    paintUses(); renderMini();
  }));

  // A whisper of tilt on the draft (fine pointers only)
  if (heroForm && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    heroForm.addEventListener('pointermove', (e) => {
      const r = heroForm.getBoundingClientRect();
      heroForm.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 2.4).toFixed(2) + 'deg');
      heroForm.style.setProperty('--rx', ((.5 - (e.clientY - r.top) / r.height) * 2.4).toFixed(2) + 'deg');
    });
    heroForm.addEventListener('pointerleave', () => { heroForm.style.removeProperty('--rx'); heroForm.style.removeProperty('--ry'); });
  }
  if (heroForm) heroForm.addEventListener('submit', (e) => e.preventDefault());
  $('[data-hero-go]')?.addEventListener('click', () => setTimeout(() => {
    const target = state.business ? $('#f-requestedAmount') : $('#f-requestedAmount');
    target?.focus({ preventScroll: true });
  }, 700));

  /* ---------- the application ---------- */
  const form = $('[data-app-form]');
  if (!form) return;
  const parts = $$('[data-part]', form);
  const segs = $$('.p-seg');
  const label = $('[data-progress-label]');
  const nextBtn = $('[data-next]'), backBtn = $('[data-back]'), submitBtn = $('[data-submit]');
  const msg = $('[data-form-msg]');
  let step = 0;

  // States
  const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  $('#f-businessState').insertAdjacentHTML('beforeend', STATES.map((s) => `<option>${s}</option>`).join(''));

  // Money inputs format as you type
  $$('.money input', form).forEach((i) => i.addEventListener('input', () => { i.value = fmtMoney(i.value); }));
  $('#f-requestedAmount').addEventListener('input', (e) => { state.amount = Number(digits(e.target.value)) || 0; syncAmount('form'); });
  const phone = $('#f-ownerPhone');
  phone.addEventListener('input', () => {
    const d = digits(phone.value).slice(0, 10);
    phone.value = d.length > 6 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0,3)}) ${d.slice(3)}` : d;
  });

  const val = (n) => (form.elements[n]?.value || '').trim();
    function renderMini() {
    const set = (k, v) => { const el = $(`[data-mini="${k}"]`); if (el) el.textContent = v || '—'; };
    set('amount', state.amount ? '$' + fmtMoney(state.amount) : '—');
    set('words', state.amount ? words(state.amount) + ' and 00/100 dollars' : '');
    set('uses', [...state.uses].join(', '));
    set('business', val('legalBusinessName'));
    set('owner', val('ownerFullName'));
  }
  form.addEventListener('input', (e) => {
    if (e.target.name === 'legalBusinessName') { state.business = e.target.value; if (heroName) heroName.value = e.target.value; }
    renderMini();
  });

  function setErr(name, text) {
    const el = $(`[data-err-for="${name}"]`, form); if (el) el.textContent = text || '';
    const input = form.elements[name];
    input?.closest?.('.f')?.classList.toggle('is-bad', !!text);
    if (input) input.setAttribute('aria-invalid', text ? 'true' : 'false');
  }
  form.addEventListener('input', (e) => { if (e.target.name) setErr(e.target.name, ''); if (e.target.name === 'ownerPhone' || e.target.name === 'ownerEmail') { setErr('ownerPhone', ''); setErr('ownerEmail', ''); } });

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validate(i) {
    let bad = null;
    const need = (name, text) => { if (!val(name)) { setErr(name, text); bad = bad || form.elements[name]; } };
    if (i === 0) { if (!(Number(digits(val('requestedAmount'))) > 0)) { setErr('requestedAmount', 'Enter the amount you are requesting.'); bad = form.elements.requestedAmount; } }
    if (i === 1) need('legalBusinessName', 'Enter your legal business name.');
    if (i === 2) {
      need('ownerFullName', "Enter the owner's full name.");
      const p = digits(val('ownerPhone')), e = val('ownerEmail');
      if (!p && !e) { setErr('ownerPhone', 'Add a phone number or an email.'); setErr('ownerEmail', 'Add a phone number or an email.'); bad = bad || form.elements.ownerPhone; }
      else {
        if (p && p.length < 10) { setErr('ownerPhone', 'Enter a 10-digit phone number.'); bad = bad || form.elements.ownerPhone; }
        if (e && !EMAIL.test(e)) { setErr('ownerEmail', 'Enter a valid email address.'); bad = bad || form.elements.ownerEmail; }
      }
    }
    if (i === 4) {
      const ok = form.elements.accuracyConsent.checked && form.elements.contactConsent.checked;
      setErr('consent', ok ? '' : 'Please tick both boxes to submit your request.');
      if (!ok) bad = form.elements.accuracyConsent;
    }
    return bad;
  }

  const TITLES = ['The ask', 'The business', 'The owner', 'Finances', 'Review & send'];
  const NEXT = ['Next: The business', 'Next: The owner', 'Next: Finances', 'Next: Review', ''];
  function recap() {
    const rows = [
      ['Requesting', '$' + fmtMoney(state.amount)], ['For', [...state.uses].join(', ') + (val('useNotes') ? ' — ' + val('useNotes') : '')],
      ['Business', val('legalBusinessName') + (val('dbaName') ? ` (DBA ${val('dbaName')})` : '')],
      ['Location', [val('businessCity'), val('businessState')].filter(Boolean).join(', ')],
      ['Owner', val('ownerFullName') + (val('ownerTitle') ? `, ${val('ownerTitle')}` : '')],
      ['Phone', val('ownerPhone')], ['Email', val('ownerEmail')],
      ['Monthly revenue', val('averageMonthlyRevenue') ? '$' + val('averageMonthlyRevenue') : ''],
    ].filter(([, v]) => v && v.trim());
    const dl = $('[data-recap]');
    dl.textContent = '';
    rows.forEach(([k, v]) => { const d = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.append(d); });
  }
  function go(n, focus = true) {
    step = Math.max(0, Math.min(parts.length - 1, n));
    parts.forEach((p, i) => { p.hidden = i !== step; p.classList.toggle('is-active', i === step); });
    segs.forEach((s, i) => { s.classList.toggle('is-on', i === step); s.classList.toggle('is-done', i < step); });
    label.textContent = `Part ${step + 1} of ${parts.length} · ${TITLES[step]}`;
    $('[data-mini-step]').textContent = `${step + 1}/${parts.length}`;
    backBtn.hidden = step === 0;
    const last = step === parts.length - 1;
    nextBtn.hidden = last; submitBtn.hidden = !last;
    nextBtn.firstChild.textContent = NEXT[step] + ' ';
    msg.hidden = true;
    if (last) recap();
    if (focus) { $('.progress').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); setTimeout(() => parts[step].querySelector('input:not([type=hidden]):not(.hp), select, textarea')?.focus({ preventScroll: true }), 350); }
  }
  nextBtn.addEventListener('click', () => { const bad = validate(step); if (bad) { bad.focus(); return; } go(step + 1); });
  backBtn.addEventListener('click', () => go(step - 1));
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && step < parts.length - 1) { e.preventDefault(); nextBtn.click(); } });

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (let i = 0; i < parts.length; i++) { const bad = validate(i); if (bad) { go(i, false); bad.focus(); return; } }
    const g = (n) => val(n);
    const notes = g('useNotes');
    const payload = {
      legalBusinessName: g('legalBusinessName'), dbaName: g('dbaName'), entityType: g('entityType'), industry: g('industry'),
      businessStartDate: g('businessStartDate'), federalTaxId: g('federalTaxId'),
      businessAddress: g('businessAddress'), businessCity: g('businessCity'), businessState: g('businessState'), businessZip: g('businessZip'),
      ownerFullName: g('ownerFullName'), ownerTitle: g('ownerTitle'), ownershipPercentage: g('ownershipPercentage'),
      ownerPhone: g('ownerPhone'), ownerEmail: g('ownerEmail').toLowerCase(), ownerHomeAddress: g('ownerHomeAddress'),
      requestedAmount: digits(g('requestedAmount')),
      useOfFunds: [[...state.uses].join(', '), notes].filter(Boolean).join(' — '),
      averageMonthlyRevenue: digits(g('averageMonthlyRevenue')), averageMonthlyBankDeposits: digits(g('averageMonthlyBankDeposits')),
      existingBusinessLoansOrAdvances: g('existingBusinessLoansOrAdvances'), currentBalanceOnExistingFinancing: digits(g('currentBalanceOnExistingFinancing')),
      nsfOrOverdraftCountLast3Months: g('nsfOrOverdraftCountLast3Months'), primaryBankName: g('primaryBankName'), timeWithBank: g('timeWithBank'),
      monthlyCreditCardProcessingVolume: digits(g('monthlyCreditCardProcessingVolume')), numberOfBusinessLocations: g('numberOfBusinessLocations'),
      accuracyConsent: form.elements.accuracyConsent.checked, contactConsent: form.elements.contactConsent.checked,
      sourcePage: location.pathname || '/', honeypot: g('honeypot'),
    };
    submitBtn.disabled = true; backBtn.disabled = true; msg.hidden = true;
    const prev = submitBtn.firstChild.textContent; submitBtn.firstChild.textContent = 'Sending… ';
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok || !data.submissionId) throw new Error((data && data.message) || 'We could not send your request. Please try again.');
      $('[data-done-no]').textContent = String(data.submissionId);
      form.hidden = true; $('.progress').hidden = true; label.hidden = true;
      const done = $('[data-done]'); done.hidden = false; done.focus();
      form.reset(); state.uses = new Set(['Payroll']); state.amount = DEFAULT_AMOUNT; state.business = ''; if (heroName) heroName.value = ''; paintUses(); syncAmount();
      done.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      msg.textContent = (err && err.message && err.message !== 'Failed to fetch') ? err.message : 'We could not send your request just now. Please check your connection and try again in a moment.';
      msg.hidden = false; submitBtn.disabled = false; backBtn.disabled = false; submitBtn.firstChild.textContent = prev;
    }
  });

  paintUses(); syncAmount(); go(0, false);

  // The amount counts up as the draft prints; any interaction cancels it.
  if (!reduce && heroNum) {
    let live = true;
    const stop = (e) => { live = false; if (e && e.type === 'pointerdown' && state.amount !== DEFAULT_AMOUNT) { state.amount = DEFAULT_AMOUNT; syncAmount('count'); } };
    document.addEventListener('input', stop, { once: true });
    document.addEventListener('pointerdown', stop, { once: true });
    const t0 = performance.now();
    state.amount = 0; syncAmount('count');
    const tick = (t) => {
      if (!live) { if (state.amount === 0) { state.amount = DEFAULT_AMOUNT; syncAmount('count'); } return; }
      const k = Math.min(1, Math.max(0, (t - t0 - 900) / 1400));
      state.amount = k >= 1 ? DEFAULT_AMOUNT : Math.round((DEFAULT_AMOUNT * (1 - Math.pow(1 - k, 3))) / 5000) * 5000;
      syncAmount('count');
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
