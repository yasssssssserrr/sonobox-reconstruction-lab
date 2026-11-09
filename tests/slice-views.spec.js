import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const slices=JSON.parse(await readFile(new URL('../dist/assets/20261108/slices.json',import.meta.url),'utf8'));
async function ready(page){await page.goto('./');await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});}
async function panelReady(page,key){
 const panel=page.locator('#slice-panel');await panel.scrollIntoViewIfNeeded();
 await expect(panel).toHaveAttribute('data-slice-ready',key,{timeout:90000});
}
const maskPixels=async(page,name)=>Number(await page.locator(`#slice-${name}`).getAttribute('data-mask-pixels'));

test('three Slicer-style views show the bone mask and move together',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 await panelReady(page,'192514/matrix_1/ultrasound');
 for(const name of ['red','yellow','green'])expect(await maskPixels(page,name)).toBeGreaterThan(0);
 const volume=slices.volumes.find(v=>v.sweep==='192514'&&v.matrix==='matrix_1');
 const [depth,across,along]=volume.shape_depth_across_along;
 await expect(page.locator('#slice-red')).toHaveJSProperty('width',along);
 await expect(page.locator('#slice-red')).toHaveJSProperty('height',across);
 await expect(page.locator('#slice-yellow')).toHaveJSProperty('height',depth);
 // Clicking the red view moves the yellow plane (along) and the green plane (across) to the clicked voxel.
 const box=await page.locator('#slice-red').boundingBox();
 const dx=box.width*0.25,dy=box.height*0.75;
 await page.mouse.click(box.x+dx,box.y+dy);
 // The browser rounds the click to whole screen pixels, so allow the neighbouring voxel.
 await expect.poll(async()=>Math.abs(Number(await page.locator('#slice-yellow-slider').inputValue())-dx/box.width*along)).toBeLessThan(1.5);
 await expect.poll(async()=>Math.abs(Number(await page.locator('#slice-green-slider').inputValue())-dy/box.height*across)).toBeLessThan(1.5);
 await page.locator('#slice-mask').uncheck();
 for(const name of ['red','yellow','green'])await expect(page.locator(`#slice-${name}`)).toHaveAttribute('data-mask-pixels',/\d+/);
 await page.locator('#slice-mask').check();
 await page.locator('#slice-background [data-value="ct"]').click();
 await panelReady(page,'192514/matrix_1/ct');
 await expect(page.locator('#slice-status')).toContainText('CT 1301');
 await page.locator('#slice-matrix [data-value="matrix_2"]').click();
 await panelReady(page,'192514/matrix_2/ct');
 await page.locator('[data-case="184600"]').click();
 await panelReady(page,'184600/matrix_2/ct');
 await expect(page.locator('#slice-status')).toContainText('big phantom');
 expect(await maskPixels(page,'red')).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});

test('slice views fit a phone screen without horizontal scrolling',async({page})=>{
 await page.setViewportSize({width:375,height:812});await ready(page);
 await panelReady(page,'192514/matrix_1/ultrasound');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 const wrap=await page.locator('.slice-red .slice-canvas-wrap').boundingBox(),canvas=await page.locator('#slice-red').boundingBox();
 expect(canvas.width).toBeLessThanOrEqual(wrap.width+1);expect(canvas.height).toBeLessThanOrEqual(wrap.height+1);
});
