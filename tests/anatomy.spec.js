import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../dist/assets/datasets.json',import.meta.url),'utf8'));
async function ready(page){
 await page.goto('./#project-anatomy');
 await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
 await page.locator('#project-anatomy').scrollIntoViewIfNeeded();
 await expect(page.locator('#project-anatomy')).toHaveAttribute('data-ready','true');
 await page.locator('[data-anatomy-stage="0"]').click();
}

test('project anatomy follows real sweep, frame and calibration selections in both directions',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await ready(page);
 await expect(page.locator('#anatomy-source-frame')).toHaveText('000304');
 await expect(page.locator('.anatomy-part')).toHaveCount(69);
 await expect(page.locator('.anatomy-machine')).not.toHaveAttribute('aria-hidden','true');
 await page.locator('#anatomy-case').selectOption('192840');
 await expect(page.locator('#project-anatomy')).toHaveAttribute('data-sweep','192840');
 await expect(page.locator('#original-frame')).toHaveText('000124');
 await page.locator('#anatomy-matrix').selectOption('matrix_2');
 await expect(page.locator('#matrix-options [data-matrix="matrix_2"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#viewer-loading')).toBeHidden({timeout:90000});
 await expect(page.locator('#triangle-count')).toHaveText(manifest.cases.find(c=>c.id==='192840').meshes.matrix_2.triangles.toLocaleString('en-US'));
 const input=page.locator('#anatomy-frame');await input.focus();await input.press('End');
 const frame=manifest.cases.find(c=>c.id==='192840').frames[63];
 await expect(page.locator('#anatomy-source-frame')).toHaveText(String(frame.index).padStart(6,'0'));
 await expect(page.locator('#original-frame')).toHaveText(String(frame.index).padStart(6,'0'));
 await expect(page.locator('#anatomy-monitor-image')).toHaveAttribute('href',frame.image);
 await expect(page.locator('#anatomy-pixels')).toHaveText(frame.cortex_pixels_at_0_5.toLocaleString('en-US'));
 await page.locator('#matrix-options [data-matrix="both"]').click();
 await expect(page.locator('#anatomy-comparison-note')).toBeVisible();
 await page.locator('#matrix-options [data-matrix="matrix_1"]').click();
 await expect(page.locator('#anatomy-comparison-note')).toBeHidden();
 await expect(page.locator('#anatomy-matrix')).toHaveValue('matrix_1');
 expect(errors).toEqual([]);
});

test('stages, keyboard controls, reduced motion and source image overlay remain truthful',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 await expect(page.locator('#anatomy-tour')).toHaveText('Play walkthrough');
 for(const [i,title]of ['Acquire a tracked sweep','Identify the visible cortex','Place and compound the evidence','Inspect a partial surface'].entries()){
  const button=page.locator(`[data-anatomy-stage="${i}"]`);await button.focus();await button.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed','true');await expect(page.locator('#anatomy-step-title')).toHaveText(title);
 }
 await page.locator('[data-anatomy-stage="1"]').click();
 expect(await page.locator('#anatomy-monitor-overlay').getAttribute('d')).toContain('v1h');
 const transform=await page.locator('[data-probe]').first().getAttribute('transform');
 await page.waitForTimeout(250);
 expect(await page.locator('[data-probe]').first().getAttribute('transform')).toBe(transform);
 await page.locator('#anatomy-frame').focus();await page.keyboard.press('Home');
 await expect(page.locator('#anatomy-source-frame')).toHaveText('000100');
 await expect(page.locator('#anatomy-progress')).toHaveText('1 / 64');
 await page.locator('#anatomy-open-surface').click();
 await expect(page.locator('#focus-viewer')).toBeFocused();
 await expect(page.locator('#surface-kind')).toHaveText('FULL SWEEP');
});

test('illustration fits supported viewports and both appearances',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 for(const width of [390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#appearance-toggle').click();
   await expect(page.locator('.anatomy-machine')).toHaveAttribute('data-theme',theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
   await page.locator('[data-anatomy-stage="2"]').click();
   await page.locator('#project-anatomy').screenshot({path:`.artifacts/anatomy-${width}-${theme}.png`});
  }
 }
 expect(errors).toEqual([]);
});

test('SVG project explanation works when WebGL is unavailable',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).startsWith('webgl'))return null;return original.call(this,type,...args);};});
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 await expect(page.locator('#webgl-fallback')).toBeVisible();
 await page.locator('#anatomy-case').selectOption('192840');
 await expect(page.locator('#anatomy-source-frame')).toHaveText('000124');
 await page.locator('[data-anatomy-stage="1"]').click();
 await expect(page.locator('#anatomy-monitor-image')).toHaveAttribute('href','assets/192840/frames/000124.png');
 await expect(page.locator('#anatomy-step-title')).toHaveText('Identify the visible cortex');
});
