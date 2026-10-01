// ============================================================================
// perfreview.js — the weekly performance review, for grade 12 only.
//
// Loaded by weekly.html AFTER shared.js and BEFORE the page's own script, so it
// can use shared.js's helpers ($, val, esc, paras, notify, downloadBlob,
// coverHeader) and weekly.html's gallery() at call time.
//
// Seniors fill this in alongside their rotation post and download two files:
// the post itself, and this submission, which embeds the post. Before the
// merge the student had to download the post and re-upload it here; now the
// data is handed over in memory.
//
// Everything is prefixed PR_/pr so nothing collides with the generator's own
// globals. The rubric, weights and artifact CSS are ported verbatim from the
// standalone review.html.
//
// Bump the ?v= on BOTH this file and shared.js in weekly.html when either
// changes, so district iPads (Safari) refetch them.
// ============================================================================

// ===== Rubric definition (single source of truth) ====================
// Numbered 1-12 in display order: Performance Review leads (next to the
// portfolio content it assesses), then Productive, then Counterproductive.
const PR_ITEMS=[
  {n:1,cat:"perf",text:"Appropriate progress toward project completion",desc:["Makes up work (when absent or tardy) as decided with your mentor","Growth mindset / learning from mistakes","Measurable progress toward goals"]},
  {n:2,cat:"perf",text:"Professional communication with teachers, staff, and students",desc:["Communicates about absences and tardies","Speaks respectfully with others","Advocates for self","Asks for timely guidance from mentor","Reads and responds to DPEngineering emails"]},
  {n:3,cat:"perf",text:"Generates portfolio content on a weekly basis",desc:["Content — two or more (successes/failures, modifications/iterations, collaborations, questions/concerns, next steps)","Visuals — one or more (component images, action images, code/CAM/CAD screenshots)","56 DELTAs — two or more skills, each with a bulleted description"]},
  {n:4,cat:"prod",text:"Maintains focus and productivity for the duration of the class period",desc:["Starts quickly after attendance","Continues to work until clean-up time","Arrives on time","Leaves when the bell rings"]},
  {n:5,cat:"prod",text:"Strives to produce high-quality work product",desc:["Applies the iterative process","Uses appropriate machining techniques","Uses appropriate SolidWorks techniques","Writes software using appropriate standards"]},
  {n:6,cat:"prod",text:"Is resourceful and proactive, including when encountering difficulties or setbacks",desc:["Works on another part of the project","Seeks mentor advice","Asks for support when necessary","Does research","Demonstrates curiosity"]},
  {n:7,cat:"prod",text:"Is aware of needs beyond self and strives to improve the organization",desc:["Helps move the vision of the Entrepreneurial Enterprise forward","Helps with DPEA organizational needs","Engages with visitors"]},
  {n:8,cat:"prod",text:"Demonstrates integrity and honesty",desc:["Honest","Integrity"]},
  {n:9,cat:"prod",text:"Professional Work Area",desc:["Daily clean up of machines & work area","Daily proper storage of files","Wears appropriate clothing"]},
  {n:10,cat:"prod",text:"Successfully executes the weekly maintenance task",desc:["Utilizes all of the clean-up time","Received mentor sign-off for completed task","Submit before and after photo"]},
  {n:11,cat:"counter",text:"Wanders around the facility and/or distracts others",desc:[]},
  {n:12,cat:"counter",text:"Engages in unnecessary web/social media or phone/texting",desc:["Adheres to district/campus guidelines"]}
];
// ===== Per-item scoring weights — EDIT HERE ==========================
// Each rubric item is scored by its code (a/m/s/n); higher = better, negatives
// penalize. The weekly score sums the 12 item weights and normalizes so a
// best-possible week = 4.00, then floors at 0 (students never get a negative
// grade). To retune an item, edit its row — the 0.00–4.00 ceiling re-derives
// itself from these numbers, so nothing else needs to change.
// Items 11 & 12 are counterproductive, so their BEST value is "n" (never).
// ⚠ Keep this block IDENTICAL in grade.html (the mentor tool) so the student's
//   self-score and the mentor's score use the same model.
const PR_WEIGHTS={
  1:{a:8,m:2,s:-8,n:-12},    // Appropriate progress toward project completion   [critical]
  2:{a:8,m:4,s:2,n:0},       // Professional communication
  3:{a:4,m:2,s:-8,n:-16},    // Generates portfolio content weekly               [critical]
  4:{a:8,m:2,s:-8,n:-12},    // Maintains focus and productivity                 [critical]
  5:{a:8,m:4,s:1,n:0},       // Strives to produce high-quality work
  6:{a:4,m:3,s:2,n:1},       // Is resourceful and proactive
  7:{a:4,m:3,s:2,n:1},       // Is aware of needs beyond self
  8:{a:4,m:1,s:-8,n:-16},    // Demonstrates integrity and honesty               [critical]
  9:{a:8,m:4,s:1,n:0},       // Professional / clean work area
  10:{a:8,m:4,s:1,n:0},      // Successfully executes weekly maintenance task
  11:{a:0,m:0,s:2,n:4},      // Wanders / distracts others          [counterproductive: n best]
  12:{a:-12,m:-8,s:-4,n:8}   // Unnecessary web / social / phone    [counterproductive: n best]
};
const PR_SECTIONS=[
  {at:1,cat:"perf",title:"Performance Review",key:"a = always · m = mostly · s = somewhat · n = not at all"},
  {at:4,cat:"prod",title:"Productive Behavior",key:"a = always · m = mostly · s = sometimes · n = never"},
  {at:11,cat:"counter",title:"Counterproductive Behavior",key:"Reversed — “never” is best · counts against the score",neg:true}
];
const CODE_LABELS={std:{a:"Always",m:"Mostly",s:"Sometimes",n:"Never"},perf:{a:"Always",m:"Mostly",s:"Somewhat",n:"Not at all"}};
function labelSet(cat){return cat==="perf"?CODE_LABELS.perf:CODE_LABELS.std;}
const PR_CODE_LABELS={std:{a:"Always",m:"Mostly",s:"Sometimes",n:"Never"},perf:{a:"Always",m:"Mostly",s:"Somewhat",n:"Not at all"}};
function prLabelSet(cat){return cat==="perf"?PR_CODE_LABELS.perf:PR_CODE_LABELS.std;}
// DELTA skill suggestions (edit freely; a subset of the DPEngineering 56 DELTAs).
const PR_DELTA_SUGGESTIONS=["Ability to Learn","Adaptability","Breaking Orthodoxies","Coaching","Collaboration","Computational and Algorithmic Thinking","Creativity and Imagination","Digital Collaboration","Digital Learning","Driving Change and Innovation","Self-development","Self Motivation and Wellness","Storytelling and Public Speaking","Time Management and Prioritization"];
// =====================================================================

