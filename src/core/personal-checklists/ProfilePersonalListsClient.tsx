"use client";

import { useState } from "react";
import {
  createPersonalTemplate,
  deletePersonalTemplate,
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
  const [itemsText, setItemsText] = useState(
    "Chargeur\nTrousse de toilette\nServiette\nPyjama",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTemplate() {
    const templateName = name.trim();
    const titles = itemsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!templateName) {
      setError("Donnez un nom à votre liste.");
      return;
    }

    if (titles.length === 0) {
      setError("Ajoutez au moins un élément à la liste.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createPersonalTemplate(templateName, titles);
      setTemplates((current) => [...current, created]);
      setName("");
      setItemsText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la liste.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate(templateId: string) {
    const confirmed = confirm(
      "Supprimer cette liste modèle ? Les listes déjà importées dans vos séjours ne seront pas supprimées.",
    );

    if (!confirmed) return;

    const previous = templates;
    setTemplates((current) => current.filter((template) => template.id !== templateId));

    try {
      await deletePersonalTemplate(templateId);
    } catch (err) {
      setTemplates(previous);
      setError(err instanceof Error ? err.message : "Impossible de supprimer la liste.");
    }
  }

  return (
    <div className="pcl-root">
      <div className="pcl-header">
        <div>
          <p>Mes listes modèles</p>
          <h1>Préparez vos listes une fois, réutilisez-les dans vos séjours</h1>
          <span>Week-end, plage, mariage, sport… Ces listes restent privées.</span>
        </div>
      </div>

      {error && <div className="pcl-error">{error}</div>}

      <div className="pcl-template-form">
        <label className="pcl-field">
          <span>Nom de la liste</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Liste week-end, plage, mariage…"
          />
        </label>

        <label className="pcl-field">
          <span>Éléments, un par ligne</span>
          <textarea
            value={itemsText}
            onChange={(event) => setItemsText(event.target.value)}
            placeholder={"Chargeur\nTrousse de toilette\nServiette"}
          />
        </label>

        <button
          type="button"
          className="pcl-primary-btn"
          disabled={saving}
          onClick={() => void createTemplate()}
        >
          {saving ? "Création…" : "Créer la liste"}
        </button>
      </div>

      <div className="pcl-list">
        {templates.length === 0 ? (
          <div className="pcl-empty">
            Aucune liste enregistrée. Créez votre première liste pour pouvoir l’importer dans un séjour.
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="pcl-template-card">
              <div>
                <strong>{template.name}</strong>
                <small>
                  {(template.items ?? []).length > 0
                    ? template.items?.map((item) => item.title).join(", ")
                    : "Aucun élément"}
                </small>
              </div>

              <button
                type="button"
                className="pcl-danger-btn"
                onClick={() => void removeTemplate(template.id)}
              >
                Supprimer
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
