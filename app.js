/* Mirha's WonderLab — all app logic, no build step needed. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WORLDS = ['english', 'urdu', 'math', 'art'];
const DAILY_GOAL = 10;

/* ---------------- state ---------------- */
const KEY = 'mirhaWonderLab', GKEY = 'mirhaWonderLabGallery';
const DEFAULTS = { v: 2, name: 'Mirha', stars: 0, done: {}, today: { date: '', stars: 0, celebrated: false }, streak: 1, lastDay: '',
  sound: true, mathLv: 1, speedBest: 0, bestCombo: 0, spelled: 0, sentences: 0, artDone: 0, goalsDone: 0, badges: [] };
let S;
try { S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { S = { ...DEFAULTS }; }
S.done = S.done || {}; S.badges = S.badges || [];
let gallery = [];
try { gallery = JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch { gallery = []; }

function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } }
function persistGallery() {
  try { localStorage.setItem(GKEY, JSON.stringify(gallery)); return true; }
  catch { toast('💾 Gallery is full — delete an old picture first.'); return false; }
}

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function checkDay() {
  const t = dayKey();
  if (S.lastDay === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.streak = S.lastDay === dayKey(y) ? S.streak + 1 : 1;
  S.lastDay = t;
  S.today = { date: t, stars: 0, celebrated: false };
  persist();
}

/* ---------------- sound ---------------- */
let actx;
function tone(freqs, { dur = .12, type = 'sine', gap = .09, vol = .18 } = {}) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * gap;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + dur + .15);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + .2);
    });
  } catch { /* audio unsupported */ }
}
const sfx = {
  good: () => tone([660, 880], { type: 'triangle' }),
  bad: () => tone([260, 200], { type: 'sine', vol: .12 }),
  pop: () => tone([520], { dur: .05, vol: .08 }),
  level: () => tone([523, 659, 784, 1047, 1319], { type: 'triangle', gap: .11 }),
  tick: () => tone([900], { dur: .03, vol: .05 })
};

/* ---------------- speech ---------------- */
let voices = [];
const loadVoices = () => { voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; };
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
let warnedUrdu = false;
function speak(text, { lang = 'en-US', rate = .85, auto = false } = {}) {
  if (!('speechSynthesis' in window) || (auto && !S.sound)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = rate; u.pitch = 1.1;
  const norm = v => v.lang.replace('_', '-').toLowerCase();
  const v = voices.find(v => norm(v) === lang.toLowerCase()) || voices.find(v => norm(v).startsWith(lang.slice(0, 2).toLowerCase()));
  if (v) u.voice = v;
  else if (lang.startsWith('ur') && voices.length && !warnedUrdu) { warnedUrdu = true; toast('🔇 This device has no Urdu voice installed — ask a grown-up to read along!'); }
  speechSynthesis.speak(u);
}

/* ---------------- UI helpers ---------------- */
function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}
function burst(from, count = 12) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from?.getBoundingClientRect?.();
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'starsBurst'; s.textContent = ['⭐', '✨', '🌈', '💖'][i % 4];
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--x', (Math.random() * 360 - 180) + 'px');
    s.style.setProperty('--y', (Math.random() * -300 - 20) + 'px');
    document.body.appendChild(s); setTimeout(() => s.remove(), 1000);
  }
}
function feedback(el, msg, good) { el.textContent = msg; el.className = 'feedback ' + (good ? 'good' : 'bad'); }
function bump(id) { const p = $(id); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }

