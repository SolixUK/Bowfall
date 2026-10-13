// What matchmaking's AI players say in chat. Each has a personality (tone), a chattiness from 0 (hardly ever speaks) to
// 1 (says something at most of the moments that call for it), and typing quirks (lowercase, no punctuation, typos, a
// word or two of their own language). Lines are picked at random, skipping anything said recently; {n} is who they're
// talking about, shortened the way a person would ("dave_smith245" becomes "dave").
// Most people don't talk much in a game: the weights below are low on purpose, and "gg" is the one everyone types.
// A tone without lines for a moment falls back to the shared ones (ANY) — quiet players fall back to nothing.
'use strict';
const LINES = {
  friendly: {
    start: ['gl hf', 'glhf all', 'gl', 'hey, gl hf', 'evening, gl'],
    kill: ['sorry {n}', 'close one {n}', 'that was lucky tbh', 'oof sorry'],
    ring: ['sorry sorry', 'oops', 'mind the edge', 'that one hurt to watch'],
    died: ['ns', 'nice {n}', 'ok that was clean', 'fair', 'didnt see that coming'],
    gameWin: ['close', 'phew', 'nice one team'],
    gameLose: ['ah so close', 'next one', 'nice'],
    matchWin: ['gg wp', 'ggs, good fun', 'gg all', 'gg, close games', 'ggs thanks'],
    matchLose: ['gg wp', 'ggs', 'gg {n}, you were on one', 'gg, well played', 'ggs good fights'],
    multi: ['oh wow', 'did that just happen', 'sorry both of you lol'],
    dominated: ['you are too good', 'ok im learning a lot today', 'well played {n}, seriously'],
    bullied: ['ok ok', 'let me out lol', 'im a pinball'],
  },
  cocky: {
    start: ['this wont take long', 'ok lets go', 'gl, you need it', 'try to keep up'],
    kill: ['too easy', 'sit', 'next', 'bye {n}', 'not close', 'free'],
    ring: ['bye', 'enjoy the swim', 'gravity', 'watch your step'],
    died: ['lucky', 'lag', 'ok', 'wont happen again', 'hm'],
    gameWin: ['ez', 'told you', 'as expected'],
    gameLose: ['warming up', 'lucky round', 'ok sure', 'lag'],
    matchWin: ['ez', 'gg ez', 'never in doubt', 'gg, get good', 'too easy', 'next'],
    matchLose: ['gg, got lucky', 'rematch', 'whatever gg', 'i was carrying tbh', 'fine', 'lucky arrows'],
    multi: ['light work', 'bots?', 'two for one', 'who else', 'come on then', 'diff'],
    dominated: ['ok {n} relax', 'this is lag', 'my aim is off today', 'rematch and i win'],
    bullied: ['ok stop', 'really', 'relax', 'cool'],
    bullyThem: ['stay there', 'wall says hi', 'again?', 'bounce'],
  },
  salty: {
    start: ['here we go', 'gl', 'please not this map', 'lets get this over with'],
    kill: ['finally', 'about time', 'there'],
    ring: ['stay down', 'good'],
    died: ['how', 'lag', 'that hit?', 'bruh', 'are you joking', 'that was nowhere near me', 'ok sure', 'cool cool', 'hitbox'],
    gameWin: ['finally', 'took long enough'],
    gameLose: ['this map', 'bruh', 'teammates??', 'unreal', 'every time', 'ok'],
    matchWin: ['gg', 'gg finally', 'about time'],
    matchLose: ['gg i guess', 'whatever', 'lag all game', 'gg cant aim today', 'matchmaking is a joke', 'nope', 'im done'],
    multi: ['there', 'see', 'thats how it should go'],
    dominated: ['ok im done', 'this is not fun', 'wow', 'cool game', 'yep', 'uninstalling', 'nice matchmaking'],
    bullied: ['stop', 'wow', 'ok', 'STOP', 'really', 'this is so dumb', 'let me out'],
    bullyThem: ['stay', 'how do you like it'],
  },
  chill: {
    start: ['yo', 'gl', 'sup', 'ayy', 'hey'],
    kill: ['nice', 'ope', 'there we go'],
    ring: ['lol', 'splash', 'whoops'],
    died: ['ha nice', 'fair', 'lol ok', 'nice one'],
    gameWin: ['nice', 'smooth'],
    gameLose: ['all good', 'eh', 'fair enough'],
    matchWin: ['gg', 'ggs', 'gg good vibes', 'nice one'],
    matchLose: ['gg', 'ggs', 'fair play', 'gg u guys are good', 'all good'],
    multi: ['lol', 'oh', 'ok that was nice'],
    dominated: ['lol ok', 'yeah im cooked', 'gg already'],
    bullied: ['lol', 'ok im a ball now', 'wheee'],
  },
  tryhard: {
    start: ['glhf', 'focus', 'lets go', 'play the angles', 'no throwing'],
    kill: ['clean', 'picked', 'one down', 'trade won'],
    ring: ['positioning', 'edge control', 'angles'],
    died: ['misread', 'my bad', 'should have dashed', 'greedy', 'respect'],
    gameWin: ['clean', 'good round'],
    gameLose: ['reset', 'adjust', 'misplayed', 'play cover next one'],
    matchWin: ['gg wp', 'gg, solid', 'clean match'],
    matchLose: ['gg wp', 'gg, need to practise', 'gg good fights', 'gg {n}, clean aim', 'noted'],
    multi: ['clean', 'tracked both', 'thats the play'],
    dominated: ['ok what am i doing wrong', 'you are reading me', 'i need to review this', 'respect {n}'],
    bullied: ['ok', 'im stuck in a loop', 'need to break this'],
  },
  wholesome: {
    start: ['gl hf everyone!', 'hi all! gl', 'have fun :)', 'hello! gl hf'],
    kill: ['sorry!!', 'oops sorry {n}', 'sorry {n} you nearly had me'],
    ring: ['sorry about the pit!', 'oh no sorry', 'eek'],
    died: ['great shot {n}!', 'wow nice aim', 'lovely shot', 'you are really good'],
    gameWin: ['yay!', 'that was fun'],
    gameLose: ['well played!', 'nice teamwork', 'you earned that!'],
    matchWin: ['gg everyone :)', 'ggs! thank you', 'gg! you all played so well', 'great games!'],
    matchLose: ['gg! you played so well', 'ggs thank you!', 'well played :)', 'gg {n} that was so good', 'that was fun, thank you!'],
    multi: ['oh my!', 'sorry both!', 'i dont know how that happened'],
    dominated: ['you are amazing {n}', 'im learning so much!', 'ok i need a tutorial lol'],
    bullied: ['oh dear', 'help!', 'im dizzy'],
  },
  jokester: {
    start: ['may the best archer win (me)', 'who brought snacks', 'bow ties on', 'lets get to the point'],
    kill: ['arrow-derci', 'thats the point', 'bow down', 'you have been arrowed'],
    ring: ['hole in one', 'mind the gap', 'pit happens', 'drop in anytime'],
    died: ['i meant to do that', 'my arrow had other plans', 'floor was lava apparently', 'tell my bow i loved it'],
    gameWin: ['nailed it', 'nock nock'],
    gameLose: ['i was holding back', 'plot twist'],
    matchWin: ['gg what a quiver', 'ggs, here all week', 'and thats the point'],
    matchLose: ['gg, ill get my bow and go', 'ggs, i was aiming for second', 'should have brought a sword'],
    multi: ['buy one get one', 'two birds', 'is this allowed'],
    dominated: ['i am the training dummy', 'im in a youtube montage arent i', 'ok ok i get it'],
    bullied: ['im a pinball', 'tilt', 'wheeee', 'is this bowling now'],
  },
  quiet: {
    start: ['gl', 'hf'],
    kill: [], ring: [], died: ['ns'], gameWin: [], gameLose: [],
    matchWin: ['gg'],
    matchLose: ['gg'],
    greet: ['hi'], gg: ['gg'], glhf: ['gl'], thanks: ['ty'], laugh: [], ez: [], bot: [], praise: ['ty'], ns: ['ty'],
    firstBlood: [], streak: [], selfDie: [], theyFell: [], clutchMe: [], clutchThem: [], decider: [], matchPoint: [], behind: [], stomp: [], stomped: [], closeWin: [], closeLose: [],
    multi: [], dominated: [], bullied: ['.'], bullyThem: [], tilt: [],
  },
};
// shared lines for the moments a tone doesn't cover itself
const ANY = {
  firstBlood: ['first', 'and we are off'],
  streak: ['on one', 'cant miss today', 'someone stop me'],
  selfDie: ['did i just walk into that', 'oops', 'ok that one was me', 'forgot that was there', 'lol my bad', 'who put that there'],
  theyFell: ['lol {n}', 'rip', 'free one', 'careful {n}'],
  clutchMe: ['clutch', 'did not think id win that', 'heart rate high', 'phew'],
  clutchThem: ['ok that was clutch', 'how did {n} win that', 'nice clutch {n}'],
  decider: ['last one', 'decider', 'all on this one', 'here we go'],
  matchPoint: ['one more', 'close it out', 'one more team'],
  behind: ['we can still do this', 'not over yet', 'lets go team'],
  stomp: ['gg, clean sweep', 'clean', 'that went well'],
  stomped: ['you were too good', 'rough one', 'gg, couldnt get going'],
  closeWin: ['that was close', 'tense', 'couldve gone either way', 'gg phew'],
  closeLose: ['so close', 'almost', 'that was tight', 'gg, one round off'],
  greet: ['hey {n}', 'hi', 'yo', 'hey', 'hello'],
  gg: ['gg', 'gg wp', 'ggs'],
  glhf: ['gl hf', 'u too', 'gl'],
  thanks: ['np', 'no worries'],
  laugh: ['lol', 'haha', 'lmao'],
  ez: ['was it though', 'ok {n}', 'big talk'],
  bot: ['yep, AI player', 'AI, still practising', 'beep boop', 'yes. still got you though'],
  praise: ['ty {n}', 'thanks', 'ty ty', 'cheers'],
  ns: ['ty', 'thanks {n}', 'cheers'],
  multi: ['two', 'oh', 'nice'],
  bullyThem: ['stay there', 'again'],
  dominated: ['ok', 'wow', 'yep'],
  bullied: ['ok', 'wow', 'stop'],
  tilt: ['ok im done', 'whatever', 'this game', 'cant hit anything today', 'bruh', 'cool', 'nice', 'sure', 'yep', 'lol ok'],
};
// the tone-specific "reply" lines used to cover anything someone says to them
const REPLY_TONE = { friendly: { greet: ['hey {n}', 'hi {n}, gl'], gg: ['gg {n}', 'gg wp'] }, cocky: { greet: ['oh, {n}. hi', 'sup'], gg: ['gg ez', 'gg, you tried'], ez: ['you wish', 'says the one losing'] },
  salty: { greet: ['hey', 'yeah hi'], gg: ['gg', 'yeah gg'], ez: ['shut up {n}', 'ok buddy'] }, wholesome: { greet: ['hi {n}! :)', 'hello {n}!'], gg: ['gg {n}! :)', 'ggs!'], ez: ['aw, gg anyway!'] },
  jokester: { greet: ['hello there', 'hi, im the one with the pointy stick'], bot: ['im an AI, but my puns are handmade'], laugh: ['im here all week'] } };