// ---- scoring engine (drives the live self-score) ---------------------
function prComputeScore(codes){
  var raw=0,sub={prod:0,counter:0,perf:0},max={prod:0,counter:0,perf:0},answered=0;
  PR_ITEMS.forEach(function(it){
    var w=PR_WEIGHTS[it.n];
    max[it.cat]+=Math.max(w.a,w.m,w.s,w.n);   // best attainable for this item
    var c=codes[it.n];
    if(c){answered++;raw+=w[c];sub[it.cat]+=w[c];}
  });
  var maxRaw=max.prod+max.counter+max.perf;   // best-possible total → auto-derives the scale
  return {raw:raw,answered:answered,total:PR_ITEMS.length,sub:sub,max:max,maxRaw:maxRaw,
    overall:Math.max(raw/(maxRaw/4),0),pct:Math.max(raw/maxRaw*100,0)};   // floored at 0
}

// ---- shared HTML builders -------------------------------------------
function prSegHTML(name,selected,cat,disabled){
  var L=prLabelSet(cat);
  // Counterproductive chips run best-first (Never→Always) to match the reversed
  // rubric; the value/code is unchanged, so scoring is unaffected.
  var order=cat==="counter"?["n","s","m","a"]:["a","m","s","n"];
  return '<div class="seg">'+order.map(function(c){
    return '<label class="opt"><input type="radio" name="'+name+'" value="'+c+'"'+
      (selected===c?" checked":"")+(disabled?" disabled":"")+'><span>'+L[c]+'</span></label>';
  }).join("")+'</div>';
}
function prSectionHeadHTML(n){
  var s=PR_SECTIONS.find(function(x){return x.at===n;});
  return s?'<div class="sec'+(s.neg?" neg":"")+'"><h3>'+s.title+'</h3><div class="seckey">'+s.key+'</div></div>':"";
}
function prDescHTML(it){
  return it.desc.length?'<ul class="desc">'+it.desc.map(function(d){return "<li>"+d+"</li>";}).join("")+"</ul>":"";
}

