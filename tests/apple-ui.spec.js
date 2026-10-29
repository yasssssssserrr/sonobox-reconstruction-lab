import {test,expect} from '@playwright/test';
import {Spring} from '../dist/apple-ui.js';
import {readFile} from 'node:fs/promises';
const datasets=JSON.parse(await readFile(new URL('../dist/assets/datasets.json',import.meta.url),'utf8'));

test('a moving spring reverses from its displayed value and velocity',()=>{
 const originalRAF=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 try{
  const s=new Spring(0,()=>{});s.set(100);const start=s.last;s.tick(start+80);const value=s.value,velocity=s.velocity;
  expect(value).toBeGreaterThan(0);expect(value).toBeLessThan(100);s.set(0);
  expect(s.value).toBe(value);expect(s.velocity).toBe(velocity);
  for(let i=1;i<200;i++)s.tick(start+80+i*16);
  expect(s.value).toBe(0);expect(s.velocity).toBe(0);
  const reduced=new Spring(0,()=>{},{reduced:()=>true});reduced.set(100);expect(reduced.value).toBe(100);expect(reduced.frame).toBe(0);
 }finally{globalThis.requestAnimationFrame=originalRAF;globalThis.cancelAnimationFrame=originalCancel;}
});

test('appearance persists, calibration controls retarget and details honor reduced motion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('#advanced-settings')).not.toHaveAttribute('open');
 await page.getByRole('button',{name:'Use dark appearance'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:'.artifacts/apple-dark.png',fullPage:true});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
 await page.getByRole('button',{name:'Use light appearance'}).click();
 await page.locator('#matrix-options').evaluate(el=>{for(const key of ['matrix_2','both','matrix_1'])el.querySelector(`[data-matrix="${key}"]`).click();});
 await expect(page.locator('#matrix-options [data-matrix="matrix_1"]')).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.locator('#matrix-options').evaluate(el=>{const indicator=el.querySelector('.segment-indicator').getBoundingClientRect(),selected=el.querySelector('[aria-pressed="true"]').getBoundingClientRect();return Math.abs(indicator.x-selected.x)+Math.abs(indicator.width-selected.width);})).toBeLessThan(.1);
 await page.emulateMedia({reducedMotion:'reduce',contrast:'more'});
 await page.getByRole('button',{name:'How it works',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();expect(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'How it works',exact:true})).toBeFocused();
 await page.getByLabel('Reconstructed surface',{exact:true}).uncheck();await page.getByLabel('Reconstructed surface',{exact:true}).check();
 await expect(page.locator('#triangle-count')).toHaveText(datasets.cases.find(c=>c.id==='192514').meshes.matrix_1.triangles.toLocaleString('en-US'));expect(errors).toEqual([]);
});