for (const [t, o] of Object.entries(REPLY_TONE)) Object.assign(LINES[t], o);
const TONES = Object.keys(LINES);

// how likely each kind of moment is to get a line (times the player's chattiness). Low on purpose: most of a game is silence
const WEIGHT = { start: 0.5, kill: 0.1, ring: 0.18, died: 0.12, gameWin: 0.12, gameLose: 0.14, matchWin: 0.75, matchLose: 0.75,
  firstBlood: 0.2, streak: 0.45, selfDie: 0.4, theyFell: 0.2, clutchMe: 0.7, clutchThem: 0.45, decider: 0.3, matchPoint: 0.2, behind: 0.18,
  stomp: 0.7, stomped: 0.7, closeWin: 0.75, closeLose: 0.75, reply: 0.8,
  multi: 0.6, bullied: 0.75, bullyThem: 0.4, dominated: 0.6, tilt: 0.7 };

// A few words in their own language, for the players who have one: used now and then (quirk.native) in place of the
// English line, for the moments people do type in their own language. Nothing more than a word or two.
const NATIVE = {
  ru: { start: ['удачи', 'гл хф', 'всем удачи'], died: ['блин', 'ну ок', 'красиво', 'да ладно'], kill: ['есть', 'сиди'], matchWin: ['гг', 'гг всем', 'изи'], matchLose: ['гг', 'гг вп', 'ладно, гг'], laugh: ['ахах', 'лол'], tilt: ['да ну', 'ну и ладно', 'что это было'], dominated: ['ну всё'], bullied: ['хватит', 'стоп'] },
  ua: { start: ['удачі', 'гл хф'], died: ['блін', 'ну ок', 'гарно'], matchWin: ['гг', 'гг всім'], matchLose: ['гг', 'гг вп'], laugh: ['ахах'], tilt: ['та ну'] },
  es: { start: ['suerte', 'gl', 'vamos'], died: ['joder', 'buena', 'qué tiro', 'ostras'], kill: ['toma', 'ya'], matchWin: ['gg', 'gg wp', 'bien'], matchLose: ['gg', 'bien jugado', 'gg wp'], laugh: ['jaja', 'jajaja'], tilt: ['venga ya', 'no puede ser'], bullied: ['para', 'ya está'] },
  pt: { start: ['boa sorte', 'gl', 'bora'], died: ['caramba', 'boa', 'que tiro', 'eish'], kill: ['toma', 'boa'], matchWin: ['gg', 'bom jogo'], matchLose: ['gg', 'bem jogado', 'gg wp'], laugh: ['kkkk', 'ahah'], tilt: ['não acredito', 'pá'], bullied: ['pára', 'chega'] },
  fr: { start: ['bonne chance', 'gl hf', 'allez'], died: ['oh la la', 'bien joué', 'bg', 'mince'], kill: ['voilà', 'hop'], matchWin: ['gg', 'gg bien joué'], matchLose: ['gg', 'bien joué', 'gg wp'], laugh: ['mdr', 'ptdr'], tilt: ['nan mais', 'c est pas possible'], bullied: ['stop', 'arrête'] },
  de: { start: ['viel glück', 'gl hf', 'auf gehts'], died: ['alter', 'oh man', 'joa', 'gut gespielt', 'na toll'], kill: ['passt', 'so'], matchWin: ['gg', 'gut gespielt'], matchLose: ['gg', 'gut gespielt', 'gg wp'], laugh: ['haha', 'lol'], tilt: ['ach komm', 'ne oder'], bullied: ['hör auf', 'ey'] },
  pl: { start: ['powodzenia', 'gl hf'], died: ['kurde', 'no nie', 'ładnie', 'no ok'], kill: ['siedź', 'o'], matchWin: ['gg', 'dobra gra'], matchLose: ['gg', 'dobra', 'gg wp'], laugh: ['xD', 'hehe'], tilt: ['no nie', 'serio'], bullied: ['przestań', 'dość'] },
  nl: { start: ['succes', 'gl hf'], died: ['oei', 'lekker', 'goed gedaan', 'oh nee'], matchWin: ['gg', 'lekker'], matchLose: ['gg', 'goed gespeeld'], laugh: ['haha'], tilt: ['kom op', 'serieus'] },
  se: { start: ['lycka till', 'gl hf'], died: ['fan', 'snyggt', 'oj', 'aj'], matchWin: ['gg', 'snyggt'], matchLose: ['gg', 'bra spelat'], laugh: ['haha'], tilt: ['men kom igen', 'skärp dig'] },
  it: { start: ['buona fortuna', 'gl hf', 'dai'], died: ['mamma mia', 'bravo', 'bel tiro', 'dai'], matchWin: ['gg', 'bella'], matchLose: ['gg', 'bravi', 'gg wp'], laugh: ['ahah'], tilt: ['ma dai', 'no vabbè'] },
  dk: { start: ['held og lykke', 'gl hf'], died: ['av', 'flot', 'årh'], matchWin: ['gg', 'flot'], matchLose: ['gg', 'godt spillet'], laugh: ['haha'], tilt: ['hold nu op'] },
  fi: { start: ['onnea', 'gl hf'], died: ['voi ei', 'hyvä', 'no joo'], matchWin: ['gg', 'hyvä'], matchLose: ['gg', 'hyvin pelattu'], laugh: ['haha'], tilt: ['no ei'] },
  no: { start: ['lykke til', 'gl hf'], died: ['au', 'fint', 'uff'], matchWin: ['gg', 'fint'], matchLose: ['gg', 'bra spilt'], laugh: ['haha'], tilt: ['kom igjen'] },
  cz: { start: ['hodně štěstí', 'gl hf'], died: ['ty jo', 'pěkný', 'no jo'], matchWin: ['gg', 'dobrý'], matchLose: ['gg', 'dobrá hra'], laugh: ['haha'], tilt: ['no tak'] },
  gr: { start: ['καλή τύχη', 'gl hf'], died: ['έλα', 'ωραίο', 'ρε'], matchWin: ['gg', 'ωραία'], matchLose: ['gg', 'μπράβο'], laugh: ['χαχα'], tilt: ['έλα ρε'] },
  hu: { start: ['sok sikert', 'gl hf'], died: ['ejj', 'szép', 'na ne'], matchWin: ['gg', 'szép volt'], matchLose: ['gg', 'szép játék'], laugh: ['haha'], tilt: ['na ne már'] },
  ro: { start: ['baftă', 'gl hf'], died: ['aoleu', 'frumos', 'hai mă'], matchWin: ['gg', 'frumos'], matchLose: ['gg', 'bine jucat'], laugh: ['haha'], tilt: ['hai mă'] },
};
// a language for a country code (the Europe server's players mostly type in English; this is for the odd word that isn't)
const LANG = { gb: null, ie: null, ru: 'ru', ua: 'ua', es: 'es', pt: 'pt', fr: 'fr', be: 'fr', ch: 'de', at: 'de', de: 'de', pl: 'pl', nl: 'nl', se: 'se', it: 'it', dk: 'dk', fi: 'fi', no: 'no', cz: 'cz', sk: 'cz', gr: 'gr', hu: 'hu', ro: 'ro', is: 'no', ee: null, lt: null, lv: null, hr: null, rs: null, bg: null };

