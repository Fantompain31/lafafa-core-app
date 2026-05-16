"use client";

import { useMemo, useState } from "react";
import type {
  LogisticsGuest,
  LogisticsItem,
  LogisticsItemFormValues,
  LogisticsSection,
  LogisticsSectionFormValues,
  LogisticsSectionType,
  LogisticsSectionWithItems,
} from "./logistics.types";
import {
  LOGISTICS_SECTION_ICONS,
  LOGISTICS_SECTION_LABELS,
} from "./logistics.types";
import {
  createManualLogisticsSection,
  updateLogisticsSection,
  hideLogisticsSection,
  createLogisticsItem,
  updateLogisticsItem,
  assignLogisticsItem,
  toggleLogisticsItem,
  deleteLogisticsItem,
} from "./logistics.service";
import LogisticsSectionCard from "./components/LogisticsSectionCard";
import LogisticsSectionDetailModal from "./components/LogisticsSectionDetailModal";
import LogisticsSectionModal from "./components/LogisticsSectionModal";
import LogisticsItemModal from "./components/LogisticsItemModal";
import "./logistics.css";

interface Props {
  stayId: string;
  isEnabled: boolean;
  initialSections: LogisticsSectionWithItems[];
  guests: LogisticsGuest[];
  currentGuestId: string | null;
}

type FilterKey = "all" | LogisticsSectionType;
type StatusFilterKey = "all" | "mine" | "unassigned" | "todo" | "done";

const FILTERS: FilterKey[] = [
  "all",
  "repas",
  "apero",
  "shopping",
  "equipment",
  "sleeping",
  "transport",
  "menage",
  "activite",
  "autre",
];

