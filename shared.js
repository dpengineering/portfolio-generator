// ============================================================================
// shared.js — infrastructure shared by both generators (index.html + unit.html)
//
// Loaded via <script src="shared.js?v=N"> BEFORE each page's own inline script,
// so these top-level declarations are visible to the page code that follows.
// Bump the ?v= number in BOTH html files whenever this file changes, so that
// district iPads (Safari) fetch the new version without needing a hard refresh.
//
// NOTE: nothing here ends up in a *downloaded* portfolio — buildHTML() still
// inlines every string/image into the self-contained output. This file only
// runs inside the generator.
// ============================================================================

// DPEA logo (base64 PNG) for the post cover overlay — injected at build time.
const DPEA_LOGO="data:image/png;base64,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";
const $=id=>document.getElementById(id);
const val=id=>$(id).value.trim();
let weekCount=0;

const esc=s=>(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
// *word* (or *a phrase*) becomes a light-blue key term. Runs after esc, so the
// term text is already HTML-safe; requires non-space just inside the asterisks
// so stray "*" (bullets, "3 * 5") don't accidentally match.
const keyTerms=h=>h.replace(/\*(\S(?:[^*\n]*\S)?)\*/g,'<span class="key">$1</span>');
const paras=t=>keyTerms(esc(t)).trim().split(/\n\s*\n/).filter(Boolean).map(p=>"<p>"+p.replace(/\n/g,"<br>")+"</p>").join("\n");

function uid(){weekCount++;return "w"+weekCount+"_"+(performance.now()|0);}

function countWords(t){const m=(t||"").trim().match(/[A-Za-z0-9][A-Za-z0-9'-]*/g);return m?m.length:0;}

// ---- image handling (downscale to keep file sizes sane; convert HEIC) ----
const HEIC_RE=/\.(heic|heif)$/i;
function isHeic(file){
  const t=(file.type||"").toLowerCase();
  return t==="image/heic"||t==="image/heif"||HEIC_RE.test(file.name||"");
}
function isGif(file){return (file.type||"").toLowerCase()==="image/gif"||/\.gif$/i.test(file.name||"");}
// An animated GIF has more than one Graphic Control Extension block (21 F9 04).
function isAnimatedGif(buffer){
  const a=new Uint8Array(buffer);let n=0;
  for(let i=0;i<a.length-3;i++){
    if(a[i]===0x21&&a[i+1]===0xF9&&a[i+2]===0x04){if(++n>1)return true;}
  }
  return false;
}
function blobToDataURL(blob){
  return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob);});
}
// iPhone/iPad photos are often HEIC. Safari can decode them natively; other
// browsers can't, so convert to JPEG first with the bundled heic2any.
async function toRenderable(file){
  if(isHeic(file)&&typeof window.heic2any==="function"){
    const out=await window.heic2any({blob:file,toType:"image/jpeg",quality:0.9});
    return Array.isArray(out)?out[0]:out;   // a JPEG Blob
  }
  return file;
}
const GIF_WARN_MB=5;
// Returns an image object, or null if the student declines a large GIF.
async function readImage(file){
  const blob=await toRenderable(file);      // may throw → caller shows a message
  // Animated GIFs must skip the canvas re-encode (it keeps only the first
  // frame). Embed the original bytes so the animation survives in the page.
  if(isGif(file)&&isAnimatedGif(await blob.arrayBuffer())){
    const mb=blob.size/1048576;
    if(mb>GIF_WARN_MB&&!confirm(`That animated GIF is ${mb.toFixed(1)} MB and gets embedded at full size, which makes your portfolio large and slow to open. Add it anyway?`))
      return null;
    return {name:file.name,caption:"",dataUrl:await blobToDataURL(blob)};
  }
  return await new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=1400;let{width:w,height:h}=img;
        if(w>max||h>max){const s=Math.min(max/w,max/h);w=Math.round(w*s);h=Math.round(h*s);}
        const c=document.createElement("canvas");c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res({name:file.name,caption:"",dataUrl:c.toDataURL("image/jpeg",0.82)});
      };
      img.onerror=()=>rej(new Error("decode failed"));img.src=fr.result;
    };
    fr.onerror=rej;fr.readAsDataURL(blob);
  });
}
function imgError(file){
  const n=file&&file.name?` "${file.name}"`:"";
  alert(`Sorry, that image${n} couldn't be added.\n\nIf it's an iPhone/iPad HEIC photo it should convert automatically — try once more. Otherwise, export it as a JPG or PNG and re-upload.`);
}

