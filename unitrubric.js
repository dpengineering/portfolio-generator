// ---- unit post rubric: criteria, scoring, and the mentor grading link ----
// Loaded by unit.html (the student's self-grade + the link baked into the post)
// and grade-unit.html (the mentor grader), so both always score the same way.
// See docs/PLAN-unit-grading.md.

// Bump when criteria or wording change. It rides in every grading link and the
// grader shows it, so an old post is graded knowing which rubric it was written to.
const UR_VERSION=1;

// Sections are weighted; each section's score is the average of its criteria.
const UR_SECTIONS=[
  {key:"update",label:"Project Update (Technical Writing)",short:"Project Update",weight:0.6},
  {key:"synthesis",label:"Reflection/Synthesis",short:"Reflection",weight:0.3},
  {key:"filemgmt",label:"File Management",short:"File Management",weight:0.1},
];

// Each criterion scores 0-4. levels holds the descriptor for each level it
// offers; Level 0 (no submission / academic dishonesty) is mentor-only.
// Personal Detail has a single upper level, so it offers 4, 2, 1.
const UR_REFLECT_L2="Makes connections without adequate explanation or personal detail";
const UR_REFLECT_L1="No thoughtful synthesis or connections — lists learning from each space, but doesn't connect them";
const UR_CRITERIA=[
  {id:"terms",sec:"update",label:"Key Terms in Context",levels:{
    4:"Written so a reader outside the project could follow it — terms explained or clear in context, no filler",
    3:"Uses key terms correctly and precisely — they add clarity, not padding",
    2:"Uses some key terms, but imprecisely, incorrectly, or as padding that doesn't add clarity",
    1:"Technical vocabulary largely absent or misused"}},
  {id:"org",sec:"update",label:"Organization of Content",levels:{
    4:"Maintains clear focus on the project throughout the text",
    3:"Opens by stating what you set out to build or solve this unit, and why",
    2:"Purpose is unclear or buried; reads as a loose list of activities rather than a structured update",
    1:"No clear purpose or structure; the reader can't tell what you set out to do or what happened"}},
  {id:"style",sec:"update",label:"Writing Style",levels:{
    4:"Supports results with specific evidence (real numbers, parts, etc.) and explains their correlation, not just \"it worked well\"",
    3:"Explains the reasoning behind your key decisions (\"I did X because...\"), not just what you did",
    2:"Recounts what you did without the why; claims are vague or unsupported (\"it worked well\")",
    1:"Only lists actions or tells the story — no reasoning, no evidence, no specifics"}},
  {id:"images",sec:"update",label:"Image Quality & Content",levels:{
    4:"Visuals do explanatory work — labeled, annotated, or captioned to teach, not just decorate",
    3:"Each image is referred to (by figure number) in the text and shows something you actually discuss",
    2:"Images present but loosely connected — not referenced in the text, or don't show what's discussed",
    1:"Images missing, off-topic, or too low-quality to show anything useful"}},
  {id:"growth",sec:"synthesis",label:"Growth",levels:{
    4:"Names a specific way your thinking or approach changed",
    3:"Explains what you learned or how you grew this unit — not just what you did",
    2:UR_REFLECT_L2,1:UR_REFLECT_L1}},
  {id:"connect",sec:"synthesis",label:"Connections",levels:{
    4:"Draws a transferable lesson and says how you'll apply it going forward",
    3:"Connects this work to a specific earlier experience or class",
    2:UR_REFLECT_L2,1:UR_REFLECT_L1}},
  {id:"detail",sec:"synthesis",label:"Personal Detail",levels:{
    4:"Grounded in real personal detail — an actual moment, decision, or feeling",
    2:UR_REFLECT_L2,1:UR_REFLECT_L1}},
  {id:"files",sec:"filemgmt",label:"File Management Screenshots",levels:{
    4:"Two file-management screenshots, named and organized correctly, with images properly named and organized",
    1:"File management screenshots completed incorrectly"}},
];
const UR_L0="No submission, improper link, or academic dishonesty";

// The checkbox self-rubric grades 9-11 use (and 12th graders used before the
// level pickers). l3[i]/l4[i] are the same criterion at two levels, in
// UR_CRITERIA order; File Management is pass/fail.
// Saved drafts and posts record checked boxes by their text, so leave these
// strings alone even if the UR_CRITERIA wording changes.
const RUBRIC=[
  {key:"update",label:"Project Update (Technical Writing)",compute:"cumulative",
    l3:["Uses key terms correctly and precisely — they add clarity, not padding","Opens by stating what you set out to build or solve this unit, and why","Explains the reasoning behind your key decisions (\"I did X because...\"), not just what you did","Each image is referred to (by figure number) in the text and shows something you actually discuss"],
    l4:["Written so a reader outside the project could follow it — terms explained or clear in context, no filler","Maintains clear focus on the project throughout the text","Supports results with specific evidence (real numbers, parts, etc.) and explains their correlation, not just \"it worked well\"","Visuals do explanatory work — labeled, annotated, or captioned to teach, not just decorate"]},
  {key:"synthesis",label:"Reflection/Synthesis",compute:"cumulative",
    l3:["Explains what you learned or how you grew this unit — not just what you did","Connects this work to a specific earlier experience or class","Grounded in real personal detail — an actual moment, decision, or feeling"],
    l4:["Names a specific way your thinking or approach changed","Draws a transferable lesson and says how you'll apply it going forward"]},
  {key:"filemgmt",label:"File Management",compute:"binary",
    l3:[],
    l4:["Two file-management screenshots, named and organized correctly","Images are properly named and organized"]},
];

