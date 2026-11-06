/* ═══════════════════════════════════════════════════════════
   عيلتنا · app.js
   The markup lives in index.html (screens, sheets and the <template>s).
   This file only: talks to Supabase/Cloudinary, fills data into that
   markup, and handles taps. No big HTML strings, no full re-renders.

   Sections: helpers · state · data · feed · comments · chat · people
             · add post · sheets · viewer · realtime · boot
   Voice/video calls are in calls.js (loaded lazily after first paint).
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* ── helpers ─────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const f = (r, n) => r.querySelector(`[data-f="${n}"]`);
const tpl = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(x => x != null));
  return e;
}
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  setJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const buzz = (ms = 15) => navigator.vibrate?.(ms);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = t => esc(t || '')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/@([\p{L}\p{N}_]+)/gu, '<span class="mention">@$1</span>');
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const oct = id => OCTS[id] || OCTS.everyday;
const ago = iso => {
  const d = Date.now() - new Date(iso).getTime(), m = d / 6e4 | 0, h = d / 36e5 | 0, dy = d / 864e5 | 0;
  if (m < 1) return 'just now'; if (m < 60) return m + 'm'; if (h < 24) return h + 'h';
  if (dy === 1) return 'yesterday'; if (dy < 7) return dy + 'd ago';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const fmtTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fullDate = iso => new Date(iso).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' · ' + fmtTime(iso);
const fmtDay = iso => {
  const d = new Date(iso), n = new Date();
  if (d.toDateString() === n.toDateString()) return 'Today';
  n.setDate(n.getDate() - 1);
  return d.toDateString() === n.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};
const dmKey = (a, b) => [a, b].sort().join('|');

/* Cloudinary: ask for a right-sized, modern-format image instead of the original. */
const cld = (u, w) => CFG.CLD_TRANSFORM !== false && u && u.includes('res.cloudinary.com') && u.includes('/upload/') && !u.includes('/upload/f_auto')
  ? u.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`) : u;
const vidUrl = u => u && u.includes('res.cloudinary.com') ? u.replace('/upload/', '/upload/q_auto,vc_auto/') : u;
const posterUrl = u => u && u.includes('res.cloudinary.com') ? u.replace('/upload/', '/upload/so_0,w_700,f_jpg/').replace(/\.\w+$/, '.jpg') : null;
function imgEl(url, w, extra = {}) {
  const i = el('img', { src: cld(url, w), alt: '', loading: 'lazy', decoding: 'async', ...extra });
  i.onerror = () => { if (i.src !== url) { i.onerror = null; i.src = url; } };
  return i;
}

let toastT;
function toast(msg, ms = 2400, err = false) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('error', err);
  clearTimeout(toastT);
  if (t.showPopover) { try { t.hidePopover(); } catch {} try { t.showPopover(); } catch {} toastT = setTimeout(() => { try { t.hidePopover(); } catch {} }, ms); }
  else { t.style.opacity = 1; toastT = setTimeout(() => (t.style.opacity = 0), ms); }
}
let AC;
function beep(type) {            // tiny synthesized sounds, one shared AudioContext
  try {
    AC ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    const p = { send: [880, .12, .08], receive: [660, .1, .12], react: [1047, .07, .05], ring: [440, .2, .35], end: [300, .15, .3] }[type] || [660, .1, .1];
    o.frequency.value = p[0]; g.gain.setValueAtTime(p[1], t); g.gain.exponentialRampToValueAtTime(.001, t + p[2]);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + p[2]);
  } catch {}
}
let cfRes;
function confirmSheet(title, ok = 'Delete') {
  $('#cf-t').textContent = title; $('#cf-ok').textContent = ok;
  const d = $('#dlg-confirm'); d.showModal();
  return new Promise(r => { cfRes = r; d.addEventListener('close', () => { cfRes?.(false); cfRes = null; }, { once: true }); });
}
const busy = (on, txt) => { $('#busy').hidden = !on; if (txt) $('#busy-t').textContent = txt; };

/* ── state ───────────────────────────────────────────────── */
const S = {
  name: '', view: 'feed', posts: [], msgs: [], dms: {}, cmts: {}, cc: {}, profiles: {}, seen: {},
  filter: null, q: '', pinned: store.get('ayl_pinned') || null, lastSeen: +store.get('ayl_seen', 0),
  chatTab: 'group', thread: null, groupUnread: 0, dmUnread: {}, cmtState: {}, cmtPage: {}, newDot: new Set(),
  draft: [], draftPic: null, viewer: null, viewingUser: null, loaded: false, newCount: 0, me: null,
};
const isOwn = n => S.name && n && S.name.trim().toLowerCase() === n.trim().toLowerCase();
const sb = supabase.createClient(CFG.SB_URL, CFG.SB_KEY, {
  auth: { persistSession: CFG.GATE_ON, autoRefreshToken: CFG.GATE_ON, detectSessionInUrl: false },
});
const scroller = $('#scroller'), feedEl = $('#feed'), msgsEl = $('#msgs');
const cardEls = new Map();

/* avatars: one span, filled in place */
const colorOf = n => MC[S.profiles[n]?.colorIdx ?? hash(n || '?') % MC.length];
function setAv(node, name, size = '') {
  const c = colorOf(name), ph = S.profiles[name]?.photo;
  node.className = 'av' + (size ? ' ' + size : '');
  node.style.cssText = `background:${c.bg};color:${c.tx};--c-br:${c.br}`;
  node.replaceChildren();
  if (ph) node.append(imgEl(ph, size === 'lg' ? 300 : 120));
  else node.textContent = (name || '?').trim().charAt(0).toUpperCase();
  return node;
}
const avEl = (n, size) => setAv(document.createElement('span'), n, size);
const allNames = () => [...new Set([...S.posts.map(p => p.name), ...Object.keys(S.profiles), ...Object.keys(S.cmts).flatMap(k => S.cmts[k].map(c => c.name))])].filter(Boolean);

/* ── data ────────────────────────────────────────────────── */
const db = {
  async posts() {
    const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(CFG.FEED_LIMIT);
    if (error || !data) return false; S.posts = data; store.setJson('ayl_cache', data.slice(0, 12)); return true;
  },
  async group() {
    const { data, error } = await sb.from('messages').select('*').is('dm_key', null).order('created_at', { ascending: false }).limit(150);
    if (!error && data) S.msgs = data.reverse();
  },
  async dmAll() {
    const pat = '%' + S.name.replace(/[%_\\]/g, '\\$&') + '%';
    const { data } = await sb.from('messages').select('*').ilike('dm_key', pat).order('created_at', { ascending: false }).limit(300);
    if (!data) return;
    const by = {};
    for (const m of data.reverse()) if (m.dm_key?.split('|').includes(S.name)) (by[m.dm_key] ??= []).push(m);
    S.dms = by;
    for (const [k, l] of Object.entries(by)) {
      const seen = +store.get('ayl_dmseen_' + k, 0);
      S.dmUnread[k] = l.filter(m => !isOwn(m.name) && new Date(m.created_at) > seen).length;
    }
  },
  async cmtMeta() {
    const { data } = await sb.from('comments').select('id,post_id,name');
    if (!data) return; S.cc = {}; S.cmtMeta = data;
    data.forEach(c => (S.cc[c.post_id] = (S.cc[c.post_id] || 0) + 1));
  },
  async cmts(pid) {
    const { data } = await sb.from('comments').select('*').eq('post_id', pid).order('created_at', { ascending: true });
    if (data) { S.cmts[pid] = data; S.cc[pid] = data.length; }
  },
  async profiles() {
    const { data, error } = await sb.from('profiles').select('*');
    if (error || !data) return;
    const p = {};
    data.forEach(r => (p[r.name] = { photo: r.photo || undefined, bio: r.bio || undefined, birthday: r.birthday || undefined, colorIdx: r.color_idx ?? undefined }));
    S.profiles = p; store.setJson('ayl_profiles', p);
  },
  async seen() {
    const ids = S.posts.slice(0, 20).map(p => p.id); if (!ids.length) return;
    const { data } = await sb.from('post_views').select('post_id,viewer').in('post_id', ids);
    (data || []).forEach(r => { const l = (S.seen[r.post_id] ??= []); if (!l.includes(r.viewer)) l.push(r.viewer); });
  },
  async markSeen() {
    const rows = S.posts.slice(0, 8).filter(p => !(S.seen[p.id] || []).includes(S.name)).map(p => ({ post_id: p.id, viewer: S.name }));
    if (!rows.length) return;
    rows.forEach(r => (S.seen[r.post_id] ??= []).push(S.name));
    try { await sb.from('post_views').upsert(rows, { onConflict: 'post_id,viewer', ignoreDuplicates: true }); } catch {}
  },
};
S.cmtMeta = [];

async function shrink(file, max = CFG.IMG_MAX, q = CFG.IMG_QUALITY) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * r), h = Math.round(bmp.height * r);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h); bmp.close?.();
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', q));
  } catch { return file; }
}
async function upload(kind, blob) {
  const c = kind === 'video' ? CFG.CLD_VID : CFG.CLD_IMG, fd = new FormData();
  fd.append('file', blob); fd.append('upload_preset', c.preset);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/${kind}/upload`, { method: 'POST', body: fd });
  const d = await r.json(); if (d.error) throw new Error(d.error.message); return d.secure_url;
}
const needOnline = () => navigator.onLine || (toast('📡 No internet — connect and try again', 2600, true), false);

