"use client";
import { createClient } from "@/lib/supabase/client";

export type StayPersonalChecklistItem = {
  id: string;
  stay_id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  position: number;
};

export type PersonalChecklistTemplateItem = {
  id: string;
  template_id?: string;
  title: string;
  position: number;
};

export type PersonalChecklistTemplate = {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  items?: PersonalChecklistTemplateItem[];
};

export async function fetchStayPersonalChecklist(stayId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stay_personal_checklist_items")
    .select("*")
    .eq("stay_id", stayId)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StayPersonalChecklistItem[];
}

export async function addStayPersonalChecklistItem(stayId: string, title: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Session expirée.");

  const { count } = await supabase
    .from("stay_personal_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("stay_id", stayId)
    .eq("user_id", user.id);

  const { data, error } = await supabase
    .from("stay_personal_checklist_items")
    .insert({
      stay_id: stayId,
      user_id: user.id,
      title,
      position: count ?? 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as StayPersonalChecklistItem;
}

export async function importPersonalTemplateToStay(
  stayId: string,
  titles: string[],
) {
  const cleanTitles = titles.map((title) => title.trim()).filter(Boolean);
  if (cleanTitles.length === 0) return [];

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Session expirée.");

  const { data: existing, error: existingError } = await supabase
    .from("stay_personal_checklist_items")
    .select("title, position")
    .eq("stay_id", stayId)
    .eq("user_id", user.id);

  if (existingError) throw new Error(existingError.message);

  const existingTitles = new Set(
    (existing ?? []).map((item) => String(item.title).trim().toLowerCase()),
  );

  const uniqueTitles = cleanTitles.filter(
    (title) => !existingTitles.has(title.toLowerCase()),
  );

  if (uniqueTitles.length === 0) return [];

  const maxPosition = (existing ?? []).reduce((max, item) => {
    const position = typeof item.position === "number" ? item.position : 0;
    return Math.max(max, position);
  }, -1);

  const rows = uniqueTitles.map((title, index) => ({
    stay_id: stayId,
    user_id: user.id,
    title,
    position: maxPosition + index + 1,
  }));

  const { data, error } = await supabase
    .from("stay_personal_checklist_items")
    .insert(rows)
    .select("*")
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StayPersonalChecklistItem[];
}

export async function toggleStayPersonalChecklistItem(id: string, isDone: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stay_personal_checklist_items")
    .update({ is_done: isDone, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as StayPersonalChecklistItem;
}

export async function deleteStayPersonalChecklistItem(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("stay_personal_checklist_items")
    .delete()
    .eq("id", id);

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
  const templateName = name.trim();
  const cleanTitles = titles.map((title) => title.trim()).filter(Boolean);

  if (!templateName) throw new Error("Le nom de la liste est obligatoire.");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Session expirée.");

  const { data: template, error } = await supabase
    .from("personal_checklist_templates")
    .insert({ user_id: user.id, name: templateName })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const rows = cleanTitles.map((title, index) => ({
    template_id: template.id,
    title,
    position: index,
  }));

  if (rows.length) {
    const { error: itemError } = await supabase
      .from("personal_checklist_template_items")
      .insert(rows);

    if (itemError) throw new Error(itemError.message);
  }

  return {
    ...(template as PersonalChecklistTemplate),
    items: rows.map((row, index) => ({
      id: `${template.id}-${index}`,
      template_id: template.id,
      title: row.title,
      position: row.position,
    })),
  } as PersonalChecklistTemplate;
}

export async function deletePersonalTemplate(templateId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("personal_checklist_templates")
    .delete()
    .eq("id", templateId);

  if (error) throw new Error(error.message);
}
