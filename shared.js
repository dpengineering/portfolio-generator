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
