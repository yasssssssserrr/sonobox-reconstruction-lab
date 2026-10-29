import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(new URL('../dist/assets/datasets.json',import.meta.url),'utf8'));
const sweep=manifest.cases.find(c=>c.id==='192619');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function ready(page){await page.goto('./');await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});}

test('192619 respects the reviewed endpoint and downloads both new physical surfaces',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 await expect(page.locator('[data-case]')).toHaveCount(3);
 await page.locator('[data-case="192619"]').click();
 await expect(page.locator('#original-frame')).toHaveText('000167');
 await expect(page.locator('#source-note')).toContainText('341–499 excluded');
 await expect(page.locator('#timeline-description')).toContainText('341 source frames');
 const slider=page.locator('#frame-slider');await slider.focus();await slider.press('End');
 await expect(page.locator('#original-frame')).toHaveText('000340');
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
 await page.screenshot({path:'.artifacts/refresh-20261029/sweep192619.png',fullPage:true});
 await page.locator('#data-nav').click();
 await expect(page.getByRole('dialog')).toContainText('500 acquired frames · 341 usable');
 await expect(page.getByRole('dialog')).toContainText('All three displayed acquisitions contributed to fitting');
 await expect(page.getByRole('dialog')).toContainText(sweep.checkpoint_sha256);
 await page.locator('#close-dialog').click();
 await page.locator('#project-anatomy').scrollIntoViewIfNeeded();
 await expect(page.locator('#project-anatomy')).toHaveAttribute('data-ready','true');
 await page.locator('[data-anatomy-stage="0"]').click();
 await expect(page.locator('#anatomy-case')).toHaveValue('192619');
 await expect(page.locator('#project-anatomy')).not.toHaveAttribute('aria-pressed');
 await page.locator('#anatomy-frame').focus();await page.keyboard.press('End');
 await expect(page.locator('#anatomy-source-frame')).toHaveText('000340');
 await expect(page.locator('#original-frame')).toHaveText('000340');
 expect(errors).toEqual([]);
});

test('the additional sweep fits small screens, landscape and enlarged text',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 for(const [width,height]of [[375,812],[812,375]]){
  await page.setViewportSize({width,height});
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#appearance-toggle').click();
   if(width<700&&await page.locator('#settings-toggle').getAttribute('aria-expanded')!=='true')await page.locator('#settings-toggle').click();
   await page.locator('[data-case="192619"]').click();
   await expect(page.locator('#original-frame')).toHaveText('000167');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
   await page.addStyleTag({content:'html{font-size:20px}'});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
 }
});
