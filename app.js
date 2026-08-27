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
let titleLang='en'; // 'en' | 'ar' — which header title label is showing
let hdrCollapsed={title:false,search:false,profile:false,theme:false}; // scrolled-state pill collapse
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

//Checks if user is iOS or Android.
const getMobileOS = () => {
  // 1. Check modern secure browser data if available
  if (navigator.userAgentData?.platform) {
    const platform = navigator.userAgentData.platform.toLowerCase();
    if (platform.includes('android')) return 'Android';
    if (platform.includes('ios')) return 'iOS';
  }

  // 2. Safe, standard fallback string check
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('android')) {
    return 'Android';
  }
  
  // Catches iPhones, iPods, and modern iPads
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || 
     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'iOS';
  }

  return 'Android';
};

// How to use it:
const os = getMobileOS();

if (os === 'Android') {
  console.log("user: android");
} else if (os === 'iOS') {
  console.log("user: iOS");
} else {
  console.log("critical error, user is not android, iOS");
}


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

/* ══════════════════════════════════════════════════════
   DATA — POSTS
   ══════════════════════════════════════════════════════ */
async function loadPosts(){
  if(!USE_SB){posts=lsj('ayl_posts',[]);return}
  const{data,error}=await sb.from('posts').select('*').order('created_at',{ascending:false}).limit(120);
  if(!error)posts=data||[];
}
/* media: array of {type:'photo'|'video', url}. Kept alongside photo_url/
   video_url (set to the FIRST media item) so anything reading the old
   single-value columns — AI tagging, old cached posts, etc — still works
   unchanged. New multi-item posts populate both. */
async function addPost(name,caption,media,oct){
  const first=media[0]||{};
  const p={
    id:Date.now()+'',name,caption,
    photo_url:first.type==='photo'?first.url:null,
    video_url:first.type==='video'?first.url:null,
    media,
    oct,created_at:new Date().toISOString(),reactions:{}
  };
  if(!USE_SB){posts.unshift(p);lssj('ayl_posts',posts);return}
  const{data}=await sb.from('posts').insert({
    name,caption,
    photo_url:first.type==='photo'?first.url:null,
    video_url:first.type==='video'?first.url:null,
    media,
    oct,reactions:{}
  }).select().single();
  if(data)posts.unshift(data);
}
async function updateRxn(pid,rxn){
  if(!USE_SB){const p=posts.find(p=>p.id===pid);if(p)p.reactions=rxn;lssj('ayl_posts',posts);return}
  await sb.from('posts').update({reactions:rxn}).eq('id',pid);
}
async function deletePost(id){
  if(!USE_SB){posts=posts.filter(p=>p.id!==id);lssj('ayl_posts',posts);render();return}
  await sb.from('posts').delete().eq('id',id);
}

/* ══════════════════════════════════════════════════════
   DATA — MESSAGES (group + DM)
   ══════════════════════════════════════════════════════ */
async function loadMessages(){
  if(!USE_SB){messages.group=lsj('ayl_msgs',[]);return}
  const{data,error}=await sb.from('messages').select('*').is('dm_key',null).order('created_at',{ascending:true}).limit(200);
  if(!error)messages.group=data||[];
}
async function loadDMs(key){
  if(!USE_SB){dmMessages[key]=lsj('ayl_dm_'+key,[]);return}
  const{data,error}=await sb.from('messages').select('*').eq('dm_key',key).order('created_at',{ascending:true}).limit(200);
  if(!error)dmMessages[key]=data||[];
}
async function sendMsg(text,key=null){
  const id=Date.now()+'';
  const msg={id,name:myName,text,dm_key:key||null,created_at:new Date().toISOString()};
  if(!key){
    if(!messages.group)messages.group=[];
    messages.group.push(msg);
  } else {
    if(!dmMessages[key])dmMessages[key]=[];
    dmMessages[key].push(msg);
  }
  if(!USE_SB){
    if(!key)lssj('ayl_msgs',messages.group);
    else lssj('ayl_dm_'+key,dmMessages[key]);
    if(chatView==='group'||chatView===key){repaintChat();scrollChat();}
    return;
  }
  await sb.from('messages').insert({name:myName,text,dm_key:key||null});
}
async function delMsg(id,key=null){
  if(!confirm('Delete?'))return;
  if(!key){messages.group=(messages.group||[]).filter(m=>m.id!==id);}
  else{dmMessages[key]=(dmMessages[key]||[]).filter(m=>m.id!==id);}
  if(!USE_SB){
    if(!key)lssj('ayl_msgs',messages.group);
    else lssj('ayl_dm_'+key,dmMessages[key]);
    repaintChat();return;
  }
  await sb.from('messages').delete().eq('id',id);
  if(!key)await loadMessages();else await loadDMs(key);
  repaintChat();
}

/* ══════════════════════════════════════════════════════
   DATA — COMMENTS
   ══════════════════════════════════════════════════════ */
async function loadAllCmtCounts(){
  if(!USE_SB)return;
  const{data,error}=await sb.from('comments').select('post_id,id');
  if(error||!data)return;
  const counts={};
  data.forEach(r=>{counts[r.post_id]=(counts[r.post_id]||0)+1});
  Object.entries(counts).forEach(([pid,cnt])=>{
    if(!comments[pid]||comments[pid].every(c=>c._ph)){
      comments[pid]=Array(cnt).fill(null).map((_,i)=>({
        id:`ph-${pid}-${i}`,post_id:pid,parent_id:null,name:'',text:'',
        reactions:{},created_at:new Date().toISOString(),_ph:true
      }));
    }
  });
  // Clear placeholders for posts with 0 comments
  posts.forEach(p=>{
    if(!counts[p.id]&&(!comments[p.id]||comments[p.id].every(c=>c._ph)))comments[p.id]=[];
  });
}
async function loadComments(pid){
  if(!USE_SB){comments[pid]=[];return}
  const{data,error}=await sb.from('comments').select('*').eq('post_id',pid).order('created_at',{ascending:true});
  if(!error)comments[pid]=(data||[]);
}
async function addComment(pid,parentId,text,photoURL){
  const c={id:Date.now()+'c',post_id:pid,parent_id:parentId||null,name:myName,text,photo_url:photoURL||null,reactions:{},created_at:new Date().toISOString()};
  if(!comments[pid])comments[pid]=[];
  comments[pid]=comments[pid].filter(c=>!c._ph);
  comments[pid].push(c);
  if(!USE_SB){lssj('ayl_comments_'+pid,comments[pid]);return}
  await sb.from('comments').insert({post_id:pid,parent_id:parentId||null,name:myName,text,photo_url:photoURL||null,reactions:{}});
}
async function updateCmtRxn(pid,cid,rxn){
  if(!USE_SB){const c=(comments[pid]||[]).find(c=>c.id===cid);if(c)c.reactions=rxn;return}
  await sb.from('comments').update({reactions:rxn}).eq('id',cid);
}
async function delComment(pid,cid){
  comments[pid]=(comments[pid]||[]).filter(c=>c.id!==cid&&c.parent_id!==cid);
  repaintCmts(pid);
  if(!USE_SB){lssj('ayl_comments_'+pid,comments[pid]);return}
  await sb.from('comments').delete().eq('id',cid);
}

/* ══════════════════════════════════════════════════════
   DATA — UPLOAD
   ══════════════════════════════════════════════════════ */
async function uploadPhoto(dataURL){
  if(!CLD_CLOUD)return dataURL;
  try{
    const fd=new FormData();fd.append('file',dataURLtoBlob(dataURL));fd.append('upload_preset',CLD_PRESET);
    const r=await fetch(`https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`,{method:'POST',body:fd});
    const d=await r.json();
    if(d.error){console.log('Photo upload error:',d.error);toast('❌ Photo upload failed: '+d.error.message);return null;}
    return d.secure_url||null;
  }catch(e){console.log('Photo upload error:',e);toast('❌ Photo upload failed — check your connection');return null;}
}
async function uploadVideo(file){
  try{
    const fd=new FormData();
    fd.append('file',file);
    fd.append('upload_preset',CLD_VID_PRESET);
    fd.append('resource_type','video');
    const r=await fetch(`https://api.cloudinary.com/v1_1/${CLD_VID_CLOUD}/video/upload`,{method:'POST',body:fd});
    const d=await r.json();
    if(d.error)throw new Error(d.error.message);
    return d.secure_url||null;
  }catch(e){console.log('Video upload error:',e);toast('❌ Video upload failed: '+e.message);return null;}
}

/* ══════════════════════════════════════════════════════
   DATA — SEEN BY
   ══════════════════════════════════════════════════════ */
function loadSeenBy(){seenBy=lsj('ayl_seen_by',{});}
async function loadSeenByFromDB(){
  seenBy=lsj('ayl_seen_by',{});
  if(!USE_SB)return;
  const ids=posts.slice(0,20).map(p=>p.id);if(!ids.length)return;
  const{data}=await sb.from('post_views').select('post_id,viewer').in('post_id',ids).catch(()=>({data:null}));
  if(!data)return;
  data.forEach(r=>{if(!seenBy[r.post_id])seenBy[r.post_id]=[];if(!seenBy[r.post_id].includes(r.viewer))seenBy[r.post_id].push(r.viewer)});
  lssj('ayl_seen_by',seenBy);
}
async function markSeenBy(){
  if(!myName||!posts.length)return;
  posts.slice(0,8).forEach(p=>{if(!seenBy[p.id])seenBy[p.id]=[];if(!seenBy[p.id].includes(myName))seenBy[p.id].push(myName)});
  lssj('ayl_seen_by',seenBy);
  if(!USE_SB)return;
  const rows=posts.slice(0,8).map(p=>({post_id:p.id,viewer:myName}));
  await sb.from('post_views').upsert(rows,{onConflict:'post_id,viewer',ignoreDuplicates:true}).catch(()=>{});
}

/* ══════════════════════════════════════════════════════
   PROFILES
   ══════════════════════════════════════════════════════ */
function loadProfiles(){profiles=lsj('ayl_profiles',{});}
function saveProfiles(){lssj('ayl_profiles',profiles);}
function getMyProfile(){return profiles[myName]||{}}

/* ══════════════════════════════════════════════════════
   AI PHOTO TAGGING
   ══════════════════════════════════════════════════════ */
function buildAiTags(postId){
  const tags=postTags[postId];
  if(tags===undefined)return'';
  if(tags===null)return`<div class="ai-tagging"><div class="img-spinner" style="width:12px;height:12px;border-width:1.5px"></div> Analysing photo…</div>`;
  if(!tags.length)return'';
  return`<div class="ai-tags">${tags.map(t=>`<button class="ai-tag" onclick="onSearch('${t}')">🏷 ${t}</button>`).join('')}</div>`;
}
function repaintAiTags(postId){
  const card=document.getElementById('post-'+postId);if(!card)return;
  const existing=card.querySelector('.ai-tags,.ai-tagging');
  const imgWrap=card.querySelector('.post-img-wrap,.post-carousel');if(!imgWrap)return;
  const html=buildAiTags(postId);
  if(existing)existing.outerHTML=html;
  else if(html)imgWrap.insertAdjacentHTML('afterend',html);
}
async function tagPhotoWithAI(postId,imageDataURL){
  if(!imageDataURL||!ANTHROPIC_KEY)return;
  postTags[postId]=null;repaintAiTags(postId);
  try{
    const base64=imageDataURL.split(',')[1];
    const mime=(imageDataURL.match(/data:(.*?);/)||[])[1]||'image/jpeg';
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-haiku-4-5',max_tokens:100,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:mime,data:base64}},
        {type:'text',text:'List 4-6 short descriptive tags for this photo. Think: location, activity, mood, people, time of day. Reply ONLY with comma-separated lowercase tags. Example: beach,sunset,family,outdoor,summer'}
      ]}]})
    });
    const d=await res.json();
    const tags=(d.content?.[0]?.text||'').split(',').map(t=>t.trim().toLowerCase()).filter(t=>t.length>1&&t.length<25).slice(0,6);
    postTags[postId]=tags;
    if(USE_SB&&tags.length)await sb.from('posts').update({ai_tags:tags}).eq('id',postId).catch(()=>{});
  }catch{postTags[postId]=[]}
  repaintAiTags(postId);
}

/* ══════════════════════════════════════════════════════
   REALTIME
   ══════════════════════════════════════════════════════ */
let realtimeChannels={posts:null,msgs:null,cmts:null};
let realtimeResubTimers={posts:null,msgs:null,cmts:null};

function subscribeRealtime(){
  if(!USE_SB)return;
  subscribePostsChannel();
  subscribeMsgsChannel();
  subscribeCmtsChannel();
}
/* Each channel below is rebuilt with a fresh name on every (re)subscribe
   and watches its own connection status. If Supabase's Realtime socket
   drops — which happens routinely on mobile from screen lock, backgrounding,
   or switching between WiFi/cellular — the channel silently goes dead and
   nothing updates again until the whole app restarts. This retries the
   specific channel automatically instead, so live updates keep working
   without requiring a manual reload. */
