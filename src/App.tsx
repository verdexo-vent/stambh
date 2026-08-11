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
  ListChecks,
  LockSimple,
  Microphone,
  PaperPlaneTilt,
  Pulse,
  Sparkle,
  TrendUp,
  UsersThree,
  X
} from "@phosphor-icons/react";
import { StambhCore } from "./components/StambhCore";

type Message = { role: "user" | "assistant"; content: string };
type SystemStatus = {
  status: "ok";
  startedAt: string;
  uptimeSeconds: number;
  provider: string;
  runtime: string;
  modelConfigured: boolean;
  access: string;
  connectors: number;
};
type CalendarStatus = { configured: boolean; connected: boolean; access: "read-only" };
type CalendarEvent = { id: string; title: string; start?: string; end?: string; allDay: boolean; location?: string };

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
  { name: "Projects", metric: "3 active", note: "Stambh beta leads today", icon: TrendUp, kind: "projects" }
];

export function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemBusy, setSystemBusy] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
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

  async function refreshCalendar() {
    try {
      const statusResponse = await fetch("/api/calendar/status", { cache: "no-store" });
      const status = await statusResponse.json() as CalendarStatus;
      setCalendarStatus(status);
      if (status.connected) {
        const eventsResponse = await fetch("/api/calendar/events", { cache: "no-store" });
        if (eventsResponse.ok) setCalendarEvents(((await eventsResponse.json()) as { events: CalendarEvent[] }).events);
      }
    } catch { setCalendarStatus(null); }
  }

  useEffect(() => { void refreshCalendar(); }, []);

  async function refreshSystem() {
    setSystemBusy(true);
    try {
      const response = await fetch("/api/system", { cache: "no-store" });
      if (!response.ok) throw new Error("System check failed");
      setSystemStatus((await response.json()) as SystemStatus);
    } catch {
      setSystemStatus(null);
    } finally {
      setSystemBusy(false);
    }
  }

  useEffect(() => {
    if (controlOpen) void refreshSystem();
  }, [controlOpen]);

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
          <button className="profile-button" onClick={() => setControlOpen(true)} aria-label="Open control room">TB</button>
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
            <button onClick={() => calendarStatus?.connected ? void refreshCalendar() : window.location.assign("/api/calendar/connect")}>{calendarStatus?.connected ? "Refresh" : "Connect"}</button>
          </div>
          <div className="agenda-list">
            {calendarStatus?.connected && calendarEvents.length === 0 && <div className="agenda-item"><time>—</time><div><strong>No events today</strong><span>Your calendar is clear.</span></div></div>}
            {!calendarStatus?.connected && <div className="agenda-item"><time>—</time><div><strong>Calendar not connected</strong><span>Read-only access; Stambh cannot edit events.</span></div></div>}
            {calendarEvents.map((item, index) => (
              <div className={`agenda-item ${index === 1 ? "accent" : ""}`} key={item.id}>
                <time>{item.allDay ? "ALL DAY" : item.start ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.start)) : "—"}</time>
                <div><strong>{item.title}</strong><span>{item.location ?? "Google Calendar"}</span></div>
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
        {controlOpen && (
          <motion.aside className="control-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}>
            <div className="control-head">
              <div><span className="online-dot" /><strong>Control room</strong><small>Private system status</small></div>
              <button className="icon-button" onClick={() => setControlOpen(false)} aria-label="Close control room"><X size={20} /></button>
            </div>
            <div className="control-body">
              <div className="control-hero"><span>STAMBH / {systemStatus?.runtime ?? "checking"}</span><strong>{systemStatus ? "Operational" : "Checking system"}</strong><p>{systemStatus ? "The server is responding. This panel never displays credentials." : "Connecting to the local service plane…"}</p></div>
              <div className="control-grid">
                <div className="control-cell"><small>Application</small><strong>{systemStatus?.status === "ok" ? "Online" : "Unknown"}</strong><span>{systemStatus ? `Uptime ${Math.floor(systemStatus.uptimeSeconds / 60)} min` : "Awaiting response"}</span></div>
                <div className="control-cell"><small>Model bridge</small><strong>{systemStatus?.modelConfigured ? "Configured" : "Preview"}</strong><span>{systemStatus?.provider ?? "No provider detected"}</span></div>
                <div className="control-cell"><small>Access</small><strong>{systemStatus?.access === "tailnet" ? "Tailnet" : "Private"}</strong><span>HTTPS route protected</span></div>
                <div className="control-cell"><small>Connectors</small><strong>{systemStatus?.connectors ?? 0}</strong><span>Calendar, mail and memory next</span></div>
              </div>
              <section className="control-section"><div className="control-section-head"><strong>System checks</strong><button onClick={() => { void refreshSystem(); void refreshCalendar(); }} disabled={systemBusy}>{systemBusy ? "Checking…" : "Run check"}</button></div><div className="check-line"><span className={systemStatus ? "status-dot good" : "status-dot"} /> API service <small>{systemStatus ? "Responding" : "Not verified"}</small></div><div className="check-line"><span className={systemStatus?.modelConfigured ? "status-dot good" : "status-dot"} /> Intelligence bridge <small>{systemStatus?.modelConfigured ? "Credential present" : "Not configured"}</small></div><div className="check-line"><span className={calendarStatus?.connected ? "status-dot good" : "status-dot"} /> Google Calendar <small>{calendarStatus?.connected ? "Connected · read only" : calendarStatus?.configured ? "Ready to authorize" : "Not configured"}</small></div></section>
              <section className="control-section roadmap"><span>{calendarStatus?.connected ? "Connected service" : "Next recommended connection"}</span><strong>Google Calendar · read only</strong><p>{calendarStatus?.connected ? "Today’s agenda is now drawn from your calendar. Stambh cannot create, edit, or delete events." : "Let Stambh understand your day before it is allowed to change anything."}</p>{!calendarStatus?.connected && <button onClick={() => window.location.assign("/api/calendar/connect")}>Connect securely <ArrowRight size={16} /></button>}</section>
            </div>
          </motion.aside>
        )}
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
