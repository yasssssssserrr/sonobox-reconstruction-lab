import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(new URL('../dist/assets/datasets.json',import.meta.url),'utf8'));
const sweep=manifest.cases.find(c=>c.id==='192619');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pad=i=>String(i).padStart(6,'0');
async function ready(page){await page.goto('./');await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});}

test('192619 ends at its last usable frame and downloads both final-model surfaces',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 await expect(page.locator('[data-case]')).toHaveCount(9);
 await page.locator('[data-case="192619"]').click();
 await expect(page.locator('#original-frame')).toHaveText(pad(sweep.frames[31].index));
 await expect(page.locator('#source-note')).toContainText('fitted on this sweep');
 await expect(page.locator('#timeline-description')).toContainText(`${sweep.eligible_frames} source frames`);
 const slider=page.locator('#frame-slider');await slider.focus();await slider.press('End');
 await expect(page.locator('#original-frame')).toHaveText('000349');
 await slider.press('Home');await expect(page.locator('#original-frame')).toHaveText('000000');
 await expect(page.locator('#viewer-loading')).toBeHidden({timeout:90000});
 await expect(page.locator('#viewer-panel')).toHaveAttribute('aria-busy','false');
 for(const key of ['matrix_1','matrix_2']){
  await page.locator(`#matrix-options [data-matrix="${key}"]`).click();
  await expect(page.locator('#triangle-count')).toHaveText(sweep.meshes[key].triangles.toLocaleString('en-US'));
  const pending=page.waitForEvent('download');await page.locator('#download-stl').click();
  const download=await pending;expect(hash(await readFile(await download.path()))).toBe(sweep.meshes[key].sha256);
 }
 await page.locator('#matrix-options [data-matrix="both"]').click();
 await expect(page.locator('#triangle-count')).toHaveText((sweep.meshes.matrix_1.triangles+sweep.meshes.matrix_2.triangles).toLocaleString('en-US'));
 await page.screenshot({path:'.artifacts/final-20261108/sweep192619.png',fullPage:true});
 await page.locator('#data-nav').click();
 await expect(page.getByRole('dialog')).toContainText('500 acquired frames · 350 usable');
 await expect(page.getByRole('dialog')).toContainText('fitted on 685 human masks');
 await expect(page.getByRole('dialog')).toContainText(sweep.checkpoint_sha256);
 await page.locator('#close-dialog').click();
 await expect(page.getByRole('dialog')).toBeHidden();
 await slider.focus();await slider.press('End');
 await expect(page.locator('#original-frame')).toHaveText('000349');
 expect(errors).toEqual([]);
});

test('the sweep list fits small screens, landscape and enlarged text',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 for(const [width,height]of [[375,812],[812,375]]){
  await page.setViewportSize({width,height});
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#appearance-toggle').click();
   if(width<700&&await page.locator('#settings-toggle').getAttribute('aria-expanded')!=='true')await page.locator('#settings-toggle').click();
   await page.locator('[data-case="192619"]').click();
   await expect(page.locator('#original-frame')).toHaveText(pad(sweep.frames[31].index));
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
   await page.addStyleTag({content:'html{font-size:20px}'});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
 }
});

test('sweeps without human masks are labelled as unfitted and show their usable frames',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 const unannotated=manifest.cases.filter(c=>c.model_training_role.startsWith('Not used'));
 expect(unannotated.map(c=>c.id)).toEqual(['192447','192754','194903']);
 for(const c of unannotated){
  await page.locator(`[data-case="${c.id}"]`).click();
  await expect(page.locator('#source-note')).toContainText('No human masks exist for this sweep');
  await expect(page.locator('#timeline-description')).toContainText(`${c.eligible_frames} source frames`);
  await expect(page.locator('#original-frame')).toHaveText(pad(c.frames[31].index));
  await expect(page.locator('#viewer-loading')).toBeHidden({timeout:90000});
  await page.locator('#data-nav').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText(`${c.source_frames} acquired frames · ${c.eligible_frames} usable`);
  await expect(dialog).toContainText('the dataset owner marked the usable frames');
  await expect(dialog).toContainText('Not used for model fitting');
  await expect(dialog).toContainText(c.checkpoint_sha256);
  await page.locator('#close-dialog').click();
  await expect(dialog).toBeHidden();
 }
 expect(errors).toEqual([]);
});