/* ── navigation ──────────────────────────────────────────── */
const scrollPos = {};
function go(v, { push = true } = {}) {
  if (!S.name) return;
  if (v === S.view && v !== 'user') { if (v === 'feed') scroller.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollPos[S.view] = scroller.scrollTop;
  S.view = v; document.body.dataset.view = v;
  $$('.tab,.fab').forEach(t => t.classList.toggle('on', t.dataset.go === v));
  const slot = TAB_SLOT[v], bar = $('#tabbar');
  bar.classList.toggle('noind', slot == null); if (slot != null) bar.style.setProperty('--i', slot);
  $('#title').textContent = v === 'user' ? S.viewingUser : VIEW_TITLE[v];
  if (v !== 'feed') closeSearch();
  ({ stats: renderStats, members: renderMembers, chat: openChat, add: resetAdd, user: renderUser, edit: fillEdit })[v]?.();
  if (push) { const both = v in TAB_SLOT && history.state?.v in TAB_SLOT; history[both ? 'replaceState' : 'pushState']({ v, u: S.viewingUser }, ''); }
  scroller.scrollTop = v === 'feed' ? scrollPos.feed || 0 : 0;
}
addEventListener('popstate', e => { if (e.state?.u) S.viewingUser = S.renamed?.[e.state.u] || e.state.u; go(e.state?.v || 'feed', { push: false }); });
let scrolled = false;
scroller.addEventListener('scroll', () => {
  const s = scroller.scrollTop > 8; if (s !== scrolled) { scrolled = s; $('#topbar').classList.toggle('scrolled', s); }
}, { passive: true });

/* ── feed ────────────────────────────────────────────────── */
function visiblePosts() {
  let l = S.posts;
  if (S.filter) l = l.filter(p => p.name === S.filter);
  if (S.q) { const q = S.q.toLowerCase(); l = l.filter(p => p.name.toLowerCase().includes(q) || (p.caption || '').toLowerCase().includes(q) || oct(p.oct).l.toLowerCase().includes(q)); }
  const i = S.pinned ? l.findIndex(p => p.id === S.pinned) : -1;
  return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l;
}
function renderFeed() {
  const list = visiblePosts(), want = new Set(list.map(p => p.id));
  feedEl.removeAttribute('aria-busy'); $$('.sk', feedEl).forEach(n => n.remove());
  for (const [id, n] of cardEls) if (!want.has(id)) { n.remove(); cardEls.delete(id); }
  let prev = null;
  for (const p of list) {
    let n = cardEls.get(p.id);
    if (!n) { n = buildCard(p); cardEls.set(p.id, n); if (S.loaded) n.classList.add('enter'); } else updateCard(n, p);
    const at = prev ? prev.nextElementSibling : feedEl.firstElementChild;
    if (n !== at) feedEl.insertBefore(n, at);
    prev = n;
  }
  const empty = !list.length && S.ready;
  $('#feed-empty').hidden = !empty;
  if (empty) {
    $('#empty-i').textContent = S.q ? '🔍' : '📸'; $('#empty-t').textContent = S.q ? 'No results' : 'No moments yet';
    $('#empty-d').textContent = S.q ? `Nothing found for “${S.q}”` : 'Tap + to share the first family moment!';
  }
}
const mediaOf = p => Array.isArray(p.media) && p.media.length ? p.media
  : p.video_url ? [{ type: 'video', url: p.video_url }] : p.photo_url ? [{ type: 'photo', url: p.photo_url }] : [];

function slide(m, i) {
  if (m.type === 'video') {
    return el('div', { class: 'slide' }, el('video', { src: vidUrl(m.url), poster: posterUrl(m.url), playsinline: true, preload: 'none' }),
      el('div', { class: 'vplay', 'data-act': 'vplay', text: '▶' }));
  }
  return el('div', { class: 'slide' }, imgEl(m.url, 900, { 'data-act': 'view', 'data-i': i }));
}
function buildCard(p) {
  const n = tpl('t-post'), o = oct(p.oct), list = mediaOf(p);
  n.dataset.id = p.id;
  setAv(f(n, 'av'), p.name);
  f(n, 'name').textContent = p.name;
  const tag = f(n, 'oct'); tag.textContent = `${o.e} ${o.l}`; tag.style.cssText = `background:${o.bg};color:${o.tx};border-color:${o.br}`;
  const media = f(n, 'media');
  if (!list.length) { media.replaceWith(el('div', { class: 'nomedia', style: `background:${o.bg};border-color:${o.br};color:${o.tx}` }, `${o.e} ${o.l}`)); }
  else if (list.length === 1) media.append(slide(list[0], 0));
  else {
    media.append(el('div', { class: 'carousel' }, el('div', { class: 'track' }, list.map(slide)),
      el('div', { class: 'cnt', text: `1/${list.length}` }), el('div', { class: 'dots' }, list.map((_, i) => el('i', { class: i ? '' : 'on' })))));
  }
  if (p.caption) { const c = f(n, 'caption'); c.innerHTML = rich(p.caption); c.hidden = false; }
  setAv(f(n, 'myav'), S.name, 'sm');
  updateCard(n, p);
  return n;
}
function updateCard(n, p) {
  f(n, 'time').textContent = ago(p.created_at);
  f(n, 'pin').hidden = S.pinned !== p.id; n.classList.toggle('pinned', S.pinned === p.id);
  // seen by
  const seen = (S.seen[p.id] || []).filter(x => !isOwn(x)), sn = f(n, 'seen');
  sn.hidden = !seen.length;
  if (seen.length) sn.replaceChildren(...seen.slice(0, 4).map(x => avEl(x, 'xs')), el('span', { text: `Seen by ${seen.slice(0, 3).join(', ')}${seen.length > 3 ? ` +${seen.length - 3}` : ''}` }));
  // reactions
  const rx = Object.entries(p.reactions || {}).filter(([, v]) => v?.length);
  f(n, 'rxns').replaceChildren(...rx.map(([e, names]) => el('button', {
    class: 'rxn-pill' + (names.includes(S.name) ? ' mine' : ''), 'data-act': 'rxn', 'data-e': e, title: names.join(', '), 'aria-label': `${e} ${names.join(', ')}`,
  }, el('span', { text: e }), String(names.length))));
  const b = f(n, 'cbadge'); b.textContent = S.cc[p.id] ?? 0;
  f(n, 'ndot').hidden = !S.newDot.has(p.id);
}
const cardOf = pid => cardEls.get(pid);
feedEl.addEventListener('scroll', e => {          // carousel counter + dots (scroll doesn't bubble → capture)
  const t = e.target; if (!t.classList?.contains('track')) return;
  const i = Math.round(t.scrollLeft / (t.clientWidth || 1)), car = t.parentElement;
  const cnt = $('.cnt', car); const txt = `${i + 1}/${t.children.length}`;
  if (cnt.textContent !== txt) { cnt.textContent = txt; $$('.dots i', car).forEach((d, k) => d.classList.toggle('on', k === i)); }
}, { capture: true, passive: true });
document.addEventListener('play', e => { if (e.target.tagName === 'VIDEO') { $$('video').forEach(v => v !== e.target && v.pause()); const b = e.target.nextElementSibling; if (b) b.hidden = true; } }, true);
document.addEventListener('pause', e => { if (e.target.tagName === 'VIDEO') { const b = e.target.nextElementSibling; if (b?.classList.contains('vplay')) b.hidden = false; } }, true);
document.addEventListener('ended', e => { const b = e.target.nextElementSibling; if (b?.classList.contains('vplay')) b.hidden = false; }, true);

async function react(card, e) {
  const p = S.posts.find(x => x.id === card.dataset.id); if (!p) return;
  const r = { ...(p.reactions || {}) }, l = r[e] ? [...r[e]] : [], i = l.indexOf(S.name);
  if (i > -1) l.splice(i, 1); else { l.push(S.name); buzz(12); beep('react'); }
  l.length ? (r[e] = l) : delete r[e];
  p.reactions = r; $$(`.card[data-id="${CSS.escape(p.id)}"]`).forEach(n => updateCard(n, p));
  const pill = $(`.rxn-pill[data-e="${e}"]`, card); pill?.classList.add('pop');
  const { error } = await sb.from('posts').update({ reactions: r }).eq('id', p.id);
  if (error) toast('Couldn’t save reaction', 2200, true);
}
function newPostArrived() {
  if (S.view === 'feed' && scroller.scrollTop > 240) {
    S.newCount++; const b = $('#newpill'); b.textContent = `▲ ${S.newCount} new moment${S.newCount > 1 ? 's' : ''}`; b.hidden = false;
  } else renderFeed();
  beep('receive');
}
function showGreeting() {
  const key = 'ayl_greet_' + new Date().toDateString(); if (store.get(key)) return; store.set(key, '1');
  const h = new Date().getHours();
  const [t, s] = h >= 5 && h < 12 ? ['Good morning', 'Hope you have a wonderful day ☀️'] : h < 17 && h >= 12 ? ['Good afternoon', 'What’s happening in the family today?']
    : h >= 17 && h < 21 ? ['Good evening', 'Share a moment from your day 📸'] : ['Good night', 'Rest well — the family loves you ❤️'];
  const recent = S.posts.find(p => !isOwn(p.name) && Date.now() - new Date(p.created_at) < 108e5);
  $('#greet-t').textContent = `${t}, ${S.name}!`; $('#greet-s').textContent = recent ? `${recent.name} just shared something 👇` : s;
  const g = $('#greet'); g.hidden = false; setTimeout(() => (g.hidden = true), 5200);
}
let remDismissed = false;
function showReminder() {
  if (remDismissed) return;
  const mine = S.posts.filter(p => p.name === S.name); let m = '';
  if (!mine.length) m = 'You haven’t shared anything yet — be the first! 📸';
  else { const d = (Date.now() - new Date(mine[0].created_at)) / 864e5; if (d > 2) m = `You haven’t posted in ${d | 0} days — share a moment!`; }
  $('#rem-txt').textContent = m; $('#reminder').hidden = !m;
}

/* ── comments ────────────────────────────────────────────── */
async function toggleCmts(card) {
  const pid = card.dataset.id, body = f(card, 'cbody'), btn = $('[data-act=cmts]', card), open = body.hidden;
  btn.setAttribute('aria-expanded', open); body.hidden = !open;
  if (!open) return;
  S.newDot.delete(pid); f(card, 'ndot').hidden = true;
  if (!S.cmts[pid]) await db.cmts(pid);
  renderCmts(card); f(card, 'ctext').focus({ preventScroll: true });
}
function renderCmts(card) {
  const pid = card.dataset.id, all = S.cmts[pid] || [], top = all.filter(c => !c.parent_id), page = S.cmtPage[pid] || 1;
  const shown = top.slice(0, page * CFG.CMT_PAGE), out = [];
  const walk = (c, d) => { out.push(cmtEl(c, d)); if (d < 2) all.filter(r => r.parent_id === c.id).forEach(r => walk(r, d + 1)); };
  shown.forEach(c => walk(c, 0));
  if (top.length > shown.length) out.push(el('button', { class: 'chip pressable', 'data-act': 'more-cmts', style: 'margin:6px 12px' }, `Load ${Math.min(CFG.CMT_PAGE, top.length - shown.length)} more`));
  f(card, 'clist').replaceChildren(...out);
  f(card, 'cbadge').textContent = S.cc[pid] ?? all.length;
  const st = S.cmtState[pid] || {};
  f(card, 'replying').hidden = !st.reply; if (st.reply) f(card, 'replyname').textContent = st.reply.name;
  f(card, 'cprev').hidden = !st.img; if (st.img) f(card, 'cprev-img').src = st.img.url;
}
function cmtEl(c, depth) {
  const n = tpl('t-cmt'); n.dataset.cid = c.id; if (depth) n.classList.add('r' + depth);
  setAv(f(n, 'av'), c.name, 'sm');
  f(n, 'name').textContent = c.name; f(n, 'text').innerHTML = rich(c.text); f(n, 'time').textContent = ago(c.created_at);
  if (c.photo_url) { const i = f(n, 'img'); i.src = cld(c.photo_url, 500); i.dataset.full = c.photo_url; i.hidden = false; }
  f(n, 'del').hidden = !isOwn(c.name);
  if (depth >= 2) $('[data-act=reply]', n).remove();
  $$('.crx button', n).forEach(b => {
    const names = (c.reactions || {})[b.dataset.e] || [];
    b.textContent = b.dataset.e + (names.length ? ' ' + names.length : ''); b.classList.toggle('mine', names.includes(S.name));
  });
  return n;
}
async function sendCmt(form) {
  const card = form.closest('.card'), pid = card.dataset.id, ta = f(card, 'ctext'), text = ta.value.trim(), st = S.cmtState[pid] ||= {};
  if (!text && !st.img) return; if (!needOnline()) return;
  const btn = $('.send', form); btn.disabled = true;
  try {
    const photo_url = st.img ? await upload('image', st.img.blob) : null;
    const row = { post_id: pid, parent_id: st.reply?.id || null, name: S.name, text, photo_url, reactions: {} };
    const { data, error } = await sb.from('comments').insert(row).select().single(); if (error) throw error;
    addCmtLocal(data);
    ta.value = ''; ta.style.height = ''; if (st.img) URL.revokeObjectURL(st.img.url); S.cmtState[pid] = {};
    renderCmts(card); toast('💬 Comment sent'); buzz(); beep('send');
  } catch (e) { toast('Couldn’t send comment', 2400, true); }
  btn.disabled = false;
}
function addCmtLocal(c) {
  const l = S.cmts[c.post_id]; if (l && !l.some(x => x.id === c.id)) l.push(c);
  if (!S.cmtMeta.some(x => x.id === c.id)) { S.cmtMeta.push({ id: c.id, post_id: c.post_id, name: c.name }); S.cc[c.post_id] = (S.cc[c.post_id] || 0) + 1; }
}
async function reactCmt(node, e) {
  const card = node.closest('.card'), pid = card.dataset.id, c = (S.cmts[pid] || []).find(x => String(x.id) === node.dataset.cid); if (!c) return;
  const r = { ...(c.reactions || {}) }, l = r[e] ? [...r[e]] : [], i = l.indexOf(S.name);
  i > -1 ? l.splice(i, 1) : l.push(S.name); l.length ? (r[e] = l) : delete r[e];
  c.reactions = r; renderCmts(card); buzz(8);
  sb.from('comments').update({ reactions: r }).eq('id', c.id).then(() => {});
}
async function deleteCmt(node) {
  const card = node.closest('.card'), pid = card.dataset.id, id = node.dataset.cid;
  if (!await confirmSheet('Delete this comment?')) return;
  await sb.from('comments').delete().eq('id', id);
  removeCmtLocal(id, pid); renderCmts(card);
}
function removeCmtLocal(id, pid) {
  const l = S.cmts[pid]; if (l) S.cmts[pid] = l.filter(c => String(c.id) !== String(id) && String(c.parent_id) !== String(id));
  const had = S.cmtMeta.filter(c => String(c.id) === String(id) || String(c.parent_id) === String(id)).length;
  S.cmtMeta = S.cmtMeta.filter(c => String(c.id) !== String(id)); S.cc[pid] = Math.max(0, (S.cc[pid] || 0) - (had || 1));
}

/* ── chat ────────────────────────────────────────────────── */
const threadKey = () => S.thread ? dmKey(S.name, S.thread) : null;
function openChat() { setChatTab(S.chatTab === 'thread' && !S.thread ? 'dms' : S.chatTab); }
function setChatTab(t, name) {
  const v = $('#v-chat'); S.chatTab = t; v.dataset.ctab = t;
  if (t === 'thread') {
    S.thread = name || S.thread; const key = threadKey();
    setAv($('#th-av'), S.thread, 'sm'); $('#th-name').textContent = S.thread;
    S.dmUnread[key] = 0; store.set('ayl_dmseen_' + key, Date.now()); updateBadges();
    renderMsgs(S.dms[key] || [], key);
  } else if (t === 'group') {
    S.groupUnread = 0; store.set('ayl_msgseen', Date.now()); updateBadges(); renderMsgs(S.msgs, null);
  } else { renderDmList(); db.dmAll().then(() => S.chatTab === 'dms' && renderDmList()); }
}
let lastDay = '';
function msgEl(m, key) {
  const n = tpl('t-msg'), own = isOwn(m.name);
  n.classList.toggle('own', own); n.dataset.id = m.id;
  setAv(f(n, 'av'), m.name, 'sm'); if (own) f(n, 'av').hidden = true;
  const s = f(n, 'sender'); s.textContent = m.name; s.hidden = own || !!key;
  f(n, 'text').innerHTML = rich(m.text); f(n, 'time').textContent = fmtTime(m.created_at); f(n, 'del').hidden = !own;
  return n;
}
function dayDivider(m) {
  const d = fmtDay(m.created_at); if (d === lastDay) return null; lastDay = d; return el('div', { class: 'day', text: d });
}
function renderMsgs(list, key) {
  lastDay = ''; const out = [];
  for (const m of list) { const d = dayDivider(m); if (d) out.push(d); out.push(msgEl(m, key)); }
  if (!out.length) out.push(el('div', { class: 'empty', style: 'margin:auto' }, el('div', { class: 'e-ico', text: '💬' }), el('p', { text: key ? 'Say hi 👋' : 'Send the first message to the family!' })));
  msgsEl.replaceChildren(...out); msgsEl.scrollTop = msgsEl.scrollHeight;
}
function appendMsg(m, key) {
  $('.empty', msgsEl)?.remove();
  const stick = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120 || isOwn(m.name);
  const d = dayDivider(m); if (d) msgsEl.append(d); msgsEl.append(msgEl(m, key));
  if (stick) msgsEl.scrollTop = msgsEl.scrollHeight;
}
function renderDmList() {
  const names = [...new Set([...allNames(), ...Object.keys(S.dms).flatMap(k => k.split('|'))])].filter(n => !isOwn(n)).sort();
  const box = $('#dm-list');
  if (!names.length) { box.replaceChildren(el('div', { class: 'empty' }, el('div', { class: 'e-ico', text: '💬' }), el('h2', { text: 'No family members yet' }), el('p', { text: 'Once people join, you can message them here.' }))); return; }
  const rows = names.map(nm => {
    const key = dmKey(S.name, nm), l = S.dms[key] || [], last = l[l.length - 1], n = tpl('t-dm');
    n.dataset.name = nm; setAv(f(n, 'av'), nm); f(n, 'name').textContent = nm;
    f(n, 'last').textContent = last ? last.text : 'Tap to message'; f(n, 'time').textContent = last ? ago(last.created_at) : '';
    const u = S.dmUnread[key] || 0; f(n, 'unread').hidden = !u; f(n, 'unread').textContent = u; return { n, t: last ? new Date(last.created_at) : 0 };
  }).sort((a, b) => b.t - a.t).map(x => x.n);
  box.replaceChildren(...rows);
}
function updateBadges() {
  const dm = Object.values(S.dmUnread).reduce((a, b) => a + b, 0), tot = S.groupUnread + dm, b = $('#chat-badge');
  b.hidden = !tot || S.view === 'chat'; b.textContent = tot > 99 ? '99+' : tot; $('#dm-dot').hidden = !dm;
}
async function sendChat() {
  const ta = $('#chat-in'), text = ta.value.trim(); if (!text || !needOnline()) return;
  const key = S.chatTab === 'thread' ? threadKey() : null;
  ta.value = ''; ta.style.height = ''; beep('send'); buzz(10);
  const tmp = { id: 'tmp' + Date.now(), name: S.name, text, dm_key: key, created_at: new Date().toISOString() };
  pushMsg(tmp, key); appendMsg(tmp, key);
  const { data, error } = await sb.from('messages').insert({ name: S.name, text, dm_key: key }).select().single();
  const list = key ? S.dms[key] : S.msgs, i = list.findIndex(m => m.id === tmp.id);
  if (error) { toast('Message not sent', 2400, true); if (i > -1) list.splice(i, 1); msgsEl.querySelector(`[data-id="${tmp.id}"]`)?.remove(); return; }
  const dup = list.findIndex(m => m.id === data.id);
  if (dup > -1 && i > -1) { list.splice(i, 1); msgsEl.querySelector(`[data-id="${tmp.id}"]`)?.remove(); }
  else if (i > -1) { list[i] = data; const n = msgsEl.querySelector(`[data-id="${tmp.id}"]`); if (n) n.dataset.id = data.id; }
}
const pushMsg = (m, key) => key ? (S.dms[key] ??= []).push(m) : S.msgs.push(m);
async function deleteMsg(node) {
  const id = node.dataset.id, key = S.chatTab === 'thread' ? threadKey() : null;
  if (!await confirmSheet('Delete this message?')) return;
  const list = key ? S.dms[key] : S.msgs, i = list.findIndex(m => String(m.id) === id); if (i > -1) list.splice(i, 1);
  node.remove(); await sb.from('messages').delete().eq('id', id);
}

/* ── people: stats, members, profile ─────────────────────── */
const rxnTotal = p => Object.values(p.reactions || {}).reduce((a, b) => a + (b?.length || 0), 0);
function memberStats() {
  const names = [...new Set(S.posts.map(p => p.name))];
  return names.map(n => {
    const ps = S.posts.filter(p => p.name === n), rxns = ps.reduce((a, p) => a + rxnTotal(p), 0), cmts = S.cmtMeta.filter(c => c.name === n).length;
    return { name: n, posts: ps.length, rxns, cmts, last: ps[0] ? new Date(ps[0].created_at).getTime() : 0, score: ps.length * 3 + rxns + cmts };
  });
}
const streak = last => { const d = (Date.now() - last) / 864e5; return d < 1 ? '🔥 Active today' : d < 3 ? `⭐ ${d | 0}d ago` : ''; };
function renderStats() {
  const ms = memberStats().sort((a, b) => b.score - a.score);
  $('#st-posts').textContent = S.posts.length; $('#st-rxn').textContent = S.posts.reduce((a, p) => a + rxnTotal(p), 0);
  $('#st-cmt').textContent = S.cmtMeta.length; $('#st-msg').textContent = S.msgs.length; $('#st-mem').textContent = ms.length;
  const oc = {}; S.posts.forEach(p => (oc[p.oct] = (oc[p.oct] || 0) + 1));
  const top = Object.entries(oc).sort((a, b) => b[1] - a[1])[0]; $('#st-oct').hidden = !top;
  if (top) { $('#st-oct-e').textContent = oct(top[0]).e; $('#st-oct-l').textContent = oct(top[0]).l; }
  const board = (box, rows, key, fmt) => {
    const max = Math.max(1, ...rows.map(r => r[key]));
    box.replaceChildren(...rows.map((r, i) => {
      const n = tpl('t-lb'); n.dataset.name = r.name; f(n, 'rank').textContent = ['🥇', '🥈', '🥉'][i] || i + 1;
      setAv(f(n, 'av'), r.name, 'xs'); f(n, 'name').textContent = r.name + (isOwn(r.name) ? ' (you)' : '');
      f(n, 'bar').style.setProperty('--w', (r[key] / max).toFixed(3)); f(n, 'val').textContent = fmt(r[key]); return n;
    }));
  };
  board($('#lb-active'), ms, 'score', () => ''); $$('#lb-active .lb-row').forEach((n, i) => (f(n, 'val').textContent = `${ms[i].posts} post${ms[i].posts === 1 ? "" : "s"}`));
  board($('#lb-rxn'), [...ms].sort((a, b) => b.rxns - a.rxns), 'rxns', v => `${v} ❤️`);
  const best = [...S.posts].sort((a, b) => rxnTotal(b) - rxnTotal(a))[0];
  $('#st-top-sec').hidden = !best || !rxnTotal(best); if (best && rxnTotal(best)) $('#st-top').replaceChildren(buildCard(best));
  const quiet = ms.filter(m => (Date.now() - m.last) / 864e5 > 7 && !isOwn(m.name));
  $('#st-quiet-sec').hidden = !quiet.length;
  $('#st-quiet').replaceChildren(...quiet.map(m => { const n = tpl('t-lb'); n.dataset.name = m.name; f(n, 'rank').remove(); setAv(f(n, 'av'), m.name, 'xs'); f(n, 'name').textContent = m.name; f(n, 'bar').parentElement.remove(); f(n, 'val').textContent = `${(Date.now() - m.last) / 864e5 | 0}d ago`; return n; }));
}
function renderMembers() {
  const ms = memberStats().sort((a, b) => b.last - a.last);
  $('#members-empty').hidden = !!ms.length;
  $('#members').replaceChildren(...ms.map(m => {
    const n = tpl('t-member'); n.dataset.name = m.name; setAv(f(n, 'av'), m.name);
    f(n, 'name').textContent = m.name + (isOwn(m.name) ? ' (you)' : '');
    const s = streak(m.last); f(n, 'streak').hidden = !s; f(n, 'streak').textContent = s;
    f(n, 'meta').textContent = `${m.posts} moment${m.posts !== 1 ? 's' : ''} · last ${ago(new Date(m.last).toISOString())}`;
    f(n, 'p').textContent = m.posts; f(n, 'r').textContent = m.rxns; f(n, 'c').textContent = m.cmts; return n;
  }));
}
function openUser(name) { S.viewingUser = name; S.view === 'user' ? (renderUser(), $('#title').textContent = name, history.pushState({ v: 'user', u: name }, '')) : go('user'); }
function renderUser() {
  const n = S.viewingUser, pr = S.profiles[n] || {}, ps = S.posts.filter(p => p.name === n), own = isOwn(n);
  $('#v-user').dataset.own = own ? 1 : 0; setAv($('#u-av'), n, 'lg');
  $('#u-name').textContent = n; $('#u-bio').textContent = pr.bio || (own ? 'Tap edit to add a bio' : ''); $('#u-bio').hidden = !$('#u-bio').textContent;
  const badges = [streak(ps[0] ? new Date(ps[0].created_at).getTime() : 0), pr.birthday ? '🎂 ' + new Date(pr.birthday + 'T12:00').toLocaleDateString([], { month: 'long', day: 'numeric' }) : ''].filter(Boolean);
  $('#u-badges').replaceChildren(...badges.map(b => el('span', { text: b })));
  $('#u-posts').textContent = ps.length; $('#u-rxn').textContent = ps.reduce((a, p) => a + rxnTotal(p), 0); $('#u-cmt').textContent = S.cmtMeta.filter(c => c.name === n).length;
  const pics = ps.filter(p => mediaOf(p).some(m => m.type === 'photo'));
  $('#u-gal-sec').hidden = !pics.length;
  $('#u-gal').replaceChildren(...pics.slice(0, 9).map(p => imgEl(mediaOf(p).find(m => m.type === 'photo').url, 300, { 'data-act': 'gal', 'data-id': p.id })));
}
function fillEdit() {
  const pr = S.profiles[S.name] || {}; S.draftPic = null;
  setAv($('#e-av'), S.name, 'lg'); $('#e-name').value = S.name; $('#e-bio').value = pr.bio || ''; $('#e-bday').value = pr.birthday || '';
  const idx = pr.colorIdx ?? hash(S.name) % MC.length; $$('input[name=pcolor]').forEach(r => (r.checked = +r.value === idx));
  $('#e-colors').hidden = !!pr.photo; $('#rm-pic').hidden = !pr.photo;
}
async function saveProfile() {
  const name = $('#e-name').value.trim() || S.name, old = S.name, pr = { ...(S.profiles[old] || {}) };
  if (!needOnline()) return; busy(true, 'Saving…');
  try {
    if (S.draftPic) { pr.photo = await upload('image', S.draftPic.blob); delete pr.colorIdx; }
    else if (!pr.photo) pr.colorIdx = +($('input[name=pcolor]:checked')?.value ?? 0);
    pr.bio = $('#e-bio').value.trim() || undefined; pr.birthday = $('#e-bday').value || undefined;
    const row = { name, photo: pr.photo || null, bio: pr.bio || null, birthday: pr.birthday || null, color_idx: pr.colorIdx ?? null, updated_at: new Date().toISOString() };
    const { error } = await sb.from('profiles').upsert(row, { onConflict: 'name' }); if (error) throw error;
    if (name !== old) { delete S.profiles[old]; await sb.from('profiles').delete().eq('name', old); S.name = name; store.set('ayl_name', name); (S.renamed ??= {})[old] = name; }
    S.profiles[name] = pr; store.setJson('ayl_profiles', S.profiles);
    refreshAll(); toast('✓ Profile saved'); buzz(); S.viewingUser = name; history.back();
  } catch { toast('Couldn’t save profile', 2600, true); }
  busy(false);
}
function refreshAll() {
  cardEls.clear(); feedEl.replaceChildren(); renderFeed(); setAv($('#me-av'), S.name, 'sm'); $('#add-as').textContent = S.name;
  ({ stats: renderStats, members: renderMembers, user: renderUser, chat: () => setChatTab(S.chatTab) })[S.view]?.();
}

/* ── add a moment ────────────────────────────────────────── */
function resetAdd() {
  S.draft.forEach(m => URL.revokeObjectURL(m.url)); S.draft = [];
  $('#add-form').reset(); $('#count').textContent = `0 / ${CFG.MAX_CAP}`; $('#add-as').textContent = S.name;
  $('#mentions').replaceChildren(...allNames().filter(n => !isOwn(n)).map(n => el('button', { type: 'button', class: 'chip pressable', 'data-act': 'mention', 'data-n': n, text: '@' + n })));
  renderStrip();
}
function renderStrip() {
  const s = $('#strip'); s.hidden = !S.draft.length;
  s.replaceChildren(...S.draft.map((m, i) => el('div', { class: 'sitem' },
    m.type === 'video' ? el('video', { src: m.url + '#t=0.1', muted: true, preload: 'metadata', playsinline: true }) : el('img', { src: m.url, alt: '' }),
    el('button', { type: 'button', 'data-act': 'rm-draft', 'data-i': i, 'aria-label': 'Remove', text: '✕' }))));
}
async function addFiles(files, kind) {
  const room = CFG.MAX_MEDIA - S.draft.length; if (room <= 0) return toast(`Up to ${CFG.MAX_MEDIA} per post`);
  for (const file of [...files].slice(0, room)) {
    if (kind === 'video') S.draft.push({ type: 'video', blob: file, url: URL.createObjectURL(file) });
    else { const b = await shrink(file); S.draft.push({ type: 'photo', blob: b, url: URL.createObjectURL(b) }); }
  }
  renderStrip();
}
async function sharePost() {
  const caption = $('#cap').value.trim(), o = $('input[name=occ]:checked')?.value || 'everyday';
  if (!S.draft.length && !caption) return toast('Add a photo or write something');
  if (!needOnline()) return;
  busy(true, S.draft.some(m => m.type === 'video') ? 'Uploading… this may take a moment' : 'Sharing with family… ❤️');
  try {
    const media = await Promise.all(S.draft.map(async m => ({ type: m.type, url: await upload(m.type === 'video' ? 'video' : 'image', m.blob) })));
    const first = media[0] || {};
    const { data, error } = await sb.from('posts').insert({
      name: S.name, caption, oct: o, media, reactions: {},
      photo_url: first.type === 'photo' ? first.url : null, video_url: first.type === 'video' ? first.url : null,
    }).select().single();
    if (error) throw error;
    if (!S.posts.some(p => p.id === data.id)) S.posts.unshift(data);
    S.draft.forEach(m => URL.revokeObjectURL(m.url)); S.draft = [];
    history.back(); renderFeed(); scroller.scrollTop = 0; toast('✨ Moment shared!'); buzz([15, 8, 15]); beep('send');
  } catch (e) { toast('Upload failed — please try again', 3000, true); }
  busy(false);
}

/* ── sheets: post menu, filter, theme ────────────────────── */
const dlgPost = $('#dlg-post');
function openPostMenu(card) {
  const p = S.posts.find(x => x.id === card.dataset.id); if (!p) return;
  dlgPost.dataset.id = p.id; const ms = mediaOf(p), photo = ms.some(m => m.type === 'photo');
  $('#pin-lbl').textContent = S.pinned === p.id ? 'Unpin' : 'Pin to top';
  $('#p-full').hidden = !photo; $('#p-save').hidden = !ms.length; $('#p-copy').hidden = !p.caption; $('#p-del').hidden = !isOwn(p.name);
  dlgPost.showModal();
}
const menuPost = () => S.posts.find(x => x.id === dlgPost.dataset.id);
function openFilter() {
  const names = [...new Set(S.posts.map(p => p.name))];
  $('#filter-list').replaceChildren(...['All', ...names].map(n => el('button', { class: 'pill pressable' + ((n === 'All' ? !S.filter : S.filter === n) ? ' on' : ''), 'data-act': 'filter-pick', 'data-n': n, text: n })));
  $('#dlg-filter').showModal();
}
function applyTheme(id) {
  const d = document.documentElement; id === 'default' ? delete d.dataset.theme : (d.dataset.theme = id);
  store.set('ayl_theme', id); $('#themeColorMeta').content = THEME_BG[id] || THEME_BG.default;
  $$('.th').forEach(b => b.classList.toggle('on', b.dataset.id === id));
}
function openTheme() {
  const t = store.get('ayl_theme', document.documentElement.dataset.theme || 'default'); $$('.th').forEach(b => b.classList.toggle('on', b.dataset.id === t));
  $$('[data-act=fs-pick]').forEach(b => b.classList.toggle('on', b.dataset.s === (store.get('ayl_fs') || 'md')));
  $('#cpri').value = store.get('ayl_cp', '#C4622D'); $('#cpri2').value = store.get('ayl_cp2', '#E8A87C');
  const nb = $('#notif-btn'); const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  nb.hidden = perm === 'unsupported' || perm === 'denied'; nb.lastChild.textContent = perm === 'granted' ? 'Notifications are on' : 'Turn on notifications';
  $('#dlg-theme').showModal();
}
async function enableNotifs() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return toast('Not supported on this device');
  if (await Notification.requestPermission() !== 'granted') return toast('Notifications are off');
  await subscribePush(true); toast('🔔 Notifications on');
}
async function subscribePush(force) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
  if (!force && store.get('ayl_push') === S.name) return;
  try {
    const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const p = '='.repeat((4 - CFG.VAPID.length % 4) % 4), raw = atob((CFG.VAPID + p).replace(/-/g, '+').replace(/_/g, '/'));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) });
    }
    const j = sub.toJSON();
    await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, auth: j.keys.auth, p256dh: j.keys.p256dh, name: S.name }, { onConflict: 'endpoint' });
    store.set('ayl_push', S.name);
  } catch (e) { console.log('push', e); }
}