// what someone said, so the reply fits: a greeting, gg, good luck, a laugh, "ez", asking if they're a bot, praise
const KINDS = [
  ['bot', /\b(bot|bots|ai|robot|npc)\b.*\?|\b(are|r) (you|u) (a )?(bot|ai|robot)/i],
  ['ez', /\b(ez|ezz+|easy|too easy)\b/i],
  ['ns', /\b(ns|nice shot|good shot)\b/i],
  ['praise', /\b(nice|good|great|well played|wp|insane|cracked)\b.*\b(you|u|aim|shot|play|one)\b/i],
  ['glhf', /\b(gl|hf|glhf|gl hf|good luck)\b/i],
  ['gg', /\b(gg|ggs|ggwp|good game|good games)\b/i],
  ['greet', /\b(hi|hey|hello|yo|sup|hiya|howdy|o\/)\b/i],
  ['thanks', /\b(ty|thx|thanks|thank you)\b/i],
  ['laugh', /\b(lol|lmao|haha+|rofl|xd)\b/i],
];
function kindOf(text) { for (const [k, re] of KINDS) if (re.test(text)) return k; return null; }

// "dave_smith245" -> "dave", "xXSniperXx" -> "sniper", "MrBowman" -> "bowman": the way people shorten names in chat
function shortName(n) {
  if (!n) return 'you';
  const parts = String(n).replace(/\[[^\]]*\]\s*/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').split(/[\s_\-.0-9]+/).map(s => s.replace(/[^A-Za-z]/g, '')).filter(Boolean);
  const skip = /^(x+|mr|mrs|ms|dr|the|its|im|i|ttv|yt|tv|pro|real|official|lord|sir|king|queen)$/i;
  const pick = parts.find(s => s.length >= 3 && !skip.test(s)) || parts.find(s => s.length >= 2 && !skip.test(s)) || parts[0];
  if (!pick) return String(n).replace(/[^A-Za-z]/g, '').toLowerCase() || 'you';
  return pick.toLowerCase();
}

