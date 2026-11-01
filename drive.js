// ============================================================================
// drive.js — optional "Sign in with Google": files a student's work into one
// Google Drive folder for them.
//
// This is a BONUS, never a requirement. Every tool works exactly as before
// without it: downloads still download, drafts still autosave to the browser.
// Signing in adds a copy of each in Drive, in the right folder, with the right
// name. If the district hasn't approved the app, or sign-in fails for any
// reason, students are back to the normal flow and nothing breaks.
//
// The only permission asked for is drive.file: access to files THIS SITE
// created, and nothing else in the student's Drive. That is also why folders
// are found by an appProperties tag rather than by name — the app can't see a
// folder it didn't make, and a student is free to rename or move ours.
//
//   DPEA Portfolio Data/
//     Drafts/                one autosaved draft per tool, photos included
//     Rotation Posts/        every downloaded post, filed by tool
//     Unit Posts/
//     Performance Reviews/
//     One-Pagers/
//
// There's no server, so no refresh token: Google hands the page an access token
// that lasts about an hour. It's kept in sessionStorage so moving between the
// hub and a tool doesn't ask again, and when it runs out the toolbar chip turns
// into a Reconnect button. Pending saves wait for that rather than failing.
//
// Pages: load after shared.js. The hub calls driveHub(); a generator calls
// driveTool({...}) at the END of its script, after its own draft has loaded.
// ============================================================================

const DRIVE_CLIENT_ID="735779264961-v8d8vurft4js0raujfbj21fpl32pr5vn.apps.googleusercontent.com";
const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
const DRIVE_API="https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD="https://www.googleapis.com/upload/drive/v3";
const DRIVE_FOLDER_MIME="application/vnd.google-apps.folder";
const DRIVE_ROOT_NAME="DPEA Portfolio Data";
// key -> folder name. The key is what's stored in each folder's appProperties,
// so these names can change without losing anyone's folders.
const DRIVE_FOLDERS={drafts:"Drafts",rotation:"Rotation Posts",unit:"Unit Posts",perf:"Performance Reviews",onepager:"One-Pagers"};
const DRIVE_STATE_KEY="dpea.drive.v1";      // localStorage: {email, folders:{root, drafts, ...}}
const DRIVE_TOKEN_KEY="dpea.drive.token";   // sessionStorage: {token, exp}
const DRIVE_MULTIPART_MAX=4*1024*1024;      // above this, upload in two steps (resumable)

// ---- availability -----------------------------------------------------------
// Google sign-in needs a real https origin registered on the OAuth client
// (portfolio.dpeacl.org, localhost:8000). A file:// page or the Google Sites
// embed (an iframe, where the sign-in popup is unreliable) just doesn't offer it.
function driveAvailable(){
  if(location.protocol==="file:")return false;
  try{if(window.top!==window.self)return false;}catch(e){return false;}
  return true;
}

// ---- remembered state --------------------------------------------------------
function driveState(){
  try{return JSON.parse(localStorage.getItem(DRIVE_STATE_KEY))||null;}catch(e){return null;}
}
function driveSaveState(s){
  try{
    if(s)localStorage.setItem(DRIVE_STATE_KEY,JSON.stringify(s));
    else localStorage.removeItem(DRIVE_STATE_KEY);
  }catch(e){}
}
// "Connected" means the student chose to sign in on this device. It stays true
// while the token is expired; that's a reconnect, not a sign-out.
function driveConnected(){return driveAvailable()&&!!driveState();}

function driveToken(){
  try{
    const t=JSON.parse(sessionStorage.getItem(DRIVE_TOKEN_KEY));
    if(t&&t.token&&t.exp>Date.now())return t.token;
  }catch(e){}
  return null;
}
function driveSetToken(token,expiresIn){
  try{
    if(!token){sessionStorage.removeItem(DRIVE_TOKEN_KEY);return;}
    // a minute's margin, so a save never starts on a token about to lapse
    sessionStorage.setItem(DRIVE_TOKEN_KEY,JSON.stringify({token,exp:Date.now()+((+expiresIn||3600)-60)*1000}));
  }catch(e){}
}

