export type MemberRole = 'owner' | 'co_organizer' | 'guest' | 'viewer'
export type MemberStatus = 'pending' | 'active' | 'inactive'
export type StayStatus = 'draft' | 'polling' | 'confirmed' | 'in_progress' | 'completed' | 'archived'
export type GuestCategory = 'adult' | 'child' | 'baby'
export type GuestStatus = 'invited' | 'confirmed' | 'maybe' | 'declined' | 'cancelled'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertStatus = 'open' | 'resolved' | 'ignored'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type FoodPreferences = {
  diet?: string
  allergies?: string[]
  notes?: string
}

export type MyStay = {
  id: string
  owner_id: string
  title: string
  description: string | null
  status: StayStatus
  start_date: string | null
  end_date: string | null
  location_name: string | null
  timezone: string
  archived_at: string | null
  created_at: string
  updated_at: string
  active_member_count: number
  guest_count: number
  confirmed_guest_count: number
  critical_alerts_count: number
  open_alerts_count: number
  my_role: MemberRole
  my_member_status: MemberStatus
}

export type StaySummary = Omit<MyStay, 'my_role' | 'my_member_status'>

export type GuestSummary = {
  id: string
  stay_id: string
  linked_user_id: string | null
  managed_by_user_id: string | null
  first_name: string
  last_name: string | null
  category: GuestCategory
  status: GuestStatus
  color: string | null
  arrival_at: string | null
  departure_at: string | null
  food_preferences: FoodPreferences | Json
  notes: string | null
  created_at: string
  updated_at: string
  presence_hours: number | null
  linked_user_avatar_url: string | null
  linked_user_first_name: string | null
  linked_user_last_name: string | null
  active_invitation_id: string | null
  invitation_status: string | null
  active_link_id: string | null
  link_is_active: boolean | null
}

export type StaySettings = {
  id: string
  stay_id: string
  default_currency: string
  guest_can_invite: boolean
  guest_can_see_budget: boolean
  guest_can_see_guests: boolean
  guest_can_add_expenses: boolean
  notify_on_guest_change: boolean
  notify_on_expense: boolean
  notify_on_alert: boolean
  primary_color: string | null
  accent_color: string | null
  logo_file_id: string | null
  poll_date_options: Json
  poll_location_options: Json
  poll_closes_at: string | null
  created_at: string
  updated_at: string
}

export type StayEnabledFeature = {
  id: string
  stay_id: string
  feature_key: string
  is_enabled: boolean
  settings: Json
  created_at: string
  updated_at: string
}

export type StayOpenAlert = {
  id: string
  stay_id: string
  module_key: string
  title: string
  message: string | null
  severity: AlertSeverity
  status: AlertStatus
  entity_type: string | null
  entity_id: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