// Typing quirks, from a player's persona: caps (0 all lowercase, 1 sentence case), punct (keeps apostrophes and full
// stops), typo (chance per message of a slip: two letters swapped or one missing), excl (adds !! or ?? when worked up),
// native (chance of a line in their own language), mash (how likely a rage line is a keyboard mash: 'awdjkahwd')
const QUIRK0 = { caps: 0, punct: 0, typo: 0.06, excl: 0.1, native: 0, mash: 0.1, lang: null };
function styleText(text, q) {
  q = Object.assign({}, QUIRK0, q || {});
  let t = String(text);
  if (!q.punct) t = t.replace(/[’']/g, '').replace(/\.$/, '');
  if (q.caps) t = t.charAt(0).toUpperCase() + t.slice(1);
  if (Math.random() < q.typo && t.length > 4) {
    const i = 1 + Math.floor(Math.random() * (t.length - 2));
    if (/[a-z]/i.test(t[i]) && /[a-z]/i.test(t[i + 1] || '')) t = Math.random() < 0.6 ? t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2) : t.slice(0, i) + t.slice(i + 1);
  }
  return t;
}
// a keyboard mash: what someone types when they've had enough
function mash() {
  const rows = ['asdfghjkl', 'qwertyuiop', 'zxcvbnm'], row = rows[Math.floor(Math.random() * rows.length)];
  let s = ''; const n = 6 + Math.floor(Math.random() * 14), start = Math.floor(Math.random() * (row.length - 3));
  for (let i = 0; i < n; i++) s += row[Math.max(0, Math.min(row.length - 1, start + Math.round((Math.random() - 0.5) * 6)))];
  return s;
}

// pick a line, avoiding ones in `avoid` (recent lines) where it can. persona: { quirk, country } for the typing quirks
// and the odd line in their own language; the raw line is what's remembered, so the same thought isn't repeated
function line(tone, event, n, avoid, persona) {
  const q = (persona && persona.quirk) || null, lang = q && q.lang;
  if (lang && NATIVE[lang] && NATIVE[lang][event] && NATIVE[lang][event].length && Math.random() < (q.native || 0)) {
    const list = NATIVE[lang][event], fresh = avoid ? list.filter(l => !avoid.has(l)) : list, from = fresh.length ? fresh : list;
    const raw = from[Math.floor(Math.random() * from.length)];
    return { raw, text: raw };
  }
  if (event === 'tilt' && q && Math.random() < (q.mash || 0)) { const m = mash(); return { raw: 'mash', text: m }; }
  const own = (LINES[tone] || LINES.chill)[event];
  const list = own && own.length ? own : (own ? [] : ANY[event] || []);
  if (!list.length) return null;
  const fresh = avoid ? list.filter(l => !avoid.has(l)) : list;
  const from = fresh.length ? fresh : list;
  const raw = from[Math.floor(Math.random() * from.length)];
  let text = styleText(raw.replace(/\{n\}/g, shortName(n)), q);
  if (q && (event === 'tilt' || event === 'bullied' || event === 'dominated') && Math.random() < (q.excl || 0)) text += Math.random() < 0.5 ? '!!' : '??';
  return { raw, text };
}

// how long they take to "type" it: a moment to react, then a believable typing speed
function typingDelay(text, settle) {
  const react = (settle ? 1200 : 500) + Math.random() * (settle ? 1500 : 900);
  const perChar = 45 + Math.random() * 40;
  return Math.min(7000, react + String(text).length * perChar);
}

// a line's first word ("gg", "nice"…), so a room doesn't get three messages that all open the same way
const opener = t => (String(t).toLowerCase().match(/[a-z’'Ѐ-ӿͰ-Ͽ]+/) || [''])[0];
module.exports = { opener, LINES, ANY, TONES, WEIGHT, NATIVE, LANG, QUIRK0, line, kindOf, shortName, typingDelay, styleText, mash };