// ---- the rubric form -------------------------------------------------
// Built on demand rather than hidden: a grade 9-11 student never has these
// inputs in their DOM at all, so the download checklist cannot deadlock on
// fields they cannot see.
function prRenderRubric(hostId,suggestId,onEdit){
  var host=$(hostId);
  if(!host||host.dataset.built)return;
  host.innerHTML=PR_ITEMS.map(function(it){
    return prSectionHeadHTML(it.n)+
      '<div class="item'+(it.cat==="counter"?" neg":"")+'" data-n="'+it.n+'"><div class="ihead"><span class="inum">'+it.n+'</span>'+
      '<span class="itext">'+it.text+'</span></div>'+prDescHTML(it)+prSegHTML("s_"+it.n,null,it.cat,false)+'</div>';
  }).join("");
  host.dataset.built="1";
  host.addEventListener("change",onEdit);
  var sug=$(suggestId);
  if(sug)sug.innerHTML=PR_DELTA_SUGGESTIONS.map(function(s){return '<option value="'+esc(s)+'">';}).join("");
}
function prGetCodes(){
  var codes={};
  PR_ITEMS.forEach(function(it){
    var r=document.querySelector('input[name="s_'+it.n+'"]:checked');
    if(r)codes[it.n]=r.value;
  });
  return codes;
}
function prSetCodes(codes){
  PR_ITEMS.forEach(function(it){
    var v=(codes||{})[it.n];
    document.querySelectorAll('input[name="s_'+it.n+'"]').forEach(function(r){r.checked=(r.value===v);});
  });
}

// ---- DELTAs (skills) -------------------------------------------------
function prAddDelta(hostId,data,onEdit){
  data=data||{};
  var row=document.createElement("div");
  row.className="delta";
  row.innerHTML='<div class="drow"><input type="text" class="dskill" list="prDeltaSuggestions" placeholder="Skill name (e.g. Collaboration)">'+
    '<button type="button" class="rm">Remove</button></div>'+
    '<textarea class="dtext" placeholder="How you demonstrated it this week..."></textarea>';
  row.querySelector(".dskill").value=data.skill||"";
  row.querySelector(".dtext").value=data.text||"";
  row.querySelector(".rm").onclick=function(){row.remove();onEdit();};
  row.querySelectorAll("input,textarea").forEach(function(el){el.addEventListener("input",onEdit);});
  $(hostId).appendChild(row);
}
function prCollectDeltas(){
  return [...document.querySelectorAll("#prDeltas .delta")].map(function(r){
    return {skill:r.querySelector(".dskill").value.trim(),text:r.querySelector(".dtext").value.trim()};
  }).filter(function(d){return d.skill||d.text;});
}

// ---- image recompression --------------------------------------------
// The submission embeds the whole portfolio gallery, so the photos get
// re-encoded smaller here. The rotation post itself keeps the originals —
// only this copy is shrunk.
const PR_IMG_MAXDIM=1000, PR_IMG_QUALITY=0.7;
function prRecompressDataUrl(dataUrl){
  return new Promise(function(resolve){
    if(!dataUrl||!/^data:image\/(jpe?g|png)/i.test(dataUrl))return resolve(dataUrl); // leave GIFs etc. alone
    var img=new Image();
    img.onload=function(){
      var w=img.naturalWidth,h=img.naturalHeight;
      var scale=Math.min(1,PR_IMG_MAXDIM/Math.max(w,h));
      if(scale>=1&&dataUrl.length<200000)return resolve(dataUrl);  // already small enough
      var c=document.createElement("canvas");
      c.width=Math.round(w*scale);c.height=Math.round(h*scale);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      try{resolve(c.toDataURL("image/jpeg",PR_IMG_QUALITY));}catch(e){resolve(dataUrl);}
    };
    img.onerror=function(){resolve(dataUrl);};
    img.src=dataUrl;
  });
}
// Returns a deep copy of the post with every photo re-encoded smaller. The
// caller's data is left untouched, so the rotation post still downloads at
// full quality.
async function prShrinkPortfolio(p){
  var out=JSON.parse(JSON.stringify(p));
  out.cover=await prRecompressDataUrl(out.cover);
  for(var wi=0;wi<(out.weeks||[]).length;wi++){
    var w=out.weeks[wi];
    for(var g of ["images1","images2"]){
      for(var i=0;i<(w[g]||[]).length;i++){
        w[g][i].dataUrl=await prRecompressDataUrl(w[g][i].dataUrl);
      }
    }
  }
  return out;
}