/* ── photo viewer ────────────────────────────────────────── */
const dlgV = $('#dlg-viewer'), vImg = $('#v-img');
function openViewer(items, i, p) {
  S.viewer = { items, i, p }; dlgV.showModal(); showViewer();
  $('#v-who').textContent = p ? p.name : ''; $('#v-cap').textContent = p?.caption || ''; $('#v-date').textContent = p ? fullDate(p.created_at) : '';
}
function showViewer() {
  const { items, i } = S.viewer, u = items[i];
  vImg.onerror = () => { vImg.onerror = null; vImg.src = u; }; vImg.src = cld(u, 1600);
  $('#v-count').textContent = items.length > 1 ? `${i + 1} / ${items.length}` : '';
  $$('.v-nav', dlgV).forEach(b => (b.hidden = items.length < 2));
}
const vStep = d => { const v = S.viewer; v.i = (v.i + d + v.items.length) % v.items.length; showViewer(); };
(function swipe() {       // drag the photo 1:1; flick sideways to page, down to dismiss
  const st = $('#v-stage'); let x0, y0, dx, dy, t0, on = false;
  st.addEventListener('pointerdown', e => { on = true; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; t0 = e.timeStamp; st.setPointerCapture(e.pointerId); vImg.style.transition = 'none'; });
  st.addEventListener('pointermove', e => {
    if (!on) return; dx = e.clientX - x0; dy = e.clientY - y0;
    vImg.style.transform = Math.abs(dy) > Math.abs(dx) ? `translateY(${dy}px) scale(${1 - Math.min(Math.abs(dy) / 900, .25)})` : `translateX(${dx}px)`;
  });
  const end = e => {
    if (!on) return; on = false; const v = Math.abs(Math.abs(dy) > Math.abs(dx) ? dy : dx) / Math.max(1, e.timeStamp - t0);
    vImg.style.transition = 'transform .35s cubic-bezier(.34,1.4,.64,1)'; vImg.style.transform = '';
    if (Math.abs(dy) > Math.abs(dx) && (Math.abs(dy) > 110 || v > .6)) dlgV.close();
    else if (Math.abs(dx) > 60 && S.viewer.items.length > 1) vStep(dx < 0 ? 1 : -1);
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
})();
addEventListener('keydown', e => { if (dlgV.open) { if (e.key === 'ArrowRight') vStep(1); if (e.key === 'ArrowLeft') vStep(-1); } });
async function saveMedia(url) {
  try {
    const b = await (await fetch(url, { mode: 'cors' })).blob(), file = new File([b], 'family-moment.' + (b.type.split('/')[1] || 'jpg'), { type: b.type });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    const a = el('a', { href: URL.createObjectURL(b), download: file.name }); document.body.append(a); a.click(); a.remove();
  } catch (e) { if (e.name !== 'AbortError') window.open(url, '_blank'); }
}

/* ── tap handling: one listener for the whole app ────────── */
const ACT = {
  back() { history.length > 1 && history.state?.v && history.state.v !== 'feed' ? history.back() : go('feed', { push: false }); },
  search() { const b = $('#searchbar'); b.hidden ? (b.hidden = false, document.body.classList.add('searching'), $('#q').focus()) : closeSearch(); },
  filter: openFilter, theme: openTheme, me() { openUser(S.name); },
  'dismiss-rem'() { remDismissed = true; $('#reminder').hidden = true; },
  newpill(b) { b.hidden = true; S.newCount = 0; renderFeed(); scroller.scrollTo({ top: 0, behavior: 'smooth' }); },
  pick(b) { $({ camera: '#cameraIn', gallery: '#galleryIn', video: '#videoIn' }[b.dataset.k]).click(); },
  'rm-draft'(b) { const [m] = S.draft.splice(+b.dataset.i, 1); URL.revokeObjectURL(m.url); renderStrip(); },
  fmt(b) {
    const ta = $('#cap'), w = b.dataset.w, a = ta.selectionStart, z = ta.selectionEnd, sel = ta.value.slice(a, z) || 'text';
    ta.setRangeText(w + sel + w, a, z, 'select'); ta.focus(); ta.dispatchEvent(new Event('input'));
  },
  mention(b) { const ta = $('#cap'); ta.setRangeText('@' + b.dataset.n + ' ', ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')); },
  ctab(b) { setChatTab(b.dataset.t); },
  'dm-back'() { setChatTab('dms'); },
  'dm-open'(b) { setChatTab('thread', b.dataset.name); },
  call(b) { callTo(S.thread, b.dataset.video === '1'); },
  'open-user'(b) { openUser(b.dataset.name); },
  edit() { go('edit'); },
  'msg-user'() { S.thread = S.viewingUser; go('chat'); setChatTab('thread', S.viewingUser); },
  'call-user'(b) { callTo(S.viewingUser, b.dataset.video === '1'); },
  pic() { $('#profilePicIn').click(); },
  'rm-pic'() { const pr = S.profiles[S.name]; if (pr) { delete pr.photo; sb.from('profiles').update({ photo: null }).eq('name', S.name).then(() => {}); store.setJson('ayl_profiles', S.profiles); } S.draftPic = null; fillEdit(); refreshAll(); },
  /* post card */
  profile(b) { openUser(S.posts.find(p => p.id === b.closest('.card').dataset.id)?.name); },
  date(b) { const p = S.posts.find(p => p.id === b.closest('.card').dataset.id); p && toast(fullDate(p.created_at), 3500); },
  more(b) { openPostMenu(b.closest('.card')); },
  rxn(b) { react(b.closest('.card'), b.dataset.e); },
  cmts(b) { toggleCmts(b.closest('.card')); },
  view(b) {
    const p = S.posts.find(p => p.id === b.closest('.card').dataset.id), list = mediaOf(p), photos = list.filter(m => m.type === 'photo');
    openViewer(photos.map(m => m.url), Math.max(0, photos.indexOf(list[+b.dataset.i])), p);
  },
  gal(b) { const p = S.posts.find(p => p.id === b.dataset.id), ph = mediaOf(p).filter(m => m.type === 'photo'); openViewer(ph.map(m => m.url), 0, p); },
  vplay(b) { const v = b.previousElementSibling; v.paused ? v.play() : v.pause(); },
  'view-img'(b) { openViewer([b.dataset.full], 0, null); },
  /* comments */
  reply(b) { const card = b.closest('.card'), n = b.closest('.cmt'), c = (S.cmts[card.dataset.id] || []).find(x => String(x.id) === n.dataset.cid); (S.cmtState[card.dataset.id] ||= {}).reply = { id: c.id, name: c.name }; renderCmts(card); f(card, 'ctext').focus(); },
  'clear-reply'(b) { const card = b.closest('.card'); (S.cmtState[card.dataset.id] ||= {}).reply = null; renderCmts(card); },
  attach(b) { S.cmtTarget = b.closest('.card'); $('#commentImgIn').click(); },
  'clear-cimg'(b) { const card = b.closest('.card'), st = S.cmtState[card.dataset.id]; if (st?.img) URL.revokeObjectURL(st.img.url); st.img = null; renderCmts(card); },
  crxn(b) { reactCmt(b.closest('.cmt'), b.dataset.e); },
  delc(b) { deleteCmt(b.closest('.cmt')); },
  'more-cmts'(b) { const card = b.closest('.card'), pid = card.dataset.id; S.cmtPage[pid] = (S.cmtPage[pid] || 1) + 1; renderCmts(card); },
  /* chat bubbles */
  msg(b) { if (isOwn(S.name) && b.closest('.msg').classList.contains('own')) b.closest('.msg').classList.toggle('sel'); },
  delmsg(b) { deleteMsg(b.closest('.msg')); },
  /* sheets */
  'p-profile'() { dlgPost.close(); openUser(menuPost()?.name); },
  'p-pin'() { const p = menuPost(); S.pinned = S.pinned === p.id ? null : p.id; store.set('ayl_pinned', S.pinned || ''); dlgPost.close(); renderFeed(); toast(S.pinned ? '📌 Pinned to top' : 'Unpinned'); },
  'p-full'() { const p = menuPost(), ph = mediaOf(p).filter(m => m.type === 'photo'); dlgPost.close(); openViewer(ph.map(m => m.url), 0, p); },
  'p-save'() { const m = mediaOf(menuPost())[0]; dlgPost.close(); saveMedia(m.url); },
  'p-copy'() { navigator.clipboard?.writeText(menuPost().caption).then(() => toast('📋 Copied')); dlgPost.close(); },
  async 'p-del'() { const id = menuPost().id; dlgPost.close(); if (!await confirmSheet('Delete this moment?')) return; const { error } = await sb.from('posts').delete().eq('id', id); if (error) return toast('Couldn’t delete', 2400, true); S.posts = S.posts.filter(p => p.id !== id); renderFeed(); toast('Deleted'); },
  'cf-ok'() { const r = cfRes; cfRes = null; $('#dlg-confirm').close(); r?.(true); },
  'filter-pick'(b) { S.filter = b.dataset.n === 'All' ? null : (S.filter === b.dataset.n ? null : b.dataset.n); $('#dlg-filter').close(); renderFeed(); },
  'theme-pick'(b) { applyTheme(b.dataset.id); },
  'custom-apply'() {
    const a = $('#cpri').value, c = $('#cpri2').value, d = document.documentElement;
    store.set('ayl_cp', a); store.set('ayl_cp2', c); d.style.setProperty('--cp', a); d.style.setProperty('--cp2', c); applyTheme('custom'); toast('🎨 Custom colours applied');
  },
  'fs-pick'(b) { document.documentElement.dataset.fs = b.dataset.s; store.set('ayl_fs', b.dataset.s); $$('[data-act=fs-pick]').forEach(x => x.classList.toggle('on', x === b)); },
  notif: enableNotifs,
  'v-save'() { const v = S.viewer; saveMedia(v.items[v.i]); },
  'v-prev'() { vStep(-1); }, 'v-next'() { vStep(1); },
};
document.addEventListener('click', e => {
  const t = e.target;
  if (t instanceof HTMLDialogElement && t.classList.contains('sheet')) {            // tap on the dimmed backdrop
    const r = t.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) t.close(); return;
  }
  const g = t.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const c = t.closest('[data-close]'); if (c) { c.closest('dialog').close(); return; }
  const a = t.closest('[data-act]'); if (a) ACT[a.dataset.act]?.(a, e);
});
document.addEventListener('submit', e => {
  e.preventDefault(); const form = e.target;
  if (form.id === 'ob-form') join(); else if (form.id === 'add-form') sharePost(); else if (form.id === 'chat-form') sendChat();
  else if (form.id === 'edit-form') saveProfile(); else if (form.id === 'gate-form') unlock(); else if (form.dataset.f === 'cform') sendCmt(form);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.hasAttribute('data-auto')) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 130) + 'px'; }
  if (t.id === 'cap') { const n = t.value.length; const c = $('#count'); c.textContent = `${n} / ${CFG.MAX_CAP}`; c.classList.toggle('over', n > CFG.MAX_CAP * .9); }
});
document.addEventListener('keydown', e => {       // Enter sends in chat and comments, Shift+Enter = new line
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.matches?.('textarea[data-auto]')) { e.preventDefault(); e.target.form?.requestSubmit(); }
});
let qT; $('#q').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value.trim(); renderFeed(); }, 160); });
function closeSearch() { const b = $('#searchbar'); if (b.hidden) return; b.hidden = true; document.body.classList.remove('searching'); $('#q').value = ''; if (S.q) { S.q = ''; renderFeed(); } }
for (const [id, kind] of [['galleryIn', 'photo'], ['cameraIn', 'photo'], ['videoIn', 'video']])
  $('#' + id).addEventListener('change', e => { addFiles(e.target.files, kind); e.target.value = ''; });
