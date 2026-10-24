"""Archive primary PDFs and extract full text using an isolated optional pypdf."""
import sys,subprocess,concurrent.futures,json,hashlib
from pathlib import Path
sys.path.insert(0,'/tmp/bloodflow-paper-parser')
from pypdf import PdfReader
IDS=['1411.4028','2009.10095','1907.04769','1709.03489','2203.06095','2006.00354','1903.05068','1812.01041','2109.11455','2005.10258','1910.08980','1812.04170','1907.02359','2307.05420','1401.2910','2105.11766','2107.04109','2001.06079','2103.09232']
ROOT=Path(__file__).resolve().parent

def one(id):
 p=ROOT/'sources'/f'{id}.pdf'; url=f'https://arxiv.org/pdf/{id}'
 try:
  subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','60',url,'--output',str(p)],check=True)
  reader=PdfReader(p);text='\n\n'.join(f'=== PDF PAGE {i+1} ===\n'+(page.extract_text() or '') for i,page in enumerate(reader.pages))
  (ROOT/'sources'/f'{id}_pdf.txt').write_text(text)
  return {'id':id,'url':url,'success':True,'pages':len(reader.pages),'characters':len(text),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 except Exception as e:return {'id':id,'url':url,'success':False,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:r=list(pool.map(one,IDS))
(ROOT/'pdf_access_log.json').write_text(json.dumps(r,indent=2))
for x in r: print(x)