// ---- the submitted artifact (static; SpeedGrader runs no JS) ---------
const PR_ARTIFACT_CSS=`
*{box-sizing:border-box}
body{margin:0;background:#f8fafc;color:#1e293b;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.5}
.sheet{max-width:820px;margin:0 auto;padding:1.25rem 1.1rem 3rem}
.ah{margin-bottom:1rem}
.ah h1{margin:0;font-size:1.3rem}
.ah p{margin:.25rem 0 0;color:#64748b;font-size:.9rem}
/* portfolio content — the portfolio-generator's own post stylesheet, scoped under
   .portfolio so the embedded post matches the original without touching the review UI */
.portfolio{font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.65;color:#1e293b}
.portfolio .cover{position:relative;margin-bottom:2.5rem}
.portfolio .cover .banner{height:300px;background:linear-gradient(120deg,#0ea5e9,#1e293b)}
.portfolio .cover img{display:block;width:100%;max-height:460px;object-fit:cover}
.portfolio .cover-text{position:absolute;left:0;bottom:0;width:100%;z-index:3;padding:2rem 1.5rem 1.25rem;background:linear-gradient(to top,rgba(15,23,42,.78),transparent);color:#fff;font-family:system-ui,sans-serif}
.portfolio .cover-text h1{font-size:clamp(1.8rem,5vw,3rem);margin:0}
.portfolio .subtitle{margin:.3rem 0 0;font-size:1.05rem;opacity:.92}
.portfolio .cover-logo{position:absolute;z-index:2;display:block;height:auto}
.portfolio .cover-logo.hero{top:46%;left:50%;transform:translate(-50%,-50%);width:168px}
.portfolio .cover-logo.badge{top:1rem;right:1rem;width:78px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}
.portfolio main{max-width:860px;margin:0 auto;padding:0 1.25rem}
.portfolio section{margin-bottom:3.5rem}
.portfolio h2{font-family:system-ui,sans-serif;font-size:1.5rem;color:rgb(25,25,25);border-bottom:2px solid #e2e8f0;padding-bottom:.4rem;margin:0 0 1rem}
.portfolio p{margin:0 0 1.25rem}
.portfolio .key{color:rgb(0,67,250);font-weight:600}
.portfolio .gallery{display:grid;gap:1rem;margin:1.5rem 0;grid-template-columns:repeat(2,1fr)}
.portfolio figure{margin:0}
.portfolio figure img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid #e2e8f0}
.portfolio figcaption{font-family:system-ui,sans-serif;font-size:.85rem;color:#64748b;margin-top:.5rem;font-style:italic}
.portfolio pre{background:#0f172a;color:#e2e8f0;padding:1.1rem 1.25rem;border-radius:10px;overflow-x:auto;font-size:.9rem;line-height:1.5}
.portfolio code{font-family:"SF Mono",Consolas,monospace}
@media (max-width:640px){.portfolio{font-size:16px}.portfolio .gallery{grid-template-columns:1fr}.portfolio .cover-logo.hero{width:132px}.portfolio .cover-logo.badge{width:62px}}
.deltas{margin:0 0 1.5rem}
.deltas h2{font-family:system-ui,sans-serif;font-size:1.2rem;color:#111;border-bottom:2px solid #e2e8f0;padding-bottom:.35rem;margin:0 0 .8rem}
.delta{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.6rem .8rem;margin:0 0 .5rem}
.delta .dskill{font-weight:700;color:#4f46e5}
.delta .dtext{margin:.2rem 0 0;color:#334155}
.divider{border:0;border-top:2px solid #e2e8f0;margin:2rem 0 1.25rem}
.revhead{font-size:1.15rem;margin:0 0 .25rem}
.scoreband{display:flex;gap:.75rem;margin:1rem 0 .35rem}
.sb{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.7rem .9rem;text-align:center}
.sb.primary{border-color:#4f46e5;box-shadow:0 0 0 1px #4f46e5 inset}
.sbnum{font-size:2rem;font-weight:800;color:#4f46e5;line-height:1}
.sblab{font-size:.76rem;color:#64748b;font-weight:600;margin-top:.2rem}
.cats{text-align:center;font-size:.8rem;color:#64748b;margin-bottom:1.25rem}
.note{background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:8px;padding:.55rem .7rem;font-size:.82rem;margin-bottom:1rem}
.mentorbox{margin-top:2rem;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:.85rem 1rem;font-family:system-ui,sans-serif}
.mentorbox .mb-h{font-weight:700;font-size:.9rem;color:#334155;margin-bottom:.25rem}
.mentorbox .mb-p{margin:0 0 .55rem;font-size:.8rem;color:#64748b;line-height:1.45}
.mentorbox .mb-url{display:block;font-family:"SF Mono",Consolas,monospace;font-size:.78rem;color:#4f46e5;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem .6rem;word-break:break-all;line-height:1.4;user-select:all;-webkit-user-select:all}
.mentorbox .mb-codelabel{font-size:.78rem;font-weight:700;color:#334155;margin:.7rem 0 .25rem}
.sec{margin:1.4rem 0 .55rem}
.sec h3{margin:0;font-size:1rem;color:#4f46e5}
.sec.neg h3{color:#dc2626}
.sec .seckey{font-size:.76rem;color:#64748b;margin-top:.15rem}
.item{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem .85rem;margin:0 0 .6rem}
.item.neg .inum{background:#dc2626}
.ihead{display:flex;gap:.5rem;align-items:baseline}
.inum{flex:none;width:1.5rem;height:1.5rem;border-radius:999px;background:#4f46e5;color:#fff;font-size:.8rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.itext{font-weight:600}
.desc{margin:.4rem 0 .55rem 2rem;padding:0;color:#64748b;font-size:.8rem}
.desc li{margin:.12rem 0}
.selfrate{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;margin:.5rem 0 .15rem 2rem}
.selfrate-lab{font-size:.74rem;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.03em}
.selfrate-none{font-size:.78rem;font-style:italic;color:#94a3b8}
/* read-only segmented control: chosen option highlighted via :checked+span (no JS) */
.seg{display:inline-flex;flex-wrap:wrap;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}
.seg .opt{margin:0}
.seg input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.seg span{display:inline-block;padding:.32rem .58rem;font-size:.78rem;font-weight:600;color:#94a3b8;border-right:1px solid #cbd5e1;user-select:none}
.seg .opt:last-child span{border-right:0}
.seg input:checked+span{background:#4f46e5;color:#fff}
@media (max-width:560px){.scoreband{flex-direction:column}.portfolio .gallery{grid-template-columns:1fr}.desc,.selfrate{margin-left:0}}
`;

