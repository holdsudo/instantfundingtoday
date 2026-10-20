// Local mock of POST /api/applications for testing the form without touching production.
import http from 'node:http';
const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method === 'POST' && req.url === '/api/applications') {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      let j = {}; try { j = JSON.parse(b); } catch {}
      console.log('RECEIVED KEYS:', Object.keys(j).sort().join(','));
      console.log('SAMPLE:', JSON.stringify({ requestedAmount: j.requestedAmount, useOfFunds: j.useOfFunds, ownerPhone: j.ownerPhone, ownerEmail: j.ownerEmail, contactConsent: j.contactConsent, honeypot: j.honeypot, sourcePage: j.sourcePage }));
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors }); res.end(JSON.stringify({ ok: true, submissionId: 'TEST-' + Date.now().toString(36).toUpperCase() }));
    });
  } else { res.writeHead(404, cors); res.end('{}'); }
});
server.listen(8787, () => console.log('mock api on :8787'));
