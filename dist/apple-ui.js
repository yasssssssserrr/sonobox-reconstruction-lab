// Presentation only. Retargeting keeps both the rendered position and velocity.
export class Spring {
 constructor(value,render,{response=.35,reduced=()=>false,settled=()=>{}}={}){this.value=value;this.target=value;this.velocity=0;this.render=render;this.response=response;this.reduced=reduced;this.settled=settled;this.frame=0;this.last=0;}
 set(target,{snap=false}={}){this.target=target;if(snap||this.reduced()){cancelAnimationFrame(this.frame);this.frame=0;this.value=target;this.velocity=0;this.render(target);this.settled(target);return;}if(!this.frame){this.last=performance.now();this.frame=requestAnimationFrame(t=>this.tick(t));}}
 tick(time){const dt=Math.min((time-this.last)/1000,.064);this.last=time;const w=2*Math.PI/this.response,d=this.value-this.target,c=this.velocity+w*d,e=Math.exp(-w*dt);this.value=this.target+(d+c*dt)*e;this.velocity=(this.velocity-w*c*dt)*e;this.render(this.value);if(Math.abs(this.value-this.target)<.001&&Math.abs(this.velocity)<.01){this.value=this.target;this.velocity=0;this.frame=0;this.render(this.value);this.settled(this.target);}else this.frame=requestAnimationFrame(t=>this.tick(t));}
 stop(){cancelAnimationFrame(this.frame);this.frame=0;}
}

export function installAppleUI({onAppearance=()=>{}}={}){
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),springs=[],reduced=()=>motion.matches;
 const spring=(value,render,options={})=>{const s=new Spring(value,render,{reduced,...options});springs.push(s);return s;};
 motion.addEventListener('change',()=>{if(motion.matches)for(const s of springs)s.set(s.target,{snap:true});});
 const toggle=document.getElementById('appearance-toggle');let theme='light',themeTimer;
 try{theme=localStorage.getItem('sonobox-appearance')==='dark'?'dark':'light';}catch{}
 function appearance(next,animate=false){theme=next;if(animate&&!reduced()){document.documentElement.classList.add('appearance-changing');clearTimeout(themeTimer);themeTimer=setTimeout(()=>document.documentElement.classList.remove('appearance-changing'),240);}document.documentElement.dataset.theme=theme;toggle.setAttribute('aria-label',`Use ${theme==='light'?'dark':'light'} appearance`);toggle.title=toggle.getAttribute('aria-label');toggle.querySelector('use').setAttribute('href',theme==='light'?'#i-moon':'#i-sun');document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--page').trim();try{localStorage.setItem('sonobox-appearance',theme);}catch{}onAppearance(theme);}
 toggle.addEventListener('click',()=>appearance(theme==='light'?'dark':'light',true));appearance(theme);

 const track=document.getElementById('matrix-options'),indicator=document.createElement('span');indicator.className='segment-indicator';indicator.setAttribute('aria-hidden','true');track.prepend(indicator);
 const x=spring(0,v=>indicator.style.transform=`translateX(${v}px)`),width=spring(0,v=>indicator.style.width=`${v}px`);let measured=false;
 function measure(){const selected=track.querySelector('button[aria-pressed="true"]');if(!selected)return;const snap=!measured,bounds=selected.getBoundingClientRect(),parent=track.getBoundingClientRect();measured=true;x.set(bounds.x-parent.x-track.clientLeft,{snap});width.set(bounds.width,{snap});}
 const selectionObserver=new MutationObserver(measure);for(const b of track.querySelectorAll('button'))selectionObserver.observe(b,{attributes:true,attributeFilter:['aria-pressed']});const layoutObserver=new ResizeObserver(measure);layoutObserver.observe(track);measure();

 const updateRange=input=>{input.style.setProperty('--fill',`${100*(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))}%`);};
 for(const input of document.querySelectorAll('input[type="range"]')){updateRange(input);input.addEventListener('input',()=>updateRange(input));}
 const switchSprings=new Map();
 const switchLayout=new ResizeObserver(entries=>{for(const {target:input}of entries){const {width,height}=input.getBoundingClientRect();if(width>0)switchSprings.get(input).set(input.checked?width-height:0,{snap:true});}});
 for(const input of document.querySelectorAll('input[type="checkbox"]')){const travel=()=>input.getBoundingClientRect().width-input.getBoundingClientRect().height;const knob=spring(input.checked?travel():0,v=>input.style.setProperty('--knob-x',`${v}px`));switchSprings.set(input,knob);switchLayout.observe(input);input.style.setProperty('--knob-x',`${knob.value}px`);input.addEventListener('input',()=>knob.set(input.checked?travel():0));}

 const dialog=document.getElementById('details-dialog');let closing=false;
 const sheet=spring(0,v=>{dialog.style.opacity=String(v);dialog.style.transform=reduced()?'none':`translateY(${12*(1-v)}px) scale(${.98+.02*v})`;dialog.style.setProperty('--scrim-opacity',String(.24*v));},{response:.3,settled:v=>{if(v===0&&closing){dialog.close();closing=false;}}});
 const modal={open(){const trigger=document.activeElement?.getBoundingClientRect();closing=false;if(!dialog.open){dialog.showModal();sheet.set(0,{snap:true});const bounds=dialog.getBoundingClientRect();dialog.style.transformOrigin=trigger?`${Math.max(0,Math.min(bounds.width,trigger.x+trigger.width/2-bounds.x))}px ${Math.max(0,Math.min(bounds.height,trigger.y+trigger.height/2-bounds.y))}px`:'50% 50%';}sheet.set(1);},close(){closing=true;sheet.set(0);}};
 dialog.addEventListener('cancel',e=>{e.preventDefault();modal.close();});

 const toastElement=document.getElementById('toast');let toastTimer,hiding=false;
 const notification=spring(0,v=>{toastElement.style.opacity=String(v);toastElement.style.transform=`translate(-50%, ${reduced()?0:10*(1-v)}px)`;},{settled:v=>{if(v===0&&hiding)toastElement.hidden=true;}});
 function toast(message,error=false){clearTimeout(toastTimer);hiding=false;toastElement.textContent=message;toastElement.classList.toggle('error',error);toastElement.hidden=false;notification.set(1);toastTimer=setTimeout(()=>{hiding=true;notification.set(0);},error?9000:4500);}

 for(const button of document.querySelectorAll('.button,.play-button,.appearance-button')){const press=spring(1,v=>button.style.transform=`scale(${v})`,{response:.25});button.addEventListener('pointerdown',e=>{if(button.disabled)return;button.setPointerCapture(e.pointerId);press.set(.98,{snap:true});});for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(event,()=>press.set(1));}
 window.addEventListener('pagehide',()=>{for(const s of springs)s.stop();selectionObserver.disconnect();layoutObserver.disconnect();switchLayout.disconnect();clearTimeout(toastTimer);clearTimeout(themeTimer);});
 return {get theme(){return theme;},dialog:modal,toast,updateRange};
}