// Renders the rotation post inside the submission, using the generator's own
// cover header so the embedded copy matches the real post.
function prRenderPortfolio(p){
  if(!p)return "";
  var ctr={n:0};
  var name=(p.meta&&p.meta.student)||"DPEA Student";
  var gradeTxt=p.meta&&p.meta.grade?("Grade "+p.meta.grade):"";
  var sub=[p.meta&&p.meta.project,gradeTxt].filter(Boolean).map(esc).join(" · ");
  var cover=coverHeader(p,name,sub);
  var sections=(p.weeks||[]).map(function(w){
    var imgs1=w.images1||[],imgs2=w.images2||[];
    var hasImg=imgs1.some(function(x){return x.dataUrl;})||imgs2.some(function(x){return x.dataUrl;});
    if(!w.title&&!w.text1&&!w.text2&&!hasImg)return "";
    var h='<section><h2>'+(esc(w.title)||"This Week")+'</h2>';
    if(w.text1)h+=paras(w.text1);
    if(imgs1.length)h+=gallery(imgs1,ctr,1);
    if(w.text2)h+=paras(w.text2);
    if(imgs2.length)h+=gallery(imgs2,ctr,2);
    return h+"</section>";
  }).filter(Boolean).join("");
  var refl=p.reflection?'<section><h2>Looking Back</h2>'+paras(p.reflection)+'</section>':"";
  return '<div class="portfolio">'+cover+'<main>'+sections+refl+'</main></div>';
}
function prRenderDeltas(deltas){
  var rows=(deltas||[]).filter(function(d){return d.skill||d.text;}).map(function(d){
    return '<div class="delta"><div class="dskill">'+esc(d.skill||"Skill")+'</div><div class="dtext">'+esc(d.text)+'</div></div>';
  }).join("");
  return rows?'<div class="deltas"><h2>56 DELTAs — Skills</h2>'+rows+'</div>':"";
}

