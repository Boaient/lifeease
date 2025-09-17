import React from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login(){
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e){
    e.preventDefault();
    setErr("");
    try{
      const user = await api.login({ username, password });
      if (!user.onboarded) nav("/onboarding");
      else nav("/home");
    }catch(ex){ setErr(ex.message || "Login failed"); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <h1>Welcome to LifeEase</h1>
        <form onSubmit={submit} className="auth-form">
          <input type="text" placeholder="Username" required value={username} onChange={e=>setUsername(e.target.value)} />
          <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit">Login</button>
          <div className="auth-toggle">
            <span>Don’t have an account?</span>
            <Link to="/signup">Sign up</Link>
          </div>
          {err && <div className="error">{err}</div>}
        </form>
      </div>
    </div>
  )
}
