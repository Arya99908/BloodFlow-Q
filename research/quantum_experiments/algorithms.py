"""Exact ideal evolution and equivalent Qiskit circuits; independent of production APIs."""
import time
from dataclasses import dataclass,asdict
import numpy as np
from scipy.optimize import minimize
from qiskit import QuantumCircuit,transpile
from qiskit.circuit.library import DiagonalGate,StatePreparation
from qiskit.quantum_info import Statevector
from quantum.qaoa_solver import QAOASolver,QAOAConfig,encode_register_probabilities
from optimization.milp import MILPSolver
from optimization.greedy import GreedyAllocator


def cvar(energy,probabilities,alpha):
    if not 0<alpha<=1:raise ValueError('alpha must be in (0,1]')
    order=np.argsort(energy,kind='stable');p=probabilities[order]
    included=np.minimum(p,np.maximum(0,alpha-(np.cumsum(p)-p)))
    return float(included@energy[order]/alpha)


def single(state,matrix,q):
    return np.einsum('ab,ibj->iaj',matrix,state.reshape(-1,2,1<<q)).reshape(-1)


def ry(a):return np.array([[np.cos(a/2),-np.sin(a/2)],[np.sin(a/2),np.cos(a/2)]],complex)


def warm_seed(enc,epsilon=.1):
    """Truthful provenance. Independent implementation checked against production."""
    q=enc.qubo;events=[];source='uniform_fallback';maps=None
    try:
        maps=MILPSolver().solve_relaxation(enc.scenario,enc.weights);source='lp'
    except Exception as e:
        events.append({'stage':'lp','error_type':type(e).__name__})
        try:
            g=GreedyAllocator().solve(enc.scenario,enc.weights)
            allocation={(d.source,d.destination,d.blood_group,d.recipient_group):d.quantity for d in g.allocation}
            slack={(b.id,grp):stock-sum(qty for key,qty in allocation.items() if key[0]==b.id and key[2]==grp) for b in enc.scenario.blood_banks for grp,stock in b.inventory.items() if stock>0}
            maps={'allocation':allocation,'unmet_demand':dict(g.unmet_demand),'slack':slack};source='greedy'
        except Exception as e:events.append({'stage':'greedy','error_type':type(e).__name__})
    bits=np.full(enc.n,.5)
    if maps is not None:
        for (kind,key),pairs in q._integer_bit_indices.items():
            name={'allocation':'allocation','unmet':'unmet_demand','slack':'slack'}[kind]
            for i,v in encode_register_probabilities(float(maps[name].get(key,0)),pairs).items():bits[i]=v
    theta=2*np.arcsin(np.sqrt(np.clip(epsilon+(1-2*epsilon)*bits,1e-4,1-1e-4)))
    return theta,{'requested_warm_start':True,'actual_warm_start':source!='uniform_fallback','seed_source':source,'fallback_events':events}

@dataclass(frozen=True)
class Config:
    method:str
    p:int=2
    max_evaluations:int=80
    restarts:int=2
    shots:int=1024
    seed:int=101
    epsilon:float=.1
    alpha:float=1.
    training_shots:int=0

