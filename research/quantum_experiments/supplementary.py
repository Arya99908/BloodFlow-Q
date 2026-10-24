"""Bounded scaling, nonvariational search and independent circuit sampling checks."""
import json,time,math
from pathlib import Path
import numpy as np
from qiskit import transpile
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel,depolarizing_error
from research.quantum_experiments.instances import generated,holdout,scenarios,WEIGHTS,serialize
from research.quantum_experiments.encodings import reduced_encoding,full_encoding,validate_encoding
from research.quantum_experiments.algorithms import Ansatz,Config,optimize,resources
from research.quantum_experiments.metrics import probabilities,sample_metrics
from research.quantum_experiments.grover_search import threshold_state,threshold_circuit
from optimization.milp import MILPSolver
from optimization.greedy import GreedyAllocator
from quantum.qubo import count_scenario_qubo_variables

OUT=Path('research/quantum_experiments/results/supplementary')

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    with (OUT/'grover.jsonl').open('x') as f:
        for s in holdout():
            e=reduced_encoding(s,WEIGHTS);t=time.perf_counter();greedy=GreedyAllocator().solve(s,WEIGHTS);prep=time.perf_counter()-t
            incumbent=greedy.objective_breakdown.total_objective
            for iterations in (1,2,3):
                t=time.perf_counter();v,marked=threshold_state(e,incumbent,iterations);runtime=time.perf_counter()-t
                qc=threshold_circuit(e,incumbent,iterations);error=float(np.max(np.abs(Statevector.from_instruction(qc).probabilities()-abs(v)**2)));assert error<1e-8
                for seed in range(101,111):
                    sample=sample_metrics(e,abs(v)**2,1024,seed+3000000)
                    row={'scenario':s.id,'iterations':iterations,'seed':seed,'incumbent_greedy':incumbent,'oracle_threshold_source':'greedy_only_not_exact_optimum','marked_count_for_analysis_only':int(marked.sum()),'initial_improvement_probability':float(marked.mean()),'final_improvement_probability':float((abs(v[marked])**2).sum()),'oracle_calls_per_shot':iterations,'oracle_calls_for_1024_shots':iterations*1024,'metrics':probabilities(e,abs(v)**2),'sample':sample,'timing':{'table_oracle_construction_seconds':e.prep_seconds,'greedy_seconds':prep,'state_simulation_seconds':runtime},'qiskit_max_probability_error':error,'classical_table_already_reveals_optimum':e.optimum}
                    f.write(json.dumps(row)+'\n')
    with (OUT/'scaling.jsonl').open('x') as f:
        for nb,nh,groups in [(1,1,('O',)),(2,2,('O',)),(3,3,('O',)),(4,4,('O',)),(2,2,('O','A')),(4,4,('O','A'))]:
            s=generated(nb,nh,groups,20261101+nb+len(groups),f'scale_{nb}_{nh}_{len(groups)}',1)
            t=time.perf_counter();milp=MILPSolver().solve(s,WEIGHTS);milp_time=time.perf_counter()-t
            t=time.perf_counter();lp=MILPSolver().solve_relaxation(s,WEIGHTS);lp_time=time.perf_counter()-t
            full_n=count_scenario_qubo_variables(s);reduced_n=sum(v.upper_bound.bit_length() for v in s.allocation_variables())
            base={'scenario':serialize(s),'full_qubits':full_n,'reduced_qubits':reduced_n,'full_statevector_bytes_complex128':16*(1<<full_n),'reduced_statevector_bytes_complex128':16*(1<<reduced_n),'milp_objective':milp.objective_value,'milp_seconds':milp_time,'lp_seconds':lp_time,'lp_integral':all(abs(v-round(v))<1e-7 for vals in lp.values() for v in vals.values())}
            if reduced_n>12:
                f.write(json.dumps(base|{'status':'skipped_quantum','reason':'reduced_qubits_exceed_12_cap'})+'\n');continue
            e=reduced_encoding(s,WEIGHTS);validate_encoding(e,milp.objective_value)
            for method in ['reduced','reduced_cvar','feasible_grover']:
                resource=resources(Ansatz(e,Config(method)))
                for seed in (201,202,203):
                    a=Ansatz(e,Config(method,seed=seed,alpha=.2 if method=='reduced_cvar' else 1));t=time.perf_counter();angles,opt=optimize(a);elapsed=time.perf_counter()-t;p=abs(a.state(angles))**2
                    row=base|{'status':'completed','method':method,'seed':seed,'config':a.cfg.__dict__,'parameters':angles.tolist(),'optimizer':opt,'metrics':probabilities(e,p),'sample':sample_metrics(e,p,1024,seed),'resources':resource,'preprocessing_seconds':e.prep_seconds,'optimization_seconds':elapsed}
                    f.write(json.dumps(row)+'\n');f.flush()
            print(s.id,'scaling complete',flush=True)
    # Selected circuit-level Aer checks, including gate noise. No provider hardware.
    case=scenarios()[1];e=reduced_encoding(case,WEIGHTS)
    with (OUT/'aer_noise.jsonl').open('x') as f:
        for method in ['reduced','reduced_cvar','feasible_grover']:
            a=Ansatz(e,Config(method,seed=101,alpha=.2 if 'cvar' in method else 1));angles,opt=optimize(a);circuit=a.circuit(angles);circuit.measure_all()
            basis=['rz','sx','x','cx'];compiled=transpile(circuit,basis_gates=basis,optimization_level=1,seed_transpiler=17)
            ideal=probabilities(e,abs(a.state(angles))**2)
            for error in (0,.001,.01):
                noise=None
                if error:
                    noise=NoiseModel();noise.add_all_qubit_quantum_error(depolarizing_error(error,2),['cx']);noise.add_all_qubit_quantum_error(depolarizing_error(error/10,1),['sx','x'])
                for seed in (101,102,103):
                    t=time.perf_counter();counts=AerSimulator(noise_model=noise).run(compiled,shots=2048,seed_simulator=seed).result().get_counts();runtime=time.perf_counter()-t
                    p=np.zeros(len(e.energy))
                    for k,c in counts.items():p[int(k,2)]=c/2048
                    f.write(json.dumps({'scenario':case.id,'method':method,'seed':seed,'noise':'gate_depolarizing','two_qubit_error':error,'sx_x_error':error/10,'shots':2048,'counts':dict(counts),'metrics_from_counts':probabilities(e,p),'ideal_metrics':ideal,'cx_count':int(compiled.count_ops().get('cx',0)),'depth':compiled.depth(),'runtime_seconds':runtime,'note':'toy homogeneous noise; no hardware calibration; no routing'})+'\n');f.flush()
    (OUT/'complete.json').write_text(json.dumps({'status':'completed'}))

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=OUT)
    OUT=parser.parse_args().output
    main()
