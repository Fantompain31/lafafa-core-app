"use client";

import { useMemo, useState } from "react";
import {
  createPersonalTemplate,
  type PersonalChecklistTemplate,
} from "./personal-checklists.service";
import "./personal-checklists.css";

export function ProfilePersonalListsClient({
  initialTemplates,
}: {
  initialTemplates: PersonalChecklistTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("");
  const [draftItem, setDraftItem] = useState("");
  const [draftItems, setDraftItems] = useState<string[]>([
    "Chargeur",
    "Trousse de toilette",
    "Serviette",
    "Pyjama",
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canCreate = useMemo(
    () => name.trim().length > 0 && draftItems.length > 0 && !loading,
    [draftItems.length, loading, name],
  );

  function addDraftItem() {
    const title = draftItem.trim();
    if (!title) return;

    setDraftItems((current) =>
      current.some((item) => item.toLowerCase() === title.toLowerCase())
        ? current
        : [...current, title],
    );
    setDraftItem("");
  }

  function removeDraftItem(index: number) {
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function createTemplate() {
    const templateName = name.trim();
    if (!templateName || draftItems.length === 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const created = await createPersonalTemplate(templateName, draftItems);
      setTemplates((current) => [
        ...current,
        {
          ...created,
          items: draftItems.map((title, index) => ({
            id: `${created.id}-${index}`,
            title,
            position: index,
          })),
        },
      ]);
      setName("");
      setDraftItems([]);
      setMessage("Liste enregistrée. Vous pourrez l’importer dans vos séjours.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de créer la liste.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pcl-root">
      <div className="pcl-header">
        <p>Mes listes modèles</p>
        <h1>Préparez vos listes une fois, réutilisez-les dans vos séjours</h1>
        <span>
          Créez vos listes types ici, puis importez seulement les éléments utiles dans chaque séjour.
        </span>
      </div>

      <div className="pcl-form pcl-template-builder">
        <label className="pcl-field">
          <span>Nom de la liste</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Liste week-end, plage, mariage..."
          />
        </label>

        <div className="pcl-quick-add">
          <span>Éléments</span>
          <div className="pcl-quick-add-row">
            <input
              value={draftItem}
              onChange={(event) => setDraftItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addDraftItem();
                }
              }}
              placeholder="Ajouter rapidement : chargeur, serviette..."
            />
            <button type="button" onClick={addDraftItem}>
              + Ajouter
            </button>
          </div>
        </div>

        <div className="pcl-draft-items">
          {draftItems.length === 0 ? (
            <span className="pcl-muted">Ajoutez au moins un élément pour créer la liste.</span>
          ) : (
            draftItems.map((item, index) => (
              <span key={`${item}-${index}`} className="pcl-draft-chip">
                {item}
                <button type="button" onClick={() => removeDraftItem(index)} aria-label={`Retirer ${item}`}>
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        {message && <p className="pcl-message">{message}</p>}

        <button type="button" onClick={() => void createTemplate()} disabled={!canCreate}>
          {loading ? "Création…" : "Créer la liste"}
        </button>
      </div>

      <div className="pcl-list">
        {templates.length === 0 ? (
          <div className="pcl-empty">Aucune liste enregistrée.</div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="pcl-row pcl-template-row">
              <div>
                <span className="pcl-row-title">{template.name}</span>
                <small>
                  {template.items?.length
                    ? template.items.map((item) => item.title).join(", ")
                    : "Aucun élément"}
                </small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