// ---- Google Identity Services ------------------------------------------------
// The sign-in popup must open inside the click that asked for it, or the
// browser blocks it. So the library is loaded up front on any page that might
// need it, and the click handler only ever calls requestAccessToken.
let driveGsiReady=null, driveClient=null, drivePending=null;
function driveLoadGsi(){
  if(driveGsiReady)return driveGsiReady;
  driveGsiReady=new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://accounts.google.com/gsi/client";
    s.async=true;
    s.onload=()=>{
      driveClient=google.accounts.oauth2.initTokenClient({
        client_id:DRIVE_CLIENT_ID,
        scope:DRIVE_SCOPE,
        callback:resp=>{
          const p=drivePending;drivePending=null;
          if(!p)return;
          if(resp.error||!google.accounts.oauth2.hasGrantedAllScopes(resp,DRIVE_SCOPE)){
            p.rej(new Error(resp.error||"no_drive_scope"));
            return;
          }
          driveSetToken(resp.access_token,resp.expires_in);
          p.res(resp.access_token);
        },
        error_callback:err=>{
          const p=drivePending;drivePending=null;
          if(p)p.rej(new Error((err&&err.type)||"popup_failed"));
        }
      });
      res();
    };
    s.onerror=()=>rej(new Error("gsi_load_failed"));
    document.head.appendChild(s);
  });
  return driveGsiReady;
}
// Call straight from a click handler. Resolves with an access token.
function driveRequestToken(){
  if(!driveClient)return Promise.reject(new Error("gsi_not_ready"));
  return new Promise((res,rej)=>{
    if(drivePending)drivePending.rej(new Error("superseded"));
    drivePending={res,rej};
    const st=driveState();
    // A returning student: hint their account so the popup is one tap.
    driveClient.requestAccessToken(st&&st.email?{prompt:"",hint:st.email,login_hint:st.email}:{});
  });
}
// What a student sees when sign-in doesn't work. The likeliest cause at a
// district school is that IT hasn't approved the app, so say that plainly and
// remind them nothing is lost.
function driveSignInMessage(e){
  const m=(e&&e.message)||"";
  if(m==="popup_closed")return "";
  if(m==="popup_failed_to_open")return "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.";
  if(m==="no_drive_scope")return "Google Drive access wasn't allowed, so there's nowhere to save. Sign in again and leave the Drive box checked.";
  if(m==="gsi_not_ready"||m==="gsi_load_failed")return "Google sign-in couldn't load. Check your connection and try again.";
  return "Google didn't allow sign-in. Your school may not have approved this yet. Everything still works without it.";
}

// ---- Drive REST --------------------------------------------------------------
class DriveAuthError extends Error{}
async function driveFetch(url,opts){
  const token=driveToken();
  if(!token)throw new DriveAuthError("signed_out");
  const o=opts||{};
  const r=await fetch(url,{...o,headers:{...(o.headers||{}),Authorization:"Bearer "+token}});
  if(r.status===401){driveSetToken(null);throw new DriveAuthError("expired");}
  if(!r.ok){
    let reason="";
    try{const j=await r.json();reason=(j.error&&j.error.errors&&j.error.errors[0]&&j.error.errors[0].reason)||(j.error&&j.error.message)||"";}catch(e){}
    const err=new Error(reason||("HTTP "+r.status));
    err.status=r.status;err.reason=reason;
    throw err;
  }
  return r;
}
async function driveJSON(url,opts){return (await driveFetch(url,opts)).json();}
// Drive query strings are single-quoted; escape backslashes and quotes.
const driveQ=s=>String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");

async function driveAbout(){
  return driveJSON(DRIVE_API+"/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)");
}

