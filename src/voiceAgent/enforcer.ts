// Enforcer v2 — Firebase-ready (client-side)
// Enforces: user-only barge-in, turn-taking vs inactivity, routing, KB auto-use + Select All,
// transcript color-coding, latency metrics, and emits a call summary you can POST to Firebase Function.

type Role = 'user' | 'agent';
type Route = 'sales_pitch' | 'support_faq';

export interface TTSEngine {
  isPlaying(): boolean;
  stop(): void;                      // must hard-stop quickly
  on(e: 'start' | 'end', cb: () => void): void;
}
export interface ASREngine {
  resume(): void;                    // keep mic hot
  on(e: 'partial' | 'final', cb: (text: string) => void): void;
}
export interface VADEngine {
  on(e: 'speechStart' | 'speechEnd' | 'silenceFor', cb: (ms?: number) => void): void;
  enableAEC?(): void; enableNS?(): void; enableAGC?(): void;
}

export interface KnowledgeBase {
  retrieve(p: { product: string; selectedFileIds?: string[]; max?: number; rerank?: boolean })
    : Promise<{ id: string; text: string }[]>;
}

export interface Router {
  route(text: string): Route;
}

export interface UI {
  renderTranscript(msg: { role: Role; text: string; ts?: string }): void;
  setTranscriptClasses?(c: { userClass: string; agentClass: string }): void;
}

export interface CallLifecycle {
  on(e: 'end', cb: () => void): void;
  getIds(): { call_id: string; lead_id?: string };
  getMediaUrls?(): { audio_url?: string; transcript_url?: string };  // optional
}

export interface PersistClient {
  // You will implement this using a Firebase HTTPS Callable/Function (see section B).
  persistCallSummary(payload: {
    call_id: string; lead_id?: string;
    audio_url?: string; transcript_url?: string;
    summary: string; metrics: Record<string, any>;
  }): Promise<void>;
}

