/* APS Field App – SANS photo check: photo + markers + self-check list + optional AI suggestions.
   The app cannot certify compliance. AI findings (when a checker URL is set) are suggestions only. */
(function(){
'use strict';
var A=APSF,h=A.h,GOF='Guide only \u2013 check the current standard';
var DISC='This tool cannot certify that an installation complies with SANS. Markers and the checklist are your own notes. AI findings are suggestions only and are not checked. The plumber is responsible for the work.';
var MAXPX=1280;

/* ---- content ported from the Field Manual v1.8 self-check ---- */
var CK_TYPES=[['wc','WC / pan'],['basin','Basin'],['bath','Bath / shower'],['sink','Sink'],['geyser','Geyser'],['gully','Floor gully'],['stack','Soil stack'],['tap','Outside tap'],['drain','Drain run'],['other','Other']];
var CK_PIPES=[['u110','110 mm uPVC'],['u75','75 mm uPVC'],['u50','50 mm uPVC'],['u40','40 mm uPVC'],['u32','32 mm uPVC'],['cu22','22 mm copper'],['cu15','15 mm copper'],['hdpe','HDPE'],['pex','PEX'],['oth','Other / not sure']];
function ckLabel(list,id){for(var i=0;i<list.length;i++)if(list[i][0]===id)return list[i][1];return id||''}
function pipeFam(p){return /^u/.test(p)?'upvc':/^cu/.test(p)?'cu':p==='hdpe'?'hdpe':p==='pex'?'pex':'oth'}
function pipeMm(p){var m=/^(?:u|cu)(\d+)$/.exec(p);return m?+m[1]:0}
var DRAIN_T={wc:1,basin:1,bath:1,sink:1,gully:1,stack:1,drain:1,other:1};
var TRAP_T={wc:1,basin:1,bath:1,sink:1,gully:1};
var SUPPLY_T={wc:1,basin:1,bath:1,sink:1,tap:1,geyser:1};
var TYPICAL_MM={wc:110,basin:40,bath:50,sink:50,gully:50,stack:110};
function ckItems(type,pipe){
 var fam=pipeFam(pipe),mm=pipeMm(pipe),soil=(type==='wc'||type==='stack'||mm===110),L=[];
 function add(k,g,t,s){L.push({k:k,g:g,t:t,s:s||''})}
 if(type==='geyser'){
  add('g_tray','Geyser safety','Drip tray is larger than the geyser, level, and its drain falls to a visible, safe outside point','SANS 10254');
  add('g_tp','Geyser safety','Temperature & pressure (T&P) safety valve fitted on the geyser\u2019s safety port','SANS 10254');
  add('g_drain_m','Geyser safety','Safety valve drain pipe is metal and at least the size of the valve outlet','SANS 10254');
  add('g_drain_f','Geyser safety','Safety valve drain has a continuous fall (no upward sections) and no more than 3 bends','SANS 10254');
  add('g_drain_v','Geyser safety','Safety valve drain discharges where the discharge can be seen outside, clear of people','SANS 10254');
  add('g_drain_x','Geyser safety','No valve, cap or plug anywhere in the safety valve drain pipe','SANS 10254');
  add('g_vb','Water supply & valves','Vacuum breaker(s) fitted above the top of the geyser','SANS 10252-1');
  add('g_iso','Water supply & valves','Isolating valve and non-return valve fitted on the cold feed, in the maker\u2019s order','SANS 10252-1');
  add('g_prv','Water supply & valves','Supply pressure checked; pressure control valve fitted if it is above the geyser\u2019s rating','SANS 10252-1');
  add('g_sup','Supports','Geyser sits on a solid base or secure brackets that carry its full weight','SANS 10254');
  add('g_ins','Water supply & valves','Hot pipe and geyser insulated as required','SANS 10254');
  add('g_elec','Certificates','Electrical reconnected only by a registered electrical person, after the geyser was full (Electrical CoC)','SANS 10254');
  add('g_coc','Certificates','Plumbing Certificate of Compliance done if required (licensed plumber) and photos kept','PIRB')}
 if(DRAIN_T[type]&&type!=='geyser'){
  add('fall','Falls',soil?'Soil pipe falls at least 1 : 40 (about 25 mm per metre) with no flat or backward sections':'Waste pipe falls at least 1 : 46 (about 21.7 mm per metre) with no flat or backward sections','SANS 10252-2');
  if(TRAP_T[type])add('trap','Traps & venting',type==='wc'?'Pan trap holds its water seal in the bowl (no siphoning, no leaks)':type==='gully'?'Gully trap holds a water seal and the grid is fitted':'Trap fitted, holds its water seal and has no leaks','SANS 10252-2');
  add('vent','Traps & venting','Trap outlet is not more than 6 m of pipe from a ventilated stack or drain (up to 10 m on a waste pipe one size larger), no gurgling','SANS 10252-2');
  if(fam==='upvc'&&mm>0&&mm<=50)add('sup','Supports','Pipe supported about every 0.6 m horizontal and every 1.5 m vertical (uPVC up to 50 mm)','SANS 10252-2');
  else add('sup','Supports','Pipe supported at the spacing for this pipe and size (larger uPVC and plastic pipes follow the maker\u2019s table)','SANS 10252-1/2');
  add('acc','Access','Access (rodding eye or cleaning access) where the pipe can be rodded; not buried, sealed in or blocked','SANS 10252-2');
  if(fam==='upvc'){add('jnt','Joints & leaks','uPVC joints: solvent-weld cut square, cleaned and fully pushed home, or push-fit seals clean, lubricated and depth marked','');
   add('bnd','Joints & leaks','Long-radius bends and 45\u00B0 junctions used (no sharp turns into a horizontal run)','')}
  var tm=TYPICAL_MM[type];
  if(tm)add('size','Joints & leaks','Pipe size suits the fixture (typical site practice: '+ckLabel(CK_TYPES,type)+' about '+tm+' mm; the standard sets the minimum, so check SANS 10252-2)','SANS 10252-2')}
 if(SUPPLY_T[type]&&type!=='geyser'){
  add('iso','Water supply & valves',type==='tap'?'Isolating valve inside the house for this tap, easy to reach':'Isolating (angle) valve fitted, works and is easy to reach','SANS 10252-1');
  if(type==='wc'||type==='basin'||type==='sink')add('flex','Water supply & valves','Flexi hoses new, not kinked or strained, joints dry','');
  if(type==='tap')add('bf','Water supply & valves','Backflow protection (vacuum breaker or check valve) fitted on this outside tap where required','SANS 10252-1');
  if(fam==='cu')add('cu','Joints & leaks','Copper pipe not kinked or flattened, joints tight or soldered cleanly, pipe clipped at the right spacing, hot pipe insulated','SANS 10252-1');
  if(fam==='pex')add('pex','Joints & leaks','PEX pipe not kinked, bends within the maker\u2019s limits, fittings and clips as the maker shows','');
  if(fam==='hdpe')add('hdpe','Joints & leaks','HDPE pipe not scored or crushed, fittings made up as the maker shows','')}
 add('leak','Joints & leaks','Water test done: every joint dry after at least 10 minutes','');
 add('flow','Joints & leaks',(type==='geyser'||type==='tap')?'Water runs, valves work, no drips or noise':'Fixture drains freely when run: no gurgling, slow flow or smells','');
 var GO=['Falls','Traps & venting','Supports','Access','Water supply & valves','Geyser safety','Joints & leaks','Certificates'];
 L.forEach(function(x,i){x._i=i});
 L.sort(function(a,b){return (GO.indexOf(a.g)-GO.indexOf(b.g))||(a._i-b._i)});
 return L}
function ckSizeHint(type,pipe){var tm=TYPICAL_MM[type],mm=pipeMm(pipe);if(tm&&mm&&pipeFam(pipe)==='upvc'&&mm<tm)return ckLabel(CK_TYPES,type)+' normally has a '+tm+' mm outlet or waste. You picked '+mm+' mm. Check SANS 10252-2.';return ''}
function ckSummary(items,ans,nMarks){var y=0,n=0,a=0,o=0,no=[];items.forEach(function(it){var v=ans[it.k];if(v==='y')y++;else if(v==='a')a++;else if(v==='n'){n++;no.push(it)}else o++});
 var st=(n>0||nMarks>0)?'attn':o>0?'open':'pass';
 return {y:y,n:n,a:a,o:o,no:no,st:st,total:items.length,label:st==='attn'?'Needs attention':st==='open'?'Not finished':'Pass (all points ticked)'}}

/* ---- pick-list of common issues (label, SANS reference). Orientation only. ---- */
var ISS_COMMON=[
 ['Pipe not supported / sagging','SANS 10252-1/-2'],['Joint leaking or wet','SANS 10252-1/-2'],['Pipe kinked, crushed or damaged',''],
 ['No isolating valve','SANS 10252-1'],['Fall looks flat or backward','SANS 10252-2'],['No access (rodding eye) or access blocked','SANS 10252-2'],
 ['Hot pipe not insulated','SANS 10252-1 / 10254'],['Pipe exposed to sun, frost or damage',''],['Wrong pipe or fitting for the job','']];
var ISS_TYPE={
 wc:[['Pan not fixed securely to floor',''],['Pan connector loose or leaking','SANS 10252-2'],['Trap seal lost or pan siphoning','SANS 10252-2'],['Cistern overflow discharges unsafely','SANS 10252-1'],['Flexi hose kinked or old','']],
 basin:[['No trap, or trap has no water seal','SANS 10252-2'],['Waste too far from vent','SANS 10252-2'],['Flexi hose kinked or old',''],['Basin not fixed securely','']],
 bath:[['Trap missing or no water seal','SANS 10252-2'],['Overflow not connected or leaking','SANS 10252-2'],['Bath edge not sealed','']],
 sink:[['No trap, or trap has no water seal','SANS 10252-2'],['Waste too far from vent','SANS 10252-2'],['Flexi hose kinked or old','']],
 geyser:[['No drip tray, or tray has no drain','SANS 10254'],['Safety valve drain not metal','SANS 10254'],['Safety valve drain: upward section or more than 3 bends','SANS 10254'],['Safety valve drain does not discharge where it can be seen','SANS 10254'],['Valve, cap or plug in safety valve drain','SANS 10254'],['No T&P safety valve visible','SANS 10254'],['Vacuum breaker missing or not above geyser top','SANS 10252-1'],['No isolating or non-return valve on cold feed','SANS 10252-1'],['No pressure control valve where supply pressure is high','SANS 10252-1'],['Geyser support looks weak','SANS 10254'],['Exposed or wet wiring \u2013 electrician needed','SANS 10142-1']],
 gully:[['Grid missing','SANS 10252-2'],['Trap seal dry or missing','SANS 10252-2'],['Gully not at the right level for run-off','']],
 stack:[['No vent terminal / stack not vented','SANS 10252-2'],['Offset or sharp bend in stack','SANS 10252-2'],['No rodding eye at the base','SANS 10252-2']],
 tap:[['No backflow protection on outside tap','SANS 10252-1'],['No isolating valve for this tap','SANS 10252-1']],
 drain:[['Sharp 90\u00B0 turn into a horizontal run','SANS 10252-2'],['No inspection / rodding access','SANS 10252-2'],['Pipe laid without proper bedding or support','SANS 10252-2']],
 other:[]};
function issuesFor(type){return {common:ISS_COMMON,type:ISS_TYPE[type]||[]}}

/* ---- state ---- */
var ST=null,SEL=null,DB=null;
function newState(){return {id:null,ts:0,type:'basin',pipe:'u40',base:null,w:0,h:0,items:[],answers:{},notes:'',aiSummary:'',aiRan:false,saved:false,nid:1}}
function marks(){return ST.items.filter(function(i){return i.kind==='m'})}
function ais(){return ST.items.filter(function(i){return i.kind==='ai'})}
function findItem(id){for(var i=0;i<ST.items.length;i++)if(ST.items[i].id===id)return ST.items[i];return null}
function dirty(){ST.saved=false}

/* ---- IndexedDB ---- */
function idb(){
 if(DB)return DB;
 DB=new Promise(function(res,rej){
  if(!window.indexedDB){rej(new Error('no idb'));return}
  var r=indexedDB.open('aps-field',1);
  r.onupgradeneeded=function(){r.result.createObjectStore('checks',{keyPath:'id'})};
  r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}});
 return DB}
function idbDo(mode,fn){return idb().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('checks',mode),st=tx.objectStore('checks'),rq=fn(st);tx.oncomplete=function(){res(rq&&rq.result)};tx.onerror=function(){rej(tx.error)};tx.onabort=function(){rej(tx.error)}})})}

