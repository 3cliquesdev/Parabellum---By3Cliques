import { Navigate } from "react-router-dom";

// Redirect: /analytics → / (Dashboard unificado)
export default function Analytics() {
  return <Navigate to="/" replace />;
}
