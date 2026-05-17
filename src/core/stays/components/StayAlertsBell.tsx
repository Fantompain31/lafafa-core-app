"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StayAlert = {
  id: string;
  label: string;
  detail: string;
  href?: string;
  actionLabel?: string;
  severity: "warning" | "info";
};

type Props = {
  stayId: string;
};

export function StayAlertsBell({ stayId }: Props) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<StayAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      setLoading(true);
      try {
        const data = await fetchStayAlerts(stayId);
        if (!cancelled) setAlerts(data);
      } catch (error) {
        console.warn("Impossible de charger les alertes du séjour", error);
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAlerts();

    const handleFocus = () => void loadAlerts();
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [stayId]);

  const warningCount = useMemo(
    () => alerts.filter((alert) => alert.severity === "warning").length,
    [alerts],
  );
  const hasAlerts = alerts.length > 0;

  return (
    <div className="stay-alerts">
      <button
        type="button"
        className={`stay-alerts-bell${hasAlerts ? " has-alerts" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={
          hasAlerts
            ? `${alerts.length} alerte${alerts.length > 1 ? "s" : ""}`
            : "Aucune alerte"
        }
        aria-expanded={open}
      >
        <IconBell />
        {hasAlerts && <span className="stay-alerts-dot">{alerts.length}</span>}
      </button>

      {open && (
        <div className="stay-alerts-panel">
          <div className="stay-alerts-header">
            <div>
              <p>Alertes</p>
              <span>
                {loading
                  ? "Actualisation…"
                  : hasAlerts
                    ? `${alerts.length} point${alerts.length > 1 ? "s" : ""} à vérifier`
                    : "Tout est à jour"}
              </span>
            </div>
            {warningCount > 0 && <strong>{warningCount}</strong>}
          </div>

          {!hasAlerts ? (
            <div className="stay-alerts-empty">
              Aucune alerte pour le moment.
            </div>
          ) : (
            <div className="stay-alerts-list">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`stay-alert-row stay-alert-row-${alert.severity}`}
                >
                  <span className="stay-alert-row-icon">
                    {alert.severity === "warning" ? "!" : "i"}
                  </span>
                  <span>
                    <strong>{alert.label}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  {alert.href && (
                    <a className="stay-alert-action" href={alert.href}>
                      {alert.actionLabel ?? "Voir"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function fetchStayAlerts(stayId: string): Promise<StayAlert[]> {
  const supabase = createClient();

  const [logisticsResult, guestsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("logistics_items")
      .select("id, label")
      .eq("stay_id", stayId)
      .eq("is_checked", false)
      .is("assigned_guest_id", null),

    supabase
      .from("guests_summary")
      .select("id, first_name, last_name, status")
      .eq("stay_id", stayId)
      .not("status", "in", "(declined,cancelled)"),

    supabase
      .from("accommodation_assignments")
      .select("guest_id")
      .eq("stay_id", stayId),
  ]);

  if (logisticsResult.error) throw new Error(logisticsResult.error.message);
  if (guestsResult.error) throw new Error(guestsResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);

  const logisticsItems = logisticsResult.data ?? [];
  const guests = guestsResult.data ?? [];
  const assignedGuestIds = new Set(
    (assignmentsResult.data ?? []).map((row) => row.guest_id).filter(Boolean),
  );
  const guestsWithoutBed = guests.filter(
    (guest) => !assignedGuestIds.has(guest.id),
  );

  const alerts: StayAlert[] = [];

  if (logisticsItems.length > 0) {
    alerts.push({
      id: "logistics-unassigned",
      label: `${logisticsItems.length} élément${logisticsItems.length > 1 ? "s" : ""} non attribué${logisticsItems.length > 1 ? "s" : ""}`,
      detail:
        logisticsItems
          .slice(0, 3)
          .map((item) => item.label)
          .join(", ") + (logisticsItems.length > 3 ? "…" : ""),
      href: `/stays/${stayId}/logistique`,
      actionLabel: "Je peux aider",
      severity: "warning",
    });
  }

  if (guestsWithoutBed.length > 0) {
    alerts.push({
      id: "accommodation-unassigned",
      label: `${guestsWithoutBed.length} membre${guestsWithoutBed.length > 1 ? "s" : ""} sans couchage`,
      detail:
        guestsWithoutBed
          .slice(0, 3)
          .map((guest) => guest.first_name)
          .join(", ") + (guestsWithoutBed.length > 3 ? "…" : ""),
      href: `/stays/${stayId}/couchage`,
      severity: "warning",
    });
  }

  return alerts;
}

function IconBell() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
