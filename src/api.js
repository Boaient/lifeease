// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
console.log("[api] BASE =", API_BASE);

async function request(path, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const res = await fetch(API_BASE + path, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${path} failed (${res.status}): ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
}

export const api = {
  // ========== AUTH (localStorage simulated for now) ==========
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

  // ========== BACKEND (E2E FastAPI endpoints) ==========
  /** Health check */
  health() {
    return request("/health", { method: "GET", timeoutMs: 5000 });
  },

  /** Analyze text only (JSON payload) */
  analyzeText({ text }) {
    return request("/analyze-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  },

  /** Analyze vision + text (multipart form: image + optional text) */
  analyzeVision({ files, text }) {
    const fd = new FormData();
    (files || []).forEach((f) => fd.append("image", f));
    if (text) fd.append("text", text);

    return fetch(`${API_BASE}/analyze`, {
      method: "POST",
      body: fd,
    }).then((res) => {
      if (!res.ok) throw new Error("Analyze vision failed");
      return res.json();
    });
  },

  /** Smart router: decides between text-only vs vision+text */
  analyzeSmart({ text, files }) {
    if (files && files.length) {
      return this.analyzeVision({ files, text });
    }
    return this.analyzeText({ text });
  },
};
