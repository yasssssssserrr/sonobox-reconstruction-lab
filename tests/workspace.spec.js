import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const datasets=JSON.parse(await readFile(new URL('../dist/assets/datasets.json',import.meta.url),'utf8'));
const first=datasets.cases.find(c=>c.id==='192514');
const combined=(first.meshes.matrix_1.triangles+first.meshes.matrix_2.triangles).toLocaleString('en-US');
async function ready(page){
 await page.goto('./');
 await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
 await expect(page.locator('#viewer-loading')).toBeHidden();
}

test('expanded viewer preserves comparison and restores workspace with Escape',async({page})=>{
 await ready(page);
 await page.getByRole('button',{name:'Compare',exact:true}).click();
 await expect(page.locator('#triangle-count')).toHaveText(combined);
 const initial=await page.locator('#viewport').boundingBox();
 await page.getByRole('button',{name:'Expand 3D viewer',exact:true}).click();
 await expect(page.locator('#focus-viewer')).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#settings-panel')).toBeHidden();
 await expect(page.getByRole('complementary',{name:'Ultrasound frame viewer'})).toBeHidden();
 await expect.poll(async()=>Math.round((await page.locator('#viewport').boundingBox()).width)).toBeGreaterThan(initial.width+200);
 await expect(page.locator('#triangle-count')).toHaveText(combined);
 await page.screenshot({path:'.artifacts/workspace-expanded.png',fullPage:false});
 await page.keyboard.press('Escape');
 await expect(page.locator('#focus-viewer')).toHaveAttribute('aria-expanded','false');
 await expect(page.getByRole('button',{name:'Expand 3D viewer',exact:true})).toBeFocused();
 await expect(page.locator('#settings-panel')).toBeVisible();
 await expect(page.locator('#triangle-count')).toHaveText(combined);
});

test('frame buttons use sampled source indices, stop playback and respect endpoints',async({page})=>{
 await ready(page);
 const frames=datasets.cases.find(c=>c.id==='192514').frames;
 await page.getByRole('button',{name:'Next sampled frame',exact:true}).click();
 await expect(page.locator('#original-frame')).toHaveText(String(frames[32].index).padStart(6,'0'));
 await page.getByRole('button',{name:'Previous sampled frame',exact:true}).click();
 await expect(page.locator('#original-frame')).toHaveText('000304');
 for(const [position,disabled,enabled]of [[0,'Previous sampled frame','Next sampled frame'],[63,'Next sampled frame','Previous sampled frame']]){
  await page.locator('#frame-slider').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},position);
  await expect(page.getByRole('button',{name:disabled,exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:enabled,exact:true})).toBeEnabled();
 }
 await page.getByRole('button',{name:'Play sweep',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause sweep',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Previous sampled frame',exact:true}).click();
 await expect(page.getByRole('button',{name:'Play sweep',exact:true})).toBeVisible();
});

test('mobile settings, theme contrast and layout work across supported widths',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:375,height:812});
 await ready(page);
 await expect(page.locator('#settings-panel')).toBeHidden();
 expect((await page.locator('#viewer-panel').boundingBox()).y).toBeLessThan(812);
 await page.getByRole('button',{name:'Show reconstruction settings',exact:true}).click();
 await expect(page.locator('#settings-panel')).toBeVisible();
 await page.getByRole('button',{name:'Matrix 2',exact:true}).click();
 await expect(page.locator('#triangle-count')).toHaveText(first.meshes.matrix_2.triangles.toLocaleString('en-US'));
 await page.keyboard.press('Escape');
 await expect(page.locator('#settings-panel')).toBeHidden();
 await expect(page.getByRole('button',{name:'Show reconstruction settings',exact:true})).toBeFocused();
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:width===375?812:1000});
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#appearance-toggle').click();
   const result=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    const lum=value=>{const hex=value.trim().replace('#',''),c=hex.length===3?[...hex].map(v=>v+v).join(''):hex;const rgb=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const ratio=(a,b)=>{const x=lum(css.getPropertyValue(a)),y=lum(css.getPropertyValue(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    return {viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
     text:ratio('--text','--surface'),secondary:ratio('--secondary','--surface'),
     muted:ratio('--tertiary','--page'),action:ratio('--on-accent','--accent')};
   });
   expect(result.scroll,`${width}px ${theme} overflow`).toBeLessThanOrEqual(result.viewport);
   for(const key of ['text','secondary','muted','action'])expect(result[key],`${width}px ${theme} ${key} contrast`).toBeGreaterThanOrEqual(4.5);
   if(width===375||width===1440)await page.screenshot({path:`.artifacts/workspace-${width}-${theme}.png`,fullPage:true});
  }
 }
 await page.setViewportSize({width:812,height:375});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Expand 3D viewer',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.locator('#focus-viewer')).toHaveAttribute('aria-expanded','false');
 expect(errors).toEqual([]);
});
