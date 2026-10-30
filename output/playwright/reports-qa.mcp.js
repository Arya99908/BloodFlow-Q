async page => {
 const results=[];
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:5173/reports');
 await page.getByRole('heading',{name:'Solver Benchmark Observatory'}).waitFor();
 await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('critical_shortage');
 for(const theme of ['light','dark']){
  const toggle=page.getByRole('switch',{name:'Toggle dark theme'});
  if((await toggle.getAttribute('aria-checked'))!==(theme==='dark'?'true':'false'))await toggle.click();
  for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
   await page.getByRole('tab',{name:'Quality & runtime'}).click();
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.screenshot({path:'/Users/shreeshaks/Documents/BloodFlow-Q-main 3/output/playwright/reports-'+size+'-'+theme+'.png',fullPage:false});
   for(const name of ['Quality & runtime','Paired seeds','Distributions','Scenario matrix','Scalability','Reproducibility']){
    await page.getByRole('tab',{name,exact:true}).click();
    if(name==='Distributions'){
     for(const metric of ['relative_gap','runtime_seconds','operational_feasible_shot_rate','strict_optimal_shot_rate'])await page.getByRole('combobox',{name:'Measurement',exact:true}).selectOption(metric);
    }
    if(name==='Paired seeds'){
     await page.getByRole('combobox',{name:'Reference solver',exact:true}).selectOption('lp');
     await page.getByRole('combobox',{name:'Compared solver',exact:true}).selectOption('warm');
     await page.getByRole('combobox',{name:'Measurement',exact:true}).selectOption('runtime_seconds');
    }
    if(name==='Scalability')for(const measure of ['circuit_depth','two_qubit_gates','peak_rss_bytes','runtime_seconds'])await page.getByRole('combobox',{name:'Resource / outcome',exact:true}).selectOption(measure);
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    results.push({theme,size,tab:name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),nan:(await page.locator('#obs-view').innerText()).includes('NaN')});
    if(['Distributions','Paired seeds'].includes(name)){
     await page.locator('#obs-view').scrollIntoViewIfNeeded();
     await page.screenshot({path:'/Users/shreeshaks/Documents/BloodFlow-Q-main 3/output/playwright/reports-'+name.replaceAll(' ','-').toLowerCase()+'-'+size+'-'+theme+'.png',fullPage:false});
    }
   }
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('tab',{name:'Quality & runtime'}).click();
 const checked=await page.locator('.obs-solvers input:checked').count();
 for(let i=0;i<checked;i++)await page.locator('.obs-solvers input:checked').first().uncheck();
 results.push({emptyState:await page.locator('.science-empty').count()});
 for(const name of ['HiGHS LP','HiGHS MILP','Standard QAOA','LP warm-start'])await page.getByRole('checkbox',{name,exact:true}).check();
 await page.getByRole('combobox',{name:'Experiment family',exact:true}).selectOption('boundary');
 results.push({familyChanged:await page.locator('.obs-filter-count').innerText()});
 await page.getByRole('combobox',{name:'Experiment family',exact:true}).selectOption('primary');
 await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('critical_shortage');
 await page.locator('.obs-table-panel summary').click();
 results.push({tableRows:await page.locator('.obs-table-panel tbody tr').count(),sourceLink:await page.locator('.obs-table-panel tbody a').first().getAttribute('href')});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export selected evidence',exact:true}).click();
 const download=await downloadPromise;results.push({download:download.suggestedFilename()});
 await page.getByRole('tab',{name:'Quality & runtime'}).focus();await page.keyboard.press('ArrowRight');results.push({keyboardTab:await page.locator('.obs-tabs [aria-selected=true]').innerText()});
 return results;
}
