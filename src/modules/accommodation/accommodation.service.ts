'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  AccommodationAssignment,
  AccommodationBed,
  AccommodationBedFormValues,
  AccommodationRoom,
  AccommodationRoomFormValues,
} from './accommodation.types'

function normalizeBed(values: AccommodationBedFormValues) {
  return {
    label: values.label.trim(),
    bed_type: values.bed_type,
    capacity: Math.max(1, Math.min(10, Number(values.capacity) || 1)),
    needs_logistics: Boolean(values.needs_logistics),
  }
}

export async function createAccommodationRoom(
  stayId: string,
  values: AccommodationRoomFormValues,
): Promise<AccommodationRoom> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('create_accommodation_room_with_beds', {
    p_stay_id: stayId,
    p_name: values.name.trim(),
    p_notes: values.notes.trim() || null,
    p_beds: values.beds.map(normalizeBed),
  })

  if (error) throw new Error(error.message)
  return data as AccommodationRoom
}

export async function updateAccommodationRoom(
  roomId: string,
  values: { name: string; notes: string },
): Promise<AccommodationRoom> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('update_accommodation_room', {
    p_room_id: roomId,
    p_name: values.name.trim(),
    p_notes: values.notes.trim() || null,
  })

  if (error) throw new Error(error.message)
  return data as AccommodationRoom
}

export async function deleteAccommodationRoom(roomId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.rpc('delete_accommodation_room', {
    p_room_id: roomId,
  })

  if (error) throw new Error(error.message)
}

export async function createAccommodationBed(
  roomId: string,
  values: AccommodationBedFormValues,
): Promise<AccommodationBed> {
  const supabase = createClient()
  const bed = normalizeBed(values)

  const { data, error } = await supabase.rpc('create_accommodation_bed', {
    p_room_id: roomId,
    p_label: bed.label,
    p_bed_type: bed.bed_type,
    p_capacity: bed.capacity,
    p_needs_logistics: bed.needs_logistics,
  })

  if (error) throw new Error(error.message)
  return data as AccommodationBed
}

export async function updateAccommodationBed(
  bedId: string,
  values: AccommodationBedFormValues,
): Promise<AccommodationBed> {
  const supabase = createClient()
  const bed = normalizeBed(values)

  const { data, error } = await supabase.rpc('update_accommodation_bed', {
    p_bed_id: bedId,
    p_label: bed.label,
    p_bed_type: bed.bed_type,
    p_capacity: bed.capacity,
    p_needs_logistics: bed.needs_logistics,
  })

  if (error) throw new Error(error.message)
  return data as AccommodationBed
}

export async function deleteAccommodationBed(bedId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.rpc('delete_accommodation_bed', {
    p_bed_id: bedId,
  })

  if (error) throw new Error(error.message)
}

export async function assignGuestToBed(
  bedId: string,
  guestId: string,
): Promise<AccommodationAssignment> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('assign_guest_to_accommodation_bed', {
    p_bed_id: bedId,
    p_guest_id: guestId,
  })

  if (error) throw new Error(error.message)
  return data as AccommodationAssignment
}

export async function removeAccommodationAssignment(assignmentId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.rpc('remove_accommodation_assignment', {
    p_assignment_id: assignmentId,
  })

  if (error) throw new Error(error.message)
}
