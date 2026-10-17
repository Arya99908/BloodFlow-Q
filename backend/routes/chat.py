"""AI Assistant / Chatbot endpoint for BloodFlow-Q logistics intelligence."""

from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.dependencies import get_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatMessage(BaseModel):
    role: str = Field(description="Role of the sender: user, assistant, system")
    content: str = Field(description="Content of the message")


class ChatRequest(BaseModel):
    message: str = Field(description="User prompt or question")
    history: list[ChatMessage] = Field(default=[], description="Previous message history")
    context: dict[str, Any] = Field(default={}, description="Optional client context (current page, theme, etc.)")


class ActionSuggestion(BaseModel):
    id: str
    label: str
    type: str  # "navigate" | "optimize" | "theme" | "query"
    payload: Any = None


class ChatResponse(BaseModel):
    reply: str
    suggested_actions: list[ActionSuggestion] = []
    data_citations: list[str] = []


def _generate_domain_response(message: str, scenario_dict: dict[str, Any], history: list[ChatMessage]) -> ChatResponse:
    """Intelligent domain reasoning engine for BloodFlow-Q logistics."""
    msg = message.lower().strip()
    banks = scenario_dict.get("blood_banks", [])
    hospitals = scenario_dict.get("hospitals", [])
    routes = scenario_dict.get("routes", [])

    actions: list[ActionSuggestion] = []
    citations: list[str] = []

    # Calculate basic inventory and demand metrics
    total_stock = 0
    group_stock: dict[str, int] = {}
    for b in banks:
        inv = b.get("inventory", {})
        for g, qty in inv.items():
            qty_int = int(qty or 0)
            total_stock += qty_int
            group_stock[g] = group_stock.get(g, 0) + qty_int

    total_demand = 0
    critical_demand = 0
    group_demand: dict[str, int] = {}
    critical_hospitals: list[str] = []
    for h in hospitals:
        dem = h.get("demand", {})
        urg = h.get("urgency", {})
        for g, qty in dem.items():
            qty_int = int(qty or 0)
            total_demand += qty_int
            group_demand[g] = group_demand.get(g, 0) + qty_int
            u_cat = (urg.get(g, {}) if isinstance(urg.get(g), dict) else {}).get("category", "").lower()
            if u_cat in ("critical", "high"):
                critical_demand += qty_int
                h_name = h.get("name", h.get("id"))
                if h_name not in critical_hospitals:
                    critical_hospitals.append(h_name)

    blocked_routes = [r for r in routes if r.get("status") == "blocked"]
    available_routes = [r for r in routes if r.get("status") == "available"]

    # 1. Critical Demand / Shortages
    if any(k in msg for k in ["critical", "shortage", "unmet", "urgent", "emergency"]):
        citations.append(f"Scenario: {len(hospitals)} hospitals, {critical_demand} critical/high demand units")
        reply = (
            f"### 🚨 Critical Demand & Shortage Assessment\n\n"
            f"- **Total Demand:** {total_demand:,} units across {len(hospitals)} hospital facilities.\n"
            f"- **High & Critical Urgency:** {critical_demand:,} units requiring prioritized delivery.\n"
            f"- **Affected Facilities:** {', '.join(critical_hospitals) if critical_hospitals else 'None currently critical'}.\n\n"
            f"**Supply Comparison:** Total available inventory across all regional blood banks is **{total_stock:,} units**.\n\n"
        )
        deficits = []
        for g, dem in group_demand.items():
            avail = group_stock.get(g, 0)
            if avail < dem:
                deficits.append(f"**{g}**: {dem - avail} unit shortfall ({avail} in stock vs {dem} requested)")

        if deficits:
            reply += "⚠️ **Detected Group Deficits:**\n" + "\n".join(f"- {d}" for d in deficits) + "\n\n"
        else:
            reply += "✅ Aggregate inventory theoretically covers total demand, though inter-facility routing constraints and transport times must be optimized.\n\n"

        reply += "You can trigger the optimizer or simulate disruptions to assess resilience."
        actions.append(ActionSuggestion(id="act-opt", label="⚡ Run Quick Optimization", type="optimize"))
        actions.append(ActionSuggestion(id="act-emerg", label="🚨 Go to Emergency Simulation", type="navigate", payload="emergency"))

    # 2. Inventory / Blood Banks
    elif any(k in msg for k in ["inventory", "stock", "bank", "supply", "o-", "o+", "a+", "b+"]):
        citations.append(f"Blood banks: {len(banks)} active supply sources, {total_stock} total units")
        reply = (
            f"### 🩸 Blood Bank Inventory Snapshot\n\n"
            f"There are **{len(banks)} regional blood banks** holding a combined **{total_stock:,} units**.\n\n"
            f"**Distribution by Blood Group:**\n"
        )
        for g in sorted(group_stock.keys()):
            reply += f"- **{g}**: {group_stock[g]:,} units available\n"

        reply += "\n**Facility Breakdown:**\n"
        for b in banks:
            b_total = sum(int(v or 0) for v in b.get("inventory", {}).values())
            reply += f"- **{b.get('name', b.get('id'))}** (`{b.get('location_id')}`): {b_total:,} units\n"

        actions.append(ActionSuggestion(id="act-banks", label="📦 View Blood Banks", type="navigate", payload="blood-banks"))
        actions.append(ActionSuggestion(id="act-network", label="🌐 Inspect Network", type="navigate", payload="network"))

    # 3. QAOA / Quantum Solver Questions
    elif any(k in msg for k in ["qaoa", "quantum", "qubo", "penalty", "qubit", "hamiltonian", "bound"]):
        citations.append("Quantum optimization module: QAOA QUBO formulation")
        reply = (
            "### ⚛️ QAOA & Quantum Optimization Guide\n\n"
            "BloodFlow-Q formulates the blood supply allocation problem as a **Quadratic Unconstrained Binary Optimization (QUBO)** problem mapped to an Ising Hamiltonian:\n\n"
            "$$H = H_{\\text{objective}} + P_{\\text{inv}} H_{\\text{inv}} + P_{\\text{dem}} H_{\\text{demand}}$$\n\n"
            "#### Key Insights:\n"
            "1. **Penalty Bound Requirement:** Penalty weights ($P_{\\text{inv}}$, $P_{\\text{dem}}$) must strictly exceed the scenario's **theoretical objective upper bound** to guarantee that constraint violations are heavily penalized over allocation costs.\n"
            "2. **Qubit Mapping:** Each binary decision variable $x_{i,j,g}$ (dispatching unit from bank $i$ to hospital $j$ of group $g$) maps to 1 qubit.\n"
            "3. **Circuit Depth ($p$):** Alternating cost unitary $U(C, \\gamma) = e^{-i\\gamma H_C}$ and mixer unitary $U(B, \\beta) = e^{-i\\beta H_M}$ driven by classical parameter optimizers (e.g., COBYLA, Nelder-Mead).\n"
            "4. **Classical Comparison:** Run alongside **MILP (HiGHS)** and **Greedy** to benchmark approximation ratios and solution latency."
        )
        actions.append(ActionSuggestion(id="act-opt-qaoa", label="⚙️ Open Optimization Workspace", type="navigate", payload="optimization"))
        actions.append(ActionSuggestion(id="act-results", label="📊 View Benchmark Results", type="navigate", payload="results"))

    # 4. Solvers / MILP / Greedy / Benchmarking
    elif any(k in msg for k in ["solver", "milp", "greedy", "exact", "benchmark", "highs", "compare"]):
        citations.append("Solvers: Greedy (heuristic), MILP (HiGHS), Exact (exhaustive), QAOA (quantum)")
        reply = (
            "### 📊 Allocation Solvers Overview\n\n"
            "BloodFlow-Q provides 4 distinct allocation strategies:\n\n"
            "| Solver | Type | Scalability | Optimality | Use Case |\n"
            "| :--- | :--- | :--- | :--- | :--- |\n"
            "| **Greedy** | Classical Heuristic | $O(N \\log N)$, instant | Near-optimal for urgent demand | Rapid emergency dispatch |\n"
            "| **MILP (HiGHS)** | Exact Classical LP | Polynomial/branch-and-cut | Proven global optimum | Standard logistics baseline |\n"
            "| **Exact** | Exhaustive Search | Exponential $O(2^V)$ | Absolute ground truth | Validation on $\\le 16$ qubits |\n"
            "| **QAOA** | Quantum Variational | Statevector simulator | Probabilistic sampling | Quantum advantage research |\n\n"
            "Greedy prioritizes critical patient categories first, while MILP balances transportation cost, delivery time, and unmet demand simultaneously."
        )
        actions.append(ActionSuggestion(id="act-bench", label="📊 Run Benchmark Suite", type="navigate", payload="results"))
        actions.append(ActionSuggestion(id="act-opt-now", label="⚡ Optimize Greedy Baseline", type="optimize"))

    # 5. Routes / Network / Disruption
    elif any(k in msg for k in ["route", "network", "road", "transit", "blocked", "transport", "distance"]):
        citations.append(f"Network: {len(routes)} total routes ({len(available_routes)} open, {len(blocked_routes)} blocked)")
        reply = (
            f"### 🛣️ Transport Network Status\n\n"
            f"- **Total Distribution Routes:** {len(routes)}\n"
            f"- **Active & Open Routes:** {len(available_routes)}\n"
            f"- **Blocked / Disrupted Routes:** {len(blocked_routes)}\n\n"
        )
        if blocked_routes:
            reply += "⛔ **Currently Blocked Distribution Links:**\n"
            for br in blocked_routes:
                reply += f"- Route `{br.get('source')} ➔ {br.get('destination')}` ({br.get('distance_km')} km, {br.get('transport_time_hours')} hrs)\n"
            reply += "\n*Blocked corridors are excluded during allocation to preserve patient delivery safety.*\n"
        else:
            reply += "✅ All distribution corridors are fully operational with normal transit times.\n"

        actions.append(ActionSuggestion(id="act-net", label="🌐 View Transport Network", type="navigate", payload="network"))
        actions.append(ActionSuggestion(id="act-sim", label="🚨 Simulate Route Disruption", type="navigate", payload="emergency"))

    # 6. Theme Switching
    elif any(k in msg for k in ["theme", "dark", "light", "mode", "color"]):
        reply = "You can toggle between **Dark theme** and **Light theme** using the theme switch in the top header, or click the action below!"
        actions.append(ActionSuggestion(id="act-theme", label="🌓 Toggle Dark/Light Theme", type="theme"))

    # 7. Action Execution Requests
    elif any(k in msg for k in ["run", "execute", "solve", "start optimization"]):
        reply = "I'm initiating an allocation optimization using the fast Greedy baseline solver. You can also benchmark with MILP and QAOA."
        actions.append(ActionSuggestion(id="act-do-opt", label="⚡ Run Optimization Now", type="optimize"))
        actions.append(ActionSuggestion(id="act-nav-opt", label="⚙️ View Optimization Settings", type="navigate", payload="optimization"))

    # 8. General Greeting / Fallback
    else:
        citations.append(f"BloodFlow-Q v0.1.0 Synthetic Environment ({len(banks)} banks, {len(hospitals)} hospitals)")
        reply = (
            f"Hello! I am your **BloodFlow-Q Logistics Intelligence Copilot** 🤖.\n\n"
            f"I have direct visibility into the current synthetic supply scenario:\n"
            f"- **Supply:** {total_stock:,} blood units across {len(banks)} blood banks\n"
            f"- **Demand:** {total_demand:,} units requested by {len(hospitals)} hospitals ({critical_demand:,} high/critical priority)\n"
            f"- **Network:** {len(available_routes)} open transit corridors ({len(blocked_routes)} blocked)\n\n"
            f"**How can I assist your research today?**\n"
            f"- Ask about **critical shortages** or specific blood groups (e.g. O-, A+)\n"
            f"- Explore **QAOA quantum formulation**, penalty weights, and qubit bounds\n"
            f"- Compare **MILP vs Greedy** benchmarks\n"
            f"- Trigger or simulate **emergency disruptions**"
        )
        actions.append(ActionSuggestion(id="act-opt", label="⚡ Run Optimization", type="optimize"))
        actions.append(ActionSuggestion(id="act-crit", label="🚨 Check Critical Shortages", type="query", payload="Show critical shortages and unmet demand"))
        actions.append(ActionSuggestion(id="act-qaoa", label="⚛️ Explain QAOA Formulation", type="query", payload="How do QAOA penalty weights work?"))

    return ChatResponse(
        reply=reply,
        suggested_actions=actions,
        data_citations=citations,
    )


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, service=Depends(get_service)):
    """Handles conversational questions with live scenario context and LLM fallback."""
    scenario = service.get_scenario()
    if isinstance(scenario, dict):
        scenario_dict = scenario
    elif hasattr(scenario, "model_dump"):
        scenario_dict = scenario.model_dump()
    elif hasattr(scenario, "dict"):
        scenario_dict = scenario.dict()
    else:
        scenario_dict = {}
    return _generate_domain_response(request.message, scenario_dict, request.history)