function subscribePostsChannel(){
  if(realtimeChannels.posts){try{sb.removeChannel(realtimeChannels.posts)}catch{}}
  realtimeChannels.posts=sb.channel('posts-'+Date.now()).on('postgres_changes',
    {event:'*',schema:'public',table:'posts'},async()=>{
      await loadPosts();nameColors={};if(view==='feed')showNewBanner();
    }
  ).subscribe(status=>{
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
      clearTimeout(realtimeResubTimers.posts);
      realtimeResubTimers.posts=setTimeout(subscribePostsChannel,1500);
    }
  });
}
function subscribeMsgsChannel(){
  if(realtimeChannels.msgs){try{sb.removeChannel(realtimeChannels.msgs)}catch{}}
  realtimeChannels.msgs=sb.channel('msgs-'+Date.now()).on('postgres_changes',
    {event:'*',schema:'public',table:'messages'},async(payload)=>{
      const rec=payload.new;if(!rec)return;
      const key=rec.dm_key;
      if(!key){
        await loadMessages();
        if(view==='chat'&&chatView==='group'){repaintChat();scrollChat();}
        else if(!isOwn(rec.name)){unreadMsgs++;repaintNav();}
      } else {
        await loadDMs(key);
        if(view==='chat'&&chatView===key){repaintChat();scrollChat();}
        else if(!isOwn(rec.name)){dmUnread[key]=(dmUnread[key]||0)+1;repaintNav();}
      }
      if(!isOwn(rec.name))playSound('receive');
    }
  ).subscribe(status=>{
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
      clearTimeout(realtimeResubTimers.msgs);
      realtimeResubTimers.msgs=setTimeout(subscribeMsgsChannel,1500);
    }
  });
}
function subscribeCmtsChannel(){
  if(realtimeChannels.cmts){try{sb.removeChannel(realtimeChannels.cmts)}catch{}}
  realtimeChannels.cmts=sb.channel('cmts-'+Date.now()).on('postgres_changes',
    {event:'*',schema:'public',table:'comments'},async(payload)=>{
      const pid=payload.new?.post_id||payload.old?.post_id;
      if(pid){
        await loadComments(pid);repaintCmts(pid);repaintCmtBadge(pid);
        if(!openComments[pid]&&payload.eventType==='INSERT'&&!isOwn(payload.new?.name||'')){
          newCmtPosts[pid]=true;repaintCmtBadge(pid);
        }
      }
    }
  ).subscribe(status=>{
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
      clearTimeout(realtimeResubTimers.cmts);
      realtimeResubTimers.cmts=setTimeout(subscribeCmtsChannel,1500);
    }
  });
}
/* Also resubscribe everything whenever the tab/app becomes visible again —
   covers the common mobile case where the socket dies while backgrounded
   and the status callback itself doesn't fire until something touches it.

   Supabase's realtime-js has a known limitation where the auth token used
   by the WebSocket doesn't reliably refresh after the tab/app has been in
   standby (github.com/supabase/supabase-js#1732) — meaning a plain
   resubscribe can silently keep using a stale token and never actually
   reconnect. To not depend on that working perfectly, this also directly
   re-fetches posts/messages/comments-for-open-posts on every return to the
   app, so content is correct even if the socket itself stays broken. */
async function refreshAllDataOnResume(){
  if(!USE_SB)return;
  await loadPosts();
  nameColors={};
  if(view==='feed'){const main=document.querySelector('.main');if(main)main.innerHTML=buildFeed();}
  if(chatView==='group')await loadMessages();
  else if(chatView!=='dms')await loadDMs(dmKey(myName,chatView));
  if(view==='chat')repaintChat();
  for(const pid of Object.keys(openComments)){
    if(openComments[pid]){await loadComments(pid);repaintCmts(pid);}
  }
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&USE_SB&&myName){
    subscribeRealtime();
    if(callChannel)subscribeCallSignaling();
    refreshAllDataOnResume();
  }
});


/* ══════════════════════════════════════════════════════
   PUSH NOTIFICATIONS
   ══════════════════════════════════════════════════════ */
function b64ToUint8(b){
  const p='='.repeat((4-b.length%4)%4);
  const s=(b+p).replace(/-/g,'+').replace(/_/g,'/');
  const r=atob(s);const o=new Uint8Array(r.length);
  for(let i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o;
}
async function initNotifs(){
  if(!('Notification'in window)||!('serviceWorker'in navigator))return;
  const p=await Notification.requestPermission();if(p!=='granted')return;
  try{
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(VAPID)});
    if(USE_SB&&sub){
      const j=sub.toJSON();
      await sb.from('push_subscriptions').upsert({endpoint:j.endpoint,auth:j.keys.auth,p256dh:j.keys.p256dh,name:myName},{onConflict:'endpoint'});
    }
  }catch(e){console.log('Push:',e)}
}

/* ══════════════════════════════════════════════════════
   BIRTHDAY CHECK
   ══════════════════════════════════════════════════════ */
function checkBirthdays(){
  const today=new Date();
  posts.filter(p=>p.oct==='birthday').forEach(p=>{
    const d=new Date(p.created_at);
    if(d.getMonth()===today.getMonth()&&d.getDate()===today.getDate()){
      const key='bday_'+p.id+'_'+today.getFullYear();
      if(!ls(key)){setTimeout(()=>toast(`🎂 Today is a birthday! See ${p.name}s post`,4000),2000);lss(key,'1');}
    }
  });
  // Profile birthdays
  Object.entries(profiles).forEach(([name,prof])=>{
    if(!prof.birthday)return;
    const bd=new Date(prof.birthday);
    if(bd.getMonth()===today.getMonth()&&bd.getDate()===today.getDate()){
      const key='pbday_'+name+'_'+today.getFullYear();
      if(!ls(key)){setTimeout(()=>toast(`🎂 Today is ${name}s birthday!`,5000),3000);lss(key,'1');}
    }
  });
}





/* ══════════════════════════════════════════════════════
   CALLS — PeerJS (clean single-state-machine rewrite)
   State: callState is the ONE source of truth.
     'idle'      — no call
     'outgoing'  — we called, waiting for answer
     'incoming'  — someone is calling us
     'active'    — connected
   ══════════════════════════════════════════════════════ */
let peer=null, myPeerId=null, peerReady=false, peerRetries=0;
let callState='idle';
let currentCall=null;      // the PeerJS MediaConnection
let pendingIncoming=null;  // incoming call awaiting accept
let localStream=null, remoteAudioEl=null;
let callTarget=null, isVideoOn=false, isMuted=false;
let ringTimer=null, noAnswerTimer=null;

function peerIdFor(name){return 'aylitna-'+name.trim().toLowerCase().replace(/[^a-z0-9]/g,'-');}

/* ---- Peer setup ---- */
async function initPeer(){
  if(!myName)return;
  if(peer){try{peer.destroy()}catch{}peer=null;}
  peerReady=false; peerRetries=0;
  const iceServers=await getTurnServers();
  peer=new Peer(peerIdFor(myName),{debug:0,config:{iceServers}});
  peer.on('open',()=>{peerReady=true;});
  peer.on('error',err=>{
    if(err.type==='unavailable-id'){ if(peerRetries<5){peerRetries++;setTimeout(initPeer,2000);} }
    else if(err.type==='peer-unavailable'){ toast('📵 '+(callTarget||'They')+' is offline'); resetCall(); }
    else if(['network','server-error','disconnected'].includes(err.type)){ peerReady=false; setTimeout(()=>{try{peer.reconnect()}catch{setTimeout(initPeer,2000)}},1000); }
  });
  peer.on('call',handleIncoming);
  peer.on('connection',conn=>conn.on('data',handleControl));
  peer.on('disconnected',()=>{peerReady=false;try{peer.reconnect()}catch{}});
}

/* ---- Control messages (decline / busy / hangup) via data channel ---- */
function handleControl(msg){
  if(msg==='decline'){toast((callTarget||'They')+' declined');resetCall();}
  else if(msg==='busy'){toast((callTarget||'They')+' is busy');resetCall();}
  else if(msg==='hangup'){toast('Call ended');resetCall();}
}
function sendControl(name,msg){
  if(!peer||!peerReady)return;
  try{const c=peer.connect(peerIdFor(name));c.on('open',()=>{c.send(msg);setTimeout(()=>{try{c.close()}catch{}},400);});}catch{}
}

/* ---- Media capture: ALWAYS audio+video, disable video track for voice calls
        so both peers have matching track counts (PeerJS #1035 fix). ---- */
async function getMedia(withVideo){
  let s;
  try{
    s=await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
      video:{facingMode:'user'}
    });
    if(!withVideo)s.getVideoTracks().forEach(t=>t.enabled=false);
    return s;
  }catch(e){
    // no camera → audio only
    try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
    catch(e2){
      if(e2.name==='NotAllowedError'||e2.name==='PermissionDeniedError')showMicGuide();
      else toast('❌ Microphone unavailable');
      return null;
    }
  }
}

/* ---- Start an outgoing call ---- */
async function startCall(targetName,withVideo=false){
  if(!requireOnline())return;
  if(callState!=='idle'){toast('You are already in a call');return;}
  if(!peer||!peerReady){toast('⏳ Connecting… try again in a moment');initPeer();return;}

  callState='outgoing';
  callTarget=targetName;
  isVideoOn=withVideo;

  const stream=await getMedia(withVideo);
  if(!stream){resetCall();return;}
  localStream=stream;

  showCallScreen('outgoing');
  startRing();

  attachLocalVideo();

  const call=peer.call(peerIdFor(targetName),localStream,{metadata:{name:myName,video:withVideo}});
  if(!call){toast('❌ Call failed');resetCall();return;}
  currentCall=call;
  wireStream(call);

  noAnswerTimer=setTimeout(()=>{
    if(callState==='outgoing'){toast(targetName+' did not answer');hangup();}
  },30000);
}

/* ---- Handle an incoming call ---- */
function handleIncoming(call){
  // Isolation: reject if we're not idle
  if(callState!=='idle'){
    call.close();
    if(call.metadata?.name)sendControl(call.metadata.name,'busy');
    return;
  }
  callState='incoming';
  pendingIncoming=call;
  callTarget=call.metadata?.name||'Someone';
  isVideoOn=!!call.metadata?.video;
  showCallScreen('incoming');
  startRing();
  noAnswerTimer=setTimeout(()=>{if(callState==='incoming')declineCall()},45000);
}

/* ---- Accept incoming ---- */
async function acceptCall(){
  if(callState!=='incoming'||!pendingIncoming)return;
  stopRing();clearTimeout(noAnswerTimer);

  const stream=await getMedia(isVideoOn);
  if(!stream){declineCall();return;}
  localStream=stream;

  const call=pendingIncoming;
  pendingIncoming=null;
  currentCall=call;
  callState='active';

  attachLocalVideo();
  wireStream(call);          // attach BEFORE answer so we don't miss the stream
  call.answer(localStream);

  setCallStatus('Connected');
  showActiveControls();
}

/* ---- Decline incoming ---- */
function declineCall(){
  if(callTarget)sendControl(callTarget,'decline');
  resetCall();
}

/* ---- Hang up an active/outgoing call ---- */
function hangup(){
  if(callTarget)sendControl(callTarget,'hangup');
  resetCall();
}

/* ---- Wire the remote stream → audio element ---- */
function wireStream(call){
  call.on('stream',remote=>{
    callState='active';
    // remote audio through a real DOM <audio> element
    if(!remoteAudioEl){
      remoteAudioEl=document.createElement('audio');
      remoteAudioEl.autoplay=true;
      remoteAudioEl.setAttribute('playsinline','');
      document.body.appendChild(remoteAudioEl);
    }
    remoteAudioEl.srcObject=remote;
    remoteAudioEl.muted=false;
    remoteAudioEl.volume=1;
    remoteAudioEl.play().then(()=>setCallStatus('Connected')).catch(()=>{
      setCallStatus('Tap to hear 🔊');
      const unlock=()=>{remoteAudioEl.play().then(()=>setCallStatus('Connected')).catch(()=>{});cleanupUnlock();};
      const cleanupUnlock=()=>{document.removeEventListener('touchend',unlock);document.removeEventListener('click',unlock);};
      document.addEventListener('touchend',unlock);
      document.addEventListener('click',unlock);
    });
    // remote video (muted — audio plays via remoteAudioEl)
    const rv=document.getElementById('remoteVideo');
    if(rv&&remote.getVideoTracks().length){rv.srcObject=remote;rv.muted=true;rv.play?.().catch(()=>{});if(isVideoOn)rv.classList.add('show');}
    stopRing();
    showActiveControls();
  });
  call.on('close',()=>{ if(callState!=='idle'){toast('Call ended');resetCall();} });
  call.on('error',()=>{ toast('Call error');resetCall(); });
}

/* ---- The ONE reset. Clears everything, always returns to idle. ---- */
function resetCall(){
  stopRing();
  clearTimeout(noAnswerTimer);noAnswerTimer=null;
  if(currentCall){try{currentCall.close()}catch{}}
  if(pendingIncoming){try{pendingIncoming.close()}catch{}}
  currentCall=null;pendingIncoming=null;
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  if(remoteAudioEl){try{remoteAudioEl.pause();remoteAudioEl.srcObject=null;remoteAudioEl.remove();}catch{}remoteAudioEl=null;}
  callState='idle';callTarget=null;isVideoOn=false;isMuted=false;
  hideCallScreen();
}

/* ---- Ring helpers ---- */
function startRing(){stopRing();playSound('ring');ringTimer=setInterval(()=>playSound('ring'),3000);}
function stopRing(){clearInterval(ringTimer);ringTimer=null;}

/* ---- Local video attach ---- */
function attachLocalVideo(){
  const lv=document.getElementById('localVideo');
  if(lv&&localStream){lv.srcObject=localStream;lv.muted=true;if(isVideoOn)lv.classList.add('show');else lv.classList.remove('show');}
}

/* ---- In-call controls ---- */
function toggleMute(){
  isMuted=!isMuted;
  localStream?.getAudioTracks().forEach(t=>t.enabled=!isMuted);
  const b=document.getElementById('muteBtn');
  if(b){b.textContent=isMuted?'🔇':'🎙️';b.className='call-btn call-btn-mute'+(isMuted?' active':'');}
}
function toggleSpeaker(){
  if(remoteAudioEl)remoteAudioEl.volume=remoteAudioEl.volume>0.5?0.35:1;
  const b=document.getElementById('speakerBtn');
  if(b)b.className='call-btn call-btn-speaker'+((remoteAudioEl?.volume||1)>0.5?' active':'');
}
function toggleVideo(){
  isVideoOn=!isVideoOn;
  const vids=localStream?.getVideoTracks()||[];
  if(vids.length){vids.forEach(t=>t.enabled=isVideoOn);attachLocalVideo();}
  const b=document.getElementById('videoBtn');
  if(b)b.className='call-btn call-btn-video'+(isVideoOn?' active':'');
}