/* ---- photo helpers ---- */
function loadBitmap(blob){
 return new Promise(function(res,rej){
  var u=URL.createObjectURL(blob),im=new Image();
  im.onload=function(){URL.revokeObjectURL(u);res(im)};
  im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('Cannot read this photo'))};
  im.src=u})}
function compress(file){
 var p=(window.createImageBitmap?createImageBitmap(file,{imageOrientation:'from-image'}).catch(function(){return loadBitmap(file)}):loadBitmap(file));
 return p.then(function(im){
  var w=im.width,hh=im.height,k=Math.min(1,MAXPX/Math.max(w,hh));
  var c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(hh*k));
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  if(im.close)im.close();return c})}
function toBlob(c,q){return new Promise(function(res){c.toBlob(function(b){res(b)},'image/jpeg',q||0.85)})}
function blobB64(b){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res(String(fr.result).split(',')[1]||'')};fr.onerror=rej;fr.readAsDataURL(b)})}

/* ---- drawing ---- */
var RED='#e5252a',PUR='#7b3fe4';
function R(cw){return Math.max(12,cw*0.034)}
function wrapText(ctx,text,maxW){var words=String(text).split(/\s+/),lines=[],cur='';words.forEach(function(w){var t=cur?cur+' '+w:w;if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t});if(cur)lines.push(cur);return lines}
function draw(cv,opts){
 opts=opts||{};
 var base=ST.base,cw=base.width,ch=base.height,ctx=cv.getContext('2d');
 if(cv.width!==cw)cv.width=cw;if(cv.height!==ch)cv.height=ch;
 ctx.drawImage(base,0,0);
 var r=R(cw),n=0,fs=Math.round(r*1.15),an=0;
 ctx.lineJoin='round';
 ST.items.forEach(function(it){
  var sel=opts.sel&&it.id===opts.sel;
  if(it.kind==='ai'){
   an++;
   var bx=it.x*cw,by=it.y*ch,bw=(it.w||0.1)*cw,bh=(it.h||0.1)*ch;
   ctx.save();ctx.strokeStyle=PUR;ctx.lineWidth=Math.max(3,r*0.22);ctx.setLineDash([r*0.7,r*0.4]);ctx.strokeRect(bx,by,bw,bh);ctx.restore();
   var lab='AI'+an+' \u2013 AI suggestion \u2013 not checked';ctx.font='700 '+Math.round(fs*0.8)+'px system-ui,Arial';
   var tw=Math.min(cw-4,ctx.measureText(lab).width+r*0.6),th=fs*1.05,lx=Math.max(2,Math.min(bx,cw-tw-2)),ly=by-th>=0?by-th:by;
   ctx.fillStyle=PUR;ctx.fillRect(lx,ly,tw,th);ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText(lab,lx+r*0.3,ly+th/2,tw-r*0.4);
   if(sel){ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,r*0.12);ctx.setLineDash([]);ctx.strokeRect(bx-3,by-3,bw+6,bh+6)}
  }else{
   n++;
   var cx=it.x*cw,cy=it.y*ch;
   if(it.w){ctx.strokeStyle=RED;ctx.lineWidth=Math.max(3,r*0.22);ctx.setLineDash([]);ctx.strokeRect(it.x*cw,it.y*ch,it.w*cw,it.h*ch);cx=it.x*cw;cy=it.y*ch}
   ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=RED;ctx.fill();
   ctx.lineWidth=Math.max(2,r*0.15);ctx.strokeStyle=sel?'#ffe600':'#fff';ctx.stroke();
   ctx.fillStyle='#fff';ctx.font='800 '+fs+'px system-ui,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(n),cx,cy+fs*0.04);ctx.textAlign='left'}
 })}
