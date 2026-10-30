async (page) => {
  const dir='/Users/shreeshaks/Documents/BloodFlow-Q-main 3/output/playwright/audit';
  const results=[];
  const routes=['optimization','reports','dashboard','results','emergency','demo','', 'blood-banks','hospitals','network','donor-network','emergency-requests','coordination','quantum-lab','flow','about'];
  for (const theme of ['dark','light']) for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(theme=>localStorage.setItem('bloodflow-theme',theme),theme);
    for (const route of routes) {
      await page.goto('http://127.0.0.1:5173/'+route);
      await page.locator('main h1').first().waitFor();
      await page.waitForTimeout(400);
      if(route==='optimization') {await page.getByRole('button',{name:'RUN COMPARISON',exact:true}).click();await page.locator('.benchmark-skip-notice').waitFor();}
      await page.addScriptTag({path:'/tmp/bloodflow-axe.min.js'});
      // Reveal scroll-animated content before checking it.
      await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=650){window.scrollTo(0,y);await new Promise(r=>requestAnimationFrame(r));}});
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      const metrics=await page.evaluate(()=>{const dock=document.querySelector('.bloodflow-dock').getBoundingClientRect();const footer=document.querySelector('.app-footer');const last=footer.lastElementChild.getBoundingClientRect();return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth,footerClear:last.bottom<=dock.top,footerBottom:last.bottom,dockTop:dock.top};});
      const violations=[]; let incomplete=0;
      const height=await page.evaluate(()=>document.documentElement.scrollHeight);
      for(let y=0;y<height;y+=750){
        await page.evaluate(y=>window.scrollTo(0,y),y); await page.waitForTimeout(60);
        const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:['color-contrast']}));
        for(const v of axe.violations) for(const n of v.nodes) if(!violations.some(x=>JSON.stringify(x.target)===JSON.stringify(n.target))) violations.push({target:n.target,summary:n.failureSummary});
        incomplete=Math.max(incomplete,axe.incomplete.reduce((n,v)=>n+v.nodes.length,0));
      }
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForTimeout(350);
      const entry={route:route||'home',theme,width,...metrics,violations,incomplete};results.push(entry);
      if(routes.indexOf(route)<6) await page.screenshot({path:`${dir}/${route}-${theme}-${width}.png`,fullPage:true});
    }
  }
  return results;
}
