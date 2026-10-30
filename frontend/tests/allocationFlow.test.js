import test from 'node:test';
import assert from 'node:assert/strict';
import { allocationFlow, emergencyAllocationResult } from '../src/utils/allocationFlow.js';
const fixture = () => ({id:'s',synthetic:true,blood_banks:[{id:'b',name:'Bank',inventory:{O:5}}],hospitals:[{id:'h',name:'Hospital',demand:{A:4},urgency:{A:{category:'critical'}}}],routes:[{source:'b',destination:'h',status:'available'}],compatibility:[{donor_group:'O',recipient_group:'A',allowed:true}]});
const result = () => ({scenario_id:'s',feasibility:true,allocation:[{source:'b',destination:'h',blood_group:'O',recipient_group:'A',quantity:3}],unmet_demand:[{hospital_id:'h',blood_group:'A',units:1}]});
test('flow conserves stock, compatible allocation and remaining demand independently',()=>{
 const flow=allocationFlow(fixture(),result());
 assert.deepEqual([flow.stock,flow.allocated,flow.remaining,flow.unmet],[5,3,2,1]);
 assert.equal(flow.hospitals[0].criticalServed,3);
 for(const node of flow.nodes.filter(n=>n.stage===1||n.kind==='compatible'||n.kind==='allocation')) assert.equal(flow.links.filter(l=>l.target===node.id).reduce((s,l)=>s+l.value,0),flow.links.filter(l=>l.source===node.id).reduce((s,l)=>s+l.value,0));
});
test('invalid route, incompatible allocation, non-synthetic and inconsistent totals never render flows',()=>{
 const s=fixture();s.routes[0].status='blocked';assert.equal(allocationFlow(s,result()),null);
 const c=fixture();c.compatibility[0].allowed=false;assert.equal(allocationFlow(c,result()),null);
 assert.equal(allocationFlow({...fixture(),synthetic:false},result()),null);
 const r=result();r.unmet_demand[0].units=2;assert.equal(allocationFlow(fixture(),r),null);
});
test('zero-stock valid result retains unmet demand without creating ribbons',()=>{
 const s=fixture();s.blood_banks[0].inventory.O=0;
 const r=result();r.allocation=[];r.unmet_demand[0].units=4;
 const flow=allocationFlow(s,r);assert.equal(flow.links.length,0);assert.equal(flow.unmet,4);
});
test('emergency adapter checks derived unmet rows against recorded aggregate',()=>{
 const report={modified_scenario:fixture(),after_allocation:result().allocation,after_metrics:{feasibility:true,total_unmet_demand:1},method:'milp'};
 assert.equal(allocationFlow(report.modified_scenario,emergencyAllocationResult(report)).unmet,1);
 report.after_metrics.total_unmet_demand=0;assert.equal(emergencyAllocationResult(report),null);
});
