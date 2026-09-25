// What matchmaking's AI players say in chat. Each has a personality (tone) and a chattiness from 0 (hardly ever
// speaks) to 1 (says something most times it could). Lines are picked at random; {n} is who they're talking about.
'use strict';
const LINES = {
  friendly: {
    start: ['gl hf!', 'hey all, gl', 'good luck everyone', 'hi! gl hf', 'o/ have fun'],
    kill: ['got you!', 'sorry {n}!', 'nice try {n}', 'gotcha'],
    ring: ['into the pit you go', 'sorry, had to', 'splash!'],
    died: ['nice shot {n}', 'oof, good one', 'you got me', 'well played {n}'],
    gameWin: ['nice, gg that one', 'phew', 'that was close'],
    gameLose: ['nice one', 'gg, good game', 'you got that one'],
    matchWin: ['gg wp everyone!', 'ggs, that was fun', 'gg! good games'],
    matchLose: ['gg wp, you were better', 'ggs! well played', 'gg, that was fun anyway'],
    reply: ['gg!', 'gl hf!', 'hey!', ':)'],
  },
  cocky: {
    start: ['this will be quick', 'gl, you’ll need it', 'ready to lose?', 'ez'],
    kill: ['too easy', 'sit down {n}', 'next', 'bye {n}', 'is that all?'],
    ring: ['swimming lessons?', 'watch your step', 'bye bye'],
    died: ['lucky', 'lucky shot {n}', 'won’t happen again', 'whatever'],
    gameWin: ['ez', 'told you', 'too easy'],
    gameLose: ['lucky', 'warming up', 'ok that one was lag'],
    matchWin: ['ez gg', 'gg ez', 'never in doubt', 'get good'],
    matchLose: ['gg, got lucky', 'whatever, gg', 'rematch and I win'],
    reply: ['gl, you’ll need it', 'gg ez', 'yeah yeah'],
  },
  salty: {
    start: ['here we go again', 'gl', 'hope the teams are fair this time'],
    kill: ['finally', 'about time', 'there'],
    ring: ['stay down'],
    died: ['how did that hit', 'lag', 'that hitbox is huge', 'bruh', 'are you kidding'],
    gameWin: ['finally', 'about time'],
    gameLose: ['this map is so bad', 'bruh', 'teammates??', 'unreal'],
    matchWin: ['gg', 'gg finally'],
    matchLose: ['gg i guess', 'whatever', 'lag all game', 'gg, cant aim today'],
    reply: ['gg', 'yeah gg', 'k'],
  },
  chill: {
    start: ['yo', 'gl hf', 'sup', 'chill game pls'],
    kill: ['nice', 'got em'],
    ring: ['lol', 'splash'],
    died: ['ha, nice', 'fair', 'lol ok'],
    gameWin: ['nice', 'smooth'],
    gameLose: ['all good', 'eh', 'fair enough'],
    matchWin: ['gg', 'ggs, fun one'],
    matchLose: ['gg', 'gg, fun one', 'ggs'],
    reply: ['gg', 'yo', 'gl'],
  },
  tryhard: {
    start: ['focus up', 'glhf', 'lets go'],
    kill: ['clean', 'tracked', 'one down'],
    ring: ['angles', 'positioning diff'],
    died: ['misread that', 'my bad', 'should have dashed'],
    gameWin: ['clean', 'good round'],
    gameLose: ['reset', 'adjust', 'misplayed that'],
    matchWin: ['gg wp', 'gg, well played'],
    matchLose: ['gg wp', 'gg, need to practise', 'gg, good fights'],
    reply: ['gg wp', 'glhf'],
  },
  wholesome: {
    start: ['good luck everyone, have fun!', 'hi friends! gl', 'have a nice game :)'],
    kill: ['sorry!!', 'oops, sorry {n}', 'nice dodges though'],
    ring: ['sorry about the pit!', 'oh no, sorry'],
    died: ['great shot {n}!', 'wow nice aim', 'you’re really good'],
    gameWin: ['good game!', 'that was fun'],
    gameLose: ['well played!', 'nice teamwork you two', 'good one!'],
    matchWin: ['gg everyone, that was fun! :)', 'ggs! thank you for the games'],
    matchLose: ['gg! you all played so well', 'ggs, thank you!', 'well played everyone :)'],
    reply: ['gg! :)', 'have fun!', 'hi! :)'],
  },
  jokester: {
    start: ['may the best archer win (me)', 'arrows at the ready', 'who brought snacks', 'bow-ties on, lads'],
    kill: ['arrow-derci {n}', 'quiver in fear', 'that’s the point', 'bow down'],
    ring: ['hole in one', 'mind the gap', 'pit happens'],
    died: ['i meant to do that', 'my arrow had other plans', 'the floor was lava apparently'],
    gameWin: ['nailed it', 'nock nock, who’s there? winning'],
    gameLose: ['i was holding back', 'plot twist'],
    matchWin: ['gg, what a quiver', 'ggs, i’ll be here all week'],
    matchLose: ['gg, i’ll get my bow and go', 'ggs, i was aiming for second'],
    reply: ['gg lol', 'hello there', 'hi, i’m the one with the pointy stick'],
  },
  quiet: {
    start: ['gl', 'hf'],
    kill: ['.'],
    ring: [],
    died: ['ns'],
    gameWin: [],
    gameLose: [],
    matchWin: ['gg'],
    matchLose: ['gg'],
    reply: ['gg', 'gl'],
  },
};
const TONES = Object.keys(LINES);
// how likely each kind of moment is to get a line (times the player's chattiness)
const WEIGHT = { start: 0.9, kill: 0.35, ring: 0.5, died: 0.35, gameWin: 0.3, gameLose: 0.3, matchWin: 0.95, matchLose: 0.95, reply: 0.8 };
function line(tone, event, n) {
  const list = (LINES[tone] || LINES.chill)[event] || [];
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)].replace('{n}', n || 'you');
}
module.exports = { LINES, TONES, WEIGHT, line };