// Creates or updates one file. meta: {name, parents?, mimeType?, appProperties?}.
// Small files go up in one multipart request; big ones (a draft full of
// photos) take the two-step resumable route, which has no size ceiling.
async function driveUpload(fileId,meta,content,mime){
  const blob=content instanceof Blob?content:new Blob([content],{type:mime});
  const base=DRIVE_UPLOAD+"/files"+(fileId?"/"+fileId:"");
  const method=fileId?"PATCH":"POST";
  const fields="fields=id,name,modifiedTime,webViewLink";
  // An update can't re-send parents (that's a move), only the rest.
  const m={...meta};if(fileId)delete m.parents;
  if(blob.size<=DRIVE_MULTIPART_MAX){
    const b="dpea"+Math.random().toString(36).slice(2);
    const body=new Blob([
      `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(m)}\r\n`,
      `--${b}\r\nContent-Type: ${mime}\r\n\r\n`,blob,`\r\n--${b}--`
    ]);
    return driveJSON(`${base}?uploadType=multipart&${fields}`,{method,body,headers:{"Content-Type":"multipart/related; boundary="+b}});
  }
  const start=await driveFetch(`${base}?uploadType=resumable&${fields}`,{method,body:JSON.stringify(m),
    headers:{"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mime}});
  const loc=start.headers.get("Location");
  if(!loc)throw new Error("no upload session");
  return driveJSON(loc,{method:"PUT",body:blob,headers:{"Content-Type":mime}});
}

// ---- the folder ----------------------------------------------------------------
// Finds the app's folders (or makes them) and caches their ids. Verified once
// per browser session, so a folder the student trashed gets recreated rather
// than silently swallowing saves.
let driveFoldersReady=null;
function driveFolders(){
  if(!driveFoldersReady)driveFoldersReady=driveFindOrMakeFolders().catch(e=>{driveFoldersReady=null;throw e;});
  return driveFoldersReady;
}
async function driveFindOrMakeFolders(){
  const st=driveState()||{};
  try{
    const ok=JSON.parse(sessionStorage.getItem(DRIVE_STATE_KEY+".checked")||"null");
    if(ok&&st.folders&&ok===st.folders.root&&Object.keys(DRIVE_FOLDERS).every(k=>st.folders[k]))return st.folders;
  }catch(e){}
  // drive.file only ever lists folders this app made, so this is a short list.
  const q=`mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`;
  const r=await driveJSON(DRIVE_API+"/files?pageSize=100&fields=files(id,name,parents,appProperties)&q="+encodeURIComponent(q));
  const tagged={};
  (r.files||[]).forEach(f=>{const k=f.appProperties&&f.appProperties.dpea;if(k&&!tagged[k])tagged[k]=f;});
  const mk=(name,key,parent)=>driveJSON(DRIVE_API+"/files?fields=id,name,parents",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,mimeType:DRIVE_FOLDER_MIME,appProperties:{dpea:key},...(parent?{parents:[parent]}:{})})});
  const root=tagged.root||await mk(DRIVE_ROOT_NAME,"root",null);
  const folders={root:root.id};
  for(const k of Object.keys(DRIVE_FOLDERS)){
    folders[k]=(tagged[k]||await mk(DRIVE_FOLDERS[k],k,root.id)).id;
  }
  driveSaveState({...st,folders});
  try{sessionStorage.setItem(DRIVE_STATE_KEY+".checked",JSON.stringify(folders.root));}catch(e){}
  return folders;
}
async function driveFindFile(folderId,name){
  const q=`name='${driveQ(name)}' and '${folderId}' in parents and trashed=false`;
  const r=await driveJSON(DRIVE_API+"/files?pageSize=1&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&q="+encodeURIComponent(q));
  return (r.files||[])[0]||null;
}
// Save into one of our folders, replacing a file of the same name. Re-downloading
// a fixed post updates it in place instead of piling up copies; Drive's own
// version history keeps the earlier one if it's ever needed.
async function driveSaveFile(folderKey,name,content,mime,props){
  const folders=await driveFolders();
  const existing=await driveFindFile(folders[folderKey],name);
  return driveUpload(existing&&existing.id,{name,mimeType:mime,parents:[folders[folderKey]],
    appProperties:{dpea:folderKey,...(props||{})}},content,mime);
}
async function driveReadText(fileId){
  return (await driveFetch(DRIVE_API+"/files/"+fileId+"?alt=media")).text();
}
function driveFolderUrl(id){return "https://drive.google.com/drive/folders/"+id;}

