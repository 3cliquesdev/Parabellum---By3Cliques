import { Navigate } from "react-router-dom";

// Redirect: /support-dashboard → /?tab=support (Dashboard unificado)
export default function SupportDashboard() {
  return <Navigate to="/?tab=support" replace />;
}
