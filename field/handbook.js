/* APS Field App – Handbook screens (data lives in handbook-data.js) */
(function(){
'use strict';
var A=APSF,h=A.h,GOF=APS_GOF;
var DPATH={};
var TABS=[['diagnose','Diagnose'],['repair','Repair'],['install','Install']];
function byId(id){for(var i=0;i<APS_SCENARIOS.length;i++)if(APS_SCENARIOS[i].id===id)return APS_SCENARIOS[i];return null}
function partsHref(q){return '#/parts?q='+encodeURIComponent(q)}
function gofBadge(){return h('span',{class:'gof',text:GOF})}
function partsRows(list,title){
 if(!list||!list.length)return null;
 var seen={};list=list.filter(function(p){if(seen[p[1]])return false;seen[p[1]]=1;return true});
 return h('div',null,[h('div',{class:'sechd',text:title||'Find parts'}),list.map(function(p){
  return h('a',{class:'pf',href:partsHref(p[1]),'data-find':p[1]},[A.ic('search'),h('span',{text:p[0]}),A.ic('ext')])})])}

/* ---------- list ---------- */
A.routes.book=function(args,q,v){
 if(args[0]&&byId(args[0]))return scenario(byId(args[0]),args[1],v);
 A.setBar({title:'Handbook'});
 var inp=h('input',{id:'q',type:'search',placeholder:'Search scenarios (e.g. geyser, leak, toilet)',autocomplete:'off',enterkeyhint:'search','aria-label':'Search scenarios'});
 var list=h('div',{class:'list',id:'bklist'});
 v.appendChild(h('div',{class:'search'},[inp]));
 v.appendChild(h('div',{class:'hint'},'Pick a situation. Each guide has Diagnose, Repair and Install tabs where they apply. '));
 v.appendChild(list);
 v.appendChild(h('div',{class:'hint'},[gofBadge(),' The app is a memory aid, not a standard. Work to the current SANS and the maker\u2019s instructions.']));
 function draw(){
  var t=inp.value.toLowerCase().split(/\s+/).filter(Boolean);
  list.innerHTML='';
  var n=0;
  APS_SCENARIOS.forEach(function(s){
   var hay=(s.title+' '+s.kw+' '+s.sum).toLowerCase();
   if(t.every(function(w){return hay.indexOf(w)>=0})){n++;
    var tabs=TABS.filter(function(x){return s[x[0]]});
    list.appendChild(h('a',{class:'row',href:'#/book/'+s.id,'data-sc':s.id},[h('span',{class:'t'},[s.title,h('small',{text:s.sum}),tabs.map(function(x){return h('span',{class:'pill',text:x[1]})})]),h('span',{class:'chev',html:A.svg('back').replace('M15 5l-7 7 7 7','M9 5l7 7-7 7')})]))}});
  if(!n)list.appendChild(h('div',{class:'emptyph',id:'nosc',text:'No scenario matches. Try another word.'}))}
 inp.addEventListener('input',draw);draw()};

/* ---------- scenario ---------- */
function scenario(s,tab,v){
 var avail=TABS.filter(function(x){return s[x[0]]});
 var ids=avail.map(function(x){return x[0]});
 if(ids.indexOf(tab)<0)tab=ids[0];
 A.setBar({title:s.title,back:'#/book'});
 v.appendChild(h('h2',{class:'pt',text:s.title}));
 v.appendChild(h('div',{class:'hint'},[s.sum+'  ',gofBadge()]));
 if(avail.length>1){
  var tb=h('div',{class:'tabs',role:'tablist'});
  avail.forEach(function(x){tb.appendChild(h('button',{type:'button',role:'tab','data-tab':x[0],class:x[0]===tab?'on':'','aria-selected':x[0]===tab?'true':'false',onclick:function(){A.replaceHash('#/book/'+s.id+'/'+x[0]);A.route(true)}},x[1]))});
  v.appendChild(tb)}
 var body=h('div',{id:'bkbody'});v.appendChild(body);
 if(tab==='diagnose')diag(s,body);else steps(s,tab,body);
 v.appendChild(h('div',{class:'note',style:'margin-top:14px'},'This guide cannot certify any work as compliant. You are responsible for the job. Electrical work needs a registered electrician and gas work a registered gas installer.'))}

function jump(s,tab,label){return A.btn(label,'sm',function(){A.go('#/book/'+s.id+'/'+tab,true)})}

/* ---------- diagnose ---------- */
function diag(s,box){
 var d=s.diagnose,key='dg.'+s.id;
 var path=DPATH[key]||[];
 // validate saved path
 var node=d.start,ok=[];
 for(var i=0;i<path.length;i++){var nd=d.nodes[node];if(!nd||!nd.opts)break;var o=nd.opts[path[i]];if(!o)break;ok.push(path[i]);node=o[1]}
 path=ok;
 function save(){DPATH[key]=path}
 function render(){
  box.innerHTML='';
  var n=d.start,trail=[];
  path.forEach(function(ix){var nd=d.nodes[n];trail.push([nd.q,nd.opts[ix][0]]);n=nd.opts[ix][1]});
  var nd=d.nodes[n];
  if(trail.length)box.appendChild(h('div',{class:'trail',id:'trail'},trail.map(function(t){return h('span',{text:t[1]})})));
  if(!nd.res){
   box.appendChild(h('div',{class:'qcard',id:'qcard'},[h('div',{class:'qn',text:'Question '+(path.length+1)}),h('div',{class:'qt',text:nd.q}),nd.hint?h('div',{class:'hint',text:nd.hint}):null,
    h('div',{class:'opts'},nd.opts.map(function(o,ix){return h('button',{type:'button',class:'opt','data-opt':ix,onclick:function(){path.push(ix);save();render();window.scrollTo(0,0)}},o[0])}))]));
  }else{
   box.appendChild(result(s,nd,trail))}
  var ctl=h('div',{class:'btns'});
  if(path.length)ctl.appendChild(A.btn('Back one step','',function(){path.pop();save();render()},{id:'dgback'}));
  if(path.length)ctl.appendChild(A.btn('Start again','',function(){path=[];save();render()},{id:'dgreset'},'refresh'));
  box.appendChild(ctl)}
 render()}

function result(s,nd,trail){
 var c=h('section',{class:'qcard result'+(nd.call?' call':''),id:'result'});
 c.appendChild(h('div',{class:'qn',text:'Likely cause'}));
 c.appendChild(h('h3',{text:nd.cause}));
 if(nd.why)c.appendChild(h('p',{text:nd.why}));
 if(nd.call)c.appendChild(h('div',{class:'warn',id:'callbox'},APS_CALLS[nd.call]||''));
 c.appendChild(h('div',{class:'sub',text:'What to do'}));
 c.appendChild(h('ol',null,nd.do.map(function(x){return h('li',{text:x})})));
 var pr=partsRows(nd.parts);if(pr)c.appendChild(pr);
 var b=h('div',{class:'btns'});
 if(nd.next&&s[nd.next])b.appendChild(jump(s,nd.next,nd.next==='repair'?'Go to Repair steps':'Go to Install steps'));
 var txt=shareText(s,nd,trail);
 b.appendChild(A.btn('WhatsApp','wa sm',function(){A.doWA(txt)},{id:'dgwa'},'chat'));
 b.appendChild(A.btn('Copy','sm',function(){A.doCopy(txt)},{id:'dgcopy'},'copy'));
 c.appendChild(b);c.appendChild(gofBadge());
 return c}
function shareText(s,nd,trail){
 var t=['*'+s.title+'* (APS Field App)'];
 trail.forEach(function(x){t.push('\u2022 '+x[0]+' \u2192 '+x[1])});
 t.push('','Likely cause: '+nd.cause);
 if(nd.call)t.push('NOTE: '+APS_CALLS[nd.call]);
 t.push('What to do:');nd.do.forEach(function(x,i){t.push((i+1)+'. '+x)});
 t.push('',GOF);return t.join('\n')}

/* ---------- repair / install ---------- */
function steps(s,tab,box){
 var T=s[tab],key='ck.'+s.id+'.'+tab;
 var done=A.lsGet(key,{});
 (T.warn||[]).forEach(function(w){box.appendChild(h('div',{class:'warn'},w))});
 if(T.tools&&T.tools.length){box.appendChild(h('div',{class:'sechd',text:'Tools'}));box.appendChild(h('div',{class:'toolchips'},T.tools.map(function(x){return h('span',{class:'tc',text:x})})))}
 var pr=partsRows(T.parts,'Parts \u2013 tap to find');if(pr)box.appendChild(pr);
 if(T.steps&&T.steps.length){
  var cnt=h('span',{class:'cnt'}),bar=h('i');
  var wrap=h('div',{class:'chk',id:'steps'});
  wrap.appendChild(h('div',{class:'ch'},[h('b',{text:tab==='install'?'Install steps':'Repair steps'}),cnt]));
  wrap.appendChild(h('div',{class:'prog'},bar));
  function upd(){var n=0;T.steps.forEach(function(_,i){if(done[i])n++});cnt.textContent=n+' / '+T.steps.length;bar.style.width=Math.round(n/T.steps.length*100)+'%'}
  T.steps.forEach(function(st,i){
   var cb=h('input',{type:'checkbox','data-step':i});cb.checked=!!done[i];
   cb.addEventListener('change',function(){if(cb.checked)done[i]=1;else delete done[i];A.lsSet(key,done);upd()});
   wrap.appendChild(h('label',{class:'ci'},[cb,h('span',{text:st})]))});
  box.appendChild(wrap);upd();
  var b=h('div',{class:'btns'});
  b.appendChild(A.btn('Untick all','sm',function(){done={};A.lsSet(key,done);A.route(true)},{id:'stepreset'}));
  var txt=stepsText(s,tab,T);
  b.appendChild(A.btn('WhatsApp','wa sm',function(){A.doWA(txt)},{id:'stwa'},'chat'));
  b.appendChild(A.btn('Copy','sm',function(){A.doCopy(txt)},{id:'stcopy'},'copy'));
  box.appendChild(b)}
 if(T.sans&&T.sans.length)box.appendChild(h('div',{class:'sans',id:'sansnotes'},[h('h4',{text:'SANS / safety notes'}),h('ul',null,T.sans.map(function(x){return h('li',{text:x})})),gofBadge()]));
 if(T.see){var sc=byId(T.see[0]);if(sc)box.appendChild(h('div',{class:'btns'},A.btn(T.see[2],'pri',function(){A.go('#/book/'+T.see[0]+'/'+T.see[1])},{id:'seebtn'},'book')))}}
function stepsText(s,tab,T){
 var t=['*'+s.title+' \u2013 '+(tab==='install'?'Install':'Repair')+'* (APS Field App)'];
 (T.warn||[]).forEach(function(w){t.push('\u26A0 '+w)});
 if(T.tools&&T.tools.length)t.push('','Tools: '+T.tools.join(', '));
 t.push('','Steps:');T.steps.forEach(function(x,i){t.push((i+1)+'. '+x)});
 if(T.sans&&T.sans.length){t.push('','SANS / safety notes:');T.sans.forEach(function(x){t.push('\u2022 '+x)})}
 t.push('',GOF);return t.join('\n')}
})();