// ---- shared styles -----------------------------------------------------------
function driveStyles(){
  if($("drive-styles"))return;
  const st=document.createElement("style");st.id="drive-styles";
  st.textContent=
`.drive-chip{display:inline-flex;align-items:center;gap:.3rem;font:600 .78rem/1.2 system-ui,-apple-system,sans-serif;color:#475569;
  background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:.3rem .65rem;white-space:nowrap}
.drive-chip.ok{color:#15803d;border-color:#bbf7d0;background:#f0fdf4}
.drive-chip.busy{color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff}
button.drive-chip{cursor:pointer}
button.drive-chip.warn{color:#9a3412;border-color:#fed7aa;background:#fff7ed}
.drive-banner{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin:.75rem 0;padding:.7rem .9rem;border-radius:10px;
  background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:.86rem}
.drive-banner button{font:inherit;font-weight:600;font-size:.8rem;border-radius:8px;padding:.35rem .7rem;cursor:pointer;border:1px solid #93c5fd;background:#fff;color:#1d4ed8}
.drive-banner button.primary{background:#2563eb;border-color:#2563eb;color:#fff}
.drive-banner .grow{flex:1;min-width:12rem}
.drive-list{margin:.75rem 0;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:.86rem;overflow:hidden}
.drive-list .dl-head{display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700}
.drive-list .dl-head button{margin-left:auto;font:inherit;font-size:.78rem;border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:.25rem .6rem;cursor:pointer}
.drive-list .dl-group{padding:.45rem .8rem .2rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.drive-list button.dl-item{display:flex;width:100%;gap:.6rem;align-items:baseline;text-align:left;font:inherit;background:none;border:0;
  border-top:1px solid #f1f5f9;padding:.55rem .8rem;cursor:pointer;color:#1e293b;border-radius:0}
.drive-list button.dl-item:hover{background:#f8fafc}
.drive-list .dl-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.drive-list .dl-when{flex:none;color:#64748b;font-size:.78rem}
.drive-list .dl-empty{padding:.7rem .8rem;color:#64748b}`;
  document.head.appendChild(st);
}
function driveWhen(iso){
  const d=new Date(iso);if(isNaN(d))return "";
  const same=d.toDateString()===new Date().toDateString();
  return same?d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})
    :d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})+", "+d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
}

// ============================================================================
// Generators
// ============================================================================
// cfg: {
//   tool:      "rotation" | "unit" | "onepager" — names the draft file
//   label:     "Rotation post" — shown to the student, and the draft's file name
//   draftKey:  the page's DRAFT_KEY (to tell whether this device has a draft)
//   posts:     folder key for this tool's downloads, also listed by Open from Drive
//   collect:   () => draft object (the page's collect())
//   openText:  (text) => opens a .json draft or a downloaded .html post; throws if it can't
// }
let driveCfg=null, driveChip=null;
let draftDirty=false, draftTimer=null, draftBusy=false, draftLastPush=0;
let draftHold=false;          // a newer Drive draft is on offer — don't overwrite it yet
let draftQuietUntil=0;        // just opened from Drive; the autosave that follows isn't an edit
const drivePendingPosts=[];   // posts downloaded while the token had lapsed

function driveDraftName(){return driveCfg.label+" draft.json";}
const driveLocalAtKey=()=>"dpea.drive.localAt."+driveCfg.tool;
function driveLocalAt(){try{return +localStorage.getItem(driveLocalAtKey())||0;}catch(e){return 0;}}
function driveSetLocalAt(t){try{localStorage.setItem(driveLocalAtKey(),String(t));}catch(e){}}

