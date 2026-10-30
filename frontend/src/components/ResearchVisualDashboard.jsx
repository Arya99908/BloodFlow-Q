import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Activity
} from 'lucide-react';
import './ResearchVisualDashboard.css';

// 8 Standard Blood Groups
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Base Dataset for Clinical / Inventory Availability (matching mockup)
const INVENTORY_DATA = {
  availability: [
    { group: 'A+', current: 5000, required: 4960 },
    { group: 'A-', current: 3210, required: 5000 },
    { group: 'B+', current: 4108, required: 5000 },
    { group: 'B-', current: 5000, required: 5000 },
    { group: 'AB+', current: 2300, required: 3000 },
    { group: 'AB-', current: 2500, required: 2500 },
    { group: 'O+', current: 1289, required: 2000 },
    { group: 'O-', current: 1008, required: 1600 },
  ],
  collectedVsUsed: [
    { group: 'A+', collected: 120, used: 100 },
    { group: 'A-', collected: 100, used: 80 },
    { group: 'B+', collected: 150, used: 100 },
    { group: 'B-', collected: 110, used: 75 },
    { group: 'AB+', collected: 60, used: 40 },
    { group: 'AB-', collected: 50, used: 20 },
    { group: 'O+', collected: 40, used: 100 },
    { group: 'O-', collected: 16, used: 10 },
  ],
  trends: [
    { period: 'Q1', inflow: 4.1, outflow: 3.1 },
    { period: 'Q2', inflow: 1.4, outflow: 3.2 },
    { period: 'Q3', inflow: 1.9, outflow: 3.8 },
    { period: 'Q4', inflow: 2.6, outflow: 0.6 },
  ],
  expiryMatrix: [
    { group: 'A+', c15: 86, c30: 56, c45: 21, c60: 18 },
    { group: 'A-', c15: 46, c30: 30, c45: 77, c60: 69 },
    { group: 'B+', c15: 84, c30: 87, c45: 93, c56: 56 },
    { group: 'B-', c15: 24, c30: 34, c45: 67, c60: 60 },
    { group: 'AB+', c15: 65, c30: 69, c45: 29, c60: 96 },
    { group: 'AB-', c15: 42, c30: 55, c45: 33, c60: 88 },
    { group: 'O+', c15: 79, c30: 82, c45: 51, c60: 37 },
    { group: 'O-', c15: 33, c30: 47, c45: 76, c60: 59 },
  ],
  breakdown: [
    {
      region: 'North Region',
      totalStock: '14,900',
      stockLevel: 'High',
      expiryRisk: 'Low',
      lastUpdated: '25/09/2026',
      subFacilities: [
        { name: 'St. Jude Blood Center', stock: '8,200', status: 'Optimal' },
        { name: 'North Memorial Depot', stock: '6,700', status: 'Stable' },
      ],
    },
    {
      region: 'Central Hospital',
      totalStock: '8,569',
      stockLevel: 'Medium',
      expiryRisk: 'Low',
      lastUpdated: '25/09/2026',
      subFacilities: [
        { name: 'Main Trauma Blood Vault', stock: '5,100', status: 'Stable' },
        { name: 'Surgical ICU Reserves', stock: '3,469', status: 'Monitored' },
      ],
    },
    {
      region: 'North City Hospital',
      totalStock: '6,331',
      stockLevel: 'High',
      expiryRisk: 'Very Low',
      lastUpdated: '25/09/2026',
      subFacilities: [
        { name: 'Pediatric Transfusion Unit', stock: '3,200', status: 'Optimal' },
        { name: 'Emergency Room Fast-Track', stock: '3,131', status: 'Optimal' },
      ],
    },
    {
      region: 'South Region',
      totalStock: '10,300',
      stockLevel: 'Medium',
      expiryRisk: 'Medium',
      lastUpdated: '25/09/2026',
      subFacilities: [
        { name: 'Coastal Red Cross Hub', stock: '6,100', status: 'Needs Resupply' },
        { name: 'South Suburban Clinic', stock: '4,200', status: 'Stable' },
      ],
    },
  ],
};

