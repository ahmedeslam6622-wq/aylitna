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
  migrateLocalProfilesToDB().then(()=>loadProfilesFromDB()).then(()=>{ nameColors={}; render(); });
  if(USE_SB){
    try{
      const{data}=await sb.from('posts').select('id,ai_tags').not('ai_tags','is',null);
      if(data)data.forEach(p=>{if(p.ai_tags?.length)postTags[p.id]=p.ai_tags});
    }catch(e){console.log('ai_tags fetch failed:',e)}
  }
  subscribeRealtime();
  if(myName){initNotifs();initPeer();}
  checkBirthdays();
  if('serviceWorker'in navigator){
  navigator.serviceWorker.register('sw.js').then(reg=>{
    reg.update(); // force an immediate check, bypassing the browser's default 24h throttle
    let refreshed=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(refreshed)return;refreshed=true;
      location.reload(); // new SW just took over — reload once to get fresh files immediately
    });
  }).catch(()=>{});
}
}

/* ══════════════════════════════════════════════════════
   MAIN RENDER
   ══════════════════════════════════════════════════════ */
function render(){
  const app=document.getElementById('app');
  if(!myName){renderOnboarding(app);return}
  // Capture the current slide position BEFORE the rebuild destroys it, so
  // the freshly-created slide can be placed there instantly (no transition)
  // before animating to its real target. Without this, render() replacing
  // #navBar's innerHTML creates a brand-new .nav-slide with no prior
  // transform set — it then animates FROM the CSS default (effectively
  // Home's position) instead of from wherever it actually was, which is
  // the "jumps to Home first" bug.
  const prevSlide=document.getElementById('navSlide');
  const prevSlideState=prevSlide&&prevSlide.style.opacity==='1'
    ?{transform:prevSlide.style.transform,width:prevSlide.style.width}
    :null;
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
  if(os==='ios'){
    if(prevSlideState){
      const newSlide=document.getElementById('navSlide');
      if(newSlide){
        newSlide.style.transition='none';
        newSlide.style.opacity='1';
        newSlide.style.width=prevSlideState.width;
        newSlide.style.transform=prevSlideState.transform;
        newSlide.offsetHeight; // force layout flush so the instant jump actually applies before re-enabling transition
        newSlide.style.transition='';
      }
    }
    requestAnimationFrame(()=>requestAnimationFrame(positionNavSlide));
  }
}

/* Toggles .hdr.scrolled when the scrollable .main area has scrolled past a
   small threshold. Re-attached every render() since .main is a fresh
   element each time (see innerHTML above). Style .hdr.scrolled in app.css —
   see the placeholder rule there. */

