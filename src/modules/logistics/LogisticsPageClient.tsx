"use client";

import { useEffect, useMemo, useState } from "react";
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
  fetchLogisticsSections,
} from "./logistics.service";
import LogisticsSectionCard from "./components/LogisticsSectionCard";
import LogisticsSectionDetailModal from "./components/LogisticsSectionDetailModal";
import LogisticsItemRow from "./components/LogisticsItemRow";
import LogisticsSectionModal from "./components/LogisticsSectionModal";
import LogisticsItemModal from "./components/LogisticsItemModal";
import TemplatesPicker from "@/modules/templates/TemplatesPicker";
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
type ViewMode = "sections" | "list" | "people";

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
  { key: "todo", label: "À prévoir", icon: "⏳" },
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
  const [viewMode, setViewMode] = useState<ViewMode>("sections");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  async function refreshSections() {
    try {
      const freshSections = await fetchLogisticsSections(stayId);
      setSections(freshSections);
      setOpenedSectionId((current) =>
        current && freshSections.some((section) => section.id === current)
          ? current
          : null,
      );
    } catch (error) {
      console.warn("Impossible de rafraîchir la logistique", error);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshSectionsOnMount() {
      try {
        const freshSections = await fetchLogisticsSections(stayId);
        if (cancelled) return;

        setSections(freshSections);
        setOpenedSectionId((current) =>
          current && freshSections.some((section) => section.id === current)
            ? current
            : null,
        );
      } catch (error) {
        console.warn("Impossible de rafraîchir la logistique", error);
      }
    }

    void refreshSectionsOnMount();

    const handleFocus = () => {
      void refreshSections();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSections();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stayId]);

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

  const filteredItems = useMemo(() => {
    const query = normalize(search.trim());

    const rows = sections.flatMap((section) =>
      section.items.map((item) => ({ section, item })),
    );

    return rows.filter(({ section, item }) => {
      if (activeFilter !== "all" && section.section_type !== activeFilter)
        return false;

      if (statusFilter === "mine") {
        if (
          !currentGuestId ||
          item.assigned_guest_id !== currentGuestId ||
          item.is_checked
        )
          return false;
      }

      if (
        statusFilter === "unassigned" &&
        (item.assigned_guest_id || item.is_checked)
      )
        return false;
      if (statusFilter === "todo" && item.is_checked) return false;
      if (statusFilter === "done" && !item.is_checked) return false;

      if (!query) return true;

      const content = normalize(
        `${section.title} ${section.notes ?? ""} ${item.label} ${item.quantity ?? ""} ${item.notes ?? ""}`,
      );

      return content.includes(query);
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

  async function handleQuickAddItem(sectionId: string, label: string) {
    try {
      const created = await createLogisticsItem(sectionId, {
        label,
        quantity: "1",
        notes: "",
        assigned_guest_id: "",
      });

      setSections((prev) =>
        prev.map((section) =>
          section.id === created.section_id
            ? { ...section, items: [...section.items, created] }
            : section,
        ),
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter l'élément.",
      );
    }
  }

  async function handleQuantityChange(item: LogisticsItem, delta: number) {
    const currentQuantity = Number.parseInt(item.quantity ?? "1", 10);
    const nextQuantity = Math.max(
      1,
      (Number.isFinite(currentQuantity) ? currentQuantity : 1) + delta,
    );

    try {
      const updated = await updateLogisticsItem(item.id, {
        label: item.label,
        quantity: String(nextQuantity),
        notes: item.notes ?? "",
        assigned_guest_id: item.assigned_guest_id ?? "",
      });
      replaceItem(updated);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier la quantité.",
      );
    }
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

  const itemsByPerson = useMemo(() => {
    const rows = sections.flatMap((section) =>
      section.items.map((item) => ({ section, item })),
    );

    const guestMap = new Map(guests.map((guest) => [guest.id, guest]));
    const groups = new Map<string, { label: string; items: typeof rows }>();

    for (const row of rows) {
      const guest = row.item.assigned_guest_id
        ? guestMap.get(row.item.assigned_guest_id)
        : null;
      const key = guest?.id ?? "unassigned";
      const label = guest
        ? `${guest.first_name}${guest.last_name ? ` ${guest.last_name}` : ""}`
        : "Non attribué";

      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(row);
    }

    return Array.from(groups.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => (a.key === "unassigned" ? 1 : b.key === "unassigned" ? -1 : a.label.localeCompare(b.label)));
  }, [guests, sections]);

  function buildShareSummary() {
    const lines = [`Résumé logistique du séjour`, ""];

    for (const group of itemsByPerson) {
      lines.push(`${group.label} :`);
      const activeItems = group.items.filter(({ item }) => !item.is_checked);
      if (activeItems.length === 0) {
        lines.push("- Rien à prévoir");
      } else {
        activeItems.forEach(({ section, item }) => {
          lines.push(`- ${item.label}${item.quantity ? ` · ${item.quantity}` : ""} (${section.title})`);
        });
      }
      lines.push("");
    }

    lines.push(`${window.location.origin}/stays/${stayId}`);
    return lines.join("\n");
  }

  async function handleCopyShareSummary() {
    await navigator.clipboard.writeText(buildShareSummary());
    setPageError("Résumé copié. Vous pouvez le coller dans WhatsApp.");
    setTimeout(() => setPageError(""), 2500);
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(buildShareSummary());
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="lg-root">
      <div className="lg-toolbar">
        <div className="lg-toolbar-left">
          <h1 className="lg-page-title">
            <span className="ti">📋</span> Logistique
          </h1>
        </div>

        <div className="lg-toolbar-right">
          <div className="lg-view-toggle lg-toolbar-tabs" aria-label="Choix de vue">
            <button
              type="button"
              className={`lg-view-btn${viewMode === "sections" ? " active" : ""}`}
              onClick={() => setViewMode("sections")}
            >
              Sections
            </button>
            <button
              type="button"
              className={`lg-view-btn${viewMode === "list" ? " active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <span className="lg-label-desktop">Liste générale</span>
              <span className="lg-label-mobile">Liste</span>
            </button>
            <button
              type="button"
              className={`lg-view-btn${viewMode === "people" ? " active" : ""}`}
              onClick={() => setViewMode("people")}
            >
              <span className="lg-label-desktop">Qui apporte quoi ?</span>
              <span className="lg-label-mobile">Apports</span>
            </button>
          </div>

          <div className="lg-toolbar-actions" aria-label="Actions logistique">
            <button className="lg-btn-ghost" onClick={handleCopyShareSummary}>
              <span className="lg-label-desktop">Copier résumé</span>
              <span className="lg-label-mobile">Copier</span>
            </button>
            <button className="lg-btn-ghost" onClick={handleShareWhatsApp}>
              WhatsApp
            </button>
            <button className="lg-btn-ghost" onClick={() => setTemplatesOpen(true)}>
              Modèles
            </button>
            <button className="lg-btn-primary" onClick={openCreateSection}>
              + Ajouter
            </button>
          </div>
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
          <div className="lg-empty-actions">
            <button className="lg-btn-primary" onClick={() => setTemplatesOpen(true)}>
              Ajouter depuis un modèle
            </button>
            <button className="lg-btn-ghost" onClick={openCreateSection}>
              Créer une section vide
            </button>
          </div>
        </div>
      ) : viewMode === "people" ? (
        <div className="lg-people-list">
          <div className="lg-general-list-header">
            <div>
              <p className="lg-eyebrow">Vue par personne</p>
              <h2>Qui apporte quoi ?</h2>
            </div>
            <span>{itemsByPerson.length} groupe{itemsByPerson.length > 1 ? "s" : ""}</span>
          </div>

          {itemsByPerson.map((group) => (
            <section key={group.key} className="lg-person-group">
              <div className="lg-person-group-head">
                <h3>{group.label}</h3>
                <span>{group.items.filter(({ item }) => !item.is_checked).length} à prévoir</span>
              </div>
              <div className="lg-items-list">
                {group.items.map(({ section, item }) => (
                  <LogisticsItemRow
                    key={item.id}
                    item={item}
                    guests={guests}
                    currentGuestId={currentGuestId}
                    onEdit={openEditItem}
                    onAssign={handleAssignItem}
                    onTake={handleTakeItem}
                    onToggle={handleToggleItem}
                    onDelete={handleDeleteItem}
                    onQuantityChange={handleQuantityChange}
                    isSourceLocked={
                      item.source_type === "accommodation_bed" ||
                      section.source_type === "accommodation_bed" ||
                      Boolean(item.notes?.toLowerCase().includes("module couchage"))
                    }
                    sectionTitle={section.title}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : viewMode === "list" ? (
        filteredItems.length === 0 ? (
          <div className="lg-empty">
            <div className="lg-empty-icon">🔎</div>
            <p>Aucun élément avec ces filtres.</p>
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
          <div className="lg-general-list">
            <div className="lg-general-list-header">
              <div>
                <p className="lg-eyebrow">Liste générale</p>
                <h2>
                  {filteredItems.length} élément
                  {filteredItems.length > 1 ? "s" : ""} à suivre
                </h2>
              </div>
              <span>Tout le séjour</span>
            </div>
            <div className="lg-items-list">
              {filteredItems.map(({ section, item }) => (
                <LogisticsItemRow
                  key={item.id}
                  item={item}
                  guests={guests}
                  currentGuestId={currentGuestId}
                  onEdit={openEditItem}
                  onAssign={handleAssignItem}
                  onTake={handleTakeItem}
                  onToggle={handleToggleItem}
                  onDelete={handleDeleteItem}
                  onQuantityChange={handleQuantityChange}
                  isSourceLocked={
                    item.source_type === "accommodation_bed" ||
                    section.source_type === "accommodation_bed" ||
                    Boolean(
                      item.notes?.toLowerCase().includes("module couchage"),
                    )
                  }
                  sectionTitle={section.title}
                />
              ))}
            </div>
          </div>
        )
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
          onQuickAddItem={handleQuickAddItem}
          onQuantityChange={handleQuantityChange}
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

      {templatesOpen && (
        <div className="lg-template-modal" role="dialog" aria-modal="true">
          <div className="lg-template-backdrop" onClick={() => setTemplatesOpen(false)} />
          <div className="lg-template-panel">
            <div className="lg-template-panel-head">
              <div>
                <p className="lg-eyebrow">Modèles</p>
                <h2>Ajouter depuis un modèle</h2>
                <span>Le modèle ajoute des sections et objets. Rien n’est supprimé.</span>
              </div>
              <button type="button" onClick={() => setTemplatesOpen(false)} aria-label="Fermer">
                ×
              </button>
            </div>
            <TemplatesPicker
              stayId={stayId}
              onApplied={() => {
                void refreshSections();
              }}
              onClose={() => {
                setTemplatesOpen(false);
                void refreshSections();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