export function initVoiceAgentEnforcerV2(deps: {
  tts: TTSEngine; asr: ASREngine; vad: VADEngine;
  kb: KnowledgeBase; router: Router; ui: UI;
  call: CallLifecycle; persist: PersistClient;
  resolveProduct(): string; resolveSelectedKBIds?(): string[] | undefined;
}) {
  const { tts, asr, vad, kb, router, ui, call, persist, resolveProduct, resolveSelectedKBIds } = deps;

  // ---- Config (tunable) ----
  let SILENCE_TRIGGER_MS = 50;     // clamp to engine min if needed (turn-taking)
  let VAD_HANGOVER_MS    = 60;     // avoid mid-phoneme cuts
  let INACTIVITY_MS      = 3000;   // one reminder after agent speaks
  let MAX_REMINDERS      = 1;
  let KB_MAX_CHUNKS      = 6;
  let KB_AUTO_RETRIEVE   = true;
  let KB_RERANK          = true;
  let BARGE_IN_ENABLED   = true;
  let COLOR_CODING_ENABLED = true;

  const BANNED = [
    'should I use the knowledge base',
    'do you want me to check the KB',
    'I cannot access the KB unless you allow'
  ];

  // ---- State ----
  let userSpeaking = false;
  let awaitingAgentTurn = false;
  let awaitingUserInput = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let reminders = 0;
  let lastUserText = '';

  const metrics = {
    bargeInCutoffMs: [] as number[],
    firstResponseMs: [] as number[],
    remindersDuringTTS: 0,
    remindersDuringSpeech: 0,
    pings: [] as number[], // use for additional timing if needed
  };

  // ---- UI role classes (pointer #5) ----
  if (COLOR_CODING_ENABLED) {
    ui.setTranscriptClasses?.({ userClass: 'user-line', agentClass: 'agent-line' });
  }

  // ---- Quality front-end: enable AEC/NS/AGC if supported ----
  vad.enableAEC?.(); vad.enableNS?.(); vad.enableAGC?.();

  // ---- TTS lifecycle (arms inactivity timer) ----
  tts.on('start', () => { awaitingUserInput = false; clearIdle(); });
  tts.on('end',   () => { awaitingUserInput = true; armIdle(); });

  // ---- VAD: barge-in + turn-taking ----
  vad.on('speechStart', () => {
    userSpeaking = true;
    clearIdle();                         // never remind during speech
    if (BARGE_IN_ENABLED && tts.isPlaying()) { // user-only barge-in
      const t0 = performance.now?.() ?? Date.now();
      tts.stop();
      const t1 = performance.now?.() ?? Date.now();
      metrics.bargeInCutoffMs.push(t1 - t0);
    }
    asr.resume();                        // keep mic hot
  });

  vad.on('speechEnd', () => { userSpeaking = false; awaitingAgentTurn = true; });

  vad.on('silenceFor', (ms?: number) => {
    const m = ms ?? 0;
    if (awaitingAgentTurn && !tts.isPlaying() && m >= (SILENCE_TRIGGER_MS + VAD_HANGOVER_MS)) {
      awaitingAgentTurn = false;
      void respondGrounded();
    }
    // inactivity is handled strictly by the timer after agent finishes speaking
  });

  // ---- ASR capture ----
  asr.on('final', (txt) => {
    lastUserText = txt;
    ui.renderTranscript({ role: 'user', text: txt, ts: new Date().toISOString() });
  });

  // ---- Inactivity reminder ----
  function armIdle() {
    if (!awaitingUserInput) return;
    clearIdle();
    idleTimer = setTimeout(() => {
      if (tts.isPlaying()) { metrics.remindersDuringTTS++; return; }
      if (userSpeaking)   { metrics.remindersDuringSpeech++; return; }
      if (reminders >= MAX_REMINDERS)   return;
      reminders++;
      ui.renderTranscript({ role: 'agent', text: 'Just checking—shall I proceed?', ts: new Date().toISOString() });
    }, INACTIVITY_MS);
  }
  function clearIdle() { if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; } }

  // ---- Grounded response using KB + routing ----
  async function respondGrounded() {
    const tStart = performance.now?.() ?? Date.now();
    const product = resolveProduct();
    const selected = resolveSelectedKBIds?.();
    
    let docs: { id: string, text: string }[] = [];
    if(KB_AUTO_RETRIEVE) {
      docs = await kb.retrieve({ product, selectedFileIds: selected, max: KB_MAX_CHUNKS, rerank: KB_RERANK });
    }

    const route = router.route((lastUserText || '').toLowerCase());
    const reply = sanitizeNLG(makeReply(route, docs.length));
    ui.renderTranscript({ role: 'agent', text: reply, ts: new Date().toISOString() });

    const tEnd = performance.now?.() ?? Date.now();
    metrics.firstResponseMs.push(tEnd - tStart);
  }

  function sanitizeNLG(s: string) {
    let out = s;
    BANNED.forEach(b => out = out.replace(new RegExp(b, 'ig'), ''));
    return out;
  }
  function makeReply(route: Route, docCount: number) {
    if (route === 'sales_pitch') {
      return `Here’s the best plan for you. (Grounded on ${docCount} KB docs.) Shall I proceed?`;
    }
    return `Let’s solve this. Based on ${docCount} KB docs, here are the steps…`;
  }

  // ---- Persist on call end (dashboard) ----
  call.on('end', async () => {
    const { call_id, lead_id } = call.getIds();
    const urls = call.getMediaUrls?.() || {};
    await persist.persistCallSummary({
      call_id, lead_id,
      audio_url: urls.audio_url, transcript_url: urls.transcript_url,
      summary: 'Saved by Enforcer v2',
      metrics: {
        bargeIn_avg_ms: avg(metrics.bargeInCutoffMs),
        bargeIn_p95_ms: p95(metrics.bargeInCutoffMs),
        firstResp_avg_ms: avg(metrics.firstResponseMs),
        firstResp_p95_ms: p95(metrics.firstResponseMs),
        remindersDuringTTS: metrics.remindersDuringTTS,
        remindersDuringSpeech: metrics.remindersDuringSpeech,
      }
    });
  });

  // helpers
  function avg(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
  function p95(a: number[]) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(0.95 * (s.length - 1))]; }
  
  // Controller for applying patches
  return {
    setBargeIn: (v: boolean) => BARGE_IN_ENABLED = v,
    setSilence: (turnMs: number, hangMs: number) => {
        SILENCE_TRIGGER_MS = turnMs;
        VAD_HANGOVER_MS = hangMs;
    },
    setInactivity: (ms: number, repeats: number) => {
        INACTIVITY_MS = ms;
        MAX_REMINDERS = repeats;
    },
    setKB: (auto: boolean, max: number, rerank: boolean) => {
        KB_AUTO_RETRIEVE = auto;
        KB_MAX_CHUNKS = max;
        KB_RERANK = rerank;
    },
    setTranscriptColors: (v: boolean) => {
      COLOR_CODING_ENABLED = v;
      if (v) {
        ui.setTranscriptClasses?.({ userClass: 'user-line', agentClass: 'agent-line' });
      } else {
        ui.setTranscriptClasses?.({ userClass: '', agentClass: '' });
      }
    }
  };
}
