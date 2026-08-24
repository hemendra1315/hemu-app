export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academies: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string
          default_monthly_fee_paise: number
          deleted_at: string | null
          fee_mode: Database["public"]["Enums"]["fee_mode"]
          grace_period_days: number
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_user_id: string
          settings: Json
          slug: string
          state: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          default_monthly_fee_paise?: number
          deleted_at?: string | null
          fee_mode?: Database["public"]["Enums"]["fee_mode"]
          grace_period_days?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_user_id: string
          settings?: Json
          slug: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          default_monthly_fee_paise?: number
          deleted_at?: string | null
          fee_mode?: Database["public"]["Enums"]["fee_mode"]
          grace_period_days?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          settings?: Json
          slug?: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academies_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_join_codes: {
        Row: {
          academy_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          role: Database["public"]["Enums"]["app_role"]
          use_count: number
        }
        Insert: {
          academy_id: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          use_count?: number
        }
        Update: {
          academy_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_join_codes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_join_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_members: {
        Row: {
          academy_id: string
          batting_style: string | null
          bio: string | null
          bowling_style: string | null
          created_at: string
          id: string
          invited_by: string | null
          jersey_number: number | null
          joined_at: string | null
          left_at: string | null
          notes: string | null
          player_code: string | null
          player_role: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id: string
          batting_style?: string | null
          bio?: string | null
          bowling_style?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          jersey_number?: number | null
          joined_at?: string | null
          left_at?: string | null
          notes?: string | null
          player_code?: string | null
          player_role?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          batting_style?: string | null
          bio?: string | null
          bowling_style?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          jersey_number?: number | null
          joined_at?: string | null
          left_at?: string | null
          notes?: string | null
          player_code?: string | null
          player_role?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_owner_invitations: {
        Row: {
          academy_id: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          status: string
          token_hash: string
        }
        Insert: {
          academy_id: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          status?: string
          token_hash: string
        }
        Update: {
          academy_id?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_owner_invitations_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_records: {
        Row: {
          academy_id: string
          achieved_at: string
          created_at: string
          id: string
          match_id: string | null
          player_id: string | null
          record_type: Database["public"]["Enums"]["record_type"]
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          academy_id: string
          achieved_at?: string
          created_at?: string
          id?: string
          match_id?: string | null
          player_id?: string | null
          record_type: Database["public"]["Enums"]["record_type"]
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          academy_id?: string
          achieved_at?: string
          created_at?: string
          id?: string
          match_id?: string | null
          player_id?: string | null
          record_type?: Database["public"]["Enums"]["record_type"]
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_records_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_records_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          academy_id: string
          activity_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          academy_id: string
          activity_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          academy_id?: string
          activity_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          academy_id: string
          audience: Database["public"]["Enums"]["audience_type"]
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          audience?: Database["public"]["Enums"]["audience_type"]
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          title: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          audience?: Database["public"]["Enums"]["audience_type"]
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          marked_by: string | null
          player_id: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          marked_by?: string | null
          player_id: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          player_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_members: {
        Row: {
          academy_member_id: string
          batch_id: string
          id: string
          joined_at: string
        }
        Insert: {
          academy_member_id: string
          batch_id: string
          id?: string
          joined_at?: string
        }
        Update: {
          academy_member_id?: string
          batch_id?: string
          id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_members_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_members_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          academy_id: string
          age_group: string
          coach_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          training_days: string | null
          training_time: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          age_group: string
          coach_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          training_days?: string | null
          training_time?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          age_group?: string
          coach_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          training_days?: string | null
          training_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      cricheroes_player_mappings: {
        Row: {
          academy_id: string
          academy_member_id: string | null
          confidence_score: number
          created_at: string
          cricheroes_name: string
          cricheroes_player_id: string | null
          id: string
          is_guest: boolean
          updated_at: string
        }
        Insert: {
          academy_id: string
          academy_member_id?: string | null
          confidence_score?: number
          created_at?: string
          cricheroes_name: string
          cricheroes_player_id?: string | null
          id?: string
          is_guest?: boolean
          updated_at?: string
        }
        Update: {
          academy_id?: string
          academy_member_id?: string | null
          confidence_score?: number
          created_at?: string
          cricheroes_name?: string
          cricheroes_player_id?: string | null
          id?: string
          is_guest?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cricheroes_player_mappings_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cricheroes_player_mappings_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_assignments: {
        Row: {
          academy_id: string
          assigned_at: string
          assigned_by: string | null
          assigned_date: string
          batch_id: string | null
          created_by: string | null
          drill_id: string
          due_date: string | null
          id: string
          player_id: string | null
          status: Database["public"]["Enums"]["drill_assignment_status"]
          updated_at: string
        }
        Insert: {
          academy_id: string
          assigned_at?: string
          assigned_by?: string | null
          assigned_date?: string
          batch_id?: string | null
          created_by?: string | null
          drill_id: string
          due_date?: string | null
          id?: string
          player_id?: string | null
          status?: Database["public"]["Enums"]["drill_assignment_status"]
          updated_at?: string
        }
        Update: {
          academy_id?: string
          assigned_at?: string
          assigned_by?: string | null
          assigned_date?: string
          batch_id?: string | null
          created_by?: string | null
          drill_id?: string
          due_date?: string | null
          id?: string
          player_id?: string | null
          status?: Database["public"]["Enums"]["drill_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_assignments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_assignments_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          academy_id: string
          category: Database["public"]["Enums"]["drill_category"]
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["skill_level"]
          duration_minutes: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          category: Database["public"]["Enums"]["drill_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["skill_level"]
          duration_minutes?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          category?: Database["public"]["Enums"]["drill_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["skill_level"]
          duration_minutes?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drills_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          join_code_id: string | null
          message: string | null
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["join_status"]
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          join_code_id?: string | null
          message?: string | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["join_status"]
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          join_code_id?: string | null
          message?: string | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["join_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_join_code_id_fkey"
            columns: ["join_code_id"]
            isOneToOne: false
            referencedRelation: "academy_join_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_awards: {
        Row: {
          best_batter_id: string | null
          best_bowler_id: string | null
          best_fielder_id: string | null
          created_at: string
          id: string
          match_id: string
          player_of_match_id: string | null
        }
        Insert: {
          best_batter_id?: string | null
          best_bowler_id?: string | null
          best_fielder_id?: string | null
          created_at?: string
          id?: string
          match_id: string
          player_of_match_id?: string | null
        }
        Update: {
          best_batter_id?: string | null
          best_bowler_id?: string | null
          best_fielder_id?: string | null
          created_at?: string
          id?: string
          match_id?: string
          player_of_match_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_awards_best_batter_id_fkey"
            columns: ["best_batter_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_awards_best_bowler_id_fkey"
            columns: ["best_bowler_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_awards_best_fielder_id_fkey"
            columns: ["best_fielder_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_awards_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_awards_player_of_match_id_fkey"
            columns: ["player_of_match_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      match_batting: {
        Row: {
          academy_member_id: string | null
          balls: number
          batting_order: number | null
          created_at: string
          dismissal_type: string | null
          fours: number
          guest_name: string | null
          id: string
          is_guest: boolean
          is_out: boolean
          match_id: string
          runs: number
          sixes: number
        }
        Insert: {
          academy_member_id?: string | null
          balls?: number
          batting_order?: number | null
          created_at?: string
          dismissal_type?: string | null
          fours?: number
          guest_name?: string | null
          id?: string
          is_guest?: boolean
          is_out?: boolean
          match_id: string
          runs?: number
          sixes?: number
        }
        Update: {
          academy_member_id?: string | null
          balls?: number
          batting_order?: number | null
          created_at?: string
          dismissal_type?: string | null
          fours?: number
          guest_name?: string | null
          id?: string
          is_guest?: boolean
          is_out?: boolean
          match_id?: string
          runs?: number
          sixes?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_batting_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_batting_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_bowling: {
        Row: {
          academy_member_id: string | null
          created_at: string
          guest_name: string | null
          id: string
          is_guest: boolean
          maidens: number
          match_id: string
          no_balls: number
          overs: number
          runs_conceded: number
          wickets: number
          wides: number
        }
        Insert: {
          academy_member_id?: string | null
          created_at?: string
          guest_name?: string | null
          id?: string
          is_guest?: boolean
          maidens?: number
          match_id: string
          no_balls?: number
          overs?: number
          runs_conceded?: number
          wickets?: number
          wides?: number
        }
        Update: {
          academy_member_id?: string | null
          created_at?: string
          guest_name?: string | null
          id?: string
          is_guest?: boolean
          maidens?: number
          match_id?: string
          no_balls?: number
          overs?: number
          runs_conceded?: number
          wickets?: number
          wides?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_bowling_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_bowling_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_bowling_spells: {
        Row: {
          academy_member_id: string
          created_at: string
          end_over: number
          id: string
          maidens: number
          match_id: string
          no_balls: number
          runs_conceded: number
          start_over: number
          wickets: number
          wides: number
        }
        Insert: {
          academy_member_id: string
          created_at?: string
          end_over: number
          id?: string
          maidens?: number
          match_id: string
          no_balls?: number
          runs_conceded?: number
          start_over: number
          wickets?: number
          wides?: number
        }
        Update: {
          academy_member_id?: string
          created_at?: string
          end_over?: number
          id?: string
          maidens?: number
          match_id?: string
          no_balls?: number
          runs_conceded?: number
          start_over?: number
          wickets?: number
          wides?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_bowling_spells_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_bowling_spells_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_coach_notes: {
        Row: {
          academy_member_id: string
          coach_id: string | null
          created_at: string
          id: string
          match_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          academy_member_id: string
          coach_id?: string | null
          created_at?: string
          id?: string
          match_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          academy_member_id?: string
          coach_id?: string | null
          created_at?: string
          id?: string
          match_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_coach_notes_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_coach_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_coach_notes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_fielding: {
        Row: {
          academy_member_id: string | null
          catches: number
          created_at: string
          guest_name: string | null
          id: string
          is_guest: boolean
          match_id: string
          run_outs: number
          stumpings: number
        }
        Insert: {
          academy_member_id?: string | null
          catches?: number
          created_at?: string
          guest_name?: string | null
          id?: string
          is_guest?: boolean
          match_id: string
          run_outs?: number
          stumpings?: number
        }
        Update: {
          academy_member_id?: string | null
          catches?: number
          created_at?: string
          guest_name?: string | null
          id?: string
          is_guest?: boolean
          match_id?: string
          run_outs?: number
          stumpings?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_fielding_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_fielding_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          academy_member_id: string | null
          batting_order: number | null
          created_at: string
          guest_name: string | null
          id: string
          is_captain: boolean
          is_guest: boolean
          is_vice_captain: boolean
          is_wicketkeeper: boolean
          match_id: string
        }
        Insert: {
          academy_member_id?: string | null
          batting_order?: number | null
          created_at?: string
          guest_name?: string | null
          id?: string
          is_captain?: boolean
          is_guest?: boolean
          is_vice_captain?: boolean
          is_wicketkeeper?: boolean
          match_id: string
        }
        Update: {
          academy_member_id?: string | null
          batting_order?: number | null
          created_at?: string
          guest_name?: string | null
          id?: string
          is_captain?: boolean
          is_guest?: boolean
          is_vice_captain?: boolean
          is_wicketkeeper?: boolean
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_academy_member_id_fkey"
            columns: ["academy_member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_partnerships: {
        Row: {
          batter_1_id: string
          batter_2_id: string
          created_at: string
          id: string
          match_id: string
          runs_added: number
          wicket_number: number | null
        }
        Insert: {
          batter_1_id: string
          batter_2_id: string
          created_at?: string
          id?: string
          match_id: string
          runs_added: number
          wicket_number?: number | null
        }
        Update: {
          batter_1_id?: string
          batter_2_id?: string
          created_at?: string
          id?: string
          match_id?: string
          runs_added?: number
          wicket_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_partnerships_batter_1_id_fkey"
            columns: ["batter_1_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_partnerships_batter_2_id_fkey"
            columns: ["batter_2_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_partnerships_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          academy_id: string
          batch_id: string | null
          created_at: string
          created_by: string | null
          format: Database["public"]["Enums"]["match_format"]
          id: string
          match_date: string
          match_name: string
          match_type: Database["public"]["Enums"]["match_type"]
          opponent_name: string | null
          overs: number | null
          overs_played: number | null
          result: Database["public"]["Enums"]["match_result"] | null
          status: Database["public"]["Enums"]["match_status"]
          team_score: string | null
          tournament: string | null
          updated_at: string
          venue: string | null
          wickets_lost: number | null
          winning_margin: string | null
        }
        Insert: {
          academy_id: string
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          format?: Database["public"]["Enums"]["match_format"]
          id?: string
          match_date: string
          match_name: string
          match_type?: Database["public"]["Enums"]["match_type"]
          opponent_name?: string | null
          overs?: number | null
          overs_played?: number | null
          result?: Database["public"]["Enums"]["match_result"] | null
          status?: Database["public"]["Enums"]["match_status"]
          team_score?: string | null
          tournament?: string | null
          updated_at?: string
          venue?: string | null
          wickets_lost?: number | null
          winning_margin?: string | null
        }
        Update: {
          academy_id?: string
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          format?: Database["public"]["Enums"]["match_format"]
          id?: string
          match_date?: string
          match_name?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          opponent_name?: string | null
          overs?: number | null
          overs_played?: number | null
          result?: Database["public"]["Enums"]["match_result"] | null
          status?: Database["public"]["Enums"]["match_status"]
          team_score?: string | null
          tournament?: string | null
          updated_at?: string
          venue?: string | null
          wickets_lost?: number | null
          winning_margin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          academy_id: string
          announcement_id: string | null
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          id: string
          message: string
          metadata: Json
          notification_type: string
          read_at: string | null
          recipient_user_id: string
          status: Database["public"]["Enums"]["notif_status"]
          title: string
        }
        Insert: {
          academy_id: string
          announcement_id?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          notification_type?: string
          read_at?: string | null
          recipient_user_id: string
          status?: Database["public"]["Enums"]["notif_status"]
          title: string
        }
        Update: {
          academy_id?: string
          announcement_id?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          notification_type?: string
          read_at?: string | null
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["notif_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_linking_codes: {
        Row: {
          academy_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean
          player_user_id: string
          relationship_type: string
        }
        Insert: {
          academy_id: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          player_user_id: string
          relationship_type: string
        }
        Update: {
          academy_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          player_user_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_linking_codes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_linking_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_linking_codes_player_user_id_fkey"
            columns: ["player_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_player_links: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          parent_user_id: string
          player_user_id: string
          relationship_type: string
          status: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          parent_user_id: string
          player_user_id: string
          relationship_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          parent_user_id?: string
          player_user_id?: string
          relationship_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_player_links_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_player_links_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_player_links_player_user_id_fkey"
            columns: ["player_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_milestones: {
        Row: {
          academy_id: string
          achieved_at: string
          created_at: string
          id: string
          match_id: string | null
          milestone_type: Database["public"]["Enums"]["milestone_type"]
          player_id: string
        }
        Insert: {
          academy_id: string
          achieved_at?: string
          created_at?: string
          id?: string
          match_id?: string | null
          milestone_type: Database["public"]["Enums"]["milestone_type"]
          player_id: string
        }
        Update: {
          academy_id?: string
          achieved_at?: string
          created_at?: string
          id?: string
          match_id?: string | null
          milestone_type?: Database["public"]["Enums"]["milestone_type"]
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_milestones_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_milestones_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_milestones_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      player_statistics: {
        Row: {
          academy_id: string
          awards_best_batter: number
          awards_best_bowler: number
          awards_best_fielder: number
          awards_player_of_match: number
          balls_faced_sum: number
          batting_centuries: number
          batting_fifties: number
          batting_fours: number
          batting_highest_score: number | null
          batting_innings: number
          batting_not_outs: number
          batting_runs: number
          batting_sixes: number
          bowling_best_bowling: string | null
          bowling_innings: number
          bowling_maidens: number
          bowling_overs: number
          bowling_runs_conceded: number
          bowling_wickets: number
          created_at: string
          fielding_catches: number
          fielding_run_outs: number
          fielding_stumpings: number
          id: string
          matches_played: number
          player_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          awards_best_batter?: number
          awards_best_bowler?: number
          awards_best_fielder?: number
          awards_player_of_match?: number
          balls_faced_sum?: number
          batting_centuries?: number
          batting_fifties?: number
          batting_fours?: number
          batting_highest_score?: number | null
          batting_innings?: number
          batting_not_outs?: number
          batting_runs?: number
          batting_sixes?: number
          bowling_best_bowling?: string | null
          bowling_innings?: number
          bowling_maidens?: number
          bowling_overs?: number
          bowling_runs_conceded?: number
          bowling_wickets?: number
          created_at?: string
          fielding_catches?: number
          fielding_run_outs?: number
          fielding_stumpings?: number
          id?: string
          matches_played?: number
          player_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          awards_best_batter?: number
          awards_best_bowler?: number
          awards_best_fielder?: number
          awards_player_of_match?: number
          balls_faced_sum?: number
          batting_centuries?: number
          batting_fifties?: number
          batting_fours?: number
          batting_highest_score?: number | null
          batting_innings?: number
          batting_not_outs?: number
          batting_runs?: number
          batting_sixes?: number
          bowling_best_bowling?: string | null
          bowling_innings?: number
          bowling_maidens?: number
          bowling_overs?: number
          bowling_runs_conceded?: number
          bowling_wickets?: number
          created_at?: string
          fielding_catches?: number
          fielding_run_outs?: number
          fielding_stumpings?: number
          id?: string
          matches_played?: number
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_statistics_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string | null
          gender: string | null
          id: string
          is_super_admin: boolean
          locale: string
          phone: string | null
          phone_verified: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          gender?: string | null
          id: string
          is_super_admin?: boolean
          locale?: string
          phone?: string | null
          phone_verified?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          is_super_admin?: boolean
          locale?: string
          phone?: string | null
          phone_verified?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          academy_id: string
          batch_id: string
          coach_id: string
          created_at: string
          created_by: string | null
          end_at: string
          focus_area: string | null
          id: string
          notes: string | null
          session_date: string
          start_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          batch_id: string
          coach_id: string
          created_at?: string
          created_by?: string | null
          end_at: string
          focus_area?: string | null
          id?: string
          notes?: string | null
          session_date: string
          start_at: string
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          batch_id?: string
          coach_id?: string
          created_at?: string
          created_by?: string | null
          end_at?: string
          focus_area?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          start_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_batting_rankings: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          awards_player_of_match: number | null
          batting_average: number | null
          batting_centuries: number | null
          batting_fifties: number | null
          batting_fours: number | null
          batting_highest_score: number | null
          batting_innings: number | null
          batting_runs: number | null
          batting_sixes: number | null
          full_name: string | null
          matches_played: number | null
          player_id: string | null
          strike_rate_placeholder: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bowling_rankings: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          awards_player_of_match: number | null
          bowling_average: number | null
          bowling_best_bowling: string | null
          bowling_maidens: number | null
          bowling_overs: number | null
          bowling_runs_conceded: number | null
          bowling_wickets: number | null
          economy: number | null
          full_name: string | null
          matches_played: number | null
          player_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fielding_rankings: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          fielding_catches: number | null
          fielding_run_outs: number | null
          fielding_stumpings: number | null
          full_name: string | null
          matches_played: number | null
          player_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_overall_rankings: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          awards_player_of_match: number | null
          batting_runs: number | null
          bowling_wickets: number | null
          contribution_points: number | null
          fielding_catches: number | null
          full_name: string | null
          matches_played: number | null
          player_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      academy_active_join_code: {
        Args: {
          p_academy: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      accept_owner_invitation: { Args: { p_token: string }; Returns: Json }
      approve_join_request: {
        Args: { p_batch_ids?: string[]; p_request_id: string }
        Returns: undefined
      }
      batch_member_count: { Args: { p_batch_id: string }; Returns: number }
      create_academy: {
        Args: {
          p_city?: string
          p_fee_mode?: Database["public"]["Enums"]["fee_mode"]
          p_name: string
          p_timezone?: string
        }
        Returns: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string
          default_monthly_fee_paise: number
          deleted_at: string | null
          fee_mode: Database["public"]["Enums"]["fee_mode"]
          grace_period_days: number
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_user_id: string
          settings: Json
          slug: string
          state: string | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "academies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_platform_academy: {
        Args: {
          p_city?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_fee_mode?: Database["public"]["Enums"]["fee_mode"]
          p_name: string
          p_owner_user_id: string
          p_timezone?: string
        }
        Returns: Json
      }
      cricket_overs_to_decimal: { Args: { p_overs: number }; Returns: number }
      delete_platform_academy: {
        Args: { p_academy_id: string }
        Returns: undefined
      }
      detect_player_milestones: {
        Args: {
          p_academy: string
          p_batting_runs: number
          p_bowling_wickets: number
          p_fielding_catches: number
          p_match: string
          p_match_runs: number
          p_match_wickets: number
          p_matches_played: number
          p_player: string
        }
        Returns: undefined
      }
      generate_join_code: { Args: { p_length?: number }; Returns: string }
      generate_parent_linking_code: {
        Args: {
          p_academy_id: string
          p_player_user_id: string
          p_relationship_type: string
        }
        Returns: string
      }
      get_owner_invitation_details: { Args: { p_token: string }; Returns: Json }
      get_platform_academies: { Args: never; Returns: Json }
      get_platform_academy_details: {
        Args: { p_academy_id: string }
        Returns: Json
      }
      get_platform_analytics: { Args: never; Returns: Json }
      get_platform_users: { Args: never; Returns: Json }
      has_role: {
        Args: {
          p_academy: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_academy_owner_or_admin: {
        Args: { p_academy_id_text: string }
        Returns: boolean
      }
      is_member: { Args: { p_academy: string }; Returns: boolean }
      is_owner: { Args: { p_academy: string }; Returns: boolean }
      is_staff: { Args: { p_academy: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      my_join_requests: {
        Args: never
        Returns: {
          academy_id: string
          academy_name: string
          created_at: string
          request_id: string
          requested_role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["join_status"]
        }[]
      }
      my_linked_member_ids: { Args: { p_academy: string }; Returns: string[] }
      my_linked_players: { Args: { p_academy: string }; Returns: string[] }
      my_memberships: {
        Args: never
        Returns: {
          academy_id: string
          academy_name: string
          academy_slug: string
          city: string
          logo_url: string
          membership_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          timezone: string
        }[]
      }
      my_player_id: { Args: { p_academy: string }; Returns: string }
      record_academy_record: {
        Args: {
          p_academy: string
          p_match: string
          p_player: string
          p_record: Database["public"]["Enums"]["record_type"]
          p_value_num: number
          p_value_txt: string
        }
        Returns: undefined
      }
      redeem_parent_linking_code: { Args: { p_code: string }; Returns: string }
      refresh_academy_records: {
        Args: { p_academy: string }
        Returns: undefined
      }
      refresh_player_statistics: {
        Args: { p_academy: string; p_player: string }
        Returns: Json
      }
      regenerate_join_code: {
        Args: {
          p_academy: string
          p_expires_at?: string
          p_max_uses?: number
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      regenerate_owner_invitation: {
        Args: { p_academy_id: string }
        Returns: Json
      }
      reject_join_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      request_join_by_code: {
        Args: { p_code: string; p_message?: string }
        Returns: {
          academy_id: string
          created_at: string
          id: string
          join_code_id: string | null
          message: string | null
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["join_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "join_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_owner_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      save_match_result: { Args: { p_payload: Json }; Returns: Json }
      slugify: { Args: { p_value: string }; Returns: string }
      super_admin_add_member: {
        Args: {
          p_academy_id: string
          p_batch_id?: string
          p_email?: string
          p_full_name: string
          p_phone?: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      super_admin_create_academy_with_invite: {
        Args: {
          p_city?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_fee_mode?: Database["public"]["Enums"]["fee_mode"]
          p_name: string
          p_timezone?: string
        }
        Returns: Json
      }
      super_admin_get_or_create_user: {
        Args: { p_email: string; p_full_name?: string; p_phone?: string }
        Returns: string
      }
      super_admin_seed_academy_demo_data: {
        Args: { p_academy_id: string }
        Returns: Json
      }
      upsert_cricheroes_player_mappings: {
        Args: { p_academy_id: string; p_mappings: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "academy_owner" | "coach" | "player" | "parent"
      attendance_status: "present" | "absent"
      audience_type: "all" | "coaches" | "players" | "batch" | "all_parents"
      drill_assignment_status: "assigned" | "completed"
      drill_category: "batting" | "bowling" | "fielding" | "fitness"
      fee_mode: "academy_pays" | "player_pays"
      join_status: "pending" | "approved" | "rejected" | "cancelled"
      match_format: "t20" | "odi" | "test" | "t10" | "custom"
      match_result: "won" | "lost" | "tie" | "no_result" | "draw"
      match_status: "created" | "in_progress" | "completed" | "cancelled"
      match_type: "practice" | "friendly" | "league" | "tournament"
      member_status: "pending" | "active" | "suspended" | "rejected" | "left"
      milestone_type:
        | "debut_match"
        | "first_fifty"
        | "first_century"
        | "first_five_wicket_haul"
        | "runs_100"
        | "runs_500"
        | "runs_1000"
        | "wickets_50"
        | "wickets_100"
        | "catches_25"
      notif_channel: "in_app" | "push" | "email"
      notif_status: "queued" | "sent" | "failed" | "read"
      record_type:
        | "highest_team_score"
        | "lowest_team_score"
        | "biggest_victory"
        | "highest_successful_chase"
        | "highest_partnership"
        | "most_runs_one_match"
        | "most_wickets_one_match"
        | "most_sixes"
        | "most_fours"
      session_status: "scheduled" | "completed" | "cancelled"
      skill_level: "beginner" | "intermediate" | "advanced" | "elite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["super_admin", "academy_owner", "coach", "player", "parent"],
      attendance_status: ["present", "absent"],
      audience_type: ["all", "coaches", "players", "batch", "all_parents"],
      drill_assignment_status: ["assigned", "completed"],
      drill_category: ["batting", "bowling", "fielding", "fitness"],
      fee_mode: ["academy_pays", "player_pays"],
      join_status: ["pending", "approved", "rejected", "cancelled"],
      match_format: ["t20", "odi", "test", "t10", "custom"],
      match_result: ["won", "lost", "tie", "no_result", "draw"],
      match_status: ["created", "in_progress", "completed", "cancelled"],
      match_type: ["practice", "friendly", "league", "tournament"],
      member_status: ["pending", "active", "suspended", "rejected", "left"],
      milestone_type: [
        "debut_match",
        "first_fifty",
        "first_century",
        "first_five_wicket_haul",
        "runs_100",
        "runs_500",
        "runs_1000",
        "wickets_50",
        "wickets_100",
        "catches_25",
      ],
      notif_channel: ["in_app", "push", "email"],
      notif_status: ["queued", "sent", "failed", "read"],
      record_type: [
        "highest_team_score",
        "lowest_team_score",
        "biggest_victory",
        "highest_successful_chase",
        "highest_partnership",
        "most_runs_one_match",
        "most_wickets_one_match",
        "most_sixes",
        "most_fours",
      ],
      session_status: ["scheduled", "completed", "cancelled"],
      skill_level: ["beginner", "intermediate", "advanced", "elite"],
    },
  },
} as const

