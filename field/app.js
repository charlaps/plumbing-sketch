/* APS Field App – core, Parts (Plumblink search), Settings. No secrets in this file. */
var APSF=(function(){
'use strict';
var VERSION='1.0';
var SNAP_FALLBACK='2026-10-04';
var $=function(s,r){return (r||document).querySelector(s)};
var view,barTitle;
var A={VERSION:VERSION,routes:{},nav:0};
var stack=[],replacing=false;

/* ---------------- utils ---------------- */
function h(tag,attrs,kids){
 var e=document.createElement(tag);
 if(attrs)for(var k in attrs){var v=attrs[k];if(v==null||v===false)continue;
  if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.slice(0,2)==='on'&&typeof v==='function')e.addEventListener(k.slice(2),v);
  else if(k==='html')e.innerHTML=v;else if(v===true)e.setAttribute(k,'');else e.setAttribute(k,v)}
 add(e,kids);return e}
function add(e,kids){
 if(kids==null)return e;
 if(!Array.isArray(kids))kids=[kids];
 kids.forEach(function(c){if(c==null||c===false)return;if(Array.isArray(c))add(e,c);else e.appendChild(typeof c==='object'?c:document.createTextNode(String(c)))});
 return e}
var ICONS={
 back:'M15 5l-7 7 7 7',home:'M3 11l9-8 9 8M5 10v10h14V10',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
 book:'M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM4 17a3 3 0 0 1 3-3h12',camera:'M4 8h3l2-3h6l2 3h3v11H4zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
 list:'M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01',plus:'M12 5v14M5 12h14',minus:'M5 12h14',
 trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',share:'M4 12v7h16v-7M12 3v12M8 7l4-4 4 4',
 gear:'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',check:'M5 13l4 4 10-10',copy:'M9 9h11v11H9zM5 15V4h10',
 ext:'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',chat:'M4 20l1.5-4.5A8 8 0 1 1 9 18.5z',edit:'M4 20l4-1 11-11-3-3L5 16z',
 warn:'M12 3l10 18H2zM12 10v5M12 18h.01',lock:'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',download:'M12 4v12M7 11l5 5 5-5M4 20h16',x:'M6 6l12 12M18 6L6 18',
 img:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',bolt:'M13 3L5 14h6l-1 7 8-11h-6z',pin:'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 7v6M9 10h6',refresh:'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'};
function svg(n){return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="'+ICONS[n]+'"/></svg>'}
function ic(n){return h('span',{html:svg(n),style:'display:inline-flex'})}
var toastT;function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2600)}
function lsGet(k,d){try{var v=localStorage.getItem('apsf.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem('apsf.'+k,JSON.stringify(v));return true}catch(e){toast('Phone storage is full');return false}}
function lsDel(k){try{localStorage.removeItem('apsf.'+k)}catch(e){}}
function rand(n){return Math.random().toString(36).slice(2,2+(n||6))}
function pad(n,w){n=String(n);while(n.length<w)n='0'+n;return n}
function money(v){if(!isFinite(v))return '';var s=(Math.round(v*100)/100).toFixed(2);var p=s.split('.');p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'\u00A0');return 'R'+p[0]+'.'+p[1]}
function round2(v){return Math.round(v*100+1e-6)/100}
function doCopy(text){
 function fb(){var t=h('textarea',{style:'position:fixed;left:-9999px;top:0'});t.value=text;document.body.appendChild(t);t.select();try{document.execCommand('copy');toast('Copied')}catch(e){toast('Could not copy')}t.remove()}
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){toast('Copied')},fb);else fb()}
function doWA(text){var u='https://wa.me/?text='+encodeURIComponent(text);var w=window.open(u,'_blank','noopener');if(!w)location.href=u}
function fmtDate(iso){var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(iso||'');if(!m)return iso||'';var mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return (+m[3])+' '+mn[+m[2]-1]+' '+m[1]}
function btn(label,cls,fn,extra,icon){var b=h('button',Object.assign({type:'button',class:'btn '+(cls||'')},extra||{}),[icon?ic(icon):null,label]);if(fn)b.addEventListener('click',fn);return b}
function fld(label,input){return h('label',{class:'fl'},[h('span',{text:label}),input])}
function note(txt,cls){return h('div',{class:cls||'note'},txt)}
function card(title,kids,cls){return h('section',{class:'card '+(cls||'')},[title?h('h3',{text:title}):null].concat(kids))}
function sel(opts,val,fn){var s=h('select');opts.forEach(function(o){s.appendChild(h('option',{value:o[0],text:o[1]}))});s.value=val;s.addEventListener('change',function(){fn(s.value)});return s}
Object.assign(A,{h:h,add:add,ic:ic,svg:svg,toast:toast,lsGet:lsGet,lsSet:lsSet,lsDel:lsDel,money:money,round2:round2,doCopy:doCopy,doWA:doWA,btn:btn,fld:fld,note:note,card:card,sel:sel,rand:rand,fmtDate:fmtDate,pad:pad});

/* ---------------- settings & theme ---------------- */
var SDEF={mk:30,htMk:22.5,htFrom:2000,proxy:'',ai:'',tok:'',cost:0,imk:{},inote:{},waPrices:1,pin:null};
var S=Object.assign({},SDEF,lsGet('s',{}));
S.imk=S.imk||{};S.inote=S.inote||{};
function saveS(){lsSet('s',S)}
var PREF=Object.assign({theme:'auto',size:'m',gloves:'0'},lsGet('pref',{}));
function applyPref(){var d=document.documentElement;d.setAttribute('data-theme',PREF.theme);d.setAttribute('data-size',PREF.size);d.setAttribute('data-gloves',PREF.gloves==='1'?'1':'0');
 var dark=PREF.theme==='dark'||(PREF.theme==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches);var m=$('#themeMeta');if(m)m.setAttribute('content',dark?'#0b1f45':'#004AAD')}
function savePref(){lsSet('pref',PREF);applyPref()}
A.S=S;A.saveS=saveS;A.PREF=PREF;

/* ---------------- PIN (same pattern as the APS Field Manual: salted hash, 5 min auto-lock, 1 min wait after 5 wrong tries) ---------------- */
function sha256(str){
 var u=unescape(encodeURIComponent(str)),b=[],i,j;for(i=0;i<u.length;i++)b.push(u.charCodeAt(i));
 var K=[],H=[],pr=[];for(i=2;pr.length<64;i++){var pm=true;for(j=2;j*j<=i;j++)if(i%j===0){pm=false;break}if(pm)pr.push(i)}
 for(i=0;i<64;i++)K[i]=Math.floor((Math.cbrt(pr[i])%1)*4294967296)>>>0;
 for(i=0;i<8;i++)H[i]=Math.floor((Math.sqrt(pr[i])%1)*4294967296)>>>0;
 var l=b.length*8;b.push(0x80);while(b.length%64!==56)b.push(0);
 for(i=7;i>=0;i--)b.push(i>3?0:(l>>>(i*8))&255);
 function rr(x,n){return (x>>>n)|(x<<(32-n))}
 for(var o=0;o<b.length;o+=64){var w=[];for(i=0;i<16;i++)w[i]=((b[o+i*4]<<24)|(b[o+i*4+1]<<16)|(b[o+i*4+2]<<8)|b[o+i*4+3])>>>0;
  for(i=16;i<64;i++){var s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3),s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}
  var a=H[0],bb=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],hh=H[7];
  for(i=0;i<64;i++){var S1=rr(e,6)^rr(e,11)^rr(e,25),ch=(e&f)^(~e&g),t1=(hh+S1+ch+K[i]+w[i])>>>0,S0=rr(a,2)^rr(a,13)^rr(a,22),mj=(a&bb)^(a&c)^(bb&c),t2=(S0+mj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=bb;bb=a;a=(t1+t2)>>>0}
  H[0]=(H[0]+a)>>>0;H[1]=(H[1]+bb)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+hh)>>>0}
 return H.map(function(x){return pad(x.toString(16),8)}).join('')}
