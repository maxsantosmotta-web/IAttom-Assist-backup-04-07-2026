import { useEffect } from "react";
import { useLocation } from "wouter";

export function AdminIntegrations() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/admin/api-config", { replace: true });
  }, [navigate]);
  return null;
}