function numOf(it){var n=0;for(var i=0;i<ST.items.length;i++){var x=ST.items[i];if(x.kind===it.kind)n++;if(x===it)return n}return 0}

/* ---- summary text / export ---- */
function itemLine(it,i){return (it.kind==='ai'?'AI'+i:i)+'. '+(it.label||'(no issue chosen)')+(it.sans?' \u2013 '+it.sans:'')+(it.note?' \u2013 '+it.note:'')}
function summaryText(){
 var items=ckItems(ST.type,ST.pipe),sm=ckSummary(items,ST.answers,marks().length);
 var t=['*SANS self-check (guide only) \u2013 APS Field App*','Installation: '+ckLabel(CK_TYPES,ST.type)+', pipe: '+ckLabel(CK_PIPES,ST.pipe),'Result: '+sm.label+' (self-check, not a certificate)'];
 var m=marks();if(m.length){t.push('','Marked on photo:');m.forEach(function(x,i){t.push(itemLine(x,i+1))})}
 if(sm.no.length){t.push('','Checklist \u2013 answered No:');sm.no.forEach(function(x){t.push('\u2022 '+x.t+(x.s?' ('+x.s+')':''))})}
 var a=ais();if(a.length){t.push('','AI suggestions \u2013 not checked:');a.forEach(function(x,i){t.push(itemLine(x,i+1))})}
 if(ST.notes)t.push('','Notes: '+ST.notes);
 t.push('',DISC,GOF);return t.join('\n')}
