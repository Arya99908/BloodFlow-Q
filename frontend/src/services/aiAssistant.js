import { api } from './api.js';

/**
 * Client-side domain reasoning engine that powers the BloodFlow-Q AI Copilot.
 * Ensures the assistant works smoothly whether the backend API is online or offline.
 */
export async function askAiAssistant(message, history = [], context = {}) {
  // 1. Try backend /chat endpoint first
  try {
    const response = await api.chat(message, history, context);
    if (response && response.reply) {
      return response;
    }
  } catch (error) {
    // Backend /chat unreachable or offline - seamlessly proceed with client reasoning
  }

  // 2. Client-side reasoning engine
  return generateClientDomainResponse(message, context);
}

export function generateClientDomainResponse(message, context = {}) {
  const msg = String(message || '').toLowerCase().trim();
  const scenario = context.scenario || null;
  if (!scenario) return {
    reply: 'The backend assistant is unavailable and no scenario data is loaded. Open the dashboard or retry when the API is available; inventory and demand cannot be reported yet.',
    suggested_actions: [{ id: 'load-dashboard', label: 'Open dashboard', type: 'navigate', payload: 'dashboard' }],
    data_citations: [],
  };
  const banks = scenario?.blood_banks || [];
  const hospitals = scenario?.hospitals || [];
  const routes = scenario?.routes || [];

  // Metrics computation
  let totalStock = 0;
  const groupStock = {};
  banks.forEach((b) => {
    Object.entries(b.inventory || {}).forEach(([g, qty]) => {
      const q = Number(qty || 0);
      totalStock += q;
      groupStock[g] = (groupStock[g] || 0) + q;
    });
  });

  let totalDemand = 0;
  let criticalDemand = 0;
  const groupDemand = {};
  const criticalHospitals = [];
  hospitals.forEach((h) => {
    Object.entries(h.demand || {}).forEach(([g, qty]) => {
      const q = Number(qty || 0);
      totalDemand += q;
      groupDemand[g] = (groupDemand[g] || 0) + q;
      const urg = h.urgency?.[g]?.category || '';
      if (['critical', 'high'].includes(urg)) {
        criticalDemand += q;
        if (!criticalHospitals.includes(h.name || h.id)) {
          criticalHospitals.push(h.name || h.id);
        }
      }
    });
  });

  const availableRoutes = routes.filter((r) => r.status === 'available');
  const blockedRoutes = routes.filter((r) => r.status === 'blocked');

  const actions = [];
  const citations = [];

  // 1. Critical Demand / Shortages
  if (/critical|shortage|unmet|urgent|deficit|need/i.test(msg)) {
    citations.push(`Scenario telemetry: ${hospitals.length} hospitals, ${criticalDemand} critical units`);
    let reply = `### 🚨 Critical Demand & Priority Analysis\n\n`;
    reply += `- **Total Network Demand:** ${totalDemand.toLocaleString()} blood units across ${hospitals.length} hospitals.\n`;
    reply += `- **Urgent / Critical Allocation:** **${criticalDemand.toLocaleString()} units** requiring immediate dispatch.\n`;
    if (criticalHospitals.length > 0) {
      reply += `- **Key Prioritized Facilities:** ${criticalHospitals.join(', ')}.\n\n`;
    }

    const deficits = [];
    Object.entries(groupDemand).forEach(([g, dem]) => {
      const stock = groupStock[g] || 0;
      if (stock < dem) {
        deficits.push(`**${g}**: ${dem - stock} unit shortfall (${stock} in stock vs ${dem} demand)`);
      }
    });

    if (deficits.length > 0) {
      reply += `⚠️ **High Risk Group Deficits:**\n${deficits.map((d) => `- ${d}`).join('\n')}\n\n`;
    } else {
      reply += `✅ **Supply Coverage:** Available regional inventory (${totalStock.toLocaleString()} units) meets gross demand (${totalDemand.toLocaleString()} units), though transportation transit times and active routing bottlenecks dictate timely delivery.\n\n`;
    }

    reply += `Would you like to run the optimizer or simulate disruptions?`;
    actions.push({ id: 'act-opt', label: '⚡ Run Quick Optimization', type: 'optimize' });
    actions.push({ id: 'act-emerg', label: '🚨 Open Emergency Simulator', type: 'navigate', payload: 'emergency' });

    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 2. Inventory / Blood Banks
  if (/inventory|stock|supply|blood bank|bank|units|o\+|a\+|b\+/i.test(msg)) {
    citations.push(`Inventory telemetry: ${banks.length} banks, ${totalStock} total units`);
    let reply = `### 🩸 Regional Blood Bank Inventory\n\n`;
    reply += `Currently **${banks.length} supply facilities** store an aggregate of **${totalStock.toLocaleString()} blood units**.\n\n`;
    reply += `**Stock Distribution by Blood Type:**\n`;
    Object.keys(groupStock).sort().forEach((g) => {
      reply += `- **${g}**: ${groupStock[g].toLocaleString()} units\n`;
    });

    if (banks.length > 0) {
      reply += `\n**Key Facilities:**\n`;
      banks.slice(0, 4).forEach((b) => {
        const bTotal = Object.values(b.inventory || {}).reduce((s, v) => s + Number(v || 0), 0);
        reply += `- **${b.name || b.id}** (${b.location_id}): ${bTotal.toLocaleString()} units\n`;
      });
    }

    actions.push({ id: 'act-banks', label: '📦 View Blood Banks', type: 'navigate', payload: 'blood-banks' });
    actions.push({ id: 'act-net', label: '🌐 View Distribution Routes', type: 'navigate', payload: 'network' });
    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 3. QAOA & Quantum Optimization
  if (/qaoa|quantum|qubo|qubit|penalty|hamiltonian|circuit|bound/i.test(msg)) {
    citations.push('Quantum logistics engine: QAOA QUBO Ising formulation');
    const reply = `### ⚛️ QAOA Quantum Allocation Architecture

BloodFlow-Q maps inter-facility logistics into a **Quadratic Unconstrained Binary Optimization (QUBO)** problem converted to an Ising spin Hamiltonian:

$$H = H_{\\text{cost}} + P_{\\text{inv}} H_{\\text{inventory}} + P_{\\text{dem}} H_{\\text{demand}}$$

#### Core Architectural Principles:
1. **Constraint Enforcement:** Penalties $P_{\\text{inv}}$ and $P_{\\text{dem}}$ must strictly exceed the scenario's **theoretical objective upper bound** to ensure infeasible states (e.g. negative inventory or over-delivery) are suppressed.
2. **Qubit Mapping:** 1 qubit represents binary assignment variable $x_{i,j,g}$ (shipping group $g$ from bank $i$ to hospital $j$).
3. **Variational Depth ($p$):** Alternates between problem unitary $e^{-i\\gamma H_C}$ and transverse mixer unitary $e^{-i\\beta H_M}$, tuned classically via COBYLA or Nelder-Mead.
4. **Validation:** Benchmarked against **HiGHS (MILP)** and **Greedy** to calculate quantum approximation ratios.`;

    actions.push({ id: 'act-opt-ws', label: '⚙️ Open Solver Workspace', type: 'navigate', payload: 'optimization' });
    actions.push({ id: 'act-results', label: '📊 View Benchmark Matrix', type: 'navigate', payload: 'results' });
    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 4. Solvers & Comparison (Greedy, MILP, Exact)
  if (/solver|milp|greedy|exact|benchmark|algorithm|compare|highs/i.test(msg)) {
    citations.push('Multi-solver evaluation: Greedy, MILP (HiGHS), Exact, QAOA');
    const reply = `### 📊 Allocation Solvers Compared

BloodFlow-Q provides 4 complementary allocation solvers:

| Solver | Paradigm | Complexity | Optimality | Best Used For |
| :--- | :--- | :--- | :--- | :--- |
| **Greedy** | Classical Priority | $O(N \\log N)$, <10ms | Near-optimal for critical | Urgent tactical dispatch |
| **MILP (HiGHS)** | Branch & Cut | Polynomial runtime | Proven global optimum | Strategic enterprise baseline |
| **Exact** | Exhaustive Evaluation | $O(2^V)$ exponential | True global ground truth | Formal verification ($\\le 16$ qubits) |
| **QAOA** | Quantum Variational | Statevector simulator | Probabilistic sampling | NISQ quantum research |

**Recommendation:** Use **Greedy** for sub-second emergency response, and **MILP** to evaluate global transport cost-time trade-offs.`;

    actions.push({ id: 'act-bench', label: '📊 Run Solver Benchmark', type: 'navigate', payload: 'results' });
    actions.push({ id: 'act-opt-quick', label: '⚡ Run Greedy Solve', type: 'optimize' });
    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 5. Routes & Transport Network
  if (/route|transport|distance|blocked|closure|transit|network|road/i.test(msg)) {
    citations.push(`Network topology: ${routes.length} routes, ${blockedRoutes.length} blocked`);
    let reply = `### 🛣️ Transport Corridors & Road Closures\n\n`;
    reply += `- **Total Monitored Routes:** ${routes.length}\n`;
    reply += `- **Clear & Active Corridors:** ${availableRoutes.length}\n`;
    reply += `- **Blocked Corridors:** ${blockedRoutes.length}\n\n`;

    if (blockedRoutes.length > 0) {
      reply += `⛔ **Active Disruptions:**\n`;
      blockedRoutes.forEach((br) => {
        reply += `- Route \`${br.source} ➔ ${br.destination}\`: ${br.distance_km} km (${br.travel_time_minutes} minutes)\n`;
      });
      reply += `\n*The optimization solver automatically routes around blocked corridors to avoid delayed life-saving transfusions.*\n`;
    } else {
      reply += `✅ All logistics links are currently clear.\n`;
    }

    actions.push({ id: 'act-net', label: '🌐 Inspect Transport Network', type: 'navigate', payload: 'network' });
    actions.push({ id: 'act-sim', label: '🚨 Simulate Disruption', type: 'navigate', payload: 'emergency' });
    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 6. Theme Switching
  if (/theme|dark|light|color|mode|night/i.test(msg)) {
    const reply = `BloodFlow-Q includes both **Dark theme** and **Light theme**! You can switch anytime using the toggle in the top bar or via the action button below.`;
    actions.push({ id: 'act-theme', label: '🌓 Toggle Dark/Light Theme', type: 'theme' });
    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 7. Direct Action / Optimize
  if (/run|solve|optimize|start|execute/i.test(msg)) {
    const reply = `Use the action below to run the Greedy baseline solver. No optimization has started yet. You can also evaluate with MILP or QAOA.`;
    actions.push({ id: 'act-do-opt', label: '⚡ Run Optimization Now', type: 'optimize' });
    actions.push({ id: 'act-nav-opt', label: '⚙️ Solver Workspace', type: 'navigate', payload: 'optimization' });
    return { reply, suggested_actions: actions, data_citations: citations };
  }

  // 8. General Greeting / Assistance
  citations.push(`BloodFlow-Q v0.1.0 Synthetic Research Environment`);
  const reply = `Hello! I am **Q-Bot**, your **BloodFlow-Q Logistics Intelligence Copilot** 🤖.

I monitor your live supply network:
- **Supply:** ${totalStock.toLocaleString()} units stored across ${banks.length} blood banks
- **Demand:** ${totalDemand.toLocaleString()} units requested across ${hospitals.length} hospitals (${criticalDemand.toLocaleString()} critical)
- **Logistics:** ${availableRoutes.length} available delivery routes (${blockedRoutes.length} blocked)

**What would you like to explore?**
- Check **critical shortages** or specific blood type inventories (e.g. O+, A+)
- Learn how **QAOA penalty weights** and Hamiltonians are formulated
- Compare **MILP (HiGHS)** vs **Greedy** solver efficiency
- Simulate **emergency demand spikes** or inter-facility route closures`;

  actions.push({ id: 'act-opt', label: '⚡ Run Optimization', type: 'optimize' });
  actions.push({ id: 'act-crit', label: '🚨 Check Critical Shortages', type: 'query', payload: 'What are our critical unmet demands?' });
  actions.push({ id: 'act-qaoa', label: '⚛️ Explain QAOA Formulation', type: 'query', payload: 'How do QAOA penalty weights work?' });

  return { reply, suggested_actions: actions, data_citations: citations };
}
