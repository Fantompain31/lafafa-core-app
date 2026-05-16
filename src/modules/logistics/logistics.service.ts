'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  LogisticsItem,
  LogisticsItemFormValues,
  LogisticsSection,
  LogisticsSectionFormValues,
} from './logistics.types';

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
