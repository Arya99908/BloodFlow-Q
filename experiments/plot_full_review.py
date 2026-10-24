"""Plot saved primary rows. Optional dependency: matplotlib==3.11.2."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def main(directory):
    payload=(directory/'runs.jsonl').read_bytes()
    groups=defaultdict(list)
    for line in payload.splitlines():
        row=json.loads(line)
        if row['family']=='primary' and row['status']=='completed':groups[row['method']].append(row)
    methods=['lp','milp','standard','warm','xy','warm_xy','warm_keep','warm_zero','warm_zero_keep','greedy_warm']
    fig,axes=plt.subplots(1,2,figsize=(13,5),layout='constrained')
    axes[0].boxplot([[r['wall_seconds'] for r in groups[m]] for m in methods],orientation='horizontal',tick_labels=methods,showfliers=True)
    axes[0].set_xscale('log');axes[0].set_xlabel('Measured end-to-end seconds (log scale)');axes[0].set_title('75 trials/method: 15 cases × 5 seeds')
    quantum=methods[2:]
    axes[1].boxplot([[r['optimal_shot_rate'] for r in groups[m]] for m in quantum],orientation='horizontal',tick_labels=quantum,showfliers=True)
    axes[1].set_xlim(-.02,1.02);axes[1].set_xlabel('Measured fraction of shots at strict encoded optimum');axes[1].set_title('Distributions across cases and seeds; not confidence intervals')
    fig.suptitle('BloodFlow-Q — simulated quantum methods and classical baselines\nQUBO, warm-start and training costs included; proof/diagnostics excluded',fontsize=12)
    fig.savefig(directory/'primary_comparison.svg');fig.savefig(directory/'primary_comparison.png',dpi=160);plt.close(fig)
    (directory/'plot_provenance.json').write_text(json.dumps({'source':'runs.jsonl','source_sha256':hashlib.sha256(payload).hexdigest(),'matplotlib':matplotlib.__version__,'plot':'primary_comparison.svg','scope':'Descriptive pooled distributions; cases are heterogeneous and repeated seeds are not independent instances.'},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);main(parser.parse_args().input)
