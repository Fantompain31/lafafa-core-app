"use client";

import { useState } from "react";
import type { MemberRole } from "@/shared/types/database.types";
import type { PracticalInfo } from "./practical-info.types";
import { deletePracticalInfo, upsertPracticalInfo } from "./practical-info.service";
import "./practical-info.css";

type Props = { stayId: string; myRole: MemberRole; initialInfos: PracticalInfo[] };

const DEFAULT_INFOS = [
  { label: "Adresse", kind: "address" },
  { label: "Wi-Fi", kind: "wifi" },
  { label: "Code portail", kind: "code" },
  { label: "Parking", kind: "parking" },
];

export default function PracticalInfoPageClient({ stayId, myRole, initialInfos }: Props) {
  const [infos, setInfos] = useState(initialInfos);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = myRole === "owner" || myRole === "co_organizer";

  async function addInfo(preset?: { label: string; kind: string }) {
    const nextLabel = preset?.label ?? label.trim();
    if (!nextLabel) return;
    setSaving(true);
    try {
      const created = await upsertPracticalInfo(stayId, { label: nextLabel, value: preset ? "" : value.trim(), kind: preset?.kind ?? "text", position: infos.length });
      setInfos((current) => [...current, created]);
      setLabel("");
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  async function removeInfo(id: string) {
    if (!confirm("Supprimer cette information ?")) return;
    await deletePracticalInfo(id);
    setInfos((current) => current.filter((info) => info.id !== id));
  }

  async function copyValue(value: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  }

  return (
    <div className="pi-root">
      <div className="pi-header">
        <p>Infos pratiques</p>
        <h1>Tout ce qu’il faut savoir sur le séjour</h1>
        <span>Adresse, Wi-Fi, parking, codes, consignes…</span>
      </div>

      {canEdit && infos.length === 0 && (
        <div className="pi-presets">
          {DEFAULT_INFOS.map((preset) => (
            <button key={preset.kind} type="button" onClick={() => void addInfo(preset)}>+ {preset.label}</button>
          ))}
        </div>
      )}

      <div className="pi-list">
        {infos.length === 0 ? <div className="pi-empty">Aucune info pratique pour l’instant.</div> : infos.map((info) => (
          <article key={info.id} className="pi-card">
            <div>
              <p>{info.label}</p>
              <strong>{info.value || "À compléter"}</strong>
            </div>
            <div className="pi-actions">
              {info.value && <button type="button" onClick={() => void copyValue(info.value)}>Copier</button>}
              {info.kind === "address" && info.value && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.value)}`} target="_blank" rel="noreferrer">Maps</a>
              )}
              {canEdit && <button type="button" onClick={() => void removeInfo(info.id)}>Supprimer</button>}
            </div>
          </article>
        ))}
      </div>

      {canEdit && (
        <form className="pi-form" onSubmit={(event) => { event.preventDefault(); void addInfo(); }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Titre : Code portail, Wi-Fi…" />
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Information" />
          <button disabled={saving || !label.trim()} type="submit">Ajouter</button>
        </form>
      )}
    </div>
  );
}
