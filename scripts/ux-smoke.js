'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');

const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3002';
const chromePaths=process.platform==='win32'?
 ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']:
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
if(!executablePath)throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run UX smoke tests.');

const output=path.join(__dirname,'..','artifacts','milestone-2');
fs.mkdirSync(output,{recursive:true});
const failures=[];

async function assertNoOverflow(page,label){
 const sizes=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('*')].map(element=>({tag:element.tagName,id:element.id,className:typeof element.className==='string'?element.className:'',left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right),width:Math.round(element.getBoundingClientRect().width)})).filter(item=>item.right>innerWidth+1||item.left< -1).slice(0,8)}));
 if(sizes.html>sizes.viewport+1||sizes.offenders.length)failures.push(`${label} horizontal overflow: ${JSON.stringify(sizes)}`);
}

async function setupPage(context,label){
 const page=await context.newPage();
 page.on('console',message=>{if(message.type()==='error')failures.push(`${label} console: ${message.text()}`)});
 page.on('pageerror',error=>failures.push(`${label} page error: ${error.message}`));
 page.on('requestfailed',request=>failures.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText||''}`));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('iron-frontier-view','2d')});
 await page.reload({waitUntil:'networkidle'});
 return page;
}

async function clickBattlefield(page,xRatio,yRatio){
 const box=await page.locator('#world').boundingBox();
 if(!box)throw new Error('Battlefield canvas is not visible');
 await page.mouse.click(box.x+box.width*xRatio,box.y+box.height*yRatio);
}

async function runDesktop(browser){
 const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
 const page=await setupPage(context,'desktop');
 await page.screenshot({path:path.join(output,'home-desktop.png'),fullPage:true});
 await assertNoOverflow(page,'desktop home');
 await page.locator('#tutorial').click();
 await page.locator('#mission-title').filter({hasText:'Build your squad'}).waitFor();
 await page.screenshot({path:path.join(output,'tutorial-desktop.png'),fullPage:true});
 await page.locator('[data-build="rifle"]').click();
 await page.locator('#mission-title').filter({hasText:'Select a unit'}).waitFor({timeout:5000});
 await clickBattlefield(page,.22,.48);
 await page.locator('#mission-title').filter({hasText:'Move into position'}).waitFor();
 await clickBattlefield(page,.38,.32);
 await page.locator('#mission-title').filter({hasText:'Advance and engage'}).waitFor({timeout:5000});
 await page.locator('[data-action="attackmove"]').click();
 await clickBattlefield(page,.5,.5);
 await page.locator('#mission-title').filter({hasText:'Capture a relay'}).waitFor({timeout:5000});
 await clickBattlefield(page,.5,.5);
 await page.locator('#mission-title').filter({hasText:'How to win'}).waitFor({timeout:35000});
 await page.locator('#tutorial-ready').click();
 await page.getByText('Training complete — the frontier is yours',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'battle-desktop.png'),fullPage:true});
 await assertNoOverflow(page,'desktop battle');
 await context.close();
}

async function runMobile(browser){
 const context=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await setupPage(context,'mobile');
 await page.screenshot({path:path.join(output,'home-mobile.png'),fullPage:true});
 await assertNoOverflow(page,'mobile home');
 await page.locator('#tutorial').tap();
 await page.locator('#mission-title').filter({hasText:'Build your squad'}).waitFor();
 await page.screenshot({path:path.join(output,'tutorial-mobile.png'),fullPage:true});
 await assertNoOverflow(page,'mobile tutorial');
 await page.locator('#tutorial-skip').tap();
 await page.waitForTimeout(2800);
 await page.screenshot({path:path.join(output,'battle-mobile.png'),fullPage:true});
 await assertNoOverflow(page,'mobile battle');
 await context.close();
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu','--no-sandbox']});
 try{await runDesktop(browser);await runMobile(browser)}finally{await browser.close()}
 if(failures.length)throw new Error(failures.join('\n'));
 console.log('UX smoke passed: tutorial flow, console/network checks, screenshots, and 360px overflow validation.');
})().catch(error=>{console.error(error);process.exitCode=1});
