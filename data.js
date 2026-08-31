/* ══════════════════════════════════════════════════════
   DATA.JS
   Everything that talks to Supabase, Cloudinary, push
   notifications, or the PeerJS call system. If you're
   changing HOW data is loaded/saved, or how calls connect,
   it goes here — not how it's displayed.
   Loaded SECOND — depends on config.js.
   ══════════════════════════════════════════════════════ */

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
  try{
    const{data}=await sb.from('post_views').select('post_id,viewer').in('post_id',ids);
    if(!data)return;
    data.forEach(r=>{if(!seenBy[r.post_id])seenBy[r.post_id]=[];if(!seenBy[r.post_id].includes(r.viewer))seenBy[r.post_id].push(r.viewer)});
    lssj('ayl_seen_by',seenBy);
  }catch(e){console.log('seenBy fetch failed:',e)}
}
async function markSeenBy(){
  if(!myName||!posts.length)return;
  posts.slice(0,8).forEach(p=>{if(!seenBy[p.id])seenBy[p.id]=[];if(!seenBy[p.id].includes(myName))seenBy[p.id].push(myName)});
  lssj('ayl_seen_by',seenBy);
  if(!USE_SB)return;
  const rows=posts.slice(0,8).map(p=>({post_id:p.id,viewer:myName}));
  try{await sb.from('post_views').upsert(rows,{onConflict:'post_id,viewer',ignoreDuplicates:true})}catch(e){console.log('markSeenBy failed:',e)}
}

/* ══════════════════════════════════════════════════════
   PROFILES
   Synced via Supabase `profiles` table (photo/bio/birthday/color),
   so every family member sees everyone else's profile correctly —
   not just the person who set it. localStorage is kept as an
   instant-display cache (so the UI isn't blank on load) but
   Supabase is now the source of truth once a fetch completes.
   ══════════════════════════════════════════════════════ */
function loadProfiles(){profiles=lsj('ayl_profiles',{});} // instant local cache, may be stale
async function loadProfilesFromDB(){
  if(!USE_SB)return;
  try{
    const{data,error}=await sb.from('profiles').select('*');
    if(error||!data)return;
    const fresh={};
    data.forEach(row=>{
      fresh[row.name]={
        photo:row.photo||undefined,
        bio:row.bio||undefined,
        birthday:row.birthday||undefined,
        colorIdx:row.color_idx??undefined,
        color:row.color_idx!=null?MC[row.color_idx]:undefined,
      };
    });
    profiles=fresh;
    saveProfilesLocal(); // refresh the local cache to match
  }catch(e){console.log('loadProfilesFromDB failed:',e)}
}
function saveProfilesLocal(){lssj('ayl_profiles',profiles);}
// One-time migration: if this device has a local profile from before the
// DB existed, push it up so it isn't silently lost the first time
// loadProfilesFromDB() overwrites the local `profiles` object.
async function migrateLocalProfilesToDB(){
  if(!USE_SB)return;
  const local=lsj('ayl_profiles',{});
  for(const[name,prof]of Object.entries(local)){
    if(!prof)continue;
    try{
      const{data}=await sb.from('profiles').select('name').eq('name',name).maybeSingle();
      if(!data)await saveProfileToDB(name,prof); // only push if not already in the DB
    }catch(e){console.log('profile migration check failed for',name,e)}
  }
}
async function saveProfileToDB(name,prof){
  if(!USE_SB)return;
  try{
    await sb.from('profiles').upsert({
      name,
      photo:prof.photo||null,
      bio:prof.bio||null,
      birthday:prof.birthday||null,
      color_idx:prof.colorIdx??null,
      updated_at:new Date().toISOString(),
    },{onConflict:'name'});
  }catch(e){console.log('saveProfileToDB failed:',e)}
}
// Legacy name kept so any other call sites (if present) still work —
// now just updates the local cache; DB writes happen via saveProfileToDB.
function saveProfiles(){saveProfilesLocal();}
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
    if(USE_SB&&tags.length)await sb.from('posts').update({ai_tags:tags}).eq('id',postId);
  }catch{postTags[postId]=[]}
  repaintAiTags(postId);
}

/* ══════════════════════════════════════════════════════
   REALTIME
   ══════════════════════════════════════════════════════ */
let realtimeChannels={posts:null,msgs:null,cmts:null,profiles:null};
let realtimeResubTimers={posts:null,msgs:null,cmts:null,profiles:null};

function subscribeRealtime(){
  if(!USE_SB)return;
  subscribePostsChannel();
  subscribeMsgsChannel();
  subscribeCmtsChannel();
  subscribeProfilesChannel();
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
/* Profile changes from other family members (photo/bio/birthday/color) —
   refetch the whole table on any change and refresh whatever's currently
   on screen, same blunt-but-safe approach the other channels use. */
function subscribeProfilesChannel(){
  if(realtimeChannels.profiles){try{sb.removeChannel(realtimeChannels.profiles)}catch{}}
  realtimeChannels.profiles=sb.channel('profiles-'+Date.now()).on('postgres_changes',
    {event:'*',schema:'public',table:'profiles'},async()=>{
      await loadProfilesFromDB();
      nameColors={};
      render();
    }
  ).subscribe(status=>{
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
      clearTimeout(realtimeResubTimers.profiles);
      realtimeResubTimers.profiles=setTimeout(subscribeProfilesChannel,1500);
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
