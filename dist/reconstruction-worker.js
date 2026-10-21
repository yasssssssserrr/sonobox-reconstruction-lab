import {multiply4,transformPoint,splatPixel,gaussianInPlace,chooseUniform} from './reconstruction-core.js';
import {MeshBasicMaterial} from './vendor/three.module.js';
import {MarchingCubes} from './vendor/addons/objects/MarchingCubes.js';

self.onmessage=({data})=>{
 try{
  const {probabilityBuffer,frames,calibration,width,height,voxel,threshold,sampleCount}=data;
  if(![16,32,64].includes(sampleCount)||![.8,1,1.5,2].includes(voxel)||threshold<.1||threshold>.9)throw Error('Unsupported reconstruction settings.');
  const started=performance.now(), selected=chooseUniform(frames.length,sampleCount), probabilities=new Float32Array(probabilityBuffer);
  const matrices=selected.map(i=>multiply4(frames[i].pose_local_from_tool_mm.flat(),calibration.flat()));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let k=0;k<selected.length;k++){
   const f=frames[selected[k]],sx=f.spacing_xy_mm[0],sy=f.spacing_xy_mm[1];
   for(const [x,y] of [[0,0],[(width-1)*sx,0],[0,(height-1)*sy],[(width-1)*sx,(height-1)*sy]]){
    const p=transformPoint(matrices[k],x,y);for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);}
   }
  }
  const origin=min.map(v=>Math.floor(v/voxel)*voxel-3*voxel),n=Math.ceil(Math.max(...max.map((v,a)=>v-origin[a]))/voxel)+4;
  if(n>192)throw Error('This preview grid is too large. Choose a larger voxel size.');
  const sum=new Float32Array(n**3),weights=new Float32Array(n**3);
  for(let k=0;k<selected.length;k++){
   const frame=frames[selected[k]],m=matrices[k],sx=frame.spacing_xy_mm[0],sy=frame.spacing_xy_mm[1],offset=selected[k]*height*width;
   for(let row=0;row<height;row++){
    const bx=(m[1]*row*sy+m[3]-origin[0])/voxel,by=(m[5]*row*sy+m[7]-origin[1])/voxel,bz=(m[9]*row*sy+m[11]-origin[2])/voxel;
    for(let col=0;col<width;col++)splatPixel(sum,weights,n,bx+m[0]*col*sx/voxel,by+m[4]*col*sx/voxel,bz+m[8]*col*sx/voxel,probabilities[offset+row*width+col]);
   }
   self.postMessage({type:'progress',progress:(k+1)/selected.length*.76,text:`Fusing frame ${k+1} / ${selected.length}`});
  }
  let deposited=0;for(const w of weights)deposited+=w;
  const massError=Math.abs(deposited-selected.length*width*height)/(selected.length*width*height);
  if(massError>5e-5)throw Error('Sampling-support validation failed; preview was not exported.');
  self.postMessage({type:'progress',progress:.8,text:'Normalizing the probability volume…'});
  gaussianInPlace(sum,n,.25/voxel);gaussianInPlace(weights,n,.25/voxel);
  for(let q=0;q<sum.length;q++)sum[q]=weights[q]>=.05&&sum[q]/weights[q]>=threshold?1:0;
  self.postMessage({type:'progress',progress:.9,text:'Extracting the cortical surface…'});
  const capacity=160000,mc=new MarchingCubes(n,new MeshBasicMaterial(),false,false,capacity);
  mc.field=sum;mc.isolation=.5;mc.update();
  if(mc.count<3)throw Error('No surface at this threshold. Try a lower threshold or more sampled frames.');
  if(mc.count>=capacity*3)throw Error('The surface exceeds the preview limit. Choose a larger voxel size.');
  const position=mc.geometry.getAttribute('position').array.slice(0,mc.count*3),normal=mc.geometry.getAttribute('normal').array.slice(0,mc.count*3);
  for(let q=0;q<position.length;q++)position[q]=origin[q%3]+(position[q]+1)*n*voxel/2;
  const stats={sampleCount,voxel,threshold,sigma_mm:.25,support_threshold:.05,triangles:mc.count/3,seconds:(performance.now()-started)/1000,
               grid_size:n,origin_mm:origin,relative_support_mass_error:massError,original_frame_indices:selected.map(i=>frames[i].index)};
  self.postMessage({type:'complete',position:position.buffer,normal:normal.buffer,stats},[position.buffer,normal.buffer]);
  self.close();
 }catch(error){self.postMessage({type:'error',message:error.message});self.close();}
};
