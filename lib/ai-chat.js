// What matchmaking's AI players say in chat. Each has a personality (tone) and a chattiness from 0 (hardly ever
// speaks) to 1 (says something most times it could). Lines are picked at random, skipping anything said recently;
// {n} is who they're talking about, shortened the way a person would ("dave_smith245" becomes "dave").
// A tone without lines for a moment falls back to the shared ones (ANY) — quiet players fall back to nothing.
'use strict';
const LINES = {
  friendly: {
    start: ['gl hf!', 'hey all, gl', 'good luck everyone', 'hi! gl hf', 'o/ have fun', 'gl everyone, lets have a good one', 'hey hey, gl', 'evening all, gl hf'],
    kill: ['got you!', 'sorry {n}!', 'nice try {n}', 'gotcha', 'that one landed', 'close one {n}', 'sorry not sorry {n}'],
    ring: ['into the pit you go', 'sorry, had to', 'splash!', 'oops, mind the edge {n}', 'off you go'],
    died: ['nice shot {n}', 'oof, good one', 'you got me', 'well played {n}', 'ah, nice one', 'didnt see that coming'],
    gameWin: ['nice, gg that one', 'phew', 'that was close', 'nice teamwork', 'yes!'],
    gameLose: ['nice one', 'gg, good game', 'you got that one', 'ah so close', 'next one'],
    matchWin: ['gg wp everyone!', 'ggs, that was fun', 'gg! good games', 'gg all, close games', 'ggs, thanks for the games', 'that was a good one, thanks all', 'nice games everyone', 'fun match, cheers'],
    matchLose: ['gg wp, you were better', 'ggs! well played', 'gg, that was fun anyway', 'gg {n}, you were on fire', 'ggs, got me good', 'well played, you earned that', 'nice one, you were sharp', 'good match, thanks'],
  },
  cocky: {
    start: ['this will be quick', 'gl, you’ll need it', 'ready to lose?', 'ez', 'hope you warmed up', 'try to keep up'],
    kill: ['too easy', 'sit down {n}', 'next', 'bye {n}', 'is that all?', 'who’s next', 'not even close {n}'],
    ring: ['swimming lessons?', 'watch your step', 'bye bye', 'enjoy the pit {n}', 'gravity wins again'],
    died: ['lucky', 'lucky shot {n}', 'won’t happen again', 'whatever', 'enjoy that one {n}, it won’t happen twice'],
    gameWin: ['ez', 'told you', 'too easy', 'as expected'],
    gameLose: ['lucky', 'warming up', 'ok that one was lag', 'i let you have that one'],
    matchWin: ['ez gg', 'gg ez', 'never in doubt', 'get good', 'gg, better luck next time {n}', 'too easy', 'next', 'warm up done'],
    matchLose: ['gg, got lucky', 'whatever, gg', 'rematch and I win', 'gg, i was carrying though', 'fine, you got me', 'lucky arrows today', 'won’t happen twice'],
  },
  salty: {
    start: ['here we go again', 'gl', 'hope the teams are fair this time', 'please dont be this map again', 'lets just get this over with'],
    kill: ['finally', 'about time', 'there', 'stay there {n}'],
    ring: ['stay down', 'good, stay in there'],
    died: ['how did that hit', 'lag', 'that hitbox is huge', 'bruh', 'are you kidding', 'that was nowhere near me', 'cool, cool'],
    gameWin: ['finally', 'about time', 'took long enough'],
    gameLose: ['this map is so bad', 'bruh', 'teammates??', 'unreal', 'every single time', 'ok sure'],
    matchWin: ['gg', 'gg finally', 'gg, about time', 'finally a win', 'about time'],
    matchLose: ['gg i guess', 'whatever', 'lag all game', 'gg, cant aim today', 'gg, matchmaking is broken', 'whatever', 'nope, done', 'unreal lag'],
  },
  chill: {
    start: ['yo', 'gl hf', 'sup', 'chill game pls', 'ayy gl', 'hey'],
    kill: ['nice', 'got em', 'there we go', 'ope'],
    ring: ['lol', 'splash', 'whoops {n}'],
    died: ['ha, nice', 'fair', 'lol ok', 'fair enough', 'nice one {n}'],
    gameWin: ['nice', 'smooth', 'ez clap... jk'],
    gameLose: ['all good', 'eh', 'fair enough', 'oh well'],
    matchWin: ['gg', 'ggs, fun one', 'gg, good vibes', 'nice one all', 'fun one'],
    matchLose: ['gg', 'gg, fun one', 'ggs', 'gg, u guys are good', 'fair play', 'nice one, good vibes', 'all good, fun match'],
  },
  tryhard: {
    start: ['focus up', 'glhf', 'lets go', 'comms on, play the angles', 'no throwing pls'],
    kill: ['clean', 'tracked', 'one down', 'picked', 'trade won'],
    ring: ['angles', 'positioning diff', 'edge control'],
    died: ['misread that', 'my bad', 'should have dashed', 'greedy, my fault', 'respect {n}'],
    gameWin: ['clean', 'good round', 'well played team'],
    gameLose: ['reset', 'adjust', 'misplayed that', 'play the cover next one'],
    matchWin: ['gg wp', 'gg, well played', 'gg, solid games', 'good comms team', 'clean match'],
    matchLose: ['gg wp', 'gg, need to practise', 'gg, good fights', 'gg {n}, clean aim', 'respect, good fights', 'noted, will adjust'],
  },
  wholesome: {
    start: ['good luck everyone, have fun!', 'hi friends! gl', 'have a nice game :)', 'hello hello! gl hf', 'hi all, hope you’re having a good day :)'],
    kill: ['sorry!!', 'oops, sorry {n}', 'nice dodges though', 'sorry {n}, you nearly had me'],
    ring: ['sorry about the pit!', 'oh no, sorry', 'eek, sorry {n}'],
    died: ['great shot {n}!', 'wow nice aim', 'you’re really good', 'that was a lovely shot {n}'],
    gameWin: ['good game!', 'that was fun', 'yay!'],
    gameLose: ['well played!', 'nice teamwork you two', 'good one!', 'you earned that one!'],
    matchWin: ['gg everyone, that was fun! :)', 'ggs! thank you for the games', 'gg! you all played so well', 'thank you all, that was lovely', 'great games everyone!'],
    matchLose: ['gg! you all played so well', 'ggs, thank you!', 'well played everyone :)', 'gg {n}! that was so good', 'you were amazing!', 'that was so fun, thank you!'],
  },
  jokester: {
    start: ['may the best archer win (me)', 'arrows at the ready', 'who brought snacks', 'bow-ties on, lads', 'let’s get to the point', 'i’ve got a quiver full of bad jokes'],
    kill: ['arrow-derci {n}', 'quiver in fear', 'that’s the point', 'bow down', 'you’ve been arrowed', 'straight to the point {n}'],
    ring: ['hole in one', 'mind the gap', 'pit happens', 'that’s the pits {n}', 'drop in anytime'],
    died: ['i meant to do that', 'my arrow had other plans', 'the floor was lava apparently', 'tell my bow i loved it'],
    gameWin: ['nailed it', 'nock nock, who’s there? winning'],
    gameLose: ['i was holding back', 'plot twist', 'arrow-gance got me'],
    matchWin: ['gg, what a quiver', 'ggs, i’ll be here all week', 'and that’s the point', 'bow-ing out a winner'],
    matchLose: ['gg, i’ll get my bow and go', 'ggs, i was aiming for second', 'i’ll take my arrows and go home', 'should have brought a sword'],
  },
  quiet: {
    start: ['gl', 'hf'],
    kill: ['.'],
    died: ['ns'],
    matchWin: ['gg'],
    matchLose: ['gg'],
    greet: ['hi'], gg: ['gg'], glhf: ['gl'], thanks: ['ty'], laugh: [], ez: [], bot: [], praise: ['ty'], ns: ['ty'],
    firstBlood: [], streak: [], selfDie: [], theyFell: [], clutchMe: [], clutchThem: [], decider: [], matchPoint: [], behind: [], stomp: [], stomped: [], closeWin: [], closeLose: [],
  },
};
// shared lines for the moments a tone doesn't cover itself
const ANY = {
  firstBlood: ['first blood', 'first one’s mine', 'and we’re off', 'opening pick'],
  streak: ['three down', 'on a roll', 'heating up', 'cant miss today', 'someone stop me'],
  selfDie: ['did i just walk into that', 'oops', 'ok that one was all me', 'forgot that was there', 'lol my bad', 'who put that there'],
  theyFell: ['lol {n}', 'rip {n}', 'free one', 'thanks {n}', 'careful {n}'],
  clutchMe: ['clutch!', 'did not think i’d win that', 'heart rate: high', 'one v many, easy', 'phew, that was tense'],
  clutchThem: ['ok that was clutch {n}', 'how did {n} win that', 'nice clutch {n}', 'respect, {n}'],
  decider: ['last round, lets go', 'decider, this is it', 'all on this one', 'final round, no pressure', 'here we go, last one'],
  matchPoint: ['one more', 'match point', 'close it out', 'one more round team'],
  behind: ['we can still do this', 'comeback time', 'not over yet', 'lets turn this around'],
  stomp: ['gg, clean sweep', 'clean sweep', 'that went well', 'flawless, nice team'],
  stomped: ['you were too good', 'rough one for us', 'i’ll go practise', 'gg, couldn’t get going'],
  closeWin: ['that was so close', 'that last round was tense', 'could’ve gone either way', 'gg, phew'],
  closeLose: ['so close', 'almost had it', 'that was tight {n}', 'gg, one round off'],
  greet: ['hey {n}', 'hi {n}!', 'yo {n}', 'hey', 'hi', 'hello'],
  gg: ['gg', 'gg wp', 'ggs', 'gg {n}'],
  glhf: ['gl hf', 'you too', 'gl {n}', 'glhf'],
  thanks: ['np', 'no worries', 'anytime'],
  laugh: ['lol', 'haha', 'lmao', ':D'],
  ez: ['was it though', 'ez? we’ll see', 'ok {n}', 'big talk'],
  bot: ['yep, i’m an AI player', 'AI, but i still practise', 'beep boop', 'yes, AI. still got you though'],
  praise: ['ty {n}!', 'thanks!', 'ty ty', 'cheers {n}'],
  ns: ['ty', 'thanks {n}', 'cheers'],
};
// the tone-specific "reply" lines used to cover anything someone says to them
const REPLY_TONE = { friendly: { greet: ['hey {n}!', 'hi {n}! gl'], gg: ['gg {n}!', 'gg wp!'] }, cocky: { greet: ['oh, {n}. hi', 'sup {n}'], gg: ['gg ez', 'gg, you tried'], ez: ['you wish {n}', 'says the one losing'] },
  salty: { greet: ['hey', 'yeah hi'], gg: ['gg', 'yeah gg'], ez: ['shut up {n}', 'ok buddy'] }, wholesome: { greet: ['hi {n}! :)', 'hello {n}!'], gg: ['gg {n}! :)', 'ggs!'], ez: ['aw, gg anyway!'] },
  jokester: { greet: ['hello there', 'hi, i’m the one with the pointy stick'], bot: ['i’m an AI, but my puns are handmade'], laugh: ['i’m here all week'] } };