function pinHash(pin,salt){var x=sha256(salt+':'+pin);for(var i=0;i<2000;i++)x=sha256(x+salt+pin);return x}
var unl=false,unlT=0,fails=0,lockUntil=0;
function hasPin(){return !!(S.pin&&S.pin.hash)}
function setPin(pin){var salt=rand(12)+rand(12);S.pin={salt:salt,hash:pinHash(pin,salt)};saveS();unl=true;unlT=Date.now()}
function tryUnlock(pin){if(Date.now()<lockUntil)return 'wait';if(hasPin()&&pinHash(pin,S.pin.salt)===S.pin.hash){unl=true;unlT=Date.now();fails=0;return 'ok'}fails++;if(fails>=5){lockUntil=Date.now()+60000;fails=0}return 'bad'}
function lockNow(){unl=false}
function costVisible(){return !!S.cost&&hasPin()&&unl}
document.addEventListener('click',function(){if(unl)unlT=Date.now()},true);
setInterval(function(){if(unl&&Date.now()-unlT>5*60000){unl=false;toast('Cost price locked again');route(true)}},5000);
A.hasPin=hasPin;A.costVisible=costVisible;A.tryUnlock=tryUnlock;A.setPin=setPin;A.lockNow=lockNow;A._pinUnlocked=function(){return unl};

