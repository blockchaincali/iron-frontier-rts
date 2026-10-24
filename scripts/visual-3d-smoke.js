'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');

const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3003';
const baseline=process.argv.includes('--baseline');
const chromePaths=process.platform==='win32'?
 ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']:
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
if(!executablePath)throw new Error('Chrome/Chromium was not found. Set CHROME_PATH.');
const output=path.join(__dirname,'..','artifacts','milestone-3');
fs.mkdirSync(output,{recursive:true});
const failures=[];

async function prepare(context,label){
 const page=await context.newPage();
 page.on('console',message=>{if(message.type()==='error')failures.push(`${label} console: ${message.text()}`)});
 page.on('pageerror',error=>failures.push(`${label} page error: ${error.message}`));
 page.on('requestfailed',request=>failures.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText||''}`));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('iron-frontier-view','3d');localStorage.setItem('iron-frontier-tutorial-complete','1');localStorage.setItem('iron-frontier-name','Visual QA');});
 await page.reload({waitUntil:'networkidle'});
 await page.locator('#solo').click();
 await page.locator('#world3d').waitFor({state:'visible',timeout:15000});
 await page.waitForTimeout(2500);
 const webgl=await page.evaluate(()=>{const canvas=document.querySelector('#world3d');const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 if(!webgl)failures.push(`${label}: WebGL context unavailable`);
 return {page,webgl};
}

async function run(){
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const results={capturedAt:new Date().toISOString(),baseline,failures,desktop:null,mobile:null};
 try{
  const desktopContext=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const {page,webgl}=await prepare(desktopContext,'desktop');
  const steadyMetrics=await page.evaluate(()=>window.Iron3D?.metrics?.()||null);
  await page.screenshot({path:path.join(output,baseline?'before-desktop-3d.png':'after-desktop-3d.png'),fullPage:false});
  if(!baseline){
   for(const target of ['rifle','tank','hq']){
    await page.evaluate(value=>window.Iron3D?.inspect(value),target);
    await page.waitForTimeout(650);
    await page.screenshot({path:path.join(output,`closeup-${target}.png`),fullPage:false});
   }
   await page.locator('#select-all').click();
   const box=await page.locator('#world3d').boundingBox();
   if(box)await page.mouse.click(box.x+box.width*.72,box.y+box.height*.47);
   await page.waitForTimeout(9000);
   await page.screenshot({path:path.join(output,'active-combat.png'),fullPage:false});
   await page.locator('[data-action="orbital"]').click();
   if(box)await page.mouse.click(box.x+box.width*.66,box.y+box.height*.46);
   await page.waitForTimeout(850);
   await page.screenshot({path:path.join(output,'orbital-strike.png'),fullPage:false});
   await page.locator('#view-mode').click();
   await page.locator('#world').waitFor({state:'visible'});
   await page.screenshot({path:path.join(output,'fallback-2d.png'),fullPage:false});
  }
  results.desktop={webgl,metrics:steadyMetrics};
  await desktopContext.close();
  if(!baseline){
   const mobileContext=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const mobile=await prepare(mobileContext,'mobile');
   const overflow=await mobile.page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
   if(overflow.document>overflow.viewport+1)failures.push(`mobile horizontal overflow: ${JSON.stringify(overflow)}`);
   await mobile.page.screenshot({path:path.join(output,'mobile-3d.png'),fullPage:false});
   results.mobile={webgl:mobile.webgl,metrics:await mobile.page.evaluate(()=>window.Iron3D?.metrics?.()||null),overflow};
   await mobileContext.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,baseline?'baseline.json':'performance.json'),JSON.stringify(results,null,2));
 if(failures.length)throw new Error(failures.join('\n'));
 console.log(JSON.stringify(results,null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1});
