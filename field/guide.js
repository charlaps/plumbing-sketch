/* APS Field App – field guide (safety, daily routine, scripts, forms, calculators).
   Checklist and form answers use the same apsm.chk / apsm.fld keys as the old Field Manual. */
(function(){
'use strict';
if(typeof APSF==='undefined'||typeof APS_GUIDE==='undefined')return;
var A=APSF,h=A.h;
var FB={'co.name':'APS','co.phone':'[our phone number]','co.email':'[our email]','co.bank':'[our banking details]','rate.valid':'[number of]'};
function manGet(k,d){try{var v=localStorage.getItem('apsm.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function manSet(k,v){try{localStorage.setItem('apsm.'+k,JSON.stringify(v));return true}catch(e){A.toast('Phone storage is full');return false}}
var CHK=manGet('chk',{})||{}, FLD=manGet('fld',{})||{};
function saveChk(){manSet('chk',CHK)}
function saveFld(){manSet('fld',FLD)}
function plain(t){return String(t==null?'':t).replace(/\*\*/g,'')}
function rich(t){var f=document.createDocumentFragment();String(t==null?'':t).split('**').forEach(function(s,i){if(!s)return;if(i%2)f.appendChild(h('strong',{text:s}));else f.appendChild(document.createTextNode(s))});return f}
function fv(k){return FLD[k]==null?'':String(FLD[k])}
function fillTpl(t){return String(t).replace(/\{\{([\w.]+)\}\}/g,function(m,k){var v=fv(k).trim();return v||FB[k]||'['+k+']'})}
function pageById(id){for(var s=0;s<APS_GUIDE.length;s++){var pgs=APS_GUIDE[s].pages;for(var i=0;i<pgs.length;i++)if(pgs[i].id===id)return {sec:APS_GUIDE[s],pg:pgs[i]}}return null}
function wa(t){return plain(t)}
function blockText(b){
 switch(b[0]){
  case 'h':return '\n*'+plain(b[1])+'*';
  case 'p':return wa(b[1]);
  case 'ul':return b[1].map(function(x){return '• '+wa(x)}).join('\n');
  case 'ol':return b[1].map(function(x,i){return (i+1)+'. '+wa(x)}).join('\n');
  case 'note':return 'Note: '+wa(b[1]);
  case 'warn':return '⚠ '+wa(b[1]);
  case 'sans':return '• '+wa(b[1])+' (Guide only – check the current standard)';
  case 'verify':return 'Verify: '+plain(b[1]);
  case 'chk':return chkText(b[1],b[2],b[3]);
  case 'table':return b[2].map(function(r){return '• *'+plain(r[0])+'*'+(r.length>1?': '+r.slice(1).map(plain).join('; '):'')}).join('\n');
  case 'fields':return b[3].map(function(f){var v=fv(f[0]).trim();return v?f[1]+': '+v:''}).filter(Boolean).join('\n');
  case 'form':return formText(b[1],b[2],b[3]);
  case 'tpl':return '*'+b[2]+'*\n'+fillTpl(b[3]);
  case 'link':return b[1]+': '+b[2];
  case 'calc':return calcText(b[1]);
  default:return '';
 }
}
function chkText(id,title,items){var st=CHK[id]||[];return '*'+title+'*\n'+items.map(function(it,i){return (st.indexOf(i)>=0?'☑ ':'☐ ')+plain(it)}).join('\n')}
function formText(id,title,flds){
 var lines=[],any=false;
 flds.forEach(function(f){var v=fv(id+'.'+f[0]).trim();if(v){any=true;lines.push(f[1]+': '+v)}});
 if(!any)lines=flds.map(function(f){return f[1]+': '});
 return '*APS – '+title+'*\n'+lines.join('\n')}
function pageText(pg){var out=['*'+plain(pg.title)+'*  (APS Field App)'];pg.b.forEach(function(b){var x=blockText(b);if(x)out.push(x)});return out.join('\n\n')}
function sharePage(pg){A.doWA(pageText(pg))}

var RATIOS=[[46,'1 : 46','SANS min. waste branch'],[40,'1 : 40','SANS min. soil branch'],[60,'1 : 60','site practice – not the standard']];
var SUPPORT={
 upvc:{label:'uPVC waste / soil',rows:[['32 mm',0.6,1.5,'std'],['40 mm',0.6,1.5,'std'],['50 mm',0.6,1.5,'std'],['75 mm',null,null,'mk'],['110 mm',null,null,'mk']]},
 cu:{label:'Copper',rows:[['15 mm',1.2,1.8,'typ'],['22 mm',1.8,2.4,'typ'],['28 mm',1.8,2.4,'typ'],['35 mm',2.4,3.0,'typ'],['42 mm',2.4,3.0,'typ'],['54 mm',2.7,3.0,'typ']]},
 gal:{label:'Galvanised steel',rows:[['15 mm (½″)',1.8,2.4,'typ'],['20 mm (¾″)',2.4,3.0,'typ'],['25 mm (1″)',2.4,3.0,'typ'],['32 mm (1¼″)',2.7,3.0,'typ'],['40 mm (1½″)',3.0,3.6,'typ'],['50 mm (2″)',3.0,3.6,'typ']]},
 pex:{label:'PEX / multilayer',rows:[['16 mm',null,null,'mk'],['20 mm',null,null,'mk'],['26 mm',null,null,'mk'],['32 mm',null,null,'mk']]},
 hdpe:{label:'HDPE (polyethylene)',rows:[['20 – 63 mm',null,null,'mk']]}
};
var SUPTAG={std:'From the standard (SANS 10252-2). Guide only – check the current standard.',typ:'Typical trade value, not from the standard. Verify with the maker or SANS 10252-1.',mk:'Not given here. Use the pipe maker’s table (it depends on the brand and temperature).'};
var calcState={fall:{len:'',ratio:46,custom:''},sup:{mat:'upvc',size:0}};
function num(v){var n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:NaN}
function mm(v){return v+' m ('+Math.round(v*1000)+' mm)'}
function fallCalc(len,ratio){return len*1000/ratio}
function fallRatio(){var s=calcState.fall;return s.ratio==='c'?num(s.custom):s.ratio}
function fallText(){var l=num(calcState.fall.len);if(!isFinite(l))return '';return '*Pipe fall for '+l+' m*\n'+RATIOS.map(function(r){return '1:'+r[0]+' – '+fallCalc(l,r[0]).toFixed(1)+' mm'}).join('\n')+'\nGuide only – check the current standard.'}
function supText(){var m=SUPPORT[calcState.sup.mat],r=m.rows[calcState.sup.size];if(!r)return '';return '*Support spacing – '+m.label+' '+r[0]+'*\n'+(r[1]!=null?'Horizontal: '+mm(r[1])+'\nVertical: '+mm(r[2])+'\n':'Check the maker’s table.\n')+SUPTAG[r[3]]}
function calcText(k){return k==='fall'?fallText():k==='support'?supText():''}
function mkField(label,val,onin,attrs){var i=h('input',Object.assign({type:'text',inputmode:'decimal',autocomplete:'off'},attrs||{}));i.value=val==null?'':val;i.addEventListener('input',function(){onin(i.value)});return h('label',{class:'fl'},[h('span',{text:label}),i])}

function renderCalc(kind){
 if(kind==='fall'){
  var s=calcState.fall,wrap=h('div'),out=h('div',{class:'res','aria-live':'polite','data-out':'fall'}),cu=null;
  function draw(){var l=num(s.len),r=fallRatio();out.innerHTML='';
   if(!isFinite(l)||l<=0){out.appendChild(h('div',{text:'Enter the pipe length in metres.'}));return}
   if(isFinite(r)&&r>0){out.appendChild(h('small',{text:'Drop over '+l+' m at 1 : '+r}));out.appendChild(h('div',{class:'big','data-drop':1,text:fallCalc(l,r).toFixed(1)+' mm'}));out.appendChild(h('small',{text:(1000/r).toFixed(1)+' mm per metre'}))}
   else out.appendChild(h('div',{text:'Enter the custom ratio.'}));
   RATIOS.forEach(function(x){out.appendChild(h('div',{class:'rrow'},[h('span',{text:'1 : '+x[0]+'  '+x[2]}),h('b',{'data-r':x[0],text:fallCalc(l,x[0]).toFixed(1)+' mm'})]))})}
  wrap.appendChild(mkField('Pipe length (metres)',s.len,function(v){s.len=v;draw()},{placeholder:'e.g. 3.5','data-c':'len'}));
  var chips=h('div',{class:'chips'});
  function chipsDraw(){chips.innerHTML='';
   RATIOS.forEach(function(x){chips.appendChild(h('button',{type:'button',class:'chip'+(s.ratio===x[0]?' on':''),'data-ratio':String(x[0]),text:x[1],onclick:function(){s.ratio=x[0];chipsDraw();draw()}}))});
   chips.appendChild(h('button',{type:'button',class:'chip'+(s.ratio==='c'?' on':''),'data-ratio':'c',text:'Custom',onclick:function(){s.ratio='c';chipsDraw();draw()}}));
   if(cu)cu.hidden=s.ratio!=='c'}
  wrap.appendChild(chips);
  cu=mkField('Custom ratio: 1 :',s.custom,function(v){s.custom=v;draw()});wrap.appendChild(cu);
  chipsDraw();wrap.appendChild(out);
  wrap.appendChild(h('div',{class:'sans'},[rich('SANS 10252-2 Table 15 minimum falls: **1 : 46** waste branches, **1 : 40** soil branches. The site practice of 1 : 40 for 50 mm and 1 : 60 for 110 mm is **not** the standard. Guide only – check the current standard.')]));
  wrap.appendChild(h('div',{class:'btns'},[A.btn('WhatsApp','wa',function(){var t=fallText();if(t)A.doWA(t);else A.toast('Enter the length first')},{'data-act':'fallwa'},'chat'),A.btn('Copy','',function(){var t=fallText();if(t)A.doCopy(t);else A.toast('Enter the length first')},{'data-act':'fallcopy'},'copy')]));
  draw();return wrap}
 var s2=calcState.sup,wrap2=h('div'),out2=h('div',{class:'res','aria-live':'polite','data-out':'support'}),sizeSel=h('select',{'data-c':'size'}),matSel=h('select',{'data-c':'mat'});
 Object.keys(SUPPORT).forEach(function(k){matSel.appendChild(h('option',{value:k,text:SUPPORT[k].label}))});matSel.value=s2.mat;
 function sizes(){sizeSel.innerHTML='';SUPPORT[s2.mat].rows.forEach(function(r,i){sizeSel.appendChild(h('option',{value:String(i),text:r[0]}))});sizeSel.value=String(s2.size)}
 function draw2(){var r=SUPPORT[s2.mat].rows[s2.size];out2.innerHTML='';
  if(r[1]!=null){out2.appendChild(h('div',{class:'rrow'},[h('span',{text:'Horizontal runs'}),h('b',{'data-h':1,text:mm(r[1])})]));out2.appendChild(h('div',{class:'rrow'},[h('span',{text:'Vertical runs'}),h('b',{'data-v':1,text:mm(r[2])})]))}
  else out2.appendChild(h('div',{class:'big',text:'Check the maker’s table'}));
  out2.appendChild(h('small',{text:SUPTAG[r[3]]}))}
 matSel.addEventListener('change',function(){s2.mat=matSel.value;s2.size=0;sizes();draw2()});
 sizeSel.addEventListener('change',function(){s2.size=+sizeSel.value;draw2()});
 wrap2.appendChild(h('label',{class:'fl'},[h('span',{text:'Pipe material'}),matSel]));
 wrap2.appendChild(h('label',{class:'fl'},[h('span',{text:'Size'}),sizeSel]));
 sizes();wrap2.appendChild(out2);
 wrap2.appendChild(h('div',{class:'verify'},[rich('Only uPVC waste up to 50 mm comes from the standard (0.6 m horizontal, 1.5 m vertical). Copper and galvanised figures are **typical trade values**. Guide only – check the current standard.')]));
 wrap2.appendChild(h('div',{class:'btns'},[A.btn('WhatsApp','wa',function(){A.doWA(supText())},{'data-act':'supwa'},'chat'),A.btn('Copy','',function(){A.doCopy(supText())},{'data-act':'supcopy'},'copy')]));
 draw2();return wrap2}

function fieldEl(key,f){
 var type=f[2]||'text',ph=f[3]||'',inp;
 if(type==='textarea')inp=h('textarea',{rows:'3',placeholder:ph,'data-fld':key});
 else inp=h('input',{type:type==='number'?'text':type,inputmode:type==='number'?'decimal':(type==='tel'?'tel':null),placeholder:ph,'data-fld':key,autocomplete:'off'});
 inp.value=fv(key);
 inp.addEventListener('input',function(){if(inp.value)FLD[key]=inp.value;else delete FLD[key];saveFld()});
 return h('label',{class:'fl'},[h('span',{text:f[1]}),inp])}
function renderBlock(b){
 switch(b[0]){
  case 'h':return h('h3',{class:'bh',text:plain(b[1])});
  case 'p':return h('p',{class:'bp'},[rich(b[1])]);
  case 'ul':return h('ul',{class:'bl'},b[1].map(function(x){return h('li',null,[rich(x)])}));
  case 'ol':return h('ol',{class:'bl'},b[1].map(function(x){return h('li',null,[rich(x)])}));
  case 'note':return h('div',{class:'note'},[rich(b[1])]);
  case 'warn':return h('div',{class:'warn'},[rich(b[1])]);
  case 'sans':return h('div',{class:'sans'},[rich(b[1]),h('span',{class:'badge',text:'Guide only – check the current standard'})]);
  case 'verify':return h('div',{class:'verify'},[rich(b[1]),h('span',{class:'badge',text:'Verify'})]);
  case 'link':return h('p',null,h('a',{class:'btn pri',href:b[2],rel:'noopener'},[b[1]]));
  case 'goto':return h('p',null,h('a',{class:'btn',href:'#/guide/'+b[2],'data-go':b[2]},[b[1]]));
  case 'table':return renderTable(b);
  case 'chk':return renderChk(b);
  case 'fields':return renderFields(b);
  case 'form':return renderForm(b);
  case 'tpl':return renderTpl(b);
  case 'calc':return renderCalc(b[1]);
  default:return null;
 }
}
function renderTable(b){
 var hd=b[1],rows=b[2],t=h('table',{class:'ct'});
 t.appendChild(h('thead',null,h('tr',null,hd.map(function(x){return h('th',{text:plain(x)})}))));
 var tb=h('tbody');rows.forEach(function(r){tb.appendChild(h('tr',null,r.map(function(c){return h('td',null,[rich(c)])})))});t.appendChild(tb);
 return h('div',{class:'tw'},t)}
function renderChk(b){
 var id=b[1],items=b[3],box=h('div',{class:'chk','data-chkbox':id}),cnt=h('span',{class:'cnt'}),bar=h('i');
 box.appendChild(h('div',{class:'ch'},[h('b',{text:b[2]}),cnt]));box.appendChild(h('div',{class:'prog'},bar));
 var boxes=[];
 function upd(){var st=CHK[id]||[];cnt.textContent=st.length+' / '+items.length;bar.style.width=(items.length?100*st.length/items.length:0)+'%'}
 items.forEach(function(it,i){
  var cb=h('input',{type:'checkbox','data-chk':id+':'+i});cb.checked=(CHK[id]||[]).indexOf(i)>=0;boxes.push(cb);
  cb.addEventListener('change',function(){var st=(CHK[id]||[]).slice();var k=st.indexOf(i);if(cb.checked&&k<0)st.push(i);if(!cb.checked&&k>=0)st.splice(k,1);if(st.length)CHK[id]=st;else delete CHK[id];saveChk();upd()});
  box.appendChild(h('label',{class:'ci'},[cb,h('span',null,[rich(it)])]))});
 var rb=A.btn('Reset','dng sm',null,{'data-reset':id});var armed=false,at;
 rb.addEventListener('click',function(){if(!armed){armed=true;rb.lastChild.textContent='Tap again to reset';clearTimeout(at);at=setTimeout(function(){armed=false;rb.lastChild.textContent='Reset'},3000);return}
  armed=false;rb.lastChild.textContent='Reset';delete CHK[id];saveChk();boxes.forEach(function(c){c.checked=false});upd();A.toast('Checklist reset')});
 box.appendChild(h('div',{class:'btns'},[A.btn('WhatsApp','wa sm',function(){A.doWA(chkText(id,b[2],items))},{'data-share':'chk'},'chat'),A.btn('Copy','sm',function(){A.doCopy(chkText(id,b[2],items))},null,'copy'),rb]));
 upd();return box}
function renderFields(b){
 var c=h('div',{class:'fcard'});c.appendChild(h('h3',{text:b[2]}));
 b[3].forEach(function(f){c.appendChild(fieldEl(f[0],f))});
 c.appendChild(h('div',{class:'btns'},[A.btn('WhatsApp','wa sm',function(){var t=blockText(b);if(!t)A.toast('Nothing filled in yet');else A.doWA('*'+b[2]+'*\n'+t)},{'data-share':'fields'},'chat'),A.btn('Copy','sm',function(){var t=blockText(b);if(!t)A.toast('Nothing filled in yet');else A.doCopy(t)},null,'copy')]));
 c.appendChild(h('p',{class:'snap',text:'Saved on this phone only.'}));return c}
function renderForm(b){
 var id=b[1],title=b[2],flds=b[3],c=h('div',{class:'fcard','data-form':id});
 c.appendChild(h('h3',{text:title}));
 flds.forEach(function(f){c.appendChild(fieldEl(id+'.'+f[0],f))});
 var cl=A.btn('Clear form','dng sm',null,{'data-clear':id}),armed=false,at;
 cl.addEventListener('click',function(){if(!armed){armed=true;cl.lastChild.textContent='Tap again to clear';clearTimeout(at);at=setTimeout(function(){armed=false;cl.lastChild.textContent='Clear form'},3000);return}
  flds.forEach(function(f){delete FLD[id+'.'+f[0]]});saveFld();A.route(true);A.toast('Form cleared')});
 c.appendChild(h('div',{class:'btns'},[A.btn('WhatsApp','wa',function(){A.doWA(formText(id,title,flds))},{'data-share':'form'},'chat'),A.btn('Copy','sm',function(){A.doCopy(formText(id,title,flds))},null,'copy'),cl]));
 c.appendChild(h('p',{class:'snap',text:'Saved on this phone as you type.'}));return c}
function renderTpl(b){
 var c=h('div',{class:'fcard'});c.appendChild(h('h3',{text:b[2]}));
 var ta=h('textarea',{rows:'7','data-tpl':b[1]});ta.value=fillTpl(b[3]);
 c.appendChild(h('label',{class:'fl'},[h('span',{text:'Edit the text, then share or copy'}),ta]));
 c.appendChild(h('div',{class:'btns'},[A.btn('WhatsApp','wa sm',function(){A.doWA(ta.value)},{'data-share':'tpl'},'chat'),A.btn('Copy','sm',function(){A.doCopy(ta.value)},null,'copy')]));
 return c}

function pageBlob(pg){
 var parts=[pg.title,pg.kw||''];
 pg.b.forEach(function(b){
  if(b[0]==='ul'||b[0]==='ol')b[1].forEach(function(x){parts.push(plain(x))});
  else if(b[0]==='chk'){parts.push(b[2]);b[3].forEach(function(x){parts.push(plain(x))})}
  else if(b[0]==='table'){b[1].forEach(function(x){parts.push(x)});b[2].forEach(function(r){r.forEach(function(c){parts.push(plain(c))})})}
  else if(b[0]==='fields'||b[0]==='form'){parts.push(b[2]);b[3].forEach(function(f){parts.push(f[1])})}
  else if(b[0]==='tpl'){parts.push(b[2]);parts.push(plain(b[3]))}
  else if(typeof b[1]==='string')parts.push(plain(b[1]));
 });
 return parts.join(' ').toLowerCase()}
var BLOBS=null;
function blobs(){if(BLOBS)return BLOBS;BLOBS=[];APS_GUIDE.forEach(function(s){s.pages.forEach(function(pg){BLOBS.push({sec:s,pg:pg,t:pageBlob(pg)})})});return BLOBS}

A.routes.guide=function(args,q,v){
 var hit=args[0]?pageById(args[0]):null;
 if(hit){
  A.setBar({title:hit.pg.title,back:'#/guide'});
  v.appendChild(h('p',{class:'crumb',text:hit.sec.title}));
  hit.pg.b.forEach(function(b){var n=renderBlock(b);if(n)v.appendChild(n)});
  v.appendChild(h('div',{class:'btns'},[A.btn('Share page on WhatsApp','wa',function(){sharePage(hit.pg)},{'data-act':'pagewa'},'chat'),A.btn('Copy page','',function(){A.doCopy(pageText(hit.pg))},{'data-act':'pagecopy'},'copy')]));
  return}
 A.setBar({title:'Field guide',back:'#/'});
 v.appendChild(h('div',{class:'note'},[h('b',{text:'From the old Field Manual. '}),'Repair steps are in the Handbook. SANS reminders are under SANS photo check and the Handbook tips. Quotes are made in APS Quote Finale. APS is not VAT-registered.']));
 var inp=h('input',{id:'gqguide',type:'search',class:'search',placeholder:'Search the guide: safety, script, fall…',autocomplete:'off','aria-label':'Search the field guide','data-act':'guidesearch'});
 var list=h('div',{id:'guidelist'});
 v.appendChild(inp);v.appendChild(list);
 function draw(){
  var qv=inp.value.trim().toLowerCase();
  list.innerHTML='';
  if(qv){
   var toks=qv.split(/\s+/).filter(Boolean),hits=blobs().filter(function(e){return toks.every(function(t){return e.t.indexOf(t)>=0})});
   list.appendChild(h('p',{class:'hint',text:hits.length?hits.length+' pages':'Nothing in the guide for that.'}));
   hits.forEach(function(e){list.appendChild(h('a',{class:'row',href:'#/guide/'+e.pg.id,'data-guide':e.pg.id},[h('span',{class:'t'},[e.pg.title,h('small',{text:e.sec.title})]),h('span',{class:'chev',text:'›'})]))});
   return}
  APS_GUIDE.forEach(function(s){
   list.appendChild(h('h3',{class:'sub',text:s.title}));
   if(s.blurb)list.appendChild(h('p',{class:'hint',text:s.blurb}));
   s.pages.forEach(function(pg){list.appendChild(h('a',{class:'row',href:'#/guide/'+pg.id,'data-guide':pg.id},[h('span',{class:'t'},pg.title),h('span',{class:'chev',text:'›'})]))});
  })}
 inp.addEventListener('input',draw);
 draw()};
})();
