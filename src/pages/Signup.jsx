import React from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Signup(){
  const nav = useNavigate();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(e){
    e.preventDefault();
    setErr(""); setOk(false);
    try{
      await api.signup({ first, last, email, phone, username, password });
      setOk(true);
      // proceed to onboarding
      nav("/onboarding");
    }catch(ex){ setErr(ex.message || "Sign up failed"); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <h1>Create your LifeEase account</h1>
        <form onSubmit={submit} className="auth-form">
          <input type="text" placeholder="First Name" required value={first} onChange={e=>setFirst(e.target.value)} />
          <input type="text" placeholder="Last Name" required value={last} onChange={e=>setLast(e.target.value)} />
          <input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="tel" placeholder="Phone Number" required value={phone} onChange={e=>setPhone(e.target.value)} />
          <input type="text" placeholder="Username" required value={username} onChange={e=>setUsername(e.target.value)} />
          <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit">Sign Up</button>
          <div className="auth-toggle">
            <span>Already have an account?</span>
            <Link to="/login">Login</Link>
          </div>
          {ok && <p className="success-message">Account created. Please login again.</p>}
          {err && <div className="error">{err}</div>}
        </form>
      </div>
    </div>
  )
}
