"use client";
import { createClient } from "@/lib/supabase/client";

export type StayPersonalChecklistItem = { id: string; stay_id: string; user_id: string; title: string; is_done: boolean; position: number };
export type PersonalChecklistTemplate = { id: string; user_id: string; name: string; items?: { id: string; title: string; position: number }[] };

export async function fetchStayPersonalChecklist(stayId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("stay_personal_checklist_items").select("*").eq("stay_id", stayId).order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StayPersonalChecklistItem[];
}
export async function addStayPersonalChecklistItem(stayId: string, title: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée.");
  const { data, error } = await supabase.from("stay_personal_checklist_items").insert({ stay_id: stayId, user_id: user.id, title }).select("*").single();
  if (error) throw new Error(error.message);
  return data as StayPersonalChecklistItem;
}
export async function toggleStayPersonalChecklistItem(id: string, isDone: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase.from("stay_personal_checklist_items").update({ is_done: isDone }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as StayPersonalChecklistItem;
}
export async function deleteStayPersonalChecklistItem(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("stay_personal_checklist_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchPersonalTemplates() {
  const supabase = createClient();
  const { data: templates, error } = await supabase
    .from("personal_checklist_templates")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const templateIds = (templates ?? []).map((template) => template.id);
  const { data: items, error: itemsError } = templateIds.length
    ? await supabase
        .from("personal_checklist_template_items")
        .select("*")
        .in("template_id", templateIds)
        .order("position", { ascending: true })
    : { data: [], error: null };
  if (itemsError) throw new Error(itemsError.message);
  return (templates ?? []).map((template) => ({
    ...template,
    items: (items ?? []).filter((item) => item.template_id === template.id),
  })) as PersonalChecklistTemplate[];
}

export async function createPersonalTemplate(name: string, titles: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée.");
  const { data: template, error } = await supabase
    .from("personal_checklist_templates")
    .insert({ user_id: user.id, name })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const rows = titles.filter(Boolean).map((title, index) => ({ template_id: template.id, title, position: index }));
  if (rows.length) {
    const { error: itemError } = await supabase.from("personal_checklist_template_items").insert(rows);
    if (itemError) throw new Error(itemError.message);
  }
  return template as PersonalChecklistTemplate;
}