function wireDrop(el,onFiles){
  const run=async files=>{
    if(!files||!files.length)return;
    const prev=el.textContent;el.classList.add("busy");
    el.textContent="Adding photos… (HEIC may take a few seconds)";
    try{await onFiles(files);}finally{el.classList.remove("busy");el.textContent=prev;}
  };
  el.addEventListener("click",()=>{
    const inp=document.createElement("input");inp.type="file";inp.accept="image/*,.heic,.heif";inp.multiple=true;
    inp.onchange=()=>run([...inp.files]);inp.click();
  });
  el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("over");});
  el.addEventListener("dragleave",()=>el.classList.remove("over"));
  el.addEventListener("drop",e=>{e.preventDefault();el.classList.remove("over");
    run([...e.dataTransfer.files].filter(f=>f.type.startsWith("image/")||isHeic(f)));});
}

// ---- sentence-starter engine (the STARTERS phrase lists stay per-page) ----
// Rotation timing (tweak freely): FADE_MS = crossfade length; ROTATE_MS = how long
// each suggestion stays before changing; boxes are spread across STAGGER_SLOTS ticks
// so the boxes never change at the same moment.
const FADE_MS=500, ROTATE_MS=12000, STAGGER_SLOTS=3;
let _starterCount=0;   // assigns each starter bar a distinct stagger phase
function showStarter(bar,fade){
  const el=bar.querySelector(".starter-text"), txt=bar._list[+bar.dataset.idx];
  if(fade){el.style.opacity="0";setTimeout(()=>{el.textContent=txt;el.style.opacity="1";},FADE_MS);}
  else{el.textContent=txt;el.style.opacity="1";}
}
function advanceStarter(bar,dir){const n=bar._list.length;bar.dataset.idx=((+bar.dataset.idx)+(dir||1)+n)%n;showStarter(bar,true);}
function randomStarter(bar){const n=bar._list.length;if(n>1){let j;do{j=Math.floor(Math.random()*n);}while(j===(+bar.dataset.idx));bar.dataset.idx=j;}showStarter(bar,true);}
function insertAtCaret(ta,text){
  const s=ta.selectionStart??ta.value.length, e=ta.selectionEnd??ta.value.length;
  ta.value=ta.value.slice(0,s)+text+ta.value.slice(e);
  ta.selectionStart=ta.selectionEnd=s+text.length;
  ta.focus();ta.dispatchEvent(new Event("input",{bubbles:true}));
}
function wireStarter(ta,bar,list,seed){
  if(!ta||!bar||!list||!list.length)return;
  bar.innerHTML='<span class="starter-label">💡 Try:</span>'+
    '<button type="button" class="starter-text" title="Click to insert this starter"></button>'+
    '<button type="button" class="starter-nav starter-prev" title="Previous suggestion" aria-label="Previous suggestion">‹</button>'+
    '<button type="button" class="starter-nav starter-next" title="Next suggestion" aria-label="Next suggestion">›</button>'+
    '<button type="button" class="starter-nav starter-rand" title="Random suggestion" aria-label="Random suggestion">🎲</button>';
  bar._ta=ta;bar._list=list;
  bar.dataset.phase=(_starterCount++)%STAGGER_SLOTS;   // stagger so bars don't rotate in unison
  bar.dataset.idx=((seed%list.length)+list.length)%list.length;
  showStarter(bar,false);
  bar.querySelector(".starter-text").onclick=()=>insertAtCaret(ta,list[+bar.dataset.idx]);
  bar.querySelector(".starter-prev").onclick=()=>advanceStarter(bar,-1);
  bar.querySelector(".starter-next").onclick=()=>advanceStarter(bar,1);
  bar.querySelector(".starter-rand").onclick=()=>randomStarter(bar);
}
// Rotate suggestions on a slow tick, staggered so the boxes change at different
// times (one per tick), and never change a box being edited or hovered.
let _starterTick=0;
setInterval(()=>{
  _starterTick++;
  document.querySelectorAll(".starter").forEach(bar=>{
    if((+bar.dataset.phase)!==(_starterTick%STAGGER_SLOTS))return;
    if(bar.matches(":hover"))return;              // hold still while the mouse is over the starter
    if(bar._ta!==document.activeElement)advanceStarter(bar);
  });
},ROTATE_MS/STAGGER_SLOTS);

