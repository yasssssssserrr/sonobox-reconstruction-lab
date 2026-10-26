import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as k from '../tools/anatomy-kit/iso-kit.mjs';
import * as A from '../tools/anatomy-kit/audit.mjs';
import {multiply4,transformPoint} from '../dist/reconstruction-core.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const W=960,H=610;
const deck={x:-151,y:-89,w:350,d:180,r:11};
const P=k.fitProjection([...k.boxCorners(deck,-9,12),...k.boxCorners({x:-132,y:-76,w:320,d:152,r:0},10,138)],W,H,{pad:44,azimuth:48,elevation:29});
const spring={stiffness:160,damping:26,substeps:4,stagger:0};
const R=A.recorder(P,{order:['probe'],spring});
const parts=[];
const imageOrigin=k.iso([138,-64.7,133],P);
const imageX=k.iso([180.16,-64.7,133],P);
const imageY=k.iso([138,-64.7,48],P);
const screenMatrix=[(imageX[0]-imageOrigin[0])/254,(imageX[1]-imageOrigin[1])/254,
 (imageY[0]-imageOrigin[0])/512,(imageY[1]-imageOrigin[1])/512,...imageOrigin].map(n=>+n.toFixed(6));
const num=n=>Number(n.toFixed(3));
const move=[192,0,0];

function item(name,piece,shape,svg,at){
 const movement=piece==='probe'?move:undefined;
 const meta={name,owner:name};
 const real=shape(meta);
 const record={name,piece,at,svg,move:movement,shapes:[R.solid(real)]};
 R.put(record);parts.push({name,piece});return record;
}
function slab(name,piece,plan,z,height,tone='mid',details=''){
 return item(name,piece,meta=>A.slab(plan,z,height,meta,6),
  k.solidSvg(k.slabOf(plan,z,height,P,6,Math.min(1.1,height/4)),{tone,inner:details}),
  [plan.x+plan.w/2,plan.y+plan.d/2,z+height/2]);
}
function round(name,piece,x,y,r,z,height,tone='mid',details=''){
 return item(name,piece,meta=>A.cylinder(x,y,r,z,height,meta),
  k.solidSvg(k.cylinder(x,y,r,z,height,P,32,Math.min(.5,height/4)),{tone,inner:details}),[x,y,z+height/2]);
}
function screw(name,piece,x,y,z){round(name,piece,x,y,1.5,z,.8,'lo',k.lineSvg(k.lineOnTop([x-1,y],[x+1,y],z+.8,P),{tone:'hi'}));}

for(const [i,[x,y]]of k.corners(deck,24).entries()){
 round(`stand.pad${i}`,'stand',x,y,10,-9,2,'lo');
 round(`stand.foot${i}`,'stand',x,y,7.5,-7,7,'lo');
}
slab('stand.deck','stand',deck,0,10,'mid',k.lineSvg(k.planOutline(k.insetPlan(deck,5),10,P,6),{tone:'faint'}));
slab('stand.inlay','stand',{x:-139,y:-77,w:267,d:154,r:6},10,.8,'lo');
for(const [i,[x,y]]of k.corners(deck,12).entries())screw(`stand.screw${i}`,'stand',x,x>180&&y<0?-84:y,10);

for(const [i,[x,y]]of [[-124,-61],[124,-61],[-124,61],[124,61]].entries()){
 slab(`gantry.shoe${i}`,'structure',{x:x-9,y:y-9,w:18,d:18,r:3},10.8,5,'mid');
 slab(`gantry.post${i}`,'structure',{x:x-4,y:y-4,w:8,d:8,r:1.4},15.8,87.2,'mid');
 slab(`gantry.coupling${i}`,'structure',{x:x-7,y:y-7,w:14,d:14,r:2},103,9,'hi');
 screw(`gantry.shoe-bolt${i}`,'structure',x+6,y,15.8);
 screw(`gantry.beam-bolt${i}`,'structure',x,y,118);
}
for(const y of [-61,61])slab(`gantry.rail${y}`,'structure',{x:-131,y:y-5,w:262,d:10,r:2},112,6,'mid',
 k.lineSvg(k.lineOnTop([-131,y],[131,y],118,P),{tone:'hi'}));

slab('cradle.floor','fusion',{x:-111,y:-47,w:222,d:94,r:7},10.8,4,'mid');
for(const [name,plan]of [
 ['back',{x:-111,y:-47,w:222,d:3,r:1}],['front',{x:-111,y:44,w:222,d:3,r:1}],
 ['left',{x:-111,y:-44,w:3,d:88,r:1}],['right',{x:108,y:-44,w:3,d:88,r:1}]])slab(`cradle.${name}`,'fusion',plan,14.8,7,'lo');
for(const x of [-103,91])slab(`cradle.cushion${x}`,'fusion',{x,y:-36,w:12,d:72,r:4},14.8,8,'mid');

