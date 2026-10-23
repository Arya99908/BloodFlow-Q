import pathlib,subprocess,json,re,html,sys,hashlib
sys.path.insert(0,'/tmp/bloodflow-paper-parser')
from pypdf import PdfReader
P=pathlib.Path(__file__).resolve().parent
logs=json.loads((P/'access_log.json').read_text());pdfs=json.loads((P/'pdf_access_log.json').read_text())
for id in ['1912.04088','quant-ph/9607014','2602.08418']:
 safe=id.replace('/','_'); entry={'arxiv_id':id,'accessed_utc':'2026-10-23','attempts':[],'metadata':{}}
 for kind in ['abs','pdf']:
  url=f'https://arxiv.org/{kind}/{id}'
  try:
   b=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','45',url]);dest=P/'sources'/(safe+('_abs.html' if kind=='abs' else '.pdf'));dest.write_bytes(b)
   entry['attempts'].append({'url':url,'success':True,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
   if kind=='abs':
    s=b.decode()
    for k,v in re.findall(r'<meta\s+name="([^"]+)"\s+content="([^"]*)"',s):
     if k.startswith('citation_'):entry['metadata'].setdefault(k,[]).append(html.unescape(v))
    (P/'sources'/(safe+'_abs.txt')).write_text(html.unescape(re.sub('<[^>]+>',' ',s)))
   else:
    reader=PdfReader(dest);txt='\n'.join(f'=== PDF PAGE {i+1} ===\n{p.extract_text()}' for i,p in enumerate(reader.pages));(P/'sources'/(safe+'_pdf.txt')).write_text(txt)
    pdfs.append({'arxiv_id':id,'url':url,'success':True,'pages':len(reader.pages),'sha256':hashlib.sha256(b).hexdigest()})
  except Exception as e:entry['attempts'].append({'url':url,'success':False,'error':str(e)})
 logs=[x for x in logs if x['arxiv_id']!=id]+[entry]
 print(id,entry['metadata'].get('citation_author'),entry['attempts'])
(P/'access_log.json').write_text(json.dumps(logs,indent=2));(P/'pdf_access_log.json').write_text(json.dumps(pdfs,indent=2))
