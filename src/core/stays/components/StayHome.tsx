"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  MyStay,
  GuestSummary,
  MemberRole,
} from "@/shared/types/database.types";
import "./StayHome.css";

export type StayHomeEvent = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string | null;
  source_type?: string | null;
  source_id?: string | null;
  logistics_section_id?: string | null;
};

export type StayHomeLogisticsSection = {
  id: string;
  title: string;
  section_type: string;
  source_type: string | null;
  source_id: string | null;
  is_hidden: boolean;
  created_at?: string | null;
};

export type StayHomeLogisticsItem = {
  id: string;
  section_id: string;
  is_checked: boolean;
  assigned_guest_id: string | null;
};

type FoodAlert = {
  guestId: string;
  name: string;
  label: string;
};

type Props = {
  stay: MyStay;
  myGuest: GuestSummary | null;
  participants: GuestSummary[];
  myRole: MemberRole;
  programEvents?: StayHomeEvent[];
  logisticsSections?: StayHomeLogisticsSection[];
  logisticsItems?: StayHomeLogisticsItem[];
};

const EVENT_LABELS: Record<string, string> = {
  repas: "Repas",
  apero: "Apéro",
  activite: "Activité",
  transport: "Transport",
  arrivee: "Arrivée",
  depart: "Départ",
  menage: "Ménage",
  temps_libre: "Temps libre",
  autre: "Autre",
};

const EVENT_ICONS: Record<string, string> = {
  repas: "🍽️",
  apero: "🥂",
  activite: "🎯",
  transport: "🚗",
  arrivee: "👋",
  depart: "👜",
  menage: "🧹",
  temps_libre: "☀️",
  autre: "📌",
};

const LOGISTICS_LABELS: Record<string, string> = {
  repas: "Repas",
  meal: "Repas",
  apero: "Apéro",
  aperitif: "Apéro",
  shopping: "Courses",
  equipment: "Matériel",
  sleeping: "Couchage",
  transport: "Transport",
  menage: "Ménage",
  cleaning: "Ménage",
  activite: "Activité",
  autre: "Autre",
};

const LOGISTICS_ICONS: Record<string, string> = {
  repas: "🍽️",
  meal: "🍽️",
  apero: "🥂",
  aperitif: "🥂",
  shopping: "🛒",
  equipment: "🎒",
  sleeping: "🛏️",
  transport: "🚗",
  menage: "🧹",
  cleaning: "🧹",
  activite: "🎯",
  autre: "📌",
};

