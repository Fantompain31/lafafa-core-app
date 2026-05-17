"use client";
// src/core/guests/components/GuestForm.tsx

import { useEffect, useState } from "react";
import { guestsService } from "@/core/guests/services/guests.service";
import {
  getGuestResponsibilities,
  type GuestResponsibilities,
} from "@/core/guests/services/guest-responsibilities.service";
import { STAY_COLOR_OPTIONS } from "@/shared/constants/colors";
import { StayDatePicker } from "@/shared/components/StayDatePicker";
import type {
  FoodPreferences,
  GuestCategory,
  GuestStatus,
  GuestSummary,
} from "@/shared/types/database.types";
import { utcIsoToDateTimeLocal } from "@/shared/utils/dates";

type Props = {
  stayId: string;
  stayStartDate?: string | null; // "YYYY-MM-DD" — pour surbrillance calendrier
  stayEndDate?: string | null; // "YYYY-MM-DD"
  guest?: GuestSummary;
  linkedUserId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

const CATEGORIES: { value: GuestCategory; label: string }[] = [
  { value: "adult", label: "Adulte" },
  { value: "child", label: "Enfant" },
  { value: "baby", label: "Bébé" },
];

const STATUSES: { value: GuestStatus; label: string }[] = [
  { value: "invited", label: "Invité" },
  { value: "confirmed", label: "Confirmé" },
  { value: "maybe", label: "Peut-être" },
  { value: "declined", label: "Décliné" },
  { value: "cancelled", label: "Annulé" },
];

function readFoodPreferences(
  value: GuestSummary["food_preferences"] | undefined,
): FoodPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as FoodPreferences;
}

// Découpe un datetime-local ("2025-08-15T14:30") en { date, time }
function splitDateTimeLocal(dtl: string): { date: string; time: string } {
  if (!dtl) return { date: "", time: "" };
  const [date, time = ""] = dtl.split("T");
  return { date, time: time.slice(0, 5) }; // "HH:MM"
}

// Recombine date + time en datetime-local
function joinDateTimeLocal(date: string, time: string): string {
  if (!date) return "";
  return time ? `${date}T${time}` : `${date}T00:00`;
}

