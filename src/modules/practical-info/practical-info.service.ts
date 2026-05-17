"use client";

import { createClient } from "@/lib/supabase/client";
import type { PracticalInfo } from "./practical-info.types";

export async function fetchPracticalInfos(stayId: string): Promise<PracticalInfo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stay_practical_infos")
    .select("*")
    .eq("stay_id", stayId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PracticalInfo[];
}

export async function upsertPracticalInfo(stayId: string, info: Partial<PracticalInfo> & { label: string; value?: string | null; kind?: string }) {
  const supabase = createClient();
  const payload = {
    stay_id: stayId,
    label: info.label,
    value: info.value ?? null,
    kind: info.kind ?? "text",
    position: info.position ?? 0,
  };
  const query = info.id
    ? supabase.from("stay_practical_infos").update(payload).eq("id", info.id).select("*").single()
    : supabase.from("stay_practical_infos").insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as PracticalInfo;
}

export async function deletePracticalInfo(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("stay_practical_infos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