const STATUS_FILTERS: Array<{
  key: StatusFilterKey;
  label: string;
  icon: string;
}> = [
  { key: "all", label: "Tout", icon: "✨" },
  { key: "mine", label: "À moi", icon: "🙋" },
  { key: "unassigned", label: "Non attribué", icon: "⚠️" },
  { key: "todo", label: "À finir", icon: "⏳" },
  { key: "done", label: "Terminé", icon: "✅" },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getProgressLabel(done: number, total: number) {
  if (total === 0) return "Aucun élément";
  if (done === total) return "Tout est prêt";
  if (done === 0) return `${total} à prévoir`;
  return `${done}/${total} prêt${done > 1 ? "s" : ""}`;
}

export default function LogisticsPageClient({
  stayId,
  isEnabled,
  initialSections,
  guests,
  currentGuestId,
}: Props) {
  const [sections, setSections] =
    useState<LogisticsSectionWithItems[]>(initialSections);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<LogisticsSection | null>(
    null,
  );
  const [itemModalSectionId, setItemModalSectionId] = useState<string | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<LogisticsItem | null>(null);
  const [pageError, setPageError] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [search, setSearch] = useState("");
  const [openedSectionId, setOpenedSectionId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const allItems = sections.flatMap((section) => section.items);
    const checked = allItems.filter((item) => item.is_checked).length;
    const assigned = allItems.filter((item) => item.assigned_guest_id).length;
    const missing = allItems.length - checked;
    const mine = currentGuestId
      ? allItems.filter(
          (item) =>
            item.assigned_guest_id === currentGuestId && !item.is_checked,
        ).length
      : 0;
    const unassigned = allItems.filter(
      (item) => !item.assigned_guest_id && !item.is_checked,
    ).length;
    const progress =
      allItems.length > 0 ? Math.round((checked / allItems.length) * 100) : 0;

    return {
      totalSections: sections.length,
      totalItems: allItems.length,
      checked,
      assigned,
      missing,
      mine,
      unassigned,
      progress,
    };
  }, [currentGuestId, sections]);

  const filteredSections = useMemo(() => {
    const query = normalize(search.trim());

    return sections.filter((section) => {
      const matchesFilter =
        activeFilter === "all" || section.section_type === activeFilter;
      if (!matchesFilter) return false;

      const matchesStatus = (() => {
        if (statusFilter === "all") return true;
        if (statusFilter === "mine") {
          return Boolean(
            currentGuestId &&
            section.items.some(
              (item) =>
                item.assigned_guest_id === currentGuestId && !item.is_checked,
            ),
          );
        }
        if (statusFilter === "unassigned") {
          return section.items.some(
            (item) => !item.assigned_guest_id && !item.is_checked,
          );
        }
        if (statusFilter === "todo") {
          return (
            section.items.length === 0 ||
            section.items.some((item) => !item.is_checked)
          );
        }
        if (statusFilter === "done") {
          return (
            section.items.length > 0 &&
            section.items.every((item) => item.is_checked)
          );
        }
        return true;
      })();

      if (!matchesStatus) return false;
      if (!query) return true;

      const sectionContent = normalize(
        `${section.title} ${section.notes ?? ""} ${LOGISTICS_SECTION_LABELS[section.section_type] ?? ""}`,
      );
      const itemContent = normalize(
        section.items
          .map(
            (item) =>
              `${item.label} ${item.quantity ?? ""} ${item.notes ?? ""}`,
          )
          .join(" "),
      );

      return sectionContent.includes(query) || itemContent.includes(query);
    });
  }, [activeFilter, currentGuestId, search, sections, statusFilter]);

  if (!isEnabled) {
    return (
      <div className="lg-root">
        <div className="lg-disabled">
          <div className="lg-disabled-icon">🔒</div>
          <p>Le module Logistique n&apos;est pas activé pour ce séjour.</p>
          <p className="lg-disabled-hint">
            Contactez l&apos;organisateur pour l&apos;activer dans les
            paramètres.
          </p>
        </div>
      </div>
    );
  }

  function openCreateSection() {
    setEditingSection(null);
    setSectionModalOpen(true);
    setPageError("");
  }

  function openEditSection(section: LogisticsSection) {
    setEditingSection(section);
    setSectionModalOpen(true);
    setPageError("");
  }

  function closeSectionModal() {
    setSectionModalOpen(false);
    setEditingSection(null);
  }

  async function handleSaveSection(values: LogisticsSectionFormValues) {
    if (editingSection) {
      const updated = await updateLogisticsSection(editingSection.id, values);
      setSections((prev) =>
        prev.map((section) =>
          section.id === updated.id
            ? { ...updated, items: section.items }
            : section,
        ),
      );
      return;
    }

    const created = await createManualLogisticsSection(stayId, values);
    setSections((prev) => [...prev, { ...created, items: [] }]);
  }

  async function handleHideSection(sectionId: string) {
    if (
      !confirm(
        "Masquer cette section logistique ? Les données ne seront pas supprimées.",
      )
    )
      return;

    try {
      await hideLogisticsSection(sectionId);
      setSections((prev) => prev.filter((section) => section.id !== sectionId));
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Impossible de masquer la section.",
      );
    }
  }

  function openCreateItem(sectionId: string) {
    setItemModalSectionId(sectionId);
    setEditingItem(null);
    setPageError("");
  }

  function openEditItem(item: LogisticsItem) {
    setItemModalSectionId(item.section_id);
    setEditingItem(item);
    setPageError("");
  }

  function closeItemModal() {
    setItemModalSectionId(null);
    setEditingItem(null);
  }

  async function handleSaveItem(values: LogisticsItemFormValues) {
    if (editingItem) {
      const updated = await updateLogisticsItem(editingItem.id, values);
      replaceItem(updated);
      return;
    }

    if (!itemModalSectionId) return;
    const created = await createLogisticsItem(itemModalSectionId, values);
    setSections((prev) =>
      prev.map((section) =>
        section.id === created.section_id
          ? { ...section, items: [...section.items, created] }
          : section,
      ),
    );
  }

  async function handleAssignItem(itemId: string, guestId: string | null) {
    try {
      const updated = await assignLogisticsItem(itemId, guestId);
      replaceItem(updated);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier l'attribution.",
      );
    }
  }

  async function handleTakeItem(item: LogisticsItem) {
    if (!currentGuestId) {
      setPageError(
        "Créez votre fiche invité pour pouvoir vous attribuer un élément.",
      );
      return;
    }

    await handleAssignItem(item.id, currentGuestId);
  }

  async function handleToggleItem(item: LogisticsItem) {
    try {
      const updated = await toggleLogisticsItem(item.id, !item.is_checked);
      replaceItem(updated);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Impossible de cocher cet élément.",
      );
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Supprimer cet élément ?")) return;

    try {
      await deleteLogisticsItem(itemId);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.filter((item) => item.id !== itemId),
        })),
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer l'élément.",
      );
    }
  }

  function replaceItem(updated: LogisticsItem) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === updated.section_id
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : section,
      ),
    );
  }

  const openedSection = openedSectionId
    ? (sections.find((section) => section.id === openedSectionId) ?? null)
    : null;

  const openedSectionProgress = openedSection
    ? (() => {
        const checkedCount = openedSection.items.filter(
          (item) => item.is_checked,
        ).length;
        const totalCount = openedSection.items.length;
        return {
          checkedCount,
          totalCount,
          progress:
            totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0,
          progressLabel: getProgressLabel(checkedCount, totalCount),
        };
      })()
    : null;

  const activeFilters = FILTERS.filter(
    (filter) =>
      filter === "all" ||
      sections.some((section) => section.section_type === filter),
  );

  return (
    <div className="lg-root">
      <div className="lg-toolbar">
        <div className="lg-toolbar-left">
          <h1 className="lg-page-title">
            <span className="ti">📋</span> Logistique
          </h1>
        </div>

        <div className="lg-toolbar-right">
          <button className="lg-btn-primary" onClick={openCreateSection}>
            + Ajouter
          </button>
        </div>
      </div>

      <div className="lg-hero-card">
        <div>
          <p className="lg-eyebrow">À prévoir ensemble</p>
          <h2>Repas, apéros, couchage, matériel…</h2>
          <p>
            La page reste volontairement compacte. Appuyez sur une section pour
            voir le détail, ajouter des éléments ou vous attribuer quelque
            chose.
          </p>
        </div>
        <div
          className="lg-progress-circle"
          aria-label={`${stats.progress}% prêt`}
        >
          <span>{stats.progress}%</span>
          <small>prêt</small>
        </div>
      </div>

      <div className="lg-stats">
        <div className="lg-stat-card">
          <span className="lg-stat-value">{stats.totalSections}</span>
          <span className="lg-stat-label">
            section{stats.totalSections > 1 ? "s" : ""}
          </span>
        </div>
        <div className="lg-stat-card">
          <span className="lg-stat-value">{stats.mine}</span>
          <span className="lg-stat-label">à moi</span>
        </div>
        <div className="lg-stat-card">
          <span className="lg-stat-value">{stats.unassigned}</span>
          <span className="lg-stat-label">
            non attribué{stats.unassigned > 1 ? "s" : ""}
          </span>
        </div>
        <div className="lg-stat-card">
          <span className="lg-stat-value">{stats.missing}</span>
          <span className="lg-stat-label">à finaliser</span>
        </div>
      </div>

      <div className="lg-tools">
        <div className="lg-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher : matelas, boissons, apéro…"
          />
        </div>

        <div className="lg-filter-block">
          <p className="lg-filter-label">Priorité</p>
          <div className="lg-filters">
            {STATUS_FILTERS.filter(
              (filter) => filter.key !== "mine" || currentGuestId,
            ).map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`lg-tag lg-status-tag lg-status-tag-${filter.key}${statusFilter === filter.key ? " active" : ""}`}
                onClick={() => setStatusFilter(filter.key)}
              >
                <span>{filter.icon}</span> {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg-filter-block">
          <p className="lg-filter-label">Catégorie</p>
          <div className="lg-filters">
            {activeFilters.map((filter) => {
              const label =
                filter === "all"
                  ? "Tout"
                  : (LOGISTICS_SECTION_LABELS[filter] ?? filter);
              const icon =
                filter === "all"
                  ? "✨"
                  : (LOGISTICS_SECTION_ICONS[filter] ?? "📌");

              return (
                <button
                  key={filter}
                  type="button"
                  className={`lg-tag lg-tag-${filter}${activeFilter === filter ? " active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  <span>{icon}</span> {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {pageError && <div className="lg-error">{pageError}</div>}

      {sections.length === 0 ? (
        <div className="lg-empty">
          <div className="lg-empty-icon">🧺</div>
          <p>Aucune logistique pour l&apos;instant.</p>
          <p>
            Ajoutez une section comme “Apéro samedi soir”, “Couchage” ou
            “Matériel cuisine”.
          </p>
          <button className="lg-btn-primary" onClick={openCreateSection}>
            Créer la première section
          </button>
        </div>
      ) : filteredSections.length === 0 ? (
        <div className="lg-empty">
          <div className="lg-empty-icon">🔎</div>
          <p>Aucun résultat avec ces filtres.</p>
          <p>
            Essayez de modifier la recherche ou d&apos;afficher toutes les
            sections.
          </p>
          <button
            className="lg-btn-ghost"
            onClick={() => {
              setSearch("");
              setActiveFilter("all");
              setStatusFilter("all");
            }}
          >
            Réinitialiser
          </button>
        </div>
      ) : (
        <div className="lg-sections lg-sections-compact">
          {filteredSections.map((section) => {
            const checkedCount = section.items.filter(
              (item) => item.is_checked,
            ).length;
            const totalCount = section.items.length;
            const progress =
              totalCount > 0
                ? Math.round((checkedCount / totalCount) * 100)
                : 0;

            return (
              <LogisticsSectionCard
                key={section.id}
                section={section}
                guests={guests}
                progress={progress}
                progressLabel={getProgressLabel(checkedCount, totalCount)}
                onOpenSection={setOpenedSectionId}
                onAddItem={openCreateItem}
                onEditSection={openEditSection}
                onHideSection={handleHideSection}
              />
            );
          })}
        </div>
      )}

      {openedSection && openedSectionProgress && (
        <LogisticsSectionDetailModal
          section={openedSection}
          guests={guests}
          currentGuestId={currentGuestId}
          progress={openedSectionProgress.progress}
          progressLabel={openedSectionProgress.progressLabel}
          onClose={() => setOpenedSectionId(null)}
          onAddItem={openCreateItem}
          onEditSection={openEditSection}
          onHideSection={handleHideSection}
          onEditItem={openEditItem}
          onAssignItem={handleAssignItem}
          onTakeItem={handleTakeItem}
          onToggleItem={handleToggleItem}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {sectionModalOpen && (
        <LogisticsSectionModal
          editSection={editingSection}
          onSave={handleSaveSection}
          onClose={closeSectionModal}
        />
      )}

      {itemModalSectionId && (
        <LogisticsItemModal
          guests={guests}
          editItem={editingItem}
          onSave={handleSaveItem}
          onClose={closeItemModal}
        />
      )}
    </div>
  );
}
