import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";

/* ---- Sidebar Stepper ---- */
function Sidebar({ idx, go }) {
  const labels = [
    "Role",
    "Basics",
    "Language & Voice",
    "Reminders",
    "Safety",
    "Devices",
    "Consent",
  ];
  return (
    <div className="sidebar">
      <div className="sidebar-title">Setup</div>
      <ul className="sidebar-steps">
        {labels.map((l, i) => (
          <li
            key={l}
            className={`sidebar-step ${i === idx ? "active" : ""}`}
            onClick={() => go(i, `/onboarding/${l.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "")}`)}
          >
            <span className="step-index">{i + 1}</span>
            <span className="step-label">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OnboardingWizard() {
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);

  function go(i, path) {
    setIdx(i);
    nav(path);
  }
  async function complete() {
    await api.completeOnboarding();
    nav("/home");
  }

  return (
    <div className="overlay">
      <div className="wizard wizard-split">
        {/* Left sidebar */}
        <Sidebar idx={idx} go={go} />

        {/* Right content */}
        <div className="wizard-content">
          <div className="wiz-head">
            <div className="wiz-title">Welcome to LifeEase</div>
            <div className="wiz-sub">
            </div>
            <button
              className="btn-lg btn-ghost skip-btn"
              onClick={() => nav("/home")}
            >
              Skip
            </button>
          </div>

          <div className="wiz-body">
            <Routes>
              <Route index element={<Navigate to="role" />} />
              <Route
                path="role"
                element={<Role onNext={() => go(1, "/onboarding/basics")} />}
              />
              <Route
                path="basics"
                element={
                  <Basics
                    onBack={() => go(0, "/onboarding/role")}
                    onNext={() => go(2, "/onboarding/voice")}
                  />
                }
              />
              <Route
                path="voice"
                element={
                  <Voice
                    onBack={() => go(1, "/onboarding/basics")}
                    onNext={() => go(3, "/onboarding/reminders")}
                  />
                }
              />
              <Route
                path="reminders"
                element={
                  <Reminders
                    onBack={() => go(2, "/onboarding/voice")}
                    onNext={() => go(4, "/onboarding/safety")}
                  />
                }
              />
              <Route
                path="safety"
                element={
                  <Safety
                    onBack={() => go(3, "/onboarding/reminders")}
                    onNext={() => go(5, "/onboarding/devices")}
                  />
                }
              />
              <Route
                path="devices"
                element={
                  <Devices
                    onBack={() => go(4, "/onboarding/safety")}
                    onNext={() => go(6, "/onboarding/consent")}
                  />
                }
              />
              <Route
                path="consent"
                element={
                  <Consent
                    onBack={() => go(5, "/onboarding/devices")}
                    onFinish={complete}
                  />
                }
              />
            </Routes>
          </div>

          <div className="wiz-footer">
            <div className="progress-note">Step {idx + 1} of 7</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Steps ---- */
function Role({ onNext }){
  const [role, setRole] = useState("");
  async function save(){
    if(!role) return alert("Please select a role");
    await api.saveOnboarding({ role });
    onNext();
  }
  return (
    <div>
      <h2 className="section-title">Who are you?</h2>
      <p className="section-desc">Pick the option that best describes you.</p>
      <div className="choice">
        {["Elderly","Caregiver (Family)","Caregiver (Professional)"].map(r => (
          <button key={r} className={"pill "+(role===r?"active":"")} onClick={()=>setRole(r)}>{r}</button>
        ))}
      </div>
      <div className="wiz-footer">
        <div />
        <button className="btn-lg" onClick={save}>Next</button>
      </div>
    </div>
  );
}

function Basics({ onBack, onNext }){
  const [name, setName] = useState("");
  const [pref, setPref] = useState("");
  const [a11y, setA11y] = useState("Default");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function save(){
    if(!name.trim()) return alert("Enter your name");
    await api.saveOnboarding({ name, preferredName: pref, a11y, tz });
    onNext();
  }

  return (
    <div>
      <h2 className="section-title">Basics</h2>
      <p className="section-desc">A few details to personalize your experience.</p>
      <div className="grid grid-2">
        <div><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., Maya Sharma" /></div>
        <div><label>Preferred name (optional)</label><input value={pref} onChange={e=>setPref(e.target.value)} placeholder="e.g., Maya" /></div>
        <div><label>Accessibility</label>
          <select value={a11y} onChange={e=>setA11y(e.target.value)}>
            <option>Default</option><option>Large text</option><option>High contrast</option>
          </select>
        </div>
        <div><label>Timezone</label><input value={tz} disabled /></div>
      </div>
      <div className="wiz-footer">
        <button className="btn-lg btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-lg" onClick={save}>Next</button>
      </div>
    </div>
  );
}

function Voice({ onBack, onNext }){
  const [lang, setLang] = useState("en");
  const [rate, setRate] = useState("1.0");
  const [confirm, setConfirm] = useState("");
  async function save(){
    await api.saveOnboarding({ lang, ttsRate: rate, voiceConfirm: confirm });
    onNext();
  }
  return (
    <div>
      <h2 className="section-title">Language & Voice</h2>
      <p className="section-desc">Choose your language and how fast the assistant speaks.</p>
      <div className="grid grid-2">
        <div><label>App language</label>
          <select value={lang} onChange={e=>setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>
        <div><label>Speaking rate</label>
          <select value={rate} onChange={e=>setRate(e.target.value)}>
            <option value="0.9">Slow</option><option value="1.0">Normal</option><option value="1.2">Fast</option>
          </select>
        </div>
        <div className="grid-2" style={{gridColumn:'1 / -1'}}>
          <div className="card-lite">
            <strong>Microphone test</strong>
            <p className="section-desc">Say: “Hello LifeEase, can you hear me?”</p>
            <button className="btn-lg btn-ghost" onClick={()=>alert('Mic test placeholder')}>Start test</button>
          </div>
          <div>
            <label>Type what you hear (optional)</label>
            <input placeholder="Confirmation phrase" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="wiz-footer">
        <button className="btn-lg btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-lg" onClick={save}>Next</button>
      </div>
    </div>
  );
}

function Reminders({ onBack, onNext }){
  const [checkin, setCheckin] = useState("09:00");
  const [quiet, setQuiet] = useState("");
  const [notif, setNotif] = useState(true);
  async function save(){ await api.saveOnboarding({ checkin, quiet, notifications: notif }); onNext(); }
  return (
    <div>
      <h2 className="section-title">Reminders</h2>
      <p className="section-desc">Pick a daily check‑in and quiet hours.</p>
      <div className="grid grid-3">
        <div><label>Daily check-in time</label><input type="time" value={checkin} onChange={e=>setCheckin(e.target.value)} /></div>
        <div><label>Quiet hours</label><input placeholder="21:00–07:00" value={quiet} onChange={e=>setQuiet(e.target.value)} /></div>
        <div><label>Notifications</label>
          <div className="device-item"><span>Allow notifications</span><input type="checkbox" className="toggle" checked={notif} onChange={e=>setNotif(e.target.checked)} /></div>
        </div>
      </div>
      <div className="wiz-footer">
        <button className="btn-lg btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-lg" onClick={save}>Next</button>
      </div>
    </div>
  );
}

function Safety({ onBack, onNext }){
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [threshold, setThreshold] = useState("medium");
  async function save(){ await api.saveOnboarding({ emergencyName: name, emergencyPhone: phone, alertSensitivity: threshold }); onNext(); }
  return (
    <div>
      <h2 className="section-title">Safety</h2>
      <p className="section-desc">Add an emergency contact and alert sensitivity.</p>
      <div className="grid grid-2">
        <div><label>Emergency contact name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
        <div><label>Emergency contact phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} /></div>
        <div><label>Alert sensitivity</label>
          <select value={threshold} onChange={e=>setThreshold(e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>
      </div>
      <div className="wiz-footer">
        <button className="btn-lg btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-lg" onClick={save}>Next</button>
      </div>
    </div>
  );
}

function Devices({ onBack, onNext }){
  const [wearable, setWearable] = useState(true);
  const [fall, setFall] = useState(false);
  const [sleep, setSleep] = useState(true);

  async function save(){
    await api.saveOnboarding({ devices: { wearable, fall, sleep } });
    onNext();
  }

  return (
    <div>
      <h2 className="section-title">Connect devices (optional)</h2>
      <p className="section-desc">You can connect now or later in Settings → Devices.</p>
      <div className="devices-list">
        <div className="device-item">
          <span>Wearable</span>
          <input type="checkbox" className="toggle" checked={wearable} onChange={e=>setWearable(e.target.checked)} />
        </div>
        <div className="device-item">
          <span>Fall sensor</span>
          <input type="checkbox" className="toggle" checked={fall} onChange={e=>setFall(e.target.checked)} />
        </div>
        <div className="device-item">
          <span>Sleep tracker</span>
          <input type="checkbox" className="toggle" checked={sleep} onChange={e=>setSleep(e.target.checked)} />
        </div>
      </div>
      <div className="wiz-footer">
        <button className="btn-lg btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-lg" onClick={save}>Next</button>
      </div>
    </div>
  );
}

function Consent({ onBack, onFinish }){
  const [agree, setAgree] = useState(false);

  async function finish(){
    if(!agree) return alert("Please agree to continue");
    await api.saveOnboarding({ consent: true });
    await onFinish();
  }

  return (
    <div>
      <h2 className="section-title">Privacy & Consent</h2>
      <p className="section-desc">Short version below. Full policy available in Settings → About.</p>
      <div className="consent-box">
        <p><strong>Summary:</strong> We store your profile and preferences to personalize reminders, voice, and safety alerts.
        Health data is optional and only used to provide insights and alerts. You can delete your data anytime.</p>
        <ul>
          <li>We never sell your data.</li>
          <li>Device data is encrypted in transit and at rest.</li>
          <li>You control notifications and sharing.</li>
        </ul>
      </div>
      <label style={{marginTop:12}}>
        <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
        &nbsp; I agree to the summary above and the full Privacy Policy.
      </label>

      <div className="wiz-footer">
        <button className="btn-lg btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-lg" onClick={finish}>Finish</button>
      </div>
    </div>
  );
}