// Levels a criterion offers, best first (mentors also get 0).
function urLevelsOf(c,withZero){
  const ls=Object.keys(c.levels).map(Number).sort((a,b)=>b-a);
  return withZero?ls.concat(0):ls;
}

// levels: {criterionId: 0-4}. A section with any criterion unscored, and the
// overall score until every section is scored, come back as null.
function urScore(levels){
  levels=levels||{};
  const sec={};
  UR_SECTIONS.forEach(s=>{
    const cs=UR_CRITERIA.filter(c=>c.sec===s.key);
    sec[s.key]=cs.every(c=>Number.isInteger(levels[c.id]))
      ? cs.reduce((t,c)=>t+levels[c.id],0)/cs.length : null;
  });
  const done=UR_SECTIONS.every(s=>sec[s.key]!==null);
  return {sections:sec,overall:done?UR_SECTIONS.reduce((t,s)=>t+s.weight*sec[s.key],0):null};
}

// Map a checkbox self-rubric to levels: Level 3 + Level 4 boxes → 4, Level 3
// alone → 3, Level 4 alone → 3 (it assumes Level 3), neither → 2 (checkboxes
// can't tell 2 from 1). Personal Detail has no Level 3, so its one box → 4.
// File Management: both boxes → 4, else 1.
function urLevelsFromChecks(rubric){
  const out={};
  RUBRIC.forEach(cat=>{
    const saved=(rubric||[]).find(r=>r.key===cat.key)||(rubric||[]).find(r=>r.category===cat.label)||{};
    const met=saved.met||[];
    const cs=UR_CRITERIA.filter(c=>c.sec===cat.key);
    if(cat.compute==="binary"){out[cs[0].id]=cat.l4.every(t=>met.includes(t))?4:1;return;}
    cs.forEach((c,i)=>{
      const has3=met.includes(cat.l3[i]), has4=!!cat.l4[i]&&met.includes(cat.l4[i]);
      out[c.id]=has3&&has4?4:has3?(c.levels[3]?3:4):has4?3:2;
    });
  });
  return out;
}

// The student's self-levels for a post: chosen levels when the post has them
// for every criterion (12th grade), else mapped from the checkboxes.
function urSelfLevels(rubric){
  const picked={};
  (rubric||[]).forEach(r=>Object.assign(picked,r.levels||{}));
  if(UR_CRITERIA.every(c=>Number.isInteger(picked[c.id])))return {levels:picked,mode:"pick"};
  return {levels:urLevelsFromChecks(rubric),mode:"check"};
}

// ---- grading link ----
// The post's text and self-grade ride in the URL *fragment*, which never
// reaches a server. Photos don't (they'd make it megabytes); the mentor sees
// them in the post itself.
// This URL is BAKED INTO every downloaded post and those files are permanent,
// so it must keep resolving. It's the perf-review grader's address: grade.html
// hands #u= links on to grade-unit.html.
const UR_GRADE_URL="https://portfolio.dpeacl.org/grade";
function urEncode(obj){return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function urDecode(code){
  let s=code.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}
// d: a post's data -- collect() in unit.html, or the #portfolio-data block of a
// downloaded post (same shape, photos stripped).
function urPayload(d){
  const m=d.meta||{}, w=(d.weeks||[])[0]||{};
  const caps=a=>(a||[]).map(i=>i.caption||"");
  const self=urSelfLevels(d.rubric);
  const comments={};
  (d.rubric||[]).forEach(r=>{if(r.comments)comments[r.key]=r.comments;});
  return {v:UR_VERSION,n:m.student||"",g:m.grade||"",u:m.unit||"",p:m.project||"",
    s1:w.sub1||"",t1:w.text1||"",f1:caps(w.images1),
    s2:w.sub2||"",t2:w.text2||"",f2:caps(w.images2),
    r:d.reflection||"",fr:caps(d.reflectionImgs),fm:(d.fileMgmt||[]).length,
    sl:UR_CRITERIA.map(c=>Number.isInteger(self.levels[c.id])?self.levels[c.id]:null),sm:self.mode,c:comments};
}
const urGradeLink=d=>UR_GRADE_URL+"#u="+urEncode(urPayload(d));
