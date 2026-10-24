"""Identical neighborhood schedules; explicit table cost and classical replacement."""
import time
import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import DiagonalGate

def selected_variables(task,rng,bit_cap=10):
    selected=[];bits=0
    for j in rng.permutation(len(task.keys)):
        width=int(task.upper[j]).bit_length()
        if width and bits+width<=bit_cap:selected.append(int(j));bits+=width
    return selected

def decode(task,incumbent,selected,index):
    x=incumbent.copy()
    for j in selected:
        width=int(task.upper[j]).bit_length();x[j]=index&((1<<width)-1);index>>=width
    return x

def table(task,incumbent,selected):
    n=sum(int(task.upper[j]).bit_length() for j in selected)
    values=np.array([task.score(decode(task,incumbent,selected,i)) for i in range(1<<n)])
    return values,n

def amplify(marked,iterations):
    state=np.ones(len(marked),complex)/np.sqrt(len(marked))
    for _ in range(iterations):
        state[marked]*=-1;state=2*state.mean()-state
    return abs(state)**2

def circuit(marked,iterations):
    n=(len(marked)-1).bit_length();qc=QuantumCircuit(n);qc.h(range(n))
    for _ in range(iterations):
        qc.append(DiagonalGate(np.where(marked,-1,1).astype(complex)),range(n))
        qc.h(range(n));qc.x(range(n))
        if n==1:qc.p(np.pi,0)
        else:qc.mcp(np.pi,list(range(n-1)),n-1)
        qc.x(range(n));qc.h(range(n))
    return qc

def improve(task,incumbent,selected,method,seed,seconds=.1,query_cap=64):
    start=time.perf_counter();rng=np.random.default_rng(seed);best=incumbent.copy();value=task.score(best)
    record={'selected':selected,'initial_objective':value,'wall_budget_seconds':seconds,'query_cap':query_cap,'table_evaluations':0,'oracle_calls':0,'measurement_shots':0,'candidate_evaluations':0,'attempts':[]}
    n=sum(int(task.upper[j]).bit_length() for j in selected);record['qubits']=n
    if method=='milp':
        candidate,info=task.solve(seconds,incumbent,selected);record['solver']=info
        if candidate is not None and task.score(candidate)<value:best=candidate;value=task.score(best)
    elif method in ('quantum','table_lookup'):
        t=time.perf_counter();values,n=table(task,incumbent,selected);record['table_seconds']=time.perf_counter()-t;record['table_evaluations']=len(values)
        # Both methods receive exactly the same expensive table. Do not conceal it.
        if time.perf_counter()-start<seconds:
            if method=='table_lookup':
                index=int(np.argmin(values))
                if values[index]<value:best=decode(task,incumbent,selected,index);value=float(values[index])
            else:
                m=1.;used=0
                while used<query_cap and time.perf_counter()-start<seconds:
                    r=min(int(rng.integers(max(1,int(np.ceil(m))))),query_cap-used-1)
                    marked=np.isfinite(values)&(values<value-1e-8)
                    p=amplify(marked,r);index=int(rng.choice(len(values),p=p/p.sum()));used+=r+1
                    old=value
                    if values[index]<value:best=decode(task,incumbent,selected,index);value=float(values[index]);m=1.
                    else:m=min(8.,1.2*m)
                    record['attempts'].append({'iterations':r,'index':index,'incumbent_before':old,'improved':value<old})
                    record['oracle_calls']+=r;record['measurement_shots']+=1;record['candidate_evaluations']+=1
        else:record['search_skipped']='table_consumed_wall_budget'
    elif method=='uniform':
        for _ in range(query_cap):
            if time.perf_counter()-start>=seconds:break
            index=int(rng.integers(1<<n));x=decode(task,incumbent,selected,index);score=task.score(x);record['candidate_evaluations']+=1
            if score<value:best=x;value=score
    else:raise ValueError(method)
    record.update(final_objective=value,seconds=time.perf_counter()-start,final_quantities=best.tolist())
    record['budget_overrun_seconds']=max(0,record['seconds']-seconds)
    task.validate(best)
    return best,record
