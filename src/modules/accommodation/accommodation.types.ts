export type AccommodationBedType =
  | 'double_bed'
  | 'single_bed'
  | 'single_mattress'
  | 'double_mattress'
  | 'sofa_bed'
  | 'sofa'
  | 'baby_bed'
  | 'travel_cot'
  | 'floor_bedding'
  | 'other'

export interface AccommodationRoom {
  id: string
  stay_id: string
  name: string
  notes: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AccommodationBed {
  id: string
  room_id: string
  stay_id: string
  label: string
  bed_type: AccommodationBedType
  capacity: number
  needs_logistics: boolean
  logistics_item_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AccommodationAssignment {
  id: string
  bed_id: string
  room_id: string
  stay_id: string
  guest_id: string
  created_by: string | null
  created_at: string
}

export interface AccommodationGuest {
  id: string
  first_name: string
  last_name: string | null
  color: string | null
  linked_user_id: string | null
  linked_user_avatar_url: string | null
  status: string
}

export type AccommodationRoomWithBeds = AccommodationRoom & {
  beds: AccommodationBedWithAssignments[]
}

export type AccommodationBedWithAssignments = AccommodationBed & {
  assignments: AccommodationAssignment[]
}

export type AccommodationBedFormValues = {
  label: string
  bed_type: AccommodationBedType
  capacity: number
  needs_logistics: boolean
}

export type AccommodationRoomFormValues = {
  name: string
  notes: string
  beds: AccommodationBedFormValues[]
}

export const BED_TYPE_LABELS: Record<AccommodationBedType, string> = {
  double_bed: 'Lit 2 places',
  single_bed: 'Lit 1 place',
  single_mattress: 'Matelas 1 place',
  double_mattress: 'Matelas 2 places',
  sofa_bed: 'Canapé convertible',
  sofa: 'Canapé',
  baby_bed: 'Lit bébé',
  travel_cot: 'Lit parapluie',
  floor_bedding: 'Duvet au sol',
  other: 'Autre',
}

export const BED_TYPE_CAPACITY: Record<AccommodationBedType, number> = {
  double_bed: 2,
  single_bed: 1,
  single_mattress: 1,
  double_mattress: 2,
  sofa_bed: 2,
  sofa: 1,
  baby_bed: 1,
  travel_cot: 1,
  floor_bedding: 1,
  other: 1,
}

export const BED_TYPE_OPTIONS: AccommodationBedType[] = [
  'double_bed',
  'single_bed',
  'single_mattress',
  'double_mattress',
  'sofa_bed',
  'sofa',
  'baby_bed',
  'travel_cot',
  'floor_bedding',
  'other',
]
