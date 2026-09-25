// Rough country from an IP address, used as the starting flag next to a player's name.
// Uses the host's own header when there is one (Cloudflare sets cf-ipcountry), otherwise asks api.country.is.
// Results are cached for a day; failures just mean no flag.
'use strict';
const cache = new Map(); // ip -> { cc, t }
const DAY = 24 * 3600 * 1000;
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd|fe80|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/i;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^::ffff:(?=\d+\.)/, '');
}
async function countryOf(req) {
  const hdr = String(req.headers['cf-ipcountry'] || '').toLowerCase();
  if (/^[a-z]{2}$/.test(hdr) && hdr !== 'xx' && hdr !== 't1') return hdr;
  const ip = clientIp(req);
  if (!ip || PRIVATE.test(ip) || process.env.GEO_OFF) return null;
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.t < DAY) return hit.cc;
  let cc = null;
  try {
    const r = await fetch(`${process.env.GEO_URL || 'https://api.country.is'}/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) { const j = await r.json(); if (/^[A-Za-z]{2}$/.test(j.country || '')) cc = j.country.toLowerCase(); }
  } catch (e) { /* no flag then */ }
  if (cache.size > 20000) cache.clear();
  cache.set(ip, { cc, t: cc ? Date.now() : Date.now() - DAY + 10 * 60 * 1000 }); // retry failures after 10 minutes
  return cc;
}
module.exports = { countryOf, clientIp };