function exportCanvas(){
 var base=ST.base,cw=base.width,ch=base.height,fs=Math.max(16,Math.round(cw/46));
 var tmp=document.createElement('canvas');tmp.width=cw;tmp.height=ch;draw(tmp,{});
 var items=ckItems(ST.type,ST.pipe),sm=ckSummary(items,ST.answers,marks().length);
 var lines=[['b','APS Field App \u2013 SANS self-check: '+sm.label],['n',ckLabel(CK_TYPES,ST.type)+', '+ckLabel(CK_PIPES,ST.pipe)+'  \u2022  '+A.fmtDate(new Date().toISOString())]];
 var mm=marks(),aa=ais();
 mm.forEach(function(x,i){lines.push(['n',itemLine(x,i+1)])});
 aa.forEach(function(x,i){lines.push(['p',itemLine(x,i+1)+'  (AI suggestion \u2013 not checked)'])});
 lines.push(['s',DISC+' '+GOF]);
 var out=document.createElement('canvas'),ctx=out.getContext('2d'),pad=Math.round(fs*0.7),lh=Math.round(fs*1.3),wrapped=[];
 ctx.font='600 '+fs+'px system-ui,Arial';
 lines.forEach(function(l){ctx.font=(l[0]==='b'?'800 ':'600 ')+(l[0]==='s'?Math.round(fs*0.8):fs)+'px system-ui,Arial';wrapText(ctx,l[1],cw-pad*2).forEach(function(w){wrapped.push([l[0],w])})});
 out.width=cw;out.height=ch+wrapped.length*lh+pad*2;ctx=out.getContext('2d');
 ctx.drawImage(tmp,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,ch,cw,out.height-ch);
 var y=ch+pad+lh*0.75;
 wrapped.forEach(function(w){var k=w[0];ctx.font=(k==='b'?'800 ':'600 ')+(k==='s'?Math.round(fs*0.8):fs)+'px system-ui,Arial';ctx.fillStyle=k==='p'?PUR:k==='s'?'#555':k==='b'?'#004AAD':'#111';ctx.fillText(w[1],pad,y);y+=lh});
 return out}
function fileName(){var d=new Date();return 'APS-check-'+d.getFullYear()+A.pad(d.getMonth()+1,2)+A.pad(d.getDate(),2)+'-'+A.pad(d.getHours(),2)+A.pad(d.getMinutes(),2)+'.jpg'}
function shareImage(){
 return toBlob(exportCanvas(),0.88).then(function(b){
  var f;try{f=new File([b],fileName(),{type:'image/jpeg'})}catch(e){f=null}
  var txt=summaryText();
  if(f&&navigator.canShare&&navigator.canShare({files:[f]})&&navigator.share){
   return navigator.share({files:[f],text:txt,title:'APS SANS self-check'}).then(function(){A.toast('Shared')},function(e){if(e&&e.name==='AbortError')return;downloadBlob(b);A.doCopy(txt)})}
  downloadBlob(b);A.doCopy(txt);A.toast('Image saved. Text copied \u2013 paste it in WhatsApp');
 })}
function downloadBlob(b){var u=URL.createObjectURL(b),a=h('a',{href:u,download:fileName()});document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)}