function driveTool(cfg){
  if(!driveConnected())return;
  driveCfg=cfg;
  driveStyles();
  driveLoadGsi().catch(()=>{});
  const bar=document.querySelector(".toolbar");
  if(bar){
    const open=document.createElement("button");
    open.className="btn alt";open.type="button";open.id="driveOpen";open.textContent="☁️ Open from Drive";
    open.onclick=driveToggleList;
    const load=$("loadBtn");
    if(load&&load.nextSibling)bar.insertBefore(open,load.nextSibling);else bar.appendChild(open);
    driveChip=document.createElement("span");
    bar.insertBefore(driveChip,$("autonote")||null);
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"&&draftDirty&&!draftHold){clearTimeout(draftTimer);drivePushDraft();}
  });
  if(!driveToken()){driveChipState("reconnect");return;}
  driveChipState("ok","☁️ Drive");
  driveCheckNewerDraft();
}

// The chip in the toolbar: what Drive is doing, or a Reconnect button.
function driveChipState(kind,text){
  if(!driveChip)return;
  if(kind==="reconnect"){
    const b=document.createElement("button");
    b.type="button";b.className="drive-chip warn";b.textContent="☁️ Reconnect Drive";
    b.title="Your Google sign-in timed out. Tap to keep saving to Drive.";
    b.onclick=driveReconnect;
    driveChip.replaceWith(b);driveChip=b;
    return;
  }
  if(driveChip.tagName==="BUTTON"){const s=document.createElement("span");driveChip.replaceWith(s);driveChip=s;}
  driveChip.className="drive-chip "+kind;
  driveChip.textContent=text;
}
async function driveReconnect(){
  try{
    await driveRequestToken();
  }catch(e){
    const m=driveSignInMessage(e);if(m)notify(m,"error");
    return;
  }
  driveChipState("ok","☁️ Drive");
  while(drivePendingPosts.length){const p=drivePendingPosts.shift();driveSavePost(p.folder,p.name,p.html);}
  if(draftDirty)drivePushDraft();
  else driveCheckNewerDraft();
}
function driveLapsed(e){
  if(e instanceof DriveAuthError){driveChipState("reconnect");return true;}
  return false;
}

// Called by shared.js autosave() after every local save.
function driveDraftChanged(){
  if(!driveCfg)return;
  driveSetLocalAt(Date.now());
  if(Date.now()<draftQuietUntil)return;
  draftDirty=true;
  if(draftHold)return;
  // Wait for a pause in typing, and never push more than every 15s: a draft
  // with photos can be several MB, and school wifi is shared.
  clearTimeout(draftTimer);
  draftTimer=setTimeout(drivePushDraft,Math.max(4000,15000-(Date.now()-draftLastPush)));
}
async function drivePushDraft(){
  if(!driveCfg||!draftDirty||draftHold)return;
  if(draftBusy){clearTimeout(draftTimer);draftTimer=setTimeout(drivePushDraft,2000);return;}
  if(!driveToken()){driveChipState("reconnect");return;}
  draftBusy=true;draftDirty=false;
  driveChipState("busy","☁️ Saving…");
  try{
    const f=await driveSaveFile("drafts",driveDraftName(),JSON.stringify(driveCfg.collect()),"application/json",{tool:driveCfg.tool});
    draftLastPush=Date.now();
    driveForgetCleared();
    driveSetLocalAt(Date.parse(f.modifiedTime)||Date.now());
    driveChipState("ok","☁️ Draft saved "+driveWhen(f.modifiedTime||new Date().toISOString()));
  }catch(e){
    draftDirty=true;
    if(!driveLapsed(e))driveChipState("busy","☁️ Drive save failed — retrying");
    if(!(e instanceof DriveAuthError)){clearTimeout(draftTimer);draftTimer=setTimeout(drivePushDraft,30000);}
    if(e.reason==="storageQuotaExceeded")notify("Your Google Drive is full, so your draft can't be saved there. It's still saved in this browser.","warn");
  }finally{
    draftBusy=false;
  }
}

