"use client";

import { useMemo, useState } from "react";
import {
  addStayPersonalChecklistItem,
  deleteStayPersonalChecklistItem,
  fetchPersonalTemplates,
  importPersonalTemplateToStay,
  toggleStayPersonalChecklistItem,
  type PersonalChecklistTemplate,
  type StayPersonalChecklistItem,
} from "./personal-checklists.service";
import "./personal-checklists.css";

export function PersonalChecklistClient({
  stayId,
  initialItems,
}: {
  stayId: string;
  initialItems: StayPersonalChecklistItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [templates, setTemplates] = useState<PersonalChecklistTemplate[] | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((item) => item.is_done).length;

  const selectedTemplate = useMemo(
    () => templates?.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  async function addItem() {
    const value = title.trim();
    if (!value) return;

    setSaving(true);
    setError(null);

    try {
      const created = await addStayPersonalChecklistItem(stayId, value);
      setItems((current) => [...current, created]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’ajouter l’élément.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: StayPersonalChecklistItem) {
    const previous = items;

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, is_done: !item.is_done }
          : currentItem,
      ),
    );

    try {
      const updated = await toggleStayPersonalChecklistItem(item.id, !item.is_done);
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? updated : currentItem,
        ),
      );
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Impossible de modifier l’élément.");
    }
  }

  async function remove(id: string) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));

    try {
      await deleteStayPersonalChecklistItem(id);
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Impossible de supprimer l’élément.");
    }
  }

  async function openImport() {
    setImportOpen(true);
    setError(null);

    if (templates !== null) return;

    setLoadingTemplates(true);

    try {
      const data = await fetchPersonalTemplates();
      setTemplates(data);
      const first = data[0];
      if (first) {
        setSelectedTemplateId(first.id);
        setSelectedTitles(first.items?.map((item) => item.title) ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos listes modèles.");
    } finally {
      setLoadingTemplates(false);
    }
  }

  function selectTemplate(templateId: string) {
    const template = templates?.find((item) => item.id === templateId) ?? null;
    setSelectedTemplateId(templateId);
    setSelectedTitles(template?.items?.map((item) => item.title) ?? []);
  }

  function toggleSelectedTitle(titleToToggle: string) {
    setSelectedTitles((current) =>
      current.includes(titleToToggle)
        ? current.filter((title) => title !== titleToToggle)
        : [...current, titleToToggle],
    );
  }

  async function importSelectedItems() {
    if (!selectedTemplate || selectedTitles.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const imported = await importPersonalTemplateToStay(stayId, selectedTitles);
      setItems((current) => [...current, ...imported]);
      setImportOpen(false);
      setSelectedTitles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’importer cette liste.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pcl-root">
      <div className="pcl-header">
        <div>
          <p>Ma liste privée</p>
          <h1>Ce que je veux penser à prendre</h1>
          <span>
            {done}/{items.length} prêts · visible uniquement par vous
          </span>
        </div>
        <button type="button" className="pcl-secondary-btn" onClick={() => void openImport()}>
          Importer une liste
        </button>
      </div>

      {error && <div className="pcl-error">{error}</div>}

      <form
        className="pcl-form"
        onSubmit={(event) => {
          event.preventDefault();
          void addItem();
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Chargeur, tenue, médicaments…"
        />
        <button disabled={saving}>{saving ? "Ajout…" : "Ajouter"}</button>
      </form>

      <div className="pcl-list">
        {items.length === 0 ? (
          <div className="pcl-empty">
            Votre liste est vide. Ajoutez un élément ou importez une liste enregistrée dans votre profil.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`pcl-row${item.is_done ? " done" : ""}`}>
              <button
                type="button"
                onClick={() => void toggle(item)}
                aria-label={item.is_done ? "Marquer à refaire" : "Marquer prêt"}
              >
                {item.is_done ? "✓" : ""}
              </button>
              <span>{item.title}</span>
              <button type="button" onClick={() => void remove(item.id)} aria-label="Supprimer">
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {importOpen && (
        <div className="pcl-modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="pcl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="pcl-modal-header">
              <div>
                <p>Importer</p>
                <h2>Importer depuis mes listes</h2>
              </div>
              <button type="button" onClick={() => setImportOpen(false)} aria-label="Fermer">
                ×
              </button>
            </div>

            {loadingTemplates ? (
              <div className="pcl-empty">Chargement de vos listes…</div>
            ) : !templates || templates.length === 0 ? (
              <div className="pcl-empty">
                Aucune liste enregistrée dans votre profil. Créez une liste dans Profil → Mes listes.
              </div>
            ) : (
              <>
                <label className="pcl-field">
                  <span>Liste à importer</span>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => selectTemplate(event.target.value)}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="pcl-import-items">
                  {(selectedTemplate?.items ?? []).map((item) => (
                    <label key={item.id} className="pcl-import-row">
                      <input
                        type="checkbox"
                        checked={selectedTitles.includes(item.title)}
                        onChange={() => toggleSelectedTitle(item.title)}
                      />
                      <span>{item.title}</span>
                    </label>
                  ))}
                </div>

                <div className="pcl-modal-actions">
                  <button type="button" className="pcl-secondary-btn" onClick={() => setImportOpen(false)}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="pcl-primary-btn"
                    disabled={saving || selectedTitles.length === 0}
                    onClick={() => void importSelectedItems()}
                  >
                    {saving ? "Import…" : `Importer ${selectedTitles.length} élément${selectedTitles.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