export function StayHome({
  stay,
  myGuest,
  participants,
  myRole,
  programEvents = [],
  logisticsSections = [],
  logisticsItems = [],
}: Props) {
  const router = useRouter();
  const isOrganizer = myRole === "owner" || myRole === "co_organizer";
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const confirmed = participants.filter((p) => p.status === "confirmed");
  const total = participants.length;

  const startDate = stay.start_date ? new Date(stay.start_date) : null;
  const endDate = stay.end_date ? new Date(stay.end_date) : null;
  const today = new Date();
  const daysUntil = startDate
    ? Math.max(
        0,
        Math.ceil(
          (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const foodAlerts = useMemo(() => getFoodAlerts(participants), [participants]);
  const logisticsRows = useMemo(() => {
    return logisticsSections
      .map((section) => {
        const items = logisticsItems.filter(
          (item) => item.section_id === section.id,
        );
        const remaining = items.filter((item) => !item.is_checked).length;
        const unassigned = items.filter(
          (item) => !item.is_checked && !item.assigned_guest_id,
        ).length;
        const done = items.length - remaining;
        const progress =
          items.length > 0 ? Math.round((done / items.length) * 100) : 0;
        return {
          section,
          total: items.length,
          remaining,
          unassigned,
          progress,
        };
      })
      .sort((a, b) => b.remaining - a.remaining || b.unassigned - a.unassigned)
      .slice(0, 3);
  }, [logisticsItems, logisticsSections]);

  const totalLogisticsItems = logisticsItems.length;
  const remainingLogisticsItems = logisticsItems.filter(
    (item) => !item.is_checked,
  ).length;
  const unassignedLogisticsItems = logisticsItems.filter(
    (item) => !item.is_checked && !item.assigned_guest_id,
  ).length;

  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const fmtDay = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "long" });

  useEffect(() => {
    let cancelled = false;

    async function loadCover() {
      if (!stay.cover_image_path) {
        setCoverUrl(null);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(stay.cover_image_bucket ?? "stays-media")
        .createSignedUrl(stay.cover_image_path, 60 * 60);

      if (!cancelled) {
        setCoverUrl(error ? null : (data?.signedUrl ?? null));
      }
    }

    void loadCover();

    return () => {
      cancelled = true;
    };
  }, [stay.cover_image_bucket, stay.cover_image_path]);

  async function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCoverError("Choisissez une image.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setCoverError("Image trop lourde : maximum 8 Mo.");
      return;
    }

    setCoverLoading(true);
    setCoverError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée.");

      const extension = readImageExtension(file);
      const fileId = crypto.randomUUID();
      const bucket = "stays-media";
      const storagePath = `${stay.id}/cover_image/${fileId}.${extension}`;

      const uploadResult = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { upsert: true, contentType: file.type });

      if (uploadResult.error) throw new Error(uploadResult.error.message);

      const { data: insertedFile, error: fileError } = await supabase
        .from("files")
        .insert({
          stay_id: stay.id,
          uploaded_by: user.id,
          bucket,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          kind: "cover_image",
        })
        .select("id")
        .single();

      if (fileError || !insertedFile)
        throw new Error(
          fileError?.message ?? "Impossible d’enregistrer la photo.",
        );

      const { error: stayError } = await supabase
        .from("stays")
        .update({ cover_image_file_id: insertedFile.id })
        .eq("id", stay.id);

      if (stayError) throw new Error(stayError.message);

      if (stay.cover_image_path) {
        await supabase.storage
          .from(stay.cover_image_bucket ?? bucket)
          .remove([stay.cover_image_path]);
        if (stay.cover_image_file_id) {
          await supabase
            .from("files")
            .delete()
            .eq("id", stay.cover_image_file_id);
        }
      }

      router.refresh();
    } catch (error) {
      setCoverError(
        error instanceof Error
          ? error.message
          : "Impossible d’ajouter la photo.",
      );
    } finally {
      setCoverLoading(false);
    }
  }

  async function handleDeleteCover() {
    if (
      !stay.cover_image_path ||
      !confirm("Supprimer la photo de couverture ?")
    )
      return;

    setCoverLoading(true);
    setCoverError(null);

    try {
      const supabase = createClient();
      const bucket = stay.cover_image_bucket ?? "stays-media";

      const { error: stayError } = await supabase
        .from("stays")
        .update({ cover_image_file_id: null })
        .eq("id", stay.id);

      if (stayError) throw new Error(stayError.message);

      await supabase.storage.from(bucket).remove([stay.cover_image_path]);
      if (stay.cover_image_file_id) {
        await supabase
          .from("files")
          .delete()
          .eq("id", stay.cover_image_file_id);
      }

      setCoverUrl(null);
      router.refresh();
    } catch (error) {
      setCoverError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la photo.",
      );
    } finally {
      setCoverLoading(false);
    }
  }

  function getInitials(g: GuestSummary) {
    return [g.first_name[0], g.last_name?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase();
  }

  return (
    <div className="sh">
      <div className="sh-hero">
        <div className={`sh-hero-cover${coverUrl ? " has-image" : ""}`}>
          {coverUrl && <img src={coverUrl} alt="" />}
          {isOrganizer && (
            <div className="sh-cover-actions">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="sh-cover-input"
                onChange={handleCoverFileChange}
              />
              <button
                type="button"
                className="sh-cover-btn"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverLoading}
              >
                {coverUrl ? "Changer la photo" : "Ajouter une photo"}
              </button>
              {coverUrl && (
                <button
                  type="button"
                  className="sh-cover-btn sh-cover-btn-danger"
                  onClick={handleDeleteCover}
                  disabled={coverLoading}
                >
                  Supprimer
                </button>
              )}
            </div>
          )}
        </div>
        {coverError && <div className="sh-cover-error">{coverError}</div>}
        <div className="sh-hero-body">
          <div className="sh-hero-eyebrow">
            <span className="sh-badge-confirmed">✓ Confirmé</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Accueil du séjour</span>
          </div>
          <h1 className="sh-hero-title">{stay.title}</h1>
          {stay.location_name && (
            <p className="sh-hero-location">
              <IconPin />
              {stay.location_name}
            </p>
          )}
          {startDate && endDate && (
            <div className="sh-dates">
              <div className="sh-date-box">
                <span className="sh-date-label">Arrivée</span>
                <span className="sh-date-value">{fmt(startDate)}</span>
                <span className="sh-date-day">{fmtDay(startDate)}</span>
              </div>
              <div className="sh-date-arrow">
                <IconArrow />
              </div>
              <div className="sh-date-box sh-date-box-right">
                <span className="sh-date-label">Départ</span>
                <span className="sh-date-value">{fmt(endDate)}</span>
                <span className="sh-date-day">{fmtDay(endDate)}</span>
              </div>
              {daysUntil !== null && daysUntil > 0 && (
                <div className="sh-countdown">
                  <span className="sh-countdown-dot" />
                  Dans {daysUntil} jours
                </div>
              )}
              {daysUntil === 0 && (
                <div className="sh-countdown">
                  <span className="sh-countdown-dot" />
                  C&apos;est aujourd&apos;hui !
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sh-grid">
        <div className="sh-main-stack">
          <div className="sh-card">
            <div className="sh-card-header">
              <div className="sh-card-title-row">
                {myGuest ? (
                  <div
                    className="sh-avatar"
                    style={{ background: myGuest.color ?? "#C4A882" }}
                  >
                    {myGuest.linked_user_avatar_url ? (
                      <img src={myGuest.linked_user_avatar_url} alt="" />
                    ) : (
                      getInitials(myGuest)
                    )}
                  </div>
                ) : (
                  <div className="sh-avatar sh-avatar-empty">?</div>
                )}
                <div>
                  <p className="sh-section-label">Ma fiche</p>
                  <p className="sh-card-name">
                    {myGuest
                      ? `${myGuest.first_name}${myGuest.last_name ? " " + myGuest.last_name : ""}`
                      : "Fiche non créée"}
                  </p>
                </div>
              </div>
              <button
                className="sh-btn-outline"
                onClick={() =>
                  router.push(
                    myGuest
                      ? `/stays/${stay.id}/me`
                      : `/join/complete?stayId=${stay.id}`,
                  )
                }
              >
                <IconEdit />
                {myGuest ? "Modifier" : "Créer ma fiche"}
              </button>
            </div>

            {myGuest ? (
              <div className="sh-meta-grid">
                <MetaCell
                  label="Catégorie"
                  value={
                    myGuest.category === "adult"
                      ? "Adulte"
                      : myGuest.category === "child"
                        ? "Enfant"
                        : "Bébé"
                  }
                />
                {readFoodPreferenceLines(myGuest)
                  .slice(0, 1)
                  .map((line) => (
                    <MetaCell key={line} label="Alimentation" value={line} />
                  ))}
                {myGuest.arrival_at && (
                  <MetaCell
                    label="Arrivée"
                    value={new Date(myGuest.arrival_at).toLocaleDateString(
                      "fr-FR",
                      { weekday: "short", day: "numeric", month: "short" },
                    )}
                  />
                )}
                {myGuest.departure_at && (
                  <MetaCell
                    label="Départ"
                    value={new Date(myGuest.departure_at).toLocaleDateString(
                      "fr-FR",
                      { weekday: "short", day: "numeric", month: "short" },
                    )}
                  />
                )}
                {myGuest.notes && (
                  <MetaCell label="Notes" value={myGuest.notes} wide />
                )}
              </div>
            ) : (
              <p className="sh-empty-hint">
                Créez votre fiche pour que l&apos;organisateur puisse vous
                inclure dans la planification.
              </p>
            )}
          </div>

          <DashboardProgramCard
            events={programEvents}
            onOpen={() => router.push(`/stays/${stay.id}/organisation`)}
          />

          <DashboardLogisticsCard
            rows={logisticsRows}
            totalSections={logisticsSections.length}
            totalItems={totalLogisticsItems}
            remainingItems={remainingLogisticsItems}
            unassignedItems={unassignedLogisticsItems}
            onOpen={() => router.push(`/stays/${stay.id}/logistique`)}
          />

          <PlaceholderCard
            title="Budget"
            icon={<IconBudget />}
            desc="Les dépenses partagées et votre solde apparaîtront ici. Pour l'instant, rien à régler."
          />
        </div>

        <div className="sh-sidebar">
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <p className="sh-section-label">Le groupe</p>
                <p className="sh-card-name">
                  {confirmed.length} confirmé{confirmed.length > 1 ? "s" : ""}
                </p>
                <p
                  style={{ fontSize: 12, color: "#a08870", margin: "2px 0 0" }}
                >
                  sur {total} participant{total > 1 ? "s" : ""}
                </p>
              </div>
              {isOrganizer && (
                <button
                  className="sh-btn-outline"
                  onClick={() => router.push(`/stays/${stay.id}/guests`)}
                >
                  <IconPlus /> Inviter
                </button>
              )}
            </div>

            <div className="sh-participants">
              {participants.slice(0, 8).map((p) => (
                <div key={p.id} className="sh-participant">
                  <div
                    className="sh-participant-avatar"
                    style={{ background: p.color ?? "#C4A882" }}
                  >
                    {p.linked_user_avatar_url ? (
                      <img
                        src={p.linked_user_avatar_url}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "50%",
                        }}
                      />
                    ) : (
                      getInitials(p)
                    )}
                  </div>
                  <span
                    className={`sh-participant-name ${p.linked_user_id ? "sh-participant-name-me" : ""}`}
                  >
                    {p.first_name}
                  </span>
                </div>
              ))}
            </div>

            {total > 0 && (
              <>
                <div className="sh-progress-bar">
                  <div
                    className="sh-progress-fill"
                    style={{ width: `${(confirmed.length / total) * 100}%` }}
                  />
                </div>
                <div className="sh-progress-meta">
                  <span>
                    {confirmed.length}/{total} confirmés
                  </span>
                  <span>{Math.round((confirmed.length / total) * 100)}%</span>
                </div>
              </>
            )}
          </div>

          {foodAlerts.length > 0 && (
            <FoodAlertsCard
              alerts={foodAlerts}
              onOpen={() => router.push(`/stays/${stay.id}/guests`)}
            />
          )}

          {isOrganizer && (
            <div className="sh-card">
              <p className="sh-section-label">Informations</p>
              <InfoRow
                label="Alertes"
                value={
                  stay.open_alerts_count > 0
                    ? `${stay.open_alerts_count} ouverte(s)`
                    : "Aucune alerte"
                }
              />
              <InfoRow
                label="Membres actifs"
                value={`${stay.active_member_count}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardProgramCard({
  events,
  onOpen,
}: {
  events: StayHomeEvent[];
  onOpen: () => void;
}) {
  const nextEvent = events[0];

  return (
    <div className="sh-dashboard-card">
      <div className="sh-dashboard-header">
        <div className="sh-dashboard-title-row">
          <div className="sh-placeholder-icon">
            <IconProgram />
          </div>
          <div>
            <p className="sh-section-label">Programme</p>
            <h2>Prochains moments</h2>
          </div>
        </div>
        <button className="sh-btn-outline" onClick={onOpen}>
          Voir
        </button>
      </div>

      {events.length === 0 ? (
        <p className="sh-empty-hint">Aucun moment prévu pour l&apos;instant.</p>
      ) : (
        <>
          {nextEvent && (
            <div className="sh-next-event">
              <span className="sh-next-event-icon">
                {EVENT_ICONS[nextEvent.event_type] ?? "📌"}
              </span>
              <div>
                <p className="sh-next-event-label">Prochain moment</p>
                <p className="sh-next-event-title">
                  {formatEventTime(nextEvent)} · {nextEvent.title}
                </p>
                {nextEvent.location && (
                  <p className="sh-next-event-location">{nextEvent.location}</p>
                )}
              </div>
            </div>
          )}

          <div className="sh-mini-list">
            {events.slice(0, 4).map((event) => (
              <button
                key={event.id}
                className="sh-mini-row"
                type="button"
                onClick={onOpen}
              >
                <span
                  className={`sh-mini-dot sh-mini-dot-${event.event_type}`}
                />
                <span className="sh-mini-time">
                  {formatShortDate(event.event_date)}{" "}
                  {formatTime(event.start_time)}
                </span>
                <span className="sh-mini-title">{event.title}</span>
                <span className="sh-mini-badge">
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type LogisticsRow = {
  section: StayHomeLogisticsSection;
  total: number;
  remaining: number;
  unassigned: number;
  progress: number;
};

function DashboardLogisticsCard({
  rows,
  totalSections,
  totalItems,
  remainingItems,
  unassignedItems,
  onOpen,
}: {
  rows: LogisticsRow[];
  totalSections: number;
  totalItems: number;
  remainingItems: number;
  unassignedItems: number;
  onOpen: () => void;
}) {
  return (
    <div className="sh-dashboard-card">
      <div className="sh-dashboard-header">
        <div className="sh-dashboard-title-row">
          <div className="sh-placeholder-icon">
            <IconMeal />
          </div>
          <div>
            <p className="sh-section-label">Logistique</p>
            <h2>À prévoir</h2>
          </div>
        </div>
        <button className="sh-btn-outline" onClick={onOpen}>
          Voir
        </button>
      </div>

      {totalSections === 0 ? (
        <p className="sh-empty-hint">
          Aucune section logistique pour l&apos;instant.
        </p>
      ) : (
        <>
          <div className="sh-logistics-summary">
            <SummaryPill
              value={String(totalSections)}
              label="section"
              plural={totalSections > 1}
            />
            <SummaryPill value={String(remainingItems)} label="à finir" />
            <SummaryPill
              value={String(unassignedItems)}
              label="non attribué"
              plural={unassignedItems > 1}
            />
          </div>

          {totalItems === 0 ? (
            <p className="sh-empty-hint">
              Les sections sont créées, mais aucun élément n&apos;est encore
              listé.
            </p>
          ) : (
            <div className="sh-logistics-list">
              {rows.map((row) => (
                <button
                  key={row.section.id}
                  className="sh-logistics-row"
                  type="button"
                  onClick={onOpen}
                >
                  <span className="sh-logistics-icon">
                    {LOGISTICS_ICONS[row.section.section_type] ?? "📌"}
                  </span>
                  <span className="sh-logistics-body">
                    <span className="sh-logistics-title">
                      {row.section.title}
                    </span>
                    <span className="sh-logistics-meta">
                      {row.remaining === 0
                        ? "Prêt"
                        : `${row.remaining} à finaliser`}
                      {row.unassigned > 0
                        ? ` · ${row.unassigned} non attribué${row.unassigned > 1 ? "s" : ""}`
                        : ""}
                    </span>
                  </span>
                  <span className="sh-logistics-progress">{row.progress}%</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FoodAlertsCard({
  alerts,
  onOpen,
}: {
  alerts: FoodAlert[];
  onOpen: () => void;
}) {
  return (
    <div className="sh-card sh-food-card">
      <div className="sh-card-header">
        <div>
          <p className="sh-section-label">À prendre en compte</p>
          <p className="sh-card-name">Alimentation</p>
        </div>
        <button className="sh-btn-outline" onClick={onOpen}>
          Voir
        </button>
      </div>
      <div className="sh-food-list">
        {alerts.slice(0, 5).map((alert) => (
          <div key={`${alert.guestId}-${alert.label}`} className="sh-food-row">
            <span>🍽️</span>
            <span>
              <strong>{alert.name}</strong> · {alert.label}
            </span>
          </div>
        ))}
        {alerts.length > 5 && (
          <p className="sh-food-more">
            + {alerts.length - 5} autre{alerts.length - 5 > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`sh-meta-cell${wide ? " sh-meta-cell-wide" : ""}`}>
      <div className="sh-meta-cell-label">{label}</div>
      <div className="sh-meta-cell-value">{value}</div>
    </div>
  );
}

function SummaryPill({
  value,
  label,
  plural,
}: {
  value: string;
  label: string;
  plural?: boolean;
}) {
  return (
    <div className="sh-summary-pill">
      <span>{value}</span>
      <small>
        {label}
        {plural ? "s" : ""}
      </small>
    </div>
  );
}

function PlaceholderCard({
  title,
  icon,
  desc,
}: {
  title: string;
  icon: React.ReactNode;
  desc: string;
}) {
  return (
    <div className="sh-placeholder">
      <div className="sh-placeholder-header">
        <div className="sh-placeholder-icon">{icon}</div>
        <span className="sh-placeholder-title">{title}</span>
        <span className="sh-placeholder-badge">À venir</span>
      </div>
      <p className="sh-placeholder-desc">{desc}</p>
      <div className="sh-placeholder-strip" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        paddingBottom: 10,
        borderBottom: "0.5px solid rgba(196,168,130,0.15)",
      }}
    >
      <span style={{ color: "#7a6a5a" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#2c2420" }}>{value}</span>
    </div>
  );
}

function formatTime(value: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatEventTime(event: StayHomeEvent) {
  const day = formatShortDate(event.event_date);
  const time = formatTime(event.start_time);
  return time ? `${day} ${time}` : day;
}

function readFoodPreferenceLines(
  guest: GuestSummary | { food_preferences?: unknown },
) {
  const prefs = guest.food_preferences;
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return [];

  const record = prefs as Record<string, unknown>;
  const lines: string[] = [];

  const diet = typeof record.diet === "string" ? record.diet.trim() : "";
  if (diet) lines.push(diet);

  const allergies = Array.isArray(record.allergies)
    ? record.allergies.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  if (allergies.length > 0) lines.push(`Allergies : ${allergies.join(", ")}`);

  return lines;
}

function getFoodAlerts(participants: GuestSummary[]) {
  return participants.flatMap((guest) => {
    const name = `${guest.first_name}${guest.last_name ? ` ${guest.last_name}` : ""}`;
    return readFoodPreferenceLines(guest).map((label) => ({
      guestId: guest.id,
      name,
      label,
    }));
  });
}

function readImageExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName))
    return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

const IconPin = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
const IconArrow = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="13 6 19 12 13 18" />
  </svg>
);
const IconEdit = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 4l6 6-11 11H3v-6L14 4z" />
  </svg>
);
const IconPlus = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconProgram = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6.5 12 12 16 14" />
  </svg>
);
const IconMeal = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 3v8a3 3 0 0 0 3 3v7" />
    <line x1="8" y1="3" x2="8" y2="9" />
    <path d="M16 3c-1.5 0-2.5 1.5-2.5 4s1 4 2.5 4v10" />
  </svg>
);
const IconBudget = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <line x1="3" y1="10.5" x2="21" y2="10.5" />
    <circle cx="17" cy="15" r="1.4" />
  </svg>
);