export function GuestForm({
  stayId,
  stayStartDate = null,
  stayEndDate = null,
  guest,
  linkedUserId,
  onSuccess,
  onCancel,
}: Props) {
  const isEditing = Boolean(guest);
  const foodPrefs = readFoodPreferences(guest?.food_preferences);

  const [firstName, setFirstName] = useState(guest?.first_name ?? "");
  const [lastName, setLastName] = useState(guest?.last_name ?? "");
  const [category, setCategory] = useState<GuestCategory>(
    guest?.category ?? "adult",
  );
  const [status, setStatus] = useState<GuestStatus>(
    guest?.status ?? (linkedUserId ? "confirmed" : "invited"),
  );
  const [color, setColor] = useState(
    guest?.color ?? STAY_COLOR_OPTIONS[0].value,
  );

  // On split le datetime-local en date + time séparés
  const initialArrival = utcIsoToDateTimeLocal(guest?.arrival_at);
  const initialDeparture = utcIsoToDateTimeLocal(guest?.departure_at);
  const [arrivalDate, setArrivalDate] = useState(
    splitDateTimeLocal(initialArrival).date,
  );
  const [arrivalTime, setArrivalTime] = useState(
    splitDateTimeLocal(initialArrival).time,
  );
  const [departureDate, setDepartureDate] = useState(
    splitDateTimeLocal(initialDeparture).date,
  );
  const [departureTime, setDepartureTime] = useState(
    splitDateTimeLocal(initialDeparture).time,
  );

  const [diet, setDiet] = useState(foodPrefs.diet ?? "");
  const [allergies, setAllergies] = useState(
    foodPrefs.allergies?.join(", ") ?? "",
  );
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [responsibilities, setResponsibilities] =
    useState<GuestResponsibilities | null>(null);
  const [responsibilitiesError, setResponsibilitiesError] = useState<
    string | null
  >(null);

  // Recombine date + time → datetime-local string ou null
  const arrivalAt = arrivalDate
    ? joinDateTimeLocal(arrivalDate, arrivalTime)
    : null;
  const departureAt = departureDate
    ? joinDateTimeLocal(departureDate, departureTime)
    : null;

  useEffect(() => {
    if (!guest?.id) {
      setResponsibilities(null);
      return;
    }

    let cancelled = false;

    async function loadResponsibilities() {
      setResponsibilitiesError(null);
      try {
        const data = await getGuestResponsibilities(stayId, guest.id);
        if (!cancelled) setResponsibilities(data);
      } catch (err) {
        if (!cancelled) {
          setResponsibilities(null);
          setResponsibilitiesError(
            err instanceof Error
              ? err.message
              : "Impossible de charger le récapitulatif.",
          );
        }
      }
    }

    void loadResponsibilities();

    return () => {
      cancelled = true;
    };
  }, [guest?.id, stayId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const foodPreferences: FoodPreferences = {
      diet: diet.trim() || undefined,
      allergies: allergies
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };

    try {
      if (isEditing && guest) {
        await guestsService.updateGuest(guest.id, {
          firstName,
          lastName,
          category,
          status,
          color,
          arrivalAt,
          departureAt,
          foodPreferences,
          notes,
        });
      } else {
        await guestsService.addGuest(stayId, {
          firstName,
          lastName,
          category,
          status,
          color,
          arrivalAt,
          departureAt,
          foodPreferences,
          notes,
          linkedUserId: linkedUserId ?? null,
        });
      }
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom *">
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Alice"
            className="input"
          />
        </Field>
        <Field label="Nom">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dupont"
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GuestCategory)}
            className="input bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Statut">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GuestStatus)}
            className="input bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-600">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {STAY_COLOR_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.value)}
              title={c.label}
              className="h-7 w-7 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value,
                outline: color === c.value ? `2px solid ${c.value}` : "none",
                outlineOffset: "2px",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Arrivée ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Arrivée</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StayDatePicker
            value={arrivalDate || null}
            onChange={(v) => {
              setArrivalDate(v ?? "");
              if (!v) setArrivalTime("");
            }}
            stayStartDate={stayStartDate}
            stayEndDate={stayEndDate}
            placeholder="Date d'arrivée"
            allowClear
          />
          <Field label="">
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="input"
              placeholder="Heure"
              disabled={!arrivalDate}
            />
          </Field>
        </div>
      </div>

      {/* ── Départ ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Départ</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StayDatePicker
            value={departureDate || null}
            onChange={(v) => {
              setDepartureDate(v ?? "");
              if (!v) setDepartureTime("");
            }}
            stayStartDate={stayStartDate}
            stayEndDate={stayEndDate}
            placeholder="Date de départ"
            allowClear
          />
          <Field label="">
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="input"
              placeholder="Heure"
              disabled={!departureDate}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs font-medium text-neutral-600">Alimentation</p>
        <Field label="Régime">
          <input
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            placeholder="végétarien, vegan, halal…"
            className="input bg-white"
          />
        </Field>
        <Field label="Allergies séparées par des virgules">
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="gluten, lactose, arachides…"
            className="input bg-white"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations complémentaires…"
          className="input resize-none"
        />
      </Field>

      {isEditing && (
        <GuestResponsibilitiesBox
          responsibilities={responsibilities}
          error={responsibilitiesError}
          hasArrival={Boolean(guest?.arrival_at)}
          hasDeparture={Boolean(guest?.departure_at)}
        />
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-[var(--stay-primary)] py-2.5 text-sm font-medium text-[var(--stay-primary-text)] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Enregistrement…" : isEditing ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

function GuestResponsibilitiesBox({
  responsibilities,
  error,
  hasArrival,
  hasDeparture,
}: {
  responsibilities: GuestResponsibilities | null;
  error: string | null;
  hasArrival: boolean;
  hasDeparture: boolean;
}) {
  const logistics = responsibilities?.logistics ?? [];
  const accommodation = responsibilities?.accommodation ?? [];
  const planning = responsibilities?.planning ?? [];
  const total = logistics.length + accommodation.length + planning.length;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            À faire / à apporter
          </p>
          <p className="mt-0.5 text-sm font-medium text-neutral-800">
            Récapitulatif personnel
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-600">
          {total} élément{total > 1 ? "s" : ""}
        </span>
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : !responsibilities ? (
        <p className="text-xs text-neutral-500">Chargement du récapitulatif…</p>
      ) : total === 0 && !hasArrival && !hasDeparture ? (
        <p className="text-xs text-neutral-500">
          Rien n’est attribué à cette personne pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(hasArrival || hasDeparture || planning.length > 0) && (
            <ResponsibilityGroup title="Planning" icon="🗓️">
              {planning.length === 0 ? (
                <ResponsibilityLine
                  title="Arrivée / départ renseigné"
                  subtitle="Visible dans le planning du séjour"
                />
              ) : (
                planning.map((item) => (
                  <ResponsibilityLine
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle ?? undefined}
                  />
                ))
              )}
            </ResponsibilityGroup>
          )}

          {logistics.length > 0 && (
            <ResponsibilityGroup title="À apporter / logistique" icon="🧺">
              {logistics.map((item) => (
                <ResponsibilityLine
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle ?? undefined}
                  status={item.status ?? undefined}
                />
              ))}
            </ResponsibilityGroup>
          )}

          {accommodation.length > 0 && (
            <ResponsibilityGroup title="Couchage" icon="🛏️">
              {accommodation.map((item) => (
                <ResponsibilityLine
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle ?? undefined}
                  status={item.status ?? undefined}
                />
              ))}
            </ResponsibilityGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResponsibilityGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-700">
        <span>{icon}</span>
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ResponsibilityLine({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-neutral-100 pt-2 first:border-t-0 first:pt-0">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-neutral-800">
          {title}
        </span>
        {subtitle && (
          <span className="block text-xs text-neutral-500">{subtitle}</span>
        )}
      </span>
      {status && (
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
          {status}
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-neutral-600">{label}</label>
      )}
      {children}
    </div>
  );
}
