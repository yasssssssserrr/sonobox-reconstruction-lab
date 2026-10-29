import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {multiply4,transformPoint,splatPixel,gaussianInPlace} from '../dist/reconstruction-core.js';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(site,'dist');
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(path.join(dist,'assets/datasets.json'),'utf8'));
assert.equal(manifest.date,'2026-10-29');
assert.deepEqual(manifest.cases.map(c=>c.id),['192514','192619','192840']);
assert.equal(manifest.model_training.annotated_images,414);
assert.equal(manifest.model_training.epochs,35);
assert.doesNotMatch(JSON.stringify(manifest),/(?:[A-Z]:[\\/]|glpat-|ghp_|gho_)/);
const anatomy=JSON.parse(await readFile(path.join(dist,'assets/project-anatomy.json'),'utf8'));
assert.equal(anatomy.sourceSeal,manifest.frozen_experiment_seal_sha256);
assert.equal(anatomy.threshold,.5);
assert.equal(anatomy.cases.length,manifest.cases.length);
for(const illustrated of anatomy.cases){
 const source=manifest.cases.find(c=>c.id===illustrated.id);assert.ok(source);
 assert.equal(illustrated.eligibleFrames,source.eligible_frames);
 assert.equal(illustrated.frames.length,source.frames.length);
 for(const [i,f]of illustrated.frames.entries()){
  assert.equal(f.index,source.frames[i].index);assert.equal(f.image,source.frames[i].image);
  assert.equal(f.cortexPixels,source.frames[i].cortex_pixels_at_0_5);
  assert.ok(Math.abs(f.seconds-(source.frames[i].timestamp_s-source.frames[0].timestamp_s))<=.00051);
  for(const key of ['matrix_1','matrix_2']){
   const model=f.models[key];assert.equal(model.plane.length,4);
   assert.ok(model.plane.every(p=>p.length===2&&p.every(Number.isFinite)));
   assert.ok(model.probeFraction>=0&&model.probeFraction<=1);
  }
 }
}
const illustration=await readFile(path.join(dist,'project-anatomy.svg'),'utf8');
assert.equal((illustration.match(/class="anatomy-part"/g)||[]).length,anatomy.parts);
assert.match(await readFile(path.join(dist,'vendor/ANATOMY-LICENSE.txt'),'utf8'),/Copyright \(c\) 2026 Ryan/);
let images=0,probs=0,stls=0;
for(const dataset of manifest.cases){
 assert.equal(dataset.checkpoint_sha256,'0c6963cb4b5c238dd16f48078a293da3c14eab82b7e04c251c1538ead4f8ed49');
 assert.equal(dataset.eligible_frames,{'192514':415,'192619':341,'192840':253}[dataset.id]);
 assert.equal(dataset.last_eligible_index,{'192514':514,'192619':340,'192840':252}[dataset.id]);
 if(dataset.id==='192619')assert.deepEqual(dataset.excluded_source_indices,Array.from({length:159},(_,i)=>i+341));
 assert.equal(dataset.frames.length,64);assert.equal(new Set(dataset.frames.map(f=>f.index)).size,64);
 assert.equal(dataset.frames[0].index,dataset.first_eligible_index);assert.equal(dataset.frames.at(-1).index,dataset.last_eligible_index);
 const all=Buffer.alloc(64*512*254*4);
 for(const chunk of dataset.probability_chunks){assert.ok(chunk.file.startsWith('assets/20261029/'));const bytes=await readFile(path.join(dist,chunk.file));assert.equal(hash(bytes),chunk.sha256);const raw=gunzipSync(bytes);assert.equal(raw.byteLength,chunk.uncompressed_bytes);assert.equal(hash(raw),chunk.uncompressed_sha256);raw.copy(all,chunk.start*512*254*4);}
 for(let i=0;i<64;i++){
  const f=dataset.frames[i],png=await readFile(path.join(dist,f.image));assert.equal(hash(png),f.png_sha256);assert.equal(png.readUInt32BE(16),254);assert.equal(png.readUInt32BE(20),512);
  const probabilities=all.subarray(i*512*254*4,(i+1)*512*254*4);assert.equal(hash(probabilities),f.probability_bytes_sha256);
  let positive=0;for(let p=0;p<probabilities.length;p+=4){const v=probabilities.readFloatLE(p);assert.ok(Number.isFinite(v)&&v>=0&&v<=1);if(v>.5)positive++;}
  assert.equal(positive,f.cortex_pixels_at_0_5);images++;probs++;
 }
 for(const key of ['matrix_1','matrix_2']){
  const info=dataset.meshes[key],bytes=await readFile(path.join(dist,info.file));assert.ok(info.file.startsWith('assets/20261029/'));assert.equal(info.frames_fused,dataset.eligible_frames);assert.equal(hash(bytes),info.sha256);assert.equal(bytes.readUInt32LE(80),info.triangles);assert.equal(bytes.length,84+50*info.triangles);
  const mm=dataset.calibrations[key].matrix_mm,metres=dataset.calibrations[key].supplied_matrix_metres;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)assert.equal(mm[row][col],metres[row][col]*(row<3&&col===3?1000:1));
  const identity=dataset.frames[0].pose_local_from_tool_mm.flat(),m=multiply4(identity,mm.flat()),origin=transformPoint(m,0,0);
  for(let a=0;a<3;a++)assert.ok(Math.abs(origin[a]-mm[a][3])<1e-8);
  stls++;
 }
}
const n=6,sum=new Float32Array(n**3),weights=new Float32Array(n**3);splatPixel(sum,weights,n,1.25,2.5,1.75,.8);
const total=a=>Array.from(a).reduce((a,b)=>a+b,0);
assert.ok(Math.abs(total(weights)-1)<1e-7);assert.ok(Math.abs(total(sum)-.8)<1e-7);
assert.equal(weights[1+n*(2+n*1)],.09375);assert.equal(weights[2+n*(3+n*2)],.09375);
const impulse=new Float32Array(11**3);impulse[5+11*(5+11*5)]=1;gaussianInPlace(impulse,11,.7);assert.ok(Math.abs(total(impulse)-1)<1e-6);
assert.equal(impulse[4+11*(5+11*5)],impulse[6+11*(5+11*5)]);assert.ok(impulse[5+11*(5+11*5)]>impulse[4+11*(5+11*5)]);
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else assert.ok((await stat(p)).size<25*1024**2,`Asset exceeds hosting limit: ${p}`);}}
await walk(dist);
for(const name of ['index.html','app.js','reconstruction-worker.js','vendor/three.module.js','vendor/three.core.js','vendor/addons/objects/MarchingCubes.js'])await stat(path.join(dist,name));
console.log(JSON.stringify({status:'passed',original_png_hashes_checked:images,exact_float32_probability_arrays_checked:probs,unchanged_stl_hashes_and_triangle_counts_checked:stls,anatomy_source_frames_and_prediction_counts_checked:images,calibration_units_and_first_frame_transforms_checked:true,owner_reviewed_192619_exclusion_checked:true,trilinear_support_mass_conserved:true,gaussian_mass_and_symmetry_checked:true,all_assets_below_25_MiB:true},null,2));