$('#commentImgIn').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file || !S.cmtTarget) return;
  const b = await shrink(file, 1000), card = S.cmtTarget, st = (S.cmtState[card.dataset.id] ||= {});
  if (st.img) URL.revokeObjectURL(st.img.url); st.img = { blob: b, url: URL.createObjectURL(b) }; renderCmts(card);
});
$('#profilePicIn').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const b = await shrink(file, 600, .82); S.draftPic = { blob: b, url: URL.createObjectURL(b) };
  const av = $('#e-av'); av.className = 'av lg'; av.replaceChildren(el('img', { src: S.draftPic.url, alt: '' })); $('#e-colors').hidden = true;
});
addEventListener('online', () => ($('#offline').hidden = true)); addEventListener('offline', () => ($('#offline').hidden = false));

/* ── realtime (incremental: apply the change, don't refetch) ─ */
const CH = {};
function sub(key, table, fn) {
  if (CH[key]) sb.removeChannel(CH[key]);
  CH[key] = sb.channel(`${key}-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table }, fn).subscribe(st => {
    if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(CH[key + 'T']); CH[key + 'T'] = setTimeout(() => document.visibilityState === 'visible' && sub(key, table, fn), 4000); }
  });
}
const subscribeAll = () => { sub('posts', 'posts', onPost); sub('messages', 'messages', onMsg); sub('comments', 'comments', onCmt); sub('profiles', 'profiles', onProfile); };
const unsubscribeAll = () => ['posts', 'messages', 'comments', 'profiles'].forEach(k => { if (CH[k]) { sb.removeChannel(CH[k]); CH[k] = null; } });
function onPost({ eventType: t, new: n, old: o }) {
  if (t === 'INSERT') { if (S.posts.some(p => p.id === n.id)) return; S.posts.unshift(n); isOwn(n.name) ? renderFeed() : newPostArrived(); }
  else if (t === 'UPDATE') { const p = S.posts.find(p => p.id === n.id); if (p) { Object.assign(p, n); $$(`.card[data-id="${CSS.escape(p.id)}"]`).forEach(c => updateCard(c, p)); } }
  else if (t === 'DELETE') { S.posts = S.posts.filter(p => p.id !== o.id); renderFeed(); }
}
function onMsg({ eventType: t, new: m, old: o }) {
  if (t === 'DELETE') { const id = String(o.id); S.msgs = S.msgs.filter(x => String(x.id) !== id); for (const k in S.dms) S.dms[k] = S.dms[k].filter(x => String(x.id) !== id); msgsEl.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove(); return; }
  if (t !== 'INSERT') return;
  const key = m.dm_key || null; if (key && !key.split('|').includes(S.name)) return;     // not my conversation
  const list = key ? (S.dms[key] ??= []) : S.msgs; if (list.some(x => x.id === m.id)) return;
  const tmp = isOwn(m.name) && list.findIndex(x => String(x.id).startsWith('tmp') && x.text === m.text); if (tmp > -1) return;   // my own optimistic copy is already shown
  list.push(m);
  const open = S.view === 'chat' && (key ? S.chatTab === 'thread' && threadKey() === key : S.chatTab === 'group');
  if (open) appendMsg(m, key);
  else if (!isOwn(m.name)) { key ? (S.dmUnread[key] = (S.dmUnread[key] || 0) + 1) : S.groupUnread++; updateBadges(); if (S.view === 'chat' && S.chatTab === 'dms') renderDmList(); }
  if (!isOwn(m.name)) beep('receive');
}
function onCmt({ eventType: t, new: c, old: o }) {
  if (t === 'INSERT') {
    if (S.cmtMeta.some(x => x.id === c.id)) return; addCmtLocal(c);
    const card = cardOf(c.post_id); if (!card) return;
    if (!f(card, 'cbody').hidden) renderCmts(card); else if (!isOwn(c.name)) { S.newDot.add(c.post_id); updateCard(card, S.posts.find(p => p.id === c.post_id)); }
    f(card, 'cbadge').textContent = S.cc[c.post_id] || 0;
  } else if (t === 'UPDATE') {
    const l = S.cmts[c.post_id], x = l?.find(k => k.id === c.id); if (x) { x.reactions = c.reactions; const card = cardOf(c.post_id); card && !f(card, 'cbody').hidden && renderCmts(card); }
  } else if (t === 'DELETE') {
    const id = o.id; for (const pid in S.cmts) if (S.cmts[pid].some(k => k.id === id)) { removeCmtLocal(id, pid); const card = cardOf(pid); if (card) { renderCmts(card); } return; }
    const m = S.cmtMeta.find(k => k.id === id); if (m) { removeCmtLocal(id, m.post_id); const card = cardOf(m.post_id); card && (f(card, 'cbadge').textContent = S.cc[m.post_id] || 0); }
  }
}
let profT; function onProfile() { clearTimeout(profT); profT = setTimeout(async () => { await db.profiles(); refreshAll(); }, 400); }

let hiddenT, lastRefresh = Date.now(), subscribed = false;
async function refresh() {
  lastRefresh = Date.now();
  await Promise.all([db.posts(), db.group()]); renderFeed();
  if (S.view === 'chat') setChatTab(S.chatTab); for (const pid in S.cmts) if (cardOf(pid) && !f(cardOf(pid), 'cbody').hidden) db.cmts(pid).then(() => renderCmts(cardOf(pid)));
}
document.addEventListener('visibilitychange', () => {
  if (!S.name) return;
  if (document.visibilityState === 'hidden') { hiddenT = setTimeout(() => { unsubscribeAll(); subscribed = false; }, 60000); return; }   // stop listening in the background → saves battery
  clearTimeout(hiddenT);
  if (!subscribed) { subscribeAll(); subscribed = true; }
  if (Date.now() - lastRefresh > 20000) refresh();
});
setInterval(() => { if (document.visibilityState === 'visible' && S.view === 'feed') for (const [id, n] of cardEls) { const p = S.posts.find(x => x.id === id); p && (f(n, 'time').textContent = ago(p.created_at)); } }, 60000);

/* ── gate (optional), calls loader, boot ─────────────────── */
async function unlock() {
  const inp = $('#gate-in'), err = $('#gate-err'); err.textContent = '';
  try {
    const r = await (await fetch(CFG.VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: inp.value }) })).json();
    if (!r.success) throw new Error(r.error || 'Incorrect passcode');
    await sb.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token }); begin();
  } catch (e) { err.textContent = e.message; inp.value = ''; $('#gate-form').animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 260 }); }
}
let callsP;
const loadCalls = () => callsP ??= new Promise((ok, no) => { const s = el('script', { src: 'calls.js' }); s.onload = ok; s.onerror = no; document.head.append(s); });
const callTo = (name, video) => name && loadCalls().then(() => window.Calls.start(name, video)).catch(() => toast('Calls unavailable offline', 2400, true));

function join() {
  const n = $('#ob-in').value.trim(); if (!n) return;
  S.name = n; store.set('ayl_name', n); document.body.dataset.state = 'app'; start();
}
function begin() { document.body.dataset.state = S.name ? 'app' : 'ob'; if (S.name) start(); }
async function start() {
  S.profiles = store.json('ayl_profiles', {});
  setAv($('#me-av'), S.name, 'sm'); $('#add-as').textContent = S.name;
  const cached = store.json('ayl_cache', []); if (cached.length) { S.posts = cached; renderFeed(); }      // instant paint from last visit
  history.replaceState({ v: 'feed' }, ''); $('#themeColorMeta').content = THEME_BG[store.get('ayl_theme', 'default')] || THEME_BG.default;
  await Promise.all([db.posts(), db.group(), db.profiles(), db.cmtMeta()]);
  S.ready = true; S.groupUnread = S.msgs.filter(m => !isOwn(m.name) && new Date(m.created_at) > +store.get('ayl_msgseen', 0)).length;
  renderFeed(); S.loaded = true; updateBadges();
  store.set('ayl_seen', Date.now());
  showGreeting(); showReminder(); checkBirthdays();
  subscribeAll(); subscribed = true;
  db.seen().then(() => { db.markSeen(); for (const [id, n] of cardEls) updateCard(n, S.posts.find(p => p.id === id)); });
  db.dmAll().then(updateBadges);
  subscribePush(false);
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => loadCalls().then(() => window.Calls.init()).catch(() => {}));
}
function checkBirthdays() {
  const t = new Date();
  for (const [n, p] of Object.entries(S.profiles)) {
    if (!p.birthday) continue; const b = new Date(p.birthday + 'T12:00'), key = `ayl_bd_${n}_${t.getFullYear()}`;
    if (b.getMonth() === t.getMonth() && b.getDate() === t.getDate() && !store.get(key)) { store.set(key, 1); setTimeout(() => toast(`🎂 Today is ${n}’s birthday!`, 5000), 2500); }
  }
}
window.AYL = { S, el, toast, beep, buzz, avEl, setAv, colorOf, isOwn };

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
S.name = store.get('ayl_name', '');
if (CFG.GATE_ON) { document.body.dataset.state = 'gate'; sb.auth.getSession().then(({ data }) => data.session?.user?.app_metadata?.unlocked ? begin() : $('#gate-in').focus()); }
else begin();