/* ---------------- router ---------------- */
var cur={name:'',args:[],q:{}};
function parseHash(){
 var raw=location.hash.replace(/^#\/?/,''),qs={},ix=raw.indexOf('?');
 if(ix>=0){try{new URLSearchParams(raw.slice(ix+1)).forEach(function(v,k){qs[k]=v})}catch(e){}raw=raw.slice(0,ix)}
 var p=raw.split('/').filter(Boolean).map(function(x){try{return decodeURIComponent(x)}catch(e){return x}});
 return {name:p[0]||'home',args:p.slice(1),q:qs}}
function go(hash,replace){if(replace){replacing=true;location.replace(hash)}else location.hash=hash}
function route(keep){
 var r=parseHash();cur=r;
 view.className='';view.innerHTML='';
 A.cleanup&&A.cleanup();A.cleanup=null;
 var fn=A.routes[r.name]||A.routes.home;
 setBar({title:'APS Field App'});
 fn(r.args,r.q,view);
 if(!keep)window.scrollTo(0,0);
 view.focus({preventScroll:true})}
var PARENT={parts:'#/',book:'#/',sans:'#/',settings:'#/'};
function setBar(o){
 var back=$('#back'),homeb=$('#homeb'),logo=$('#blogo'),x=$('#barx');
 $('#title').textContent=o.title||'';
 var isHome=o.home;
 back.hidden=!!isHome;homeb.hidden=!!isHome;logo.hidden=!isHome;
 back.innerHTML=svg('back');homeb.innerHTML=svg('home');
 back.onclick=function(){
  if(o.onBack){o.onBack();return}
  if(stack.length>1)history.back();else go(o.back||PARENT[cur.name]||'#/',true)};
 x.innerHTML='';if(o.right)add(x,o.right)}
A.setBar=setBar;A.replaceHash=function(hh){history.replaceState(history.state,'',hh);if(stack.length)stack[stack.length-1]=hh};A.go=go;A.route=route;A.parseHash=parseHash;A.cur=function(){return cur};
A.view=function(){return view};

/* ---------------- home ---------------- */
A.routes.home=function(a,q,v){
 setBar({title:'APS Field App',home:true});
 v.className='home';
 var tiles=[['#/parts','search','PARTS','Plumblink search, prices and photos'],['#/book','book','HANDBOOK','Scenarios: diagnose, repair, install'],['#/sans','camera','SANS PHOTO CHECK','Photo, mark-up and checklist']];
 v.appendChild(h('div',{class:'homebtns'},tiles.map(function(t){
  return h('a',{class:'hbig',href:t[0],'data-home':t[2]},[h('span',{class:'hi',html:svg(t[1])}),h('span',null,[h('b',{text:t[2]}),h('small',{text:t[3]})])])})));
 v.appendChild(h('div',{class:'foot'},[h('span',{text:'APS Field App v'+VERSION}),h('a',{href:'#/settings','data-home':'settings'},[ic('gear'),'Settings'])]))};

/* ---------------- Plumblink data & search ---------------- */
var D={rows:null,loading:null,snap:SNAP_FALLBACK,cats:[],slugs:[],base:'',packs:0,byCode:{},c1:[],c2:{}};
function loadData(){
 if(D.rows)return Promise.resolve(D);
 if(D.loading)return D.loading;
 D.loading=fetch('items.json').then(function(r){if(!r.ok)throw new Error('items '+r.status);return r.json()}).then(function(j){
  D.snap=j.snap||SNAP_FALLBACK;D.cats=j.cats;D.slugs=j.slugs;D.base=j.base;D.packs=j.packs;
  var c1={},c2={};
  D.rows=j.rows.map(function(r,i){
   var cp=D.cats[r[2]],segs=cp.split(' > ');
   var it={i:i,code:r[0],name:r[1],cat:cp,cost:r[3],low:r[4]===1,slug:r[5],ph:r[6],desc:r[7]||'',c1:segs[0],c2:segs[1]||''};
   it.lname=it.name.toLowerCase();
   it.nt=uniq(tokens(it.name));
   var ct=uniq(tokens(segs.slice(-2).join(' '))).filter(function(t){return it.nt.indexOf(t)<0});it.ct=ct;
   it.dt=it.desc?uniq(tokens(it.desc)).filter(function(t){return it.nt.indexOf(t)<0}):[];
   it.cz=it.code.replace(/^0+/,'');
   it.hi=isHigh(it);
   D.byCode[it.code]=it;
   c1[it.c1]=(c1[it.c1]||0)+1;if(it.c2){var k=it.c1+'|'+it.c2;c2[k]=1}
   return it});
  D.c1=Object.keys(c1).sort();
  D.c2={};Object.keys(c2).forEach(function(k){var p=k.split('|');(D.c2[p[0]]=D.c2[p[0]]||[]).push(p[1])});Object.keys(D.c2).forEach(function(k){D.c2[k].sort()});
  return D},function(e){D.loading=null;throw e});
 return D.loading}
function uniq(a){var o={},r=[];a.forEach(function(x){if(!o[x]){o[x]=1;r.push(x)}});return r}
function tokens(s){return (String(s).toLowerCase().replace(/[\u201C\u201D"]/g,' ').replace(/&/g,' and ').match(/\d+(?:[.,]\d+)?(?:\/\d+)?|[a-z]+/g)||[]).map(function(x){return x.replace(',','.')})}
var HI_RE=/geyser|water heater|heat pump|boiler/i,HI_NOT=/spare|element|thermostat|anode|gasket|flange|tray|stand|valve|probe|cable|fuse|display|board|battery|sensor|retrofit|connect|timer|blanket|wise|control|bracket|frame|pipe set|cover|thermometer/i;
function isHigh(it){var s=it.name+' '+it.c1+' '+it.c2;return HI_RE.test(s)&&!HI_NOT.test(it.name)}
function markupFor(it,cost){
 var c=S.imk[it.code];if(c!==undefined&&c!==''&&isFinite(+c))return {pct:+c,kind:'item'};
 if(it.hi&&cost>=(+S.htFrom||0))return {pct:+S.htMk,kind:'high'};
 return {pct:+S.mk,kind:'std'}}
var LIVE=lsGet('live',{});
function liveOf(it){var l=LIVE[it.code];return l&&Date.now()-l.ts<12*3600*1000?l:null}
function costOf(it){var l=liveOf(it);return l?l.price:it.cost}
function sellOf(it){var c=costOf(it);return round2(c*(1+markupFor(it,c).pct/100))}
function itemUrl(it){return D.base+D.slugs[it.slug]+'/'+slugName(it.name)+'-'+it.code+'/'+it.code}
function slugName(n){return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}
A.D=D;A.sellOf=sellOf;A.costOf=costOf;A.itemUrl=itemUrl;A.loadData=loadData;A.tokens=tokens;
var SYN={elbow:['elb','bend'],bend:['elbow','bnd'],toilet:['wc','pan','cistern'],wc:['toilet','pan'],geyser:['heater'],tap:['bibcock'],mixer:['mix'],nonreturn:['check'],tee:['t'],valve:['vlv'],heater:['geyser']};
var STOP={and:1,the:1,for:1,of:1,a:1,to:1,with:1};
function lev(a,b,max){
 var al=a.length,bl=b.length;if(Math.abs(al-bl)>max)return max+1;
 var p2=null,p1=[],i,j;for(j=0;j<=bl;j++)p1[j]=j;
 for(i=1;i<=al;i++){var c=[i],best=i;
  for(j=1;j<=bl;j++){var v=Math.min(p1[j]+1,c[j-1]+1,p1[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));
   if(p2&&j>1&&a.charAt(i-1)===b.charAt(j-2)&&a.charAt(i-2)===b.charAt(j-1))v=Math.min(v,p2[j-2]+1);
   c[j]=v;if(v<best)best=v}
  if(best>max)return max+1;p2=p1;p1=c}
 return p1[bl]}
function isNum(t){return /^\d/.test(t)}
function mt(q,t,fuzzy){
 if(q===t)return 3;
 if(isNum(q)){return isNum(t)&&parseFloat(q)===parseFloat(t)&&q.indexOf('/')<0&&t.indexOf('/')<0?3:0}
 if(isNum(t))return 0;
 if(q.length>=2&&t.indexOf(q)===0)return 2+0.5*q.length/t.length;
 if(q.length>=3&&t.indexOf(q)>0)return 1;
 if(fuzzy&&q.length>=4){var mx=q.length>=8?2:1;if(lev(q,t,mx)<=mx)return 1.1}
 return 0}
function scoreItem(qt,it,fuzzy){
 var tot=0,allName=true;
 for(var k=0;k<qt.length;k++){
  var alts=qt[k],best=0,inName=false;
  for(var a=0;a<alts.length;a++){var q=alts[a],f=a===0?1:0.85;
   for(var i=0;i<it.nt.length;i++){var s=mt(q,it.nt[i],fuzzy)*f;if(s>best){best=s;inName=s>=2.5*f||s>=2}}
   var cb=0;
   for(i=0;i<it.ct.length;i++){var s2=mt(q,it.ct[i],fuzzy)*0.5*f;if(s2>cb)cb=s2}
   for(i=0;i<it.dt.length;i++){var s3=mt(q,it.dt[i],fuzzy)*0.45*f;if(s3>cb)cb=s3}
   if(cb>best&&best===0)best=cb;
   if(q.length>=3&&/^[a-z0-9]+$/.test(q)){
    if(it.code===q||it.cz===q&&q.length>=3){best=Math.max(best,6);inName=true}
    else if((it.code.indexOf(q)===0||(it.cz&&it.cz.indexOf(q)===0))&&q.length>=4){best=Math.max(best,4);inName=true}}
  }
  if(!best)return 0;
  if(!inName)allName=false;tot+=best}
 if(allName)tot+=1.5;
 return tot}
function search(q,c1,c2,fuzzy){
 var rows=D.rows,out=[];
 if(c1)rows=rows.filter(function(r){return r.c1===c1&&(!c2||r.c2===c2)});
 var toks=tokens(q).filter(function(t){return !STOP[t]});
 if(toks.length>1)toks=toks.filter(function(t){return t!=='mm'});
 if(!toks.length){
  if(!c1)return [];
  return rows.slice().sort(function(a,b){return a.name<b.name?-1:1}).map(function(r){return {it:r,s:0}})}
 var qt=toks.map(function(t){return [t].concat(SYN[t]||[])});
 var first=toks[0];
 for(var i=0;i<rows.length;i++){
  var it=rows[i],s=scoreItem(qt,it,fuzzy);
  if(s>0){
   if(it.lname.indexOf(first)===0)s+=0.5;
   s-=it.name.length*0.004;if(it.low)s-=0.3;
   out.push({it:it,s:s})}}
 out.sort(function(a,b){return b.s-a.s||(a.it.name<b.it.name?-1:1)});
 if(!out.length&&!fuzzy)return search(q,c1,c2,true);
 return out}
A.search=search;

/* ---------------- photo packs ---------------- */
var PH={idxP:null,packs:{},urls:{}};
function phIdx(){return PH.idxP||(PH.idxP=fetch('photos.idx').then(function(r){if(!r.ok)throw new Error('idx');return r.arrayBuffer()}).then(function(b){return new Uint32Array(b)}).catch(function(e){PH.idxP=null;throw e}))}
function packName(n){return 'pack-'+pad(n+1,2)+'.bin'}
function phPack(n){return PH.packs[n]||(PH.packs[n]=fetch(packName(n)).then(function(r){if(!r.ok)throw new Error('pack '+r.status);return r.arrayBuffer()}).catch(function(e){delete PH.packs[n];throw e}))}
function phUrl(id){
 if(PH.urls[id])return PH.urls[id];
 PH.urls[id]=phIdx().then(function(ix){var pk=ix[id*3],off=ix[id*3+1],len=ix[id*3+2];return phPack(pk).then(function(buf){return URL.createObjectURL(new Blob([buf.slice(off,off+len)],{type:'image/jpeg'}))})}).catch(function(e){delete PH.urls[id];throw e});
 return PH.urls[id]}
var io=null;
function lazyThumb(box,it){
 if(it.ph<0)return;
 function load(){phUrl(it.ph).then(function(u){var im=h('img',{src:u,alt:'',loading:'lazy'});box.innerHTML='';box.appendChild(im)},function(){})}
 if(!('IntersectionObserver' in window)){load();return}
 if(!io)io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);e.target._ld&&e.target._ld()}})},{rootMargin:'200px'});
 box._ld=load;io.observe(box)}
