// Payments through Stripe Checkout, using Stripe's HTTP API directly (no extra packages).
// Needs two environment variables on the host (never in the repository): STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
// Prices are set in lib/economy.js and sent with each checkout, so nothing has to be created in the Stripe dashboard
// first. Stripe tells the server about completed payments through the webhook (POST /api/stripe/webhook).
'use strict';
const crypto = require('crypto');

const API = 'https://api.stripe.com/v1/';
const key = () => process.env.STRIPE_SECRET_KEY || '';
const configured = () => !!key();

// Stripe takes form-encoded bodies with bracketed keys: line_items[0][price_data][currency]=gbp
function form(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, name, out);
    else out.push(encodeURIComponent(name) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}
async function call(path, body, method = 'POST') {
  const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + key(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: body ? form(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Stripe error ' + r.status);
  return j;
}

// a checkout page for one thing: { mode: 'payment'|'subscription', name, amount (pence), uid, kind, item, base (site URL), customer }
function checkout(o) {
  const meta = { uid: String(o.uid), kind: o.kind, item: o.item || '' };
  const price = { currency: 'gbp', unit_amount: o.amount, product_data: { name: o.name } };
  if (o.mode === 'subscription') price.recurring = { interval: 'month' };
  const body = {
    mode: o.mode, client_reference_id: String(o.uid), metadata: meta,
    line_items: { 0: { price_data: price, quantity: 1 } },
    success_url: o.base + '/play?paid=' + encodeURIComponent(o.kind) + '&session={CHECKOUT_SESSION_ID}',
    cancel_url: o.base + '/play?paid=cancel',
    allow_promotion_codes: 'true',
  };
  if (o.customer) body.customer = o.customer;
  if (o.mode === 'subscription') body.subscription_data = { metadata: meta };
  else body.payment_intent_data = { metadata: meta };
  return call('checkout/sessions', body);
}
// Stripe's own page for managing (or cancelling) a membership
const portal = (customer, returnUrl) => call('billing_portal/sessions', { customer, return_url: returnUrl });

// check a webhook really came from Stripe: header "t=...,v1=..." signs `${t}.${raw body}` with the webhook secret
function verify(raw, header, secret = process.env.STRIPE_WEBHOOK_SECRET || '', toleranceSec = 300) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = String(header).split(',').filter(p => p.trim().startsWith('v1=')).map(p => p.trim().slice(3));
  const t = +parts.t; if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const want = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sigs.some(s => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
}
module.exports = { configured, checkout, portal, verify, call, form };
