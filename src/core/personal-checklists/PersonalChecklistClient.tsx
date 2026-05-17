"use client";
import { useState } from "react";
import { addStayPersonalChecklistItem, deleteStayPersonalChecklistItem, toggleStayPersonalChecklistItem, type StayPersonalChecklistItem } from "./personal-checklists.service";
import "./personal-checklists.css";

export function PersonalChecklistClient({ stayId, initialItems }: { stayId: string; initialItems: StayPersonalChecklistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const done = items.filter((i) => i.is_done).length;
  async function addItem() {
    const value = title.trim();
    if (!value) return;
    const created = await addStayPersonalChecklistItem(stayId, value);
    setItems((current) => [...current, created]);
    setTitle("");
  }
  async function toggle(item: StayPersonalChecklistItem) {
    const updated = await toggleStayPersonalChecklistItem(item.id, !item.is_done);
    setItems((current) => current.map((i) => (i.id === item.id ? updated : i)));
  }
  async function remove(id: string) {
    await deleteStayPersonalChecklistItem(id);
    setItems((current) => current.filter((i) => i.id !== id));
  }
  return <div className="pcl-root"><div className="pcl-header"><p>Ma liste privée</p><h1>Ce que je veux penser à prendre</h1><span>{done}/{items.length} prêts · visible uniquement par vous</span></div><form className="pcl-form" onSubmit={(e)=>{e.preventDefault(); void addItem();}}><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Chargeur, tenue, médicaments…"/><button>Ajouter</button></form><div className="pcl-list">{items.length===0?<div className="pcl-empty">Votre liste est vide.</div>:items.map((item)=><div key={item.id} className={`pcl-row${item.is_done?" done":""}`}><button type="button" onClick={()=>void toggle(item)}>{item.is_done?"✓":""}</button><span>{item.title}</span><button type="button" onClick={()=>void remove(item.id)}>×</button></div>)}</div></div>
}
