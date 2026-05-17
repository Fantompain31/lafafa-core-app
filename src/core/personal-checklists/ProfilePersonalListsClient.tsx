"use client";
import { useState } from "react";
import { createPersonalTemplate, type PersonalChecklistTemplate } from "./personal-checklists.service";
import "./personal-checklists.css";

export function ProfilePersonalListsClient({ initialTemplates }: { initialTemplates: PersonalChecklistTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("");
  const [itemsText, setItemsText] = useState("Chargeur\nTrousse de toilette\nServiette");

  async function createTemplate() {
    const templateName = name.trim();
    if (!templateName) return;
    const titles = itemsText.split("\n").map((line) => line.trim()).filter(Boolean);
    const created = await createPersonalTemplate(templateName, titles);
    setTemplates((current) => [...current, { ...created, items: titles.map((title, index) => ({ id: `${created.id}-${index}`, title, position: index })) }]);
    setName("");
  }

  return <div className="pcl-root"><div className="pcl-header"><p>Mes listes modèles</p><h1>Préparez vos listes une fois, réutilisez-les dans vos séjours</h1><span>Week-end, plage, mariage, sport…</span></div><div className="pcl-form" style={{alignItems:'stretch'}}><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nom de la liste"/><textarea value={itemsText} onChange={(e)=>setItemsText(e.target.value)} style={{border:'1px solid rgba(196,168,130,.3)',borderRadius:'.75rem',padding:'.7rem',minHeight:90}}/><button type="button" onClick={()=>void createTemplate()}>Créer</button></div><div className="pcl-list">{templates.length===0?<div className="pcl-empty">Aucune liste enregistrée.</div>:templates.map((template)=><div key={template.id} className="pcl-row" style={{alignItems:'flex-start'}}><span style={{fontWeight:800}}>{template.name}</span><small style={{color:'#8f7f70'}}>{template.items?.map((item)=>item.title).join(', ')}</small></div>)}</div></div>;
}
