import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  CornerDownLeft,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { askAiAssistant } from '../services/aiAssistant';
import { api } from '../services/api';

const STARTER_PROMPTS = [
  { icon: '🚨', label: 'Check critical unmet demands', query: 'What are our critical unmet demands?' },
  { icon: '🩸', label: 'Inspect O- blood inventory', query: 'Check O- and urgent inventory across blood banks' },
  { icon: '⚛️', label: 'Explain QAOA penalty bounds', query: 'How do QAOA penalty weights and bounds work?' },
  { icon: '📊', label: 'Compare MILP vs Greedy', query: 'Compare MILP, Greedy, and QAOA solvers' },
  { icon: '🛣️', label: 'Inspect blocked routes', query: 'Show blocked distribution routes' },
  { icon: '⚡', label: 'Run greedy optimization', query: 'Run greedy optimization now' },
];

function formatMarkdown(text) {
  if (!text) return '';

  // Simple, safe markdown-to-HTML parser for the chatbot response
  const lines = text.split('\n');
  const elements = [];
  let inTable = false;
  let tableHeader = [];
  let tableRows = [];

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div className="chat-table-wrapper" key={`table-${elements.length}`}>
          <table className="chat-table">
            <thead>
              <tr>
                {tableHeader.map((th, idx) => (
                  <th key={idx}>{th.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((td, cIdx) => (
                    <td key={cIdx}>{renderInline(td.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  };

  const renderInline = (str) => {
    // Bold
    let parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
      }
      // Inline code
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((sub, sIdx) => {
        if (sub.startsWith('`') && sub.endsWith('`')) {
          return <code key={`${pIdx}-${sIdx}`}>{sub.slice(1, -1)}</code>;
        }
        return sub;
      });
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Markdown Table check
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      // Check if separator line
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        inTable = true;
        return;
      }
      if (!inTable) {
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else {
      flushTable();
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 className="chat-heading" key={index}>
          {renderInline(trimmed.slice(4))}
        </h4>,
      );
      return;
    }
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h5 className="chat-subheading" key={index}>
          {renderInline(trimmed.slice(5))}
        </h5>,
      );
      return;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div className="chat-bullet" key={index}>
          <span className="chat-bullet-dot" />
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>,
      );
      return;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(trimmed)) {
      const dotIndex = trimmed.indexOf('.');
      elements.push(
        <div className="chat-numbered" key={index}>
          <strong className="chat-num">{trimmed.slice(0, dotIndex + 1)}</strong>
          <span>{renderInline(trimmed.slice(dotIndex + 1).trim())}</span>
        </div>,
      );
      return;
    }

    // Math block placeholder
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
      elements.push(
        <div className="chat-formula" key={index}>
          <code>{trimmed.slice(2, -2).trim()}</code>
        </div>,
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div className="chat-spacer" key={index} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p className="chat-paragraph" key={index}>
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushTable();
  return elements;
}

export default function Chatbot({
  currentPage,
  currentTheme,
  onNavigate,
  onOptimization,
  onToggleTheme,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenarioContext, setScenarioContext] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am **Q-Bot**, your **BloodFlow-Q Logistics Intelligence Copilot** 🤖.

I monitor your live supply network, solver benchmarks, and transport constraints:
- 🩸 **Inventory & Demand Auditing:** Spot critical blood type deficits (e.g. O-, A+)
- ⚛️ **Quantum Optimization (QAOA):** Explain QUBO formulation, penalty weights, and qubit mappings
- 📊 **Solver Benchmarking:** Compare **MILP (HiGHS)**, **Exact**, and **Greedy** algorithms
- 🚨 **Emergency Simulator:** Advise on route disruptions and demand spikes

Click a prompt below or type your question!`,
      actions: [
        { id: 'act-opt', label: '⚡ Run Quick Optimization', type: 'optimize' },
        { id: 'act-crit', label: '🚨 Check Critical Demands', type: 'query', payload: 'What are our critical unmet demands?' },
        { id: 'act-qaoa', label: '⚛️ QAOA Penalty Bounds', type: 'query', payload: 'How do QAOA penalty weights and bounds work?' },
      ],
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load scenario context on open for up-to-date domain answers
  useEffect(() => {
    if (isOpen && !scenarioContext) {
      api.getScenario().then(setScenarioContext).catch(() => {});
    }
  }, [isOpen, scenarioContext]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (customMessage = null) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build context package for the assistant
      const ctx = {
        currentPage,
        currentTheme,
        scenario: scenarioContext,
      };

      // Formulate conversation history for multi-turn context
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await askAiAssistant(textToSend.trim(), history, ctx);

      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'I analyzed the scenario data, but could not produce a response.',
        actions: res.suggested_actions || [],
        citations: res.data_citations || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Could not complete request: ${err.message || 'Unknown issue'}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action) => {
    if (!action) return;
    if (action.type === 'navigate' && onNavigate && action.payload) {
      onNavigate(action.payload);
    } else if (action.type === 'optimize' && onOptimization) {
      onOptimization();
    } else if (action.type === 'theme' && onToggleTheme) {
      onToggleTheme();
    } else if (action.type === 'query' && action.payload) {
      handleSend(action.payload);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation history cleared. How can I assist with your logistics optimization research today?',
        actions: [
          { id: 'act-opt', label: '⚡ Run Quick Optimization', type: 'optimize' },
          { id: 'act-crit', label: '🚨 Check Critical Demands', type: 'query', payload: 'What are our critical unmet demands?' },
        ],
      },
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          className="chatbot-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open BloodFlow-Q AI Copilot"
          title="Open AI Logistics Copilot"
        >
          <div className="chatbot-fab-pulse" aria-hidden="true" />
          <div className="chatbot-fab-icon-wrap">
            <Bot size={22} strokeWidth={2.2} />
          </div>
          <span className="chatbot-fab-text">AI Copilot</span>
          <span className="chatbot-fab-badge">Q</span>
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <aside
          className={`chatbot-window ${isMaximized ? 'chatbot-window-maximized' : ''}`}
          aria-label="BloodFlow-Q AI Assistant Chat"
          role="region"
        >
          {/* Header */}
          <header className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-avatar">
                <Bot size={18} />
                <span className="chatbot-avatar-dot" title="Online & Context Aware" />
              </div>
              <div className="chatbot-title-group">
                <div className="chatbot-title">
                  <strong>BloodFlow AI Copilot</strong>
                  <span className="chatbot-model-tag">QAOA & Logistics</span>
                </div>
                <div className="chatbot-status-row">
                  <span className="chatbot-live-status">Active Scenario Connected</span>
                  {currentPage && <span className="chatbot-page-pill">Page: {currentPage}</span>}
                </div>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button
                className="chatbot-icon-btn"
                onClick={handleClear}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <RotateCcw size={15} />
              </button>
              <button
                className="chatbot-icon-btn"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? 'Restore window size' : 'Expand window'}
                aria-label={isMaximized ? 'Restore window size' : 'Expand window'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                className="chatbot-icon-btn chatbot-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat window"
                aria-label="Close chat window"
              >
                <X size={17} />
              </button>
            </div>
          </header>

          {/* Quick Starter Prompts */}
          {messages.length <= 2 && (
            <div className="chatbot-starters">
              <div className="chatbot-starters-label">Suggested Research Queries:</div>
              <div className="chatbot-starters-scroll">
                {STARTER_PROMPTS.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    className="chatbot-starter-chip"
                    onClick={() => handleSend(prompt.query)}
                    disabled={loading}
                  >
                    <span>{prompt.icon}</span>
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="chat-msg-avatar" aria-hidden="true">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className="chat-msg-bubble">
                  <div className="chat-msg-body">{formatMarkdown(msg.content)}</div>

                  {/* Action suggestions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="chat-actions-row">
                      {msg.actions.map((act) => (
                        <button
                          key={act.id}
                          className="chat-action-btn"
                          onClick={() => handleAction(act)}
                        >
                          <Zap size={12} />
                          <span>{act.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="chat-citations">
                      {msg.citations.map((c, cIdx) => (
                        <span key={cIdx}>📌 {c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing / Loading indicator */}
            {loading && (
              <div className="chat-message chat-message-assistant">
                <div className="chat-msg-avatar" aria-hidden="true">
                  <Sparkles size={14} />
                </div>
                <div className="chat-msg-bubble chat-typing-bubble">
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-text">Analyzing scenario telemetry…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <footer className="chatbot-footer">
            <form
              className="chatbot-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                ref={inputRef}
                className="chatbot-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about blood inventory, QAOA, MILP, emergencies…"
                disabled={loading}
                aria-label="Message to BloodFlow-Q AI Copilot"
              />
              <button
                className="chatbot-send-btn"
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message"
                title="Send message (Enter)"
              >
                <Send size={15} />
              </button>
            </form>
            <div className="chatbot-footer-note">
              <span>Prototype Copilot · Synthetic optimization research</span>
            </div>
          </footer>
        </aside>
      )}
    </>
  );
}
