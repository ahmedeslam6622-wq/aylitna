/* ═══════════════════════════════════════════════════════════
   calls.js — voice & video calls (PeerJS). Loaded lazily after the
   feed is on screen, so it never slows the first paint.
   One state machine: idle → outgoing | incoming → active → idle.
   The UI is the static <dialog id="call"> in index.html; CSS shows
   the right buttons from its data-state attribute.
   ═══════════════════════════════════════════════════════════ */
'use strict';
window.Calls = (() => {
  const { S, toast, beep, buzz, setAv } = window.AYL;
  const $ = s => document.querySelector(s);
  const dlg = $('#call'), st = $('#call-st');
  let peer = null, ready = false, retries = 0, state = 'idle', call = null, pending = null;
  let local = null, audioEl = null, target = null, videoOn = false, muted = false, ring = null, noAnswer = null;

  const peerId = n => 'aylitna-' + n.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
  const setState = s => { state = s; dlg.dataset.state = s; };
  const status = t => (st.textContent = t);

  const loadPeerJS = () => window.Peer ? Promise.resolve() : new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = CFG.PEERJS_SRC; s.onload = ok; s.onerror = no; document.head.append(s);
  });
  async function ice() {
    try {
      const r = await fetch(`https://${CFG.METERED_HOST}/api/v1/turn/credentials?apiKey=${CFG.METERED_KEY}`);
      const l = await r.json(); if (Array.isArray(l) && l.length) return l;
    } catch {}
    return [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  }

  async function init() {
    if (!S.name || peer) return;
    try { await loadPeerJS(); } catch { return; }
    peer = new Peer(peerId(S.name), { debug: 0, config: { iceServers: await ice() } });
    peer.on('open', () => { ready = true; retries = 0; });
    peer.on('call', onIncoming);
    peer.on('connection', c => c.on('data', control));
    peer.on('disconnected', () => { ready = false; try { peer.reconnect(); } catch {} });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { peer.destroy(); peer = null; if (retries++ < 5) setTimeout(init, 2500); }     // same name open on another device
      else if (e.type === 'peer-unavailable') { toast(`📵 ${target || 'They'} is offline`); reset(); }
      else if (['network', 'server-error'].includes(e.type)) { ready = false; setTimeout(() => { try { peer.reconnect(); } catch {} }, 1500); }
    });
  }
  function control(m) {
    if (m === 'decline') toast(`${target || 'They'} declined`); else if (m === 'busy') toast(`${target || 'They'} is busy`); else if (m === 'hangup') toast('Call ended');
    if (['decline', 'busy', 'hangup'].includes(m)) reset();
  }
  function send(name, msg) {
    if (!peer || !ready) return;
    try { const c = peer.connect(peerId(name)); c.on('open', () => { c.send(msg); setTimeout(() => { try { c.close(); } catch {} }, 400); }); } catch {}
  }
  /* Always request audio+video and just disable the video track for voice calls,
     so both sides negotiate the same tracks (avoids one-way media bugs). */
  async function media(video) {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    try { const s = await navigator.mediaDevices.getUserMedia({ audio, video: { facingMode: 'user' } }); if (!video) s.getVideoTracks().forEach(t => (t.enabled = false)); return s; }
    catch {
      try { return await navigator.mediaDevices.getUserMedia({ audio }); }
      catch (e) { toast(e.name === 'NotAllowedError' ? '🎙️ Allow the microphone in your browser settings' : '❌ Microphone unavailable', 3600, true); return null; }
    }
  }
  function show(name) {
    setAv($('#call-av'), name, 'lg'); $('#call-name').textContent = name;
    if (!dlg.open) dlg.showModal();
    $('#muteBtn').classList.remove('on'); $('#vidBtn').classList.toggle('on', videoOn); $('#spkBtn').classList.add('on');
  }
  function localVideo() {
    const lv = $('#localVideo'); if (local) lv.srcObject = local; lv.classList.toggle('show', videoOn && !!local?.getVideoTracks().length);
  }
  function wire(c) {
    c.on('stream', remote => {
      setState('active'); clearTimeout(noAnswer); stopRing();
      if (!audioEl) { audioEl = document.createElement('audio'); audioEl.autoplay = true; audioEl.setAttribute('playsinline', ''); document.body.append(audioEl); }
      audioEl.srcObject = remote;
      audioEl.play().then(() => status('Connected')).catch(() => {
        status('Tap to hear 🔊'); const u = () => audioEl?.play().then(() => status('Connected')); dlg.addEventListener('click', u, { once: true });
      });
      const rv = $('#remoteVideo'), hasV = remote.getVideoTracks().length > 0;
      rv.srcObject = remote; rv.classList.toggle('show', hasV && videoOn); rv.play?.().catch(() => {});
    });
    c.on('close', () => { if (state !== 'idle') { toast('Call ended'); reset(); } });
    c.on('error', () => { toast('Call error', 2400, true); reset(); });
  }
  function startRing() { stopRing(); beep('ring'); ring = setInterval(() => beep('ring'), 3000); }
  function stopRing() { clearInterval(ring); ring = null; }

  async function start(name, video) {
    if (!navigator.onLine) return toast('📡 No internet', 2400, true);
    if (state !== 'idle') return toast('You are already in a call');
    if (!peer || !ready) { toast('⏳ Connecting… try again in a moment'); init(); return; }
    setState('outgoing'); target = name; videoOn = !!video;
    local = await media(video); if (!local) return reset();
    show(name); status('Calling…'); localVideo(); startRing();
    call = peer.call(peerId(name), local, { metadata: { name: S.name, video: !!video } });
    if (!call) { toast('❌ Call failed', 2400, true); return reset(); }
    wire(call); noAnswer = setTimeout(() => { if (state === 'outgoing') { toast(`${name} didn’t answer`); hangup(); } }, 30000);
  }
  function onIncoming(c) {
    if (state !== 'idle') { c.close(); if (c.metadata?.name) send(c.metadata.name, 'busy'); return; }
    setState('incoming'); pending = c; target = c.metadata?.name || 'Someone'; videoOn = !!c.metadata?.video;
    show(target); status(`${target} is calling…`); startRing(); buzz([300, 150, 300]);
    noAnswer = setTimeout(() => state === 'incoming' && decline(), 45000);
  }
  async function accept() {
    if (state !== 'incoming' || !pending) return;
    stopRing(); clearTimeout(noAnswer);
    local = await media(videoOn); if (!local) return decline();
    call = pending; pending = null; setState('active'); localVideo(); wire(call); call.answer(local); status('Connecting…');
  }
  function decline() { if (target) send(target, 'decline'); reset(); }
  function hangup() { if (target) send(target, 'hangup'); reset(); }
  function reset() {
    stopRing(); clearTimeout(noAnswer);
    try { call?.close(); } catch {} try { pending?.close(); } catch {}
    call = pending = null; local?.getTracks().forEach(t => t.stop()); local = null;
    if (audioEl) { audioEl.pause(); audioEl.srcObject = null; audioEl.remove(); audioEl = null; }
    $('#remoteVideo').srcObject = null; $('#localVideo').srcObject = null; $('#remoteVideo').classList.remove('show'); $('#localVideo').classList.remove('show');
    target = null; videoOn = muted = false; setState('idle'); if (dlg.open) dlg.close();
  }

  dlg.addEventListener('cancel', e => { e.preventDefault(); state === 'incoming' ? decline() : hangup(); });   // Esc / Android back
  dlg.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    ({
      accept, decline, hang: hangup,
      mute() { muted = !muted; local?.getAudioTracks().forEach(t => (t.enabled = !muted)); a.classList.toggle('on', muted); },
      spk() { if (audioEl) { audioEl.volume = audioEl.volume > .5 ? .4 : 1; a.classList.toggle('on', audioEl.volume > .5); } },
      vid() { videoOn = !videoOn; local?.getVideoTracks().forEach(t => (t.enabled = videoOn)); a.classList.toggle('on', videoOn); localVideo(); $('#remoteVideo').classList.toggle('show', videoOn); },
    })[a.dataset.act]?.();
  });
  return { init, start };
})();
