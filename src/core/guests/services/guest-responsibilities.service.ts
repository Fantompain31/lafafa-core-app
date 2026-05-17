"use client";

import { createClient } from "@/lib/supabase/client";

export type GuestResponsibility = {
  id: string;
  type: "logistics_item" | "accommodation_assignment" | "planning_event";
  title: string;
  subtitle?: string | null;
  status?: string | null;
  is_done?: boolean;
  assigned_guest_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
};

export type GuestResponsibilities = {
  logistics: GuestResponsibility[];
  accommodation: GuestResponsibility[];
  planning: GuestResponsibility[];
};

type LogisticsItemRow = {
  id: string;
  section_id: string;
  label: string;
  quantity: string | null;
  notes: string | null;
  assigned_guest_id: string | null;
  is_checked: boolean;
};

type LogisticsSectionRow = {
  id: string;
  title: string;
  source_type: string | null;
  source_id: string | null;
};

type AccommodationAssignmentRow = {
  id: string;
  bed_id: string;
  room_id: string;
  stay_id: string;
};

type AccommodationBedRow = {
  id: string;
  label: string;
  capacity: number;
  bed_type: string;
};

type AccommodationRoomRow = {
  id: string;
  name: string;
};

type PlanningEventRow = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  start_time: string | null;
  location: string | null;
  status: string | null;
  source_type: string | null;
  source_id: string | null;
};

export async function getGuestResponsibilities(
  stayId: string,
  guestId: string,
): Promise<GuestResponsibilities> {
  const supabase = createClient();

  const [itemsResult, assignmentsResult, eventsResult] = await Promise.all([
    supabase
      .from("logistics_items")
      .select(
        "id, section_id, label, quantity, notes, assigned_guest_id, is_checked",
      )
      .eq("stay_id", stayId)
      .eq("assigned_guest_id", guestId)
      .order("created_at", { ascending: true }),

    supabase
      .from("accommodation_assignments")
      .select("id, bed_id, room_id, stay_id")
      .eq("stay_id", stayId)
      .eq("guest_id", guestId),

    supabase
      .from("organization_events")
      .select(
        "id, title, event_type, event_date, start_time, location, status, source_type, source_id",
      )
      .eq("stay_id", stayId)
      .neq("status", "cancelled")
      .or(`source_id.eq.${guestId}`)
      .order("event_date", { ascending: true }),
  ]);

  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);

  const items = (itemsResult.data ?? []) as LogisticsItemRow[];
  const assignments = (assignmentsResult.data ??
    []) as AccommodationAssignmentRow[];
  const events = ((eventsResult.data ?? []) as PlanningEventRow[]).filter(
    (event) =>
      ["guest", "guest_arrival", "guest_departure"].includes(
        event.source_type ?? "",
      ),
  );

  const sectionIds = Array.from(new Set(items.map((item) => item.section_id)));
  const bedIds = Array.from(
    new Set(assignments.map((assignment) => assignment.bed_id)),
  );
  const roomIds = Array.from(
    new Set(assignments.map((assignment) => assignment.room_id)),
  );

  const [sectionsResult, bedsResult, roomsResult] = await Promise.all([
    sectionIds.length > 0
      ? supabase
          .from("logistics_sections")
          .select("id, title, source_type, source_id")
          .in("id", sectionIds)
      : Promise.resolve({ data: [], error: null }),
    bedIds.length > 0
      ? supabase
          .from("accommodation_beds")
          .select("id, label, capacity, bed_type")
          .in("id", bedIds)
      : Promise.resolve({ data: [], error: null }),
    roomIds.length > 0
      ? supabase
          .from("accommodation_rooms")
          .select("id, name")
          .in("id", roomIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sectionsResult.error) throw new Error(sectionsResult.error.message);
  if (bedsResult.error) throw new Error(bedsResult.error.message);
  if (roomsResult.error) throw new Error(roomsResult.error.message);

  const sections = new Map(
    ((sectionsResult.data ?? []) as LogisticsSectionRow[]).map((section) => [
      section.id,
      section,
    ]),
  );
  const beds = new Map(
    ((bedsResult.data ?? []) as AccommodationBedRow[]).map((bed) => [
      bed.id,
      bed,
    ]),
  );
  const rooms = new Map(
    ((roomsResult.data ?? []) as AccommodationRoomRow[]).map((room) => [
      room.id,
      room,
    ]),
  );

  return {
    logistics: items.map((item) => ({
      id: item.id,
      type: "logistics_item",
      title: `${item.label}${item.quantity ? ` · ${item.quantity}` : ""}`,
      subtitle: sections.get(item.section_id)?.title ?? "Logistique",
      status: item.is_checked ? "Terminé" : item.assigned_guest_id ? "Je m’en occupe" : "À prévoir",
      is_done: item.is_checked,
      assigned_guest_id: item.assigned_guest_id,
      source_type: sections.get(item.section_id)?.source_type ?? null,
      source_id: sections.get(item.section_id)?.source_id ?? null,
    })),
    accommodation: assignments.map((assignment) => {
      const bed = beds.get(assignment.bed_id);
      const room = rooms.get(assignment.room_id);
      return {
        id: assignment.id,
        type: "accommodation_assignment",
        title: bed?.label ?? "Couchage attribué",
        subtitle: room?.name ? `Dans ${room.name}` : "Couchage",
        status: bed?.capacity
          ? `${bed.capacity} place${bed.capacity > 1 ? "s" : ""}`
          : null,
        source_type: "accommodation_bed",
        source_id: assignment.bed_id,
      };
    }),
    planning: events.map((event) => ({
      id: event.id,
      type: "planning_event",
      title: event.title,
      subtitle: formatPlanningSubtitle(event),
      status: event.status,
      source_type: event.source_type,
      source_id: event.source_id,
    })),
  };
}

function formatPlanningSubtitle(event: PlanningEventRow) {
  const date = new Date(`${event.event_date}T12:00:00`).toLocaleDateString(
    "fr-FR",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
    },
  );
  const time = event.start_time ? ` à ${event.start_time.slice(0, 5)}` : "";
  const location = event.location ? ` · ${event.location}` : "";
  return `${date}${time}${location}`;
}
