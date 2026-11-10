// The co-op arcade on the server: a run online, in a room a friend can join. The ladder itself is shared with the page
// (public/coop.js), which runs a run on the player's own device when nobody else is joining over the internet.
const fs = require('fs'), path = require('path');
const coopFactory = require('../public/coop.js');
const read = (f, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); } catch (e) { return fallback; } };
const ROSTER = read('duos.json', null), FIT = read('duo-fit.json', { duos: {} });
module.exports = ctx => Object.assign(coopFactory(Object.assign({ roster: ROSTER, fit: FIT }, ctx)), { ROSTER, FIT });
module.exports.ROSTER = ROSTER; module.exports.FIT = FIT;
