import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import OnboardingWizard from "./onboarding/OnboardingWizard";
import RequireAuth from "./pages/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding/*" element={<RequireAuth><OnboardingWizard/></RequireAuth>} />
      <Route path="/home" element={<RequireAuth><Home/></RequireAuth>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
