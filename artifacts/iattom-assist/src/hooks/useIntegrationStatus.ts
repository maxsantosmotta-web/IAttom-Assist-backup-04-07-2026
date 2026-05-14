import { useState, useEffect, useCallback } from "react";

export type IntegrationId = "whatsapp" | "meta" | "shopee" | "ml" | "hotmart" | "kiwify";

export interface IntegrationStatusItem {
  id: IntegrationId;
  label: string;
  configured: boolean;
  isActive: boolean;
  tokenExpired?: boolean;
  environment?: string | null;
  extraInfo?: string | null;
  lastUpdated?: string | null;
}

export interface IntegrationEvent {
  platform: IntegrationId;
  platformLabel: string;
  eventType: string;
  primaryText: string | null;
  secondaryText: string | null;
  value: string | null;
  currency: string | null;
  receivedAt: string | null;
}

interface UseIntegrationStatusReturn {
  statuses: IntegrationStatusItem[];
  events: IntegrationEvent[];
  loading: boolean;
  eventsLoading: boolean;
  refetch: () => void;
  refetchEvents: () => void;
  connectedCount: number;
  configuredCount: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useIntegrationStatus(): UseIntegrationStatusReturn {
  const [statuses, setStatuses] = useState<IntegrationStatusItem[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<IntegrationStatusItem[]>("/api/integrations/status");
      setStatuses(data);
    } catch {
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const data = await apiFetch<IntegrationEvent[]>("/api/integrations/events");
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatuses();
    void fetchEvents();
  }, [fetchStatuses, fetchEvents]);

  const connectedCount = statuses.filter((s) => s.isActive && !s.tokenExpired).length;
  const configuredCount = statuses.filter((s) => s.configured).length;

  return {
    statuses,
    events,
    loading,
    eventsLoading,
    refetch: () => void fetchStatuses(),
    refetchEvents: () => void fetchEvents(),
    connectedCount,
    configuredCount,
  };
}
