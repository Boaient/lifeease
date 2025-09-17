import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";

export default function Home() {
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // messages: { id, type:'user'|'bot', text?, files?: Array<{name,size,ext}> }
  const [messages, setMessages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // File[]
  const inactivity = useRef(null);
  const chatFileRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("active", active);
    return () => document.body.classList.remove("active");
  }, [active]);

  function bumpActive() {
    setActive(true);
    if (inactivity.current) clearTimeout(inactivity.current);
    inactivity.current = setTimeout(() => {
      setActive(false);
      setMicOn(false);
    }, 60000);
  }

  function openSettings() {
    document.getElementById("settings-screen")?.classList.remove("hidden");
  }
  function logout() {
    api.logout();
    window.location.href = "/login";
  }

  function openFloatingChat() {
    setChatOpen(true);
    document.getElementById("active-floating-chat-panel")?.classList.add("open");
  }
  function closeFloatingChat() {
    setChatOpen(false);
    document.getElementById("active-floating-chat-panel")?.classList.remove("open");
  }

  function triggerUploadFromIdle() {
    bumpActive();
    if (!chatOpen) openFloatingChat();
  }

  // ----------------- Utils -----------------
  const formatBytes = (bytes) => {
    if (bytes === 0 || bytes == null) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };
  const fileMeta = (f) => {
    const name = f.name || "file";
    const ext = name.includes(".") ? name.split(".").pop() : "";
    return { name, size: f.size ?? 0, ext: ext.toLowerCase() };
  };

  // ----------------- Attachments (preview in input bar) -----------------
  function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    if (!chatOpen) openFloatingChat();
    bumpActive();

    const picked = Array.from(fileList); // File[]
    setPendingFiles((prev) => [...prev, ...picked]);

    // reset input so re-picking the same file triggers onChange
    if (chatFileRef.current) chatFileRef.current.value = "";
  }

  function removePendingFile(idx) {
    setPendingFiles((prev) => {
      const copy = prev.slice();
      copy.splice(idx, 1);
      return copy;
    });
  }

  // ----------------- Send (text + files) -----------------
  async function sendMessage(rawText) {
    const text = (rawText || "").trim();
    const hasFiles = pendingFiles.length > 0;
    if (!text && !hasFiles) return;

    if (!chatOpen) openFloatingChat();
    bumpActive();

    // capture & clear pending files
    const filesForThisMessage = pendingFiles.slice();
    const filesMeta = filesForThisMessage.map(fileMeta);
    setPendingFiles([]);

    // show the user message with attachments FIRST, then text
    const userMsgId = crypto.randomUUID();
    setMessages((p) => [
      ...p,
      {
        id: userMsgId,
        type: "user",
        text,                 // can be empty (files-only)
        files: hasFiles ? filesMeta : undefined,
      },
    ]);

    // temporary “sending” bubble
    const sendingId = crypto.randomUUID();
    setMessages((p) => [
      ...p,
      { id: sendingId, type: "bot", text: hasFiles ? "⏳ Uploading files…" : "⏳ Thinking…" },
    ]);

    try {
      // IMPORTANT: pass an object; api.js builds FormData when files are present
      const res = await api.analyzeSmart({ text, files: filesForThisMessage });

      let botReply = res?.model_output || "";
      if (typeof botReply === "string" && botReply.includes("assistant")) {
        botReply = botReply.split("assistant").pop().trim();
      }

      const ack =
        hasFiles
          ? `✓ Uploaded ${filesForThisMessage.length} file${filesForThisMessage.length > 1 ? "s" : ""} (${filesMeta
              .map((m) => formatBytes(m.size))
              .join(" + ")})`
          : "✓";

      // replace the sending placeholder with the final reply (+ upload ack)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === sendingId
            ? { ...m, text: botReply ? `${ack}\n\n${botReply}` : ack }
            : m
        )
      );
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === sendingId
            ? { ...m, text: "⚠️ Error reaching server. Please try again." }
            : m
        )
      );
    }
  }

  // ---------- Floating Chat Panel (rendered via Portal to <body>) ----------
  const floatingPanel = (
    <div
      className={`active-floating-chat-panel ${chatOpen ? "open" : ""}`}
      id="active-floating-chat-panel"
    >
      <button className="chat-close-btn" onClick={closeFloatingChat}>
        ×
      </button>

      {/* Messages */}
      <div className="active-floating-chat-messages" style={{ paddingTop: 56 }}>
        {messages.map((m) => (
          <div className={`msg-row ${m.type === "user" ? "user" : "bot"}`} key={m.id}>
            <div className={`msg-bubble ${m.type === "user" ? "user" : "bot"}`}>
              {/* Attachments ABOVE the text (for user bubbles) */}
              {m.files?.length ? (
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {m.files.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="attachment-bubble"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                      >
                        <span className="paperclip">📎</span>
                        <span className="files" title={f.name}>
                          {f.name} {f.size ? `(${formatBytes(f.size)})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {m.text?.length ? (
                <div style={{ whiteSpace: "pre-wrap", marginTop: m.files?.length ? 10 : 0 }}>
                  {m.text}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="active-floating-chat-inputbar" style={{ position: "relative" }}>
        {/* Paperclip with an invisible file input overlayed on top */}
        <div className="upload-wrap" style={{ position: "relative" }}>
          <button type="button" className="upload-btn" title="Upload files">
            <span className="upload-icon">📎</span>
          </button>
          <input
            id="chat-file"
            ref={chatFileRef}
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="upload-overlay-input"
          />
        </div>

        {/* LIVE attachments preview INSIDE the input bar */}
        {pendingFiles.length > 0 && (
          <div
            className="pending-attachments"
            aria-label="Pending attachments"
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              maxWidth: "40%",
              overflowY: "auto",
              padding: "4px 0",
              marginRight: 8,
            }}
          >
            {pendingFiles.map((f, idx) => {
              const m = fileMeta(f);
              return (
                <div
                  key={`${m.name}-${idx}`}
                  className="attachment-bubble"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <span className="paperclip">📎</span>
                  <span className="files" title={m.name}>
                    {m.name} {m.size ? `(${formatBytes(m.size)})` : ""}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => removePendingFile(idx)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                      color: "#6b7280",
                      marginLeft: 4,
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <input
          type="text"
          className="active-floating-chat-input"
          placeholder="Type your message..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = e.currentTarget.value;
              sendMessage(val);
              e.currentTarget.value = "";
            }
          }}
          onInput={bumpActive}
        />
        <button
          className="send-btn"
          title="Send"
          onClick={() => {
            const input = document.querySelector(".active-floating-chat-input");
            const val = input?.value || "";
            sendMessage(val);
            if (input) input.value = "";
          }}
        >
          ↩︎
        </button>
      </div>
    </div>
  );

  // ----------------- Render -----------------
  return (
    <div className="container" id="main-ui">
      <div className="top-bar">
        <img src="/assets/emergency.png" className="icon-button" alt="Emergency" />
      </div>

      <div
        id="idle-background"
        className="idle-bg"
        style={{ backgroundImage: "url('/assets/clean_background.png')" }}
      />

      <div className="avatar-floating-wrapper">
        <img src="/assets/image.jpg" alt="Avatar" className="avatar" id="avatar-img" />
      </div>

      <div
        className="active-mic-button"
        onClick={() => {
          setMicOn(!micOn);
          bumpActive();
        }}
      >
        <img src={micOn ? "/assets/mic-on.jpg" : "/assets/mic-off.jpg"} alt="Mic" />
      </div>

      <div className="main-section" id="main-content">
        <div className="right-panel">
          <div className="chat-box">
            <div className="messages" />
            <input
              type="text"
              className="text-input"
              placeholder="Type your message..."
              onInput={bumpActive}
            />
          </div>
        </div>

        {!chatOpen && (
          <div
            className="active-floating-chat-trigger"
            onClick={() => {
              bumpActive();
              openFloatingChat();
            }}
          >
            <div className="trigger-placeholder">Type your message…</div>
          </div>
        )}
      </div>

      {/* Idle chatbar (unchanged) */}
      <div className="idle-chatbar">
        <button
          type="button"
          className="upload-btn"
          title="Upload files"
          onClick={triggerUploadFromIdle}
        >
          <span className="upload-icon">📎</span>
        </button>

        <input
          type="text"
          className="idle-text-input"
          placeholder="Type your message..."
          onFocus={bumpActive}
        />
        <div className="idle-mic" onClick={bumpActive}>
          <img src="/assets/mic-off.jpg" alt="Mic" />
        </div>
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav">
        <button className="nav-button">☰</button>
        <button className="nav-button">🔍</button>
        <button className="nav-button home active">🏠</button>
        <button className="nav-button">💬</button>
        <button className="nav-button" id="settings-btn" onClick={openSettings}>
          <img src="/assets/settings.png" alt="Settings" className="nav-icon" />
        </button>
      </div>

      {/* Settings */}
      <div className="settings-screen hidden" id="settings-screen">
        <div className="settings-header">
          <span>Settings</span>
          <button
            id="close-settings-screen"
            className="close-settings-btn"
            onClick={() => {
              document.getElementById("settings-screen")?.classList.add("hidden");
            }}
          >
            &times;
          </button>
        </div>
        <div className="settings-menu">
          <div className="settings-item">Account Management</div>
          <div className="settings-item">Display & Accessibility</div>
          <div className="settings-item">Language & Voice</div>
          <div className="settings-item">About</div>
          <div className="settings-item">Help</div>
          <div className="settings-item logout" onClick={logout}>
            Logout
          </div>
        </div>
      </div>

      {/* Render floating panel at <body> root via Portal */}
      {createPortal(floatingPanel, document.body)}
    </div>
  );
}
