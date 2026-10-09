export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_exams: {
        Row: {
          appointment_id: string
          exam_id: string
        }
        Insert: {
          appointment_id: string
          exam_id: string
        }
        Update: {
          appointment_id?: string
          exam_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_exams_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_exams_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_history: {
        Row: {
          action: string
          actor_id: string
          appointment_id: string
          created_at: string
          details: Json
          id: string
          new_status: Database["public"]["Enums"]["appointment_status"] | null
          previous_status:
            | Database["public"]["Enums"]["appointment_status"]
            | null
        }
        Insert: {
          action: string
          actor_id: string
          appointment_id: string
          created_at?: string
          details?: Json
          id?: string
          new_status?: Database["public"]["Enums"]["appointment_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["appointment_status"]
            | null
        }
        Update: {
          action?: string
          actor_id?: string
          appointment_id?: string
          created_at?: string
          details?: Json
          id?: string
          new_status?: Database["public"]["Enums"]["appointment_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["appointment_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assessment_type: string
          company_id: string
          created_at: string
          created_by: string
          employee_id: string
          ends_at: string
          id: string
          job_title: string | null
          location: string
          location_id: string | null
          notes: string | null
          slot_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          assessment_type: string
          company_id: string
          created_at?: string
          created_by: string
          employee_id: string
          ends_at: string
          id?: string
          job_title?: string | null
          location: string
          location_id?: string | null
          notes?: string | null
          slot_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          updated_by: string
        }
        Update: {
          assessment_type?: string
          company_id?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          ends_at?: string
          id?: string
          job_title?: string | null
          location?: string
          location_id?: string | null
          notes?: string | null
          slot_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "exam_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          is_active: boolean
          location_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          is_active?: boolean
          location_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "exam_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string
          complement: string | null
          created_at: string
          created_by: string
          district: string | null
          email: string | null
          id: string
          legal_name: string
          number: string | null
          phone: string | null
          postal_code: string | null
          registration_status: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          street: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj: string
          complement?: string | null
          created_at?: string
          created_by: string
          district?: string | null
          email?: string | null
          id?: string
          legal_name: string
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_status?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          street?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string
          complement?: string | null
          created_at?: string
          created_by?: string
          district?: string | null
          email?: string | null
          id?: string
          legal_name?: string
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_status?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          street?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_access_codes: {
        Row: {
          code_hash: string
          company_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          max_uses: number | null
          use_count: number
        }
        Insert: {
          code_hash: string
          company_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          max_uses?: number | null
          use_count?: number
        }
        Update: {
          code_hash?: string
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          max_uses?: number | null
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_access_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_exams: {
        Row: {
          employee_id: string
          exam_id: string
        }
        Insert: {
          employee_id: string
          exam_id: string
        }
        Update: {
          employee_id?: string
          exam_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exams_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          birth_date: string
          birthplace: string
          company_id: string
          cpf: string
          created_at: string
          created_by: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string
          nationality: string
          occupational_function_id: string | null
          rg: string | null
          sex: string
          updated_at: string
          workplace: string
        }
        Insert: {
          admission_date?: string | null
          birth_date: string
          birthplace: string
          company_id: string
          cpf: string
          created_at?: string
          created_by: string
          full_name: string
          id?: string
          is_active?: boolean
          job_title: string
          nationality: string
          occupational_function_id?: string | null
          rg?: string | null
          sex: string
          updated_at?: string
          workplace: string
        }
        Update: {
          admission_date?: string | null
          birth_date?: string
          birthplace?: string
          company_id?: string
          cpf?: string
          created_at?: string
          created_by?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string
          nationality?: string
          occupational_function_id?: string | null
          rg?: string | null
          sex?: string
          updated_at?: string
          workplace?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_occupational_function_id_fkey"
            columns: ["occupational_function_id"]
            isOneToOne: false
            referencedRelation: "occupational_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_location_companies: {
        Row: {
          company_id: string
          location_id: string
        }
        Insert: {
          company_id: string
          location_id: string
        }
        Update: {
          company_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_location_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_location_companies_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "exam_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_location_schedule_rules: {
        Row: {
          end_time: string
          id: string
          is_active: boolean
          location_id: string
          slot_minutes: number
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          is_active?: boolean
          location_id: string
          slot_minutes: number
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          is_active?: boolean
          location_id?: string
          slot_minutes?: number
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_location_schedule_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "exam_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_locations: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          created_by: string
          district: string | null
          id: string
          instructions_en: string | null
          instructions_pt: string | null
          is_active: boolean
          name: string
          number: string | null
          phone: string | null
          postal_code: string | null
          state: string
          street: string
          updated_at: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          created_by: string
          district?: string | null
          id?: string
          instructions_en?: string | null
          instructions_pt?: string | null
          is_active?: boolean
          name: string
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          state: string
          street: string
          updated_at?: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          created_by?: string
          district?: string | null
          id?: string
          instructions_en?: string | null
          instructions_pt?: string | null
          is_active?: boolean
          name?: string
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string
          street?: string
          updated_at?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          category: Database["public"]["Enums"]["exam_category"]
          created_at: string
          created_by: string | null
          description_en: string | null
          description_pt: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name_en: string
          name_pt: string
          preparation_en: string | null
          preparation_pt: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["exam_category"]
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_pt?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name_en: string
          name_pt: string
          preparation_en?: string | null
          preparation_pt?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["exam_category"]
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_pt?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name_en?: string
          name_pt?: string
          preparation_en?: string | null
          preparation_pt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          type: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          type: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_function_exams: {
        Row: {
          exam_id: string
          function_id: string
        }
        Insert: {
          exam_id: string
          function_id: string
        }
        Update: {
          exam_id?: string
          function_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupational_function_exams_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupational_function_exams_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "occupational_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_functions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupational_functions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_access_code: {
        Args: {
          _company_id: string
          _expires_at?: string
          _label?: string
          _max_uses?: number
          _plain_code: string
        }
        Returns: string
      }
      create_controlled_appointment: {
        Args: {
          _assessment_type: string
          _employee_id: string
          _exam_ids: string[]
          _job_title: string
          _notes?: string
          _slot_id: string
        }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_profile: {
        Args: { _full_name: string; _language?: string }
        Returns: Json
      }
      join_company_with_code: { Args: { _plain_code: string }; Returns: string }
      save_exam_location_for_user: {
        Args: { p_data: Json; p_location_id: string; p_user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "master" | "company_user"
      appointment_status: "scheduled" | "confirmed" | "completed" | "cancelled"
      company_status: "pending" | "approved" | "rejected" | "inactive"
      exam_category: "clinical" | "complementary"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "company_user"],
      appointment_status: ["scheduled", "confirmed", "completed", "cancelled"],
      company_status: ["pending", "approved", "rejected", "inactive"],
      exam_category: ["clinical", "complementary"],
    },
  },
} as const
