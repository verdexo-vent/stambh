import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Brain,
  BookOpenText,
  BellSimple,
  CalendarBlank,
  Check,
  Command,
  EnvelopeSimple,
  ListChecks,
  LockSimple,
  Microphone,
  PaperPlaneTilt,
  Plus,
  Pulse,
  SpeakerHigh,
  Sparkle,
  TrendUp,
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
type CalendarEvent = { id: string; title: string; start?: string; end?: string; allDay: boolean; location?: string; calendar?: string };
type Task = { id: string; title: string; detail?: string; completed: boolean; createdAt: string };
type Memory = { id: string; text: string; createdAt: string };
type Activity = { id: string; kind: string; action: string; createdAt: string };
type Briefing = { headline: string; summary: string; generatedAt: string };
type RecognitionResult = { results: ArrayLike<{ 0: { transcript: string } }> };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: RecognitionResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionConstructor = new () => Recognition;

const lifeSectors = [
  { name: "Communication", metric: "Not connected", note: "Mail access remains off", icon: EnvelopeSimple, kind: "inbox" },
  { name: "Knowledge", metric: "Private memory", note: "Stored only on bulk", icon: BookOpenText, kind: "knowledge" },
  { name: "Projects", metric: "Local workspace", note: "Tasks and decisions in one place", icon: TrendUp, kind: "projects" }
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [taskDraft, setTaskDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem("stambh-chat") ?? "") as Message[]; }
    catch { return [{ role: "assistant", content: "Good morning. I’m online. Your private context remains on bulk." }]; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);

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
        const eventsResponse = await fetch("/api/calendar/events?days=7", { cache: "no-store" });
        if (eventsResponse.ok) setCalendarEvents(((await eventsResponse.json()) as { events: CalendarEvent[] }).events);
      }
    } catch { setCalendarStatus(null); }
  }

  useEffect(() => { void refreshCalendar(); }, []);

  async function refreshPersonal() {
    try {
      const [tasksResponse, memoryResponse, activityResponse, briefingResponse] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }), fetch("/api/memory", { cache: "no-store" }),
        fetch("/api/activity", { cache: "no-store" }), fetch("/api/briefing", { cache: "no-store" })
      ]);
      if (tasksResponse.ok) setTasks(((await tasksResponse.json()) as { tasks: Task[] }).tasks);
      if (memoryResponse.ok) setMemories(((await memoryResponse.json()) as { memories: Memory[] }).memories);
      if (activityResponse.ok) setActivity(((await activityResponse.json()) as { activity: Activity[] }).activity);
      if (briefingResponse.ok) setBriefing(await briefingResponse.json() as Briefing);
    } catch { /* Local personal service can recover on the next refresh. */ }
  }

  useEffect(() => { void refreshPersonal(); }, []);
  useEffect(() => { localStorage.setItem("stambh-chat", JSON.stringify(messages.slice(-40))); }, [messages]);

  async function addTask(event: FormEvent) {
    event.preventDefault(); const title = taskDraft.trim(); if (!title) return;
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (response.ok) { setTaskDraft(""); await refreshPersonal(); }
  }

  async function toggleTask(task: Task) {
    const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !task.completed }) });
    if (response.ok) await refreshPersonal();
  }

  async function saveMemory(event: FormEvent) {
    event.preventDefault(); const text = memoryDraft.trim(); if (!text) return;
    const response = await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (response.ok) { setMemoryDraft(""); await refreshPersonal(); }
  }

  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const voiceWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Constructor) { setMessages((current) => [...current, { role: "assistant", content: "Voice input is not available in this browser. Chrome usually supports it." }]); return; }
    const recognition = new Constructor(); recognition.lang = "en-IN"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { setInput(event.results[0]?.[0]?.transcript ?? ""); setChatOpen(true); };
    recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition; setListening(true); recognition.start();
  }

  function speakLatest() {
    const text = [...messages].reverse().find((message) => message.role === "assistant")?.content;
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

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
  useEffect(() => { void refreshSystem(); }, []);

  const date = useMemo(
    () => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()),
    []
  );
  const liveSignals = [
    { label: "Server", value: systemStatus?.status === "ok" ? "UP" : "—", delta: systemStatus ? `${Math.floor(systemStatus.uptimeSeconds / 60)}m` : "check", icon: Pulse },
    { label: "Calendar", value: calendarStatus?.connected ? "ON" : "—", delta: "read only", icon: CalendarBlank },
    { label: "Tasks", value: String(tasks.filter((task) => !task.completed).length), delta: "open", icon: ListChecks },
    { label: "Memory", value: String(memories.length), delta: "local", icon: Brain }
  ];
  const connectedSystems = 1 + (calendarStatus?.connected ? 1 : 0);

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
          <p className="brief-copy">{briefing ? `${briefing.headline} ${briefing.summary}` : "Building your private briefing from Calendar and local priorities…"}</p>
          <button className="text-action" onClick={openChat}>Open briefing <ArrowRight size={17} /></button>
        </article>

        <article className="panel agenda-panel">
          <div className="panel-head">
            <span><CalendarBlank size={18} /> Next 7 days</span>
            <button onClick={() => calendarStatus?.connected ? void refreshCalendar() : window.location.assign("/api/calendar/connect")}>{calendarStatus?.connected ? "Refresh" : "Connect"}</button>
          </div>
          <div className="agenda-list">
            {calendarStatus?.connected && calendarEvents.length === 0 && <div className="agenda-item"><time>—</time><div><strong>No upcoming events</strong><span>Your next seven days are clear.</span></div></div>}
            {!calendarStatus?.connected && <div className="agenda-item"><time>—</time><div><strong>Calendar not connected</strong><span>Read-only access; Stambh cannot edit events.</span></div></div>}
            {calendarEvents.map((item, index) => (
              <div className={`agenda-item ${index === 1 ? "accent" : ""}`} key={item.id}>
                <time>{item.start ? new Intl.DateTimeFormat("en-IN", item.allDay ? { weekday: "short", day: "2-digit" } : { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.start)) : "—"}</time>
                <div><strong>{item.title}</strong><span>{item.location ?? item.calendar ?? "Google Calendar"}</span></div>
              </div>
            ))}
          </div>
        </article>

        <section className="core-panel" aria-label="Stambh intelligence core">
          <div className="core-status"><span /> {connectedSystems} {connectedSystems === 1 ? "system" : "systems"} connected</div>
          <StambhCore active={listening} onActivate={toggleVoice} />
          <button className="ask-button" onClick={openChat}><Sparkle size={18} weight="fill" /> Ask Stambh</button>
        </section>

        <article className="panel priorities-panel">
          <div className="panel-head">
            <span><ListChecks size={18} /> Priorities</span>
            <small>{tasks.filter((task) => !task.completed).length} remaining</small>
          </div>
          <div className="priority-list">
            {tasks.length === 0 && <div className="priority-empty">Your board is clear. Add the next concrete thing.</div>}
            {tasks.slice(0, 4).map((item) => (
              <button className="priority-item" key={item.id} onClick={() => void toggleTask(item)}>
                <span className={`check ${item.completed ? "checked" : ""}`}>{item.completed && <Check size={12} weight="bold" />}</span>
                <span><strong>{item.title}</strong><small>{item.detail ?? (item.completed ? "Completed" : "Stored privately on bulk")}</small></span>
              </button>
            ))}
          </div>
          <form className="quick-add" onSubmit={addTask}><Plus size={15} /><input value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} placeholder="Add a priority" aria-label="Add a priority" /></form>
        </article>

        <article className="panel signal-panel">
          <div className="panel-head"><span>Life signals</span><small>Live overview</small></div>
          <div className="signal-grid">
            {liveSignals.map(({ label, value, delta, icon: Icon }) => (
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
          <div className="attention-count">{tasks.filter((task) => !task.completed).length}</div>
          <p>{tasks.find((task) => !task.completed)?.title ?? "Nothing requires action right now."}</p>
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
              {kind === "knowledge" && <div className="knowledge-visual"><small>PRIVATE MEMORY</small><p>{memories[0]?.text ?? "Save the decisions and preferences Stambh should remember."}</p></div>}
              {kind === "projects" && <div className="knowledge-visual"><small>LOCAL TASK BOARD</small><p>{tasks.filter((task) => !task.completed).length ? `${tasks.filter((task) => !task.completed).length} open priorities are being tracked.` : "No projects inferred until you add real priorities."}</p></div>}
              <ArrowRight className="sector-arrow" size={18} />
            </button>
          ))}
        </div>
      </section>

      <footer className="footer-strip">
        <span><LockSimple size={15} /> Private by design</span>
        <span>MODEL · PREVIEW ROUTER</span>
        <span>STAMBH 0.2 PRIVATE BETA</span>
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
                <div className="control-cell"><small>Private context</small><strong>{tasks.length + memories.length}</strong><span>{tasks.length} tasks · {memories.length} memories</span></div>
              </div>
              <section className="control-section"><div className="control-section-head"><strong>System checks</strong><button onClick={() => { void refreshSystem(); void refreshCalendar(); }} disabled={systemBusy}>{systemBusy ? "Checking…" : "Run check"}</button></div><div className="check-line"><span className={systemStatus ? "status-dot good" : "status-dot"} /> API service <small>{systemStatus ? "Responding" : "Not verified"}</small></div><div className="check-line"><span className={systemStatus?.modelConfigured ? "status-dot good" : "status-dot"} /> Intelligence bridge <small>{systemStatus?.modelConfigured ? "Credential present" : "Not configured"}</small></div><div className="check-line"><span className={calendarStatus?.connected ? "status-dot good" : "status-dot"} /> Google Calendar <small>{calendarStatus?.connected ? "Connected · read only" : calendarStatus?.configured ? "Ready to authorize" : "Not configured"}</small></div></section>
              <section className="control-section memory-control"><span>Private memory · local only</span><form onSubmit={saveMemory}><Brain size={16} /><input value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} placeholder="Remember a preference or decision…" aria-label="Save a private memory" /><button type="submit">Save</button></form><p>Saved on bulk. It is not automatically sent to Cloudflare.</p></section>
              <section className="control-section"><div className="control-section-head"><strong>Recent activity</strong><small>Audit trail</small></div>{activity.length === 0 && <p className="empty-copy">No local actions recorded yet.</p>}{activity.slice(0, 5).map((item) => <div className="activity-line" key={item.id}><span>{item.kind}</span><strong>{item.action}</strong><time>{new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time></div>)}</section>
              <section className="control-section roadmap"><span>Approval gate armed</span><strong>External actions require you</strong><p>Calendar is read-only. Future email, calendar, and file changes will pause for an explicit approval before execution.</p>{!calendarStatus?.connected && <button onClick={() => window.location.assign("/api/calendar/connect")}>Connect Calendar <ArrowRight size={16} /></button>}</section>
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
              <button type="button" className={`mic-button ${listening ? "active" : ""}`} onClick={toggleVoice} aria-label="Voice input"><Microphone size={19} /></button>
              <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything, or give Stambh a task…" />
              <div className="composer-actions"><button type="button" className="speak-button" onClick={speakLatest} aria-label="Read latest response"><SpeakerHigh size={17} /></button><button type="submit" className="send-button" aria-label="Send"><PaperPlaneTilt size={18} weight="fill" /></button></div>
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
