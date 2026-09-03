/* ══════════════════════════════════════════════════════
   CONFIG.JS
   Settings, constants, app state, and small utility
   functions used everywhere else. If you're changing a
   setting, a color, a limit, or adding a new piece of
   shared state — it goes here.
   Loaded FIRST — everything else depends on this file.
   ══════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════════════════ */
const SB_URL  = 'https://ptpprauzusyrbrigfyji.supabase.co';
const SB_KEY  = 'sb_publishable_K4QVE01BB4XSfmUlemIJZQ_TyFDDR1H';
const CLD_CLOUD      = 'df618arjm';
const CLD_PRESET     = 'zsz6vswy';
const CLD_VID_CLOUD  = 'hhjzkoeh';
const CLD_VID_PRESET = 'aylitna-video';
const VAPID   = 'BClsAtEWOVK95B0atTRO4d6-QacLuKZg_X5p6r3YXKaOI35BF7TsRR-NOPDnEC_omwyZQRiQtqgeZWmbs6hasUw';
const ANTHROPIC_KEY = ''; // add your Anthropic key here for AI photo tagging
const USE_SB  = !!(SB_URL && SB_KEY);
let sb = null;
if (USE_SB) sb = supabase.createClient(SB_URL, SB_KEY);

/* ══════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════ */
const MC = [
  {bg:'#FAECE7',br:'#D85A30',tx:'#7A3010'},{bg:'#E6F1FB',br:'#378ADD',tx:'#0E4A8A'},
  {bg:'#EAF3DE',br:'#5A9A1A',tx:'#2E5A08'},{bg:'#FAEEDA',br:'#C47A10',tx:'#7A4A08'},
  {bg:'#EEEDFE',br:'#7A6AE0',tx:'#3A2AAA'},{bg:'#E1F5EE',br:'#1A9A65',tx:'#0A5A3A'},
  {bg:'#FDE8F4',br:'#C4498A',tx:'#7A1050'},{bg:'#E8F4FE',br:'#2A8AC4',tx:'#0A4A7A'},
];
const OCTS = [
  {id:'everyday', l:'Everyday',   e:'💛', bg:'#FAEEDA',br:'#C47A10',tx:'#7A4A08'},
  {id:'birthday', l:'Birthday',   e:'🎂', bg:'#FAECE7',br:'#D85A30',tx:'#7A3010'},
  {id:'eid',      l:'Eid',        e:'🌙', bg:'#EEEDFE',br:'#7A6AE0',tx:'#3A2AAA'},
  {id:'travel',   l:'Travel',     e:'✈️', bg:'#E6F1FB',br:'#378ADD',tx:'#0E4A8A'},
  {id:'together', l:'Together',   e:'👨‍👩‍👧‍👦',bg:'#EAF3DE',br:'#5A9A1A',tx:'#2E5A08'},
  {id:'home',     l:'Home',       e:'🏡', bg:'#E1F5EE',br:'#1A9A65',tx:'#0A5A3A'},
  {id:'food',     l:'Food',       e:'🍽️', bg:'#FDE8F4',br:'#C4498A',tx:'#7A1050'},
  {id:'milestone',l:'Milestone',  e:'🏆', bg:'#FEF3C7',br:'#C47A10',tx:'#7A4A08'},
  {id:'prayer',   l:'Prayer',     e:'🤲', bg:'#EEEDFE',br:'#7A6AE0',tx:'#3A2AAA'},
  {id:'health',   l:'Health',     e:'💊', bg:'#E1F5EE',br:'#1A9A65',tx:'#0A5A3A'},
  {id:'goingout', l:'Going Out',  e:'🎉', bg:'#FDE8F4',br:'#C4498A',tx:'#7A1050'},
];
const RXN     = ['❤️','😂','😍','👏','😢','🔥','🤗','😮'];
const CMT_RXN = ['❤️','😂','👍','🔥'];

/* ── SVG icons for the glass menu (replacing emoji) ──────
   Minimal, consistent 1.8px stroke, rounded caps/joins —
   matches the app's soft glassmorphic aesthetic better than
   emoji, and renders identically across every device/OS. */
const ICO_DOTS=`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
const ICO_SEARCH=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`;
const ICO_THEME=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 15 15 15h3a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="11" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`;
const ICO_USER=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`;
const ICO_FILTER=`<svg viewBox="0 0 32 32" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="fill: currentColor;"><path d="M30 6.749h-28c-0.69 0-1.25 0.56-1.25 1.25s0.56 1.25 1.25 1.25v0h28c0.69 0 1.25-0.56 1.25-1.25s-0.56-1.25-1.25-1.25v0zM24 14.75h-16c-0.69 0-1.25 0.56-1.25 1.25s0.56 1.25 1.25 1.25v0h16c0.69 0 1.25-0.56 1.25-1.25s-0.56-1.25-1.25-1.25v0zM19 22.75h-6.053c-0.69 0-1.25 0.56-1.25 1.25s0.56 1.25 1.25 1.25v0h6.053c0.69 0 1.25-0.56 1.25-1.25s-0.56-1.25-1.25-1.25v0z"></path></svg>`;


