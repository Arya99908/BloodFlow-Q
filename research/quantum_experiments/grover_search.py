"""Bounded nonvariational threshold amplification; dense oracle cost is explicit."""
import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import DiagonalGate


def threshold_state(enc,incumbent,iterations):
    if iterations<0:raise ValueError('iterations must be nonnegative')
    marked=enc.feasible & (enc.objective<incumbent-1e-7)
    state=np.ones(len(enc.energy),complex)/np.sqrt(len(enc.energy))
    for _ in range(iterations):
        state[marked]*=-1
        state=2*state.mean()-state
    return state,marked


def threshold_circuit(enc,incumbent,iterations):
    marked=enc.feasible & (enc.objective<incumbent-1e-7)
    qc=QuantumCircuit(enc.n);qc.h(range(enc.n))
    for _ in range(iterations):
        qc.append(DiagonalGate(np.where(marked,-1,1).astype(complex)),range(enc.n))
        qc.h(range(enc.n));qc.x(range(enc.n))
        if enc.n==1:qc.p(np.pi,0)
        else:qc.mcp(np.pi,list(range(enc.n-1)),enc.n-1)
        qc.x(range(enc.n));qc.h(range(enc.n))
    return qc