// Called by a page's Clear button. Clear means "start a new post", so the Drive
// draft goes to the Drive trash (restorable for 30 days) — otherwise a reload
// would find no draft here and helpfully reopen the one just cleared. The time
// is remembered, so a clear made while signed out is honored after Reconnect.
const driveClearedAtKey=()=>"dpea.drive.clearedAt."+driveCfg.tool;
function driveClearedAt(){try{return +localStorage.getItem(driveClearedAtKey())||0;}catch(e){return 0;}}
// Forgotten as soon as it's handled — by the trash, or by a newer save — so a
// device clock running fast can never make it outrank real work.
function driveForgetCleared(){try{localStorage.removeItem(driveClearedAtKey());}catch(e){}}
async function driveDraftCleared(){
  if(!driveCfg)return;
  clearTimeout(draftTimer);draftDirty=false;draftHold=false;
  const banner=$("driveBanner");if(banner)banner.remove();
  const now=Date.now();
  try{localStorage.setItem(driveClearedAtKey(),String(now));}catch(e){}
  driveSetLocalAt(now);
  if(!driveToken())return;
  while(draftBusy)await new Promise(r=>setTimeout(r,300));   // let an in-flight save land first
  try{await driveTrashDraft();}catch(e){driveLapsed(e);}
}
async function driveTrashDraft(){
  const folders=await driveFolders();
  const f=await driveFindFile(folders.drafts,driveDraftName());
  if(f)await driveFetch(DRIVE_API+"/files/"+f.id,{method:"PATCH",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({trashed:true})});
  driveForgetCleared();
  driveChipState("ok","☁️ Drive draft cleared");
}

// On load: is there a newer draft in Drive than on this device? On a device
// with no draft at all, just open it. Otherwise ask, and hold off saving over
// it until the student decides — or a stale draft here would overwrite the
// newer one there the moment they typed.
async function driveCheckNewerDraft(){
  try{
    const folders=await driveFolders();
    const f=await driveFindFile(folders.drafts,driveDraftName());
    if(!f)return;
    const remoteAt=Date.parse(f.modifiedTime)||0;
    // Cleared since this draft was saved (e.g. while signed out): finish the job.
    if(remoteAt<=driveClearedAt()){await driveTrashDraft();return;}
    let hasLocal=false;try{hasLocal=!!localStorage.getItem(driveCfg.draftKey);}catch(e){}
    if(hasLocal&&remoteAt<=driveLocalAt()+5000)return;
    if(!hasLocal){await driveOpenFile(f,true);return;}
    draftHold=true;
    driveBanner(`Your Drive has a newer draft of this ${driveCfg.label.toLowerCase()}, saved ${driveWhen(f.modifiedTime)}.`,[
      {label:"Open it",primary:true,run:async()=>{draftHold=false;draftDirty=false;await driveOpenFile(f,true);}},
      {label:"Keep this one",run:()=>{draftHold=false;driveSetLocalAt(Date.now());if(draftDirty)drivePushDraft();}}
    ]);
  }catch(e){
    if(!driveLapsed(e))console.warn("Drive draft check failed",e);
  }
}
function driveBanner(text,actions){
  const old=$("driveBanner");if(old)old.remove();
  const b=document.createElement("div");b.className="drive-banner";b.id="driveBanner";
  const t=document.createElement("span");t.className="grow";t.textContent="☁️ "+text;b.appendChild(t);
  actions.forEach(a=>{
    const btn=document.createElement("button");btn.type="button";btn.textContent=a.label;
    if(a.primary)btn.className="primary";
    btn.onclick=async()=>{b.remove();await a.run();};
    b.appendChild(btn);
  });
  const bar=document.querySelector(".toolbar");
  if(bar)bar.after(b);else document.body.prepend(b);
}
async function driveOpenFile(f,isDraft){
  try{
    const txt=await driveReadText(f.id);
    draftQuietUntil=Date.now()+2500;
    driveCfg.openText(txt);
    // Keep the browser's copy in step, so a reload shows what was just opened.
    if(typeof autosave==="function")autosave();
    driveSetLocalAt(Date.parse(f.modifiedTime)||Date.now());
    notify(isDraft?`Opened your draft from Drive (saved ${driveWhen(f.modifiedTime)}).`:`Opened ${f.name} from Drive.`,"info");
  }catch(e){
    if(driveLapsed(e))notify("Your Google sign-in timed out. Tap ☁️ Reconnect Drive, then try again.","warn");
    else notify("Couldn't open that file from Drive.","error");
  }
}