function cachedPacks(){
 if(!window.caches)return Promise.resolve(0);
 return caches.open('aps-field-v1').then(function(c){var n=0,ps=[];for(var i=0;i<D.packs;i++)ps.push(c.match(packName(i)).then(function(r){if(r)n++}));return Promise.all(ps).then(function(){return n})}).catch(function(){return 0})}
var dlRun=false;
function downloadAll(onp){
 if(dlRun)return Promise.resolve();dlRun=true;
 return loadData().then(function(){
  var i=0;
  function next(){if(i>=D.packs){dlRun=false;onp&&onp(D.packs,D.packs);return Promise.resolve()}
   var n=i++;
   return fetch(packName(n)).then(function(r){return r.ok?r.arrayBuffer():null}).then(function(){onp&&onp(i,D.packs);return next()},function(){dlRun=false;throw new Error('offline')})}
  return next()}).catch(function(e){dlRun=false;throw e})}
A.PH={url:phUrl,cached:cachedPacks,downloadAll:downloadAll};
A.lazyThumb=lazyThumb;

/* ---------------- Parts: state ---------------- */
var P={q:'',c1:'',c2:'',shown:50,scroll:0};
var LIST=lsGet('list',{title:'',items:[]});
if(!LIST||!Array.isArray(LIST.items))LIST={title:'',items:[]};
function saveList(){lsSet('list',LIST)}
function listQty(code){for(var i=0;i<LIST.items.length;i++)if(LIST.items[i].c===code)return LIST.items[i].q;return 0}
function listAdd(code,n){for(var i=0;i<LIST.items.length;i++)if(LIST.items[i].c===code){LIST.items[i].q+=n;if(LIST.items[i].q<1)LIST.items.splice(i,1);saveList();return}
 if(n>0){LIST.items.push({c:code,q:n});saveList()}}
A.listAdd=function(c,n){listAdd(c,n||1)};
function listCount(){return LIST.items.reduce(function(a,x){return a+x.q},0)}
function listBtn(){var n=listCount();var a=h('a',{class:'ib',href:'#/parts/list','aria-label':'Materials list, '+n+' items','data-act':'list',html:svg('list')});if(n)a.appendChild(h('span',{class:'bdg',text:n}));return a}

A.routes.parts=function(args,q,v){
 var sub=args[0];
 if(sub==='item'){return partItem(args[1],v)}
 if(sub==='list'){return partList(v)}
 if(q.q!==undefined){P.q=q.q;P.c1=q.c1||'';P.c2='';P.shown=50;P.scroll=0;if(q.q||q.c1)history.replaceState(history.state,'','#/parts');if(stack.length)stack[stack.length-1]='#/parts'}
 partSearch(v)};