/* ---- AI hook ---- */
function aiAvailable(){return !!(A.S.ai&&/^https?:\/\//i.test(A.S.ai))}
function clamp01(v){v=+v;return isFinite(v)?Math.max(0,Math.min(1,v)):0}
function parseAI(j){
 var out=[];if(!j||!Array.isArray(j.findings))return {items:out,summary:(j&&typeof j.summary==='string')?j.summary:''};
 j.findings.slice(0,20).forEach(function(f){
  if(!f||typeof f!=='object')return;
  var label=String(f.label||'').slice(0,160);if(!label)return;
  if(['x','y','w','h'].some(function(k){return typeof f[k]!=='number'||!isFinite(f[k])}))return;
  var w=clamp01(f.w),hh=clamp01(f.h);if(w<0.02)w=0.1;if(hh<0.02)hh=0.1;
  var x=clamp01(f.x),y=clamp01(f.y);if(x+w>1)x=Math.max(0,1-w);if(y+hh>1)y=Math.max(0,1-hh);
  var sev=/^(info|warning|critical)$/.test(f.severity)?f.severity:'warning';
  out.push({kind:'ai',label:label,sans:String(f.sans_ref||'').slice(0,80),note:'',expl:String(f.explanation||'').slice(0,500),sev:sev,x:x,y:y,w:w,h:hh})});
 return {items:out,summary:typeof j.summary==='string'?j.summary.slice(0,1000):''}}
function runAI(btn){
 if(!aiAvailable())return;
 btn.disabled=true;var old=btn.textContent;btn.textContent='Checking\u2026';
 toBlob(ST.base,0.82).then(blobB64).then(function(b64){
  var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},60000);
  var hd={'Content-Type':'application/json'};if(A.S.tok)hd['X-App-Token']=A.S.tok;
  return fetch(A.S.ai,{method:'POST',headers:hd,body:JSON.stringify({image:b64,installationType:ckLabel(CK_TYPES,ST.type),installationTypeId:ST.type,pipeType:ckLabel(CK_PIPES,ST.pipe),notes:ST.notes||''}),signal:ctl.signal}).then(function(r){clearTimeout(to);if(!r.ok)throw new Error('AI service said '+r.status);return r.json()})
 }).then(function(j){
  var p=parseAI(j);
  ST.items=ST.items.filter(function(i){return i.kind!=='ai'});
  p.items.forEach(function(it){it.id='i'+(ST.nid++);ST.items.push(it)});
  ST.aiSummary=p.summary;ST.aiRan=true;dirty();
  A.toast(p.items.length?p.items.length+' AI suggestion'+(p.items.length>1?'s':'')+' added \u2013 not checked':'AI found nothing to flag \u2013 that is not a clearance');
  A.route(true)
 }).catch(function(e){
  btn.disabled=false;btn.textContent=old;
  A.toast('AI check failed'+(e&&e.name==='AbortError'?' (timed out)':'')+'. Use markers and the checklist.');
  var m=document.getElementById('aimsg');if(m)m.textContent='AI check failed. The manual tools still work.'})}

/* ---- main screen ---- */
A.routes.sans=function(args,q,v){
 if(args[0]==='mark')return markScreen(v);
 A.setBar({title:'SANS photo check'});
 v.appendChild(h('div',{class:'verify',id:'disc'},[h('h4',{text:'Read first'}),h('div',{text:DISC}),h('span',{class:'badge',text:GOF})]));
 var cam=h('input',{type:'file',accept:'image/*',capture:'environment',id:'fcam',hidden:true});
 var pick=h('input',{type:'file',accept:'image/*',id:'fpick',hidden:true});
 function onFile(inp){inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];inp.value='';if(f)takePhoto(f)})}
 onFile(cam);onFile(pick);v.appendChild(cam);v.appendChild(pick);
 if(!ST||!ST.base){startScreen(v,cam,pick);return}
 checkScreen(v,cam,pick)};

function takePhoto(file){
 A.toast('Preparing photo\u2026');
 compress(file).then(function(c){
  var keep=ST&&ST.base?{type:ST.type,pipe:ST.pipe}:null;
  ST=newState();if(keep){ST.type=keep.type;ST.pipe=keep.pipe}
  ST.base=c;ST.w=c.width;ST.h=c.height;SEL=null;var tt=document.getElementById('toast');if(tt)tt.classList.remove('show');A.route()
 }).catch(function(e){A.toast(e&&e.message||'Could not open this photo')})}

function startScreen(v,cam,pick){
 v.appendChild(h('div',{class:'emptyph',id:'nophoto'},[h('div',{text:'Take or choose a photo of the installation.'}),h('div',{class:'hint',text:'Photos are shrunk to 1280 px and stay on this phone.'})]));
 v.appendChild(h('div',{class:'btns'},[A.btn('Take photo','pri',function(){cam.click()},{id:'btncam'},'camera'),A.btn('Choose photo','',function(){pick.click()},{id:'btnpick'},'img')]));
 v.appendChild(h('div',{class:'sechd',text:'Saved checks'}));
 var box=h('div',{id:'savedlist'},h('div',{class:'hint',text:'Loading\u2026'}));v.appendChild(box);
 loadSaved(box)}