// "Open from Drive": this tool's draft and its downloaded posts, newest first.
async function driveToggleList(){
  const old=$("driveList");if(old){old.remove();return;}
  if(!driveToken()){driveChipState("reconnect");notify("Your Google sign-in timed out. Tap ☁️ Reconnect Drive first.","warn");return;}
  const box=document.createElement("div");box.className="drive-list";box.id="driveList";
  box.innerHTML=`<div class="dl-head">☁️ Open from your DPEA Portfolio Data folder<button type="button">Close</button></div><div class="dl-empty">Loading…</div>`;
  box.querySelector(".dl-head button").onclick=()=>box.remove();
  const bar=document.querySelector(".toolbar");
  if(bar)bar.after(box);else document.body.prepend(box);
  try{
    const folders=await driveFolders();
    const list=async id=>(await driveJSON(DRIVE_API+"/files?pageSize=50&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&q="+
      encodeURIComponent(`'${id}' in parents and trashed=false`))).files||[];
    const [drafts,posts]=await Promise.all([list(folders.drafts),list(folders[driveCfg.posts])]);
    const mine=drafts.filter(f=>f.name===driveDraftName());
    box.querySelector(".dl-empty").remove();
    const group=(title,files,isDraft)=>{
      const g=document.createElement("div");g.className="dl-group";g.textContent=title;box.appendChild(g);
      if(!files.length){const e=document.createElement("div");e.className="dl-empty";e.textContent="Nothing here yet.";box.appendChild(e);return;}
      files.forEach(f=>{
        const b=document.createElement("button");b.type="button";b.className="dl-item";
        b.innerHTML=`<span class="dl-name"></span><span class="dl-when"></span>`;
        b.querySelector(".dl-name").textContent=f.name;
        b.querySelector(".dl-when").textContent=driveWhen(f.modifiedTime);
        b.onclick=async()=>{box.remove();draftHold=false;const banner=$("driveBanner");if(banner)banner.remove();await driveOpenFile(f,isDraft);};
        box.appendChild(b);
      });
    };
    group("Draft",mine,true);
    group(DRIVE_FOLDERS[driveCfg.posts],posts,false);
  }catch(e){
    box.remove();
    if(driveLapsed(e))notify("Your Google sign-in timed out. Tap ☁️ Reconnect Drive first.","warn");
    else notify("Couldn't list your Drive folder.","error");
  }
}

// Call right after downloadBlob() with the same name and contents. Does nothing
// for a student who never signed in.
async function driveSavePost(folderKey,name,html){
  if(!driveCfg)return;
  if(!driveToken()){
    drivePendingPosts.push({folder:folderKey,name,html});
    driveChipState("reconnect");
    notify("Downloaded. To also save it to Drive, tap ☁️ Reconnect Drive.","warn");
    return;
  }
  driveChipState("busy","☁️ Saving…");
  try{
    await driveSaveFile(folderKey,name,html,"text/html",{tool:driveCfg.tool});
    driveChipState("ok","☁️ Saved to Drive");
    notify(`Saved a copy to Drive › ${DRIVE_ROOT_NAME} › ${DRIVE_FOLDERS[folderKey]}.`,"info");
  }catch(e){
    if(driveLapsed(e)){drivePendingPosts.push({folder:folderKey,name,html});return;}
    driveChipState("busy","☁️ Drive save failed");
    notify(e.reason==="storageQuotaExceeded"
      ?"Your Google Drive is full, so this post wasn't saved there. Your download worked."
      :"Couldn't save this post to Drive. Your download worked.","warn");
  }
}

