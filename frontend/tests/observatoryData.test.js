import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNumber, quantile, statistics, bootstrapCI, pairedRows, paretoFront, density, validCounts } from '../src/utils/observatoryData.js';

const evidence = JSON.parse(readFileSync(new URL('../public/observatory-evidence.json', import.meta.url), 'utf8'));
const observation = (solver, seed, value, overrides = {}) => ({ family:'primary', scenario:'normal', solver, seed, status:'completed', feasible:true, runtime_seconds:value, relative_gap:value, ...overrides });

test('missing scientific observations remain missing while a genuine zero is retained', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, '0', false]) assert.equal(isNumber(value), false);
  assert.equal(isNumber(0), true);
  assert.equal(quantile([null, undefined], .5), null);
  assert.deepEqual(statistics([null, NaN]), {n:0, mean:null, median:null, q1:null, q3:null, min:null, max:null, ci:null});
  const result=statistics([null,0,2,4,NaN]);
  assert.equal(result.n,3); assert.equal(result.mean,2); assert.equal(result.median,2);
  assert.equal(result.q1,1); assert.equal(result.q3,3);
});

test('quantiles interpolate recorded values without mutating their source order', () => {
  const values=[9,1,5,3];
  assert.equal(quantile(values,.25),2.5);
  assert.equal(quantile(values,.75),6);
  assert.deepEqual(values,[9,1,5,3]);
});

test('bootstrap intervals require three finite observations and are reproducible', () => {
  assert.equal(bootstrapCI([]),null);
  assert.equal(bootstrapCI([1,2]),null);
  assert.equal(bootstrapCI([1,null,3]),null);
  const a=bootstrapCI([1,2,4,8,16]);
  assert.deepEqual(a,bootstrapCI([1,2,4,8,16]));
  assert.ok(a[0]>=1 && a[1]<=16 && a[0]<=a[1]);
  assert.deepEqual(bootstrapCI([0,0,0]),[0,0]);
});

test('pairing requires matching family, scenario and seed and preserves difference direction', () => {
  const rows=[observation('a',1,1),observation('b',1,4),observation('a',2,2),
    observation('b',2,6,{scenario:'other'}),observation('b',2,7,{family:'holdout'}),
    observation('a',null,2),observation('b',null,2)];
  assert.deepEqual(pairedRows(rows,'a','b','runtime_seconds'),[
    {key:'primary|normal|1',scenario:'normal',seed:1,left:1,right:4,difference:3}
  ]);
});

test('duplicate, missing and incomplete pairs cannot silently enter uncertainty estimates', () => {
  const rows=[observation('a',1,0),observation('a',1,2),observation('b',1,1),
    observation('a',2,null),observation('b',2,1),
    observation('a',3,0),observation('b',3,1,{status:'skipped'}),
    observation('a',4,0),observation('b',4,0)];
  const pairs=pairedRows(rows,'a','b','runtime_seconds');
  assert.equal(pairs.length,1);assert.equal(pairs[0].seed,4);assert.equal(pairs[0].difference,0);
});

test('objective comparisons exclude infeasible solutions but runtime pairing can retain them', () => {
  const rows=[observation('a',1,1,{feasible:false}),observation('b',1,0)];
  assert.deepEqual(pairedRows(rows,'a','b','relative_gap'),[]);
  assert.equal(pairedRows(rows,'a','b','runtime_seconds').length,1);
});

test('Pareto frontier retains ties and tradeoffs, excludes dominated or invalid points', () => {
  const rows=[observation('a',1,1,{id:'fast',relative_gap:2}),
    observation('a',2,2,{id:'quality',relative_gap:0}),
    observation('a',3,3,{id:'dominated',relative_gap:1}),
    observation('a',4,2,{id:'tie',relative_gap:0}),
    observation('a',5,0,{id:'zero-time',relative_gap:0}),
    observation('a',6,.1,{id:'infeasible',relative_gap:0,feasible:false}),
    observation('a',7,.1,{id:'missing',relative_gap:null})];
  assert.deepEqual(paretoFront(rows).map(r=>r.id),['fast','quality','tie']);
});

test('uncompleted points cannot dominate a completed Pareto observation', () => {
  const rows=[observation('a',1,2,{id:'completed',relative_gap:1}),
    observation('b',1,.01,{id:'skipped',relative_gap:0,status:'skipped'})];
  assert.deepEqual(paretoFront(rows).map(r=>r.id),['completed']);
});

test('violin density is unavailable for undersized or constant data', () => {
  assert.deepEqual(density([1,2]),[]);assert.deepEqual(density([0,0,0]),[]);
  const a=density([0,1,2,4]);
  assert.equal(a.length,40);assert.equal(a[0][0],0);assert.equal(a.at(-1)[0],4);
  assert.ok(a.every(([value,d])=>Number.isFinite(value)&&Number.isFinite(d)&&d>=0));
});

test('bitstring distributions require correct width and exact shot conservation', () => {
  const row={qubits:2,shots:4,counts:{'00':1,'11':3}};
  assert.deepEqual(validCounts(row),[['11',3],['00',1]]);
  for (const invalid of [{...row,shots:5},{...row,qubits:3},{...row,counts:{'0x':4}},
    {...row,counts:{'00':-1,'11':5}},{...row,counts:{'00':1.5,'11':2.5}}]) assert.deepEqual(validCounts(invalid),[]);
  assert.deepEqual(validCounts(null),[]);
});

test('published warm headline derives from paired raw counts and documented conditions', () => {
  const warm=evidence.warm_start;
  const standard=warm.observations.filter(r=>r.solver==='standard');
  const seeded=warm.observations.filter(r=>r.solver==='warm');
  assert.deepEqual(standard.map(r=>r.seed),[7,11,19]);
  assert.deepEqual(seeded.map(r=>r.seed),[7,11,19]);
  const a=statistics(standard.map(r=>r.optimal_shot_rate)).mean;
  const b=statistics(seeded.map(r=>r.optimal_shot_rate)).mean;
  assert.equal(warm.standard_mean,a);assert.equal(warm.warm_mean,b);
  assert.equal(warm.difference_pp,(b-a)*100);assert.equal(warm.ratio,b/a);
  for(const row of warm.observations){
    assert.equal(row.shots,512);assert.equal(row.config.p,2);assert.equal(row.config.restarts,3);
    assert.equal(row.config.max_iterations,80);assert.equal(row.objective,25.2);
  }
  assert.equal(warm.conditions.backend,'qiskit_aer.AerSimulator');
});

test('published execution examples conserve shots and primary seed comparison uses actual observations', () => {
  for (const row of evidence.execution_examples) assert.ok(validCounts(row).length>0, row.solver);
  const rows=evidence.observations.filter(r=>r.family==='primary'&&r.scenario==='normal_reference');
  const pairs=pairedRows(rows,'standard','warm','runtime_seconds');
  assert.equal(pairs.length,5);assert.equal(new Set(pairs.map(r=>r.seed)).size,5);
  const gaps=pairedRows(rows,'lp','milp','relative_gap');
  assert.equal(gaps.length,5);assert.ok(gaps.every(r=>r.difference===0));
});
