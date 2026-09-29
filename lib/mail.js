// Sending email (password resets) through Resend's HTTP API, with no extra packages.
// Needs two environment variables on the host (never in the repository): RESEND_API_KEY, and MAIL_FROM, an address on a
// domain you've verified with Resend, e.g. "Bowfall <noreply@bowfall.com>". Without them nothing is sent: the server
// prints the message to its log instead, so resets can still be tested (and the owner can pass a link on by hand).
'use strict';
const configured = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
async function send(to, subject, text, html) {
  if (!configured()) { console.log(`[mail not set up] to ${to}: ${subject}\n${text}`); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
  });
  if (!r.ok) { console.error('Mail failed:', r.status, (await r.text().catch(() => '')).slice(0, 300)); return false; }
  return true;
}
// a plain, sane check: something@something.something, no spaces, not too long
const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
module.exports = { configured, send, validEmail };
