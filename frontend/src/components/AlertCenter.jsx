import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Radio,
  ShieldAlert,
  Siren,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Generates an audio chime using the Web Audio API without needing external sound files.
 */
function playAudioChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch {
    // Audio autoplay might be restricted by browser until user gesture
  }
}

/**
 * Dispatches a native browser desktop notification if permission has been granted.
 */
function sendNativeNotification(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'bloodflow-urgent-alert',
      });
    }
  } catch {
    // Ignore if not permitted
  }
}

const SAMPLE_EMERGENCY_SCENARIOS = [
  {
    facility: 'Metro Trauma Center',
    bloodGroup: 'O-',
    units: 8,
    reason: 'Multi-vehicle highway collision mass-casualty incident',
  },
  {
    facility: 'St. Jude Emergency Hospital',
    bloodGroup: 'A+',
    units: 12,
    reason: 'Emergency cardiovascular surgery surge',
  },
  {
    facility: 'Regional Children’s Hospital',
    bloodGroup: 'O+',
    units: 6,
    reason: 'Critical pediatric hemorrhage requirement',
  },
  {
    facility: 'City Memorial Pavilion',
    bloodGroup: 'B-',
    units: 4,
    reason: 'Acute hematology patient crisis',
  },
];

export default function AlertCenter({ onNavigate, onOptimization }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [activeToasts, setActiveToasts] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('bloodflow-alert-sound') !== 'disabled';
    } catch {
      return true;
    }
  });
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const dropdownRef = useRef(null);
  const alertedIdsRef = useRef(new Set());

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Save sound preference
  useEffect(() => {
    try {
      localStorage.setItem('bloodflow-alert-sound', soundEnabled ? 'enabled' : 'disabled');
    } catch {}
  }, [soundEnabled]);

  // Request browser notification permission
  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setBrowserNotifEnabled(perm === 'granted');
      if (perm === 'granted') {
        sendNativeNotification('BloodFlow-Q Emergency Alerts Enabled', 'You will receive notifications for urgent medical requirements.');
      }
    } catch {}
  };

  // Trigger an emergency alert
  const triggerAlert = (alertData, isNew = true) => {
    const id = alertData.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fullAlert = {
      id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      ...alertData,
    };

    setAlerts((prev) => [fullAlert, ...prev.filter((a) => a.id !== id)]);

    // Trigger toast notification for newly detected/simulated alerts
    if (isNew) {
      setActiveToasts((prev) => [fullAlert, ...prev.filter((t) => t.id !== id)].slice(0, 3));

      if (soundEnabled) {
        playAudioChime();
      }

      sendNativeNotification(
        `🚨 BloodFlow-Q: ${fullAlert.title}`,
        `${fullAlert.message} (Urgency: ${fullAlert.severity.toUpperCase()})`,
      );
    }
  };

  // Inspect live scenario data for real urgent/critical demands and blocked routes
  useEffect(() => {
    let mounted = true;

    const checkScenarioAlerts = async () => {
      try {
        const scenario = await api.getScenario();
        if (!mounted || !scenario) return;

        const hospitals = scenario.hospitals || [];
        const routes = scenario.routes || [];

        // 1. Scan for critical/high demands
        hospitals.forEach((h) => {
          const demand = h.demand || {};
          const urgency = h.urgency || {};

          Object.entries(demand).forEach(([group, units]) => {
            const u = urgency[group]?.category || '';
            const qty = Number(units || 0);

            if (qty > 0 && ['critical', 'high'].includes(u)) {
              const alertKey = `demand-${h.id}-${group}`;
              if (!alertedIdsRef.current.has(alertKey)) {
                alertedIdsRef.current.add(alertKey);
                triggerAlert({
                  id: alertKey,
                  severity: u,
                  category: 'demand',
                  title: `${u === 'critical' ? 'CRITICAL' : 'URGENT'}: ${group} Demand at ${h.name || h.id}`,
                  message: `${h.name || h.id} requires ${qty} units of ${group} blood urgently. Prioritized delivery recommended.`,
                  facility: h.name || h.id,
                  bloodGroup: group,
                  units: qty,
                  actionType: 'optimize',
                  actionLabel: 'Solve with Optimizer',
                });
              }
            }
          });
        });

        // 2. Scan for blocked routes
        routes.forEach((r) => {
          if (r.status === 'blocked') {
            const alertKey = `route-${r.source}-${r.destination}`;
            if (!alertedIdsRef.current.has(alertKey)) {
              alertedIdsRef.current.add(alertKey);
              triggerAlert({
                id: alertKey,
                severity: 'high',
                category: 'route',
                title: `Route Disrupted: ${r.source} ➔ ${r.destination}`,
                message: `Corridor from ${r.source} to ${r.destination} is blocked (${r.distance_km} km). Excluded from delivery graph.`,
                actionType: 'emergency',
                actionLabel: 'Simulate Rerouting',
              });
            }
          }
        });
      } catch {
        // Scenario fetch may fail if backend is not started
      }
    };

    checkScenarioAlerts();
    const interval = setInterval(checkScenarioAlerts, 20000); // Check every 20s

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [soundEnabled]);

  // Manually simulate a synthetic urgent emergency request
  const simulateUrgentRequest = () => {
    const scenario = SAMPLE_EMERGENCY_SCENARIOS[Math.floor(Math.random() * SAMPLE_EMERGENCY_SCENARIOS.length)];
    const id = `sim-emerg-${Date.now()}`;
    triggerAlert({
      id,
      severity: 'critical',
      category: 'request',
      title: `🚨 EMERGENCY: ${scenario.facility}`,
      message: `${scenario.reason}. Immediate requirement: ${scenario.units} units of ${scenario.bloodGroup}.`,
      facility: scenario.facility,
      bloodGroup: scenario.bloodGroup,
      units: scenario.units,
      actionType: 'optimize',
      actionLabel: 'Dispatch Optimizer',
    });
  };

  // Execute alert resolution action
  const handleAlertAction = (alert) => {
    // Mark alert as read
    markAsRead(alert.id);
    dismissToast(alert.id);
    setIsOpen(false);

    if (alert.actionType === 'optimize' && onOptimization) {
      if (onNavigate) onNavigate('optimization');
      onOptimization();
    } else if (alert.actionType === 'emergency' && onNavigate) {
      onNavigate('emergency');
    } else if (onNavigate) {
      onNavigate('dashboard');
    }
  };

  const markAsRead = (id) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  const markAllAsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const dismissToast = (id) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const unreadCount = alerts.filter((a) => !a.read).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.read).length;

  return (
    <>
      {/* Topbar Alert Center Bell Icon */}
      <div className="alert-center-wrap" ref={dropdownRef}>
        <button
          className={`alert-bell-btn ${unreadCount > 0 ? 'alert-bell-active' : ''} ${criticalCount > 0 ? 'alert-bell-critical' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`Emergency Alerts: ${unreadCount} active notifications`}
          title={`Emergency Alerts: ${unreadCount} active requirements`}
          aria-expanded={isOpen}
        >
          {criticalCount > 0 ? (
            <Siren size={17} className="bell-siren-icon" />
          ) : unreadCount > 0 ? (
            <BellRing size={17} />
          ) : (
            <Bell size={17} />
          )}

          {unreadCount > 0 && (
            <span className={`alert-badge-pill ${criticalCount > 0 ? 'badge-critical' : ''}`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Alerts Dropdown Drawer */}
        {isOpen && (
          <div className="alert-dropdown" role="dialog" aria-label="Emergency and Urgent Alert Center">
            {/* Dropdown Header */}
            <div className="alert-dropdown-header">
              <div className="alert-dropdown-title">
                <ShieldAlert size={17} className="alert-header-icon" />
                <div>
                  <strong>Emergency Requirement Center</strong>
                  <span className="alert-count-tag">
                    {unreadCount} pending {unreadCount === 1 ? 'alert' : 'alerts'}
                  </span>
                </div>
              </div>

              <div className="alert-header-controls">
                <button
                  className="alert-btn-ghost"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
                  aria-label={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
                >
                  {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </button>
                {unreadCount > 0 && (
                  <button
                    className="alert-btn-ghost"
                    onClick={markAllAsRead}
                    title="Mark all as acknowledged"
                    aria-label="Mark all as acknowledged"
                  >
                    <CheckCheck size={15} />
                  </button>
                )}
                <button
                  className="alert-btn-ghost"
                  onClick={() => setIsOpen(false)}
                  title="Close alert center"
                  aria-label="Close alert center"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="alert-quick-bar">
              <button
                className="alert-sim-btn"
                onClick={simulateUrgentRequest}
                title="Trigger a realistic mass-casualty or urgent requirement to test alert response"
              >
                <Radio size={13} className="pulse-radio" />
                <span>Simulate Inbound Emergency Alert</span>
              </button>

              {!browserNotifEnabled && 'Notification' in window && (
                <button
                  className="alert-browser-btn"
                  onClick={requestBrowserPermission}
                  title="Allow desktop notifications when in other tabs"
                >
                  <Bell size={12} />
                  <span>Enable Desktop Push</span>
                </button>
              )}
            </div>

            {/* Alerts List */}
            <div className="alert-list">
              {alerts.length === 0 ? (
                <div className="alert-empty-state">
                  <div className="alert-empty-icon">
                    <Check size={24} />
                  </div>
                  <strong>All Clear</strong>
                  <p>No critical shortages, urgent patient demands, or route disruptions detected at this time.</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <article
                    key={alert.id}
                    className={`alert-item alert-item-${alert.severity} ${alert.read ? 'alert-read' : 'alert-unread'}`}
                  >
                    <div className="alert-item-top">
                      <div className="alert-item-badge-wrap">
                        <span className={`alert-severity-pill pill-${alert.severity}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="alert-time">{alert.timestamp}</span>
                      </div>
                      {!alert.read && (
                        <button
                          className="alert-ack-btn"
                          onClick={() => markAsRead(alert.id)}
                          title="Acknowledge alert"
                          aria-label="Acknowledge alert"
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </div>

                    <strong className="alert-item-title">{alert.title}</strong>
                    <p className="alert-item-msg">{alert.message}</p>

                    {alert.actionLabel && (
                      <div className="alert-item-actions">
                        <button
                          className="alert-action-pill"
                          onClick={() => handleAlertAction(alert)}
                        >
                          <Zap size={12} />
                          <span>{alert.actionLabel}</span>
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="alert-dropdown-footer">
              <span>Automated telemetry monitor · BloodFlow-Q Operations</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Emergency Toast Banners (Top Right) */}
      <div className="alert-toasts-container" aria-live="assertive" role="alert">
        {activeToasts.map((toast) => (
          <aside
            key={toast.id}
            className={`alert-toast-card toast-${toast.severity}`}
          >
            <div className="alert-toast-icon">
              <Siren size={20} className="toast-siren-anim" />
            </div>
            <div className="alert-toast-content">
              <div className="alert-toast-header">
                <span className={`alert-severity-pill pill-${toast.severity}`}>
                  {toast.severity.toUpperCase()} ALERT
                </span>
                <span className="alert-toast-time">{toast.timestamp}</span>
              </div>
              <strong className="alert-toast-title">{toast.title}</strong>
              <p className="alert-toast-desc">{toast.message}</p>
              {toast.actionLabel && (
                <div className="alert-toast-actions">
                  <button
                    className="alert-toast-btn-action"
                    onClick={() => handleAlertAction(toast)}
                  >
                    <Zap size={12} />
                    <span>{toast.actionLabel}</span>
                  </button>
                  <button
                    className="alert-toast-btn-dismiss"
                    onClick={() => dismissToast(toast.id)}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            <button
              className="alert-toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss alert toast"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </aside>
        ))}
      </div>
    </>
  );
}
