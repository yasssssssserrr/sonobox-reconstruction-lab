import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
const datasets=JSON.parse(await readFile(new URL('../dist/assets/datasets.json',import.meta.url),'utf8'));
const case514=datasets.cases.find(c=>c.id==='192514'),case840=datasets.cases.find(c=>c.id==='192840');
const count=(c,key)=>c.meshes[key].triangles.toLocaleString('en-US');
const total=c=>(c.meshes.matrix_1.triangles+c.meshes.matrix_2.triangles).toLocaleString('en-US');
async function ready(page){await page.goto('./');await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});await expect(page.locator('#viewer-loading')).toBeHidden();}
async function range(page,id,value){await page.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}

test('real data, matrices, playback, reconstruction, exports and local STL import',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await ready(page);await expect(page.locator('#triangle-count')).toHaveText(count(case514,'matrix_1'));await expect(page.locator('#original-frame')).toHaveText('000304');
 await mkdir('.artifacts',{recursive:true});await page.screenshot({path:'.artifacts/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Matrix 2',exact:true}).click();await expect(page.locator('#triangle-count')).toHaveText(count(case514,'matrix_2'));
 await page.getByRole('button',{name:'Compare',exact:true}).click();await expect(page.locator('#triangle-count')).toHaveText(total(case514));await expect(page.locator('#reconstruct')).toBeDisabled();
 await page.screenshot({path:'.artifacts/comparison.png',fullPage:false});
 await page.getByRole('button',{name:'Matrix 1',exact:true}).click();
 await range(page,'frame-slider',0);await expect(page.locator('#original-frame')).toHaveText('000100');
 await range(page,'frame-slider',63);await expect(page.locator('#original-frame')).toHaveText('000514');
 await page.getByLabel('Predicted cortex overlay',{exact:false}).uncheck();await expect(page.locator('#image-label')).toHaveText('ORIGINAL B-MODE');
 await page.getByLabel('Predicted cortex overlay',{exact:false}).check();
 await page.getByRole('button',{name:'Play sweep',exact:true}).click();await expect(page.getByRole('button',{name:'Pause sweep',exact:true})).toBeVisible();await expect(page.locator('#original-frame')).not.toHaveText('000514');await page.getByRole('button',{name:'Pause sweep',exact:true}).click();
 await page.getByRole('button',{name:'About the calibration matrices'}).click();await expect(page.getByRole('dialog')).toContainText('-50.816425');await page.getByRole('button',{name:'Close details'}).click();
 await page.getByRole('button',{name:'Front view'}).click();await page.getByRole('button',{name:'Top view'}).click();await page.getByRole('button',{name:'Side view'}).click();await page.getByRole('button',{name:'Oblique view'}).click();await page.getByRole('button',{name:'Fit model'}).click();
 const firstDownload=page.waitForEvent('download');await page.locator('#download-stl').click();const original=await firstDownload;expect(hash(await readFile(await original.path()))).toBe(case514.meshes.matrix_1.sha256);
 await page.locator('#advanced-settings summary').click();await page.locator('#sample-count').selectOption('64');await page.locator('#voxel-size').selectOption('1');await page.locator('#reconstruct').click();
 await expect(page.locator('#surface-kind')).toHaveText('BROWSER PREVIEW',{timeout:90000});await expect(page.locator('#scene-label')).toContainText('1.0 mm · 64 frames');expect(Number((await page.locator('#triangle-count').textContent()).replaceAll(',',''))).toBeGreaterThan(100);
 await page.screenshot({path:'.artifacts/browser-reconstruction.png',fullPage:true});
 const previewDownload=page.waitForEvent('download');await page.locator('#download-stl').click();const preview=await previewDownload,previewBytes=await readFile(await preview.path());expect(previewBytes.length).toBe(84+previewBytes.readUInt32LE(80)*50);
 // The saved STL is in physical local coordinates, not the display's centered frame.
 let meanZ=0,vertexCount=0;for(let t=0;t<previewBytes.readUInt32LE(80);t++)for(let v=0;v<3;v++){meanZ+=previewBytes.readFloatLE(84+t*50+12+v*12+8);vertexCount++;}expect(meanZ/vertexCount).toBeGreaterThan(100);
 await page.locator('#restore-full').click();await expect(page.locator('#surface-kind')).toHaveText('FULL SWEEP');await expect(page.locator('#triangle-count')).toHaveText(count(case514,'matrix_1'));
 await page.locator('#stl-input').setInputFiles(path.join('dist',case514.meshes.matrix_1.file));await expect(page.locator('#surface-kind')).toHaveText('LOCAL FILE');await expect(page.locator('#model-dimensions')).toContainText('units');
 const invalid=Buffer.alloc(84);invalid.writeUInt32LE(0xffffffff,80);await page.locator('#stl-input').setInputFiles({name:'invalid.stl',mimeType:'application/octet-stream',buffer:invalid});await expect(page.locator('#toast')).toContainText('triangle count does not match');await expect(page.locator('#triangle-count')).toHaveText(count(case514,'matrix_1'));
 const ascii='solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid test';await page.locator('#stl-input').setInputFiles({name:'triangle.stl',mimeType:'application/octet-stream',buffer:Buffer.from(ascii)});await expect(page.locator('#triangle-count')).toHaveText('1');
 await page.locator('[data-case="192840"]').click();await expect(page.locator('#triangle-count')).toHaveText(count(case840,'matrix_1'),{timeout:90000});await expect(page.locator('#original-frame')).toHaveText('000124');await expect(page.locator('#download-stl')).toHaveAttribute('href',case840.meshes.matrix_1.file);await expect(page.locator('#reconstruct')).toBeEnabled({timeout:90000});
 expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET'&&r.method!=='HEAD')).toEqual([]);
});

test('mobile layout remains usable and has no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
 await page.getByRole('button',{name:'How it works',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close details'}).click();await page.screenshot({path:'.artifacts/mobile.png',fullPage:true});
});

test('without WebGL, original image playback and STL downloads remain accessible',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.call(this,type,...args);};});
 await ready(page);await expect(page.locator('#webgl-fallback')).toBeVisible();await expect(page.locator('#reconstruct')).toBeDisabled();await expect(page.locator('#download-stl')).toHaveAttribute('href',case514.meshes.matrix_1.file);await range(page,'frame-slider',63);await expect(page.locator('#original-frame')).toHaveText('000514');
});
