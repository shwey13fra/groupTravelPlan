// ============================================================
// TripSync — Database Types
// Hand-written to match 001_initial_schema.sql
// Replace with `supabase gen types typescript` output once CLI is set up.
// ============================================================

// ── Enums ────────────────────────────────────────────────────────────────
export type TripVibe = "beach" | "mountains" | "city" | "heritage" | "adventure";
export type GroupType = "friends" | "family" | "mixed";
export type TripStatus = "planning" | "confirmed" | "completed";
export type CommitmentStatus = "in" | "out" | "pending";
export type ItineraryItemType = "activity" | "meal" | "transport" | "buffer";
export type TaskStatus = "todo" | "in_progress" | "done";
export type SplitType = "equal" | "custom";
export type VaultItemType = "pdf" | "link" | "note";
export type SuggestionStatus = "pending" | "approved" | "rejected";

// ── Row types ────────────────────────────────────────────────────────────
export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  duration_days: number | null;
  vibe: TripVibe | null;
  month: string | null;
  group_type: GroupType | null;
  status: TripStatus;
  join_code: string;
  ai_nudge: string | null;
  destination_locked: boolean;
  vault_public: boolean;
  last_ai_call_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  name: string;
  emoji: string;
  is_organizer: boolean;
  commitment_status: CommitmentStatus;
  available_from: string | null;
  available_to: string | null;
  tags: string[];
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DestinationSuggestion {
  id: string;
  trip_id: string;
  name: string;
  suggested_by_member_id: string | null;
  suggested_by_ai: boolean;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DestinationVote {
  id: string;
  trip_id: string;
  member_id: string;
  suggestion_id: string;
  created_at: string;
  updated_at: string;
}

export interface ItineraryDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItineraryItem {
  id: string;
  day_id: string;
  time_slot: string | null;
  title: string;
  description: string | null;
  location: string | null;
  item_type: ItineraryItemType | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ItemSuggestion {
  id: string;
  item_id: string;
  suggested_by: string | null;
  suggestion_text: string;
  // Structured fields — set only for organizer swap proposals (enables voting)
  suggested_title: string | null;
  suggested_description: string | null;
  suggested_location: string | null;
  status: SuggestionStatus;
  created_at: string;
}

export interface SuggestionVote {
  id: string;
  suggestion_id: string;
  member_id: string;
  vote: "yes" | "no";
  created_at: string;
}

export interface Task {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  paid_by: string;
  split_type: SplitType;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount_owed: number;
  settled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaultItem {
  id: string;
  trip_id: string;
  title: string;
  item_type: VaultItemType | null;
  file_url: string | null;
  link_url: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Database type (used to type Supabase client) ─────────────────────────
export type Database = {
  public: {
    Tables: {
      trips: {
        Row: Trip;
        Insert: Omit<Trip, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Trip, "id" | "created_at" | "updated_at">>;
      };
      trip_members: {
        Row: TripMember;
        Insert: Omit<TripMember, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TripMember, "id" | "created_at" | "updated_at">>;
      };
      destination_suggestions: {
        Row: DestinationSuggestion;
        Insert: Omit<DestinationSuggestion, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DestinationSuggestion, "id" | "created_at" | "updated_at">>;
      };
      destination_votes: {
        Row: DestinationVote;
        Insert: Omit<DestinationVote, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DestinationVote, "id" | "created_at" | "updated_at">>;
      };
      itinerary_days: {
        Row: ItineraryDay;
        Insert: Omit<ItineraryDay, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ItineraryDay, "id" | "created_at" | "updated_at">>;
      };
      itinerary_items: {
        Row: ItineraryItem;
        Insert: Omit<ItineraryItem, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ItineraryItem, "id" | "created_at" | "updated_at">>;
      };
      item_suggestions: {
        Row: ItemSuggestion;
        Insert: Omit<ItemSuggestion, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ItemSuggestion, "id" | "created_at">>;
      };
      suggestion_votes: {
        Row: SuggestionVote;
        Insert: Omit<SuggestionVote, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<SuggestionVote, "id" | "created_at">>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Task, "id" | "created_at" | "updated_at">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Expense, "id" | "created_at" | "updated_at">>;
      };
      expense_splits: {
        Row: ExpenseSplit;
        Insert: Omit<ExpenseSplit, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ExpenseSplit, "id" | "created_at" | "updated_at">>;
      };
      vault_items: {
        Row: VaultItem;
        Insert: Omit<VaultItem, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<VaultItem, "id" | "created_at" | "updated_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