function loadSaved(box){
 idbDo('readonly',function(st){return st.getAll()}).then(function(all){
  box.innerHTML='';
  all=(all||[]).sort(function(a,b){return b.ts-a.ts});
  if(!all.length){box.appendChild(h('div',{class:'hint',id:'nosaved',text:'Nothing saved yet. Checks you save are kept on this phone.'}));return}
  all.forEach(function(r){
   var u=URL.createObjectURL(r.blob);
   var items=ckItems(r.type,r.pipe),nm=(r.items||[]).filter(function(i){return i.kind==='m'}).length,sm=ckSummary(items,r.answers||{},nm);
   box.appendChild(h('div',{class:'svrow','data-saved':r.id},[
    h('img',{class:'svth',src:u,alt:''}),
    h('button',{type:'button',class:'btn sv',onclick:function(){openSaved(r)}},[ckLabel(CK_TYPES,r.type)+' \u2013 '+sm.label,h('small',{text:new Date(r.ts).toLocaleString()+(nm?' \u2022 '+nm+' marker'+(nm>1?'s':''):'')})]),
    A.btn('','sm dng',function(){if(confirm('Delete this saved check?'))idbDo('readwrite',function(st){return st.delete(r.id)}).then(function(){loadSaved(box)})},{'aria-label':'Delete saved check'},'trash')]))})
 }).catch(function(){box.innerHTML='';box.appendChild(h('div',{class:'hint',text:'Saving is not available in this browser.'}))})}

function openSaved(r){
 loadBitmap(r.blob).then(function(im){
  var c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
  ST=newState();ST.id=r.id;ST.ts=r.ts;ST.type=r.type;ST.pipe=r.pipe;ST.base=c;ST.w=c.width;ST.h=c.height;ST.items=r.items||[];ST.answers=r.answers||{};ST.notes=r.notes||'';ST.aiSummary=r.aiSummary||'';ST.saved=true;
  ST.nid=ST.items.reduce(function(m,i){return Math.max(m,parseInt(String(i.id).slice(1),10)||0)},0)+1;SEL=null;A.route()
 }).catch(function(){A.toast('Could not open this check')})}

function checkScreen(v,cam,pick){
 // type / pipe
 var tsel=A.sel(CK_TYPES,ST.type,function(x){ST.type=x;dirty();A.route(true)});tsel.id='ctype';
 var psel=A.sel(CK_PIPES,ST.pipe,function(x){ST.pipe=x;dirty();A.route(true)});psel.id='cpipe';
 v.appendChild(h('div',{class:'card'},[A.fld('What is in the photo?',tsel),A.fld('Pipe type / size',psel)]));
 var hint=ckSizeHint(ST.type,ST.pipe);if(hint)v.appendChild(h('div',{class:'verify',id:'sizehint'},hint));
 // preview
 var cv=h('canvas',{id:'cv','aria-label':'Photo with markers'});
 var wrap=h('div',{class:'cvwrap'},cv);v.appendChild(wrap);draw(cv,{});
 wrap.addEventListener('click',function(){A.go('#/sans/mark')});
 v.appendChild(h('div',{class:'btns'},[A.btn('Mark up photo','pri',function(){A.go('#/sans/mark')},{id:'markbtn'},'edit'),A.btn('Retake','',function(){cam.click()},{id:'btncam'},'camera'),A.btn('Other photo','',function(){pick.click()},{id:'btnpick'},'img')]));
 // markers
 v.appendChild(h('div',{class:'sechd',text:'Marked issues'}));
 var mk=marks();
 var ml=h('div',{class:'card',id:'mklist'});
 if(!mk.length)ml.appendChild(h('div',{class:'hint',id:'nomarks',text:'No markers yet. Tap "Mark up photo", then tap the photo where something looks wrong.'}));
 mk.forEach(function(it,i){ml.appendChild(markerRow(it,i+1))});
 v.appendChild(ml);
 // AI
 v.appendChild(h('div',{class:'sechd',text:'AI suggestions'}));
 var ac=h('div',{class:'card',id:'aicard'});
 if(aiAvailable()){
  ac.appendChild(h('div',{class:'hint',text:'Sends this photo to your AI checker. Results are suggestions, not checked and not a clearance.'}));
  ac.appendChild(A.btn(ST.aiRan?'Run AI check again':'AI check','ai',function(e){runAI(e.currentTarget)},{id:'aibtn'},'bolt'));
  ac.appendChild(h('div',{class:'hint',id:'aimsg'}));
 }else ac.appendChild(h('div',{class:'hint',id:'ainotset'},'AI check is not set up. Markers and the checklist work without it. (Settings \u2192 AI checker URL.)'));
 var aa=ais();
 aa.forEach(function(it,i){ac.appendChild(markerRow(it,i+1))});
 if(ST.aiSummary)ac.appendChild(h('div',{class:'ainote',id:'aisum'},[h('b',{text:'AI summary (suggestion \u2013 not checked): '}),ST.aiSummary]));
 if(aa.length||ST.aiSummary)ac.appendChild(h('div',{class:'hint',text:'AI suggestions are drawn dashed purple. Accept the ones that are real; delete the rest.'}));
 v.appendChild(ac);
 // checklist
 var items=ckItems(ST.type,ST.pipe);
 v.appendChild(h('div',{class:'sechd',text:'Self-check list'}));
 var lastG='';
 items.forEach(function(it){
  if(it.g!==lastG){v.appendChild(h('div',{class:'ckg',text:it.g}));lastG=it.g}
  var cur=ST.answers[it.k];
  var seg=h('div',{class:'ckseg'},[['y','Yes'],['n','No'],['a','N/A']].map(function(b){
   return h('button',{type:'button',class:'ckb'+(cur===b[0]?' on '+b[0]:''),'data-k':it.k,'data-v':b[0],'aria-pressed':cur===b[0]?'true':'false',onclick:function(){if(ST.answers[it.k]===b[0])delete ST.answers[it.k];else ST.answers[it.k]=b[0];dirty();A.route(true)}},b[1])}));
  v.appendChild(h('div',{class:'ckrow'},[h('div',{class:'ckt'},[it.t,h('span',{class:'cks',text:(it.s?it.s+' \u2022 ':'')+GOF})]),seg]))});
 // summary
 var sm=ckSummary(items,ST.answers,mk.length);
 var sc=h('div',{class:'sumcard '+sm.st,id:'summary'},[h('div',{class:'big',id:'sumlabel',text:sm.label}),
  h('div',{text:sm.y+' yes \u2022 '+sm.n+' no \u2022 '+sm.a+' N/A \u2022 '+sm.o+' not answered'+(mk.length?' \u2022 '+mk.length+' marker'+(mk.length>1?'s':''):'')})]);
 if(sm.no.length||mk.length){var ul=h('ul');mk.forEach(function(x,i){ul.appendChild(h('li',{text:itemLine(x,i+1)}))});sm.no.forEach(function(x){ul.appendChild(h('li',{text:x.t}))});sc.appendChild(ul)}
 sc.appendChild(h('div',{class:'hint',text:'This is your own self-check, not a certificate. '+GOF}));
 v.appendChild(sc);
 // notes
 var nt=h('textarea',{id:'cnotes',rows:3,placeholder:'Notes (address, what you saw, what you told the customer)'});nt.value=ST.notes;
 nt.addEventListener('input',function(){ST.notes=nt.value;dirty()});
 v.appendChild(A.fld('Notes',nt));
 // actions
 var st=h('div',{class:'btns'},[
  A.btn(ST.saved?'Saved':'Save to this phone','pri',function(e){saveCheck(e.currentTarget)},{id:'savebtn'},'check'),
  A.btn('Share photo + text','wa',function(){shareImage()},{id:'sharebtn'},'share'),
  A.btn('WhatsApp text','wa',function(){A.doWA(summaryText())},{id:'watxt'},'chat'),
  A.btn('Copy text','',function(){A.doCopy(summaryText())},{id:'cptxt'},'copy'),
  A.btn('Download marked photo','',function(){toBlob(exportCanvas(),0.88).then(downloadBlob)},{id:'dlbtn'},'download'),
  A.btn('New check','',function(){if(!ST.saved&&!confirm('Start a new check? This one is not saved.'))return;ST=null;SEL=null;A.route()},{id:'newbtn'},'plus')]);
 v.appendChild(st)}