const THEMES  = [
  {id:'default', name:'Warm',   e:'🧡', bg:'#FAF8F3', p:'#C4622D'},
  {id:'midnight',name:'Night',  e:'🌙', bg:'#0F0E17', p:'#8B5CF6'},
  {id:'rose',    name:'Rose',   e:'🌸', bg:'#FFF5F7', p:'#E11D6A'},
  {id:'forest',  name:'Forest', e:'🌿', bg:'#F4F7F2', p:'#2D7A3A'},
  {id:'ocean',   name:'Ocean',  e:'🌊', bg:'#F0F6FF', p:'#1A6FC4'},
  {id:'sand',    name:'Sand',   e:'🏜️', bg:'#FBF7EE', p:'#8B6914'},
];
const CMT_PAGE = 5;
const MAX_CAP  = 300;
const MAX_MEDIA = 10; // cap per post so uploads don't run away
const METERED_API_KEY = 'JSia8dCBTVVw7f8RmASIFQ4DhJ_YJSgHYpPAovOQ89T2cBN4';

async function getTurnServers(){
  try{
    const res = await fetch(`https://aylitna.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
    if(!res.ok)throw new Error('Failed');
    const servers = await res.json();
    if(Array.isArray(servers) && servers.length) return servers;
  }catch(e){console.log('TURN fetch failed, using STUN only',e);}
  return [
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
  ];
}

/* ══════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════ */
let posts=[], messages={group:[]}, dmMessages={}, comments={};
// messages = { group: [...], dmKey: [...] }  dmKey = sorted pair e.g. "Ahmed|Omar"
let myName='', filter=null, view='feed', prevView='feed';
// draftMedia: [{type:'photo', dataURL}, {type:'video', file, previewURL}, ...]
// replaces the old single draftPhoto/draftVideo/draftVideoFile.
let draftMedia=[], selOct='everyday', showNameInput=false, fullPost=null;
let reminderDismissed=false, greetingDismissed=false;
let loadingFeed=false, unreadMsgs=0, lastMsgSeen=0, lastSeen=0;
let openComments={}, cmtDraft={}, cmtPages={}, openCtx=null;
let commentImgTarget=null, nameColors={}, searchQ='', showSearch=false;
let pinnedPostId=null, seenBy={}, newCmtPosts={};
let isOnline=navigator.onLine, profiles={}, draftProfilePic=null, selProfileColor=0;
let postTags={};
let chatView='group'; // 'group' | dmKey
let viewingProfile=null; // name of profile being viewed
let dmUnread={}; // { dmKey: count }
let carouselIdx={}; // { postId: currentSlideIndex } for multi-media posts

/* ══════════════════════════════════════════════════════
   UTILS
   ══════════════════════════════════════════════════════ */
const ls  = (k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?v:d}catch{return d}};
const lss = (k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
const lsj = (k,d=[])=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}};
const lssj= (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

//OS Check
function detectPlatform(){
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

const os = detectPlatform();






function dmKey(a,b){return[a,b].sort().join('|')}
function getC(name){
  if(!nameColors[name]){
    const all=[...new Set(posts.map(p=>p.name))];
    const i=all.indexOf(name);
    nameColors[name]=MC[(i>=0?i:Object.keys(nameColors).length)%MC.length];
  }
  return nameColors[name];
}
function buildAv(name,cls='av'){
  const prof=profiles[name], c=getC(name);
  if(prof?.photo) return `<div class="${cls}" style="background:${c.bg};border-color:${c.br};padding:0"><img src="${prof.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
  const col=prof?.color||c;
  return `<div class="${cls}" style="background:${col.bg};border-color:${col.br};color:${col.tx}">${name[0].toUpperCase()}</div>`;
}
const getOct = id => OCTS.find(o=>o.id===id)||OCTS[0];
const isOwn  = n  => myName && myName.trim().toLowerCase()===n.trim().toLowerCase();
function ago(iso){
  const d=Date.now()-new Date(iso).getTime();
  const m=Math.floor(d/60000),h=Math.floor(d/3600000),dy=Math.floor(d/86400000);
  if(m<1)return'just now';if(m<60)return m+'m';if(h<24)return h+'h';
  if(dy===1)return'yesterday';if(dy<7)return dy+'d ago';
  return new Date(iso).toLocaleDateString([],{month:'short',day:'numeric'});
}
function fullDate(iso){return new Date(iso).toLocaleDateString([],{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' at '+new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function fmtTime(iso){return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function fmtDay(iso){
  const d=new Date(iso),now=new Date();
  if(d.toDateString()===now.toDateString())return'Today';
  const yes=new Date(now);yes.setDate(yes.getDate()-1);
  if(d.toDateString()===yes.toDateString())return'Yesterday';
  return d.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
}
function dataURLtoBlob(u){
  const[h,d]=u.split(','),mime=h.match(/:(.*?);/)[1];
  const b=atob(d),arr=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)arr[i]=b.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
function compress(file,maxW=1200){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const ratio=Math.min(maxW/img.width,maxW/img.height,1);
        const w=Math.round(img.width*ratio),h=Math.round(img.height*ratio);
        const c=document.createElement('canvas');c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        res(c.toDataURL('image/jpeg',.78));
      };img.src=ev.target.result;
    };r.readAsDataURL(file);
  });
}
function rich(text){
  if(!text)return'';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/@(\w+)/g,'<span class="mention">@$1</span>');
}
function totalRxn(r){return Object.values(r||{}).reduce((a,b)=>a+(Array.isArray(b)?b.length:0),0)}
function cmtCount(pid){return(comments[pid]||[]).filter(c=>!c._ph).length}
function cmtCountRaw(pid){return(comments[pid]||[]).length}

let toastTimer=null;
function toast(msg,dur=2400,type='default'){
  const el=document.getElementById('toast');if(!el)return;
  el.textContent=msg;el.className='toast show'+(type!=='default'?' toast-'+type:'');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',dur);
}
function vibrate(ms=20){if(navigator.vibrate)navigator.vibrate(ms)}

/* Sounds — generated via Web Audio API (no external files needed) */
function playSound(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    if(type==='send'){osc.frequency.value=880;gain.gain.setValueAtTime(.15,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);osc.start();osc.stop(ctx.currentTime+.08);}
    else if(type==='receive'){osc.frequency.value=660;gain.gain.setValueAtTime(.1,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);osc.start();osc.stop(ctx.currentTime+.12);}
    else if(type==='reaction'){osc.type='sine';osc.frequency.value=1047;gain.gain.setValueAtTime(.08,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.05);osc.start();osc.stop(ctx.currentTime+.05);}
    else if(type==='ring'){
      // repeating ring
      osc.type='sine';osc.frequency.value=440;
      gain.gain.setValueAtTime(.2,ctx.currentTime);
      gain.gain.setValueAtTime(0,ctx.currentTime+.2);
      gain.gain.setValueAtTime(.2,ctx.currentTime+.4);
      gain.gain.setValueAtTime(0,ctx.currentTime+.6);
      osc.start();osc.stop(ctx.currentTime+.8);
    }
    else if(type==='call_end'){osc.frequency.value=300;gain.gain.setValueAtTime(.15,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.3);osc.start();osc.stop(ctx.currentTime+.3);}
  }catch{}
}