// Static, read-only self-rating summary embedded in the submission. No controls
// and no script — it renders as plain HTML in SpeedGrader's sandboxed preview,
// giving the mentor the student's self-assessment as context.
function prArtifactSectionsHTML(codes){
  return PR_SECTIONS.map(function(sec){
    var head='<div class="sec'+(sec.neg?" neg":"")+'"><h3>'+sec.title+'</h3><div class="seckey">'+sec.key+'</div></div>';
    var rows=PR_ITEMS.filter(function(it){return it.cat===sec.cat;}).map(function(it){
      var c=codes[it.n];
      var unrated=c?"":'<span class="selfrate-none">not rated</span>';
      return '<div class="item'+(it.cat==="counter"?" neg":"")+'"><div class="ihead"><span class="inum">'+it.n+'</span>'+
        '<span class="itext">'+it.text+'</span></div>'+prDescHTML(it)+
        '<div class="selfrate"><span class="selfrate-lab">Self-rating</span>'+
        prSegHTML("self_"+it.n,c||null,it.cat,true)+unrated+'</div></div>';
    }).join("");
    return head+rows;
  }).join("");
}

// ---- mentor grading link ---------------------------------------------
// The submission links straight to the grading tool with the student's ratings
// encoded in the URL *fragment* (never sent to a server). grade.html reads the
// fragment and pre-fills — no separate code to paste.
//
// This URL is BAKED INTO every downloaded submission and those files are
// permanent, so it must keep resolving for as long as any submission is still
// gradable. The custom domain is canonical (the student network blocks
// github.io; mentors are not blocked). The previous address,
// dpengineering.github.io/performance-review/grade, is still live and must stay
// that way — submissions downloaded before the domain move point at it.
const PR_GRADE_URL="https://portfolio.dpeacl.org/grade";
function prB64url(bin){return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function prEncodePayload(obj){return prB64url(unescape(encodeURIComponent(JSON.stringify(obj))));}
function prGradeLink(d){
  var codes=PR_ITEMS.map(function(it){return d.codes[it.n]||"-";}).join("");
  var payload={n:d.meta.student||"",w:d.meta.week||"",m:d.meta.mentor||"",p:d.meta.project||"",c:codes};
  return PR_GRADE_URL+"#d="+prEncodePayload(payload);
}

// d: {meta:{student,week,mentor,project}, codes, notes, deltas, portfolio}
function prBuildArtifact(d){
  var name=esc(d.meta.student||"DPEngineering Student");
  var sub=[d.meta.week?("Week of "+d.meta.week):"",d.meta.mentor?("Mentor: "+d.meta.mentor):"",d.meta.project]
    .filter(Boolean).map(esc).join(" · ");
  var self=prComputeScore(d.codes);
  var selfNum=self.answered===self.total?self.overall.toFixed(2):"—";
  var selfCats=self.answered?
    ("Productive "+self.sub.prod+"/"+self.max.prod+" · Counterproductive "+self.sub.counter+"/"+self.max.counter+" · Performance "+self.sub.perf+"/"+self.max.perf):"";
  var notesBlock=d.notes?'<div class="note"><strong>Student note:</strong> '+esc(d.notes)+'</div>':"";
  var glink=prGradeLink(d);
  // Embedded state for re-opening (image dataUrls omitted; recovered from the rendered galleries).
  var portMeta=d.portfolio?{meta:d.portfolio.meta,reflection:d.portfolio.reflection,
    weeks:(d.portfolio.weeks||[]).map(function(w){return {title:w.title,text1:w.text1,text2:w.text2,
      images1:(w.images1||[]).map(function(i){return {name:i.name,caption:i.caption};}),
      images2:(w.images2||[]).map(function(i){return {name:i.name,caption:i.caption};})};})}:null;
  var dataJson=JSON.stringify({v:2,meta:d.meta,codes:d.codes,notes:d.notes,deltas:d.deltas,portfolio:portMeta}).replace(/</g,"\\u003c");
  return "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"+
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"+
    "<title>"+name+" — Weekly Submission</title>\n<style>"+PR_ARTIFACT_CSS+"</style>\n</head>\n<body>\n"+
    '<div class="sheet">\n'+
    '<header class="ah"><h1>'+name+'</h1><p>'+(sub||"Weekly submission")+'</p></header>\n'+
    prRenderPortfolio(d.portfolio)+"\n"+
    prRenderDeltas(d.deltas)+"\n"+
    '<hr class="divider">\n'+
    '<h2 class="revhead">Weekly Performance Review</h2>\n'+
    '<div class="scoreband">'+
      '<div class="sb primary"><div class="sbnum">'+selfNum+'</div><div class="sblab">Student self-score</div></div>'+
    '</div>\n'+
    '<div class="cats">'+selfCats+'</div>\n'+
    notesBlock+
    '<div class="note">These ratings are the student\u2019s own self-assessment. The official grade is set by the mentor.</div>\n'+
    '<div id="mentor">'+prArtifactSectionsHTML(d.codes)+'</div>\n'+
    '<div class="mentorbox">\n'+
      '<div class="mb-h">\ud83d\udd17 For mentors — grade this submission</div>\n'+
      '<p class="mb-p">Copy this link into a new browser tab. It opens the grading tool pre-filled with this student\u2019s self-assessment — adjust any ratings, then copy the generated comment into Canvas along with the score.</p>\n'+
      '<div class="mb-codelabel">Grading link (click to select, then copy into a new tab):</div>\n'+
      '<span class="mb-url">'+esc(glink)+'</span>\n'+
    '</div>\n'+
    '</div>\n'+
    '<script type="application/json" id="pr-data">'+dataJson+'<\/script>\n'+
    '</body>\n</html>';
}

// <Initials+Last4>_PerfReview_<YYYY-MM-DD>.html — matches the post generator's
// naming so the two files sort together.
function prFileName(meta){
  var alnum=function(s){return (s||"").replace(/[^A-Za-z0-9]/g,"");};
  var fi=(alnum(meta.first)[0]||"").toUpperCase();
  var ln=alnum(meta.last).slice(0,4);
  var lnCased=ln?ln[0].toUpperCase()+ln.slice(1).toLowerCase():"";
  var who=(fi+lnCased)||"XX";
  return who+"_PerfReview_"+(meta.week||"draft")+".html";
}

// What still has to be done before the review can be downloaded. The post's own
// requirements are checked separately by the generator — the review additionally
// needs them, because it embeds the post.
function prRequirements(perf){
  var codes=perf.codes||{};
  var answered=Object.keys(codes).length;
  var deltaN=(perf.deltas||[]).filter(function(x){return x.skill&&x.text;}).length;
  PR_ITEMS.forEach(function(it){
    var el=document.querySelector('#prRubric .item[data-n="'+it.n+'"]');
    if(el)el.classList.toggle("unset",!codes[it.n]);
  });
  return [
    {ok:!!perf.week, label:"Choose the week"},
    {ok:deltaN>=2,   label:"Add at least 2 DELTA skills with a description ("+deltaN+"/2)"},
    {ok:answered===PR_ITEMS.length, label:"Rate all 12 rubric items ("+answered+"/"+PR_ITEMS.length+")"}
  ];
}
