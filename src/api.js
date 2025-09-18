// src/api.js
// -----------------------------------------------------------------------------
// Centralized API client with session management + history verification helpers
// -----------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
console.log("[api] BASE =", API_BASE);

// ---- session helpers --------------------------------------------------------
function getOrCreateSessionId() {
  let sid = localStorage.getItem("lifeease-session-id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("lifeease-session-id", sid);
  }
  return sid;
}

function resetSession() {
  localStorage.removeItem("lifeease-session-id");
  return getOrCreateSessionId();
}

// ---- system prompt (optional global override per client) --------------------
const SYSTEM_PROMPT_KEY = "lifeease-system-prompt";
function setSystemPrompt(prompt) {
  if (prompt == null) localStorage.removeItem(SYSTEM_PROMPT_KEY);
  else localStorage.setItem(SYSTEM_PROMPT_KEY, String(prompt));
}
function getSystemPrompt() {
  return localStorage.getItem(SYSTEM_PROMPT_KEY) || "";
}

// ---- core request helper ----------------------------------------------------
/**
 * request(path, { method, headers, body, timeoutMs })
 * - default timeout 30s (override per call)
 * - clear errors for HTTP / timeout / parse
 */
async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30000;
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(API_BASE + path, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} on ${path}: ${text || "No response body"}`);
    }

    const raw = await res.text();
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON from ${path}: ${raw.slice(0, 300)}…`);
    }
  } catch (err) {
    clearTimeout(id);
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms (${path})`);
    }
    throw err;
  }
}

// ---- tiny local "auth" mock (unchanged behavior) ---------------------------
export const api = {
  // ================= AUTH (localStorage simulated) ===========================
  async login({ username, password }) {
    const db = JSON.parse(localStorage.getItem("lifeease-db") || "{}");
    const user = Object.values(db).find(
      (u) =>
        (u.username === username || u.email === username) &&
        u.password === password
    );
    if (!user) throw new Error("Invalid credentials");
    localStorage.setItem("lifeease-user", JSON.stringify(user));
    return user;
  },

  async signup(payload) {
    const db = JSON.parse(localStorage.getItem("lifeease-db") || "{}");
    if (db[payload.email]) throw new Error("Account already exists");

    const user = {
      id: crypto.randomUUID(),
      onboarded: false,
      onboarding: {},
      ...payload,
    };

    db[payload.email] = user;
    localStorage.setItem("lifeease-db", JSON.stringify(db));
    localStorage.setItem("lifeease-user", JSON.stringify(user));
    return user;
  },

  async saveOnboarding(partial) {
    const user = JSON.parse(localStorage.getItem("lifeease-user"));
    const updated = {
      ...user,
      onboarding: { ...(user.onboarding || {}), ...partial },
    };

    localStorage.setItem("lifeease-user", JSON.stringify(updated));
    const db = JSON.parse(localStorage.getItem("lifeease-db") || "{}");
    db[user.email] = updated;
    localStorage.setItem("lifeease-db", JSON.stringify(db));
    return updated;
  },

  async completeOnboarding() {
    const user = JSON.parse(localStorage.getItem("lifeease-user"));
    user.onboarded = true;

    const db = JSON.parse(localStorage.getItem("lifeease-db") || "{}");
    db[user.email] = user;

    localStorage.setItem("lifeease-db", JSON.stringify(db));
    localStorage.setItem("lifeease-user", JSON.stringify(user));
    return user;
  },

  logout() {
    localStorage.removeItem("lifeease-user");
  },

  // Session + System Prompt utilities
  getOrCreateSessionId,
  resetSession,
  setSystemPrompt,
  getSystemPrompt,

  // ================= BACKEND (FastAPI endpoints) =============================
  /** Health check */
  health() {
    return request("/health", { method: "GET", timeoutMs: 5000 });
  },

  /** Analyze text only (JSON payload) */
  analyzeText({ text, timeoutMs = 60000 } = {}) {
    return request("/analyze-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      timeoutMs,
    });
  },

  /** Analyze vision + text (multipart form: single image + optional text)
   * Default timeout: 180s (vision can be slow)
   */
  analyzeVision({ files, text, timeoutMs = 180000 } = {}) {
    const fd = new FormData();
    const first = Array.isArray(files) ? files[0] : files;
    if (first) fd.append("image", first);
    if (text) fd.append("text", text);

    return request("/analyze", {
      method: "POST",
      body: fd,
      timeoutMs,
    });
  },

  /** Smart router */
  analyzeSmart({ text, files, timeoutMs } = {}) {
    const hasFile = Array.isArray(files) ? files.length > 0 : !!files;
    if (hasFile) {
      return this.analyzeVision({ files, text, timeoutMs });
    }
    return this.analyzeText({ text, timeoutMs });
  },

  /** Universal chat with history + persona/system prompt (multipart optional image)
   * Default timeout: 60s (text-only) / 180s (image)
   */
  async sendChat({ text, files, systemPrompt, sessionId, timeoutMs }) {
    const fd = new FormData();
    fd.append("text", text ?? "");
    fd.append("session_id", sessionId ?? getOrCreateSessionId());

    // Prefer per-call prompt; else use stored global prompt; else omit (server uses default)
    const sp = systemPrompt ?? getSystemPrompt();
    if (sp) fd.append("system_prompt", sp);

    const first = Array.isArray(files) ? files[0] : files;
    if (first) fd.append("image", first);

    const finalTimeout = timeoutMs ?? (first ? 180000 : 60000);

    return request("/chat", {
      method: "POST",
      body: fd,
      timeoutMs: finalTimeout,
    });
  },

  /** Convenience: sends chat and logs history details to console */
  async sendChatAndLog(opts) {
    const res = await this.sendChat(opts);
    try {
      console.log("%c[chat] session_id:", "color:#4b9", res.session_id);
      console.log("%c[chat] history length:", "color:#4b9", res.history?.length ?? 0);
      if (Array.isArray(res.history)) {
        console.table(res.history);
      }
    } catch {}
    return res;
  },

  /** Fetch conversation history */
  async getHistory(sessionId) {
    const sid = sessionId ?? getOrCreateSessionId();
    return request(`/history?session_id=${encodeURIComponent(sid)}`, {
      method: "GET",
      timeoutMs: 10000,
    });
  },

  /** Convenience: fetches history and logs it */
  async getHistoryAndLog(sessionId) {
    const sid = sessionId ?? getOrCreateSessionId();
    const res = await this.getHistory(sid);
    try {
      console.log("%c[history] session_id:", "color:#a6c", res.session_id);
      console.log("%c[history] length:", "color:#a6c", res.history?.length ?? 0);
      if (Array.isArray(res.history)) {
        console.table(res.history);
      }
    } catch {}
    return res;
  },

  /** One-call debugger wired to any button (alerts summary + logs table) */
  async debugHistory() {
    const sid = getOrCreateSessionId();
    const res = await this.getHistoryAndLog(sid);
    alert(
      `Session: ${sid}\nTurns: ${res.history?.length ?? 0}\n` +
      (res.history?.length ? `Last: ${JSON.stringify(res.history.at(-1), null, 2)}` : "No history yet.")
    );
    return res;
  },

  // ======== Conversation lifecycle helpers (for closing the expanded chat) ===
  /** Reset only this session's server history (FastAPI /reset-history) */
  async resetServerHistory(sessionId) {
    const sid = sessionId ?? getOrCreateSessionId();
    const fd = new FormData();
    fd.append("session_id", sid);
    return request("/reset-history", {
      method: "POST",
      body: fd,
      timeoutMs: 10000,
    });
  },

  /** End the current conversation: clear server history + rotate client SID */
  async endConversation() {
    const sid = getOrCreateSessionId();
    try { await this.resetServerHistory(sid); } catch {}
    // optional: also clear any custom system prompt override
    // setSystemPrompt(null);
    return resetSession(); // returns the new SID
  },

  // ================= HISTORY VERIFICATION HELPERS ============================
  /**
   * verifyHistoryFlow()
   * 1) Sends two user turns (no image) in a row
   * 2) Confirms assistant replies are appended
   * 3) Fetches history and prints a compact verdict to console
   */
  async verifyHistoryFlow({
    first = "My name is Maya.",
    second = "What is my name?",
    systemPrompt = "",
  } = {}) {
    const sid = getOrCreateSessionId();
    if (systemPrompt) setSystemPrompt(systemPrompt);

    console.log("%c[verify] Using session:", "color:#0aa", sid);

    // Turn 1
    const r1 = await this.sendChatAndLog({ text: first, sessionId: sid });
    if (!r1?.success) {
      console.warn("[verify] First turn blocked by guardrails:", r1?.message);
    }

    // Turn 2
    const r2 = await this.sendChatAndLog({ text: second, sessionId: sid });
    if (!r2?.success) {
      console.warn("[verify] Second turn blocked by guardrails:", r2?.message);
    }

    // Fetch final history and assert structure
    const hist = await this.getHistoryAndLog(sid);
    const h = hist.history || [];
    const lastTwo = h.slice(-4); // expect [user, assistant, user, assistant]

    const roles = lastTwo.map((m) => m.role);
    const hasAssistant = roles.filter((r) => r === "assistant").length >= 1;

    console.log("%c[verify] Last ~4 roles:", "color:#0aa", roles);
    console.log(
      `%c[verify] Assistant present in last 4? ${hasAssistant ? "YES ✅" : "NO ❌"}`,
      `color:${hasAssistant ? "#2da44e" : "#d1242f"}`
    );

    return { session_id: sid, roles, history_length: h.length, ok: hasAssistant };
  },

  /**
   * printSessionAndPayloadHint()
   * Quickly shows current SID and reminds you to check Network tab payloads.
   */
  printSessionAndPayloadHint() {
    const sid = getOrCreateSessionId();
    console.log("%c[current SID]", "color:#888", sid);
    console.log(
      "%c[tip] In DevTools → Network, click your latest /chat → Payload; confirm session_id matches current SID.",
      "color:#888"
    );
    return sid;
  },
};
