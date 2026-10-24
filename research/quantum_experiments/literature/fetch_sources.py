"""Fetch primary arXiv metadata and full text; no secondary summaries."""
import concurrent.futures, urllib.request, re, json, html, hashlib, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
IDS=['1411.4028','2009.10095','1907.04769','1709.03489','2203.06095','2006.00354','1903.05068','1812.01041','2109.11455','2005.10258','1910.08980','1812.04170','1907.02359','2307.05420','1401.2910','2105.11766','2107.04109','2001.06079','2103.09232']
def fetch(id):
 result={'arxiv_id':id,'accessed_utc':'2026-10-23','attempts':[]}
 for kind in ['abs','html']:
  url=f'https://arxiv.org/{kind}/{id}'
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'BloodFlowQResearch/1.0 (academic literature audit)'})
   data=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','40',url]).decode(); final=url
   (ROOT/'sources'/f'{id}_{kind}.html').write_text(data)
   result['attempts'].append({'url':url,'final_url':final,'bytes':len(data),'sha256':hashlib.sha256(data.encode()).hexdigest(),'success':True})
   if kind=='abs':
    result['metadata']={}
    for name,content in re.findall(r'<meta\s+name="([^"]+)"\s+content="([^"]*)"',data):
     if name.startswith('citation_'):result['metadata'].setdefault(name,[]).append(html.unescape(content))
   stripped=re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>','',data)
   stripped=re.sub(r'</(?:p|div|section|h[1-6]|tr|li)>','\n',stripped)
   stripped=re.sub(r'<[^>]+>',' ',stripped)
   stripped=html.unescape(stripped)
   stripped=re.sub(r'[ \t]+',' ',stripped);stripped=re.sub(r'\n\s*\n+','\n\n',stripped)
   (ROOT/'sources'/f'{id}_{kind}.txt').write_text(stripped)
  except Exception as e:result['attempts'].append({'url':url,'success':False,'error':str(e)})
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 records=list(pool.map(fetch,IDS))
(ROOT/'access_log.json').write_text(json.dumps(records,indent=2))
for r in records: print(r['arxiv_id'],[(a.get('success'),a.get('bytes',a.get('error'))) for a in r['attempts']],r.get('metadata',{}).get('citation_title'))