function partSearch(v){
 setBar({title:'Parts',right:[listBtn()],back:'#/'});
 var inp=h('input',{id:'q',type:'search',class:'search',placeholder:'Search: 22mm elbow, geyser element, 039453',autocomplete:'off',autocapitalize:'off',spellcheck:'false',enterkeyhint:'search','aria-label':'Search parts',value:P.q});
 var c1=h('select',{'aria-label':'Category','data-f':'c1'}),c2=h('select',{'aria-label':'Sub-category','data-f':'c2'});
 var out=h('div',{class:'list',id:'res'}),info=h('div',{class:'snap',id:'snap'}),chips=h('div',{class:'chips',id:'chips'}),status=h('div');
 v.appendChild(inp);v.appendChild(h('div',{class:'filters'},[c1,c2]));v.appendChild(chips);v.appendChild(status);v.appendChild(out);v.appendChild(info);
 function fillC1(){c1.innerHTML='';c1.appendChild(h('option',{value:'',text:'All categories'}));D.c1.forEach(function(x){c1.appendChild(h('option',{value:x,text:x.toLowerCase().replace(/(^|[\s&(-])([a-z])/g,function(m,a,b){return a+b.toUpperCase()})}))});c1.value=P.c1;fillC2()}
 function fillC2(){c2.innerHTML='';c2.appendChild(h('option',{value:'',text:'All types'}));var l=D.c2[P.c1]||[];l.forEach(function(x){c2.appendChild(h('option',{value:x,text:x.length>34?x.slice(0,33)+'\u2026':x}))});c2.value=P.c2;c2.hidden=!P.c1||!l.length}
 var timer=null;
 function run(){
  var t0=performance.now();
  out.innerHTML='';chips.innerHTML='';
  var res=search(P.q,P.c1,P.c2);
  if(!P.q.trim()&&!P.c1){
   [['22mm elbow'],['geyser element'],['110 bend'],['basin mixer'],['angle valve'],['ptfe tape']].forEach(function(c){chips.appendChild(h('button',{type:'button',class:'chip','data-chip':c[0],text:c[0],onclick:function(){P.q=c[0];inp.value=c[0];P.shown=50;run()}}))});
   status.innerHTML='';status.appendChild(h('p',{class:'hint',text:'Type a size, name or Plumblink code. Prices shown are APS prices incl VAT.'}));
   info.textContent='Prices as of '+fmtDate(D.snap)+' (Plumblink snapshot)';return}
  status.innerHTML='';
  var shown=res.slice(0,P.shown);
  shown.forEach(function(r){out.appendChild(partRow(r.it))});
  if(!res.length)status.appendChild(h('p',{class:'hint',id:'nores',text:'Nothing found. Try fewer words, or a size like 22 or 110.'}));
  else status.appendChild(h('p',{class:'hint',id:'rescount','data-ms':Math.round(performance.now()-t0),text:res.length+(res.length===1?' item':' items')+(res.length>P.shown?' (showing '+P.shown+')':'')}));
  if(res.length>P.shown)out.appendChild(h('button',{type:'button',class:'btn more',id:'more',text:'Show 50 more',onclick:function(){P.shown+=50;run()}}));
  info.textContent='Prices as of '+fmtDate(D.snap)+' (Plumblink snapshot). Photos from Plumblink.'}
 inp.addEventListener('input',function(){P.q=inp.value;P.shown=50;clearTimeout(timer);timer=setTimeout(run,60)});
 c1.addEventListener('change',function(){P.c1=c1.value;P.c2='';P.shown=50;fillC2();run()});
 c2.addEventListener('change',function(){P.c2=c2.value;P.shown=50;run()});
 status.appendChild(h('p',{class:'hint',text:'Loading parts\u2026'}));
 loadData().then(function(){if(cur.name!=='parts')return;fillC1();run();if(P.scroll)window.scrollTo(0,P.scroll);if(!P.q&&!P.c1&&!P.scroll&&!/Mobi|Android/i.test(navigator.userAgent))inp.focus()},function(){status.innerHTML='';status.appendChild(note('Could not load the parts data. Open the app once while online.','warn'))});
 A.cleanup=function(){P.scroll=window.scrollY};
}
function partRow(it){
 var th=h('div',{class:'th',html:svg('img')});lazyThumb(th,it);
 var live=!!liveOf(it);
 var row=h('a',{class:'prow',href:'#/parts/item/'+it.code,'data-code':it.code},[th,
  h('div',{class:'pinfo'},[h('div',{class:'pname',text:it.name}),h('div',{class:'pmeta',text:it.code+(it.low?' \u00B7 Low stock':'')})]),
  h('div',{class:'pprice'},[money(sellOf(it)),h('small',{text:live?'live':'incl VAT'})])]);
 var q=listQty(it.code);
 var ab=h('button',{type:'button',class:'addb','aria-label':'Add '+it.name+' to list','data-add':it.code,html:svg('plus')});
 if(q)ab.appendChild(h('span',{class:'q',text:q}));
 ab.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();listAdd(it.code,1);var n=listQty(it.code);var o=ab.querySelector('.q');if(o)o.textContent=n;else ab.appendChild(h('span',{class:'q',text:n}));toast('Added: '+it.name.slice(0,40));var b=$('.ib[data-act=list]');if(b){var g=b.querySelector('.bdg');if(g)g.textContent=listCount();else b.appendChild(h('span',{class:'bdg',text:listCount()}))}});
 row.appendChild(ab);return row}

/* ---------------- Parts: item detail ---------------- */
function partItem(code,v){
 setBar({title:'Part',right:[listBtn()],back:'#/parts'});
 v.appendChild(h('p',{class:'hint',text:'Loading\u2026'}));
 loadData().then(function(){
  var it=D.byCode[code];v.innerHTML='';
  if(!it){v.appendChild(note('That item is not in the list.','warn'));return}
  var box=h('div',{class:'dphoto'},it.ph<0?h('span',{class:'ph0',text:'No photo'}):h('span',{class:'ph0',text:'Loading photo\u2026'}));
  if(it.ph>=0)phUrl(it.ph).then(function(u){box.innerHTML='';box.appendChild(h('img',{src:u,alt:it.name,id:'dimg'}))},function(){box.innerHTML='';box.appendChild(h('span',{class:'ph0',text:'Photo not available offline yet'}))});
  v.appendChild(box);
  v.appendChild(h('h2',{class:'dname',text:it.name}));
  v.appendChild(h('div',{class:'crumb'},[it.code+' \u00B7 ',h('a',{href:'#/parts?q=&c1='+encodeURIComponent(it.c1),text:it.cat.replace(/ > /g,' \u203A ')})]));
  var pc=h('section',{class:'card','data-pricecard':1});v.appendChild(pc);
  var liveMsg=h('p',{class:'hint',id:'livemsg'});
  function drawPrice(){
   pc.innerHTML='';
   var l=liveOf(it),cost=costOf(it),mk=markupFor(it,cost),sell=sellOf(it);
   pc.appendChild(h('div',{class:'hint',text:'APS price (incl VAT)'}));
   pc.appendChild(h('div',{class:'bigprice',id:'dprice',text:money(sell)}));
   pc.appendChild(h('p',{class:'hint',id:'dsrc'},[h('span',{class:'lbl'+(l?' live':''),text:l?'live price \u00B7 checked '+new Date(l.ts).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}):'snapshot price'}),' ',l?'':'as of '+fmtDate(D.snap)]));
   if(mk.kind==='high')pc.appendChild(h('p',{class:'hint',text:'High-ticket markup '+mk.pct+'% (geysers / water heaters from '+money(+S.htFrom)+').'}));
   if(mk.kind==='item')pc.appendChild(h('p',{class:'hint',text:'Custom markup '+mk.pct+'% for this item.'}));
   pc.appendChild(h('div',{class:'kv'},[h('span',{text:'Stock'}),h('b',{class:'stk '+((l&&/low/i.test(l.stock))||(!l&&it.low)?'low':(l&&/out/i.test(l.stock)?'low':'in')),text:l&&l.stock?l.stock:(it.low?'Low stock':'In stock')})]));
   if(S.cost){
    if(costVisible()){
     pc.appendChild(h('div',{class:'kv','data-cost':1},[h('span',{text:'Plumblink cost (incl VAT)'}),h('b',{text:money(cost)})]));
     pc.appendChild(h('div',{class:'kv'},[h('span',{text:'Markup'}),h('b',{text:mk.pct+'%'})]))}
    else{
     var pin=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:'PIN',class:'inp','aria-label':'PIN','data-f':'costpin'}),msg=h('p',{class:'hint'});
     var go2=function(){var r=tryUnlock(pin.value);if(r==='ok')drawPrice();else{msg.textContent=r==='wait'?'Too many wrong tries. Wait a minute.':'Wrong PIN';pin.value=''}};
     pin.addEventListener('keydown',function(e){if(e.key==='Enter')go2()});
     pc.appendChild(h('div',{class:'pinbox','data-costlock':1},[h('b',null,'\uD83D\uDD12 Cost price is locked'),pin,btn('Unlock','sm',go2,{'data-act':'costunlock'}),msg]))}}
  }
  drawPrice();
  var q=listQty(it.code);
  var bs=h('div',{class:'btns'});
  var addB=btn(q?'Add one more ('+q+' in list)':'Add to list','pri',function(){listAdd(it.code,1);toast('Added to list');route(true)},{'data-act':'add'},'plus');bs.appendChild(addB);
  if(S.proxy.trim()){
   var lb=btn('Check live price','',function(){
    lb.disabled=true;lb.textContent='Checking\u2026';
    liveLookup(it).then(function(r){LIVE[it.code]=r;lsSet('live',pruneLive(LIVE));drawPrice();liveMsg.textContent='Live price found.';lb.disabled=false;lb.textContent='Check live price'},function(){liveMsg.textContent='Live check not available. Showing the snapshot price.';lb.disabled=false;lb.textContent='Check live price'})},{'data-act':'live'},'refresh');
   bs.appendChild(lb)}
  v.appendChild(bs);v.appendChild(liveMsg);
  v.appendChild(h('a',{class:'btn',href:itemUrl(it),target:'_blank',rel:'noopener',id:'plink','data-act':'plink'},[ic('ext'),'Open on Plumblink']));
  if(it.desc)v.appendChild(card('Details',[h('p',{text:it.desc})]));
  var det=h('details',{class:'card'},[h('summary',{style:'font-weight:700;min-height:44px;display:flex;align-items:center',text:'Markup and note for this item'})]);
  var mi=h('input',{type:'number',inputmode:'decimal',step:'0.5',min:'0',max:'500',placeholder:'Standard '+S.mk+'%','data-f':'imk',value:S.imk[it.code]!==undefined?S.imk[it.code]:''});
  mi.addEventListener('change',function(){var x=mi.value.trim();if(x===''||!isFinite(+x))delete S.imk[it.code];else S.imk[it.code]=+x;saveS();drawPrice();toast('Saved')});
  var ni=h('textarea',{'data-f':'inote',placeholder:'e.g. geyser: use 22.5%, check stock with Plumblink first',text:S.inote[it.code]||''});
  ni.addEventListener('change',function(){if(ni.value.trim())S.inote[it.code]=ni.value.trim();else delete S.inote[it.code];saveS();toast('Saved')});
  det.appendChild(fld('Markup % for this item (blank = standard)',mi));det.appendChild(fld('Note',ni));
  det.appendChild(h('p',{class:'hint',text:'Standard markup is '+S.mk+'%. Geysers and water heaters from '+money(+S.htFrom)+' use '+S.htMk+'%. Change these under Settings.'}));
  v.appendChild(det);
  v.appendChild(h('div',{class:'snap',text:'Prices as of '+fmtDate(D.snap)+' (Plumblink snapshot). Check live or on Plumblink before quoting.'}));
 },function(){v.innerHTML='';v.appendChild(note('Could not load the parts data. Open the app once while online.','warn'))})}
