import { Navigate } from "react-router-dom";

// Redirect: /cs-management → /?tab=overview (Dashboard unificado)
export default function CSManagement() {
  return <Navigate to="/?tab=overview" replace />;
}