/* ══════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════ */
function applyTheme(id){
  document.documentElement.setAttribute('data-theme',id==='default'?'':id);
  lss('ayl_theme',id);
  const t=THEMES.find(t=>t.id===id);
  if(t)document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t.bg);
}
function applyFS(size){
  const s={sm:'13px',md:'15px',lg:'17px'};
  document.documentElement.style.setProperty('--fs',s[size]||'15px');
  lss('ayl_fs',size);
}
function applyCustomColors(pri,pri2){
  document.documentElement.style.setProperty('--custom-pri',pri);
  document.documentElement.style.setProperty('--custom-pri2',pri2);
  // derive light and dark
  document.documentElement.style.setProperty('--custom-pri-light',pri+'22');
  document.documentElement.style.setProperty('--custom-pri-dark',pri);
  document.documentElement.setAttribute('data-theme','custom');
  lss('ayl_theme','custom');
  lss('ayl_custom_pri',pri);
  lss('ayl_custom_pri2',pri2);
}
function initTheme(){
  applyTheme(ls('ayl_theme','default'));
  applyFS(ls('ayl_fs','md'));
  if(ls('ayl_theme')==='custom'){
    applyCustomColors(ls('ayl_custom_pri','#C4622D'),ls('ayl_custom_pri2','#E8A87C'));
  }
}

/* ══════════════════════════════════════════════════════
   OFFLINE
   ══════════════════════════════════════════════════════ */
window.addEventListener('online', ()=>{isOnline=true;render()});
window.addEventListener('offline',()=>{isOnline=false;render()});
function requireOnline(action){
  if(!isOnline){toast('📡 No internet — connect to WiFi or mobile data first');return false}
  return true;
}

/* ══════════════════════════════════════════════════════
   PHOTO CACHE
   ══════════════════════════════════════════════════════ */
const PHOTO_CACHE='ayl-photos-v1';
async function cachePhoto(url){if(!url||!('caches'in window))return;try{const c=await caches.open(PHOTO_CACHE);if(!(await c.match(url)))await c.add(url)}catch{}}
function imgLoaded(postId){
  document.getElementById('iblur-'+postId)?.classList.add('hidden');
  document.querySelector('#post-'+postId+' .post-img')?.classList.add('loaded');
  const p=posts.find(p=>p.id===postId);
  if(p?.photo_url)cachePhoto(p.photo_url);
}
