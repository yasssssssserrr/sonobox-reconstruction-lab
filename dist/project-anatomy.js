const $=id=>document.getElementById(id);
const section=$('project-anatomy');
const calm=matchMedia('(prefers-reduced-motion: reduce)');
const stages=[
 {title:'Acquire a tracked sweep',body:'Each B-mode image is paired with a recorded robot pose. Spatial calibration locates its image plane relative to the tool.',fact:'Image + tracking',detail:'Original pixels, frame ID and timestamp stay together.'},
 {title:'Identify the visible cortex',body:'A trained 2D nnU-Net predicts the cortical echo in the original image. Green marks on the monitor show pixels whose cached cortex probability exceeds 0.5.',fact:'Prediction, not a human label',detail:'This page reads saved probabilities; it does not train or run nnU-Net.'},
 {title:'Place and compound the evidence',body:'The selected fixed calibration and recorded poses place the frames in a common local coordinate system. Trilinear splatting and normalized Gaussian convolution combine signal and sampling support.',fact:'Signal / support',detail:'Measured dark pixels contribute support. Unobserved space stays unknown.'},
 {title:'Inspect a partial surface',body:'A thresholded supported field yields the cortical-echo surface for STL export. Gaps and acoustic shadows limit the anatomy that is represented.',fact:'Visible echoes, not a solid bone',detail:'Open the full-sweep STL above to inspect the complete exported geometry.'}
];
let data,svg,current,caseData,latest={caseId:'192514',matrix:'matrix_1',frame:31},stage=0;
let visible=false,touring=!calm.matches,timer=0,lastTime=0,raf=0,initializing;
const spring={x:.5,v:0};
let nodes=[],echoes=[],slicePlanes=[],lastOrder='';
const namespace='http://www.w3.org/2000/svg';
const theme=()=>{if(svg)svg.dataset.theme=document.documentElement.dataset.theme||'light';};
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

function stopTour(){touring=false;$('anatomy-tour').textContent='Play walkthrough';$('anatomy-tour').setAttribute('aria-pressed','false');}
function selectStage(index,manual=true){
 stage=Math.max(0,Math.min(3,index));if(manual)stopTour();
 section.dataset.stage=stage;
 const s=stages[stage];$('anatomy-step-title').textContent=s.title;$('anatomy-step-copy').textContent=s.body;
 $('anatomy-fact').textContent=s.fact;$('anatomy-fact-detail').textContent=s.detail;
 document.querySelectorAll('[data-anatomy-stage]').forEach(b=>{const selected=Number(b.dataset.anatomyStage)===stage;b.setAttribute('aria-pressed',String(selected));});
 if(manual)$('anatomy-announcement').textContent=`Step ${stage+1}: ${s.title}`;
 kick();
}
function request(change){stopTour();window.dispatchEvent(new CustomEvent('sonobox:request-frame',{detail:change}));}
function make(type,attributes){const el=document.createElementNS(namespace,type);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,value);return el;}

function renderState(){
 if(!data)return;
 caseData=data.cases.find(c=>c.id===latest.caseId)||data.cases[0];
 const index=Math.max(0,Math.min(caseData.frames.length-1,Number(latest.frame)||0));
 const key=latest.matrix==='matrix_2'?'matrix_2':'matrix_1';current=caseData.frames[index];
 $('anatomy-comparison-note').hidden=latest.matrix!=='both';
 section.dataset.sweep=caseData.id;section.dataset.matrix=key;section.dataset.frame=String(index);
 $('anatomy-case').value=caseData.id;$('anatomy-matrix').value=key;
 $('anatomy-frame').value=String(index);
 $('anatomy-frame').setAttribute('aria-valuetext',`Sample ${index+1} of 64, original frame ${current.index}`);
 $('anatomy-source-frame').textContent=String(current.index).padStart(6,'0');
 $('anatomy-time').textContent=`${current.seconds.toFixed(2)} s`;
 $('anatomy-pixels').textContent=current.cortexPixels.toLocaleString('en-US');
 $('anatomy-progress').textContent=`${index+1} / ${caseData.frames.length}`;
 $('anatomy-sweep-count').textContent=`${caseData.eligibleFrames} usable frames · 64 displayed`;
 const picture=$('anatomy-monitor-image');picture.setAttribute('href',current.image);
 $('anatomy-monitor-overlay').setAttribute('d',current.overlay);
 for(let i=0;i<caseData.frames.length;i++){
  const model=caseData.frames[i].models[key];
  echoes[i].setAttribute('d',model.dots);echoes[i].style.opacity=i<=index?'1':'0';
  slicePlanes[i].setAttribute('points',model.plane.map(p=>p.join(',')).join(' '));
  slicePlanes[i].style.display=i<=index&&i%8===0?'':'none';
 }
 $('anatomy-active-plane').setAttribute('points',current.models[key].plane.map(p=>p.join(',')).join(' '));
 section.dataset.ready='true';kick();
}

