import { Navigate } from "react-router-dom";

// Redirect: /sales-management → /?tab=sales (Dashboard unificado)
export default function SalesManagement() {
  return <Navigate to="/?tab=sales" replace />;
}
