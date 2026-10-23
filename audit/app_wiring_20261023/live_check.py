"""Bounded live HTTP audit of local synthetic workflows; no private writes."""
import json,re,time,urllib.request,urllib.error
from pathlib import Path
BASE='http://127.0.0.1:8000';OUT=Path(__file__).parent
records=[]
def call(path,body=None,status=200,origin=None):
    t=time.perf_counter();headers={'Content-Type':'application/json'}
    if origin:headers['Origin']=origin
    req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    try:r=urllib.request.urlopen(req,timeout=60)
    except urllib.error.HTTPError as e:r=e
    raw=r.read().decode();data=json.loads(raw);record={'path':path,'method':'GET' if body is None else 'POST','status':r.status,'expected_status':status,'seconds':time.perf_counter()-t,'request':body,'response':data};records.append(record)
    assert r.status==status,(path,r.status,raw[:300])
    if origin:assert r.headers.get('Access-Control-Allow-Origin')==origin
    return data

schema=call('/openapi.json');known={(verb.upper(),path) for path,v in schema['paths'].items() for verb in v}
api_source=Path('frontend/src/services/api.js').read_text()
for action,path in re.findall(r"\b(request|post)\('([^']+)'",api_source):assert ('POST' if action=='post' else 'GET',path) in known,path
for path in ['/health','/scenario','/results','/demo-scenarios','/experiment-defaults','/precomputed-demo','/coordination/capabilities','/coordination/dashboard']:
 call(path,origin='http://127.0.0.1:5173')
tiny={'id':'wiring_audit','blood_groups':['O'],'blood_banks':[{'id':'bank','name':'Bank','location_id':'B','inventory':{'O':2}}],'hospitals':[{'id':'hospital','name':'Hospital','location_id':'H','demand':{'O':1},'urgency':{'O':{'category':'high','priority_weight':2}}}],'routes':[{'source':'bank','destination':'hospital','travel_time_minutes':5,'distance_km':2,'transport_cost':1,'status':'available'}],'compatibility':[{'donor_group':'O','recipient_group':'O','allowed':True}],'synthetic':True}
penalties={'inventory_penalty_weight':100,'demand_penalty_weight':100};cfg={'p':1,'shots':64,'max_iterations':8,'restarts':1,'seed':17}
for method in ('greedy','milp','exact'):call('/optimize',{'scenario':tiny,'method':method})
for warm,mixer in [(False,'x'),(True,'x'),(False,'xy'),(True,'xy')]:
 r=call('/optimize',{'scenario':tiny,'method':'qaoa','qaoa_penalties':penalties,'qaoa_config':cfg|{'warm_start':warm,'mixer':mixer}})
 assert r['method']=='qaoa' and r['shots']==64 and sum(r['counts'].values())==64
 assert r['experiment_configuration']['qaoa']['warm_start']==warm
 assert r['experiment_configuration']['qaoa']['mixer']==mixer
call('/benchmark',{'scenarios':[tiny],'include_qaoa':True,'include_milp':True,'qaoa_penalties':penalties,'qaoa_config':cfg})
for event in [{'kind':'demand_spike','hospital_id':'hospital','blood_group':'O','new_demand':3},{'kind':'inventory_reduction','bank_id':'bank','blood_group':'O','units_to_remove':2},{'kind':'route_disruption','source':'bank','destination':'hospital'},{'kind':'hospital_priority_change','hospital_id':'hospital','blood_group':'O','urgency':{'category':'critical','priority_weight':3}}]:
 call('/simulate-emergency',{'scenario':tiny,'method':'greedy','event':event})
for scenario in ('normal','emergency_demand_spike','transport_disruption'):
 call('/demo-run',{'scenario_id':scenario,'method':'greedy'})
call('/demo-run',{'scenario_id':'normal','method':'qaoa','qaoa_penalties':{'inventory_penalty_weight':10000,'demand_penalty_weight':10000},'qaoa_config':cfg|{'warm_start':True}})
state=call('/coordination/demo/start',{})
for action in ('accept_donor','arrange_appointment','confirm_collection','begin_testing','confirm_testing_and_release','assign_transport','confirm_dispatch','confirm_receipt','complete'):
 state=call('/coordination/demo/action',{'actions':state['action_log'],'action':action,'donor_id':'DEMO-DONOR-01' if action=='accept_donor' else None})
assert state['next_actions']==[]
call('/coordination/demo/action',{'actions':[],'action':'complete'},422)
call('/optimize',{'method':'unknown'},422)
call('/optimize',{'method':'qaoa','qaoa_penalties':{'inventory_penalty_weight':100000,'demand_penalty_weight':100000}},422)
for prompt in ('inventory','blocked routes','run allocation','quantum','compare solvers'):
 reply=call('/chat',{'message':prompt})
 if prompt=='run allocation':assert 'No optimization has started yet' in reply['reply']
results=call('/results');assert results
(OUT/'live_http_results.json').write_text(json.dumps(records,indent=2)+'\n')
print('Live HTTP checks passed:',len(records))