/* ══════════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════════ */
let hdrMenuOpen=false;
function buildHeader(newPosts){

   //MENU
  const prof=profiles[myName];
  const profImg=prof?.photo
    ?`<img src="${prof.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    :ICO_USER;
  return`<div class="glass-menu-wrap${hdrMenuOpen?' open':''}" id="glassMenu">
    <button class="glass-menu-btn" onclick="toggleHdrMenu()" aria-label="Menu">
      ${newPosts>0&&view==='feed'?`<span class="glass-menu-badge">${newPosts}</span>`:''}
      ${ICO_DOTS}
    </button>
    <div class="glass-menu-panel">
      <button class="glass-menu-item" onclick="toggleSearch();closeHdrMenu()">${ICO_SEARCH}<span>Search</span></button>
      <button class="glass-menu-item" onclick="goView('profile');closeHdrMenu()">
        <span class="glass-menu-item-av">${profImg}</span><span>Profile</span>
      </button>
      <button class="glass-menu-item" onclick="openThemeSheet();closeHdrMenu()">${ICO_THEME}<span>Theme</span></button>
    </div>
  </div>`;
}
function toggleHdrMenu(){
  hdrMenuOpen=!hdrMenuOpen;
  document.getElementById('glassMenu')?.classList.toggle('open',hdrMenuOpen);
}
function closeHdrMenu(){
  hdrMenuOpen=false;
  document.getElementById('glassMenu')?.classList.remove('open');
}
document.addEventListener('click',(e)=>{
  if(!hdrMenuOpen)return;
  const wrap=document.getElementById('glassMenu');
  if(wrap&&!wrap.contains(e.target))closeHdrMenu();
});

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
function repaintNav(){
  // Surgical update — only touch the unread badge, never destroy/rebuild
  // the whole nav. A full outerHTML replace here would tear down the
  // actual DOM buttons mid-tap whenever a message arrives in the
  // background (e.g. right as the phone unlocks and realtime catches
  // up), silently swallowing an in-progress touch.
  const totalUnread=unreadMsgs+Object.values(dmUnread).reduce((a,b)=>a+b,0);
  const chatBtn=document.querySelector('.nav-btn[data-view="chat"]');
  if(!chatBtn)return;
  const isChat=view==='chat';
  let badge=chatBtn.querySelector('.unread-badge');
  if(totalUnread>0&&!isChat){
    if(!badge){
      badge=document.createElement('span');
      badge.className='unread-badge';
      chatBtn.appendChild(badge);
    }
    badge.textContent=totalUnread;
  } else if(badge){
    badge.remove();
  }
}
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
function removeProfilePic(){const prof=getMyProfile();delete prof.photo;draftProfilePic=null;profiles[myName]=prof;saveProfilesLocal();saveProfileToDB(myName,prof);nameColors={};render();toast('Profile photo removed')}
async function saveProfile(){
  const newName=(document.getElementById('profileNameIn')?.value||'').trim()||myName;
  const bio=(document.getElementById('profileBioIn')?.value||'').trim();
  const bday=document.getElementById('profileBdayIn')?.value||'';
  const prof=getMyProfile();

  if(draftProfilePic){
    // New photo picked — upload it to Cloudinary (same simple flow as
    // post photos) instead of storing the raw base64 locally/in the DB.
    const upEl=document.getElementById('uploading');
    if(upEl)upEl.className='uploading-overlay show';
    const url=await uploadPhoto(draftProfilePic);
    if(upEl)upEl.className='uploading-overlay';
    if(!url){toast('❌ Profile photo failed to upload');return;}
    prof.photo=url;draftProfilePic=null;delete prof.colorIdx;delete prof.color;
  } else if(!prof.photo){
    prof.colorIdx=selProfileColor;prof.color=MC[selProfileColor];
  }
  prof.bio=bio;prof.birthday=bday;

  if(newName!==myName){
    profiles[newName]={...prof};delete profiles[myName];
    // Move the row in the DB too — write the new name, remove the old one.
    await saveProfileToDB(newName,prof);
    if(USE_SB){try{await sb.from('profiles').delete().eq('name',myName);}catch(e){console.log('old profile row cleanup failed:',e)}}
    myName=newName;lss('ayl_name',myName);
  } else {
    profiles[myName]=prof;
    await saveProfileToDB(myName,prof);
  }

  saveProfilesLocal();nameColors={};
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
  const rippleAttr=os==='android'?' onpointerdown="navRipple(event,this)"':'';
  return`<div class="nav" id="navBar">
    ${os==='ios'?`<div class="nav-slide" id="navSlide"></div>`:''}
    <button class="nav-btn" data-view="feed" onclick="goView('feed')"${rippleAttr}>
      <div class="nav-ico${isFeed?' active':''}">🏠</div><div class="nav-lbl${isFeed?' active':''}">Home</div>
    </button>
    <button class="nav-btn" data-view="chat" onclick="goView('chat');markSeen()" style="position:relative"${rippleAttr}>
      <div class="nav-ico${isChat?' active':''}">💬</div><div class="nav-lbl${isChat?' active':''}">Chat</div>
      ${totalUnread>0&&!isChat?`<span class="unread-badge">${totalUnread}</span>`:''}
    </button>
    <button class="fab" onclick="goView('add')"${rippleAttr}>＋</button>
    <button class="nav-btn" data-view="stats" onclick="goView('stats')"${rippleAttr}>
      <div class="nav-ico${isSt?' active':''}">📊</div><div class="nav-lbl${isSt?' active':''}">Stats</div>
    </button>
    <button class="nav-btn" data-view="members" onclick="goView('members')"${rippleAttr}>
      <div class="nav-ico${isMem?' active':''}">👨‍👩‍👧‍👦</div><div class="nav-lbl${isMem?' active':''}">Family</div>
    </button>
  </div>`;
}
/* ── iOS: sliding tab indicator ────────────────────────────────────────
   Positions .nav-slide under whichever .nav-btn matches the current view.
   Uses offsetLeft/offsetWidth (relative to #navBar, the nearest positioned
   ancestor) rather than getBoundingClientRect() — the browser computes
   that relative-to-parent offset natively, sidestepping any ambiguity
   between #navBar's padding box vs border box that raw viewport-relative
   rects can introduce. Retries via rAF if layout hasn't settled yet. */
function positionNavSlide(){
  if(os!=='ios')return;
  const nav=document.getElementById('navBar');
  const slide=document.getElementById('navSlide');
  if(!nav||!slide)return;
  const activeBtn=nav.querySelector('.nav-ico.active')?.closest('.nav-btn');
  if(!activeBtn){slide.style.opacity='0';return;}
  if(activeBtn.offsetWidth===0){requestAnimationFrame(positionNavSlide);return;}
  slide.style.opacity='1';
  slide.style.width=activeBtn.offsetWidth+'px';
  slide.style.transform=`translateX(${activeBtn.offsetLeft}px)`;
}
/* ── Android: ripple touch feedback ──────────────────────────────────
   Spawns a short-lived expanding circle from the exact tap point,
   matching Material Design's press feedback. Self-removing via
   animationend, so nothing accumulates in the DOM over time. */
function navRipple(e,btn){
  if(os!=='android')return;
  const rect=btn.getBoundingClientRect();
  const diameter=Math.max(rect.width,rect.height);
  const radius=diameter/2;
  const clientX=e.clientX??(rect.left+rect.width/2);
  const clientY=e.clientY??(rect.top+rect.height/2);
  const x=clientX-rect.left-radius;
  const y=clientY-rect.top-radius;
  const ripple=document.createElement('span');
  ripple.className='nav-ripple';
  ripple.style.width=ripple.style.height=diameter+'px';
  ripple.style.left=x+'px';
  ripple.style.top=y+'px';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
}

/* ══════════════════════════════════════════════════════
   FULLSCREEN + THEME SHEET
   ══════════════════════════════════════════════════════ */
function buildFullscreenInner(p){
  const o=getOct(p.oct);
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
function goView(v){view=v;openCtx=null;if(v==='add'){draftMedia.forEach(m=>{if(m.previewURL)URL.revokeObjectURL(m.previewURL)});draftMedia=[];selOct='everyday';showNameInput=false}if(v==='chat')markSeen();document.body.classList.toggle('chat-active',v==='chat');render();if(v==='chat')scrollChat()}
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

const VERIFY_PASSCODE_URL = 'https://ptpprauzusyrbrigfyji.supabase.co/functions/v1/verify-passcode';

async function isUnlocked() {
  if (!USE_SB) return true;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error || !data?.session) return false;
    const claim = data.session.user?.app_metadata?.unlocked;
    return claim === true;
  } catch (e) {
    console.log('isUnlocked check failed:', e);
    return false;
  }
}

async function checkPasscode(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, error: 'Incorrect password' };
  }
  try {
    const res = await fetch(VERIFY_PASSCODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!data.success) {
      return { ok: false, error: data.error || 'Incorrect password' };
    }

    const { error: setErr } = await sb.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    if (setErr) {
      console.log('setSession failed:', setErr);
      return { ok: false, error: 'Server error' };
    }

    return { ok: true };
  } catch (e) {
    console.log('checkPasscode failed:', e);
    return { ok: false, error: 'Server error' };
  }
}


// ══════════════════════════════════════════════════════
// PASSCODE GATE — robust boot (replaces the previous
// (async () => { isUnlocked... })() block entirely)
//
// Instead of checking isUnlocked() once at an arbitrary moment
// during load (which can race against Supabase restoring the
// session from localStorage), this listens for Supabase's own
// auth-state event — which fires reliably once the SDK has
// finished checking storage, whether that's fast or slow.
// ══════════════════════════════════════════════════════
function setupGate(){
  const input = document.getElementById('passcodeInput');
  const btn = document.getElementById('passcodeSubmit');
  const errorEl = document.getElementById('passcodeError');
  const card = document.querySelector('.gate-card');
  if (!input || !btn) return;

  async function attemptUnlock(){
    const password = input.value;
    if (!password){
      errorEl.textContent = 'Enter a passcode';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.classList.add('loading');
    errorEl.classList.remove('show');

    const result = await checkPasscode(password);

    btn.disabled = false;
    btn.classList.remove('loading');

    if (result.ok){
      // onAuthStateChange (below) picks this up via setSession() and
      // calls bootAppOnce() itself — nothing more to do here.
    } else {
      errorEl.textContent = result.error;
      errorEl.classList.add('show');
      input.value = '';
      input.focus();
      if (card){
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
    }
  }

  btn.addEventListener('click', attemptUnlock);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptUnlock();
  });
  input.addEventListener('input', () => {
    errorEl.classList.remove('show');
  });
}

function showGate(){
  const el = document.getElementById('gate');
  if (el) el.classList.remove('hidden');
  setTimeout(() => document.getElementById('passcodeInput')?.focus(), 100);
}
function hideGate(){
  const el = document.getElementById('gate');
  if (el) el.classList.add('hidden');
}

let appBooted = false;

function bootAppOnce(){
  if (appBooted) return;
  appBooted = true;
  hideGate();
  init();
}

setupGate();

if (USE_SB) {
  sb.auth.onAuthStateChange((event, session) => {
    const unlocked = session?.user?.app_metadata?.unlocked === true;
    if (unlocked) {
      bootAppOnce();
    } else if (!appBooted) {
      showGate();
    }
  });

  // onAuthStateChange fires INITIAL_SESSION once restoration finishes,
  // but as a safety net in case that event is ever missed or delayed
  // indefinitely, also fall back to showing the gate after a short
  // timeout if nothing has booted the app yet.
  setTimeout(() => {
    if (!appBooted) showGate();
  }, 2500);
} else {
  bootAppOnce();
}
