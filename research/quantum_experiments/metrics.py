"""Explicit denominators and independent-shot probability calculations."""
import math
import numpy as np

def success_probability(p,n):
    if not 0<=p<=1 or n<0:raise ValueError('invalid probability or sample count')
    if n==0 or p==0:return 0.
    if p==1:return 1.
    return float(-math.expm1(n*math.log1p(-p)))

def shots99(p):
    if p<=0:return None
    if p>=1:return 1
    return math.ceil(math.log(.01)/math.log1p(-p))

def wilson(k,n):
    if n==0:return None
    z=1.959963984540054;p=k/n;d=1+z*z/n
    mid=(p+z*z/(2*n))/d;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [max(0,mid-half),min(1,mid+half)]

def probabilities(enc,prob):
    prob=np.asarray(prob,float);prob=prob/prob.sum()
    f=float(prob[enc.feasible].sum());o=float(prob[enc.optimal].sum());o=min(1,max(0,o));f=min(1,max(0,f))
    ef=float(prob[enc.feasible]@enc.objective[enc.feasible]/f) if f>1e-15 else None
    return {'p_optimal_feasible':o,'p_feasible':f,'p_optimal_given_feasible':o/f if f>1e-15 else None,'expected_penalized_energy':float(prob@enc.energy),'conditional_feasible_objective':ef,'conditional_feasible_absolute_gap':ef-enc.optimum if ef is not None else None,'optimality_reference':enc.optimum,'probability_success_1024_iid':success_probability(o,1024),'shots_for_99_percent_success_iid':shots99(o)}

def sample_metrics(enc,prob,shots,seed):
    counts=np.random.default_rng(seed).multinomial(shots,prob/prob.sum())
    nz=np.flatnonzero(counts);valid=nz[enc.feasible[nz]]
    best=min(valid,key=lambda k:enc.objective[k]) if len(valid) else None
    nf=int(counts[enc.feasible].sum());no=int(counts[enc.optimal].sum())
    histogram={}
    for k in valid:
        val=str(float(enc.objective[k]));histogram[val]=histogram.get(val,0)+int(counts[k])
    return {'sampling_backend':'numpy_multinomial_from_exact_ideal_statevector','shots':shots,'counts':{format(int(k),f'0{enc.n}b'):int(counts[k]) for k in nz},'infeasible_measurements':shots-nf,'optimal_measurements':no,'feasible_measurements':nf,'p_optimal_feasible':no/shots,'p_feasible':nf/shots,'p_optimal_given_feasible':no/nf if nf else None,'optimal_wilson95':wilson(no,shots),'feasible_wilson95':wilson(nf,shots),'conditional_optimal_wilson95':wilson(no,nf),'best_feasible_objective':float(enc.objective[best]) if best is not None else None,'best_feasible_absolute_gap':float(enc.objective[best]-enc.optimum) if best is not None else None,'best_feasible_index':int(best) if best is not None else None,'best_feasible_allocation':list(enc.allocations[best]) if best is not None else None,'feasible_objective_histogram':histogram}

def readout_bitflip(prob,n,error):
    p=np.array(prob,float)
    for q in range(n):
        ids=np.arange(len(p));p=(1-error)*p+error*p[ids^(1<<q)]
    return p