function pruneLive(m){var ks=Object.keys(m).sort(function(a,b){return m[b].ts-m[a].ts}).slice(0,150),o={};ks.forEach(function(k){o[k]=m[k]});LIVE=o;return o}
function liveLookup(it){
 var base=S.proxy.trim().replace(/\/+$/,'');
 var ctl=window.AbortController?new AbortController():null,t=setTimeout(function(){ctl&&ctl.abort()},9000);
 return fetch(base+'/price?code='+encodeURIComponent(it.code)+'&url='+encodeURIComponent(itemUrl(it)),ctl?{signal:ctl.signal}:{}).then(function(r){clearTimeout(t);if(!r.ok)throw new Error('http '+r.status);return r.json()}).then(function(j){
  var p=+j.price;if(!(p>0)||!isFinite(p))throw new Error('bad price');return {price:p,stock:typeof j.stock==='string'?j.stock.slice(0,30):'',ts:Date.now()}})}
A.liveLookup=liveLookup;

/* ---------------- Parts: materials list ---------------- */
function listText(withPrices){
 var L=['*Materials list*'+(LIST.title?' \u2013 '+LIST.title:'')],tot=0;
 if(withPrices)L.push('APS prices incl VAT. Plumblink snapshot '+fmtDate(D.snap)+'.');
 L.push('');
 LIST.items.forEach(function(x){var it=D.byCode[x.c];if(!it)return;var u=sellOf(it);tot+=u*x.q;
  L.push(x.q+' \u00D7 '+it.name+' ('+it.code+')'+(withPrices?' \u2013 '+money(u*x.q)+(x.q>1?' ('+money(u)+' each)':''):''))});
 if(withPrices)L.push('','*Total: '+money(round2(tot))+'* incl VAT');
 return L.join('\n')}
function partList(v){
 setBar({title:'Materials list',back:'#/parts'});
 v.appendChild(h('p',{class:'hint',text:'Loading\u2026'}));
 loadData().then(function(){
  v.innerHTML='';
  if(!LIST.items.length){v.appendChild(h('div',{class:'emptyph',id:'emptylist',text:'Your list is empty. Search for a part and tap the + button.'}));v.appendChild(h('a',{class:'btn pri',href:'#/parts',text:'Search parts'}));return}
  var title=h('input',{type:'text',placeholder:'Job or customer (optional)','data-f':'ltitle',value:LIST.title||'',maxlength:60});
  title.addEventListener('input',function(){LIST.title=title.value;saveList()});
  v.appendChild(fld('List name',title));
  var box=h('section',{class:'card','data-list':1});v.appendChild(box);
  var tail=h('div');v.appendChild(tail);
  function draw(){
   box.innerHTML='';var tot=0;
   LIST.items.forEach(function(x){
    var it=D.byCode[x.c];if(!it)return;var u=sellOf(it);tot+=u*x.q;
    var th=h('div',{class:'th',html:svg('img'),style:'width:48px;height:48px'});lazyThumb(th,it);
    var dec=h('button',{type:'button','aria-label':'One less','data-dec':it.code,html:svg(x.q>1?'minus':'trash')}),inc=h('button',{type:'button','aria-label':'One more','data-inc':it.code,html:svg('plus')});
    dec.addEventListener('click',function(){listAdd(it.code,-1);draw()});inc.addEventListener('click',function(){listAdd(it.code,1);draw()});
    box.appendChild(h('div',{class:'lrow','data-lcode':it.code},[th,h('div',{class:'li'},[h('a',{class:'pname',href:'#/parts/item/'+it.code,text:it.name,style:'color:inherit;text-decoration:none'}),h('div',{class:'pmeta',text:it.code+(S.waPrices?' \u00B7 '+money(u)+' each':'')})]),h('div',{class:'qty'},[dec,h('b',{text:x.q}),inc])]))});
   if(!LIST.items.length){route(true);return}
   tail.innerHTML='';
   tail.appendChild(h('div',{class:'total'},[h('span',{text:'Total (incl VAT)'}),h('span',{id:'ltotal',text:money(round2(tot))})]));
   var sw=h('label',{class:'sw'},[h('input',{type:'checkbox','data-f':'waprices',checked:S.waPrices?'':null}),'Include prices when I copy or share']);
   sw.querySelector('input').addEventListener('change',function(e){S.waPrices=e.target.checked?1:0;saveS();draw()});
   tail.appendChild(sw);
   tail.appendChild(h('div',{class:'btns'},[btn('Share on WhatsApp','wa',function(){doWA(listText(!!S.waPrices))},{'data-act':'lwa'},'chat'),btn('Copy list','',function(){doCopy(listText(!!S.waPrices))},{'data-act':'lcopy'},'copy')]));
   var clr=btn('Clear list','dng',null,{'data-act':'lclear'},'trash');var armed=false;
   clr.addEventListener('click',function(){if(!armed){armed=true;clr.lastChild.textContent='Tap again to clear';setTimeout(function(){armed=false;clr.lastChild.textContent='Clear list'},3000);return}LIST.items=[];LIST.title='';saveList();route(true)});
   tail.appendChild(h('div',{class:'btns'},clr));
   tail.appendChild(h('p',{class:'snap',text:'Prices as of '+fmtDate(D.snap)+' (Plumblink snapshot). Plumblink cost price is never included.'}))}
  draw()},function(){v.innerHTML='';v.appendChild(note('Could not load the parts data.','warn'))})}

