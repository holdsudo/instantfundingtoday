// Instant Funding Today intake API. POST /api/applications -> D1.
const ORIGINS = new Set([
  'https://instantfundingtoday.net',
  'https://www.instantfundingtoday.net',
]);
const MAX_BODY = 50000;
const FIELDS = [
  'legalBusinessName', 'dbaName', 'entityType', 'industry', 'businessStartDate',
  'federalTaxId', 'businessAddress', 'businessCity', 'businessState', 'businessZip',
  'ownerFullName', 'ownerTitle', 'ownershipPercentage', 'ownerPhone', 'ownerEmail',
  'ownerHomeAddress', 'requestedAmount', 'useOfFunds', 'averageMonthlyRevenue',
  'averageMonthlyBankDeposits', 'existingBusinessLoansOrAdvances',
  'currentBalanceOnExistingFinancing', 'nsfOrOverdraftCountLast3Months',
  'primaryBankName', 'timeWithBank', 'monthlyCreditCardProcessingVolume',
  'numberOfBusinessLocations',
];

function cors(req) {
  const o = req.headers.get('origin') || '';
  const ok = ORIGINS.has(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    'access-control-allow-origin': ok ? o : 'https://instantfundingtoday.net',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'origin',
  };
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(req) },
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname !== '/api/applications') return json(req, { ok: false, message: 'Not found.' }, 404);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== 'POST') return json(req, { ok: false, message: 'Method not allowed.' }, 405);
    if (!(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
      return json(req, { ok: false, message: 'Invalid request format.' }, 415);
    }

    const raw = await req.text();
    if (!raw || raw.length > MAX_BODY) return json(req, { ok: false, message: 'Unable to submit application.' }, 413);
    let d;
    try { d = JSON.parse(raw); } catch { return json(req, { ok: false, message: 'Invalid application data.' }, 400); }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return json(req, { ok: false, message: 'Invalid application data.' }, 400);

    const id = 'IFT-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomUUID().slice(0, 6).toUpperCase();

    // Honeypot: pretend success, store nothing.
    if (typeof d.honeypot === 'string' && d.honeypot.trim() !== '') {
      return json(req, { ok: true, submissionId: id, message: 'Application submitted successfully.' });
    }

    const str = (k) => (d[k] == null ? '' : String(d[k]).slice(0, 1000));
    const phone = str('ownerPhone').trim();
    const email = str('ownerEmail').trim();
    if (!phone && !email) {
      return json(req, { ok: false, message: 'Please provide at least a phone number or email address.' }, 400);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(req, { ok: false, message: 'Please provide a valid email address.' }, 400);
    }

    const rec = {};
    for (const k of FIELDS) rec[k] = str(k);

    try {
      await env.DB.prepare(
        'INSERT INTO applications (id, submitted_at, source_page, user_agent, contact_consent, accuracy_consent, data) VALUES (?,?,?,?,?,?,?)'
      ).bind(
        id,
        new Date().toISOString(),
        str('sourcePage') || '/',
        (req.headers.get('user-agent') || '').slice(0, 250),
        d.contactConsent === true ? 1 : 0,
        d.accuracyConsent === true ? 1 : 0,
        JSON.stringify(rec),
      ).run();
    } catch (e) {
      console.error('insert failed', id, e && e.message);
      return json(req, { ok: false, message: 'Unable to submit application.' }, 500);
    }
    // Alert the owner. Never blocks or fails the submission; the record is already saved.
    if (env.NOTIFY_URL && env.NOTIFY_KEY) ctx.waitUntil(notify(env, id, rec));
    return json(req, { ok: true, submissionId: id, message: 'Application submitted successfully.' });
  },
};

// Sends a summary to the NOTIFY_URL relay (a Google Apps Script in the owner's Gmail).
// Masks the tax ID and leaves out the home address; the full record stays in D1.
async function notify(env, id, rec) {
  try {
    const oneLine = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
    const money = (v) => (String(v || '').replace(/[^\d]/g, '') ? '$' + Number(String(v).replace(/[^\d]/g, '')).toLocaleString('en-US') : '');
    const tax = String(rec.federalTaxId || '').replace(/[^\d]/g, '');
    const row = (k, v) => (v ? k + ': ' + v : null);
    const lines = [
      row('Reference', id),
      row('Received', new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET'),
      '',
      row('Requested', money(rec.requestedAmount)),
      row('Purpose', oneLine(rec.useOfFunds)),
      '',
      row('Business', oneLine(rec.legalBusinessName)),
      row('DBA', oneLine(rec.dbaName)),
      row('Entity', oneLine(rec.entityType)),
      row('Industry', oneLine(rec.industry)),
      row('Started', oneLine(rec.businessStartDate)),
      row('Location', [rec.businessCity, rec.businessState, rec.businessZip].map(oneLine).filter(Boolean).join(', ')),
      row('Tax ID', tax ? '***-**' + tax.slice(-4) : ''),
      '',
      row('Owner', [oneLine(rec.ownerFullName), oneLine(rec.ownerTitle)].filter(Boolean).join(', ')),
      row('Ownership', oneLine(rec.ownershipPercentage) && oneLine(rec.ownershipPercentage) + '%'),
      row('Phone', oneLine(rec.ownerPhone)),
      row('Email', oneLine(rec.ownerEmail)),
      '',
      row('Monthly revenue', money(rec.averageMonthlyRevenue)),
      row('Monthly deposits', money(rec.averageMonthlyBankDeposits)),
      row('Card volume', money(rec.monthlyCreditCardProcessingVolume)),
      row('Bank', oneLine(rec.primaryBankName)),
      row('Time with bank', oneLine(rec.timeWithBank)),
      row('Existing financing', oneLine(rec.existingBusinessLoansOrAdvances)),
      row('Balance owed', money(rec.currentBalanceOnExistingFinancing)),
      row('NSF/overdrafts (3 mo)', oneLine(rec.nsfOrOverdraftCountLast3Months)),
      '',
      'Full record (including home address and full tax ID) is in the Cloudflare D1 database ift-applications.',
    ].filter((l) => l !== null);
    await fetch(env.NOTIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({
        key: env.NOTIFY_KEY,
        subject: ('New application: ' + (oneLine(rec.legalBusinessName) || 'unnamed business') + ' ' + money(rec.requestedAmount)).trim().slice(0, 150),
        body: lines.join('\n'),
      }),
    });
  } catch (e) {
    console.error('notify failed', id, e && e.message);
  }
}