for (const [t, o] of Object.entries(REPLY_TONE)) Object.assign(LINES[t], o);
const TONES = Object.keys(LINES);

// how likely each kind of moment is to get a line (times the player's chattiness)
const WEIGHT = { start: 0.9, kill: 0.3, ring: 0.45, died: 0.3, gameWin: 0.25, gameLose: 0.25, matchWin: 0.95, matchLose: 0.95,
  firstBlood: 0.5, streak: 0.7, selfDie: 0.6, theyFell: 0.35, clutchMe: 0.9, clutchThem: 0.6, decider: 0.5, matchPoint: 0.35, behind: 0.3,
  stomp: 0.95, stomped: 0.95, closeWin: 0.95, closeLose: 0.95, reply: 0.8 };

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

// pick a line, avoiding ones in `avoid` (recent lines) where it can
function line(tone, event, n, avoid) {
  const own = (LINES[tone] || LINES.chill)[event];
  const list = own && own.length ? own : (own ? [] : ANY[event] || []);
  if (!list.length) return null;
  const fresh = avoid ? list.filter(l => !avoid.has(l)) : list;
  const from = fresh.length ? fresh : list;
  const raw = from[Math.floor(Math.random() * from.length)];
  return { raw, text: raw.replace(/\{n\}/g, shortName(n)) };
}

// how long they take to "type" it: a moment to react, then a believable typing speed
function typingDelay(text, settle) {
  const react = (settle ? 1200 : 500) + Math.random() * (settle ? 1500 : 900);
  const perChar = 45 + Math.random() * 40;
  return Math.min(7000, react + String(text).length * perChar);
}

// a line's first word ("gg", "nice"…), so a room doesn't get three messages that all open the same way
const opener = t => (String(t).toLowerCase().match(/[a-z’']+/) || [''])[0];
module.exports = { opener, LINES, ANY, TONES, WEIGHT, line, kindOf, shortName, typingDelay };