function markerRow(it,n){
 var ai=it.kind==='ai';
 var acts=h('div',{class:'ma'});
 if(ai)acts.appendChild(A.btn('Accept','pri',function(){it.kind='m';it.note=it.note||it.expl||'';dirty();A.route(true)},{'data-acc':it.id}));
 acts.appendChild(A.btn('Edit','',function(){SEL=it.id;A.go('#/sans/mark')},{'data-edit':it.id}));
 acts.appendChild(A.btn('Delete','dng',function(){ST.items=ST.items.filter(function(x){return x!==it});dirty();A.route(true)},{'data-del':it.id}));
 return h('div',{class:'mk'+(ai?' ai':''),'data-mk':it.id},[h('div',{class:'n',text:ai?'AI'+n:n}),h('div',{class:'mt'},[
  ai?h('span',{class:'pill ai',text:'AI suggestion \u2013 not checked'}):null,
  h('div',null,it.label||'(no issue chosen yet)'),
  h('small',{text:[it.sans,it.sev&&ai?it.sev:'',it.note||(ai?it.expl:'')].filter(Boolean).join(' \u2022 ')}),acts])])}

function saveCheck(b){
 if(!ST.id){ST.id='c'+Date.now().toString(36)+A.rand(4)}
 ST.ts=Date.now();
 toBlob(ST.base,0.85).then(function(blob){
  var rec={id:ST.id,ts:ST.ts,type:ST.type,pipe:ST.pipe,blob:blob,items:ST.items,answers:ST.answers,notes:ST.notes,aiSummary:ST.aiSummary};
  return idbDo('readwrite',function(st){return st.put(rec)})
 }).then(function(){ST.saved=true;A.toast('Saved on this phone');b.textContent='Saved'}).catch(function(){A.toast('Could not save (storage full or blocked)')})}