/* ---------------- Settings ---------------- */
A.routes.settings=function(a,q,v){
 setBar({title:'Settings',back:'#/'});
 /* look */
 v.appendChild(card('Look',[
  h('div',{class:'sechd',text:'Theme',style:'margin-top:0'}),
  segCtl([['auto','Auto'],['light','Light'],['dark','Dark']],PREF.theme,function(x){PREF.theme=x;savePref()},'theme'),
  h('div',{class:'sechd',text:'Text size'}),
  segCtl([['m','Normal'],['l','Large'],['xl','Extra large']],PREF.size,function(x){PREF.size=x;savePref()},'size'),
  h('label',{class:'sw'},[h('input',{type:'checkbox','data-f':'gloves',checked:PREF.gloves==='1'?'':null,onchange:function(e){PREF.gloves=e.target.checked?'1':'0';savePref()}}),'Gloves mode (bigger buttons, stronger lines)'])]));
 /* prices */
 var mk=h('input',{type:'number',inputmode:'decimal',step:'0.5',min:'0',max:'300','data-f':'mk',value:S.mk}),hm=h('input',{type:'number',inputmode:'decimal',step:'0.5',min:'0',max:'300','data-f':'htmk',value:S.htMk}),hf=h('input',{type:'number',inputmode:'decimal',step:'100',min:'0','data-f':'htfrom',value:S.htFrom});
 function num(el,key,def){el.addEventListener('change',function(){var x=parseFloat(el.value);if(!isFinite(x)||x<0)x=def;S[key]=x;el.value=x;saveS();toast('Saved')})}
 num(mk,'mk',30);num(hm,'htMk',22.5);num(hf,'htFrom',2000);
 var pricesCard=card('Prices',[
  fld('Standard markup % on Plumblink price (default 30)',mk),
  fld('High-ticket markup % (geysers and water heaters, default 22.5)',hm),
  fld('High-ticket applies from this price, incl VAT (R)',hf),
  h('p',{class:'hint',text:'Geyser spares, elements and valves keep the standard markup. You can also set a custom markup on any single part. Prices are Plumblink prices incl VAT plus markup.'})]);
 v.appendChild(pricesCard);
 /* cost price + pin */
 var cp=card('Plumblink cost price',[]);v.appendChild(cp);
 function drawCost(){
  cp.innerHTML='';cp.appendChild(h('h3',{text:'Plumblink cost price'}));
  var msg=h('p',{class:'hint',role:'status'});
  if(!hasPin()){
   cp.appendChild(h('p',{text:'Cost prices are hidden. To show them you must first set a PIN (4 to 8 digits).'}));
   var a1=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:'New PIN','data-f':'pin1'}),a2=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:'Repeat PIN','data-f':'pin2'});
   cp.appendChild(a1);cp.appendChild(h('div',{style:'height:8px'}));cp.appendChild(a2);
   cp.appendChild(h('div',{class:'btns'},btn('Set PIN and show cost price','pri',function(){
    if(!/^\d{4,8}$/.test(a1.value)){msg.textContent='Use 4 to 8 digits.';return}if(a1.value!==a2.value){msg.textContent='The two PINs do not match.';return}
    setPin(a1.value);S.cost=1;saveS();toast('PIN set. Cost price is on.');drawCost()},{'data-act':'setpin'})));
  }else{
   var on=!!S.cost;
   var sw=h('label',{class:'sw'},[h('input',{type:'checkbox','data-f':'cost',checked:on?'':null}),'Show Plumblink cost price on part pages']);
   cp.appendChild(sw);
   var unlockBox=h('div');
   sw.querySelector('input').addEventListener('change',function(e){
    if(!e.target.checked){S.cost=0;saveS();drawCost();return}
    if(A._pinUnlocked()){S.cost=1;saveS();drawCost();return}
    e.target.checked=false;unlockBox.innerHTML='';
    var pin=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:'Enter PIN','data-f':'unlockpin'});
    var ok=function(){var r=tryUnlock(pin.value);if(r==='ok'){S.cost=1;saveS();drawCost()}else{msg.textContent=r==='wait'?'Too many wrong tries. Wait a minute.':'Wrong PIN';pin.value=''}};
    pin.addEventListener('keydown',function(ev){if(ev.key==='Enter')ok()});
    unlockBox.appendChild(h('div',{class:'pinbox'},[pin,btn('Unlock','sm',ok,{'data-act':'unlockcost'})]));pin.focus()});
   cp.appendChild(unlockBox);
   cp.appendChild(h('p',{class:'hint',text:A._pinUnlocked()?'Unlocked. It locks again after 5 minutes of no use.':'Locked. Cost price shows after you enter the PIN.'}));
   var row=h('div',{class:'btns'});
   if(A._pinUnlocked())row.appendChild(btn('Lock now','sm',function(){lockNow();drawCost()},{'data-act':'locknow'},'lock'));
   var chg=btn('Change or remove PIN','sm',function(){changeBox.hidden=!changeBox.hidden},{'data-act':'chpin'});row.appendChild(chg);cp.appendChild(row);
   var changeBox=h('div',{class:'pinbox',hidden:true});
   var old=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:'Current PIN','data-f':'oldpin'}),n1=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:'New PIN (4 to 8 digits)','data-f':'newpin'});
   changeBox.appendChild(old);changeBox.appendChild(h('div',{style:'height:8px'}));changeBox.appendChild(n1);
   changeBox.appendChild(h('div',{class:'btns'},[btn('Save new PIN','sm',function(){var r=tryUnlock(old.value);if(r!=='ok'){msg.textContent=r==='wait'?'Wait a minute.':'Current PIN is wrong.';return}if(!/^\d{4,8}$/.test(n1.value)){msg.textContent='Use 4 to 8 digits.';return}setPin(n1.value);toast('PIN changed');drawCost()}),
    btn('Remove PIN (hides cost)','sm dng',function(){var r=tryUnlock(old.value);if(r!=='ok'){msg.textContent=r==='wait'?'Wait a minute.':'Current PIN is wrong.';return}S.pin=null;S.cost=0;saveS();lockNow();toast('PIN removed. Cost price is hidden.');drawCost()})]));
   cp.appendChild(changeBox)}
  cp.appendChild(msg);
  cp.appendChild(h('p',{class:'hint',text:'The PIN only hides cost on screen. It is not strong encryption.'}))}
 drawCost();
 /* live price */
 var px=h('input',{type:'url',inputmode:'url',placeholder:'https://your-worker.workers.dev','data-f':'proxy',value:S.proxy,autocapitalize:'off',spellcheck:'false'});
 var pmsg=h('p',{class:'hint',id:'pxmsg'});
 px.addEventListener('change',function(){S.proxy=px.value.trim().replace(/\/+$/,'');px.value=S.proxy;saveS();toast('Saved')});
 v.appendChild(card('Live Plumblink price (optional)',[
  h('p',{class:'hint',text:'Leave empty to use the price snapshot only. To get live prices, deploy the small price Worker (see worker/README.md) and paste its address here.'}),
  fld('Price Worker address',px),
  btn('Test it','sm',function(){if(!S.proxy){pmsg.textContent='Nothing set. The app uses the snapshot prices.';return}pmsg.textContent='Testing\u2026';loadData().then(function(){return liveLookup(D.rows[0])}).then(function(r){pmsg.textContent='Works. Live price for the first item: '+money(r.price)+' (cost).'},function(){pmsg.textContent='Could not reach it. The app will keep using snapshot prices.'})},{'data-act':'pxtest'}),pmsg]));
 /* AI */
 var ai=h('input',{type:'url',inputmode:'url',placeholder:'https://your-ai-worker.workers.dev','data-f':'ai',value:S.ai,autocapitalize:'off',spellcheck:'false'});
 var tk=h('input',{type:'password',autocomplete:'off',placeholder:'Shared token (same as APP_TOKEN)','data-f':'tok',value:S.tok});
 ai.addEventListener('change',function(){S.ai=ai.value.trim();ai.value=S.ai;saveS();toast('Saved')});tk.addEventListener('change',function(){S.tok=tk.value.trim();saveS();toast('Saved')});
 v.appendChild(card('AI photo checker (optional)',[
  h('p',{class:'hint',text:'Leave empty and the SANS photo check still works with your own markers and the checklist. AI findings are only suggestions.'}),
  fld('AI checker address',ai),fld('Token',tk),
  h('p',{class:'hint',text:'The token only stops strangers from using your AI Worker. It is stored on this phone. Never put the AI provider key here: it lives in the Worker.'})]));
 /* offline */
 var off=h('p',{class:'hint',id:'offmsg',text:'Checking\u2026'});
 function offStatus(){loadData().then(function(){return cachedPacks()}).then(function(n){off.textContent='Photos saved for offline use: '+n+' of '+D.packs+' packs.'+(n<D.packs?' Tap the button below while online.':' All set.')},function(){off.textContent='Open the app online once to prepare offline use.'})}
 offStatus();
 var dlb=btn('Save all photos for offline use','',function(){dlb.disabled=true;downloadAll(function(i,n){off.textContent='Downloading photos\u2026 '+i+' of '+n}).then(function(){offStatus();dlb.disabled=false;toast('Photos saved')},function(){off.textContent='No connection. Try again online.';dlb.disabled=false})},{'data-act':'dlphotos'},'download');
 var clr=btn('Clear app cache and reload','dng',function(){
  if(!window.caches){location.reload();return}
  caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf('aps-field-')===0}).map(function(k){return caches.delete(k)}))}).then(function(){toast('Cache cleared');setTimeout(function(){location.reload()},500)})},{'data-act':'clearcache'},'trash');
 v.appendChild(card('Offline',[off,h('div',{class:'btns'},[dlb,clr]),h('p',{class:'hint',text:'Clearing the cache keeps your settings, materials list and saved photo checks. Only the downloaded app files and photos are removed.'})]));
 v.appendChild(h('p',{class:'snap'},'APS Field App v'+VERSION+' \u00B7 Prices as of '+fmtDate(D.snap)+' \u00B7 Everything is stored on this phone only.'))};
