import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BookOpenText,
  BellSimple,
  CalendarBlank,
  Check,
  Command,
  CurrencyInr,
  EnvelopeSimple,
  Heartbeat,
  HouseLine,
  ListChecks,
  LockSimple,
  Microphone,
  PaperPlaneTilt,
  Pulse,
  ShieldCheck,
  Sparkle,
  SuitcaseRolling,
  TrendUp,
  UsersThree,
  X
} from "@phosphor-icons/react";
import { StambhCore } from "./components/StambhCore";

type Message = { role: "user" | "assistant"; content: string };

const agenda = [
  { time: "10:30", title: "Product review", meta: "Verdexo · 45 min" },
  { time: "13:00", title: "Deep work block", meta: "Stambh prototype" },
  { time: "17:30", title: "Strength training", meta: "Upper body" }
];

const priorities = [
  { title: "Ship Stambh beta", detail: "Interface, secure model bridge, docs", done: false },
  { title: "Reply to 4 important threads", detail: "2 need decisions", done: false },
  { title: "Review monthly runway", detail: "Due tomorrow", done: true }
];

const signals = [
  { label: "Energy", value: "82", delta: "+6", icon: Heartbeat },
  { label: "Focus", value: "3.4h", delta: "peak 2pm", icon: Pulse },
  { label: "Runway", value: "8.2m", delta: "stable", icon: CurrencyInr },
  { label: "People", value: "5", delta: "to follow up", icon: UsersThree }
];

const lifeSectors = [
  { name: "Communication", metric: "4 important", note: "12 waiting · 2 drafted", icon: EnvelopeSimple, kind: "inbox" },
  { name: "Knowledge", metric: "18 captured", note: "3 ideas resurfaced", icon: BookOpenText, kind: "knowledge" },
  { name: "Projects", metric: "3 active", note: "Stambh beta leads today", icon: TrendUp, kind: "projects" },
  { name: "Home", metric: "All clear", note: "Everything is in its normal range", icon: HouseLine, kind: "home" },
  { name: "Security", metric: "No alerts", note: "Last review · 2 min ago", icon: ShieldCheck, kind: "security" },
  { name: "Travel", metric: "Ready", note: "No upcoming journeys", icon: SuitcaseRolling, kind: "travel" }
];

