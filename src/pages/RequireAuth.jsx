import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const user = JSON.parse(localStorage.getItem("lifeease-user") || "null");
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}
