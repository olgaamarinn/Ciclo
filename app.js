'use strict';
const $=s=>document.querySelector(s),iso=d=>d.toLocaleDateString('sv'),TODAY=iso(new Date());
const add=(s,n)=>{const d=new Date(s+'T00:00');d.setDate(d.getDate()+n);return iso(d)},diff=(a,b)=>Math.round((new Date(b+'T00:00')-new Date(a+'T00:00'))/864e5);
const fmt=(s,o={weekday:'long',month:'long',day:'numeric'})=>new Date(s+'T00:00').toLocaleDateString(undefined,o);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,sd=a=>a.length<2?0:Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1));
const rank=a=>{const ix=a.map((_,i)=>i).sort((i,j)=>a[i]-a[j]),r=[];for(let i=0;i<ix.length;){let j=i;while(j+1<ix.length&&a[ix[j+1]]==a[ix[i]])j++;for(let k=i;k<=j;k++)r[ix[k]]=(i+j)/2+1;i=j+1}return r};
const pear=(a,b)=>{const ma=mean(a),mb=mean(b);let s=0,x=0,y=0;a.forEach((v,i)=>{s+=(v-ma)*(b[i]-mb);x+=(v-ma)**2;y+=(b[i]-mb)**2});return s/Math.sqrt(x*y)},spear=(a,b)=>pear(rank(a),rank(b));
// ---- storage (IndexedDB, one record per day) ----
const db=new Promise((res,rej)=>{const r=indexedDB.open('cycleiq',1);r.onupgradeneeded=()=>r.result.createObjectStore('logs',{keyPath:'date'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async(m,f)=>{const d=await db;return new Promise((res,rej)=>{const t=d.transaction('logs',m),o=f(t.objectStore('logs'));t.oncomplete=()=>res(o.result);t.onerror=()=>rej(t.error)})};
const dbAll=()=>tx('readonly',s=>s.getAll()),put=l=>tx('readwrite',s=>s.put(l)),del=k=>tx('readwrite',s=>s.delete(k)),clr=()=>tx('readwrite',s=>s.clear());
// ---- los ciclos se derivan de los registros: empieza uno en el primer día con flujo tras >=3 días sin él ----
const fl=l=>{if(Object.keys(l).filter(k=>!['date','flow','note'].includes(k)).length<2)return l;const x={...l};F.filter(f=>f.z).forEach(f=>{if(x[f.k]==null)x[f.k]=f.m?[]:0});return x};
function cyc(){const L=Object.values(S.logs).sort((a,b)=>a.date<b.date?-1:1),st=[];
 L.forEach(l=>{if(l.flow>0&&[1,2,3].every(i=>!(S.logs[add(l.date,-i)]?.flow>0)))st.push(l.date)});
 return st.map((s,i)=>{const nx=st[i+1],d={};L.forEach(l=>{const n=diff(s,l.date)+1;if(n>=1&&(!nx||l.date<nx))d[n]=fl(l)});return{s,len:nx?diff(s,nx):null,d}})}
function ovOf(c){const m=Object.entries(c.d).filter(e=>e[1].mucus>=4).map(e=>+e[0]);return m.length?Math.max(...m):null}
function model(){const C=cyc();C.forEach(c=>c.ov=ovOf(c));const done=C.filter(c=>c.len>=15&&c.len<=60),lens=done.map(c=>c.len),ovs=C.map(c=>c.ov).filter(Boolean),last=C[C.length-1];let p=null;
 if(last&&lens.length>=2){const n=lens.length,v=Math.max(sd(lens)**2,1),prec=1/16+n/v,mu=(28/16+n*mean(lens)/v)/prec;// actualización normal-normal; el prior débil de 28 días se diluye con tus datos
  const t2=1/prec,mo=ovs.length?Math.round(mean(ovs))-1:null;p={mu,s:Math.sqrt(t2+v),list:[1,2,3].map(k=>{const st=add(last.s,Math.round(mu*k));return{k,next:st,r:Math.round(1.28*Math.sqrt(k*v+k*k*t2)),ov:mo!=null?add(st,mo):null}}),ov:mo!=null?add(last.s,mo):null}}
 const pls=done.map(c=>{let n=0;while(c.d[n+1]?.flow>0)n++;return n}).filter(n=>n>0),pl=pls.length?Math.round(mean(pls)):5,od=ovs.length?Math.round(mean(ovs)):(lens.length?Math.round(mean(lens))-14:null);
 return{C,done,lens,ovs,last,p,pl,od,gen:!ovs.length&&lens.length>0}}
// ---- campos: g=grupo, s=escala 1-5, o=opciones, m=multiselección, n=número, w=umbral para detectar patrones (lo=bajo, hi=alto) ----
const G={core:'Lo esencial',body:'Cuerpo',mind:'Mente y emociones',soc:'Social y sexualidad'};
const F=[
{k:'flow',g:'core',l:'Flujo menstrual',o:['Nada','Poco','Normal','Abundante'],req:1},
{k:'mucus',g:'core',l:'Flujo vaginal (moco)',o:['Seco','Pegajoso','Cremoso','Acuoso','Clara de huevo'],req:1},
{k:'energy',g:'core',l:'Nivel de energía',s:1,w:'lo'},{k:'mood',g:'core',l:'Estado de ánimo',s:1,w:'lo'},
{k:'pain',g:'body',l:'Dolor',s:1,z:1,w:'hi'},{k:'painType',g:'body',l:'Tipo de dolor',m:1,z:1,pre:'Tipo de dolor: ',o:['Cólicos','Cabeza','Lumbar','Pélvico','Articular','Migraña']},
{k:'breast',g:'body',l:'Sensibilidad en el pecho',s:1,z:1,w:'hi'},{k:'sleep',g:'body',l:'Dormir (horas)',n:[0,14,.5]},{k:'sleepq',g:'body',l:'Calidad del sueño',s:1,w:'lo'},
{k:'dreams',g:'body',l:'Sueños',o:['No recuerdo','Normales','Vívidos','Pesadillas']},{k:'move',g:'body',l:'Actividad física',o:['Ninguna','Suave','Moderada','Intensa']},
{k:'hunger',g:'body',l:'Hambre',s:1,w:'hi'},{k:'cravings',g:'body',l:'Antojos',m:1,z:1,pre:'Antojos de ',o:['Dulce','Salado','Chocolate','Carbohidratos','Grasa']},
{k:'irritab',g:'mind',l:'Irritabilidad',s:1,z:1,w:'hi'},{k:'selfesteem',g:'mind',l:'Autoestima',s:1,w:'lo'},{k:'fulfil',g:'mind',l:'Realización personal',s:1,w:'lo'},
{k:'focus',g:'mind',l:'Concentración',s:1,w:'lo'},{k:'stress',g:'mind',l:'Estrés',s:1,w:'hi'},
{k:'social',g:'soc',l:'Sociabilidad',s:1,w:'lo'},{k:'comm',g:'soc',l:'Comunicación',s:1,w:'lo'},{k:'libido',g:'soc',l:'Libido',s:1,w:'hi'},
{k:'sex',g:'soc',l:'Actividad sexual',o:['Ninguna','Masturbación','Sexo']}];
const PH={m:{n:'Menstrual',e:'🌹',c:'#e8607f',g:'El estrógeno y la progesterona están bajos. Es habitual notar menos energía y más molestias. El ejercicio suave (caminar, yoga, estiramientos) suele sentar bien, y el descanso ayuda.'},
f:{n:'Folicular',e:'🌱',c:'#5b8def',g:'El estrógeno va subiendo. A muchas personas les sube la energía, el ánimo y la concentración. Suele ser buen momento para entrenar más fuerte, aprender cosas nuevas y hacer planes sociales.'},
o:{n:'Ovulatoria',e:'🌸',c:'#2f9e63',g:'Pico de estrógeno y de la hormona LH. La libido y las ganas de socializar suelen estar más altas, y la energía también. Es la fase de mayor fertilidad.'},
l:{n:'Lútea',e:'🌙',c:'#f2a45a',g:'Sube la progesterona. Hacia el final es frecuente notar más hambre, antojos, pecho sensible, irritabilidad y menos energía o concentración. El ejercicio moderado, dormir bien y bajar el ritmo social suelen ayudar.'}};
const GC={core:'#e8607f',body:'#35b59e',mind:'#8e6bd8',soc:'#f2b134'},SC=['#5b8def','#35b59e','#f2b134','#f08a4b','#e8607f'];
const lab=k=>F.find(f=>f.k==k).l.replace(/ \(.*/,'');
let cfg=JSON.parse(localStorage.getItem('ciq')||'{"hide":[]}');const S={tab:'log',date:TODAY,logs:{},month:TODAY.slice(0,7),metric:'energy',sel:[],pt:null,open:{core:1}};
const on=k=>!cfg.hide.includes(k);
// ---- motor de patrones ----
function insights(M){const o=[],C=M.done,P=(t,b,sc,win)=>o.push({t,b,sc,win});
 if(M.lens.length>=3){const m=mean(M.lens),s=sd(M.lens);P(`Tus ciclos duran de media <b>${m.toFixed(0)} días</b> (±${s.toFixed(1)}): ${s<2?'muy regulares':s<4?'bastante regulares':'bastante variables'}.`,`Basado en ${M.lens.length} ciclos completos.`,9);
  if(M.lens.length>=4)C.forEach(c=>{const z=(c.len-m)/(s||1);if(Math.abs(z)>2)P(`El ciclo que empezó el ${fmt(c.s,{day:'numeric',month:'short'})} duró <b>${c.len} días</b>, algo inusual en ti.`,`${z.toFixed(1)} desviaciones típicas respecto a tu media.`,9)})}
 if(M.ovs.length>=2)P(`La ovulación suele aparecer hacia el <b>día ${Math.round(mean(M.ovs))}</b> (entre el ${Math.min(...M.ovs)} y el ${Math.max(...M.ovs)}).`,`Estimada por el día de máximo moco fértil (clara de huevo) en ${M.ovs.length} ciclos.`,8);
 const W=[...F.filter(f=>f.w).map(f=>[f.k,v=>f.w=='lo'?v<=2:v>=4,`${f.l}: nivel ${f.w=='lo'?'bajo':'alto'}`]),['sleep',v=>v<6,'Dormir: menos de 6 horas'],...F.filter(f=>f.m).flatMap(f=>f.o.map(t=>[f.k,v=>v.includes(t.toLowerCase()),f.pre+t.toLowerCase()]))];
 if(C.length>=3){const mx=Math.max(...C.map(c=>c.len));W.forEach(([k,t,lb])=>{const q=[];
  for(let n=1;n<=mx;n++){const lg=C.filter(c=>c.d[n]?.[k]!=null);q.push(lg.length>=3&&lg.filter(c=>t(c.d[n][k])).length/lg.length>=.6)}
  for(let i=0;i<q.length;i++)if(q[i]){let j=i;while(q[j+1])j++;if(j>i){const ds=[];for(let n=i+1;n<=j+1;n++)ds.push(n);const has=c=>ds.some(n=>c.d[n]?.[k]!=null),w=C.filter(has),h=w.filter(c=>ds.some(n=>c.d[n]?.[k]!=null&&t(c.d[n][k])));
   P(`${lb} en los <b>días ${i+1}–${j+1}</b> del ciclo.`,`Se repite en ${h.length} de ${w.length} ciclos.`,3+h.length/w.length,{lb,i:i+1,j:j+1})}i=j}})}
 F.filter(f=>f.s).forEach(f=>{const k=f.k,rows=C.filter(c=>c.ov).map(c=>{const g=(a,b)=>{const v=Object.entries(c.d).filter(e=>+e[0]>=a&&+e[0]<=b&&e[1][k]!=null).map(e=>e[1][k]);return v.length>=3?mean(v):null};return[g(6,c.ov),g(c.ov+1,c.len)]}).filter(r=>r[0]!=null&&r[1]!=null);
  if(rows.length>=3){const up=rows.filter(r=>r[1]>r[0]).length,dn=rows.filter(r=>r[1]<r[0]).length,d=mean(rows.map(r=>r[1]-r[0]));
   if(Math.abs(d)>=.4&&Math.max(up,dn)>=.75*rows.length)P(`${f.l}: <b>más ${d>0?'alto':'bajo'} después de la ovulación</b> (${d>0?'+':''}${d.toFixed(1)} en la escala 0–5).`,`Coincide en ${Math.max(up,dn)} de ${rows.length} ciclos.`,Math.abs(d)*3)}});
 const rows=M.C.flatMap(c=>Object.entries(c.d).map(([n,l])=>({...l,lut:!!c.ov&&+n>c.ov})));
 const cor=sub=>[['sleep','mood'],['sleep','energy'],['sleepq','mood'],['sleepq','energy'],['sleep','irritab'],['sleep','focus'],['pain','mood'],['move','pain'],['move','mood'],['move','energy'],['stress','sleep'],['stress','irritab'],['irritab','social'],['energy','mood'],['selfesteem','mood'],['social','mood'],['libido','mood'],['breast','pain']].map(([a,b])=>{const r=sub.filter(x=>x[a]!=null&&x[b]!=null);return r.length<15?null:{a,b,n:r.length,rho:spear(r.map(x=>x[a]),r.map(x=>x[b]))}}).filter(x=>x&&Math.abs(x.rho)>=.35);
 const txt=(x,pre)=>P(`${pre}<b>${lab(x.a)} y ${lab(x.b).toLowerCase()}</b> ${x.rho>0?'suben y bajan juntos':'van en sentido contrario'}.`,`Spearman ρ = ${x.rho.toFixed(2)} en ${x.n} días. Es una asociación, no prueba que una cause la otra.`,Math.abs(x.rho)*8);
 const all=cor(rows);all.forEach(x=>txt(x,''));
 cor(rows.filter(r=>r.lut)).forEach(x=>{const a=all.find(y=>y.a==x.a&&y.b==x.b);if(!a||Math.abs(x.rho)>=Math.abs(a.rho)+.15)txt(x,'En tu fase lútea: ')});
 return o.sort((a,b)=>b.sc-a.sc)}
// ---- vistas ----
const CS=c=>`background:${c};border-color:${c};color:#1d1a2b`;
const ctl=(f,l)=>{const v=l[f.k];
 if(f.n)return`<input type=number inputmode=decimal data-n=${f.k} min=${f.n[0]} max=${f.n[1]} step=${f.n[2]} value="${v??''}" placeholder="—">`;
 if(f.m)return`<div class=chips>${f.o.map(t=>{const x=t.toLowerCase();return`<button class="chip${(v||[]).includes(x)?' on':''}" style="${(v||[]).includes(x)?CS(GC[f.g]):''}" data-k=${f.k} data-t="${x}">${t}</button>`}).join('')}</div>`;
 return`<div class=chips>${(f.o||['0','1','2','3','4','5']).map((t,i)=>{const x=i;return`<button class="chip${v===x?' on':''}" style="${v===x?CS(GC[f.g]):''}" data-k=${f.k} data-v=${x}>${t}</button>`}).join('')}</div>`};
function vLog(){const l=S.logs[S.date]||{},M=model(),ph=phaseNow(M,S.date),nx=M.p?diff(S.date,M.p.list[0].next):0;
 const sub=ph?`<i class=sw style="background:${ph.k?PH[ph.k].c:'var(--mut)'}"></i>${ph.k?'Fase '+PH[ph.k].n.toLowerCase():'Fase por determinar'}${nx>0?` · Est. ${nx} días hasta la próxima regla`:''}`:'Anota un día de regla para empezar tu primer ciclo';
 return`<h1>${S.date==TODAY?'Hoy':fmt(S.date)}${ph?` · Día ${ph.n}`:''}</h1><p class=sub>${sub}${S.date!=TODAY?' · <a href="#" data-day='+TODAY+'>volver a hoy</a>':''}</p>`+
 Object.entries(G).map(([g,t])=>{const fs=F.filter(f=>f.g==g&&(f.req||on(f.k)));if(!fs.length)return'';const n=fs.filter(f=>l[f.k]!=null).length;
  return`<details class=card style="border-left:5px solid ${GC[g]}" data-g=${g} ${S.open[g]?'open':''}><summary><b style="color:color-mix(in srgb,${GC[g]} 70%,var(--ink))">${t}</b><span class=mut>${n}/${fs.length}</span></summary>${fs.map(f=>`<div class=fld><b>${f.l}</b>${ctl(f,l)}</div>`).join('')}</details>`}).join('')+
 (on('note')?`<div class=card><b>Notas</b><textarea rows=3 data-note placeholder="Cualquier cosa que quieras recordar">${l.note||''}</textarea></div>`:'')}
const phs=(M,ov,n)=>{const o=ov??M.od;if(n<=M.pl)return'm';if(o==null)return null;return n<o-1?'f':n<=o+1?'o':'l'};
function phaseNow(M,date){const c=M.C.filter(c=>c.s<=date).pop();if(!c)return null;const n=diff(c.s,date)+1;if(c.len&&n>c.len)return null;return{n,k:phs(M,c.ov,n)}}
function phStats(M,k){const rows=M.C.flatMap(c=>Object.entries(c.d).map(([n,l])=>({k:phs(M,c.ov,+n),l})));
 return F.filter(x=>x.s||x.k=='move').map(x=>{const a=rows.filter(r=>r.k==k&&typeof r.l[x.k]=='number').map(r=>r.l[x.k]),b=rows.filter(r=>r.k&&r.k!=k&&typeof r.l[x.k]=='number').map(r=>r.l[x.k]);
  return a.length>=5&&b.length>=8?{x,a:mean(a),b:mean(b),n:a.length,d:mean(a)-mean(b)}:null}).filter(s=>s&&Math.abs(s.d)>=.4).sort((p,q)=>Math.abs(q.d)-Math.abs(p.d))}
function phaseCard(M,date,full){const ph=phaseNow(M,date);
 if(!ph)return`<div class=card><b>Fase del ciclo</b><p class=mut>Anota un día de regla y te sitúo en tu ciclo.</p></div>`;
 if(!ph.k)return`<div class=card><b>Día ${ph.n} del ciclo</b><p class=mut>Aún no puedo estimar tu fase: registra tu moco cervical y completa 2 ciclos.</p></div>`;
 const P=PH[ph.k],st=phStats(M,ph.k).slice(0,full?6:2);
 return`<div class=hero style="--pc:${P.c}"><div class=emo>${P.e}</div><div><div class=mut>Día ${ph.n} del ciclo</div><div class=big2>Fase ${P.n}</div>${M.gen?'<div class=mut>Estimada con la regla general de ~14 días de fase lútea. Mejora cuando registras tu moco.</div>':''}</div></div>`+
 `<div class=card style="border-left:5px solid ${P.c}"><b>En tus ciclos</b>${st.length?st.map(s=>`<p>${s.d>0?'▲':'▼'} <b>${s.x.l}</b>: ${s.a.toFixed(1)} de media en esta fase frente a ${s.b.toFixed(1)} el resto del ciclo <span class=mut>(${s.n} días)</span></p>`).join(''):'<p class=mut>Aún no hay suficientes datos tuyos para esta fase (hacen falta unos 5 días registrados en ella y 8 fuera).</p>'}</div>`+
 (full?`<details class=card data-g=gen style="border-left:5px solid ${P.c}" ${S.open.gen?'open':''}><summary><b>En general (no es tuyo)</b><span class=mut>tendencias</span></summary><p>${P.g}</p><p class=mut>Son tendencias generales; no se cumplen igual en todas las personas ni sustituyen a un consejo médico.</p></details>`:'<p class=mut><a href="#" data-tab=ins>Ver más sobre esta fase</a></p>')}
function vCal(){const M=model(),[y,m]=S.month.split('-').map(Number),f=new Date(y,m-1,1),off=(f.getDay()+6)%7,n=new Date(y,m,0).getDate(),ev={},ph={};
 M.C.forEach(c=>{if(c.ov)ev[add(c.s,c.ov-1)]='ov'});if(M.p){if(!M.last.ov&&M.p.ov)ev[M.p.ov]='ovp';M.p.list.forEach(x=>{for(let i=0;i<5;i++)ev[add(x.next,i)]='pp';if(x.ov)ev[x.ov]='ovp'})}
 M.C.forEach(c=>{const e=c.len||(M.p?diff(c.s,M.p.list[0].next):diff(c.s,TODAY)+1);for(let k=1;k<=e;k++)ph[add(c.s,k-1)]=phs(M,c.ov,k)});
 if(M.p)M.p.list.slice(0,2).forEach(x=>{for(let k=1;k<=Math.round(M.p.mu);k++)ph[add(x.next,k-1)]=phs(M,null,k)});
 let h='<span></span>'.repeat(off);
 for(let d=1;d<=n;d++){const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,l=S.logs[ds];h+=`<button class="d ${l?.flow>0?'per':''} ${ev[ds]||''} ${ds==TODAY?'today':''} ${ds>TODAY?'fut':''} ${ph[ds]?'p-'+ph[ds]:''}" data-day=${ds}>${d}${l?'<i></i>':''}</button>`}
 const cur=phaseNow(M,TODAY),nd=cur?cur.n:0,W=insights(M).filter(i=>i.win&&i.win.j>=nd).sort((a,b)=>a.win.i-b.win.i)[0];
 return`<h1>Calendario</h1><div class=row><button class=chip data-mo=-1 aria-label="Mes anterior">‹</button><b>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</b><button class=chip data-mo=1 aria-label="Mes siguiente">›</button></div><div class=cal>${[...'LMXJVSD'].map(x=>`<small>${x}</small>`).join('')}${h}</div><div>${Object.values(PH).map(p=>`<span class=lg style=--pc:${p.c}><i></i>${p.n}</span>`).join('')}</div>${W?`<div class=banner>⚡ <b>${W.win.lb}</b> previsto los días ${W.win.i}–${W.win.j} <span class=mut>${W.win.i>nd?`(en ${W.win.i-nd} días)`:'(ahora)'}</span><div class=mut>${W.b}</div></div>`:''}<p class=mut>Rosa fuerte: regla registrada. Discontinua: regla prevista. Aro verde: ovulación estimada. Los días futuros se ven más claros. Un punto marca un día con registro.</p>`}
function vChart(){const M=model(),C=M.C.slice(-12),k=S.metric,f=F.find(x=>x.k==k),col=['#b07cf0','#e8a23d','#4aa3e8','#13917f','#e8607f','#9a95b0','#d9d04a','#5bd18a','#e88a5b','#7a8cf0','#d05bb5','#5bc8d1'];
 const sel=C.map((c,i)=>S.sel.includes(c.s)?i:-1).filter(i=>i>=0),has=i=>sel.includes(i),all=C.map((_,i)=>i);
 const pts=C.map(c=>Object.entries(c.d).filter(e=>typeof e[1][k]=='number').map(e=>[+e[0],e[1][k]]).sort((a,b)=>a[0]-b[0])),fl=pts.flat();let svg='<p class=mut>Aún no hay datos de esto.</p>',info='';
 if(fl.length){const xs=Math.min(45,Math.max(...fl.map(p=>p[0]))),y0=Math.min(...fl.map(p=>p[1])),y1=Math.max(...fl.map(p=>p[1])),pd=(y1-y0)*.1||.5,X=n=>34+(n-1)/Math.max(xs-1,1)*296,Y=v=>200-(v-y0+pd)/(y1-y0+2*pd)*180,P=a=>a.map(q=>X(q[0]).toFixed(1)+','+Y(q[1]).toFixed(1)).join(' ');
  const base=sel.length>=2?sel:all,mp=[];for(let n=1;n<=xs;n++){const v=base.map(i=>(pts[i].find(q=>q[0]==n)||[])[1]).filter(x=>x!=null);if(v.length>=2)mp.push([n,mean(v)])}
  const last=pts.length-1,hl=i=>sel.length?has(i):i==last,op=i=>sel.length?(has(i)?1:.13):(i==last?1:.6);
  svg=`<svg viewBox="0 0 340 222" width=100% role=img aria-label="Ciclos superpuestos por día de ciclo">${sel.map(i=>C[i].ov?`<line x1=${X(C[i].ov)} x2=${X(C[i].ov)} y1=16 y2=200 stroke=${col[i%12]} stroke-dasharray="2 3"/>`:'').join('')}${pts.map((p,i)=>p.length?`<polyline fill=none stroke=${col[i%12]} stroke-width=${hl(i)?2.8:1.6} opacity=${op(i)} points="${P(p)}"/>`:'').join('')}<polyline fill=none stroke=currentColor stroke-width=2 stroke-dasharray="5 4" points="${P(mp)}"/>${sel.map(i=>pts[i].map(q=>`<circle cx=${X(q[0]).toFixed(1)} cy=${Y(q[1]).toFixed(1)} r=${S.pt==i+'|'+q[0]+'|'+q[1]?7:5} fill=${col[i%12]} stroke=var(--card) stroke-width=2 data-p="${i}|${q[0]}|${q[1]}"/>`).join('')).join('')}<text x=2 y=${Y(y1)+4} font-size=10 fill=currentColor>${+y1.toFixed(1)}</text><text x=2 y=${Y(y0)+4} font-size=10 fill=currentColor>${+y0.toFixed(1)}</text>${[1,7,14,21,28,35,42].filter(n=>n<=xs).map(n=>`<text x=${X(n)} y=216 font-size=10 text-anchor=middle fill=currentColor>${n}</text>`).join('')}</svg>`;
  info=sel.map(i=>{const c=C[i];return`<p><span style="color:${col[i%12]}">●</span> <b>Ciclo del ${fmt(c.s,{day:'numeric',month:'long'})}</b>: ${c.len?c.len+' días':'en curso'}, ${c.ov?'ovulación estimada el día '+c.ov:'sin ovulación estimada'}, ${pts[i].length} días con dato.</p>`}).join('');
  const [pi,pn,pv]=(S.pt||'').split('|');if(S.pt&&has(+pi))info+=`<p>Ciclo del ${fmt(C[+pi].s,{day:'numeric',month:'short'})}, día ${pn}: <b>${f.o?f.o[+pv]:pv}</b></p>`;else if(sel.length)info+='<p class=mut>Toca un punto para ver el valor de ese día. Las líneas verticales punteadas marcan la ovulación estimada de cada ciclo elegido.</p>'}
 return`<h1>Ciclos superpuestos</h1><p class=mut>Tus ciclos alineados en el día 1 de la regla. Toca uno o varios para compararlos; «Todos» los muestra todos. Línea discontinua: media${sel.length>=2?' de los ciclos elegidos':' de tus ciclos'}.</p><div class=chips><button class="chip${sel.length?'':' on'}" data-sel=all>Todos</button>${C.map((c,i)=>`<button class="chip${has(i)?' on':''}" data-sel=${c.s} style="${has(i)?CS(col[i%12]):'border-color:'+col[i%12]}">${fmt(c.s,{day:'numeric',month:'short'})}</button>`).join('')}</div><div class=card style="color:var(--mut)">${svg}</div><div class=chips>${F.filter(x=>(x.k=='sleep'||x.s||x.k=='move')&&(x.req||on(x.k))).map(x=>`<button class="chip${x.k==k?' on':''}" data-m=${x.k}>${lab(x.k)}</button>`).join('')}</div>${info?`<div class=card>${info}</div>`:''}`}
function vIns(){const M=model(),I=insights(M);let h='<h1>Patrones</h1>'+phaseCard(M,TODAY,true);
 if(M.p){const dd=diff(TODAY,M.p.list[0].next);h+=`<div class=card><b>Próximas 3 reglas</b>${M.p.list.map(x=>`<div class=row><span>${fmt(x.next,{weekday:'short',day:'numeric',month:'long'})}</span><span class=mut>±${x.r} días${x.ov?' · ovulación hacia el '+fmt(x.ov,{day:'numeric',month:'short'}):''}</span></div>`).join('')}<p class=mut>${dd>=0?`La primera, dentro de ${dd} días`:`La primera fecha pasó hace ${-dd} días`}. Margen del 80 %, que crece cuanto más lejos miras. Calculado con tus ${M.lens.length} ciclos completos (${mean(M.lens).toFixed(0)} ± ${sd(M.lens).toFixed(1)} días).</p></div>`}
 else h+=`<div class=card><b>Aprendiendo tu ritmo</b><p class=mut>${M.lens.length} de 2 ciclos completos registrados. Las predicciones empiezan cuando tus datos las respaldan.</p></div>`;
 return h+(I.length?I.slice(0,30).map(i=>{const [c,tg]=/suben y bajan|sentido contrario/.test(i.t)?['#35b59e','Relación']:/después de la ovulación/.test(i.t)?['#f2b134','Antes y después de ovular']:/en los <b>días/.test(i.t)?['#8e6bd8','Se repite']:['#e8607f','Resumen'];return`<div class=card style="border-left:5px solid ${c}"><span class=mut style="color:${c}">${tg}</span><div>${i.t}</div><p class=mut>${i.b}</p></div>`}).join('')+(I.length>30?`<p class=mut>Mostrando los 30 patrones más fuertes de ${I.length}.</p>`:''):'<p class=mut>Los patrones aparecen tras unos 3 ciclos con datos. Ajustes → Cargar datos de ejemplo te deja verlos ya.</p>')}
function vSet(){return`<h1>Ajustes</h1><div class=card><b>Qué quieres registrar</b><p class=mut>Flujo menstrual y moco están siempre activos. Desmarca lo que no quieras ver.</p>${[...F.filter(f=>!f.req),{k:'note',l:'Notas'}].map(f=>`<label class=row><span>${f.l}</span><input type=checkbox data-hide=${f.k} ${on(f.k)?'checked':''}></label>`).join('')}</div><div class=card><b>Tus datos</b><p class=mut>Se guardan solo en este navegador, en este dispositivo. No se envían a ningún sitio. No están cifrados: usa el bloqueo del móvil y exporta una copia de vez en cuando.</p><div class=chips><button class=chip data-act=export>Exportar JSON</button><button class=chip data-act=import>Importar JSON</button><input type=file id=imp data-imp accept=".json,application/json" hidden><button class=chip data-act=sample>Cargar datos de ejemplo</button><button class=chip data-act=clear>Borrar todo</button></div></div>`}
const cleanLogs=d=>{if(!Array.isArray(d))return[];const ok=new Set([...F.map(f=>f.k),'note']),out=[];
 for(const r of d){if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.date))continue;const x={date:r.date};
  for(const k in r){if(!ok.has(k))continue;const v=r[k];if(typeof v=='number'&&isFinite(v)||typeof v=='string'&&k=='note'||Array.isArray(v)&&v.every(s=>typeof s=='string'))x[k]=v}
  if(Object.keys(x).length>1)out.push(x)}return out};
async function imp(file){let out;try{out=cleanLogs(JSON.parse(await file.text()))}catch{return toast('Archivo no válido')}
 if(!out.length)return toast('No encontré días válidos');
 if(!confirm(`¿Importar ${out.length} días? Los días que ya tengas con la misma fecha se reemplazarán.`))return;
 for(const x of out){S.logs[x.date]=x;await put(x)}toast(`${out.length} días importados`);render()}
const V={log:vLog,cal:vCal,chart:vChart,ins:vIns,set:vSet};
const render=()=>{$('#v').innerHTML=V[S.tab]();document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab==S.tab))};
let tt;const toast=t=>{const e=$('#toast');e.textContent=t;e.className='s';clearTimeout(tt);tt=setTimeout(()=>e.className='',900)};
async function setv(k,v){const l=S.logs[S.date]||(S.logs[S.date]={date:S.date});if(v===undefined||(Array.isArray(v)&&!v.length)||l[k]===v)delete l[k];else l[k]=v;
 if(Object.keys(l).length==1){delete S.logs[S.date];await del(S.date)}else await put(l);toast('Guardado')}
function sample(){let r=7;const R=()=>(r=r*16807%2147483647)/2147483647-.5,c=(v,a=1,b=5)=>Math.max(a,Math.min(b,Math.round(v))),lens=[29,28,30,33,28,29,9],out=[];
 let d=add(TODAY,-lens.reduce((a,b)=>a+b,0)+1);
 lens.forEach((L,ci)=>{const ov=L-14;for(let n=1;n<=L;n++,d=add(d,1)){const sl=7+R()*2.5,mv=R()>-.1?2:0,lut=ci<6&&n>ov,lt=ci<6&&n>=L-5,lb=ci<6&&n>=L-4,mood=c(3.3+(lut?-.3:.3)+(sl-7)*.5-(lb?.8:0)+R()),lib=c(2.4+(n>=ov-4&&n<=ov+1?1.8:0)+R());
  const x={date:d,flow:n<=5?[3,3,2,1,1][n-1]:0,mucus:n<=5?0:n>=ov-2&&n<=ov?4:n<ov?2:1,sleep:+sl.toFixed(1),move:mv,
   energy:c(3.4+(n<=ov?.5:-.2)-(n>=L-5&&n<=L-3?2:0)+R()),mood,pain:c((n<=3?3.5:1.3)-(mv?.8:0)+R()),stress:c(2.5+R()*2),sleepq:c(3.6+(sl-7)*.6+R()),
   breast:c(1.3+(lut?1.2:0)+(lt?1:0)+R()),hunger:c(2.5+(lt?1.2:0)+R()),irritab:c(2+(lt?1.8:0)+R()),selfesteem:c(3.3+(lut?-.2:.3)+(sl-7)*.2-(lb?.7:0)+R()),fulfil:c(3.2+R()*1.2),
   focus:c(3.6-(lt?.9:0)+R()),social:c(3.2+(n<=ov?.6:-.2)-(lt?.9:0)+R()),comm:c(3.4-(lt?.7:0)+R()),libido:lib,dreams:lut?(R()>0?2:1):1};
  if(lt&&R()>-.3)x.cravings=['dulce','chocolate'];if(n<=3)x.painType=R()>.3?['cólicos','lumbar']:['cólicos'];if(lib>=4&&R()>-.2)x.sex=R()>0?2:1;out.push(x)}});return out}
document.addEventListener('click',async e=>{const t=e.target.closest('button,a,[data-p]');if(!t)return;const D=t.dataset;
 if(D.tab){S.tab=D.tab;return render()}if(D.day){e.preventDefault();S.date=D.day;S.tab='log';return render()}
 if(D.mo){const x=new Date(+S.month.slice(0,4),+S.month.slice(5)-1+ +D.mo,1);S.month=iso(x).slice(0,7);return render()}
 if(D.sel!==undefined){S.sel=D.sel=='all'?[]:S.sel.includes(D.sel)?S.sel.filter(x=>x!=D.sel):[...S.sel,D.sel];S.pt=null;return render()}if(D.p){S.pt=D.p;return render()}if(D.m){S.metric=D.m;S.pt=null;return render()}if(D.v!==undefined){await setv(D.k,+D.v);return render()}
 if(D.t!==undefined){const a=(S.logs[S.date]||{})[D.k]||[];await setv(D.k,a.includes(D.t)?a.filter(x=>x!=D.t):[...a,D.t]);return render()}
 if(D.act=='import')return $('#imp').click();
 if(D.act=='export'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(Object.values(S.logs),null,1)],{type:'application/json'}));a.download='cycleiq-export.json';a.click()}
 if(D.act=='sample'&&(!Object.keys(S.logs).length||confirm('¿Reemplazar tus datos por datos de ejemplo?'))){await clr();S.logs={};for(const l of sample()){S.logs[l.date]=l;await put(l)}toast('Datos de ejemplo cargados');S.tab='ins';render()}
 if(D.act=='clear'&&confirm('¿Borrar todos los datos? No se puede deshacer.')){await clr();S.logs={};toast('Borrado');render()}});
document.addEventListener('change',async e=>{const t=e.target,D=t.dataset;
 if(D.imp!==undefined){if(t.files[0])await imp(t.files[0]);t.value=''}
 if(D.n!==undefined)await setv(D.n,t.value===''?undefined:+t.value);if(D.note!==undefined)await setv('note',t.value.trim()||undefined);
 if(D.hide){cfg.hide=t.checked?cfg.hide.filter(x=>x!=D.hide):[...cfg.hide,D.hide];localStorage.setItem('ciq',JSON.stringify(cfg))}});
document.addEventListener('toggle',e=>{const g=e.target.dataset?.g;if(g)S.open[g]=e.target.open},true);
dbAll().then(a=>{a.forEach(l=>S.logs[l.date]=l);render()});render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');navigator.storage?.persist?.();
