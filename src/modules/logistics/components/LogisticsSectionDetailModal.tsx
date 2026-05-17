"use client";

import { useMemo, useState } from "react";
import type {
  LogisticsGuest,
  LogisticsItem,
  LogisticsSectionWithItems,
} from "../logistics.types";
import {
  LOGISTICS_SECTION_ICONS,
  LOGISTICS_SECTION_LABELS,
} from "../logistics.types";
import LogisticsItemRow from "./LogisticsItemRow";

interface Props {
  section: LogisticsSectionWithItems;
  guests: LogisticsGuest[];
  currentGuestId: string | null;
  progress: number;
  progressLabel: string;
  onClose: () => void;
  onAddItem: (sectionId: string) => void;
  onEditSection: (section: LogisticsSectionWithItems) => void;
  onHideSection: (sectionId: string) => void;
  onEditItem: (item: LogisticsItem) => void;
  onAssignItem: (itemId: string, guestId: string | null) => Promise<void>;
  onTakeItem: (item: LogisticsItem) => Promise<void>;
  onToggleItem: (item: LogisticsItem) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

type ItemFilterKey = "all" | "mine" | "unassigned" | "todo" | "done";

const ITEM_FILTERS: Array<{ key: ItemFilterKey; label: string; icon: string }> =
  [
    { key: "all", label: "Tout", icon: "✨" },
    { key: "mine", label: "À moi", icon: "🙋" },
    { key: "unassigned", label: "Non attribué", icon: "⚠️" },
    { key: "todo", label: "À faire", icon: "⏳" },
    { key: "done", label: "Terminé", icon: "✅" },
  ];

const FOOD_SECTION_TYPES = new Set(["repas", "meal", "apero", "aperitif"]);

function isAccommodationLinkedItem(item: LogisticsItem, section: LogisticsSectionWithItems) {
  return (
    item.source_type === "accommodation_bed" ||
    section.source_type === "accommodation_bed" ||
    Boolean(item.notes?.toLowerCase().includes("module couchage"))
  );
}

function isAccommodationLinkedSection(section: LogisticsSectionWithItems) {
  return (
    section.source_type === "accommodation_bed" ||
    section.items.some((item) => isAccommodationLinkedItem(item, section))
  );
}

type FoodAlert = {
  guestId: string;
  name: string;
  label: string;
};

export default function LogisticsSectionDetailModal({
  section,
  guests,
  currentGuestId,
  progress,
  progressLabel,
  onClose,
  onAddItem,
  onEditSection,
  onHideSection,
  onEditItem,
  onAssignItem,
  onTakeItem,
  onToggleItem,
  onDeleteItem,
}: Props) {
  const [itemFilter, setItemFilter] = useState<ItemFilterKey>("all");
  const [foodOpen, setFoodOpen] = useState(false);
  const icon = LOGISTICS_SECTION_ICONS[section.section_type] ?? "📌";
  const label =
    LOGISTICS_SECTION_LABELS[section.section_type] ?? section.section_type;
  const isSourceLockedSection = isAccommodationLinkedSection(section);

  const foodAlerts = useMemo(() => {
    if (!FOOD_SECTION_TYPES.has(section.section_type)) return [];
    return getFoodAlerts(guests);
  }, [guests, section.section_type]);

  const filteredItems = useMemo(() => {
    const filtered = section.items.filter((item) => {
      if (itemFilter === "all") return true;
      if (itemFilter === "mine")
        return Boolean(
          currentGuestId &&
          item.assigned_guest_id === currentGuestId &&
          !item.is_checked,
        );
      if (itemFilter === "unassigned")
        return !item.assigned_guest_id && !item.is_checked;
      if (itemFilter === "todo") return !item.is_checked;
      if (itemFilter === "done") return item.is_checked;
      return true;
    });

    const todoItems = filtered.filter((item) => !item.is_checked);
    const doneItems = filtered.filter((item) => item.is_checked);
    return [...todoItems, ...doneItems];
  }, [currentGuestId, itemFilter, section.items]);

  return (
    <div className="lg-detail-overlay" onClick={onClose}>
      <section
        className="lg-detail-panel"
        data-type={section.section_type}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lg-detail-header">
          <div className="lg-section-heading">
            <div className="lg-section-icon">{icon}</div>
            <div className="lg-section-title-wrap">
              <div className="lg-section-kicker">
                <span
                  className={`lg-list-badge lg-list-badge-${section.section_type}`}
                >
                  {label}
                </span>
                {section.source_type === "organization_event" && (
                  <span className="lg-source-badge">lié au planning</span>
                )}
              </div>
              <h2>{section.title}</h2>
            </div>
          </div>

          <button
            className="lg-detail-close"
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {section.notes && <p className="lg-section-notes">{section.notes}</p>}

        {foodAlerts.length > 0 && (
          <div className="lg-food-alert">
            <button
              type="button"
              className="lg-food-alert-summary"
              onClick={() => setFoodOpen((current) => !current)}
            >
              <span className="lg-food-alert-icon">🍽️</span>
              <span>
                <strong>Préférences alimentaires</strong>
                <small>{foodAlerts.length} point{foodAlerts.length > 1 ? "s" : ""} à prendre en compte</small>
              </span>
              <span className="lg-food-alert-caret">{foodOpen ? "−" : "+"}</span>
            </button>

            {foodOpen && (
              <div className="lg-food-alert-list">
                {foodAlerts.map((alert) => (
                  <div key={`${alert.guestId}-${alert.label}`} className="lg-food-alert-row">
                    <span>{alert.name}</span>
                    <strong>{alert.label}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lg-section-progress">
          <div className="lg-section-progress-top">
            <span>{progressLabel}</span>
            <span>{progress}%</span>
          </div>
          <div className="lg-progress-bar">
            <div
              className="lg-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {!isSourceLockedSection && (
          <div className="lg-detail-actions">
            <button
              className="lg-btn-primary"
              type="button"
              onClick={() => onAddItem(section.id)}
            >
              + Ajouter
            </button>
            <button
              className="lg-btn-ghost"
              type="button"
              onClick={() => onEditSection(section)}
            >
              Modifier
            </button>
            <button
              className="lg-btn-danger"
              type="button"
              onClick={() => onHideSection(section.id)}
            >
              Masquer
            </button>
          </div>
        )}

        {section.items.length > 0 && (
          <div className="lg-detail-filter-block">
            <p className="lg-filter-label">Afficher</p>
            <div className="lg-filters">
              {ITEM_FILTERS.filter(
                (filter) => filter.key !== "mine" || currentGuestId,
              ).map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`lg-tag lg-status-tag lg-status-tag-${filter.key}${itemFilter === filter.key ? " active" : ""}`}
                  onClick={() => setItemFilter(filter.key)}
                >
                  <span>{filter.icon}</span> {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {section.items.length === 0 ? (
          <div className="lg-items-empty">
            <span>Aucun élément à prévoir.</span>
            <button type="button" onClick={() => onAddItem(section.id)}>
              + Ajouter le premier
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="lg-items-empty">
            <span>Aucun élément dans ce filtre.</span>
            <button type="button" onClick={() => setItemFilter("all")}>
              Tout afficher
            </button>
          </div>
        ) : (
          <div className="lg-items-list lg-detail-items-list">
            {filteredItems.map((item) => (
              <LogisticsItemRow
                key={item.id}
                item={item}
                guests={guests}
                currentGuestId={currentGuestId}
                onEdit={onEditItem}
                onAssign={onAssignItem}
                onTake={onTakeItem}
                onToggle={onToggleItem}
                onDelete={onDeleteItem}
                isSourceLocked={isAccommodationLinkedItem(item, section)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getFoodAlerts(guests: LogisticsGuest[]) {
  return guests.flatMap((guest): FoodAlert[] => {
    const labels = readFoodPreferenceLines(guest.food_preferences);
    const name = `${guest.first_name}${guest.last_name ? ` ${guest.last_name}` : ""}`;
    return labels.map((label) => ({
      guestId: guest.id,
      name,
      label,
    }));
  });
}

function readFoodPreferenceLines(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const record = value as Record<string, unknown>;
  const lines: string[] = [];

  const diet = typeof record.diet === "string" ? record.diet.trim() : "";
  if (diet) lines.push(diet);

  const allergies = Array.isArray(record.allergies)
    ? record.allergies.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  if (allergies.length > 0) lines.push(`Allergies : ${allergies.join(", ")}`);

  return lines;
}
