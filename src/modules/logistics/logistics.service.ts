'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  LogisticsItem,
  LogisticsItemFormValues,
  LogisticsSection,
  LogisticsSectionFormValues,
  LogisticsSectionWithItems,
} from './logistics.types';


export async function fetchLogisticsSections(stayId: string): Promise<LogisticsSectionWithItems[]> {
  const supabase = createClient();

  const { data: sections, error: sectionsError } = await supabase
    .from('logistics_sections')
    .select('*')
    .eq('stay_id', stayId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });

  if (sectionsError) throw new Error(sectionsError.message);

  const safeSections = (sections ?? []) as LogisticsSection[];
  const sectionIds = safeSections.map((section) => section.id);

  if (sectionIds.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from('logistics_items')
    .select('*')
    .in('section_id', sectionIds)
    .order('created_at', { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const safeItems = (items ?? []) as LogisticsItem[];

  return safeSections.map((section) => ({
    ...section,
    items: safeItems.filter((item) => item.section_id === section.id),
  }));
}

export async function createManualLogisticsSection(
  stayId: string,
  values: LogisticsSectionFormValues,
): Promise<LogisticsSection> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('create_manual_logistics_section', {
    p_stay_id: stayId,
    p_title: values.title.trim(),
    p_section_type: values.section_type,
    p_notes: values.notes.trim() || null,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsSection;
}

export async function updateLogisticsSection(
  sectionId: string,
  values: LogisticsSectionFormValues,
): Promise<LogisticsSection> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('update_logistics_section', {
    p_section_id: sectionId,
    p_title: values.title.trim(),
    p_section_type: values.section_type,
    p_notes: values.notes.trim() || null,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsSection;
}

export async function hideLogisticsSection(sectionId: string): Promise<LogisticsSection> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('hide_logistics_section', {
    p_section_id: sectionId,
    p_is_hidden: true,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsSection;
}

export async function deleteLogisticsSection(sectionId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc('delete_logistics_section', {
    p_section_id: sectionId,
  });

  if (error) throw new Error(error.message);
}

export async function createLogisticsItem(
  sectionId: string,
  values: LogisticsItemFormValues,
): Promise<LogisticsItem> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('create_logistics_item', {
    p_section_id: sectionId,
    p_label: values.label.trim(),
    p_quantity: values.quantity.trim() || null,
    p_notes: values.notes.trim() || null,
    p_assigned_guest_id: values.assigned_guest_id || null,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsItem;
}

export async function updateLogisticsItem(
  itemId: string,
  values: LogisticsItemFormValues,
): Promise<LogisticsItem> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('update_logistics_item', {
    p_item_id: itemId,
    p_label: values.label.trim(),
    p_quantity: values.quantity.trim() || null,
    p_notes: values.notes.trim() || null,
    p_assigned_guest_id: values.assigned_guest_id || null,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsItem;
}

export async function assignLogisticsItem(
  itemId: string,
  assignedGuestId: string | null,
): Promise<LogisticsItem> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('assign_logistics_item', {
    p_item_id: itemId,
    p_assigned_guest_id: assignedGuestId,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsItem;
}

export async function toggleLogisticsItem(
  itemId: string,
  isChecked: boolean,
): Promise<LogisticsItem> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('toggle_logistics_item', {
    p_item_id: itemId,
    p_is_checked: isChecked,
  });

  if (error) throw new Error(error.message);
  return data as LogisticsItem;
}

export async function deleteLogisticsItem(itemId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc('delete_logistics_item', {
    p_item_id: itemId,
  });

  if (error) throw new Error(error.message);
}