function segCtl(opts,val,fn,id){var w=h('div',{class:'seg','data-seg':id});opts.forEach(function(o){var b=h('button',{type:'button',class:val===o[0]?'on':'','data-v':o[0],text:o[1]});b.addEventListener('click',function(){[].forEach.call(w.children,function(x){x.classList.toggle('on',x===b)});fn(o[0])});w.appendChild(b)});return w}
A.segCtl=segCtl;

/* ---------------- start ---------------- */
var swReg=false;
function registerSW(){
 if(!('serviceWorker' in navigator))return;
 var had=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(function(){});
 navigator.serviceWorker.addEventListener('controllerchange',function(){if(had)toast('App updated. Close and reopen it to use the new version.');had=true})}
A.start=function(){
 view=$('#view');barTitle=$('#title');
 applyPref();
 stack=[location.hash];
 window.addEventListener('hashchange',function(){var h2=location.hash;if(replacing){replacing=false;stack[stack.length-1]=h2}else if(stack.length>1&&stack[stack.length-2]===h2)stack.pop();else stack.push(h2);route()});
 if(window.matchMedia)try{matchMedia('(prefers-color-scheme:dark)').addEventListener('change',applyPref)}catch(e){}
 route();
 registerSW();
 /* warm the parts data, then quietly save photos for offline use (not on Save-Data) */
 setTimeout(function(){loadData().then(function(){
  var c=navigator.connection;if(c&&c.saveData)return;
  if(navigator.onLine===false)return;
  setTimeout(function(){cachedPacks().then(function(n){if(n<D.packs)downloadAll().catch(function(){})})},4000)}).catch(function(){})},300)};
return A})();
