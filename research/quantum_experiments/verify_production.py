"""Direct unmodified production solver control on every held-out case/mixer."""
import json,time
from pathlib import Path
from dataclasses import asdict
import numpy as np
from qiskit.quantum_info import Statevector
from research.quantum_experiments.instances import holdout,WEIGHTS
from research.quantum_experiments.encodings import full_encoding
from research.quantum_experiments.metrics import probabilities
from research.quantum_experiments.algorithms import Ansatz,Config
from quantum.qaoa_solver import QAOASolver,QAOAConfig

OUT=Path('research/quantum_experiments/results/production_controls.jsonl')
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=OUT)
OUT=parser.parse_args().output
OUT.parent.mkdir(parents=True,exist_ok=True)
with OUT.open('x') as f:
 for s in holdout():
  e=full_encoding(s,WEIGHTS)
  for method in ['standard','warm','xy','warm_xy']:
   cfg=QAOAConfig(p=2,max_iterations=80,restarts=2,shots=1024,seed=101,warm_start=method in ('warm','warm_xy'),mixer='xy' if method in ('xy','warm_xy') else 'x',warm_start_epsilon=.1)
   t=time.perf_counter();res=QAOASolver(cfg).solve(e.qubo);elapsed=time.perf_counter()-t
   a=Ansatz(e,Config(method));angles=np.array(res.optimizer_information['final_parameters'])
   actual=Statevector.from_instruction(a.circuit(angles)).probabilities();fast=abs(a.state(angles))**2
   error=float(np.max(np.abs(actual-fast)));assert error<1e-8
   f.write(json.dumps({'scenario':s.id,'method':method,'seed':101,'config':asdict(cfg),'metrics':probabilities(e,actual),'counts':dict(res.counts),'optimizer':dict(res.optimizer_information),'runtime_seconds':elapsed,'statevector_engine_error':error,'production_requested_warm_start_used':res.warm_start_used,'production_requested_mixer_type':res.mixer_type})+'\n');f.flush()
  print(s.id,'production verified',flush=True)
