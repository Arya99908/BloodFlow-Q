async (page) => {
 const outcomes=[];
 await page.getByRole('combobox',{name:'Saved execution',exact:true}).waitFor();
 const options=await page.locator('.execution-inspector select option').evaluateAll(nodes=>nodes.map(n=>n.value));
 for(const id of options){
  await page.getByRole('combobox',{name:'Saved execution',exact:true}).selectOption(id);
  const text=await page.locator('.execution-inspector').innerText();
  if(text.includes('NaN')||text.includes('undefined')) throw new Error('Invalid metric for '+id);
  outcomes.push({id,chart:await page.locator('.execution-inspector .science-chart svg').count()});
 }
 await page.getByRole('combobox',{name:'Saved execution',exact:true}).selectOption(options[0]);
 for(const theme of ['light','dark']){
  const toggle=page.getByRole('switch',{name:'Toggle dark theme'});
  if((await toggle.getAttribute('aria-checked'))!==(theme==='dark'?'true':'false'))await toggle.click();
  for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.screenshot({path:'/Users/shreeshaks/Documents/BloodFlow-Q-main 3/output/playwright/quantum-'+size+'-'+theme+'.png',fullPage:false});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   outcomes.push({size,theme,overflow});
   await page.locator('.execution-inspector .obs-grid').scrollIntoViewIfNeeded();
   await page.screenshot({path:'/Users/shreeshaks/Documents/BloodFlow-Q-main 3/output/playwright/quantum-measurements-'+size+'-'+theme+'.png',fullPage:false});
  }
 }
 await page.locator('.execution-inspector details').first().locator('summary').click();
 const countRows=await page.locator('.execution-inspector details').first().locator('tbody tr').count();
 return {executions:outcomes,countRows};
}
