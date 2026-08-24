export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ReservationStatus = "active" | "cancelled_by_user" | "released_by_admin";
export type AdminRole = "owner" | "admin";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      gifts: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          category: string;
          image_url: string;
          external_url: string | null;
          external_note: string | null;
          preferences: Json | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string;
          category: string;
          image_url: string;
          external_url?: string | null;
          external_note?: string | null;
          preferences?: Json | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string;
          category?: string;
          image_url?: string;
          external_url?: string | null;
          external_note?: string | null;
          preferences?: Json | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          gift_id: string;
          user_id: string;
          idempotency_key: string;
          status: ReservationStatus;
          reserved_at: string;
          cancel_until: string;
          cancelled_at: string | null;
          released_at: string | null;
          released_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gift_id: string;
          user_id: string;
          idempotency_key: string;
          status?: ReservationStatus;
          reserved_at?: string;
          cancel_until?: string;
          cancelled_at?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gift_id?: string;
          user_id?: string;
          idempotency_key?: string;
          status?: ReservationStatus;
          reserved_at?: string;
          cancel_until?: string;
          cancelled_at?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      administrators: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          role: AdminRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          role?: AdminRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          role?: AdminRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      public_gifts_view: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          category: string;
          image_url: string;
          external_url: string | null;
          external_note: string | null;
          preferences: Json | null;
          display_order: number;
          is_reserved: boolean;
        };
      };
    };
    Functions: {
      get_public_gifts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          slug: string;
          name: string;
          description: string;
          category: string;
          image_url: string;
          external_url: string | null;
          external_note: string | null;
          preferences: Json | null;
          display_order: number;
          is_reserved: boolean;
        }[];
      };
      reserve_gift_atomic: {
        Args: {
          p_gift_id: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      cancel_user_reservation: {
        Args: {
          p_reservation_id: string;
        };
        Returns: Json;
      };
      admin_release_reservation: {
        Args: {
          p_reservation_id: string;
        };
        Returns: Json;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      reservation_status: ReservationStatus;
      admin_role: AdminRole;
    };
  };
}