// Quantum Optimization Telemetry Mapping
const QUANTUM_TELEMETRY_DATA = {
  availability: [
    { group: 'A+', current: 4960, required: 4960 }, // Exact Match
    { group: 'A-', current: 5000, required: 5000 },
    { group: 'B+', current: 4890, required: 5000 },
    { group: 'B-', current: 5000, required: 5000 },
    { group: 'AB+', current: 2950, required: 3000 },
    { group: 'AB-', current: 2500, required: 2500 },
    { group: 'O+', current: 1980, required: 2000 },
    { group: 'O-', current: 1600, required: 1600 },
  ],
  collectedVsUsed: [
    { group: 'A+', collected: 65, used: 12 }, // LP Warm-start (65%) vs Standard QAOA (12%)
    { group: 'A-', collected: 71, used: 15 },
    { group: 'B+', collected: 82, used: 18 },
    { group: 'B-', collected: 68, used: 14 },
    { group: 'AB+', collected: 55, used: 9 },
    { group: 'AB-', collected: 60, used: 11 },
    { group: 'O+', collected: 78, used: 20 },
    { group: 'O-', collected: 64, used: 8 },
  ],
  trends: [
    { period: 'N=4', inflow: 0.2, outflow: 0.0 }, // N=4 variables: runtime 0.2s, gap 0%
    { period: 'N=8', inflow: 0.8, outflow: 0.1 }, // N=8
    { period: 'N=16', inflow: 2.1, outflow: 0.4 }, // N=16
    { period: 'N=32', inflow: 4.8, outflow: 1.2 }, // N=32
  ],
};