class Ansatz:
    def __init__(self,enc,cfg):
        t=time.perf_counter();self.enc=enc;self.cfg=cfg;self.theta=None;self.pairs=();self.exchanges=[]
        method=cfg.method;self.grover=method=='feasible_grover'
        self.provenance={'requested_warm_start':False,'actual_warm_start':False,'seed_source':'uniform'}
        if 'warm' in method:self.theta,self.provenance=warm_seed(enc,cfg.epsilon)
        if method in ('xy','warm_xy'):
            self.pairs=QAOASolver(QAOAConfig(mixer='xy'))._compute_xy_pairs(enc.qubo)
            ids=np.arange(1<<enc.n)
            for i,j in self.pairs:
                a=ids[((ids>>i)&1)==0];a=a[((a>>j)&1)==1];b=a^((1<<i)|(1<<j));self.exchanges.append((a,b))
        self.effective_mixer='feasible_rank_one' if self.grover else ('xy' if method in ('xy','warm_xy') else ('warm' if self.theta is not None and method!='warm_xy' else 'x'))
        if method in ('xy','warm_xy') and not self.pairs:self.provenance['mixer_fallback']='empty_graph_identity_like_production'
        self.provenance['effective_mixer']=self.effective_mixer
        self.initial=np.zeros(1<<enc.n,complex);self.initial[0]=1
        if self.grover:
            self.initial=np.sqrt(enc.feasible/enc.feasible.sum()).astype(complex);self.provenance['seed_source']='enumerated_uniform_feasible'
        elif self.theta is not None:
            for q,a in enumerate(self.theta):self.initial=single(self.initial,ry(a),q)
        else:self.initial[:]=1/np.sqrt(len(self.initial))
        self.preparation_seconds=time.perf_counter()-t

    def state(self,angles):
        e=self.enc;v=self.initial.copy();p=self.cfg.p
        for layer in range(p):
            gamma,beta=angles[layer],angles[p+layer]
            v*=np.exp(-1j*gamma*e.energy/e.scale)
            if self.grover:v+=(np.exp(-1j*beta)-1)*self.initial*np.vdot(self.initial,v)
            elif self.effective_mixer=='xy':
                c,s=np.cos(beta),-1j*np.sin(beta)
                for a,b in self.exchanges:
                    va,vb=v[a].copy(),v[b].copy();v[a]=c*va+s*vb;v[b]=s*va+c*vb
            elif self.effective_mixer=='warm':
                z=np.diag([np.exp(-1j*beta),np.exp(1j*beta)])
                for q,theta in enumerate(self.theta):v=single(v,ry(theta)@z@ry(-theta),q)
            else:
                x=np.array([[np.cos(beta),-1j*np.sin(beta)],[-1j*np.sin(beta),np.cos(beta)]])
                for q in range(e.n):v=single(v,x,q)
        return v

    def circuit(self,angles):
        e=self.enc;cfg=self.cfg
        if e.kind=='full_qubo':
            mixer='xy' if cfg.method in ('xy','warm_xy') else 'x'
            return QAOASolver(QAOAConfig(p=cfg.p,warm_start=self.theta is not None,mixer=mixer)).build_circuit(e.ising,np.array(angles),thetas=self.theta,xy_pairs=self.pairs)
        qc=QuantumCircuit(e.n)
        prep=StatePreparation(self.initial) if self.grover else None
        if prep:qc.append(prep,range(e.n))
        else:qc.h(range(e.n))
        for layer in range(cfg.p):
            gamma,beta=angles[layer],angles[cfg.p+layer]
            qc.append(DiagonalGate(np.exp(-1j*gamma*e.energy/e.scale)),range(e.n))
            if self.grover:
                qc.append(prep.inverse(),range(e.n));qc.x(range(e.n))
                if e.n==1:qc.p(-beta,0)
                else:qc.mcp(-beta,list(range(e.n-1)),e.n-1)
                qc.x(range(e.n));qc.append(prep,range(e.n))
            else:qc.rx(2*beta,range(e.n))
        return qc


def optimize(ansatz,initial_override=None):
    cfg=ansatz.cfg; rng=np.random.default_rng(cfg.seed);shot_rng=np.random.default_rng(cfg.seed+1000000)
    evaluations=0;simulation_seconds=0.;training_sampling_seconds=0.;history=[];runs=[];t=time.perf_counter()
    def loss(x):
        nonlocal evaluations,simulation_seconds,training_sampling_seconds
        t0=time.perf_counter();prob=abs(ansatz.state(x))**2;simulation_seconds+=time.perf_counter()-t0;evaluations+=1
        if cfg.training_shots:
            t0=time.perf_counter();prob=shot_rng.multinomial(cfg.training_shots,prob/prob.sum())/cfg.training_shots;training_sampling_seconds+=time.perf_counter()-t0
        value=cvar(ansatz.enc.energy/ansatz.enc.scale,prob,cfg.alpha);history.append(float(value));return value
    for j in range(cfg.restarts):
        x=np.r_[rng.uniform(0,2*np.pi,cfg.p),rng.uniform(0,np.pi,cfg.p)]
        if j==0 and initial_override is not None:x=np.array(initial_override)
        r=minimize(loss,x,method='COBYLA',options={'maxiter':cfg.max_evaluations})
        runs.append({'parameters':r.x.tolist(),'loss':float(r.fun),'success':bool(r.success),'message':str(r.message),'nfev':int(r.nfev),'iterations':getattr(r,'nit',None),'initial':x.tolist()})
    selected=min(range(len(runs)),key=lambda i:runs[i]['loss'])
    return np.array(runs[selected]['parameters']),{'evaluations':evaluations,'iterations':None,'optimization_seconds':time.perf_counter()-t,'simulation_seconds':simulation_seconds,'training_sampling_seconds':training_sampling_seconds,'training_shots':evaluations*cfg.training_shots,'selected_restart':selected,'restarts':runs,'loss_history':history,'objective':'mean' if cfg.alpha==1 else 'lower_tail_cvar','alpha':cfg.alpha}


def resources(ansatz):
    angles=np.linspace(.13,.79,2*ansatz.cfg.p);t=time.perf_counter();qc=ansatz.circuit(angles)
    logical={'qubits':qc.num_qubits,'logical_depth':qc.depth(),'logical_operations':dict(qc.count_ops()),'basis':['rz','sx','x','cx'],'connectivity':'all_to_all_unrouted','status':'not_compiled_qubit_cap'}
    if ansatz.enc.kind=='full_qubo' or ansatz.enc.n<=8:
        compiled=transpile(qc,basis_gates=logical['basis'],optimization_level=1,seed_transpiler=17)
        logical.update({'status':'compiled','basis_depth':compiled.depth(),'cx_count':int(compiled.count_ops().get('cx',0)),'basis_operations':dict(compiled.count_ops()),'two_qubit_gate_count':sum(op.operation.num_qubits==2 for op in compiled.data)})
    logical['synthesis_seconds']=time.perf_counter()-t
    return logical