// ---- downloaded-post stylesheet (shared base + per-page theme) ----
// t = {accent, gradFrom, gradTo, overlay}; extra = optional page-specific CSS
// (e.g. the unit generator's rubric / file-management rules) inserted before
// the footer. This string is inlined into every self-contained post.
function postCSS(t, extra){
  return `
:root{--accent:${t.accent};--ink:#1e293b;--muted:#64748b;--bg:#fff;--border:#e2e8f0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.65}
.cover{position:relative;margin-bottom:2.5rem}
.cover .banner{height:300px;background:linear-gradient(120deg,${t.gradFrom},${t.gradTo})}
.cover img{display:block;width:100%;max-height:460px;object-fit:cover}
.cover-text{position:absolute;left:0;bottom:0;width:100%;padding:2rem 1.5rem 1.25rem;background:linear-gradient(to top,${t.overlay},transparent);color:#fff;font-family:system-ui,sans-serif}
.cover-text h1{font-size:clamp(1.8rem,5vw,3rem);margin:0}
.subtitle{margin:.3rem 0 0;font-size:1.05rem;opacity:.92}
.cover-logo{position:absolute;z-index:2;display:block;height:auto}
.cover-logo.hero{top:46%;left:50%;transform:translate(-50%,-50%);width:168px}
.cover-logo.badge{top:1rem;right:1rem;width:78px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}
main{max-width:860px;margin:0 auto;padding:0 1.25rem}
section{margin-bottom:3.5rem}
h2{font-family:system-ui,sans-serif;font-size:1.5rem;color:rgb(25,25,25);border-bottom:2px solid var(--border);padding-bottom:.4rem;margin-bottom:1rem}
p{margin:0 0 1.25rem}
.key{color:rgb(0,67,250);font-weight:600}
.gallery{display:grid;gap:1rem;margin:1.5rem 0;grid-template-columns:repeat(2,1fr)}
figure{margin:0}
figure img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--border)}
figcaption{font-family:system-ui,sans-serif;font-size:.85rem;color:var(--muted);margin-top:.5rem;font-style:italic}
pre{background:#0f172a;color:#e2e8f0;padding:1.1rem 1.25rem;border-radius:10px;overflow-x:auto;font-size:.9rem;line-height:1.5}
code{font-family:"SF Mono",Consolas,monospace}
${extra||""}footer{max-width:860px;margin:2rem auto 3rem;padding:1.25rem;border-top:1px solid var(--border);font-family:system-ui,sans-serif;font-size:.9rem;color:var(--muted);text-align:center}
@media (max-width:640px){body{font-size:16px}.gallery{grid-template-columns:1fr}.cover-logo.hero{width:132px}.cover-logo.badge{width:62px}}
`;
}

// ---- cover header for the downloaded post (banner-or-photo + DPEA logo + text) ----
// The logo sits centered on the gradient ("hero") or as a small corner badge over
// an uploaded cover ("badge"). It is omitted entirely for personal projects.
function coverHeader(d, name, sub){
  const cover=d.cover?`<img src="${d.cover}" alt="Cover image">`:`<div class="banner"></div>`;
  const logo=(d.meta&&d.meta.personal)?"":`<img class="cover-logo ${d.cover?"badge":"hero"}" src="${DPEA_LOGO}" alt="DPEA logo">`;
  return `<header class="cover">
${cover}${logo?"\n"+logo:""}
<div class="cover-text">
<h1>${esc(name)}</h1>
<p class="subtitle">${sub}</p>
</div>
</header>`;
}

// ---- draft persistence ----
// downloadBlob triggers a file download. autosave persists collect() to
// localStorage; each page sets its own DRAFT_KEY and provides collect().
function downloadBlob(filename,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
let autoTimer=null;
function autosave(){
  clearTimeout(autoTimer);
  autoTimer=setTimeout(()=>{
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(collect()));
      $("autonote").textContent="✓ saved in this browser";
      setTimeout(()=>$("autonote").textContent="",1500);}catch(e){}
  },600);
}
