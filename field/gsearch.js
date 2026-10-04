/* APS Field App – global search (scenarios, SANS tips, parts). Stemming, synonyms (English, Afrikaans, site slang), typo tolerance, highlighting. */
(function(){
'use strict';
var A=APSF,h=A.h;
function toSet(a){var o={};a.forEach(function(x){o[x]=1});return o}
var STOPW=toSet('a an the is are was were it its my our your this that these those of on in at to for with and or but not no nor so do does did dont doesnt didnt cant cannot can will wont wouldnt shouldnt isnt arent wasnt won t s ll i me we you he she they them how what why when where which who from by as be been am have has had get gets got keep keeps mm please help need needs want'.split(' '));
var GROUPS=[
 ['geyser','geiser','heater','boiler','cylinder','warmwater'],
 ['tap','kraan','faucet','mixer','bibtap','bib','bibcock'],
 ['toilet','wc','loo','pan','cistern','toilette','toilets'],
 ['leak','drip','lek','seep','weep','damp'],
 ['block','clog','verstop','blockage','choke','jam','blocked'],
 ['burst','bars','split','crack','broke','broken'],
 ['sewer','riool','sewage','septic'],
 ['drain','gully','drein','afvoer','waste'],
 ['smell','stink','stank','odour','odor','reuk','stench','whiff'],
 ['pressure','druk','kpa','psi'],
 ['trip','db','rcd','elcb','earth','tripping'],
 ['hammer','bang','knock','rattle','noisy','noise','lawaai','banging','knocking'],
 ['pump','pomp','booster'],
 ['borehole','boorgat','well'],
 ['shower','stort','douche'],
 ['basin','wasbak','vanity','handwash'],
 ['sink','gootsteen','koskas'],
 ['bath','bad','tub'],
 ['pipe','pyp','tube','tubing','piping'],
 ['valve','klep'],
 ['frozen','freeze','frost','ice','ysig','bevrore'],
 ['solar','sonkrag','panel','evacuated'],
 ['install','installation','instal','fit','fitting'],
 ['replace','change','swap','vervang','renew','replacement'],
 ['repair','fix','mend','herstel'],
 ['weak','swak','trickle','low','slow'],
 ['run','continuous','constant','oorloop','overflow','running'],
 ['flush','spoel'],
 ['irrigation','sprinkler','sproeier','besproeiing'],
 ['rainwater','reenwater','harvest','harvesting'],
 ['hose','slang','hosepipe'],
 ['dishwasher','skottelgoedwasser'],
 ['washing','wasmasjien'],
 ['thermostat','termostaat'],
 ['urinal','urinaal'],
 ['bidet','bidee'],
 ['scale','limescale','kalk','hard'],
 ['hot','warm','warmwater'],
 ['cold','koud'],
 ['electrician','elektrisien','electrical','elektries'],
 ['gas','lpg'],
 ['certificate','coc','sertifikaat'],
 ['vent','venting','ventilation','aav'],
 ['fall','gradient','slope','afloop','val'],
 ['support','clip','bracket','steun'],
 ['tank','tenk','jojo']
];
var NOISE=toSet('no not wont won t doesnt dont cant cannot isnt how to do fix repair replace replacing problem problems broken leaking leak dripping noisy stuck keeps keep still stopped stop working work need help please my the is it new want change changing install installing'.split(' '));

function stem(w){
 if(w.length<=3||/\d/.test(w))return w;
 var b;
 if(/ies$/.test(w)&&w.length>4)w=w.slice(0,-3)+'y';
 else if(/ing$/.test(w)&&w.length>5){b=w.slice(0,-3);if(/([^aeiouls])\1$/.test(b))b=b.slice(0,-1);w=b}
 else if(/ed$/.test(w)&&w.length>4){b=w.slice(0,-2);if(/([^aeiouls])\1$/.test(b))b=b.slice(0,-1);w=b}
 else if(/(ches|shes|sses|xes|zes)$/.test(w))w=w.slice(0,-2);
 else if(/s$/.test(w)&&!/(ss|us|is)$/.test(w))w=w.slice(0,-1);
 if(w.length>4&&/e$/.test(w))w=w.slice(0,-1);
 return w}
function toks(s){
 s=String(s).toLowerCase().replace(/[\u2019\u2018`']/g,'').replace(/(\d)\s*mm\b/g,'$1 ').replace(/&/g,' and ');
 return (s.match(/[a-z0-9]+/g)||[])}
function stems(s){return toks(s).filter(function(t){return !STOPW[t]}).map(stem)}

/* synonym map: stem -> [stems] */
var SYNM={};
GROUPS.forEach(function(g){var st=g.map(stem);st.forEach(function(a){SYNM[a]=SYNM[a]||[];st.forEach(function(b){if(b!==a&&SYNM[a].indexOf(b)<0)SYNM[a].push(b)})})});

/* ---------- index ---------- */
var IDX=null;
var CATN={};
function catNames(){if(typeof APS_CATS!=='undefined')APS_CATS.forEach(function(c){CATN[c[0]]=c[1]})}
function mkSet(arr){var o={},l=[];arr.forEach(function(t){if(!o[t]){o[t]=1;l.push(t)}});return {o:o,l:l}}
function build(){
 if(IDX)return IDX;
 catNames();
 var vocab={},docs=[];
 function addv(l){l.forEach(function(t){vocab[t]=(vocab[t]||0)+1})}
 function F(text){var s=mkSet(stems(text));addv(s.l);return s}
 if(typeof APS_SCENARIOS!=='undefined')APS_SCENARIOS.forEach(function(s){
  var units=[],cats=(s.cat||'').split(',').map(function(c){return CATN[c]||c}).join(' ');
  (s.sym||'').split(';').forEach(function(x){x=x.trim();if(x)units.push({k:'Symptom',t:x})});
  var tx=[],sn=[],pl=[];
  ['diagnose','repair','install'].forEach(function(tab){
   var T=s[tab];if(!T)return;
   if(tab==='diagnose'){Object.keys(T.nodes).forEach(function(k){var n=T.nodes[k];
     if(n.q){tx.push(n.q);if(n.opts)n.opts.forEach(function(o){tx.push(o[0])})}
     if(n.res){tx.push(n.cause);units.push({k:'Cause',t:n.cause});(n.do||[]).forEach(function(d){tx.push(d);units.push({k:'Fix',t:d})});(n.parts||[]).forEach(function(p){pl.push(p[0])})}})}
   else{(T.steps||[]).forEach(function(d){tx.push(d);units.push({k:'Step',t:d})});(T.tools||[]).forEach(function(d){tx.push(d)});(T.parts||[]).forEach(function(p){pl.push(p[0])});(T.warn||[]).forEach(function(d){tx.push(d)});
    (T.sans||[]).forEach(function(d){sn.push(d);units.push({k:'SANS',t:d})})}});
  var tabs=[];['diagnose','repair','install'].forEach(function(t){if(s[t])tabs.push(t)});
  docs.push({type:'sc',s:s,units:units,f:{ti:F(s.title),ky:F(s.kw+' '+(s.sym||'')+' '+cats+' '+tabs.join(' ')),su:F(s.sum),sn:F(sn.join(' ')),tx:F(tx.join(' ')+' '+pl.join(' '))}})});
 if(typeof APS_TIPS!=='undefined')APS_TIPS.forEach(function(t){
  docs.push({type:'tip',t:t,units:[{k:'',t:t.b}],f:{ti:F(t.t),ky:F(t.kw+' '+t.topic),su:F(''),sn:F(t.ref),tx:F(t.b)}})});
 IDX={docs:docs,vocab:vocab,vlist:Object.keys(vocab)};
 return IDX}
var WT={ti:6,ky:4,su:3,sn:1.5,tx:1.2};

/* ---------- query ---------- */
function lev(a,b,max){
 var al=a.length,bl=b.length;if(Math.abs(al-bl)>max)return max+1;
 var p1=[],j,i;for(j=0;j<=bl;j++)p1[j]=j;
 for(i=1;i<=al;i++){var c=[i],best=i;for(j=1;j<=bl;j++){var v=Math.min(p1[j]+1,c[j-1]+1,p1[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));c[j]=v;if(v<best)best=v}
  if(best>max)return max+1;p1=c}
 return p1[bl]}
function parse(raw){
 var ix=build(),words=toks(raw).filter(function(t){return !STOPW[t]});
 var q={raw:raw,t:[],hits:{},pref:[]};
 words.forEach(function(w,i){
  var s=stem(w),last=i===words.length-1;
  var alts=[{s:s,f:1,p:(s.length>=4||(last&&s.length>=3))&&!/\d/.test(s)}];
  (SYNM[s]||[]).forEach(function(x){alts.push({s:x,f:0.8,p:false})});
  if(s.length>=4&&!/\d/.test(s)&&!ix.vocab[s]){
   var known=false;if(alts[0].p)for(var k=0;k<ix.vlist.length;k++)if(ix.vlist[k].indexOf(s)===0){known=true;break}
   if(!known){var mx=s.length>=8?2:1,cands=[];
    for(var j=0;j<ix.vlist.length;j++){var v=ix.vlist[j];if(Math.abs(v.length-s.length)<=mx&&lev(s,v,mx)<=mx)cands.push(v)}
    cands.sort(function(a,b){return ix.vocab[b]-ix.vocab[a]});
    cands.slice(0,3).forEach(function(c){alts.push({s:c,f:0.6,p:false});(SYNM[c]||[]).slice(0,4).forEach(function(x){alts.push({s:x,f:0.5,p:false})})})}}
  q.t.push({w:w,alts:alts});
  alts.forEach(function(a){q.hits[a.s]=1;if(a.p)q.pref.push(a.s)})});
 return q}
function fieldQ(set,alt){
 if(set.o[alt.s])return alt.f;
 if(alt.p){for(var i=0;i<set.l.length;i++)if(set.l[i].indexOf(alt.s)===0)return 0.7*alt.f}
 return 0}
function scoreDoc(d,q){
 var n=q.t.length,matched=0,tot=0,inTitle=0;
 for(var k=0;k<n;k++){
  var best=0,alts=q.t[k].alts,tm=false;
  for(var f in WT){
   var set=d.f[f];if(!set.l.length)continue;
   for(var a=0;a<alts.length;a++){var m=fieldQ(set,alts[a]);if(m){var sc=WT[f]*m;if(sc>best)best=sc;if(f==='ti')tm=true}}}
  if(best>0){matched++;tot+=best;if(tm)inTitle++}}
 var need=n<=2?n:n-1;
 if(matched<need||!matched)return 0;
 tot+=matched*0.5;
 if(inTitle===n){tot+=4;var tl=d.f.ti.l.length||1;tot+=2*Math.min(1,n/tl)}
 return tot}
function search(raw,opts){
 var ix=build(),q=parse(raw||''),out={q:q,scs:[],tips:[]};
 if(!q.t.length)return out;
 var types=opts&&opts.types;
 ix.docs.forEach(function(d){
  if(types&&types.indexOf(d.type)<0)return;
  var sc=scoreDoc(d,q);if(!sc)return;
  var lr=String(raw).toLowerCase().trim();
  if(lr.length>2){var tt=(d.type==='sc'?d.s.title:d.t.t).toLowerCase();if(tt.indexOf(lr)>=0)sc+=3}
  if(d.type==='sc')out.scs.push({s:d.s,score:sc,d:d});else out.tips.push({t:d.t,score:sc,d:d})});
 out.scs.sort(function(a,b){return b.score-a.score||(a.s.title<b.s.title?-1:1)});
 out.tips.sort(function(a,b){return b.score-a.score});
 return out}

/* ---------- highlight / snippets ---------- */
function isHit(word,q){
 var s=stem(word.toLowerCase().replace(/[\u2019']/g,'').replace(/^(\d+)mm$/,'$1'));
 if(q.hits[s])return true;
 for(var i=0;i<q.pref.length;i++)if(s.length>=q.pref[i].length&&s.indexOf(q.pref[i])===0)return true;
 return false}
function hl(text,q){
 var f=document.createDocumentFragment();
 if(!q||!q.t||!q.t.length){f.appendChild(document.createTextNode(text));return f}
 var parts=String(text).match(/[A-Za-z0-9\u2019']+|[^A-Za-z0-9\u2019']+/g)||[];
 var buf='';
 parts.forEach(function(p){
  if(/^[A-Za-z0-9]/.test(p)&&!STOPW[p.toLowerCase()]&&isHit(p,q)){
   if(buf){f.appendChild(document.createTextNode(buf));buf=''}
   f.appendChild(h('mark',{text:p}))}
  else buf+=p});
 if(buf)f.appendChild(document.createTextNode(buf));
 return f}
function snippet(d,q){
 for(var i=0;i<d.units.length;i++){
  var u=d.units[i],w=u.t.match(/[A-Za-z0-9\u2019']+/g)||[];
  for(var j=0;j<w.length;j++){
   if(!STOPW[w[j].toLowerCase()]&&isHit(w[j],q)){
    var at=u.t.indexOf(w[j]),a=Math.max(0,at-45),b=Math.min(u.t.length,at+80);
    if(a>0){var sp=u.t.indexOf(' ',a);if(sp>=0&&sp<at)a=sp+1}
    var tx=(a>0?'\u2026':'')+u.t.slice(a,b)+(b<u.t.length?'\u2026':'');
    return {k:u.k,t:tx}}}}
 return null}

/* ---------- parts ---------- */
function cleanForParts(raw){
 var w=toks(raw).filter(function(t){return !STOPW[t]&&!NOISE[t]});
 return w.join(' ')}
function partsFor(raw){
 if(!A.D.rows)return [];
 var c=cleanForParts(raw);if(!c)return [];
 if(c.split(' ').length>4)return [];
 return A.search(A.fixTypos?A.fixTypos(c):c,'','',false)}

/* ---------- home rendering ---------- */
var GQ='';
function scRow(r,q,withCat){
 var s=r.s,tabs=[['diagnose','Diagnose'],['repair','Repair'],['install','Install']].filter(function(x){return s[x[0]]});
 var ttl=h('span',{class:'gt'});ttl.appendChild(hl(s.title,q));
 var kids=[ttl];
 var sn=null;
 var inTitle=s.title.toLowerCase();
 var sm=h('small');sm.appendChild(hl(s.sum,q));kids.push(sm);
 if(r.d){sn=snippet(r.d,q);var sumHas=false;(toks(s.sum)).forEach(function(w){if(isHit(w,q))sumHas=true});
  if(sn&&!sumHas){var sp=h('small',{class:'snip'});sp.appendChild(h('b',{text:sn.k+': '}));sp.appendChild(hl(sn.t,q));kids.push(sp)}}
 kids.push(h('span',{class:'pills'},tabs.map(function(x){return h('span',{class:'pill',text:x[1]})})));
 return h('a',{class:'row grow',href:'#/book/'+s.id,'data-sc':s.id},[h('span',{class:'t'},kids),h('span',{class:'chev',html:A.svg('back').replace('M15 5l-7 7 7 7','M9 5l7 7-7 7')})])}
function tipRow(r,q){
 var t=r.t,ttl=h('span',{class:'gt'});ttl.appendChild(hl(t.t,q));
 var sp=h('small',{class:'snip'}),sn=snippet(r.d,q);sp.appendChild(hl(sn?sn.t:t.b.slice(0,110)+(t.b.length>110?'\u2026':''),q));
 return h('a',{class:'row gtip',href:'#/tips/'+t.id,'data-tip':t.id},[h('span',{class:'t'},[ttl,sp,h('span',{class:'pills'},[h('span',{class:'pill',text:'SANS tip'}),t.chk?h('span',{class:'chk-flag',text:'Check the standard'}):null])]),h('span',{class:'chev',html:A.svg('back').replace('M15 5l-7 7 7 7','M9 5l7 7-7 7')})])}
function grp(title,count,id){return h('div',{class:'ghd','data-g':id},[h('h3',{text:title}),h('span',{class:'gc',text:count})])}
function homeBox(v,tilesEl){
 var inp=h('input',{id:'gq',type:'search',class:'search gq',placeholder:'Search: geyser, no hot water, 22mm elbow\u2026',autocomplete:'off',autocapitalize:'off',spellcheck:'false',enterkeyhint:'search','aria-label':'Search the whole app',value:GQ});
 var res=h('div',{id:'gres',class:'gres'});
 v.insertBefore(inp,tilesEl);v.insertBefore(res,tilesEl);
 var timer=null,again=false;
 function run(){
  var q=inp.value;GQ=q;res.innerHTML='';
  v.classList.toggle('gs-on',!!q.trim());
  if(!q.trim())return;
  var t0=performance.now(),r=search(q);
  var sc=r.scs,tp=r.tips,pt=partsFor(q);
  var any=sc.length||tp.length||pt.length;
  if(sc.length){res.appendChild(grp('Scenarios',sc.length,'sc'));sc.slice(0,6).forEach(function(x){res.appendChild(scRow(x,r.q))});
   if(sc.length>6)res.appendChild(h('a',{class:'more-link',href:'#/book?q='+encodeURIComponent(q),text:'See all '+sc.length+' scenarios in Handbook'}))}
  if(pt.length){res.appendChild(grp('Parts',pt.length,'pt'));var box=h('div',{class:'list'});pt.slice(0,5).forEach(function(x){box.appendChild(A.partRow(x.it))});res.appendChild(box);
   res.appendChild(h('a',{class:'more-link',href:'#/parts?q='+encodeURIComponent(cleanForParts(q)),text:'See all '+pt.length+' parts'}))}
  if(tp.length){res.appendChild(grp('SANS tips',tp.length,'tip'));tp.slice(0,5).forEach(function(x){res.appendChild(tipRow(x,r.q))});
   if(tp.length>5)res.appendChild(h('a',{class:'more-link',href:'#/tips',text:'See all SANS tips'}))}
  if(!any)res.appendChild(h('div',{class:'emptyph',id:'gnone',text:'Nothing found for "'+q.trim()+'". Try fewer words, or one word like geyser, leak, toilet or 22mm.'}));
  res.setAttribute('data-ms',Math.round(performance.now()-t0));
  if(!A.D.rows&&!again){again=true;A.loadData().then(function(){again=false;if(inp.value===q&&document.body.contains(inp))run()},function(){again=false})}}
 inp.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,100)});
 inp.addEventListener('keydown',function(e){if(e.key==='Enter'){clearTimeout(timer);run();inp.blur()}});
 run();
 return inp}

A.gs={search:search,hl:hl,parse:parse,stems:stems,homeBox:homeBox,scRow:scRow,build:build,partsFor:partsFor,cleanForParts:cleanForParts,snippet:snippet,tipRow:tipRow,reset:function(){GQ=''}};
})();