// ============================================================================
// Hub
// ============================================================================
// A card under the tiles: a sign-in button, or who's signed in with a link to
// the folder. Lives in #driveCard, which the hub shows alongside the tiles.
function driveHub(){
  const card=$("driveCard");
  if(!card)return;
  if(!driveAvailable()){card.remove();return;}
  driveStyles();
  driveLoadGsi().then(()=>driveHubPaint()).catch(()=>{});
  driveHubPaint();
  if(driveConnected()&&driveToken())driveHubRefresh();
}
function driveHubPaint(msg){
  const card=$("driveCard"), st=driveState();
  if(!card)return;
  const btn=(id,label,cls)=>`<button type="button" class="${cls||"btn"}" id="${id}">${label}</button>`;
  if(!st){
    card.innerHTML=`<div class="dc-top"><span class="dc-title">☁️ Keep your work organized in Google Drive</span><span class="dc-opt">Optional</span></div>
      <p>Sign in with your school Google account and we'll make one folder, <strong>${DRIVE_ROOT_NAME}</strong>, and file your drafts and downloaded posts into it for you, named and sorted. This site can only see the files it creates. Nothing else in your Drive.</p>
      <div class="dc-actions">${btn("driveSignIn","Sign in with Google")}</div>`;
  }else{
    const live=!!driveToken(), f=st.folders||{};
    card.innerHTML=`<div class="dc-top"><span class="dc-title">☁️ Saving to Google Drive</span></div>
      <p>Signed in as <strong></strong>. Drafts save to your <strong>${DRIVE_ROOT_NAME}</strong> folder as you work, and each download is filed there too.</p>
      <div class="dc-actions">
        ${f.root?`<a class="dc-link" href="${driveFolderUrl(f.root)}" target="_blank" rel="noopener">Open my folder ↗</a>`:""}
        ${live?"":btn("driveSignIn","Reconnect","btn")}
        ${btn("driveSignOut","Sign out","dc-ghost")}
      </div>`;
    card.querySelector("p strong").textContent=st.email||"your Google account";
  }
  if(msg){const p=document.createElement("p");p.className="dc-msg "+(msg.type||"");p.textContent=msg.text;card.appendChild(p);}
  const si=$("driveSignIn");
  if(si){
    si.disabled=!driveClient;
    si.onclick=async()=>{
      try{await driveRequestToken();}
      catch(e){const m=driveSignInMessage(e);driveHubPaint(m?{type:"error",text:m}:null);return;}
      await driveHubRefresh(true);
    };
  }
  const so=$("driveSignOut");
  if(so)so.onclick=()=>{
    const t=driveToken();
    if(t&&window.google&&google.accounts)google.accounts.oauth2.revoke(t,()=>{});
    driveSetToken(null);driveSaveState(null);driveFoldersReady=null;
    try{sessionStorage.removeItem(DRIVE_STATE_KEY+".checked");}catch(e){}
    driveHubPaint({type:"",text:"Signed out. Your folder and everything in it stay in your Drive."});
  };
}
// After sign-in (or on a visit with a live token): who is this, make sure the
// folder exists, and warn if their Drive is nearly full.
async function driveHubRefresh(justSignedIn){
  try{
    const about=await driveAbout();
    driveSaveState({...(driveState()||{}),email:about.user&&about.user.emailAddress});
    await driveFolders();
    let msg=justSignedIn?{type:"ok",text:"You're set. Your drafts and posts will save to Drive from now on."}:null;
    const q=about.storageQuota||{}, lim=+q.limit, used=+q.usage;
    if(lim&&used/lim>=0.9){
      msg={type:"error",text:`Your Google Drive is ${Math.floor(used/lim*100)}% full. Photos take a lot of room, so saves may start failing. Clear out space or talk to your teacher.`};
    }
    driveHubPaint(msg);
  }catch(e){
    if(e instanceof DriveAuthError){driveHubPaint();return;}
    driveHubPaint({type:"error",text:"Signed in, but couldn't reach Google Drive. Try again in a minute."});
  }
}