export function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Good morning. I’ve mapped the day. Two decisions need you; the rest is under control." }
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setChatOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const date = useMemo(
    () => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()),
    []
  );

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const query = input.trim();
    if (!query || busy) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: query }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });
      if (!response.ok) throw new Error("Request failed");
      const data = (await response.json()) as { reply: string };
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "The intelligence bridge is offline. The dashboard is working in preview mode." }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function openChat() {
    setChatOpen(true);
    setListening(false);
    window.setTimeout(() => inputRef.current?.focus(), 200);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Stambh home">
          <span className="wordmark-mark">S</span>
          <span>STAMBH</span>
        </a>
        <div className="date-line">{date}</div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications"><BellSimple size={19} /></button>
          <button className="command-button" onClick={() => setCommandOpen(true)}>
            <Command size={16} /> Command <kbd>⌘ K</kbd>
          </button>
          <button className="profile-button" aria-label="Profile">TB</button>
        </div>
      </header>

      <section className="dashboard" id="top">
        <article className="panel briefing-panel">
          <div className="panel-index">01</div>
          <div>
            <p className="panel-label">Morning intelligence</p>
            <h1>Everything important.<br /><em>Nothing noisy.</em></h1>
          </div>
          <p className="brief-copy">Your day is balanced. Protect the 13:00 focus block; four messages can wait until evening.</p>
          <button className="text-action" onClick={openChat}>Open briefing <ArrowRight size={17} /></button>
        </article>

        <article className="panel agenda-panel">
          <div className="panel-head">
            <span><CalendarBlank size={18} /> Today</span>
            <button>View calendar</button>
          </div>
          <div className="agenda-list">
            {agenda.map((item, index) => (
              <div className={`agenda-item ${index === 1 ? "accent" : ""}`} key={item.time}>
                <time>{item.time}</time>
                <div><strong>{item.title}</strong><span>{item.meta}</span></div>
              </div>
            ))}
          </div>
        </article>

        <section className="core-panel" aria-label="Stambh intelligence core">
          <div className="core-status"><span /> 7 systems connected</div>
          <StambhCore active={listening} onActivate={() => setListening((value) => !value)} />
          <button className="ask-button" onClick={openChat}><Sparkle size={18} weight="fill" /> Ask Stambh</button>
        </section>

        <article className="panel priorities-panel">
          <div className="panel-head">
            <span><ListChecks size={18} /> Priorities</span>
            <small>2 remaining</small>
          </div>
          <div className="priority-list">
            {priorities.map((item) => (
              <button className="priority-item" key={item.title}>
                <span className={`check ${item.done ? "checked" : ""}`}>{item.done && <Check size={12} weight="bold" />}</span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              </button>
            ))}
          </div>
        </article>

        <article className="panel signal-panel">
          <div className="panel-head"><span>Life signals</span><small>Live overview</small></div>
          <div className="signal-grid">
            {signals.map(({ label, value, delta, icon: Icon }) => (
              <div className="signal" key={label}>
                <Icon size={17} />
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{delta}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel attention-panel">
          <div className="panel-index">02</div>
          <p className="panel-label">Needs your attention</p>
          <div className="attention-count">2</div>
          <p>One decision from your product review and one personal follow-up.</p>
          <button className="text-action" onClick={openChat}>Resolve with Stambh <ArrowRight size={17} /></button>
        </article>
      </section>

      <section className="life-map" aria-labelledby="life-map-title">
        <div className="sector-toolbar">
          <div><span className="online-dot" /><strong id="life-map-title">Sectors</strong><small>{lifeSectors.length} active</small></div>
          <button onClick={() => setCommandOpen(true)}>Edit layout <ArrowRight size={15} /></button>
        </div>
        <div className="sector-board">
          {lifeSectors.map(({ name, metric, note, icon: Icon, kind }) => (
            <button className={`sector-widget ${kind}`} key={name} onClick={() => { setChatOpen(true); setInput(`Give me a briefing for ${name.toLowerCase()}`); }}>
              <div className="sector-top"><span><Icon size={17} />{name}</span><small>Open</small></div>
              <div className="sector-summary"><strong>{metric}</strong><p>{note}</p></div>
              {kind === "inbox" && <div className="inbox-visual"><i /><i /><i /><span>+9</span></div>}
              {kind === "knowledge" && <div className="knowledge-visual"><small>RESURFACED</small><p>“Build memory around decisions, not documents.”</p></div>}
              {kind === "projects" && <div className="project-visual"><span><i style={{ width: "76%" }} />Stambh</span><span><i style={{ width: "48%" }} />Verdexo</span><span><i style={{ width: "22%" }} />Personal OS</span></div>}
              {kind === "home" && <div className="home-visual"><span><small>Climate</small><strong>23°</strong></span><span><small>Devices</small><strong>06</strong></span><span><small>Due</small><strong>01</strong></span></div>}
              {kind === "security" && <div className="security-visual"><div><ShieldCheck size={28} weight="light" /><strong>Protected</strong></div><span><i />Identity<small>Clear</small></span><span><i />Devices<small>3 trusted</small></span></div>}
              {kind === "travel" && <div className="travel-visual"><div><span>DEL</span><i /><SuitcaseRolling size={16} /><i /><span>OPEN</span></div><p><span>Passport</span><strong>Valid through 2029</strong></p></div>}
              <ArrowRight className="sector-arrow" size={18} />
            </button>
          ))}
        </div>
      </section>

      <footer className="footer-strip">
        <span><LockSimple size={15} /> Private by design</span>
        <span>MODEL · PREVIEW ROUTER</span>
        <span>STAMBH 0.1 BETA</span>
      </footer>

      <AnimatePresence>
        {chatOpen && (
          <motion.aside className="chat-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}>
            <div className="chat-head">
              <div><span className="online-dot" /><strong>Stambh</strong><small>Personal intelligence</small></div>
              <button className="icon-button" onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={20} /></button>
            </div>
            <div className="messages">
              {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}>{message.content}</div>)}
              {busy && <div className="message assistant typing"><i /><i /><i /></div>}
            </div>
            <form className="composer" onSubmit={sendMessage}>
              <button type="button" className={`mic-button ${listening ? "active" : ""}`} onClick={() => setListening((value) => !value)} aria-label="Voice input"><Microphone size={19} /></button>
              <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything, or give Stambh a task…" />
              <button type="submit" className="send-button" aria-label="Send"><PaperPlaneTilt size={18} weight="fill" /></button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commandOpen && (
          <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setCommandOpen(false)}>
            <motion.div className="command-palette" initial={{ opacity: 0, y: -18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="command-search"><Command size={20} /><input autoFocus placeholder="What do you want Stambh to do?" /></div>
              <div className="command-options">
                {[
                  "Prepare my full morning briefing",
                  "Show messages that need a decision",
                  "Protect two hours for deep work",
                  "Summarise this week across every life sector"
                ].map((option, index) => <button key={option} onClick={() => { setCommandOpen(false); setChatOpen(true); setInput(option); }}><span>0{index + 1}</span>{option}<ArrowRight size={16} /></button>)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