/* ---- UI ---- */
function showCallScreen(direction){
  const el=document.getElementById('callOverlay');if(!el)return;
  el.style.display='flex';
  el.className='call-overlay show';
  const inner=el.querySelector('.call-inner');
  if(inner)inner.innerHTML=`
    <div class="call-av" id="callAv"></div>
    <div class="call-name" id="callName"></div>
    <div class="call-status" id="callStatus"></div>
    <video class="call-video-remote" id="remoteVideo" autoplay playsinline></video>
    <video class="call-video-local" id="localVideo" autoplay playsinline muted></video>
    <div class="call-controls" id="callControls" style="display:${direction==='outgoing'?'flex':'none'}">
      <button class="call-btn call-btn-end" onclick="hangup()">📵</button>
      <button class="call-btn call-btn-mute" id="muteBtn" onclick="toggleMute()">🎙️</button>
      <button class="call-btn call-btn-speaker active" id="speakerBtn" onclick="toggleSpeaker()">🔊</button>
      <button class="call-btn call-btn-video" id="videoBtn" onclick="toggleVideo()">📷</button>
    </div>
    <div class="call-incoming-btns" id="callIncomingBtns" style="display:${direction==='incoming'?'flex':'none'}">
      <div style="text-align:center"><button class="call-btn call-btn-end" onclick="declineCall()">📵</button><div class="call-incoming-label">Decline</div></div>
      <div style="text-align:center"><button class="call-btn call-btn-accept" onclick="acceptCall()">📞</button><div class="call-incoming-label">Accept</div></div>
    </div>`;
  const name=callTarget||'';
  document.getElementById('callName').textContent=name;
  setCallStatus(direction==='incoming'?name+' is calling…':'Calling…');
  const av=document.getElementById('callAv');
  const prof=profiles[name],c=getC(name)||{bg:'#eee',br:'#ccc',tx:'#333'};
  if(prof?.photo){av.innerHTML=`<img src="${prof.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;}
  else{av.style.background=c.bg;av.style.borderColor=c.br;av.style.color=c.tx;av.textContent=(name[0]||'?').toUpperCase();}
}
function showActiveControls(){
  const c=document.getElementById('callControls'),i=document.getElementById('callIncomingBtns');
  if(c)c.style.display='flex';
  if(i)i.style.display='none';
}
function setCallStatus(t){const el=document.getElementById('callStatus');if(el)el.textContent=t;}
function hideCallScreen(){const el=document.getElementById('callOverlay');if(el){el.style.display='none';el.className='call-overlay';}}

function showMicGuide(){
  const el=document.getElementById('callOverlay');if(!el)return;
  el.style.display='flex';el.className='call-overlay show';
  const inner=el.querySelector('.call-inner');if(!inner)return;
  const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent),isAndroid=/Android/.test(navigator.userAgent);
  inner.innerHTML=`<div style="font-size:50px;margin-bottom:16px">🎙️</div>
    <div style="font-family:var(--font-d);font-size:22px;font-weight:700;color:#fff;margin-bottom:12px">Microphone blocked</div>
    <div style="color:rgba(255,255,255,.7);font-size:14px;text-align:center;line-height:1.7;max-width:280px;margin-bottom:28px">
      ${isIOS?'Go to <strong style="color:#fff">Settings → Safari → Microphone</strong> → Allow.':isAndroid?'Tap the <strong style="color:#fff">🔒 icon</strong> in the address bar → Permissions → Microphone → Allow.':'Click the <strong style="color:#fff">🔒 lock</strong> → Site settings → Microphone → Allow.'}
    </div>
    <button onclick="hideCallScreen()" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:700;font-family:var(--font-b)">Close</button>`;
}

/* Aliases for any legacy onclick handlers in static HTML */
function endCall(){hangup();}
function rejectCall(){declineCall();}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */
async function init(){
  initTheme();
  myName=ls('ayl_name','');
  lastSeen=+(ls('ayl_seen',0));
  lastMsgSeen=+(ls('ayl_msgseen',0));
  pinnedPostId=ls('ayl_pinned',null);
  lss('ayl_seen',Date.now());
  loadSeenBy();loadProfiles();
  if(!messages.group)messages.group=[];
  loadingFeed=true;render();
  await Promise.all([loadPosts(),loadMessages()]);
  loadingFeed=false;
  render(); // Render immediately with posts
  loadAllCmtCounts().then(()=>{
    // Update all comment badges without full re-render
    document.querySelectorAll('[id^="cb-"]').forEach(el=>{
      const pid=el.id.replace('cb-','');
      el.textContent=cmtCountRaw(pid);
    });
    loadSeenByFromDB().then(()=>markSeenBy());
  });
  if(USE_SB){
    const{data}=await sb.from('posts').select('id,ai_tags').not('ai_tags','is',null).catch(()=>({data:null}));
    if(data)data.forEach(p=>{if(p.ai_tags?.length)postTags[p.id]=p.ai_tags});
  }
  subscribeRealtime();
  if(myName){initNotifs();initPeer();}
  checkBirthdays();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* ══════════════════════════════════════════════════════
   MAIN RENDER
   ══════════════════════════════════════════════════════ */
function render(){
  const app=document.getElementById('app');
  if(!myName){renderOnboarding(app);return}
  const newPosts=posts.filter(p=>new Date(p.created_at).getTime()>lastSeen).length;
  const th=ls('ayl_theme','default'),fs=ls('ayl_fs','md');
  const offline=!isOnline?`<div class="offline-banner"><span>📡</span> No internet — some features may not work</div>`:'';
  const greet=view==='feed'?buildGreeting():'';
  const pills=view==='feed'?buildPills():'';
  const rem=view==='feed'&&!reminderDismissed?buildReminder():'';
  const search=buildSearchBar();
  let body='';
  if(view==='feed')body=buildFeed();
  else if(view==='add')body=buildAdd();
  else if(view==='chat')body=buildChatScreen();
  else if(view==='stats')body=buildStats();
  else if(view==='members')body=buildMembers();
  else if(view==='profile')body=buildProfilePage();
  else if(view==='profile-edit')body=buildProfileEdit();
  else if(view==='view-profile')body=buildViewProfile(viewingProfile);
  app.innerHTML=buildHeader(newPosts)+offline+search+greet+rem+pills+
    `<div class="main">${body}</div>`+
    buildNav()+buildFullscreen()+buildThemeSheet(th,fs);
  if(view==='chat'){setupChatInput();scrollChat()}
  if(view==='feed'){setupFeedListeners();setTimeout(prefetchVisibleVideos,1500);}
  setupSheet();
  setupHeaderScroll();
}

/* Toggles .hdr.scrolled when the scrollable .main area has scrolled past a
   small threshold. Re-attached every render() since .main is a fresh
   element each time (see innerHTML above). Style .hdr.scrolled in app.css —
   see the placeholder rule there. */
function setupHeaderScroll(){
  const main=document.querySelector('.main');
  const hdr=document.querySelector('.hdr');
  if(!main||!hdr)return;
  const onScroll=()=>{
    hdr.classList.toggle('scrolled', main.scrollTop>8);
  };
  main.addEventListener('scroll', onScroll, {passive:true});
  onScroll(); // set initial state in case render() happened mid-scroll
}

/* ══════════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════════ */
function buildHeader(newPosts){
  const prof=profiles[myName];
  const profImg=prof?.photo
    ?`<img src="${prof.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    :`👤`;
  return`<div class="hdr">
    <div class="hdr-row">
      <div class="brand-static">
        <div><div class="brand-arabic">عيلتنا <span class="${USE_SB?'brand-dot':'brand-dot off'}"></span></div><div class="brand-eng">Our Family</div></div>
      </div>
      <div class="hdr-right">
        ${newPosts>0&&view==='feed'?`<div class="new-badge">${newPosts} new ✨</div>`:''}
        <button class="icon-btn" onclick="toggleSearch()">🔍</button>
        <button class="icon-btn" onclick="goView('profile')" style="padding:0;overflow:hidden">${profImg}</button>
        <button class="icon-btn" onclick="openThemeSheet()">🎨</button>
      </div>
    </div>
        <div class="hdr-scrolled-row">
      ${buildGlassPill('title')}
    </div>
  </div>`;
}
/* Builds one collapsible glass pill for the scrolled header state.
   Collapsed = just the arrow tab showing; tap the arrow to expand/collapse.
   The pill's own tap (title/search/profile/theme action) is separate from
   the arrow's tap — arrow only toggles collapse, doesn't fire the action. */
function buildGlassPill(kind,profImg){
  const collapsed=hdrCollapsed[kind];
  let inner='',action='';
  if(kind==='title'){
    inner=titleLang==='en'?`<span class="brand-eng-pill">Our Family</span>`:`<span class="brand-arabic-pill">عيلتنا</span>`;
    inner+=`<span class="${USE_SB?'brand-dot':'brand-dot off'}"></span>`;
    action=`toggleTitleLang()`;
  } else if(kind==='search'){
    inner=`🔍`;action=`toggleSearch()`;
  } else if(kind==='profile'){
    inner=profImg||'👤';action=`goView('profile')`;
  } else if(kind==='theme'){
    inner=`🎨`;action=`openThemeSheet()`;
  }
  return`<div class="glass-pill-wrap ${kind}${collapsed?' collapsed':''}" id="ghp-${kind}">
    <button class="glass-pill" onclick="${action}">${inner}</button>
    <button class="glass-arrow" onclick="event.stopPropagation();toggleHdrCollapse('${kind}')" aria-label="Toggle">${collapsed?'›':'‹'}</button>
  </div>`;
}
function toggleHdrCollapse(kind){
  hdrCollapsed[kind]=!hdrCollapsed[kind];
  const wrap=document.getElementById('ghp-'+kind);
  if(wrap)wrap.classList.toggle('collapsed',hdrCollapsed[kind]);
}
function toggleTitleLang(){
  titleLang=titleLang==='en'?'ar':'en';
  const pill=document.querySelector('#ghp-title .glass-pill');
  if(pill){
    pill.innerHTML=(titleLang==='en'
      ?`<span class="brand-eng-pill">Our Family</span>`
      :`<span class="brand-arabic-pill">عيلتنا</span>`)
      +`<span class="${USE_SB?'brand-dot':'brand-dot off'}"></span>`;
  }
}

/* ══════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════ */
function buildSearchBar(){
  return`<div class="search-bar${showSearch?' show':''}" id="searchBar">
    <div class="search-inner">
      <span style="font-size:16px;opacity:.4">🔍</span>
      <input id="searchIn" placeholder="Search posts, names, tags…" value="${searchQ}" oninput="onSearch(this.value)" autocomplete="off">
      ${searchQ?`<button class="search-clear" onclick="clearSearch()">✕</button>`:''}
    </div>
    ${searchQ?`<div class="search-tag-row scrollx">${OCTS.filter(o=>posts.some(p=>p.oct===o.id)).map(o=>`<button class="search-tag" onclick="onSearch('${o.l}')">${o.e} ${o.l}</button>`).join('')}</div>`:''}
  </div>`;
}
function toggleSearch(){showSearch=!showSearch;if(!showSearch)searchQ='';render();if(showSearch)setTimeout(()=>document.getElementById('searchIn')?.focus(),100)}
function onSearch(v){searchQ=v;const main=document.querySelector('.main');if(main)main.innerHTML=buildFeed()}
function clearSearch(){searchQ='';render()}

/* ══════════════════════════════════════════════════════
   GREETING
   ══════════════════════════════════════════════════════ */
function buildGreeting(){
  if(greetingDismissed)return'';
  const key='ayl_greet_'+new Date().toDateString();
  if(ls(key))return'';
  const h=new Date().getHours();
  let emoji,title,sub;
  if(h>=5&&h<12){emoji='🌅';title=`Good morning, ${myName}!`;sub='Hope you have a wonderful day ☀️'}
  else if(h>=12&&h<17){emoji='☀️';title=`Good afternoon, ${myName}!`;sub='What is happening in the family today?'}
  else if(h>=17&&h<21){emoji='🌆';title=`Good evening, ${myName}!`;sub='Share a moment from your day 📸'}
  else{emoji='🌙';title=`Good night, ${myName}!`;sub='Rest well — family loves you ❤️'}
  const recent=posts.filter(p=>!isOwn(p.name)&&(Date.now()-new Date(p.created_at).getTime())<10800000);
  if(recent.length)sub=`${recent[0].name} just shared something — check it out! 👇`;
  setTimeout(()=>dismissGreeting(),5000);
  return`<div class="greeting-bar" id="greetingBar">
    <div class="greeting-emoji">${emoji}</div>
    <div class="greeting-txt"><div class="greeting-title">${title}</div><div class="greeting-sub">${sub}</div></div>
  </div>`;
}
function dismissGreeting(){
  greetingDismissed=true;lss('ayl_greet_'+new Date().toDateString(),'1');
  const el=document.getElementById('greetingBar');
  if(el){el.classList.add('fade-out');setTimeout(()=>el.remove(),650);}
}

/* ══════════════════════════════════════════════════════
   REMINDER
   ══════════════════════════════════════════════════════ */
function buildReminder(){
  const mine=posts.filter(p=>p.name===myName);
  let msg='';
  if(!mine.length)msg="You haven't shared anything yet — be the first! 📸";
  else{const days=(Date.now()-new Date(mine[0].created_at).getTime())/86400000;if(days>2)msg=`You haven't posted in ${Math.floor(days)} days — share a moment! 📸`;}
  if(!msg)return'';
  return`<div class="reminder"><span style="font-size:20px">📸</span>
    <div class="reminder-txt">${msg}</div>
    <button class="reminder-share" onclick="goView('add')">Share now</button>
    <button class="reminder-close" onclick="reminderDismissed=true;render()">✕</button>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   PILLS
   ══════════════════════════════════════════════════════ */
function buildPills(){
  const names=[...new Set(posts.map(p=>p.name))];
  if(names.length<2)return'';
  return`<div class="pills-wrap"><div class="pills scrollx">
    ${['All',...names].map(n=>{
      const on=n==='All'?!filter:filter===n;
      const c=n!=='All'?getC(n):null;
      return`<button class="pill${on?' on':''}" onclick="setFilter('${n}')"
        style="${on&&c?`background:${c.bg};border-color:${c.br};color:${c.tx}`:''}">
        ${n==='All'?'👪 All':n}</button>`;
    }).join('')}
  </div></div>`;
}

/* ══════════════════════════════════════════════════════
   FEED
   ══════════════════════════════════════════════════════ */
function buildFeed(){
  if(loadingFeed)return buildSkeletons();
  let fp=filter?posts.filter(p=>p.name===filter):posts;
  if(searchQ){
    const q=searchQ.toLowerCase();
    fp=fp.filter(p=>p.name.toLowerCase().includes(q)||(p.caption||'').toLowerCase().includes(q)||getOct(p.oct).l.toLowerCase().includes(q)||(postTags[p.id]||[]).some(t=>t.includes(q)));
  }
  if(pinnedPostId){const pi=fp.findIndex(p=>p.id===pinnedPostId);if(pi>0){const[pin]=fp.splice(pi,1);fp=[pin,...fp]}}
  if(!fp.length)return`<div class="empty-wrap"><div class="empty-ico">${searchQ?'🔍':'📸'}</div>
    <div class="empty-title">${searchQ?'No results':'No moments yet'}</div>
    <div class="empty-desc">${searchQ?`Nothing found for "${searchQ}"`:'Tap + below to share the first family moment!'}</div></div>`;
  return`<div class="content">${fp.map((p,i)=>buildCard(p,i)).join('')}</div>`;
}
function buildSkeletons(){
  return`<div class="content">${[1,2,3].map(()=>`<div class="skeleton-card">
    <div class="skeleton-header"><div class="skeleton skeleton-circle"></div><div class="skeleton-lines"><div class="skeleton skeleton-line" style="width:55%"></div><div class="skeleton skeleton-line" style="width:35%"></div></div></div>
    <div class="skeleton skeleton-img"></div>
    <div class="skeleton-footer"><div class="skeleton skeleton-pill"></div><div class="skeleton skeleton-pill"></div><div class="skeleton skeleton-pill"></div></div>
  </div>`).join('')}</div>`;
}

/* ══════════════════════════════════════════════════════
   POST CARD
   ══════════════════════════════════════════════════════ */
function buildCard(p,idx){
  const c=getC(p.name),o=getOct(p.oct);
  const isNew=new Date(p.created_at).getTime()>lastSeen;
  const isPinned=pinnedPostId===p.id;
  const seenList=(seenBy[p.id]||[]).filter(n=>!isOwn(n));
  const seenHtml=seenList.length?`<div class="seen-by">
    ${seenList.slice(0,4).map(n=>{const sc=getC(n);const sp=profiles[n];return sp?.photo?`<div class="seen-av"><img src="${sp.photo}"></div>`:`<span class="seen-av" style="background:${sc.bg};border-color:${sc.br};color:${sc.tx}">${n[0]}</span>`}).join('')}
    <span>Seen by ${seenList.slice(0,3).join(', ')}${seenList.length>3?` +${seenList.length-3}`:''}</span>
  </div>`:'';

  /* Media rendering: if this post has 2+ items in `media`, show a
     swipeable carousel. If exactly 1 item in `media`, or an old post with
     only photo_url/video_url set, fall back to the original single-media
     markup unchanged — so nothing about old posts changes visually. */
  const mediaList=Array.isArray(p.media)&&p.media.length?p.media:null;
  const mediaHtml = mediaList&&mediaList.length>1
    ? buildCarousel(p,mediaList)
    : p.video_url
      ?`<div class="post-video-wrap">
          <video class="post-video" src="${getVideoUrl(p.video_url)}" playsinline preload="none"
            onclick="togglePostVideo(this)"></video>
          <div class="video-play-btn" onclick="togglePostVideo(this.previousElementSibling)">▶</div>
        </div>`
      :p.photo_url
      ?`<div class="post-img-wrap">
          <div class="img-blur" id="iblur-${p.id}"><div class="img-spinner"></div></div>
          <img class="post-img" src="${p.photo_url}" alt="" loading="lazy"
            onclick="setFull('${p.id}')" onload="imgLoaded('${p.id}')"
            oncontextmenu="saveImg(event,'${p.photo_url}')"
            ontouchstart="startLP('${p.photo_url}',event)" ontouchend="endLP()" ontouchmove="endLP()">
          <div class="img-overlay-btns">
            <button class="img-overlay-btn" onclick="setFull('${p.id}')">🔍 View</button>
            <button class="img-overlay-btn" onclick="saveImg(null,'${p.photo_url}')">⬇ Save</button>
          </div>
        </div>${buildAiTags(p.id)}`
      :`<div class="no-img" style="background:${o.bg};border-color:${o.br}"><span style="font-size:16px">${o.e}</span><span class="no-img-txt" style="color:${o.tx}">${o.l}</span></div>`;

  return`<div class="card${isNew?' is-new':''}${isPinned?' pinned':''}" id="post-${p.id}" style="animation-delay:${idx*.04}s">
    ${isPinned?`<div class="pin-banner">📌 Pinned</div>`:''}
    <div class="card-hdr">
      <div onclick="openProfile('${p.name}')" style="cursor:pointer">${buildAv(p.name,'av')}</div>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="openProfile('${p.name}')">
        <div class="cname">${p.name}</div>
        <div class="ctime" onclick="showFullDate('${p.id}');event.stopPropagation()">${ago(p.created_at)}</div>
      </div>
      <span class="oct-tag" style="background:${o.bg};color:${o.tx};border:1px solid ${o.br}">${o.e} ${o.l}</span>
      <button class="more-btn" onclick="toggleCtx('${p.id}',event)">⋯</button>
    </div>
    ${openCtx===p.id?buildCtxMenu(p):''}
    ${mediaHtml}
    ${p.caption?`<div class="caption">${rich(p.caption)}</div>`:''}
    ${seenHtml}
    ${buildRxns(p)}
    ${buildCmtSection(p)}
  </div>`;
}
/* Swipeable multi-photo/video carousel — pure CSS scroll-snap, no JS drag
   library needed. Dots update on scroll via onCarouselScroll(). Each slide
   is either an <img> or a tap-to-play <video>, same behavior as single
   posts. */
function buildCarousel(p,mediaList){
  const idx=carouselIdx[p.id]||0;
  const slides=mediaList.map((m,i)=>{
    if(m.type==='video'){
      return`<div class="carousel-slide">
        <video class="post-video" src="${getVideoUrl(m.url)}" playsinline preload="none"
          onclick="togglePostVideo(this)"></video>
        <div class="video-play-btn" onclick="togglePostVideo(this.previousElementSibling)">▶</div>
      </div>`;
    }
    return`<div class="carousel-slide">
      <img class="post-img carousel-img" src="${m.url}" alt="" loading="lazy"
        onclick="setFull('${p.id}',${i})"
        oncontextmenu="saveImg(event,'${m.url}')"
        ontouchstart="startLP('${m.url}',event)" ontouchend="endLP()" ontouchmove="endLP()">
    </div>`;
  }).join('');
  const dots=mediaList.map((_,i)=>`<span class="carousel-dot${i===idx?' active':''}"></span>`).join('');
  return`<div class="post-carousel">
    <div class="carousel-track" id="carousel-${p.id}" onscroll="onCarouselScroll('${p.id}',this)">${slides}</div>
    <div class="carousel-count">${idx+1}/${mediaList.length}</div>
    <div class="carousel-dots">${dots}</div>
  </div>`;
}
function onCarouselScroll(pid,track){
  const w=track.clientWidth;if(!w)return;
  const idx=Math.round(track.scrollLeft/w);
  if(carouselIdx[pid]===idx)return;
  carouselIdx[pid]=idx;
  const card=document.getElementById('post-'+pid);if(!card)return;
  card.querySelectorAll('.carousel-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  const countEl=card.querySelector('.carousel-count');
  const total=card.querySelectorAll('.carousel-slide').length;
  if(countEl)countEl.textContent=(idx+1)+'/'+total;
}

/* ══════════════════════════════════════════════════════
   CONTEXT MENU
   ══════════════════════════════════════════════════════ */
function buildCtxMenu(p){
  const isPinned=pinnedPostId===p.id;
  return`<div class="ctx-menu" id="ctx-${p.id}">
    <button class="ctx-item" onclick="openProfile('${p.name}')"><span class="ctx-item-ico">👤</span>View profile</button>
    ${isOwn(p.name)?`<button class="ctx-item danger" onclick="confirmDel('${p.id}')"><span class="ctx-item-ico">🗑️</span>Delete</button>`:''}
    <button class="ctx-item" onclick="togglePin('${p.id}')"><span class="ctx-item-ico">📌</span>${isPinned?'Unpin':'Pin to top'}</button>
    ${p.photo_url?`<button class="ctx-item" onclick="setFull('${p.id}')"><span class="ctx-item-ico">🔍</span>Fullscreen</button>`:''}
    ${p.photo_url?`<button class="ctx-item" onclick="saveImg(null,'${p.photo_url}')"><span class="ctx-item-ico">⬇️</span>Save photo</button>`:''}
    ${p.video_url?`<button class="ctx-item" onclick="saveImg(null,'${p.video_url}')"><span class="ctx-item-ico">⬇️</span>Save video</button>`:''}
    <button class="ctx-item" onclick="copyCaption('${p.id}')"><span class="ctx-item-ico">📋</span>Copy caption</button>
    <button class="ctx-item" onclick="closeCtx()"><span class="ctx-item-ico">✕</span>Close</button>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   REACTIONS
   ══════════════════════════════════════════════════════ */
function buildRxns(p){
  const rxn=p.reactions||{};
  const pills=Object.entries(rxn).filter(([,n])=>n.length>0).map(([e,names])=>{
    const mine=names.includes(myName);
    return`<button class="rxn-pill${mine?' mine':''}" onclick="doRxn('${p.id}','${e}',this)"
      onmouseenter="showWho(this)" onmouseleave="hideWho(this)"
      ontouchstart="showWhoTouch(this)" ontouchend="hideWho(this)">
      <span class="rxn-who">${names.join(', ')}</span>
      <span class="rxn-emoji">${e}</span><span class="rxn-count">${names.length}</span>
    </button>`;
  }).join('');
  const adds=RXN.map(e=>`<button class="rxn-add-btn" onclick="doRxn('${p.id}','${e}',this)">${e}</button>`).join('');
  return`<div class="rxn-wrap">${pills}</div><div class="rxn-add-row">${adds}</div>`;
}
function doRxn(pid,emoji,btn){
  const name=myName||'You',p=posts.find(p=>p.id===pid);if(!p)return;
  const rxn={...(p.reactions||{})};
  rxn[emoji]=rxn[emoji]?[...rxn[emoji]]:[];
  const i=rxn[emoji].indexOf(name);
  if(i>-1){rxn[emoji].splice(i,1);if(!rxn[emoji].length)delete rxn[emoji]}
  else{rxn[emoji].push(name);vibrate(15);playSound('reaction');}
  p.reactions=rxn;
  btn.classList.add('pop');btn.addEventListener('animationend',()=>btn.classList.remove('pop'),{once:true});
  const card=document.getElementById('post-'+pid);
  if(card){const rw=card.querySelector('.rxn-wrap'),ra=card.querySelector('.rxn-add-row');
    if(rw&&ra){const tmp=document.createElement('div');tmp.innerHTML=buildRxns(p);rw.replaceWith(tmp.children[0]);ra.replaceWith(tmp.children[0]);}}
  updateRxn(pid,rxn);
}
function showWho(btn){btn.classList.add('show-who')}
function hideWho(btn){btn.classList.remove('show-who')}
let whoT=null;
function showWhoTouch(btn){clearTimeout(whoT);btn.classList.add('show-who');whoT=setTimeout(()=>btn.classList.remove('show-who'),2500)}

/* ══════════════════════════════════════════════════════
   COMMENTS
   ══════════════════════════════════════════════════════ */
function buildCmtSection(p){
  const cmts=(comments[p.id]||[]).filter(c=>!c._ph);
  const total=cmtCountRaw(p.id);
  const isOpen=openComments[p.id];
  const draft=cmtDraft[p.id]||{text:'',photo:null,replyTo:null};
  const page=cmtPages[p.id]||1;
  const top=cmts.filter(c=>!c.parent_id);
  const shown=top.slice(0,page*CMT_PAGE);
  const hasMore=top.length>shown.length;
  const hasNew=newCmtPosts[p.id];
  let body='';
  if(isOpen){
    const list=shown.map(c=>buildCmt(p.id,c,cmts,0)).join('');
    const more=hasMore?`<button class="load-more-cmt" onclick="moreCmts('${p.id}')">▼ Load ${Math.min(CMT_PAGE,top.length-shown.length)} more</button>`:'';
    const replyBanner=draft.replyTo?`<div class="replying-to">↩ Replying to <strong>${draft.replyTo.name}</strong><button onclick="clearReply('${p.id}')">✕</button></div>`:'';
    const imgPrev=draft.photo?`<div class="cmt-img-preview"><img src="${draft.photo}"><button class="cmt-img-rm" onclick="clearCmtImg('${p.id}')">✕</button></div>`:'';
    body=`<div class="comments-body open">
      ${list}${more}${replyBanner}${imgPrev}
      <div class="comment-input-wrap">
        ${buildAv(myName,'av av-sm')}
        <div class="comment-input-inner">
          <textarea class="comment-input" id="ci-${p.id}"
            placeholder="${draft.replyTo?`Reply to ${draft.replyTo.name}…`:'Add a comment…'}"
            rows="1" oninput="onCmtIn(this,'${p.id}')"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitCmt('${p.id}')}"
          >${draft.text||''}</textarea>
          <button class="comment-img-btn" onclick="attachCmtImg('${p.id}')">📎</button>
        </div>
        <button class="comment-send${draft.text?.trim()||draft.photo?' active':''}" id="cs-${p.id}" onclick="submitCmt('${p.id}')">➤</button>
      </div>
    </div>`;
  }
  return`<div class="comments-section">
    <button class="comments-toggle${isOpen?' open':''}" onclick="toggleCmts('${p.id}')">
      <span class="comments-toggle-ico">▶</span>
      <span>Comments</span>
      <span class="cmt-badge" id="cb-${p.id}">${total}</span>
      ${hasNew&&!isOpen?`<span class="cmt-new-dot"></span>`:''}
    </button>
    <div id="cs-sec-${p.id}">${body}</div>
  </div>`;
}
function buildCmt(pid,cmt,all,depth){
  if(depth>2)return'';
  const replies=all.filter(r=>r.parent_id===cmt.id);
  const rxn=cmt.reactions||{};
  const rxnHtml=CMT_RXN.map(e=>{const names=rxn[e]||[];const mine=names.includes(myName);
    return`<button class="comment-rxn${mine?' mine':''}" onclick="doCmtRxn('${pid}','${cmt.id}','${e}',this)"
      style="${mine?'opacity:1':'opacity:0.45'}">${e}${names.length?` <span style="font-size:9px;font-weight:800">${names.length}</span>`:''}</button>`;
  }).join('');
  const dc=depth===1?'reply':depth===2?'reply-l2':'';
  return`<div class="comment${dc?' '+dc:''}" id="cm-${cmt.id}">
    ${buildAv(cmt.name,'av av-xs')}
    <div class="comment-body">
      <div class="comment-bubble">
        <div class="comment-name">${cmt.name}</div>
        <div class="comment-txt">${rich(cmt.text)}</div>
        ${cmt.photo_url?`<img class="comment-img" src="${cmt.photo_url}" loading="lazy" onclick="openImgViewer('${cmt.photo_url}')">`:''}
      </div>
      <div class="comment-meta">
        <span class="comment-time">${ago(cmt.created_at)}</span>
        ${depth<2?`<button class="comment-action" onclick="setReply('${pid}','${cmt.id}','${cmt.name}')">↩ Reply</button>`:''}
        ${isOwn(cmt.name)?`<button class="comment-action" onclick="delComment('${pid}','${cmt.id}')" style="color:var(--red)">Delete</button>`:''}
        <div class="comment-rxn-row">${rxnHtml}</div>
      </div>
    </div>
  </div>${replies.map(r=>buildCmt(pid,r,all,depth+1)).join('')}`;
}
async function toggleCmts(pid){
  const was=openComments[pid];openComments[pid]=!was;
  if(!was){
    const hasph=(comments[pid]||[]).some(c=>c._ph);
    if(!comments[pid]||hasph)await loadComments(pid);
    newCmtPosts[pid]=false;
  }
  repaintCard(pid);
  if(!was)setTimeout(()=>document.getElementById('ci-'+pid)?.focus(),150);
}
function onCmtIn(el,pid){
  el.style.height='auto';el.style.height=el.scrollHeight+'px';
  if(!cmtDraft[pid])cmtDraft[pid]={text:'',photo:null,replyTo:null};
  cmtDraft[pid].text=el.value;
  const btn=document.getElementById('cs-'+pid);
  if(btn)btn.className='comment-send'+(el.value.trim()||cmtDraft[pid]?.photo?' active':'');
}
function setReply(pid,cid,name){if(!cmtDraft[pid])cmtDraft[pid]={text:'',photo:null,replyTo:null};cmtDraft[pid].replyTo={id:cid,name};repaintCmts(pid);setTimeout(()=>document.getElementById('ci-'+pid)?.focus(),100)}
function clearReply(pid){if(cmtDraft[pid])cmtDraft[pid].replyTo=null;repaintCmts(pid)}
function attachCmtImg(pid){commentImgTarget=pid;document.getElementById('commentImgIn').click()}
function clearCmtImg(pid){if(cmtDraft[pid])cmtDraft[pid].photo=null;repaintCmts(pid)}
async function submitCmt(pid){
  const draft=cmtDraft[pid]||{};
  const text=(document.getElementById('ci-'+pid)?.value||draft.text||'').trim();
  if(!text&&!draft.photo)return;if(!myName)return;
  let photoURL=null;
  if(draft.photo){document.getElementById('uploading').className='uploading-overlay show';photoURL=await uploadPhoto(draft.photo);document.getElementById('uploading').className='uploading-overlay';}
  await addComment(pid,draft.replyTo?.id||null,text,photoURL);
  cmtDraft[pid]={text:'',photo:null,replyTo:null};
  repaintCmts(pid);repaintCmtBadge(pid);
  toast('💬 Comment sent!');vibrate(20);playSound('send');
}
function doCmtRxn(pid,cid,emoji,btn){
  const name=myName||'You',cmt=(comments[pid]||[]).find(c=>c.id===cid);if(!cmt)return;
  const rxn={...(cmt.reactions||{})};rxn[emoji]=rxn[emoji]?[...rxn[emoji]]:[];
  const i=rxn[emoji].indexOf(name);
  if(i>-1){rxn[emoji].splice(i,1);if(!rxn[emoji].length)delete rxn[emoji]}else{rxn[emoji].push(name);vibrate(10);}
  cmt.reactions=rxn;
  btn.style.transform='scale(0.7)';requestAnimationFrame(()=>requestAnimationFrame(()=>{btn.style.transform='';btn.style.transition='transform .2s'}));
  updateCmtRxn(pid,cid,rxn);repaintCmts(pid);
}
function moreCmts(pid){cmtPages[pid]=(cmtPages[pid]||1)+1;repaintCmts(pid)}
function repaintCard(pid){const card=document.getElementById('post-'+pid);const p=posts.find(p=>p.id===pid);if(!card||!p)return;const cs=card.querySelector('.comments-section');if(cs){const tmp=document.createElement('div');tmp.innerHTML=buildCmtSection(p);cs.replaceWith(tmp.firstChild)}}
function repaintCmts(pid){const p=posts.find(p=>p.id===pid);if(!p||!openComments[pid])return;repaintCard(pid);repaintCmtBadge(pid)}
function repaintCmtBadge(pid){const el=document.getElementById('cb-'+pid);if(el)el.textContent=cmtCountRaw(pid)}
function repaintNav(){const nav=document.querySelector('.nav');if(nav)nav.outerHTML=buildNav()}
function repaintChat(){
  const wrap=document.getElementById('chatMsgsWrap');if(!wrap)return;
  const v=document.getElementById('chatInput')?.value||'';
  wrap.innerHTML=buildMsgList();scrollChat();
  const ni=document.getElementById('chatInput');if(ni)ni.value=v;
}

/* ══════════════════════════════════════════════════════
   NEW POST BANNER
   ══════════════════════════════════════════════════════ */
function showNewBanner(){
  const main=document.querySelector('.main');if(!main)return;
  const fp=filter?posts.filter(p=>p.name===filter):posts;
  const n=fp.filter(p=>new Date(p.created_at).getTime()>lastSeen);
  if(!n.length||document.getElementById('npb'))return;
  const d=document.createElement('div');d.className='new-post-banner';d.id='npb';
  d.innerHTML=`<button class="new-post-pill" onclick="dismissBanner()">▲ ${n.length} new moment${n.length>1?'s':''} — tap to see</button>`;
  const content=main.querySelector('.content');
  if(content)content.prepend(d);else main.prepend(d);
}
function dismissBanner(){document.getElementById('npb')?.remove();render()}

/* ══════════════════════════════════════════════════════
   ADD POST
   ══════════════════════════════════════════════════════ */
function buildAdd(){
  const fam=[...new Set(posts.map(p=>p.name))].filter(n=>!isOwn(n));
  const pa=!showNameInput
    ?`<div class="posting-as"><div><div class="pa-lbl">Posting as</div><div class="pa-name">${myName}</div></div><button class="change-btn" onclick="showNameInput=true;render()">Change</button></div>`
    :`<label class="field-lbl">Your name</label><input class="field" id="nameIn" value="${myName}" placeholder="e.g. Omar" autocapitalize="words" oninput="checkSub()">`;
  const canAddMore=draftMedia.length<MAX_MEDIA;
  return`<div class="add-wrap">
    <div class="page-ttl">Share a moment 📸🎬</div>
    ${pa}
    <div class="photo-row">
      <button class="photo-btn" ${canAddMore?`onclick="document.getElementById('cameraIn').click()"`:'disabled'}><div class="photo-btn-ico">📷</div><div class="photo-btn-txt">Camera</div></button>
      <button class="photo-btn" ${canAddMore?`onclick="document.getElementById('galleryIn').click()"`:'disabled'}><div class="photo-btn-ico">🖼️</div><div class="photo-btn-txt">Gallery</div></button>
      <button class="photo-btn" ${canAddMore?`onclick="document.getElementById('videoIn').click()"`:'disabled'}><div class="photo-btn-ico">🎬</div><div class="photo-btn-txt">Video</div></button>
    </div>
    ${draftMedia.length?buildDraftMediaStrip():''}
    <label class="field-lbl">Occasion</label>
    <div class="oct-row scrollx">${OCTS.map(o=>`<button class="oct-btn${selOct===o.id?' on':''}" onclick="selOct='${o.id}';render()">${o.e} ${o.l}</button>`).join('')}</div>
    <label class="field-lbl">Caption</label>
    <div class="rich-toolbar">
      <button class="rich-btn" onclick="wrapTxt('**','**')"><strong>B</strong></button>
      <button class="rich-btn" onclick="wrapTxt('*','*')"><em>I</em></button>
      ${fam.map(n=>`<button class="rich-btn" onclick="insertMention('${n}')">@${n}</button>`).join('')}
    </div>
    <textarea class="field" id="captIn" placeholder="Say something… Use **bold**, *italic*, @Name" rows="3" oninput="updateCharCount(this)"></textarea>
    <div class="char-count" id="charCount">0 / ${MAX_CAP}</div>
    <button class="submit-btn" id="subBtn" onclick="submitPost()" ${showNameInput?'disabled':''}>Share with family ❤️</button>
  </div>`;
}
/* Horizontal strip of thumbnails for everything queued in draftMedia,
   each with its own remove (✕) button. Photos show the compressed
   dataURL directly; videos show a small tappable preview via <video>
   (muted, no controls) so it's clear which slot is a video. */
function buildDraftMediaStrip(){
  const items=draftMedia.map((m,i)=>{
    const thumb=m.type==='video'
      ?`<video src="${m.previewURL}" muted></video><span class="draft-media-badge">🎬</span>`
      :`<img src="${m.dataURL}">`;
    return`<div class="draft-media-item">
      ${thumb}
      <button class="draft-media-rm" onclick="removeDraftMedia(${i})">✕</button>
    </div>`;
  }).join('');
  return`<div class="draft-media-strip scrollx">${items}
    <div class="draft-media-count">${draftMedia.length}/${MAX_MEDIA}</div>
  </div>`;
}
function removeDraftMedia(idx){
  const item=draftMedia[idx];
  if(item?.previewURL)URL.revokeObjectURL(item.previewURL);
  draftMedia.splice(idx,1);
  render();
}
async function submitPost(){
  if(!requireOnline())return;
  const name=(showNameInput?(document.getElementById('nameIn')?.value||''):myName).trim();
  const caption=(document.getElementById('captIn')?.value||'').trim();
  if(!name||caption.length>MAX_CAP)return;
  const upEl=document.getElementById('uploading');
  upEl.className='uploading-overlay show';
  const hasVideo=draftMedia.some(m=>m.type==='video');
  if(hasVideo){
    upEl.querySelector('.uploading-txt').textContent='Uploading… ❤️';
    upEl.querySelector('.uploading-sub').textContent='This may take a moment';
  }
  try{
    const media=[];
    for(const item of draftMedia){
      if(item.type==='photo'){
        const url=await uploadPhoto(item.dataURL);
        if(!url){upEl.className='uploading-overlay';toast('❌ A photo failed to upload');return;}
        media.push({type:'photo',url});
      } else {
        const url=await uploadVideo(item.file);
        if(!url){upEl.className='uploading-overlay';toast('❌ A video failed to upload');return;}
        media.push({type:'video',url});
      }
    }
    await addPost(name,caption,media,selOct);
    if(name!==myName){myName=name;lss('ayl_name',name)}
    const newPost=posts[0];
    const firstPhoto=draftMedia.find(m=>m.type==='photo');
    if(firstPhoto&&newPost)tagPhotoWithAI(newPost.id,firstPhoto.dataURL);
    draftMedia.forEach(m=>{if(m.previewURL)URL.revokeObjectURL(m.previewURL)});
    draftMedia=[];selOct='everyday';showNameInput=false;
    if(!USE_SB)await loadPosts();
    view='feed';render();toast('✨ Moment shared!');vibrate([20,10,20]);playSound('send');
  }catch(e){alert('Something went wrong. Please try again.')}
  finally{
    upEl.className='uploading-overlay';
    upEl.querySelector('.uploading-txt').textContent='Sharing with family… ❤️';
    upEl.querySelector('.uploading-sub').textContent='Just a moment';
  }
}
function wrapTxt(b,a){const ta=document.getElementById('captIn');if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd;const sel=ta.value.substring(s,e)||'text';ta.value=ta.value.substring(0,s)+b+sel+a+ta.value.substring(e);ta.focus()}
function insertMention(n){const ta=document.getElementById('captIn');if(!ta)return;const p=ta.selectionStart;ta.value=ta.value.substring(0,p)+'@'+n+' '+ta.value.substring(p);ta.focus()}
function updateCharCount(el){const c=document.getElementById('charCount');if(!c)return;const n=el.value.length;c.textContent=`${n} / ${MAX_CAP}`;c.className='char-count'+(n>MAX_CAP?' over':n>MAX_CAP*.8?' warn':'')}
function checkSub(){const v=(document.getElementById('nameIn')?.value||'').trim();const b=document.getElementById('subBtn');if(b)b.disabled=!v}

/* ══════════════════════════════════════════════════════
   CHAT (group + DM)
   ══════════════════════════════════════════════════════ */
function buildChatScreen(){
  const allNames=[...new Set(posts.map(p=>p.name))].filter(n=>!isOwn(n));
  if(chatView==='group'){
    return`<div class="chat-wrap">
      <div class="chat-tabs">
        <button class="chat-tab active" onclick="setChatView('group')">👨‍👩‍👧‍👦 Family Chat</button>
        <button class="chat-tab" onclick="setChatView('dms')">💬 Direct Messages</button>
      </div>
      <div class="chat-msgs-wrap" id="chatMsgsWrap">${buildMsgList(null)}</div>
      <div class="typing-indicator" id="typingInd"><div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><span>typing…</span></div>
      <div class="chat-input-wrap">
        <textarea class="chat-input" id="chatInput" placeholder="Say something to the family…" rows="1"
          oninput="onChatIn(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat(null)}"></textarea>
        <button class="chat-send" id="chatSend" onclick="sendChat(null)" style="opacity:.4">➤</button>
      </div>
    </div>`;
  }
  if(chatView==='dms'){
    // DM list
    return`<div class="chat-wrap">
      <div class="chat-tabs">
        <button class="chat-tab" onclick="setChatView('group')">👨‍👩‍👧‍👦 Family Chat</button>
        <button class="chat-tab active" onclick="setChatView('dms')">💬 Direct Messages</button>
      </div>
      <div class="main" style="flex:1">
        ${allNames.length?`<div class="chat-list">${allNames.map(n=>{
          const key=dmKey(myName,n);
          const msgs=dmMessages[key]||[];
          const last=msgs[msgs.length-1];
          const unread=dmUnread[key]||0;
          return`<div class="chat-list-item" onclick="openDM('${n}')">
            ${buildAv(n,'av')}
            <div style="flex:1;min-width:0">
              <div class="chat-list-name">${n}</div>
              <div class="chat-list-preview">${last?last.text:'Tap to message'}</div>
            </div>
            ${last?`<div class="chat-list-time">${ago(last.created_at)}</div>`:''}
            ${unread>0?`<div class="chat-list-unread">${unread}</div>`:''}
          </div>`;
        }).join('')}</div>`:`<div class="empty-wrap"><div class="empty-ico">💬</div><div class="empty-title">No family members yet</div><div class="empty-desc">Once family members post, you can message them privately here.</div></div>`}
      </div>
    </div>`;
  }
  // Individual DM thread
  const target=chatView; // it's a name
  const key=dmKey(myName,target);
  if(!dmMessages[key])loadDMs(key).then(()=>repaintChat());
  return`<div class="chat-wrap">
    <div class="chat-hdr">
      <button class="icon-btn" onclick="setChatView('dms')" style="margin-right:4px">←</button>
      ${buildAv(target,'av av-sm')}
      <div style="flex:1"><div class="chat-hdr-name">${target}</div></div>
      <button class="chat-call-btn" onclick="startCall('${target}',false)" title="Voice call">📞</button>
      <button class="chat-call-btn" onclick="startCall('${target}',true)" title="Video call">📹</button>
    </div>
    <div class="chat-msgs-wrap" id="chatMsgsWrap">${buildMsgList(key)}</div>
    <div class="chat-input-wrap">
      <textarea class="chat-input" id="chatInput" placeholder="Message ${target}…" rows="1"
        oninput="onChatIn(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat('${key}')}"></textarea>
      <button class="chat-send" id="chatSend" onclick="sendChat('${key}')" style="opacity:.4">➤</button>
    </div>
  </div>`;
}
function buildMsgList(key=null){
  const msgs=key?(dmMessages[key]||[]):(messages.group||[]);
  if(!msgs.length)return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;color:var(--txt2)">
    <div style="font-size:40px;margin-bottom:12px">💬</div>
    <div style="font-size:var(--fs-lg);font-weight:700;color:var(--txt);margin-bottom:6px">${key?'Start the conversation':'Family Chat'}</div>
    <div style="font-size:var(--fs-sm)">Send the first message!</div></div>`;
  let html='',lastDay='';
  msgs.forEach(m=>{
    const day=fmtDay(m.created_at);
    if(day!==lastDay){html+=`<div class="day-divider">${day}</div>`;lastDay=day}
    const own=isOwn(m.name);
    html+=`<div class="msg-row${own?' own':''}">
      ${!own?buildAv(m.name,'av av-sm'):''}
      <div class="msg-body-wrap">
        ${!own&&!key?`<div class="msg-sender">${m.name}</div>`:''}
        <div class="msg-bubble">${rich(m.text)}${own?`<button onclick="delMsg('${m.id}','${key||''}')" style="background:none;border:none;color:rgba(255,255,255,.35);font-size:10px;cursor:pointer;margin-left:8px;padding:0;vertical-align:middle">✕</button>`:''}</div>
        <div class="msg-time">${fmtTime(m.created_at)}</div>
      </div>
    </div>`;
  });
  return html;
}
function setChatView(v){
  chatView=v;
  if(v!=='group'&&v!=='dms'){
    const key=dmKey(myName,v);
    dmUnread[key]=0;
  }
  render();if(view==='chat')scrollChat();
}
function openDM(name){chatView=name;const key=dmKey(myName,name);dmUnread[key]=0;render();scrollChat();}
async function sendChat(key=null){
  if(!requireOnline())return;
  const el=document.getElementById('chatInput');const txt=(el?.value||'').trim();
  if(!txt||!myName)return;
  el.value='';el.style.height='auto';const btn=document.getElementById('chatSend');if(btn)btn.style.opacity='.4';
  await sendMsg(txt,key||null);
  playSound('send');vibrate(15);
}
function setupChatInput(){
  const inp=document.getElementById('chatInput'),btn=document.getElementById('chatSend');
  if(!inp||!btn)return;
  inp.addEventListener('input',()=>{inp.style.height='auto';inp.style.height=inp.scrollHeight+'px';btn.style.opacity=inp.value.trim()?'1':'.4'});
}
function onChatIn(el){el.style.height='auto';el.style.height=el.scrollHeight+'px';const btn=document.getElementById('chatSend');if(btn)btn.style.opacity=el.value.trim()?'1':'.4'}
function scrollChat(){setTimeout(()=>{const el=document.getElementById('chatMsgsWrap');if(el)el.scrollTop=el.scrollHeight},60)}
function markSeen(){unreadMsgs=0;lastMsgSeen=Date.now();lss('ayl_msgseen',lastMsgSeen)}

/* ══════════════════════════════════════════════════════
   PROFILE VIEW (other people)
   ══════════════════════════════════════════════════════ */
function openProfile(name){viewingProfile=name;goView('view-profile')}
function buildViewProfile(name){
  if(!name)return'';
  const prof=profiles[name]||{};
  const c=getC(name);
  const ps=posts.filter(p=>p.name===name);
  const rxns=ps.reduce((a,p)=>a+totalRxn(p.reactions),0);
  const cmts=Object.values(comments).flat().filter(c=>c.name===name&&!c._ph).length;
  const days=ps[0]?(Date.now()-new Date(ps[0].created_at).getTime())/86400000:999;
  const streak=days<1?'🔥 Active today':days<3?`⭐ ${Math.floor(days)}d ago`:'';
  const photoPosts=ps.filter(p=>p.photo_url);
  const col=prof.color||c;
  return`<div class="profile-wrap">
    <div class="profile-hero">
      <div class="profile-hero-bg"></div>
      <div class="profile-av-wrap">
        <div class="profile-av" style="background:${col.bg};border-color:${col.br};color:${col.tx}">
          ${prof.photo?`<img src="${prof.photo}">`:`${name[0].toUpperCase()}`}
        </div>
      </div>
      <div class="profile-name">${name}</div>
      ${prof.bio?`<div class="profile-bio">${prof.bio}</div>`:''}
      <div class="profile-badges">
        ${streak?`<div class="profile-badge">${streak}</div>`:''}
        ${prof.birthday?`<div class="profile-badge">🎂 ${new Date(prof.birthday).toLocaleDateString([],{month:'long',day:'numeric'})}</div>`:''}
      </div>
    </div>
    <div class="profile-stats-bar">
      <div class="profile-stat"><div class="profile-stat-n">${ps.length}</div><div class="profile-stat-l">Posts</div></div>
      <div class="profile-stat"><div class="profile-stat-n">${rxns}</div><div class="profile-stat-l">Reactions</div></div>
      <div class="profile-stat"><div class="profile-stat-n">${cmts}</div><div class="profile-stat-l">Comments</div></div>
    </div>
    <div class="profile-action-row">
      <button class="profile-action-btn" onclick="openDM('${name}');goView('chat')">💬 Message</button>
      <button class="profile-action-btn pri" onclick="startCall('${name}',false)">📞 Call</button>
      <button class="profile-action-btn" onclick="startCall('${name}',true)">📹 Video</button>
    </div>
    ${photoPosts.length?`<div class="profile-section">
      <div class="profile-section-title">📸 Moments (${photoPosts.length})</div>
      <div class="profile-gallery">
        ${photoPosts.slice(0,9).map(p=>`<img class="profile-gallery-img" src="${p.photo_url}" onclick="setFull('${p.id}')" loading="lazy">`).join('')}
      </div>
    </div>`:''}
    ${ps.filter(p=>!p.photo_url&&p.caption).length?`<div class="profile-section">
      <div class="profile-section-title">💬 Text moments</div>
      ${ps.filter(p=>!p.photo_url).slice(0,3).map(p=>{const o=getOct(p.oct);return`<div class="card" style="margin-bottom:10px">
        <div style="padding:12px 14px;font-size:var(--fs-sm);color:var(--txt);font-family:var(--font-d)">${p.caption||''}</div>
        <div style="padding:0 14px 10px;font-size:var(--fs-xs);color:var(--txt3)">${o.e} ${o.l} · ${ago(p.created_at)}</div>
      </div>`}).join('')}
    </div>`:''}
  </div>`;
}

/* ══════════════════════════════════════════════════════
   MY PROFILE PAGE + EDIT
   ══════════════════════════════════════════════════════ */
function buildProfilePage(){
  const prof=getMyProfile();
  const ps=posts.filter(p=>p.name===myName);
  const rxns=ps.reduce((a,p)=>a+totalRxn(p.reactions),0);
  const cmts=Object.values(comments).flat().filter(c=>c.name===myName&&!c._ph).length;
  const photoPosts=ps.filter(p=>p.photo_url);
  const col=prof.color||getC(myName);
  return`<div class="profile-wrap">
    <div class="profile-hero">
      <div class="profile-hero-bg"></div>
      <div class="profile-av-wrap" onclick="goView('profile-edit')">
        <div class="profile-av" style="background:${col.bg};border-color:${col.br};color:${col.tx}">
          ${prof.photo?`<img src="${prof.photo}">`:`${myName[0].toUpperCase()}`}
        </div>
        <div class="profile-av-edit">✏️</div>
      </div>
      <div class="profile-name">${myName}</div>
      ${prof.bio?`<div class="profile-bio">${prof.bio}</div>`:`<div class="profile-bio" style="opacity:.6">Tap to add a bio…</div>`}
      <div class="profile-badges">
        ${prof.birthday?`<div class="profile-badge">🎂 ${new Date(prof.birthday).toLocaleDateString([],{month:'long',day:'numeric'})}</div>`:''}
        <div class="profile-badge">${ps.length} moments shared</div>
      </div>
    </div>
    <div class="profile-stats-bar">
      <div class="profile-stat"><div class="profile-stat-n">${ps.length}</div><div class="profile-stat-l">Posts</div></div>
      <div class="profile-stat"><div class="profile-stat-n">${rxns}</div><div class="profile-stat-l">Reactions</div></div>
      <div class="profile-stat"><div class="profile-stat-n">${cmts}</div><div class="profile-stat-l">Comments</div></div>
    </div>
    <div class="profile-action-row">
      <button class="profile-action-btn pri" onclick="goView('profile-edit')">✏️ Edit profile</button>
    </div>
    ${photoPosts.length?`<div class="profile-section">
      <div class="profile-section-title">📸 Your moments (${photoPosts.length})</div>
      <div class="profile-gallery">
        ${photoPosts.slice(0,9).map(p=>`<img class="profile-gallery-img" src="${p.photo_url}" onclick="setFull('${p.id}')" loading="lazy">`).join('')}
        ${photoPosts.length===0?`<div class="profile-gallery-empty">📸</div>`:''} 
      </div>
    </div>`:`<div class="profile-section"><div class="profile-section-title">No photos yet</div></div>`}
  </div>`;
}
function buildProfileEdit(){
  const prof=getMyProfile();
  const hasCustomPic=!!prof.photo;
  const avHtml=draftProfilePic
    ?`<div class="profile-av" style="background:var(--bg2);border-color:var(--pri)"><img src="${draftProfilePic}"></div>`
    :prof.photo
      ?`<div class="profile-av" style="background:var(--bg2);border-color:var(--pri)"><img src="${prof.photo}"></div>`
      :`<div class="profile-av" style="background:${(prof.color||getC(myName)).bg};border-color:${(prof.color||getC(myName)).br};color:${(prof.color||getC(myName)).tx}">${myName[0].toUpperCase()}</div>`;
  return`<div class="profile-edit-wrap">
    <div class="page-ttl">Edit profile ✏️</div>
    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:20px">
      <div class="profile-av-wrap" onclick="document.getElementById('profilePicIn').click()" style="cursor:pointer">
        ${avHtml}<div class="profile-av-edit">📷</div>
      </div>
      <div style="font-size:var(--fs-xs);color:var(--txt3);margin-top:8px">Tap to change photo</div>
    </div>
    ${draftProfilePic?`<div class="profile-warn">📸 New photo selected — tap Save to apply</div>`:''}
    ${hasCustomPic&&!draftProfilePic?`<div class="profile-warn">⚠️ You have a custom photo. To use an avatar color, remove the photo first.</div>`:''}
    <label class="field-lbl">Name</label>
    <input class="field" id="profileNameIn" value="${myName}" placeholder="Your name" autocapitalize="words">
    <label class="field-lbl">Bio (optional)</label>
    <input class="field" id="profileBioIn" value="${prof.bio||''}" placeholder="Something about yourself…">
    <label class="field-lbl">Birthday (optional)</label>
    <input class="field" id="profileBdayIn" type="date" value="${prof.birthday||''}">
    ${!hasCustomPic||draftProfilePic?`
    <label class="field-lbl">Avatar color</label>
    <div class="color-grid">
      ${MC.map((c,i)=>`<div class="color-swatch${(prof.colorIdx||0)===i&&!draftProfilePic?' active':''}" style="background:${c.bg};border-color:${c.br}" onclick="pickProfileColor(${i})"></div>`).join('')}
    </div>`:''}
    ${prof.photo&&!draftProfilePic?`<button class="field" style="color:var(--red);border-color:var(--red);margin-bottom:14px;text-align:center;background:var(--card)" onclick="removeProfilePic()">🗑 Remove profile photo</button>`:''}
    <button class="submit-btn" onclick="saveProfile()">Save ✓</button>
  </div>`;
}
function pickProfileColor(idx){
  selProfileColor=idx;
  const grid=document.querySelector('.color-grid');
  if(grid)grid.innerHTML=MC.map((c,i)=>`<div class="color-swatch${selProfileColor===i?' active':''}" style="background:${c.bg};border-color:${c.br}" onclick="pickProfileColor(${i})"></div>`).join('');
}
function removeProfilePic(){const prof=getMyProfile();delete prof.photo;draftProfilePic=null;profiles[myName]=prof;saveProfiles();nameColors={};render();toast('Profile photo removed')}
async function saveProfile(){
  const newName=(document.getElementById('profileNameIn')?.value||'').trim()||myName;
  const bio=(document.getElementById('profileBioIn')?.value||'').trim();
  const bday=document.getElementById('profileBdayIn')?.value||'';
  const prof=getMyProfile();
  if(draftProfilePic){prof.photo=draftProfilePic;draftProfilePic=null;delete prof.colorIdx;delete prof.color;}
  else if(!prof.photo){prof.colorIdx=selProfileColor;prof.color=MC[selProfileColor];}
  prof.bio=bio;prof.birthday=bday;
  if(newName!==myName){profiles[newName]={...prof};delete profiles[myName];myName=newName;lss('ayl_name',myName);}
  else profiles[myName]=prof;
  saveProfiles();nameColors={};
  toast('✓ Profile saved!');vibrate(20);goView('profile');
}

/* ══════════════════════════════════════════════════════
   MEMBERS
   ══════════════════════════════════════════════════════ */
function buildMembers(){
  const names=[...new Set(posts.map(p=>p.name))];
  return`<div class="add-wrap">
    <div class="page-ttl">Family members 👨‍👩‍👧‍👦</div>
    ${!names.length?`<div class="empty-wrap"><div class="empty-ico">👨‍👩‍👧‍👦</div><div class="empty-title">No members yet</div></div>`:
    names.map((n,i)=>{
      const ps=posts.filter(p=>p.name===n),last=ps[0];
      const days=last?(Date.now()-new Date(last.created_at).getTime())/86400000:999;
      const streak=days<1?'🔥 Active today':days<3?`⭐ ${Math.floor(days)}d ago`:'';
      const rxns=ps.reduce((a,p)=>a+totalRxn(p.reactions),0);
      const cmtCnt=ps.reduce((a,p)=>a+cmtCount(p.id),0);
      return`<div class="member-card" style="animation-delay:${i*.06}s" onclick="openProfile('${n}')">
        ${buildAv(n,'av')}
        <div style="flex:1;min-width:0">
          <div class="member-name">${n}${isOwn(n)?' <span style="font-size:11px;font-weight:600;color:var(--txt3)">(you)</span>':''}${streak?`<span class="streak-badge">${streak}</span>`:''}</div>
          <div class="member-meta">${ps.length} moment${ps.length!==1?'s':''} · last ${last?ago(last.created_at):'never'}</div>
          <div class="member-stats">
            <div class="stat"><div class="stat-n">${ps.length}</div><div class="stat-l">Posts</div></div>
            <div class="stat"><div class="stat-n">${rxns}</div><div class="stat-l">Reactions</div></div>
            <div class="stat"><div class="stat-n">${cmtCnt}</div><div class="stat-l">Comments</div></div>
          </div>
        </div>
        <div style="font-size:18px;color:var(--txt3)">›</div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ══════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════ */
function buildStats(){
  const names=[...new Set(posts.map(p=>p.name))];
  const totalPosts=posts.length;
  const totalRxns=posts.reduce((a,p)=>a+totalRxn(p.reactions),0);
  const totalCmts=Object.entries(comments).reduce((a,[,c])=>a+(Array.isArray(c)?c.filter(x=>!x._ph).length:0),0);
  const totalMsgs=(messages.group||[]).length;
  const pStats=names.map(n=>{
    const ps=posts.filter(p=>p.name===n);
    const rxns=ps.reduce((a,p)=>a+totalRxn(p.reactions),0);
    const cmts=Object.values(comments).flat().filter(c=>c.name===n&&!c._ph).length;
    const lastPost=ps[0]?new Date(ps[0].created_at).getTime():0;
    return{name:n,posts:ps.length,rxns,cmts,score:ps.length*3+rxns+cmts,lastPost};
  }).sort((a,b)=>b.score-a.score);
  const topPost=posts.length?[...posts].sort((a,b)=>totalRxn(b.reactions)-totalRxn(a.reactions))[0]:null;
  const topRxnCount=topPost?totalRxn(topPost.reactions):0;
  const inactive=pStats.filter(p=>(Date.now()-p.lastPost)/86400000>7&&!isOwn(p.name));
  const octCounts={};posts.forEach(p=>{octCounts[p.oct]=(octCounts[p.oct]||0)+1});
  const topOct=Object.entries(octCounts).sort((a,b)=>b[1]-a[1])[0];
  const topOctData=topOct?getOct(topOct[0]):null;
  const maxScore=pStats[0]?.score||1;
  const rankCls=i=>i===0?'gold':i===1?'silver':i===2?'bronze':'';
  return`<div class="stats-wrap">
    <div class="page-ttl">Family Stats 📊</div>
    <div class="stats-hero"><div class="stats-hero-n">${totalPosts}</div><div class="stats-hero-l">moments shared together ❤️</div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-n">${totalRxns}</div><div class="stat-card-l">Reactions</div></div>
      <div class="stat-card"><div class="stat-card-n">${totalCmts}</div><div class="stat-card-l">Comments</div></div>
      <div class="stat-card"><div class="stat-card-n">${totalMsgs}</div><div class="stat-card-l">Messages</div></div>
      <div class="stat-card"><div class="stat-card-n">${names.length}</div><div class="stat-card-l">Members</div></div>
    </div>
    ${topOctData?`<div class="stat-card" style="margin-bottom:16px;text-align:left;display:flex;align-items:center;gap:12px">
      <span style="font-size:28px">${topOctData.e}</span>
      <div><div class="stat-card-n" style="font-size:20px;text-align:left">${topOctData.l}</div><div class="stat-card-l">most shared occasion</div></div>
    </div>`:''}
    <div class="leaderboard">
      <div class="lb-title">🏆 Most Active</div>
      ${pStats.map((p,i)=>`<div class="lb-row" style="animation-delay:${i*.06}s;cursor:pointer" onclick="openProfile('${p.name}')">
        <div class="lb-rank ${rankCls(i)}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
        ${buildAv(p.name,'av av-xs')}
        <div class="lb-name">${p.name}${isOwn(p.name)?' <span style="color:var(--txt3);font-weight:400">(you)</span>':''}</div>
        <div style="flex:1;margin:0 8px"><div class="lb-bar-wrap"><div class="lb-bar" style="width:${Math.round(p.score/maxScore*100)}%"></div></div></div>
        <div class="lb-val">${p.posts} posts</div>
      </div>`).join('')}
    </div>
    <div class="leaderboard">
      <div class="lb-title">❤️ Most Reactions Received</div>
      ${[...pStats].sort((a,b)=>b.rxns-a.rxns).map((p,i)=>{const max=[...pStats].sort((a,b)=>b.rxns-a.rxns)[0]?.rxns||1;
        return`<div class="lb-row" style="animation-delay:${i*.06}s;cursor:pointer" onclick="openProfile('${p.name}')">
          <div class="lb-rank ${rankCls(i)}">${i+1}</div>
          ${buildAv(p.name,'av av-xs')}
          <div class="lb-name">${p.name}</div>
          <div style="flex:1;margin:0 8px"><div class="lb-bar-wrap"><div class="lb-bar" style="width:${Math.round(p.rxns/max*100)}%"></div></div></div>
          <div class="lb-val">${p.rxns} ❤️</div>
        </div>`;
      }).join('')}
    </div>
    ${topPost&&topRxnCount>0?`<div style="margin-bottom:6px;font-family:var(--font-d);font-size:var(--fs);font-weight:700;color:var(--txt)">⭐ Most Loved Moment</div>
    <div class="card" style="margin-bottom:16px">
      <div class="top-post-label">⭐ ${topRxnCount} reaction${topRxnCount!==1?'s':''}</div>
      ${buildCard(topPost,0)}
    </div>`:''}
    ${inactive.length?`<div style="margin-bottom:10px;font-family:var(--font-d);font-size:var(--fs);font-weight:700;color:var(--txt)">😴 Not posted in a while</div>
    ${inactive.map(p=>`<div class="reminder-nudge" onclick="openProfile('${p.name}')" style="cursor:pointer">
      <span style="font-size:28px">😴</span>
      <div style="flex:1"><div class="nudge-name">${p.name}</div><div class="nudge-meta">Last posted ${Math.floor((Date.now()-p.lastPost)/86400000)} days ago</div></div>
      <div style="font-size:16px;color:var(--txt3)">›</div>
    </div>`).join('')}`:''}
  </div>`;
}

/* ══════════════════════════════════════════════════════
   NAV
   ══════════════════════════════════════════════════════ */
function buildNav(){
  const isFeed=view==='feed',isChat=view==='chat',isSt=view==='stats',isMem=view==='members';
  const totalUnread=unreadMsgs+Object.values(dmUnread).reduce((a,b)=>a+b,0);
  return`<div class="nav">
    <button class="nav-btn" onclick="goView('feed')">
      <div class="nav-ico${isFeed?' active':''}">🏠</div><div class="nav-lbl${isFeed?' active':''}">Home</div>
    </button>
    <button class="nav-btn" onclick="goView('chat');markSeen()" style="position:relative">
      <div class="nav-ico${isChat?' active':''}">💬</div><div class="nav-lbl${isChat?' active':''}">Chat</div>
      ${totalUnread>0&&!isChat?`<span class="unread-badge">${totalUnread}</span>`:''}
    </button>
    <button class="fab" onclick="goView('add')">＋</button>
    <button class="nav-btn" onclick="goView('stats')">
      <div class="nav-ico${isSt?' active':''}">📊</div><div class="nav-lbl${isSt?' active':''}">Stats</div>
    </button>
    <button class="nav-btn" onclick="goView('members')">
      <div class="nav-ico${isMem?' active':''}">👨‍👩‍👧‍👦</div><div class="nav-lbl${isMem?' active':''}">Family</div>
    </button>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   FULLSCREEN + THEME SHEET
   ══════════════════════════════════════════════════════ */
function buildFullscreenInner(p){
  const o=getOct(p.oct);
  // Multi-media posts: show whichever slide was actually tapped
  // (carouselIdx[p.id], set by setFull's mediaIdx param), not always the
  // first item. Falls back to the old single photo_url for posts with no
  // media array (or exactly one item), unchanged from before.
  const mediaList=Array.isArray(p.media)&&p.media.length?p.media:null;
  const idx=mediaList?Math.min(carouselIdx[p.id]||0,mediaList.length-1):0;
  const current=mediaList?mediaList[idx]:{type:p.video_url?'video':'photo',url:p.photo_url};
  const isPhoto=current.type==='photo'&&current.url;
  return`<div class="fs-top">
      <button class="fs-close" onclick="setFull(null)">✕ Close</button>
      ${isPhoto?`<button class="fs-save" onclick="saveImg(null,'${current.url}')">⬇ Save</button>`:''}
    </div>
    ${isPhoto?`<img class="fs-img" src="${current.url}" alt="">`:''}
    ${mediaList&&mediaList.length>1?`<div class="fs-meta" style="margin-bottom:-8px">${idx+1} / ${mediaList.length}</div>`:''}
    <div class="fs-meta">${p.name} · <span style="opacity:.6">${o.e} ${o.l}</span></div>
    ${p.caption?`<div class="fs-cap">${rich(p.caption)}</div>`:''}
    <div style="color:rgba(255,255,255,.3);font-size:11px;margin-top:8px">${fullDate(p.created_at)}</div>`;
}
function buildFullscreen(){
  if(!fullPost)return`<div class="fullscreen" id="fullscreen"></div>`;
  const p=posts.find(p=>p.id===fullPost);if(!p)return`<div class="fullscreen" id="fullscreen"></div>`;
  return`<div class="fullscreen show" id="fullscreen">${buildFullscreenInner(p)}</div>`;
}
function buildThemeSheet(curTheme,curFS){
  const customPri=ls('ayl_custom_pri','#C4622D');
  const customPri2=ls('ayl_custom_pri2','#E8A87C');
  return`<div class="sheet-overlay" id="themeOverlay" onclick="closeSheet(event)">
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Personalise ✨</div>
      <div class="theme-grid">
        ${THEMES.map(t=>`<button class="theme-swatch" onclick="setTheme('${t.id}')">
          <div class="theme-circle${curTheme===t.id?' active':''}" style="background:${t.bg};box-shadow:0 3px 10px rgba(0,0,0,.15)"><span style="font-size:18px">${t.e}</span></div>
          <div class="theme-name">${t.name}</div>
        </button>`).join('')}
        <button class="theme-swatch" onclick="">
          <div class="theme-circle${curTheme==='custom'?' active':''}" style="background:${customPri};box-shadow:0 3px 10px rgba(0,0,0,.15)"><span style="font-size:18px">🎨</span></div>
          <div class="theme-name">Custom</div>
        </button>
      </div>
      <div class="color-picker-row">
        <label>Primary</label>
        <input type="color" class="color-picker-input" id="cpri" value="${customPri}">
        <label>Accent</label>
        <input type="color" class="color-picker-input" id="cpri2" value="${customPri2}">
        <button class="color-picker-apply" onclick="applyCustomFromPicker()">Apply</button>
      </div>
      <div class="size-row">
        <div class="size-lbl">Text size</div>
        <div class="size-btns">
          <button class="size-step${curFS==='sm'?' active':''}" onclick="setFS('sm')" data-s="sm" style="font-size:11px">A</button>
          <button class="size-step${curFS==='md'?' active':''}" onclick="setFS('md')" data-s="md" style="font-size:14px">A</button>
          <button class="size-step${curFS==='lg'?' active':''}" onclick="setFS('lg')" data-s="lg" style="font-size:18px">A</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   ONBOARDING
   ══════════════════════════════════════════════════════ */
function renderOnboarding(app){
  app.innerHTML=`<div class="ob">
    <div class="ob-logo">عيلتنا</div>
    <div class="ob-sub">Your family's private space</div>
    <div class="feat-card"><div class="feat-ico">📸</div><div><div class="feat-label">Share moments & photos</div><div class="feat-desc">Posts, reactions, comments — all in one place</div></div></div>
    <div class="feat-card"><div class="feat-ico">💬</div><div><div class="feat-label">Group & private chat</div><div class="feat-desc">Family chat and direct messages</div></div></div>
    <div class="feat-card"><div class="feat-ico">📞</div><div><div class="feat-label">Voice & video calls</div><div class="feat-desc">Free internet calls — no phone number needed</div></div></div>
    <div class="feat-card"><div class="feat-ico">🎨</div><div><div class="feat-label">Personalise everything</div><div class="feat-desc">6 themes + custom colors + text size</div></div></div>
    <div style="font-size:var(--fs-sm);font-weight:800;color:var(--txt2);text-align:left;align-self:flex-start;max-width:340px;width:100%;margin-bottom:7px">What is your name?</div>
    <input class="ob-input" id="obIn" placeholder="e.g. Omar" oninput="obChk()" autocapitalize="words" autocorrect="off">
    <button class="ob-btn" id="obBtn" onclick="join()" disabled>Join the family →</button>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   ACTIONS
   ══════════════════════════════════════════════════════ */
function obChk(){const v=(document.getElementById('obIn')?.value||'').trim();const b=document.getElementById('obBtn');if(b){b.disabled=!v;b.style.opacity=v?'1':'.35'}}
function join(){const n=(document.getElementById('obIn')?.value||'').trim();if(!n)return;myName=n;lss("ayl_name",n);initNotifs();initPeer();render()}
const VIDEO_CACHE='ayl-videos-v1';

async function prefetchVideo(url){
  if(!url||!('caches'in window))return;
  try{
    const cache=await caches.open(VIDEO_CACHE);
    if(await cache.match(url))return; // already cached
    // Fetch and cache in background — don't await so it doesn't block anything
    fetch(url,{mode:'cors'}).then(res=>{if(res.ok)cache.put(url,res);}).catch(()=>{});
  }catch{}
}

// Prefetch videos for visible posts in background
function prefetchVisibleVideos(){
  const videoPosts=posts.filter(p=>p.video_url).slice(0,5);
  videoPosts.forEach(p=>prefetchVideo(getVideoUrl(p.video_url)));
}

function getVideoUrl(url){
  if(!url||!url.includes('cloudinary.com'))return url;
  return url.replace('/upload/','/upload/q_auto,vc_auto/');
}
async function togglePostVideo(video){
  if(!video||video.tagName!=='VIDEO')return;
  const btn=video.nextElementSibling;
  if(video.paused){
    // Try to serve from cache first
    const cachedUrl=video.dataset.cached;
    if(!cachedUrl&&video.src){
      try{
        const cache=await caches.open(VIDEO_CACHE);
        const hit=await cache.match(video.src);
        if(hit){
          const blob=await hit.blob();
          const objUrl=URL.createObjectURL(blob);
          video.src=objUrl;
          video.dataset.cached='1';
        }
      }catch{}
    }
    video.play();
    if(btn)btn.style.display='none';
    video.onwaiting=()=>{if(btn){btn.style.display='flex';btn.textContent='⏳';}};
    video.onplaying=()=>{if(btn)btn.style.display='none';};
    video.onended=()=>{if(btn){btn.style.display='flex';btn.textContent='▶';}};
  }else{
    video.pause();
    if(btn){btn.style.display='flex';btn.textContent='▶';}
  }
}
function goView(v){view=v;openCtx=null;if(v==='add'){draftMedia.forEach(m=>{if(m.previewURL)URL.revokeObjectURL(m.previewURL)});draftMedia=[];selOct='everyday';showNameInput=false}if(v==='chat')markSeen();render();if(v==='chat')scrollChat()}
function setFilter(n){
  filter=n==='All'?null:(filter===n?null:n);
  const main=document.querySelector('.main');
  if(main)main.innerHTML=buildFeed();
  // Update pill active states without rebuilding them
  document.querySelectorAll('.pill').forEach(btn=>{
    const label=btn.textContent.trim();
    const isAll=label.startsWith('👪');
    const on=isAll?!filter:label===filter;
    btn.className='pill'+(on?' on':'');
  });
}
function setFull(id,mediaIdx){
  fullPost=id||null;
  if(typeof mediaIdx==='number'&&id)carouselIdx[id]=mediaIdx;
  const el=document.getElementById('fullscreen');
  if(!el)return;
  if(fullPost){
    const p=posts.find(p=>p.id===fullPost);
    el.className='fullscreen show';
    el.innerHTML=p?buildFullscreenInner(p):'';
  } else {
    el.className='fullscreen';
    el.innerHTML='';
  }
}
function openImgViewer(url){const el=document.getElementById('fullscreen');if(!el)return;el.className='fullscreen show';el.innerHTML=`<div class="fs-top"><button class="fs-close" onclick="document.getElementById('fullscreen').className='fullscreen'">✕ Close</button><button class="fs-save" onclick="saveImg(null,'${url}')">⬇ Save</button></div><img class="fs-img" src="${url}">`}
function confirmDel(id){openCtx=null;if(!confirm('Delete this moment?'))return;deletePost(id)}
function toggleCtx(id,e){
  e.stopPropagation();
  const prevId=openCtx;
  openCtx=openCtx===id?null:id;
  // Close whatever menu was open before (if different post)
  if(prevId&&prevId!==id){
    const prevMenu=document.getElementById('ctx-'+prevId);
    if(prevMenu)prevMenu.remove();
  }
  const card=document.getElementById('post-'+id);
  if(!card)return;
  const existing=document.getElementById('ctx-'+id);
  if(existing){existing.remove();return;} // was open for this post -> just closed it
  const p=posts.find(p=>p.id===id);if(!p)return;
  const hdr=card.querySelector('.card-hdr');
  if(hdr)hdr.insertAdjacentHTML('afterend',buildCtxMenu(p));
}
function closeCtx(){
  if(!openCtx)return;
  const menu=document.getElementById('ctx-'+openCtx);
  if(menu)menu.remove();
  openCtx=null;
}
function setupFeedListeners(){document.addEventListener('click',()=>{if(openCtx)closeCtx()},{once:true})}
function togglePin(id){pinnedPostId=pinnedPostId===id?null:id;lss('ayl_pinned',pinnedPostId||'');closeCtx();toast(pinnedPostId?'📌 Pinned to top':'📌 Unpinned')}
function copyCaption(id){const p=posts.find(p=>p.id===id);if(!p?.caption)return;navigator.clipboard?.writeText(p.caption).then(()=>toast('📋 Copied!'));closeCtx()}
function showFullDate(id){const p=posts.find(p=>p.id===id);if(p)toast(fullDate(p.created_at),3500)}
let lpTimer=null;
function saveImg(e,url){if(e)e.preventDefault();if(!url)return;const a=document.createElement('a');a.href=url;a.download='family-moment.jpg';a.target='_blank';document.body.appendChild(a);a.click();document.body.removeChild(a);toast('📥 Opening photo — hold to save',3000)}
function startLP(url,e){lpTimer=setTimeout(()=>{saveImg(null,url);vibrate(30)},600)}
function endLP(){clearTimeout(lpTimer)}
function openThemeSheet(){document.getElementById('themeOverlay')?.classList.add('show')}
function closeSheet(e){if(e.target.id==='themeOverlay')document.getElementById('themeOverlay')?.classList.remove('show')}
function setTheme(id){
  applyTheme(id);
  const grid=document.querySelector('.theme-grid');
  if(grid)grid.innerHTML=THEMES.map(t=>`<button class="theme-swatch" onclick="setTheme('${t.id}')">
    <div class="theme-circle${id===t.id?' active':''}" style="background:${t.bg};box-shadow:0 3px 10px rgba(0,0,0,.15)"><span style="font-size:18px">${t.e}</span></div>
    <div class="theme-name">${t.name}</div></button>`).join('')+`<button class="theme-swatch"><div class="theme-circle${id==='custom'?' active':''}" style="background:${ls('ayl_custom_pri','#C4622D')};box-shadow:0 3px 10px rgba(0,0,0,.15)"><span style="font-size:18px">🎨</span></div><div class="theme-name">Custom</div></button>`;
}
function applyCustomFromPicker(){
  const pri=document.getElementById('cpri')?.value||'#C4622D';
  const pri2=document.getElementById('cpri2')?.value||'#E8A87C';
  applyCustomColors(pri,pri2);
  toast('🎨 Custom theme applied!');
}
function setFS(s){applyFS(s);document.querySelectorAll('.size-step').forEach(b=>{b.className='size-step'+(b.dataset.s===s?' active':'');})}
function setupSheet(){document.querySelectorAll('.size-step').forEach((b,i)=>{b.dataset.s=['sm','md','lg'][i]})}

/* ══════════════════════════════════════════════════════
   FILE INPUTS
   ══════════════════════════════════════════════════════ */
document.getElementById('galleryIn').onchange=async function(){
  const files=[...this.files].slice(0,MAX_MEDIA-draftMedia.length);
  this.value='';
  for(const f of files){
    const dataURL=await compress(f);
    draftMedia.push({type:'photo',dataURL});
  }
  if(view!=='add')view='add';render();
};
document.getElementById('cameraIn').onchange=async function(){
  const f=this.files[0];this.value='';if(!f)return;
  if(draftMedia.length>=MAX_MEDIA)return;
  const dataURL=await compress(f);
  draftMedia.push({type:'photo',dataURL});
  if(view!=='add')view='add';render();
};
document.getElementById('videoIn').onchange=function(){
  const files=[...this.files].slice(0,MAX_MEDIA-draftMedia.length);
  this.value='';
  for(const f of files){
    if(!f.type.startsWith('video/')){toast('Please select a video file');continue;}
    draftMedia.push({type:'video',file:f,previewURL:URL.createObjectURL(f)});
  }
  if(view!=='add')view='add';render();
};
document.getElementById('commentImgIn').onchange=async function(){
  const f=this.files[0];if(!f||!commentImgTarget)return;
  const d=await compress(f,600);this.value='';
  if(!cmtDraft[commentImgTarget])cmtDraft[commentImgTarget]={text:'',photo:null,replyTo:null};
  cmtDraft[commentImgTarget].photo=d;repaintCmts(commentImgTarget);
};
document.getElementById('profilePicIn').onchange=async function(){
  const f=this.files[0];if(!f)return;draftProfilePic=await compress(f,400);this.value='';render();
};

/* ══════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════ */
init();