const rest=-96;
for(const y of [-61,61])slab(`probe.bearing${y}`,'probe',{x:rest-14,y:y-7,w:28,d:14,r:3},118,5,'hi');
slab('probe.carriage','probe',{x:rest-12,y:-68,w:24,d:136,r:3},123,6,'mid');
slab('probe.mount','probe',{x:rest-4,y:-5,w:8,d:10,r:1.6},91,32,'hi');
slab('probe.adapter','probe',{x:rest-7,y:-8,w:14,d:16,r:2},87,4,'mid');
slab('probe.housing','probe',{x:rest-8,y:-20,w:16,d:40,r:4},81,6,'hi');
slab('probe.aperture','probe',{x:rest-7,y:-18,w:14,d:36,r:2},79.5,1.5,'lo');
for(const [i,[x,y]]of [[rest-7,-61],[rest+7,-61],[rest-7,61],[rest+7,61]].entries())screw(`probe.bolt${i}`,'probe',x,y,129);

slab('controls.housing','export',{x:136,y:25,w:49,d:43,r:5},10,12,'mid');
slab('controls.plate','export',{x:140,y:29,w:41,d:35,r:3},22,.7,'lo');
for(const [i,x]of [149,171].entries())round(`controls.knob${i}`,'export',x,41,5,22.7,4,'hi',
 k.lineSvg(k.knurl(x,41,5,22.7,26.7,28,P),{tone:'lo'}));
slab('controls.switch-seat','export',{x:153,y:53,w:15,d:7,r:2},22.7,2,'lo');
slab('controls.switch','export',{x:156,y:54,w:9,d:5,r:1},24.7,1.7,'hi');

slab('monitor.foot','segment',{x:133,y:-79,w:56,d:27,r:5},10,6,'mid');
slab('monitor.column','segment',{x:155,y:-74,w:12,d:10,r:2},16,26,'mid');
slab('monitor.housing','segment',{x:130,y:-75,w:58,d:10,r:5},42,96,'mid');
slab('monitor.recess','segment',{x:135,y:-65,w:48,d:.3,r:1},46,88,'lo');
for(const [i,x]of [136,182].entries())screw(`monitor.retainer${i}`,'segment',x,-70,138);
slab('stand.nameplate','stand',{x:-96,y:63,w:68,d:9,r:2},10.8,.7,'lo',
 k.faceTextSvg(k.topMatrix([-62,68],11.5,P,'x'),'SONOBOX',{size:3.4,tone:'mid',anchor:'middle'}));
for(const [i,x]of [-92,-32].entries())screw(`stand.label-bolt${i}`,'stand',x,67.5,11.5);

// Settle true overlapping surfaces rather than hand-tuning painter keys.
A.settle(R,P);
R.items.sort((a,b)=>a.key-b.key);

const manifest=JSON.parse(await readFile(path.join(DIST,'assets/datasets.json'),'utf8'));
const model={schema:1,threshold:.5,spring,projection:P,parts:parts.length,
 probeVector:k.iso(move,P).map((n,i)=>n-k.iso([0,0,0],P)[i]),screenMatrix,
 sourceSeal:manifest.frozen_experiment_seal_sha256,cases:[]};
const circle=(x,y,r=.65)=>`M${num(x-r)} ${num(y)}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0`;