/* modal */
let lastFocus = null;
function openModal(html, actions = [{ label: 'Close' }]) {
  lastFocus = document.activeElement;
  $('modalContent').innerHTML = html;
  const box = $('modalActions'); box.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.textContent = a.label; if (a.cls) b.className = a.cls;
    b.onclick = () => { const keep = a.onClick?.(b); if (keep !== true) closeModal(); };
    box.appendChild(b);
  });
  $('modal').classList.add('on');
  (box.querySelector('.btn-primary, .btn-purple') || box.querySelector('button'))?.focus();
}
function closeModal() { $('modal').classList.remove('on'); lastFocus?.focus?.(); }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('modal').classList.contains('on')) closeModal();
  if (e.key === 'Tab' && $('modal').classList.contains('on')) {
    const f = [...$('modal').querySelectorAll('button, input, a[href]')].filter(x => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------------- progress, levels, badges ---------------- */
const levelOf = s => Math.floor(s / 10) + 1;
const tierOf = n => n >= 30 ? '🥇 Gold' : n >= 15 ? '🥈 Silver' : n >= 5 ? '🥉 Bronze' : n > 0 ? '🌱 Growing' : 'Start!';
const BADGES = [
  { id: 'first', ico: '🌱', name: 'First Star', desc: 'Earn your first star', ok: () => S.stars >= 1 },
  { id: 'b5', ico: '🌟', name: 'Star Starter', desc: 'Collect 5 stars', ok: () => S.stars >= 5 },
  { id: 'b10', ico: '🧠', name: 'Brain Booster', desc: 'Collect 25 stars', ok: () => S.stars >= 25 },
  { id: 'b20', ico: '🏆', name: 'Wonder Champion', desc: 'Collect 50 stars', ok: () => S.stars >= 50 },
  { id: 'b100', ico: '👑', name: 'Century Queen', desc: 'Collect 100 stars', ok: () => S.stars >= 100 },
  { id: 'ball', ico: '🌈', name: 'All-World Explorer', desc: 'Earn a star in every world', ok: () => WORLDS.every(w => S.done[w]) },
  { id: 'goal', ico: '🎯', name: 'Mission Master', desc: 'Finish a daily mission', ok: () => S.goalsDone >= 1 },
  { id: 'streak3', ico: '🔥', name: 'On Fire', desc: 'Learn 3 days in a row', ok: () => S.streak >= 3 },
  { id: 'combo5', ico: '⚡', name: 'Combo Five', desc: '5 right answers in a row', ok: () => S.bestCombo >= 5 },
  { id: 'speed10', ico: '🚀', name: 'Rocket Racer', desc: 'Score 10 in the rocket race', ok: () => S.speedBest >= 10 },
  { id: 'spell5', ico: '🐝', name: 'Spelling Bee', desc: 'Spell 5 words correctly', ok: () => S.spelled >= 5 },
  { id: 'sent3', ico: '🧩', name: 'Sentence Star', desc: 'Build 3 sentences', ok: () => S.sentences >= 3 },
  { id: 'urdu10', ico: '🌙', name: 'Urdu Explorer', desc: 'Earn 10 Urdu stars', ok: () => (S.done.urdu || 0) >= 10 },
  { id: 'art3', ico: '🖼️', name: 'Gallery Artist', desc: 'Finish 3 art missions', ok: () => S.artDone >= 3 }
];
function checkBadges(announce = true) {
  BADGES.forEach(b => {
    if (!S.badges.includes(b.id) && b.ok()) {
      S.badges.push(b.id);
      if (announce) { toast(`🏅 New badge: ${b.ico} ${b.name}!`, 3500); newBadge = b.id; }
    }
  });
}
let newBadge = null;

function addStar(world, n = 1, from) {
  checkDay();
  const before = levelOf(S.stars);
  S.stars += n; S.done[world] = (S.done[world] || 0) + n; S.today.stars += n;
  burst(from); sfx.good(); bump('pillStars');
  if (levelOf(S.stars) > before) {
    setTimeout(() => { sfx.level(); burst(null, 24); toast(`🎉 Level up! You are now Level ${levelOf(S.stars)}!`, 3500); bump('pillLevel'); }, 350);
  }
  if (S.today.stars >= DAILY_GOAL && !S.today.celebrated) {
    S.today.celebrated = true; S.goalsDone++;
    setTimeout(() => {
      sfx.level(); burst(null, 30);
      openModal(`<div style="font-size:70px">🎯</div><h2 id="modalTitle">Mission complete!</h2><p>You earned ${DAILY_GOAL} stars today, ${esc(S.name)}. Your brain is super strong! 💪</p>`, [{ label: 'Keep playing ✨', cls: 'btn-primary' }]);
      speak(`Mission complete! Amazing work, ${S.name}!`, { auto: true });
    }, 900);
  }
  checkBadges(); persist(); render();
}

function render() {
  document.querySelectorAll('[data-name]').forEach(e => e.textContent = S.name);
  $('stars').textContent = S.stars;
  $('level').textContent = levelOf(S.stars);
  $('streak').textContent = S.streak; $('streakWord').textContent = S.streak === 1 ? 'day' : 'days';
  const g = Math.min(S.today.stars, DAILY_GOAL);
  $('goalRing').style.background = `conic-gradient(var(--green) ${g / DAILY_GOAL * 360}deg, #ece8fb 0)`;
  $('goalRing').setAttribute('aria-label', `Daily goal: ${g} of ${DAILY_GOAL} stars`);
  $('goalNum').textContent = S.today.stars >= DAILY_GOAL ? '✅' : `${g}/${DAILY_GOAL}`;
  $('goalSub').textContent = S.today.stars >= DAILY_GOAL ? `Mission done! You earned ${S.today.stars} stars today 🎉` :
    `${DAILY_GOAL - g} more star${DAILY_GOAL - g === 1 ? '' : 's'} to go — try a different world for a surprise!`;
  const into = S.stars % 10;
  $('lvlFill').style.width = into * 10 + '%';
  $('lvlText').textContent = `${10 - into} star${10 - into === 1 ? '' : 's'} to Level ${levelOf(S.stars) + 1}`;
  WORLDS.forEach(w => {
    const n = S.done[w] || 0;
    $('p-' + w).style.width = Math.min(100, n / 30 * 100) + '%';
    $('m-' + w).textContent = `${n} star${n === 1 ? '' : 's'}`;
    $('t-' + w).textContent = tierOf(n);
  });
  $('badgeShelf').innerHTML = BADGES.map(b => {
    const on = S.badges.includes(b.id);
    return `<div class="badge${on ? ' on' : ''}${b.id === newBadge ? ' new' : ''}" title="${esc(b.desc)}"><span class="b-ico" aria-hidden="true">${on ? b.ico : '🔒'}</span><div><b>${b.name}</b><small>${on ? 'Unlocked!' : esc(b.desc)}</small></div></div>`;
  }).join('');
  newBadge = null;
  $('badgeCount').textContent = `${S.badges.length} of ${BADGES.length} unlocked`;
  $('soundBtn').textContent = S.sound ? '🔊' : '🔇';
  $('soundBtn').setAttribute('aria-pressed', S.sound); $('soundBtn').setAttribute('aria-label', S.sound ? 'Sound on' : 'Sound off');
  $('speedBest').textContent = S.speedBest;
}

/* ---------------- worlds / panels ---------------- */
let current = null;
function openWorld(id) {
  closePanels(false);
  current = id;
  const p = $(id); p.classList.add('active');
  document.querySelector(`.world[data-world="${id}"]`).setAttribute('aria-expanded', 'true');
  p.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  p.focus({ preventScroll: true });
  sfx.pop();
  if (id === 'art') resizeCanvasHint();
}
function closePanels(returnFocus = true) {
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.world').forEach(x => x.setAttribute('aria-expanded', 'false'));
  if (returnFocus && current) document.querySelector(`.world[data-world="${current}"]`)?.focus();
  if (returnFocus) current = null;
}
document.querySelectorAll('.world').forEach(w => w.addEventListener('click', () => {
  if (w.getAttribute('aria-expanded') === 'true') closePanels(); else openWorld(w.dataset.world);
}));
document.querySelectorAll('.closeBtn').forEach(b => b.addEventListener('click', () => closePanels()));

/* combo counters per game */
const combos = {};
function combo(key, ok) {
  combos[key] = ok ? (combos[key] || 0) + 1 : 0;
  if (combos[key] > S.bestCombo) S.bestCombo = combos[key];
  const el = $(key + 'Combo');
  if (el) el.textContent = combos[key] >= 2 ? `🔥 ×${combos[key]}` : '';
  return combos[key];
}
/* build a set of choice buttons; onPick(btn, value) returns true when correct to lock the group */
function choiceButtons(box, values, correct, { cls = '', onCorrect, onWrong } = {}) {
  box.innerHTML = '';
  values.forEach(v => {
    const b = document.createElement('button');
    b.className = 'choice ' + cls; b.textContent = v;
    b.onclick = () => {
      if (b.disabled) return;
      if (v === correct) {
        b.classList.add('correct');
        box.querySelectorAll('button').forEach(x => x.disabled = true);
        b.disabled = false; b.style.pointerEvents = 'none';
        onCorrect?.(b);
      } else { b.classList.add('wrong'); b.disabled = true; sfx.bad(); onWrong?.(b); }
    };
    box.appendChild(b);
  });
}

/* ---------------- ENGLISH ---------------- */
const ENG = [['🍎', 'apple'], ['🍌', 'banana'], ['🐘', 'elephant'], ['🌈', 'rainbow'], ['📚', 'book'], ['🦋', 'butterfly'], ['🚀', 'rocket'], ['🌸', 'flower'],
  ['✏️', 'pencil'], ['🏠', 'house'], ['🐯', 'tiger'], ['🐰', 'rabbit'], ['🌙', 'moon'], ['⭐', 'star'], ['☁️', 'cloud'], ['🌳', 'tree'], ['🐟', 'fish'],
  ['🎸', 'guitar'], ['☂️', 'umbrella'], ['🚗', 'car'], ['🎂', 'cake'], ['🪁', 'kite'], ['🐧', 'penguin'], ['🦁', 'lion'], ['🤖', 'robot'], ['🐱', 'cat'],
  ['🐶', 'dog'], ['☀️', 'sun'], ['⚽', 'ball'], ['🚂', 'train'], ['👑', 'crown'], ['🍕', 'pizza'], ['🐦', 'bird'], ['🐢', 'turtle'], ['🦒', 'giraffe'], ['🍉', 'watermelon']];
let engQ, lastEng;
function newEnglish() {
  do engQ = pick(ENG); while (engQ === lastEng); lastEng = engQ;
  $('engEmoji').textContent = engQ[0];
  const others = shuffle(ENG.filter(x => x !== engQ)).slice(0, 3).map(x => x[1]);
  $('engFeed').textContent = '';
  choiceButtons($('engChoices'), shuffle([engQ[1], ...others]), engQ[1], {
    onCorrect: b => {
      const c = combo('eng', true);
      feedback($('engFeed'), c >= 3 ? `Wow, ${c} in a row! +1 ⭐` : pick(['Amazing! +1 ⭐', 'You got it! +1 ⭐', 'Super smart! +1 ⭐']), true);
      speak(engQ[1], { auto: true }); addStar('english', 1, b); setTimeout(newEnglish, 1200);
    },
    onWrong: () => { combo('eng', false); feedback($('engFeed'), 'Good try — tap 🔊 and listen again!', false); }
  });
}
$('engListen').onclick = () => speak(engQ[1]);
$('engSkip').onclick = () => { combo('eng', false); newEnglish(); };

/* spelling */
let spell, spellTries = 0, hintStep = 0, spellNum = 1;
const SPELL = ENG.filter(x => x[1].length <= 8);
function newSpell() {
  let n; do n = pick(SPELL); while (n === spell); spell = n;
  spellTries = 0; hintStep = 0;
  $('spellEmoji').textContent = '❓'; $('spellHint').textContent = ''; $('spellInput').value = ''; $('spellFeed').textContent = '';
  $('spellCount').textContent = `Word ${spellNum}`;
}
function showHint() {
  const w = spell[1]; hintStep++;
  if (hintStep >= 1) $('spellEmoji').textContent = spell[0];
  if (hintStep >= 2) {
    const shown = Math.min(w.length - 1, hintStep - 1);
    $('spellHint').textContent = w.split('').map((ch, i) => i < shown ? ch : '_').join(' ');
  }
}
$('spellForm').onsubmit = e => {
  e.preventDefault();
  const v = $('spellInput').value.trim().toLowerCase();
  if (!v) { $('spellInput').focus(); speak(spell[1]); return; }
  if (v === spell[1]) {
    const bonus = hintStep === 0 && spellTries === 0 ? 1 : 0;
    feedback($('spellFeed'), bonus ? 'Perfect — first try, no hints! +2 ⭐' : 'Perfect spelling! +1 ⭐', true);
    S.spelled++; spellNum++; combo('spell', true);
    $('spellEmoji').textContent = spell[0]; $('spellHint').textContent = spell[1].split('').join(' ');
    addStar('english', 1 + bonus, $('spellInput'));
    setTimeout(() => { newSpell(); speak(spell[1], { auto: true }); }, 1500);
  } else {
    spellTries++; sfx.bad(); combo('spell', false);
    if (spellTries >= 3) {
      feedback($('spellFeed'), `It's spelled “${spell[1]}”. Let's try a new word!`, false);
      $('spellHint').textContent = spell[1].split('').join(' '); $('spellEmoji').textContent = spell[0];
      speak(`${spell[1]}. ${spell[1].split('').join(', ')}`, { auto: true, rate: .7 });
      setTimeout(newSpell, 3000);
    } else {
      showHint();
      feedback($('spellFeed'), spellTries === 1 ? 'Almost! Here is a picture clue 👀' : 'So close! Look at the letters 💡', false);
    }
  }
};
$('spellListen').onclick = () => { speak(spell[1]); $('spellInput').focus(); };
$('spellSlow').onclick = () => { speak(spell[1], { rate: .5 }); $('spellInput').focus(); };
$('spellHintBtn').onclick = () => { showHint(); $('spellInput').focus(); };

/* sentence builder */
const SENT = [['🐱☀️', 'The cat sleeps in the sun'], ['🐶⚽', 'My dog plays with a ball'], ['👧🎨', 'I love to paint pictures'], ['🌙⭐', 'The moon and stars shine'],
  ['🍎😋', 'I eat a red apple'], ['🚀🌍', 'The rocket flies to space'], ['🐟💧', 'Fish swim in the water'], ['🇵🇰💚', 'I love my Pakistan'],
  ['📚😊', 'Reading books is fun'], ['🌳🐦', 'A bird sits in the tree'], ['🎤🎶', 'I like to sing songs'], ['🏙️✨', 'Kuala Lumpur has tall towers']];
let sent, built = [];
function newSentence() {
  let n; do n = pick(SENT); while (n === sent); sent = n;
  built = []; $('sentEmoji').textContent = sent[0]; $('sentFeed').textContent = '';
  const words = sent[1].split(' ');
  let order; do order = shuffle(words.map((w, i) => i)); while (order.every((v, i) => v === i) && words.length > 1);
  $('sentTiles').innerHTML = '';
  order.forEach(i => {
    const b = document.createElement('button');
    b.className = 'wordtile'; b.textContent = words[i]; b.dataset.i = i;
    b.onclick = () => { built.push(b); b.classList.add('used'); sfx.pop(); drawSlots(); };
    $('sentTiles').appendChild(b);
  });
  drawSlots();
}
function drawSlots() {
  $('sentSlots').innerHTML = '';
  built.forEach((t, k) => {
    const s = document.createElement('button');
    s.className = 'wordtile'; s.textContent = t.textContent; s.setAttribute('aria-label', `Remove ${t.textContent}`);
    s.onclick = () => { built.splice(k, 1); t.classList.remove('used'); drawSlots(); };
    $('sentSlots').appendChild(s);
  });
}
$('sentUndo').onclick = () => { const t = built.pop(); if (t) { t.classList.remove('used'); drawSlots(); } };
$('sentListen').onclick = () => speak(sent[1]);
$('sentCheck').onclick = () => {
  const words = sent[1].split(' ');
  if (built.length < words.length) { feedback($('sentFeed'), `Use all ${words.length} words to finish the sentence.`, false); return; }
  if (built.map(t => t.textContent).join(' ') === sent[1]) {
    feedback($('sentFeed'), '🧩 Brilliant sentence! +2 ⭐', true); S.sentences++;
    speak(sent[1], { auto: true }); addStar('english', 2, $('sentCheck')); setTimeout(newSentence, 1800);
  } else {
    sfx.bad();
    const firstWrong = built.findIndex((t, i) => t.textContent !== words[i]);
    feedback($('sentFeed'), `Nearly! Word ${firstWrong + 1} is in the wrong place — tap it to take it back.`, false);
  }
};

/* ---------------- URDU ---------------- */
const URDU = [['📖', 'کتاب', 'kitaab', 'book'], ['🍎', 'سیب', 'seb', 'apple'], ['🏠', 'گھر', 'ghar', 'house'], ['🌙', 'چاند', 'chaand', 'moon'],
  ['☀️', 'سورج', 'sooraj', 'sun'], ['💧', 'پانی', 'paani', 'water'], ['🌸', 'پھول', 'phool', 'flower'], ['🐱', 'بلی', 'billi', 'cat'],
  ['🌳', 'درخت', 'darakht', 'tree'], ['🚗', 'گاڑی', 'gaari', 'car'], ['✏️', 'قلم', 'qalam', 'pen'], ['🐟', 'مچھلی', 'machhli', 'fish'],
  ['🐦', 'چڑیا', 'chirya', 'bird'], ['⭐', 'ستارہ', 'sitaara', 'star'], ['🫓', 'روٹی', 'roti', 'bread'], ['🥭', 'آم', 'aam', 'mango'],
  ['🐴', 'گھوڑا', 'ghora', 'horse'], ['🦁', 'شیر', 'sher', 'lion'], ['🔑', 'چابی', 'chaabi', 'key'], ['🦋', 'تتلی', 'titli', 'butterfly'],
  ['✈️', 'جہاز', 'jahaaz', 'aeroplane'], ['🍅', 'ٹماٹر', 'tamaatar', 'tomato']];
let urQ, lastUr;
function newUrdu() {
  do urQ = pick(URDU); while (urQ === lastUr); lastUr = urQ;
  $('urduEmoji').textContent = urQ[0]; $('urduFeed').textContent = ''; $('urduLearned').classList.remove('on');
  const others = shuffle(URDU.filter(x => x !== urQ)).slice(0, 3).map(x => x[1]);
  choiceButtons($('urduChoices'), shuffle([urQ[1], ...others]), urQ[1], {
    cls: 'urdu',
    onCorrect: b => {
      combo('urdu', true);
      feedback($('urduFeed'), pick(['شاباش! ⭐', 'بہت خوب! ⭐', 'زبردست! ⭐']), true);
      $('urduLearned').innerHTML = `✨ <b>${urQ[1]}</b> (${urQ[2]}) means <b>${urQ[3]}</b>`; $('urduLearned').classList.add('on');
      speak(urQ[1], { lang: 'ur-PK', auto: true }); addStar('urdu', 1, b); setTimeout(newUrdu, 2200);
    },
    onWrong: () => { combo('urdu', false); feedback($('urduFeed'), 'دوبارہ کوشش کریں 💪', false); }
  });
}
const LETTERS = [['ا', 'alif', 'انار'], ['ب', 'bay', 'بلی'], ['پ', 'pay', 'پانی'], ['ت', 'tay', 'تتلی'], ['ٹ', 'ttay', 'ٹماٹر'], ['ج', 'jeem', 'جہاز'],
  ['چ', 'chay', 'چاند'], ['د', 'daal', 'درخت'], ['ر', 'ray', 'روٹی'], ['س', 'seen', 'سیب'], ['ش', 'sheen', 'شیر'], ['ک', 'kaaf', 'کتاب'],
  ['گ', 'gaaf', 'گھر'], ['م', 'meem', 'مچھلی'], ['ق', 'qaaf', 'قلم'], ['پ', 'pay', 'پھول']];
const LETTER_POOL = [...new Set([...URDU.map(x => x[1]), ...LETTERS.map(x => x[2])])];
let letQ, lastLet;
function newLetter() {
  do letQ = pick(LETTERS); while (letQ === lastLet); lastLet = letQ;
  const L = letQ[0];
  $('urduLetter').textContent = L; $('letterFeed').textContent = '';
  const clash = w => w[0] === L || (L === 'ا' && w[0] === 'آ');
  const others = shuffle(LETTER_POOL.filter(w => !clash(w))).slice(0, 3);
  choiceButtons($('letterChoices'), shuffle([letQ[2], ...others]), letQ[2], {
    cls: 'urdu',
    onCorrect: b => { feedback($('letterFeed'), `شاباش! “${letQ[1]}” ⭐`, true); speak(letQ[2], { lang: 'ur-PK', auto: true }); addStar('urdu', 1, b); setTimeout(newLetter, 1500); },
    onWrong: () => feedback($('letterFeed'), `Look for a word that starts with “${letQ[1]}”`, false)
  });
}
$('letterListen').onclick = () => speak(letQ[0], { lang: 'ur-PK' });

/* ---------------- MATH ---------------- */
function makeQ(lv) {
  const r = (a, b) => a + rand(b - a + 1);
  const ops = lv === 1 ? ['+', '-'] : lv === 2 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = pick(ops); let a, b, ans;
  if (op === '+') { const m = lv === 1 ? 9 : lv === 2 ? 20 : 50; a = r(1, m); b = r(1, lv === 1 ? 10 - a || 1 : m); ans = a + b; }
  if (op === '-') { const m = lv === 1 ? 10 : lv === 2 ? 20 : 60; a = r(2, m); b = r(1, a); ans = a - b; }
  if (op === '×') { a = r(2, lv === 2 ? 5 : 10); b = r(1, lv === 2 ? 5 : 10); ans = a * b; }
  if (op === '÷') { b = r(2, 10); ans = r(1, 10); a = b * ans; }
  const opts = new Set([ans]);
  const spread = Math.max(4, Math.round(ans * .3));
  while (opts.size < 4) { const o = ans + r(-spread, spread); if (o >= 0) opts.add(o); }
  return { text: `${a} ${op} ${b} = ?`, say: `${a} ${{ '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divided by' }[op]} ${b}`, ans, opts: shuffle([...opts]) };
}
function newMath() {
  const q = makeQ(S.mathLv);
  $('mathQ').textContent = q.text; $('mathFeed').textContent = '';
  choiceButtons($('mathChoices'), q.opts, q.ans, {
    onCorrect: b => {
      const c = combo('math', true);
      feedback($('mathFeed'), c >= 3 ? `🔥 ${c} in a row! Rocket boost! ⭐` : pick(['Mission complete! ⭐', 'Out of this world! ⭐', 'Correct, astronaut! ⭐']), true);
      addStar('math', 1, b);
      if (c === 6 && S.mathLv < 3) toast('🚀 You are flying! Try the next level up there ↗');
      setTimeout(newMath, 900);
    },
    onWrong: () => { combo('math', false); feedback($('mathFeed'), 'Not quite — try another answer!', false); }
  });
}
function setLevel(lv) {
  S.mathLv = lv; persist();
  document.querySelectorAll('#mathLevels button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.lv === lv));
  newMath();
}
document.querySelectorAll('#mathLevels button').forEach(b => b.onclick = () => setLevel(+b.dataset.lv));

/* speed race */
const RACE = 60; let raceOn = false, raceT, raceLeft, raceScore;
function raceQ() {
  const q = makeQ(S.mathLv);
  $('speedQ').textContent = q.text;
  const box = $('speedChoices'); box.innerHTML = '';
  q.opts.forEach(v => {
    const b = document.createElement('button');
    b.className = 'choice'; b.textContent = v;
    b.onclick = () => {
      if (!raceOn) return;
      if (v === q.ans) { raceScore++; $('speedScore').textContent = raceScore; addStar('math', 1, b); raceQ(); }
      else { b.classList.add('wrong'); b.disabled = true; sfx.bad(); }
    };
    box.appendChild(b);
  });
}
function startRace() {
  if (raceOn) return;
  raceOn = true; raceLeft = RACE; raceScore = 0;
  $('speedScore').textContent = 0; $('timer').textContent = RACE;
  $('speedArea').hidden = false; $('speedIntro').hidden = true; $('speedStart').hidden = true;
  $('speedBar').style.transition = 'none'; $('speedBar').style.transform = 'scaleX(1)';
  void $('speedBar').offsetWidth; $('speedBar').style.transition = '';
  raceQ(); $('speedChoices').querySelector('button')?.focus();
  raceT = setInterval(() => {
    raceLeft--; $('timer').textContent = raceLeft;
    $('speedBar').style.transform = `scaleX(${raceLeft / RACE})`;
    if (raceLeft <= 5 && raceLeft > 0) sfx.tick();
    if (raceLeft <= 0) endRace();
  }, 1000);
}
function endRace() {
  clearInterval(raceT); raceOn = false;
  $('speedArea').hidden = true; $('speedIntro').hidden = false; $('speedStart').hidden = false; $('speedStart').textContent = '🔁 Race again';
  const best = raceScore > S.speedBest;
  if (best) S.speedBest = raceScore;
  checkBadges(); persist(); render();
  sfx.level();
  openModal(`<div style="font-size:70px">${best ? '🏆' : '🚀'}</div><h2 id="modalTitle">${best ? 'New record!' : 'Rocket landed!'}</h2><p>You answered <b>${raceScore}</b> question${raceScore === 1 ? '' : 's'} correctly${best ? ' — your best ever!' : `. Your best is ${S.speedBest}.`}</p>`,
    [{ label: '🔁 Race again', cls: 'btn-primary', onClick: () => setTimeout(startRace, 50) }, { label: 'Done' }]);
}
$('speedStart').onclick = startRace;

/* number keys 1–4 answer the visible math question */
document.addEventListener('keydown', e => {
  if (current !== 'math' || $('modal').classList.contains('on') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const n = +e.key; if (n < 1 || n > 4) return;
  const box = raceOn ? $('speedChoices') : $('mathChoices');
  box.querySelectorAll('button')[n - 1]?.click();
});

/* ---------------- ART ---------------- */
const COLORS = ['#231c52', '#ff5b6e', '#ff9f1c', '#ffd23f', '#22c38e', '#01411c', '#35a0ff', '#6d4dff', '#ff5fa8', '#8b5a2b', '#ffffff'];
const STAMPS = ['⭐', '💖', '🌸', '🦋', '🌈', '☁️', '🐱', '🌙', '🇵🇰', '🏙️'];
const cv = $('paint'), ctx = cv.getContext('2d', { willReadFrequently: true });
let color = COLORS[7], tool = 'brush', stamp = null, drawing = false, last = null, history = [], usedColors = new Set(), strokes = 0, artClaimed = false;
function fillWhite() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
fillWhite();
function resizeCanvasHint() { /* canvas uses CSS aspect-ratio; nothing to do but keep hook for future */ }

$('palette').innerHTML = COLORS.map(c => `<button class="color" style="background:${c}" data-c="${c}" aria-label="Color ${c}" aria-pressed="${c === color}"></button>`).join('') +
  `<input type="color" class="custom-color" id="customColor" value="#00bcd4" aria-label="Pick any color" title="Pick any color">`;
function setColor(c) {
  color = c; if (tool !== 'fill') setTool('brush');
  document.querySelectorAll('#palette .color').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === c));
  updateDot();
}
$('palette').addEventListener('click', e => { const b = e.target.closest('.color'); if (b) { setColor(b.dataset.c); sfx.pop(); } });
$('customColor').addEventListener('input', e => setColor(e.target.value));

$('stamps').innerHTML = STAMPS.map(s => `<button class="stamp" data-s="${s}" aria-pressed="false" aria-label="Sticker ${s}">${s}</button>`).join('');
$('stamps').addEventListener('click', e => {
  const b = e.target.closest('.stamp'); if (!b) return;
  if (tool === 'stamp' && stamp === b.dataset.s) setTool('brush'); else { stamp = b.dataset.s; setTool('stamp'); }
});
function setTool(t) {
  tool = t;
  $('toolBrush').setAttribute('aria-pressed', t === 'brush'); $('toolEraser').setAttribute('aria-pressed', t === 'eraser'); $('toolFill').setAttribute('aria-pressed', t === 'fill');
  document.querySelectorAll('.stamp').forEach(b => b.setAttribute('aria-pressed', t === 'stamp' && b.dataset.s === stamp));
  cv.style.cursor = t === 'fill' ? 'cell' : t === 'stamp' ? 'copy' : 'crosshair';
  updateDot();
}
$('toolBrush').onclick = () => setTool('brush'); $('toolEraser').onclick = () => setTool('eraser'); $('toolFill').onclick = () => setTool('fill');
function updateDot() { const s = Math.max(4, Math.min(28, +$('brush').value)); $('brushDot').style.cssText = `width:${s}px;height:${s}px;background:${tool === 'eraser' ? '#ddd' : color}`; }
$('brush').addEventListener('input', updateDot); updateDot();

function snapshot() { history.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (history.length > 10) history.shift(); $('undoBtn').disabled = false; }
$('undoBtn').onclick = () => { const h = history.pop(); if (h) ctx.putImageData(h, 0, 0); $('undoBtn').disabled = !history.length; sfx.pop(); };
function markColor(c) { if (c.toLowerCase() !== '#ffffff') usedColors.add(c.toLowerCase()); $('artColors').textContent = `Colors used: ${Math.min(usedColors.size, 3)}/3${usedColors.size >= 3 ? ' ✅' : ''}`; }

function pos(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); snapshot();
  const [x, y] = pos(e); const size = +$('brush').value * (cv.width / cv.getBoundingClientRect().width);
  if (tool === 'fill') { floodFill(Math.round(x), Math.round(y), color); markColor(color); strokes++; sfx.pop(); return; }
  if (tool === 'stamp') { ctx.font = `${Math.max(40, size * 5)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(stamp, x, y); strokes++; sfx.pop(); return; }
  drawing = true; last = [x, y]; cv.setPointerCapture(e.pointerId);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size; ctx.strokeStyle = ctx.fillStyle = tool === 'eraser' ? '#fff' : color;
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
  if (tool === 'brush') markColor(color);
});
cv.addEventListener('pointermove', e => {
  if (!drawing) return;
  const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  ctx.beginPath(); ctx.moveTo(...last);
  pts.forEach(p => { const q = pos(p); ctx.lineTo(...q); last = q; });
  ctx.stroke();
});
const stop = () => { if (drawing) strokes++; drawing = false; };
cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);

function floodFill(x, y, hex) {
  const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width, H = cv.height;
  const n = parseInt(hex.slice(1), 16), fr = n >> 16 & 255, fg = n >> 8 & 255, fb = n & 255;
  const i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 10) return;
  const match = i => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) < 90;
  const seen = new Uint8Array(W * H), stack = [x, y];
  while (stack.length) {
    const py = stack.pop(); let px = stack.pop();
    let p = py * W + px;
    while (px >= 0 && !seen[p] && match(p * 4)) { px--; p--; }
    px++; p++;
    let up = false, down = false;
    while (px < W && !seen[p] && match(p * 4)) {
      seen[p] = 1; const i = p * 4; d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
      if (py > 0) { const q = p - W; if (!seen[q] && match(q * 4)) { if (!up) { stack.push(px, py - 1); up = true; } } else up = false; }
      if (py < H - 1) { const q = p + W; if (!seen[q] && match(q * 4)) { if (!down) { stack.push(px, py + 1); down = true; } } else down = false; }
      px++; p++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function resetCanvasState() { usedColors.clear(); strokes = 0; artClaimed = false; markColor('#ffffff'); }
$('clearBtn').onclick = () => {
  if (strokes === 0) return;
  openModal(`<div style="font-size:60px">🧽</div><h2 id="modalTitle">Clear your canvas?</h2><p>You can press Undo straight after if you change your mind.</p>`,
    [{ label: 'Yes, clear it', cls: 'btn-primary', onClick: () => { snapshot(); fillWhite(); resetCanvasState(); } }, { label: 'Keep drawing' }]);
};
function download(dataUrl, name) { const a = document.createElement('a'); a.download = name; a.href = dataUrl; a.click(); }
$('saveBtn').onclick = () => { download(cv.toDataURL('image/png'), `${S.name}-WonderLab-Art-${dayKey()}.png`); toast('💾 Artwork downloaded!'); };

function thumb() {
  const t = document.createElement('canvas'); t.width = 480; t.height = 270;
  t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', .75);
}
function addToGallery(title) {
  gallery.unshift({ src: thumb(), title: title || 'My artwork', date: new Date().toLocaleDateString() });
  if (gallery.length > 12) gallery.length = 12;
  while (!persistGallery() && gallery.length > 1) gallery.pop();
  renderGallery();
}
$('galleryBtn').onclick = () => {
  if (strokes === 0) { toast('🖌️ Draw something first!'); return; }
  addToGallery(artPrompt[1]); toast('🖼️ Added to your gallery!'); sfx.good();
};
function renderGallery() {
  const g = $('gallery');
  if (!gallery.length) { g.innerHTML = `<div class="empty" style="grid-column:1/-1">🖼️ Your gallery is empty — finish a creative mission or tap “Add to gallery” to hang your first masterpiece!</div>`; return; }
  g.innerHTML = gallery.map((a, i) => `<figure><button class="btn-ghost" style="padding:0;border:0;box-shadow:none" data-view="${i}" aria-label="View ${esc(a.title)}"><img src="${a.src}" alt="${esc(a.title)}" loading="lazy"></button><figcaption>${esc(a.title)} · ${esc(a.date)}</figcaption><button class="del" data-del="${i}" aria-label="Delete ${esc(a.title)}">✕</button></figure>`).join('');
}
$('gallery').addEventListener('click', e => {
  const v = e.target.closest('[data-view]'), d = e.target.closest('[data-del]');
  if (v) { const a = gallery[+v.dataset.view]; openModal(`<h2 id="modalTitle">${esc(a.title)}</h2><img src="${a.src}" alt="${esc(a.title)}" style="border-radius:16px;border:3px solid var(--line);width:100%"><p>${esc(a.date)}</p>`, [{ label: '💾 Download', cls: 'btn-primary', onClick: () => download(a.src, `${S.name}-${a.title}.jpg`) }, { label: 'Close' }]); }
  if (d) { gallery.splice(+d.dataset.del, 1); persistGallery(); renderGallery(); }
});

const PROMPTS = [['🌈🏠🌳', 'Draw a happy place'], ['🐱🐶', 'Draw your dream pet'], ['🏙️🌙', 'Draw the Petronas Towers at night'], ['🇵🇰💚', 'Draw the flag of Pakistan with things you love'],
  ['🤖✨', 'Draw a robot friend like Mimi'], ['🎤🎶', 'Draw yourself singing on a stage'], ['🦄☁️', 'Draw a unicorn in the clouds'], ['🌊🐠', 'Draw an underwater world'],
  ['🚀🪐', 'Draw your own planet'], ['🍰🎂', 'Design the yummiest birthday cake'], ['🌸🦋', 'Draw a garden full of butterflies'], ['👨‍👩‍👧💖', 'Draw your family']];
let artPrompt = PROMPTS[0];
function newPrompt() {
  let n; do n = pick(PROMPTS); while (n === artPrompt); artPrompt = n;
  artClaimed = false; $('artEmoji').textContent = n[0]; $('artPrompt').textContent = `${n[1]} using at least three colors.`; $('artFeed').textContent = '';
}
$('newPrompt').onclick = newPrompt;
$('finishArt').onclick = () => {
  if (artClaimed) { feedback($('artFeed'), 'You already got stars for this one — try a 🎲 new idea!', false); return; }
  if (strokes < 3) { feedback($('artFeed'), 'Draw a little more first — fill the canvas with ideas! 🖌️', false); return; }
  if (usedColors.size < 3) { feedback($('artFeed'), `Use ${3 - usedColors.size} more color${3 - usedColors.size === 1 ? '' : 's'} to finish the mission 🎨`, false); return; }
  artClaimed = true; S.artDone++; strokes = 0; usedColors.clear();
  feedback($('artFeed'), 'Masterpiece complete! +3 ⭐ and saved to your gallery 🖼️', true);
  addToGallery(artPrompt[1]); addStar('art', 3, $('finishArt'));
};

/* ---------------- extras ---------------- */
const FACTS = ["Pakistan's national flower is the jasmine (chambeli).", 'K2 in Pakistan is the second-highest mountain in the world!', "Pakistan's national animal is the markhor, a goat with twisty horns.",
  'The Petronas Twin Towers in Kuala Lumpur have 88 floors each!', 'Urdu is written from right to left.', "Malaysia's national flower is the hibiscus (bunga raya).",
  'The Badshahi Mosque in Lahore can hold 100,000 people.', "Mango is Pakistan's national fruit — yum! 🥭", 'Pakistan has one of the highest paved roads in the world: the Karakoram Highway.',
  'Dil Dil Pakistan was first sung by the band Vital Signs in 1987. 🎶', 'The Pakistani flag is green and white with a crescent moon and a star. 🇵🇰'];
let factI = 0;
$('factBtn').onclick = () => { factI = (factI + 1) % FACTS.length; $('funFact').textContent = FACTS[factI]; speak(FACTS[factI], { auto: true }); };

const TIPS = {
  english: ['Say each word out loud after you hear it — it helps your brain remember!', 'Stuck on spelling? Tap 🐢 to hear it slowly.', 'In the sentence builder, sentences start with a capital letter!'],
  urdu: ['Urdu is read from right to left — start on the right side!', 'After you get one right, read the English meaning to learn the word.', 'Tap 🔊 to hear the letter sound.'],
  math: ['For adding, start with the bigger number and count up.', 'Press keys 1 to 4 to answer quickly on a keyboard!', 'Try Hard mode when Easy feels too easy 🔥'],
  art: ['Try the 🪣 fill bucket to colour big shapes in one tap.', 'Stickers make your picture sparkle ⭐', 'Made a mistake? Undo is your friend ↩'],
  none: ['Try one activity in every world to unlock the All-World Explorer badge!', 'Earn 10 stars today to finish your Super Mission 🎯', 'Come back tomorrow to grow your 🔥 streak!', 'Your art does not need to be perfect — make it yours!']
};
$('mascotBtn').onclick = () => {
  const tip = pick(TIPS[current] || TIPS.none);
  openModal(`<div style="font-size:70px">🤖</div><h2 id="modalTitle">Mimi says…</h2><p style="font-size:19px">${esc(tip)}</p>`, [{ label: 'Thanks, Mimi! 💜', cls: 'btn-primary' }]);
  speak(tip, { auto: true });
};

$('certBtn').onclick = () => {
  const locked = S.stars < 10;
  if (locked) {
    openModal(`<div style="font-size:70px">🔒🎓</div><h2 id="modalTitle">Almost there!</h2><p>Earn <b>${10 - S.stars}</b> more star${10 - S.stars === 1 ? '' : 's'} to unlock your WonderLab certificate.</p><div class="lvlbar" style="margin:10px auto"><i style="width:${S.stars * 10}%"></i></div>`, [{ label: "Let's go! 🚀", cls: 'btn-primary', onClick: () => openWorld(pick(WORLDS)) }, { label: 'Close' }]);
    return;
  }
  const title = S.stars >= 100 ? 'Grand Wonder Master' : S.stars >= 50 ? 'Wonder Champion' : S.stars >= 25 ? 'Brilliant Explorer' : 'Super Learner';
  openModal(`<div class="cert"><h1 id="modalTitle">🏆 WonderLab Certificate</h1><p>This certificate is proudly presented to</p><h1 class="name">${esc(S.name)}</h1><h2>${title}</h2><p>for learning, creating and exploring with courage and curiosity.</p><p><b>⭐ ${S.stars} stars · 🏆 Level ${levelOf(S.stars)} · 🏅 ${S.badges.length} badges</b></p><small>Mirha's WonderLab Creative School · ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</small></div>`,
    [{ label: '🖨️ Print', cls: 'btn-primary', onClick: () => { window.print(); return true; } }, { label: 'Close' }]);
  sfx.level(); burst(null, 20);
};

$('parentBtn').onclick = () => {
  const stat = (n, l) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`;
  openModal(`<h2 id="modalTitle">⚙️ Grown-ups corner</h2><p>Progress is stored only on this device — nothing is sent anywhere.</p>
    <div class="statgrid">${stat(S.stars, 'Total stars')}${stat(S.streak + ' 🔥', 'Day streak')}${stat(S.today.stars, 'Stars today')}${stat(S.goalsDone, 'Daily missions')}
    ${WORLDS.map(w => stat(S.done[w] || 0, w[0].toUpperCase() + w.slice(1) + ' stars')).join('')}${stat(S.spelled, 'Words spelled')}${stat(S.speedBest, 'Best rocket race')}</div>
    <label class="field">Learner's name<input class="input" id="nameInput" maxlength="20" value="${esc(S.name)}"></label>`,
    [{ label: '💾 Save', cls: 'btn-primary', onClick: () => { const v = $('nameInput').value.trim(); if (v) { S.name = v; persist(); render(); toast(`👋 Hello, ${v}!`); } } },
     { label: '🗑️ Reset progress', cls: 'danger', onClick: b => {
        if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again to confirm'; return true; }
        const keep = { name: S.name, sound: S.sound };
        S = { ...DEFAULTS, ...keep, done: {}, badges: [], today: { date: dayKey(), stars: 0, celebrated: false }, lastDay: dayKey() };
        persist(); render(); toast('Progress reset. A fresh start! 🌱');
      } },
     { label: 'Close' }]);
};

$('soundBtn').onclick = () => { S.sound = !S.sound; if (!S.sound && 'speechSynthesis' in window) speechSynthesis.cancel(); persist(); render(); sfx.pop(); };
$('startBtn').onclick = () => {
  const least = [...WORLDS].sort((a, b) => (S.done[a] || 0) - (S.done[b] || 0))[0];
  openWorld(least);
  if (S.stars) toast(`✨ Let's grow your ${least[0].toUpperCase() + least.slice(1)} skills today!`);
};
$('welcomeBtn').onclick = () => speak(`Welcome to ${S.name}'s WonderLab. Choose a world and let us learn together!`);

/* ---------------- boot ---------------- */
const h = new Date().getHours();
$('greeting').textContent = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
checkDay(); checkBadges(false); persist();
setLevel(S.mathLv);
newEnglish(); newSpell(); newSentence(); newUrdu(); newLetter(); newPrompt(); resetCanvasState(); renderGallery(); render();
$('funFact').textContent = FACTS[factI = rand(FACTS.length)];

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