export default function ResearchVisualDashboard() {
  const [viewMode, setViewMode] = useState('inventory'); // 'inventory' | 'quantum'
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [period, setPeriod] = useState('Last 7 days');
  const [expandedRows, setExpandedRows] = useState({ 'North Region': true });
  const [hoveredMark, setHoveredMark] = useState(null);

  const toggleRow = (region) => {
    setExpandedRows((prev) => ({ ...prev, [region]: !prev[region] }));
  };

  const currentDataset = viewMode === 'inventory' ? INVENTORY_DATA : {
    ...INVENTORY_DATA,
    availability: QUANTUM_TELEMETRY_DATA.availability,
    collectedVsUsed: QUANTUM_TELEMETRY_DATA.collectedVsUsed,
    trends: QUANTUM_TELEMETRY_DATA.trends,
  };

  // Filtered availability items
  const filteredAvailability = useMemo(() => {
    if (selectedGroup === 'All') return currentDataset.availability;
    return currentDataset.availability.filter((item) => item.group === selectedGroup);
  }, [currentDataset.availability, selectedGroup]);

  // Filtered collected vs used items
  const filteredCollected = useMemo(() => {
    if (selectedGroup === 'All') return currentDataset.collectedVsUsed;
    return currentDataset.collectedVsUsed.filter((item) => item.group === selectedGroup);
  }, [currentDataset.collectedVsUsed, selectedGroup]);

  // KPI Metrics calculation
  const kpis = useMemo(() => {
    if (viewMode === 'inventory') {
      return [
        {
          label: 'Current Units in Stock (count)',
          value: '25.2K',
          trend: '▲',
          trendType: 'positive',
          comparison: 'vs prev period 22.1K (+14%)',
        },
        {
          label: 'Blood Diversity Coverage (%)',
          value: '87.5%',
          trend: '▲',
          trendType: 'positive',
          comparison: 'vs prev period 75.2% (+16.4%)',
        },
        {
          label: 'Average Shelf Life (days)',
          value: '35',
          trend: '▲',
          trendType: 'positive',
          comparison: 'vs prev period 28 (+25%)',
        },
        {
          label: 'Collection Efficiency (%)',
          value: '92.5',
          trend: '▲',
          trendType: 'positive',
          comparison: 'vs prev period 85.3 (+8.4%)',
        },
        {
          label: 'Stock Turnover Rate (%)',
          value: '65.2',
          trend: '▲',
          trendType: 'positive',
          comparison: 'vs prev period 58.7 (+11.1%)',
        },
        {
          label: 'Critical Stock Alert (%)',
          value: '12%',
          trend: '▼',
          trendType: 'alert',
          comparison: 'vs prev period 8% (4%)',
        },
      ];
    }
    return [
      {
        label: 'Evaluated Runs (count)',
        value: '75',
        trend: '▲',
        trendType: 'positive',
        comparison: 'vs baseline 24 planned (+14%)',
      },
      {
        label: 'Feasibility Coverage (%)',
        value: '93.3%',
        trend: '▲',
        trendType: 'positive',
        comparison: 'vs raw QAOA 0.0% (+93.3%)',
      },
      {
        label: 'Exact Optimum Match (%)',
        value: '86.7%',
        trend: '▲',
        trendType: 'positive',
        comparison: 'classical MILP benchmark',
      },
      {
        label: 'Feasible Shot Mass (%)',
        value: '68.4%',
        trend: '▲',
        trendType: 'positive',
        comparison: 'LP warm-start vs 14% std',
      },
      {
        label: 'Classical MILP Speedup',
        value: '850x',
        trend: '▲',
        trendType: 'positive',
        comparison: '3.4ms MILP vs 2.8s QAOA',
      },
      {
        label: 'Infeasible Candidate Risk (%)',
        value: '6.7%',
        trend: '▼',
        trendType: 'alert',
        comparison: 'raw QAOA without LP repair',
      },
    ];
  }, [viewMode]);

  // Chart 1: Availability vs Required SVG dimensions
  const c1Width = 620;
  const c1Height = 240;
  const c1Padding = { top: 35, right: 30, bottom: 40, left: 55 };
  const c1PlotW = c1Width - c1Padding.left - c1Padding.right;
  const c1PlotH = c1Height - c1Padding.top - c1Padding.bottom;
  const maxUnits1 = 5500;

  // Chart 2: Collected vs Used SVG dimensions
  const c2Width = 620;
  const c2Height = 240;
  const c2Padding = { top: 35, right: 30, bottom: 40, left: 55 };
  const c2PlotW = c2Width - c2Padding.left - c2Padding.right;
  const c2PlotH = c2Height - c2Padding.top - c2Padding.bottom;
  const maxUnits2 = viewMode === 'inventory' ? 180 : 100;

  // Chart 3: Trends Spline SVG dimensions
  const c3Width = 620;
  const c3Height = 210;
  const c3Padding = { top: 25, right: 45, bottom: 35, left: 45 };
  const c3PlotW = c3Width - c3Padding.left - c3Padding.right;
  const c3PlotH = c3Height - c3Padding.top - c3Padding.bottom;

  // Helper for heatmap cell color
  const getHeatmapColor = (val) => {
    if (val >= 80) return { bg: '#b91c1c', text: '#ffffff' }; // Deep crimson
    if (val >= 60) return { bg: '#e63946', text: '#ffffff' }; // Rich coral/red
    if (val >= 40) return { bg: '#f87171', text: '#1e293b' }; // Warm rose
    if (val >= 25) return { bg: '#fca5a5', text: '#1e293b' }; // Peach rose
    return { bg: '#fee2e2', text: '#334155' }; // Soft blush
  };

  return (
    <div className="rvd-dashboard-container">
      {/* Top Banner / Mode Switcher */}
      <div className="rvd-header-card">
        <div className="rvd-header-left">
          <div className="rvd-logo-badge">
            <Activity size={18} className="rvd-logo-icon" />
          </div>
          <div>
            <div className="rvd-header-title-row">
              <span className="rvd-brand-tag">BloodFlow-Q Telemetry</span>
              <span className="rvd-divider">|</span>
              <h1 className="rvd-main-title">
                {viewMode === 'inventory'
                  ? 'Blood Bank Inventory & Stock Dashboard | Stock & Availability Insights'
                  : 'Quantum-Classical Allocation Telemetry | Solver Performance & Fidelity'}
              </h1>
            </div>
            <p className="rvd-subtext">
              {viewMode === 'inventory'
                ? 'Clinical logistics telemetry, regional reserve buffers, expiration risk matrix, and multi-facility inventory levels.'
                : 'Comparative evaluation metrics, LP warm-start fidelity distributions, runtime scaling curves, and constraint feasibility.'}
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="rvd-view-toggle-wrap">
          <button
            type="button"
            className={`rvd-toggle-btn ${viewMode === 'inventory' ? 'active' : ''}`}
            onClick={() => setViewMode('inventory')}
          >
            <Layers size={14} /> Inventory & Stock
          </button>
          <button
            type="button"
            className={`rvd-toggle-btn ${viewMode === 'quantum' ? 'active' : ''}`}
            onClick={() => setViewMode('quantum')}
          >
            <Sparkles size={14} /> Quantum Telemetry
          </button>
        </div>
      </div>

      {/* Filter Control Row */}
      <div className="rvd-filter-bar">
        <div className="rvd-filter-item">
          <label htmlFor="rvd-blood-group">Select Blood Group</label>
          <div className="rvd-select-wrapper">
            <select
              id="rvd-blood-group"
              className="rvd-select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="All">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="rvd-chevron" />
          </div>
        </div>

        <div className="rvd-filter-item">
          <label htmlFor="rvd-source">
            {viewMode === 'inventory' ? 'Collection Source' : 'Scenario / Protocol'}
          </label>
          <div className="rvd-select-wrapper">
            <select
              id="rvd-source"
              className="rvd-select"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="All">All Sources</option>
              <option value="Central Blood Bank">Central Blood Bank</option>
              <option value="Red Cross Depot">Red Cross Regional Depot</option>
              <option value="Mobile Donor Vans">Mobile Donor Drives</option>
              <option value="Emergency Flight Resupply">Emergency Resupply Corridor</option>
            </select>
            <ChevronDown size={14} className="rvd-chevron" />
          </div>
        </div>

        <div className="rvd-filter-item">
          <label htmlFor="rvd-region">Select Hospital/Region</label>
          <div className="rvd-select-wrapper">
            <select
              id="rvd-region"
              className="rvd-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              <option value="All">All Facilities / Regions</option>
              <option value="North Region">North Region</option>
              <option value="Central Hospital">Central Hospital</option>
              <option value="North City Hospital">North City Hospital</option>
              <option value="South Region">South Region</option>
            </select>
            <ChevronDown size={14} className="rvd-chevron" />
          </div>
        </div>

        <div className="rvd-filter-item">
          <label htmlFor="rvd-status">Status</label>
          <div className="rvd-select-wrapper">
            <select
              id="rvd-status"
              className="rvd-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Optimal">Optimal Buffer</option>
              <option value="Moderate">Moderate Buffer</option>
              <option value="Critical">Critical Shortage Alert</option>
            </select>
            <ChevronDown size={14} className="rvd-chevron" />
          </div>
        </div>
      </div>

      {/* 6 KPI Stat Cards Grid */}
      <div className="rvd-kpi-grid">
        {kpis.map((kpi, idx) => (
          <div className="rvd-kpi-card" key={idx}>
            <div className="rvd-kpi-title">{kpi.label}</div>
            <div className="rvd-kpi-main">
              <span className="rvd-kpi-val">{kpi.value}</span>
              <span className={`rvd-kpi-trend rvd-trend-${kpi.trendType}`}>
                {kpi.trend}
              </span>
            </div>
            <div className={`rvd-kpi-comp rvd-comp-${kpi.trendType}`}>
              {kpi.comparison}
            </div>
          </div>
        ))}
      </div>

      {/* 2x2 Rich Visual Analytics Grid */}
      <div className="rvd-charts-grid">
        {/* CARD 1: Combo Chart - Blood Group Availability vs Required Levels */}
        <div className="rvd-chart-card">
          <div className="rvd-card-header">
            <h2 className="rvd-card-title">
              {viewMode === 'inventory'
                ? 'Blood Group Availability vs Required Levels'
                : 'Allocated Blood Group Units vs Target Demand'}
            </h2>
            <div className="rvd-legend">
              <span className="rvd-legend-item">
                <i className="rvd-legend-line-dot" /> Required
              </span>
              <span className="rvd-legend-item">
                <i className="rvd-legend-bar-coral" /> Current Stock
              </span>
            </div>
          </div>

          <div className="rvd-svg-wrap">
            <svg
              className="rvd-chart-svg"
              viewBox={`0 0 ${c1Width} ${c1Height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Blood Group Availability vs Required Levels combo chart"
            >
              {/* Y-Axis Gridlines & Ticks */}
              {[0, 1240, 2480, 3720, 4960].map((tick) => {
                const y = c1Height - c1Padding.bottom - (tick / maxUnits1) * c1PlotH;
                return (
                  <g key={tick} className="rvd-grid-line-group">
                    <line
                      x1={c1Padding.left}
                      y1={y}
                      x2={c1Width - c1Padding.right}
                      y2={y}
                      className="rvd-grid-line"
                    />
                    <text
                      x={c1Padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="rvd-axis-text"
                    >
                      {tick.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Title */}
              <text
                x={16}
                y={c1Height / 2}
                textAnchor="middle"
                transform={`rotate(-90, 16, ${c1Height / 2})`}
                className="rvd-axis-title"
              >
                Units
              </text>

              {/* Bars: Current Stock */}
              {filteredAvailability.map((item, idx) => {
                const barSlotW = c1PlotW / filteredAvailability.length;
                const barW = Math.min(32, barSlotW * 0.55);
                const x = c1Padding.left + idx * barSlotW + (barSlotW - barW) / 2;
                const barH = (item.current / maxUnits1) * c1PlotH;
                const y = c1Height - c1Padding.bottom - barH;

                return (
                  <g key={item.group} className="rvd-bar-group">
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="3"
                      className="rvd-bar-coral"
                    >
                      <title>{`${item.group} Current Stock: ${item.current.toLocaleString()} units`}</title>
                    </rect>
                    {/* Data Label atop bar */}
                    <text
                      x={x + barW / 2}
                      y={y - 6}
                      textAnchor="middle"
                      className="rvd-bar-datalabel"
                    >
                      {item.current}
                    </text>
                    {/* X-Axis Blood Group Label */}
                    <text
                      x={x + barW / 2}
                      y={c1Height - c1Padding.bottom + 18}
                      textAnchor="middle"
                      className="rvd-axis-group-label"
                    >
                      {item.group}
                    </text>
                  </g>
                );
              })}

              {/* Target Line: Required Levels */}
              {(() => {
                const points = filteredAvailability.map((item, idx) => {
                  const barSlotW = c1PlotW / filteredAvailability.length;
                  const x = c1Padding.left + idx * barSlotW + barSlotW / 2;
                  const y = c1Height - c1Padding.bottom - (item.required / maxUnits1) * c1PlotH;
                  return { x, y, required: item.required, group: item.group };
                });
                const pathD = points.reduce(
                  (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`,
                  ''
                );

                return (
                  <g className="rvd-line-group">
                    <path d={pathD} className="rvd-target-line" />
                    {points.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        className="rvd-target-dot"
                      >
                        <title>{`${pt.group} Required Target: ${pt.required.toLocaleString()} units`}</title>
                      </circle>
                    ))}
                  </g>
                );
              })()}

              {/* X-Axis Title */}
              <text
                x={c1Width / 2}
                y={c1Height - 6}
                textAnchor="middle"
                className="rvd-axis-title"
              >
                Blood Group
              </text>
            </svg>
          </div>
        </div>

        {/* CARD 2: Grouped Bar Chart - Units Collected vs Used */}
        <div className="rvd-chart-card">
          <div className="rvd-card-header">
            <h2 className="rvd-card-title">
              {viewMode === 'inventory'
                ? 'Blood Group Units Collected vs Used'
                : 'Standard QAOA vs LP Warm-Start (Feasible Shot %)'}
            </h2>
            <div className="rvd-header-right-tools">
              <div className="rvd-period-selector">
                <span className="rvd-period-label">Period</span>
                <select
                  className="rvd-period-select"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="Last 7 days">Last 7 days</option>
                  <option value="Last 30 days">Last 30 days</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
                <ChevronDown size={12} className="rvd-period-chevron" />
              </div>
            </div>
          </div>

          <div className="rvd-legend rvd-sub-legend">
            <span className="rvd-legend-item">
              <i className="rvd-legend-bar-darkcoral" />
              {viewMode === 'inventory' ? 'Units Collected' : 'LP Warm-Start QAOA'}
            </span>
            <span className="rvd-legend-item">
              <i className="rvd-legend-bar-lightcoral" />
              {viewMode === 'inventory' ? 'Units Used' : 'Standard QAOA'}
            </span>
          </div>

          <div className="rvd-svg-wrap">
            <svg
              className="rvd-chart-svg"
              viewBox={`0 0 ${c2Width} ${c2Height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Grouped units comparison bar chart"
            >
              {/* Y-Axis Gridlines & Ticks */}
              {[0, 40, 80, 120, 160].map((tick) => {
                if (tick > maxUnits2) return null;
                const y = c2Height - c2Padding.bottom - (tick / maxUnits2) * c2PlotH;
                return (
                  <g key={tick} className="rvd-grid-line-group">
                    <line
                      x1={c2Padding.left}
                      y1={y}
                      x2={c2Width - c2Padding.right}
                      y2={y}
                      className="rvd-grid-line"
                    />
                    <text
                      x={c2Padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="rvd-axis-text"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              <text
                x={16}
                y={c2Height / 2}
                textAnchor="middle"
                transform={`rotate(-90, 16, ${c2Height / 2})`}
                className="rvd-axis-title"
              >
                {viewMode === 'inventory' ? 'Units' : 'Feasible Shot %'}
              </text>

              {/* Paired Bars */}
              {filteredCollected.map((item, idx) => {
                const groupSlotW = c2PlotW / filteredCollected.length;
                const pairBarW = Math.min(16, (groupSlotW - 12) / 2);
                const startX = c2Padding.left + idx * groupSlotW + (groupSlotW - pairBarW * 2 - 4) / 2;

                const hCol = (item.collected / maxUnits2) * c2PlotH;
                const yCol = c2Height - c2Padding.bottom - hCol;

                const hUsed = (item.used / maxUnits2) * c2PlotH;
                const yUsed = c2Height - c2Padding.bottom - hUsed;

                return (
                  <g key={item.group} className="rvd-paired-group">
                    {/* Collected / Warm Bar (Dark Coral) */}
                    <rect
                      x={startX}
                      y={yCol}
                      width={pairBarW}
                      height={hCol}
                      rx="2"
                      className="rvd-bar-darkcoral"
                    >
                      <title>{`${item.group} Collected: ${item.collected}`}</title>
                    </rect>
                    <text
                      x={startX + pairBarW / 2}
                      y={yCol - 4}
                      textAnchor="middle"
                      className="rvd-bar-datalabel-micro"
                    >
                      {item.collected}
                    </text>

                    {/* Used / Standard Bar (Light Coral) */}
                    <rect
                      x={startX + pairBarW + 3}
                      y={yUsed}
                      width={pairBarW}
                      height={hUsed}
                      rx="2"
                      className="rvd-bar-lightcoral"
                    >
                      <title>{`${item.group} Used: ${item.used}`}</title>
                    </rect>
                    <text
                      x={startX + pairBarW + 3 + pairBarW / 2}
                      y={yUsed - 4}
                      textAnchor="middle"
                      className="rvd-bar-datalabel-micro"
                    >
                      {item.used}
                    </text>

                    {/* Group Label */}
                    <text
                      x={startX + pairBarW + 1}
                      y={c2Height - c2Padding.bottom + 18}
                      textAnchor="middle"
                      className="rvd-axis-group-label"
                    >
                      {item.group}
                    </text>
                  </g>
                );
              })}

              <text
                x={c2Width / 2}
                y={c2Height - 6}
                textAnchor="middle"
                className="rvd-axis-title"
              >
                Blood Group
              </text>
            </svg>
          </div>
        </div>

        {/* CARD 3: Smooth Spline Trend Chart - Inflow vs Outflow */}
        <div className="rvd-chart-card">
          <div className="rvd-card-header">
            <div>
              <h2 className="rvd-card-title">
                {viewMode === 'inventory'
                  ? 'Stock Inflow vs Outflow Trends'
                  : 'Runtime vs Optimality Gap Scaling Trends'}
              </h2>
            </div>
            <span className="rvd-quarterly-note">
              {viewMode === 'inventory'
                ? '*Note: Shows overall Quarterly Trend'
                : '*Note: Evaluated across N=4 to N=32 variables'}
            </span>
          </div>

          <div className="rvd-svg-wrap">
            <svg
              className="rvd-chart-svg"
              viewBox={`0 0 ${c3Width} ${c3Height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Stock Inflow vs Outflow Trends smooth spline chart"
            >
              {/* Left Y Axis (Inflow %) */}
              {[0, 1, 2, 3, 4].map((tick) => {
                const y = c3Height - c3Padding.bottom - (tick / 4) * c3PlotH;
                return (
                  <g key={tick} className="rvd-grid-line-group">
                    <line
                      x1={c3Padding.left}
                      y1={y}
                      x2={c3Width - c3Padding.right}
                      y2={y}
                      className="rvd-grid-line"
                    />
                    <text
                      x={c3Padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="rvd-axis-text"
                    >
                      {tick}
                    </text>
                    {/* Right Y Axis Tick (Outflow %) */}
                    <text
                      x={c3Width - c3Padding.right + 8}
                      y={y + 4}
                      textAnchor="start"
                      className="rvd-axis-text"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Y Axis Titles */}
              <text
                x={12}
                y={c3Height / 2}
                textAnchor="middle"
                transform={`rotate(-90, 12, ${c3Height / 2})`}
                className="rvd-axis-title"
              >
                {viewMode === 'inventory' ? 'Inflow (%)' : 'Runtime (s)'}
              </text>
              <text
                x={c3Width - 12}
                y={c3Height / 2}
                textAnchor="middle"
                transform={`rotate(90, ${c3Width - 12}, ${c3Height / 2})`}
                className="rvd-axis-title"
              >
                {viewMode === 'inventory' ? 'Outflow (%)' : 'Gap (%)'}
              </text>

              {/* Spline Area & Lines */}
              {(() => {
                const trends = currentDataset.trends;
                const step = c3PlotW / (trends.length - 1);

                // Coordinates for Inflow
                const inPoints = trends.map((t, i) => ({
                  x: c3Padding.left + i * step,
                  y: c3Height - c3Padding.bottom - (t.inflow / 4) * c3PlotH,
                  val: t.inflow,
                }));

                // Coordinates for Outflow
                const outPoints = trends.map((t, i) => ({
                  x: c3Padding.left + i * step,
                  y: c3Height - c3Padding.bottom - (t.outflow / 4) * c3PlotH,
                  val: t.outflow,
                }));

                // Create smooth cubic bezier curves
                const createCurvedPath = (pts) => {
                  let d = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const curr = pts[i];
                    const next = pts[i + 1];
                    const cp1x = curr.x + (next.x - curr.x) / 2;
                    const cp1y = curr.y;
                    const cp2x = curr.x + (next.x - curr.x) / 2;
                    const cp2y = next.y;
                    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
                  }
                  return d;
                };

                const inCurveD = createCurvedPath(inPoints);
                const outCurveD = createCurvedPath(outPoints);

                const baseY = c3Height - c3Padding.bottom;
                const inAreaD = `${inCurveD} L ${inPoints[inPoints.length - 1].x} ${baseY} L ${inPoints[0].x} ${baseY} Z`;

                return (
                  <g className="rvd-trends-curves">
                    {/* Gradient Definitions */}
                    <defs>
                      <linearGradient id="rvdAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef233c" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#ef233c" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Area fill for Inflow */}
                    <path d={inAreaD} fill="url(#rvdAreaGrad)" />

                    {/* Outflow Spline Line (Soft Rose / Coral) */}
                    <path d={outCurveD} className="rvd-spline-outflow" />

                    {/* Inflow Spline Line (Deep Crimson / Coral) */}
                    <path d={inCurveD} className="rvd-spline-inflow" />

                    {/* Point Markers */}
                    {inPoints.map((pt, i) => (
                      <circle
                        key={`in-${i}`}
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        className="rvd-trend-node-in"
                      >
                        <title>{`Inflow: ${pt.val}%`}</title>
                      </circle>
                    ))}

                    {/* X Axis Labels */}
                    {trends.map((t, i) => (
                      <text
                        key={t.period}
                        x={c3Padding.left + i * step}
                        y={baseY + 20}
                        textAnchor="middle"
                        className="rvd-axis-group-label"
                      >
                        {t.period}
                      </text>
                    ))}
                  </g>
                );
              })()}

              <text
                x={c3Width / 2}
                y={c3Height - 2}
                textAnchor="middle"
                className="rvd-axis-title"
              >
                {viewMode === 'inventory' ? 'Month / Quarter' : 'Instance Scale'}
              </text>
            </svg>
          </div>
        </div>

        {/* CARD 4: Heatmap Matrix - Blood Units Approaching Expiry */}
        <div className="rvd-chart-card">
          <div className="rvd-card-header">
            <h2 className="rvd-card-title">
              {viewMode === 'inventory'
                ? 'Blood Units Approaching Expiry'
                : 'Urgency & Constraint Violation Risk Matrix'}
            </h2>
          </div>

          <div className="rvd-heatmap-table-wrap">
            <table
              className="rvd-heatmap-table"
              aria-label="Blood Units Approaching Expiry heatmap"
            >
              <thead>
                <tr>
                  <th className="rvd-hm-group-col"></th>
                  <th>&lt;15 Days</th>
                  <th>15-30 Days</th>
                  <th>30-45 Days</th>
                  <th>45-60 Days</th>
                </tr>
              </thead>
              <tbody>
                {INVENTORY_DATA.expiryMatrix.map((row) => (
                  <tr key={row.group}>
                    <td className="rvd-hm-row-label">{row.group}</td>
                    {[row.c15, row.c30, row.c45, row.c60].map((val, cellIdx) => {
                      const colorStyle = getHeatmapColor(val);
                      return (
                        <td
                          key={cellIdx}
                          className="rvd-hm-cell"
                          style={{
                            backgroundColor: colorStyle.bg,
                            color: colorStyle.text,
                          }}
                          title={`${row.group} approaching expiry: ${val} units`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Detailed Table Breakdown */}
      <div className="rvd-table-card">
        <div className="rvd-card-header">
          <h2 className="rvd-card-title">Detailed Stock Breakdown</h2>
        </div>

        <div className="rvd-table-responsive">
          <table className="rvd-breakdown-table">
            <thead>
              <tr>
                <th className="rvd-col-region">Region</th>
                <th>Total Stock</th>
                <th>Stock Level</th>
                <th>Expiry Risk</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {INVENTORY_DATA.breakdown.map((row) => {
                const isExpanded = !!expandedRows[row.region];
                return (
                  <React.Fragment key={row.region}>
                    <tr
                      className={`rvd-parent-row ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleRow(row.region)}
                    >
                      <td className="rvd-region-cell">
                        <button
                          type="button"
                          className="rvd-expand-btn"
                          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                        >
                          {isExpanded ? '−' : '+'}
                        </button>
                        <span className="rvd-region-name">{row.region}</span>
                      </td>
                      <td className="rvd-total-stock">{row.totalStock}</td>
                      <td>
                        <span
                          className={`rvd-badge rvd-badge-level-${row.stockLevel.toLowerCase()}`}
                        >
                          {row.stockLevel}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`rvd-badge rvd-badge-risk-${row.expiryRisk.toLowerCase().replace(' ', '-')}`}
                        >
                          {row.expiryRisk}
                        </span>
                      </td>
                      <td className="rvd-updated-text">{row.lastUpdated}</td>
                    </tr>

                    {/* Sub-facilities collapsible details */}
                    {isExpanded &&
                      row.subFacilities?.map((sub, sIdx) => (
                        <tr key={sIdx} className="rvd-sub-row">
                          <td className="rvd-sub-facility-name">
                            <span className="rvd-sub-indent">↳</span> {sub.name}
                          </td>
                          <td className="rvd-sub-stock">{sub.stock} units</td>
                          <td colSpan="3">
                            <span className="rvd-sub-status">
                              Status: <strong>{sub.status}</strong>
                            </span>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
