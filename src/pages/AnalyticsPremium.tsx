import { Navigate, useSearchParams } from "react-router-dom";

// Redirect: /analytics/premium → /?tab=overview (Dashboard unificado)
export default function AnalyticsPremium() {
  return <Navigate to="/?tab=overview" replace />;
}