for(const c of manifest.cases){
 const transforms=c.frames.map(f=>Object.fromEntries(Object.entries(c.calibrations).map(([key,cal])=>[key,multiply4(f.pose_local_from_tool_mm.flat(),cal.matrix_mm.flat())])));
 const corners=transforms.flatMap((t,i)=>Object.values(t).flatMap(m=>[[0,0],[253,0],[253,511],[0,511]].map(([u,v])=>transformPoint(m,u*c.frames[i].spacing_xy_mm[0],v*c.frames[i].spacing_xy_mm[1]))));
 const lo=[0,1,2].map(d=>Math.min(...corners.map(p=>p[d]))),hi=[0,1,2].map(d=>Math.max(...corners.map(p=>p[d])));
 const scale=Math.min(192/(hi[0]-lo[0]),64/(hi[1]-lo[1]),56/(hi[2]-lo[2]));
 // A proper rotation (x,-y,-z), uniform scale and translation. Both matrices
 // use this same display transform. Source points and exports are untouched.
 const place=p=>[(p[0]-(lo[0]+hi[0])/2)*scale,-(p[1]-(lo[1]+hi[1])/2)*scale,78-(p[2]-lo[2])*scale];
 const entry={id:c.id,eligibleFrames:c.eligible_frames,first:c.first_eligible_index,last:c.last_eligible_index,
  displayScale:scale,boundsMm:[lo,hi],meshes:c.meshes,frames:[]};
 const probabilities=new Float32Array(c.display_frames*512*254);
 for(const chunk of c.probability_chunks){const bytes=gunzipSync(await readFile(path.join(DIST,chunk.file)));probabilities.set(new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),chunk.start*512*254);}
 for(const [i,f]of c.frames.entries()){
  const hits=[];for(let q=0;q<512*254;q++)if(probabilities[i*512*254+q]>.5)hits.push(q);
  if(hits.length!==f.cortex_pixels_at_0_5)throw Error(`Prediction count mismatch: ${c.id}/${f.index}`);
  const selected=hits.filter((_,j)=>j%Math.max(1,Math.ceil(hits.length/42))===0);
  let overlay='';
  for(let row=0;row<512;row++)for(let x=0;x<254;x++)if(probabilities[i*512*254+row*254+x]>.5){
   const start=x;while(x+1<254&&probabilities[i*512*254+row*254+x+1]>.5)x++;
   const width=x-start+1;overlay+=`M${start} ${row}h${width}v1h${-width}z`;
  }
  const preview={index:f.index,image:f.image,seconds:num(f.timestamp_s-c.frames[0].timestamp_s),
   cortexPixels:f.cortex_pixels_at_0_5,sampledPoints:selected.length,
   overlay,models:{}};
  for(const [key,m]of Object.entries(transforms[i])){
   const plane=[[0,0],[253,0],[253,511],[0,511]].map(([u,v])=>place(transformPoint(m,u*f.spacing_xy_mm[0],v*f.spacing_xy_mm[1])));
   const probeX=(plane[0][0]+plane[1][0])/2;
   preview.models[key]={plane:plane.map(p=>k.iso(p,P).map(num)),probeFraction:Math.max(0,Math.min(1,(probeX+96)/192)),
    dots:selected.map(q=>{const p=k.iso(place(transformPoint(m,(q%254)*f.spacing_xy_mm[0],Math.floor(q/254)*f.spacing_xy_mm[1])),P);return circle(...p);}).join('')};
  }
  entry.frames.push(preview);
 }
 model.cases.push(entry);
}

const initial=model.cases[0],frame=initial.frames[31];
const initialShare=frame.models.matrix_1.probeFraction;
const orderedPhysical=[...R.items].sort((a,b)=>a.key+(a.piece==='probe'?k.depthOf(move,P)-k.depthOf([0,0,0],P):0)*initialShare-b.key-(b.piece==='probe'?k.depthOf(move,P)-k.depthOf([0,0,0],P):0)*initialShare).map(it=>`<g class="anatomy-part" data-part="${it.name}" data-assembly="${it.piece}" data-key="${it.key}"${it.piece==='probe'?` data-probe="true" data-lift="${k.depthOf(move,P)-k.depthOf([0,0,0],P)}" transform="${k.translateAlong(P,move.map(v=>v*initialShare))}"`:''}>${it.svg}</g>`).join('');
const svg=k.figureSvg({width:W,height:H,standalone:'light',className:'anatomy-machine',label:'Cutaway ultrasound inspection bench: a probe on rails, a source-image monitor, and spatially placed predicted cortical echoes. The instrument is schematic; its image planes and echo samples use recorded tracking and fixed calibration.',body:[
 `<style>#anatomy-echoes path{fill:var(--anatomy-cortex,#12846a);stroke:none}#anatomy-planes polygon,#anatomy-active-plane{fill:#3267b8;fill-opacity:.055;stroke:#3267b8;stroke-width:1}#anatomy-monitor-overlay{fill:#91dbb6;stroke:none;opacity:0}</style>`,
 `<defs><clipPath id="anatomy-monitor-clip"><rect x="0" y="0" width="254" height="512"/></clipPath></defs>`,
 `<path class="iso-halo" d="${k.haloOf(deck,-9,12,P)}"/>`,
 `<g id="anatomy-physical">${orderedPhysical}</g>`,
 `<g id="anatomy-evidence" aria-hidden="true"><g id="anatomy-planes"></g><g id="anatomy-echoes">${initial.frames.slice(0,32).map(f=>`<path d="${f.models.matrix_1.dots}"/>`).join('')}</g><polygon id="anatomy-active-plane" points="${frame.models.matrix_1.plane.map(p=>p.join(',')).join(' ')}"/></g>`,
 `<g transform="matrix(${screenMatrix.join(' ')})" clip-path="url(#anatomy-monitor-clip)"><image id="anatomy-monitor-image" href="${frame.image}" width="254" height="512"/><path id="anatomy-monitor-overlay" d="${frame.overlay}"/></g>`]});
await writeFile(path.join(DIST,'project-anatomy.svg'),svg);
await writeFile(path.join(DIST,'assets/project-anatomy.json'),JSON.stringify(model));
await mkdir(path.join(ROOT,'.artifacts'),{recursive:true});
await writeFile(path.join(ROOT,'.artifacts/anatomy-parts.json'),JSON.stringify({parts,projection:P},null,2));
console.log(`Anatomy Figure: ${parts.length} recorded physical parts; ${model.cases.length} real sweeps, 64 sampled frames each.`);
A.auditOrExit(R,P);