function animate(now){
 raf=0;if(!visible||document.hidden||!data)return;
 const dt=Math.min(.035,Math.max(0,(now-lastTime)/1000||0));lastTime=now;
 if(touring&&!calm.matches){timer+=dt;if(timer>4.5){timer=0;selectStage((stage+1)%4,false);}}
 const key=latest.matrix==='matrix_2'?'matrix_2':'matrix_1';
 const target=current?.models[key].probeFraction??.5;
 if(calm.matches){spring.x=target;spring.v=0;}
 else for(let i=0;i<data.spring.substeps;i++){
  const h=dt/data.spring.substeps;
  spring.v+=(data.spring.stiffness*(target-spring.x)-data.spring.damping*spring.v)*h;
  spring.x+=spring.v*h;
 }
 const x=Math.max(0,Math.min(1,spring.x));
 for(const node of nodes)if(node.probe)node.el.setAttribute('transform',`translate(${data.probeVector[0]*x} ${data.probeVector[1]*x})`);
 const sorted=[...nodes].sort((a,b)=>a.key+a.lift*x-b.key-b.lift*x);
 const order=sorted.map(n=>n.id).join(',');
 if(order!==lastOrder){const fragment=document.createDocumentFragment();for(const n of sorted)fragment.append(n.el);$('anatomy-physical').append(fragment);lastOrder=order;}
 if((touring&&!calm.matches)||Math.abs(target-spring.x)>.0001||Math.abs(spring.v)>.001)raf=requestAnimationFrame(animate);
}
function kick(){if(!raf&&visible&&!document.hidden&&data){lastTime=performance.now();raf=requestAnimationFrame(animate);}}

async function initialize(){
 if(initializing)return initializing;
 initializing=(async()=>{
  try{
   const [artResponse,dataResponse]=await Promise.all([fetch('./project-anatomy.svg?v=20261029'),fetch('./assets/project-anatomy.json?v=20261029')]);
   if(!artResponse.ok||!dataResponse.ok)throw Error('The project illustration could not be loaded.');
   const [art,model]=await Promise.all([artResponse.text(),dataResponse.json()]);
   data=model;$('anatomy-drawing').innerHTML=art;svg=$('anatomy-drawing').querySelector('svg');theme();
   nodes=[...svg.querySelectorAll('.anatomy-part')].map((el,id)=>({el,id,key:Number(el.dataset.key),probe:el.dataset.probe==='true',lift:Number(el.dataset.lift)||0}));
   $('anatomy-echoes').replaceChildren();
   for(let i=0;i<64;i++){
    const path=make('path',{'data-sample':i});$('anatomy-echoes').append(path);echoes.push(path);
    const plane=make('polygon',{'data-sample':i});$('anatomy-planes').append(plane);slicePlanes.push(plane);
   }
   section.setAttribute('aria-busy','false');renderState();selectStage(stage,false);
  }catch(error){section.setAttribute('aria-busy','false');$('anatomy-fact-detail').textContent=error.message;$('anatomy-controls').disabled=true;stopTour();}
 })();return initializing;
}

window.addEventListener('sonobox:frame',({detail})=>{latest=detail;if(data)renderState();});
document.querySelectorAll('[data-anatomy-stage]').forEach(button=>button.addEventListener('click',()=>selectStage(Number(button.dataset.anatomyStage))));
$('anatomy-frame').addEventListener('input',event=>request({frame:Number(event.target.value)}));
$('anatomy-case').addEventListener('change',event=>request({caseId:event.target.value}));
$('anatomy-matrix').addEventListener('change',event=>request({matrix:event.target.value}));
$('anatomy-tour').setAttribute('aria-pressed',String(touring));
$('anatomy-tour').textContent=touring?'Pause walkthrough':'Play walkthrough';
$('anatomy-tour').addEventListener('click',()=>{if(touring)stopTour();else{touring=true;timer=0;$('anatomy-tour').textContent='Pause walkthrough';$('anatomy-tour').setAttribute('aria-pressed','true');kick();}});
$('anatomy-open-surface').addEventListener('click',()=>{
 stopTour();window.dispatchEvent(new CustomEvent('sonobox:request-frame',{detail:{caseId:caseData?.id||'192514',fullSurface:true}}));const show=$('show-surface');if(!show.checked){show.checked=true;show.dispatchEvent(new Event('input',{bubbles:true}));}
 $('viewer-panel').scrollIntoView({behavior:calm.matches?'instant':'smooth',block:'start'});$('focus-viewer').focus({preventScroll:true});
});
section.addEventListener('keydown',event=>{
 if(event.target.closest('select,input,button,a'))return;
 if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();selectStage((stage+(event.key==='ArrowRight'?1:3))%4);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else kick();});
calm.addEventListener('change',()=>{if(calm.matches)stopTour();kick();});
new IntersectionObserver(entries=>{
 visible=entries[0].isIntersecting;
 if(visible){initialize();kick();}else{cancelAnimationFrame(raf);raf=0;}
},{threshold:.05}).observe($('anatomy-drawing'));
const prefetch=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){initialize();prefetch.disconnect();}},{rootMargin:'250px'});prefetch.observe(section);