/* ---- annotator ---- */
function markScreen(v){
 if(!ST||!ST.base){A.go('#/sans',true);return}
 A.setBar({title:'Mark up photo',back:'#/sans',onBack:function(){SEL=null;A.go('#/sans',true)}});
 v.appendChild(h('div',{class:'hint',id:'mkhint',text:'Tap the photo to drop a numbered marker. Drag a marker to move it. Tap a marker to edit or delete it.'}));
 var cv=h('canvas',{id:'mcv','aria-label':'Photo to mark up'});
 var wrap=h('div',{class:'cvwrap edit'},cv);v.appendChild(wrap);
 var panel=h('div',{id:'edhost'});v.appendChild(panel);
 function redraw(){draw(cv,{sel:SEL})}
 function pt(e){var r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,k:r.width/cv.width,rw:r.width}}
 function hit(p){
  var rh=p.rw*cv.height/cv.width,px=p.x*p.rw,py=p.y*rh,best=null,bd=1e9;
  for(var i=ST.items.length-1;i>=0;i--){
   var it=ST.items[i],d=1e9;
   if(it.kind==='m')d=Math.hypot(px-it.x*p.rw,py-it.y*rh);
   if(it.w&&px>=it.x*p.rw&&px<=(it.x+it.w)*p.rw&&py>=it.y*rh&&py<=(it.y+it.h)*rh)d=Math.min(d,it.kind==='ai'?0:20);
   if(d<=26&&d<bd){bd=d;best=it}}
  return best}
 var drag=null;
 cv.addEventListener('pointerdown',function(e){
  e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}
  var p=pt(e),it=hit(p);
  drag={it:it,sx:e.clientX,sy:e.clientY,moved:false,p0:p,ox:it?it.x:0,oy:it?it.y:0};
  if(it){SEL=it.id;redraw();panelDraw()}});
 cv.addEventListener('pointermove',function(e){
  if(!drag||!drag.it)return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<6)return;
  drag.moved=true;var p=pt(e),it=drag.it;
  var nx=drag.ox+(p.x-drag.p0.x),ny=drag.oy+(p.y-drag.p0.y);
  if(it.w){nx=Math.max(0,Math.min(1-it.w,nx));ny=Math.max(0,Math.min(1-it.h,ny))}else{nx=Math.max(0,Math.min(1,nx));ny=Math.max(0,Math.min(1,ny))}
  it.x=nx;it.y=ny;dirty();redraw()});
 function up(e){
  if(!drag)return;var d=drag;drag=null;
  if(!d.it&&!d.moved){
   var p=pt(e);
   if(p.x<0||p.x>1||p.y<0||p.y>1)return;
   var it={id:'i'+(ST.nid++),kind:'m',x:p.x,y:p.y,label:'',sans:'',note:''};
   ST.items.push(it);SEL=it.id;dirty();redraw();panelDraw()}
  else if(d.moved)panelDraw()}
 cv.addEventListener('pointerup',up);
 cv.addEventListener('pointercancel',function(){drag=null});
 function panelDraw(){
  panel.innerHTML='';
  var it=SEL&&findItem(SEL);if(!it)return;
  var ai=it.kind==='ai',n=numOf(it);
  var iss=issuesFor(ST.type);
  var s=h('select',{id:'mkissue','aria-label':'Issue'});
  s.appendChild(h('option',{value:'',text:'Choose the issue\u2026'}));
  function grp(name,list){if(!list.length)return;var g=h('optgroup',{label:name});list.forEach(function(x,i){g.appendChild(h('option',{value:name+'|'+i,text:x[0]}))});s.appendChild(g)}
  grp(ckLabel(CK_TYPES,ST.type),iss.type);grp('Common',iss.common);
  s.appendChild(h('option',{value:'other',text:'Other (write it below)'}));
  var cur=it.label;
  if(cur){var found=false;[['Common',iss.common],[ckLabel(CK_TYPES,ST.type),iss.type]].forEach(function(g){g[1].forEach(function(x,i){if(x[0]===cur){s.value=g[0]+'|'+i;found=true}})});if(!found)s.value='other'}
  var free=h('input',{type:'text',id:'mklabel',class:'inp',placeholder:'Issue (your words)',maxlength:'160'});free.value=cur||'';
  var note=h('input',{type:'text',id:'mknote',class:'inp',placeholder:'Note (optional)',maxlength:'300'});note.value=it.note||'';
  s.addEventListener('change',function(){
   if(!s.value){return}
   if(s.value==='other'){free.focus();return}
   var pr=s.value.split('|'),list=pr[0]==='Common'?iss.common:iss.type,x=list[+pr[1]];
   it.label=x[0];it.sans=x[1]||'';free.value=it.label;dirty();redraw()});
  free.addEventListener('input',function(){it.label=free.value;dirty()});
  note.addEventListener('input',function(){it.note=note.value;dirty()});
  var b=h('div',{class:'btns'});
  if(ai)b.appendChild(A.btn('Accept','pri',function(){it.kind='m';it.note=it.note||it.expl||'';dirty();redraw();panelDraw()},{id:'mkacc'}));
  b.appendChild(A.btn('Delete','dng',function(){ST.items=ST.items.filter(function(x){return x!==it});SEL=null;dirty();redraw();panelDraw()},{id:'mkdel'},'trash'));
  b.appendChild(A.btn('Done','pri',function(){SEL=null;redraw();panelDraw()},{id:'mkdone'}));
  panel.appendChild(h('div',{class:'edpanel',id:'edpanel'},[h('h4',{text:ai?'AI suggestion \u2013 not checked':'Marker '+n}),
   ai&&it.expl?h('div',{class:'hint',text:it.expl}):null,
   A.fld('Issue',s),A.fld('Or write your own',free),A.fld('Note',note),b,
   h('div',{class:'hint',text:GOF})]))}
 redraw();panelDraw();
 v.appendChild(h('div',{class:'note',style:'margin-top:12px'},DISC))}
})();
