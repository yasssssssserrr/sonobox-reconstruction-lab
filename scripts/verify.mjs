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
assert.equal(manifest.date,'2026-11-08');
const trained=['192514','192619','192840','193948','184600','184849'],unannotated=['192447','192754','194903'];
assert.deepEqual(manifest.cases.map(c=>c.id),[...trained,...unannotated]);
assert.deepEqual(manifest.model_training.sweeps,trained);assert.deepEqual(manifest.model_training.unannotated_sweeps,unannotated);
assert.equal(manifest.model_training.annotated_images,685);
assert.equal(manifest.cases.reduce((n,c)=>n+c.human_masks_in_training,0),685);
// Usable frames given by the dataset owner (configs/retained_frames_data_for_vol_rec_3.json in the research repository).
const usable={'184600':[[190,851]],'184849':[[17,139],[244,902]],'192447':[[0,319]],'192514':[[135,514]],'192619':[[0,349]],'192754':[[0,349]],'192840':[[0,252]],'193948':[[94,819]],'194903':[[134,939]]};
assert.equal(manifest.model_training.epochs,35);
assert.doesNotMatch(JSON.stringify(manifest),/(?:[A-Z]:[\\/]|glpat-|ghp_|gho_)/);
let images=0,probs=0,stls=0;
for(const dataset of manifest.cases){
 assert.equal(dataset.checkpoint_sha256,'2803b36a96272221a7cf8a6418a98c1889a11a5e8c61ad275f6313b7e962494d');
 assert.deepEqual(dataset.retained_ranges,usable[dataset.id]);
 assert.equal(dataset.eligible_frames,usable[dataset.id].reduce((n,[a,b])=>n+b-a+1,0));
 const prefix='assets/20261108/';
 assert.equal(dataset.eligible_frames+dataset.excluded_source_indices.length,dataset.source_frames);
 assert.equal(dataset.retained_ranges?.reduce((n,[a,b])=>n+b-a+1,0)??dataset.eligible_frames,dataset.eligible_frames);
 const excluded=new Set(dataset.excluded_source_indices);assert.ok(dataset.frames.every(f=>!excluded.has(f.index)),'a displayed frame lies in an excluded range');
 assert.match(dataset.model_training_role,unannotated.includes(dataset.id)?/^Not used for model fitting/:/^Used to fit the final model/);
 assert.equal(dataset.human_masks_in_training>0,trained.includes(dataset.id));
 assert.equal(dataset.first_eligible_index,usable[dataset.id][0][0]);assert.equal(dataset.last_eligible_index,usable[dataset.id].at(-1)[1]);
 if(dataset.id==='192619')assert.deepEqual(dataset.excluded_source_indices,Array.from({length:150},(_,i)=>i+350));
 assert.equal(dataset.frames.length,64);assert.equal(new Set(dataset.frames.map(f=>f.index)).size,64);
 assert.equal(dataset.frames[0].index,dataset.first_eligible_index);assert.equal(dataset.frames.at(-1).index,dataset.last_eligible_index);
 const all=Buffer.alloc(64*512*254*4);
 for(const chunk of dataset.probability_chunks){assert.ok(chunk.file.startsWith(prefix));const bytes=await readFile(path.join(dist,chunk.file));assert.equal(hash(bytes),chunk.sha256);const raw=gunzipSync(bytes);assert.equal(raw.byteLength,chunk.uncompressed_bytes);assert.equal(hash(raw),chunk.uncompressed_sha256);raw.copy(all,chunk.start*512*254*4);}
 for(let i=0;i<64;i++){
  const f=dataset.frames[i],png=await readFile(path.join(dist,f.image));assert.equal(hash(png),f.png_sha256);assert.equal(png.readUInt32BE(16),254);assert.equal(png.readUInt32BE(20),512);
  const probabilities=all.subarray(i*512*254*4,(i+1)*512*254*4);assert.equal(hash(probabilities),f.probability_bytes_sha256);
  let positive=0;for(let p=0;p<probabilities.length;p+=4){const v=probabilities.readFloatLE(p);assert.ok(Number.isFinite(v)&&v>=0&&v<=1);if(v>.5)positive++;}
  assert.equal(positive,f.cortex_pixels_at_0_5);images++;probs++;
 }
 for(const key of ['matrix_1','matrix_2']){
  const info=dataset.meshes[key],bytes=await readFile(path.join(dist,info.file));assert.ok(info.file.startsWith(prefix));assert.equal(info.frames_fused,dataset.eligible_frames);assert.equal(hash(bytes),info.sha256);assert.equal(bytes.readUInt32LE(80),info.triangles);assert.equal(bytes.length,84+50*info.triangles);
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
// Slice views: 18 cropped volumes (nine sweeps x two matrices) of ultrasound, bone mask and resampled CT.
const slices=JSON.parse(await readFile(path.join(dist,'assets/20261108/slices.json'),'utf8'));
assert.equal(slices.volumes.length,18);
assert.deepEqual([...new Set(slices.volumes.map(v=>v.sweep))].sort(),manifest.cases.map(c=>c.id).sort());
let sliceFiles=0;
for(const v of slices.volumes){
 const voxels=v.shape_depth_across_along.reduce((a,b)=>a*b,1);assert.equal(v.voxel_mm,0.3);
 assert.deepEqual(Object.keys(v.files).sort(),['ct','mask','ultrasound']);
 for(const [name,info] of Object.entries(v.files)){
  assert.ok(info.file.startsWith(`assets/20261108/slices/${v.sweep}/${v.matrix}/`));
  const bytes=await readFile(path.join(dist,info.file));assert.equal(hash(bytes),info.sha256);
  const raw=gunzipSync(bytes);assert.equal(raw.length,voxels);assert.equal(hash(raw),info.uncompressed_sha256);
  if(name==='mask'){let ones=0;for(let i=0;i<raw.length;i++){const b=raw[i];assert.ok(b<=1);ones+=b;}assert.equal(ones,v.mask_voxels);assert.ok(ones>0);}
  sliceFiles++;
 }
}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else assert.ok((await stat(p)).size<25*1024**2,`Asset exceeds hosting limit: ${p}`);}}
await walk(dist);
for(const name of ['index.html','app.js','reconstruction-worker.js','vendor/three.module.js','vendor/three.core.js','vendor/addons/objects/MarchingCubes.js','slice-viewer.js','slice-viewer.css'])await stat(path.join(dist,name));
console.log(JSON.stringify({status:'passed',original_png_hashes_checked:images,exact_float32_probability_arrays_checked:probs,unchanged_stl_hashes_and_triangle_counts_checked:stls,calibration_units_and_first_frame_transforms_checked:true,usable_frame_ranges_checked:true,no_displayed_frame_in_an_excluded_range_checked:true,trilinear_support_mass_conserved:true,gaussian_mass_and_symmetry_checked:true,slice_view_files_checked:sliceFiles,slice_masks_match_research_voxel_counts:true,all_assets_below_25_MiB:true},null,2));
