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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          assigned_to: string
          completed: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string
          id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          assigned_to: string
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      agent_support_channels: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          profile_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_support_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_support_channels_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_failure_logs: {
        Row: {
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          customer_message: string | null
          error_message: string
          error_stack: string | null
          id: string
          notification_sent_at: string | null
          notified_admin: boolean | null
        }
        Insert: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_message?: string | null
          error_message: string
          error_stack?: string | null
          id?: string
          notification_sent_at?: string | null
          notified_admin?: boolean | null
        }
        Update: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_message?: string | null
          error_message?: string
          error_stack?: string | null
          id?: string
          notification_sent_at?: string | null
          notified_admin?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_failure_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_failure_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_persona_tools: {
        Row: {
          created_at: string | null
          persona_id: string
          tool_id: string
        }
        Insert: {
          created_at?: string | null
          persona_id: string
          tool_id: string
        }
        Update: {
          created_at?: string | null
          persona_id?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_persona_tools_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_persona_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_personas: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          knowledge_base_paths: string[] | null
          max_tokens: number | null
          name: string
          role: string
          system_prompt: string
          temperature: number | null
          updated_at: string | null
          use_priority_instructions: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          knowledge_base_paths?: string[] | null
          max_tokens?: number | null
          name: string
          role: string
          system_prompt: string
          temperature?: number | null
          updated_at?: string | null
          use_priority_instructions?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          knowledge_base_paths?: string[] | null
          max_tokens?: number | null
          name?: string
          role?: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string | null
          use_priority_instructions?: boolean | null
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          answer: string
          context_ids: Json | null
          created_at: string
          id: string
          question_hash: string
        }
        Insert: {
          answer: string
          context_ids?: Json | null
          created_at?: string
          id?: string
          question_hash: string
        }
        Update: {
          answer?: string
          context_ids?: Json | null
          created_at?: string
          id?: string
          question_hash?: string
        }
        Relationships: []
      }
      ai_routing_rules: {
        Row: {
          channel: string
          created_at: string | null
          department: string | null
          id: string
          is_active: boolean | null
          persona_id: string | null
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          department?: string | null
          id?: string
          is_active?: boolean | null
          persona_id?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          department?: string | null
          id?: string
          is_active?: boolean | null
          persona_id?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_routing_rules_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_routing_rules_department"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_scenario_configs: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          system_instruction: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          system_instruction: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          system_instruction?: string
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          context: Json | null
          conversation_id: string
          created_at: string
          id: string
          suggested_reply: string
          used: boolean
        }
        Insert: {
          context?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          suggested_reply: string
          used?: boolean
        }
        Update: {
          context?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          suggested_reply?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tools: {
        Row: {
          created_at: string | null
          description: string
          function_schema: Json
          id: string
          is_enabled: boolean | null
          name: string
          requires_auth: boolean | null
        }
        Insert: {
          created_at?: string | null
          description: string
          function_schema: Json
          id?: string
          is_enabled?: boolean | null
          name: string
          requires_auth?: boolean | null
        }
        Update: {
          created_at?: string | null
          description?: string
          function_schema?: Json
          id?: string
          is_enabled?: boolean | null
          name?: string
          requires_auth?: boolean | null
        }
        Relationships: []
      }
      ai_training_examples: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          ideal_output: string
          input_text: string
          is_active: boolean | null
          persona_id: string
          scenario_type: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ideal_output: string
          input_text: string
          is_active?: boolean | null
          persona_id: string
          scenario_type?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ideal_output?: string
          input_text?: string
          is_active?: boolean | null
          persona_id?: string
          scenario_type?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_examples_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          feature_type: string
          id: string
          result_data: Json | null
          ticket_id: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          feature_type: string
          id?: string
          result_data?: Json | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          feature_type?: string
          id?: string
          result_data?: Json | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          automation_id: string
          error_message: string | null
          executed_at: string
          execution_result: Json | null
          execution_status: string
          id: string
          trigger_data: Json
        }
        Insert: {
          automation_id: string
          error_message?: string | null
          executed_at?: string
          execution_result?: Json | null
          execution_status: string
          id?: string
          trigger_data: Json
        }
        Update: {
          automation_id?: string
          error_message?: string | null
          executed_at?: string
          execution_result?: Json | null
          execution_status?: string
          id?: string
          trigger_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json
          action_type: Database["public"]["Enums"]["automation_action"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_conditions: Json | null
          trigger_event: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          action_config: Json
          action_type: Database["public"]["Enums"]["automation_action"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_conditions?: Json | null
          trigger_event: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: Database["public"]["Enums"]["automation_action"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_conditions?: Json | null
          trigger_event?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_enrollments: {
        Row: {
          cadence_id: string
          completed_at: string | null
          contact_id: string
          created_at: string
          current_step: number
          enrolled_by: string | null
          id: string
          next_step_at: string | null
          replied_at: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cadence_id: string
          completed_at?: string | null
          contact_id: string
          created_at?: string
          current_step?: number
          enrolled_by?: string | null
          id?: string
          next_step_at?: string | null
          replied_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cadence_id?: string
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step?: number
          enrolled_by?: string | null
          id?: string
          next_step_at?: string | null
          replied_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_steps: {
        Row: {
          cadence_id: string
          created_at: string
          day_offset: number
          id: string
          is_automated: boolean
          message_template: string | null
          position: number
          step_type: string
          task_description: string | null
          task_title: string | null
          template_id: string | null
        }
        Insert: {
          cadence_id: string
          created_at?: string
          day_offset?: number
          id?: string
          is_automated?: boolean
          message_template?: string | null
          position?: number
          step_type: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
        }
        Update: {
          cadence_id?: string
          created_at?: string
          day_offset?: number
          id?: string
          is_automated?: boolean
          message_template?: string | null
          position?: number
          step_type?: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          contact_id: string
          created_at: string
          description: string | null
          enrollment_id: string
          id: string
          scheduled_for: string
          status: string
          step_id: string
          task_type: string
          template_content: string | null
          title: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          enrollment_id: string
          id?: string
          scheduled_for: string
          status?: string
          step_id: string
          task_type: string
          template_content?: string | null
          title: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          enrollment_id?: string
          id?: string
          scheduled_for?: string
          status?: string
          step_id?: string
          task_type?: string
          template_content?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "cadence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "cadence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          department_id: string | null
          id: string
          is_public: boolean | null
          shortcut: string
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string
          department_id?: string | null
          id?: string
          is_public?: boolean | null
          shortcut: string
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          department_id?: string | null
          id?: string
          is_public?: boolean | null
          shortcut?: string
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_balance: number | null
          address: string | null
          address_complement: string | null
          address_number: string | null
          assigned_to: string | null
          avatar_url: string | null
          birth_date: string | null
          blocked: boolean | null
          city: string | null
          company: string | null
          consultant_id: string | null
          created_at: string
          customer_type: string | null
          document: string | null
          email: string | null
          first_name: string
          id: string
          kiwify_customer_id: string | null
          kiwify_subscription_id: string | null
          last_contact_date: string | null
          last_kiwify_event: string | null
          last_kiwify_event_at: string | null
          last_name: string
          last_payment_date: string | null
          neighborhood: string | null
          next_payment_date: string | null
          organization_id: string | null
          phone: string | null
          recent_orders_count: number | null
          registration_date: string | null
          source: string | null
          state: string | null
          state_registration: string | null
          status: Database["public"]["Enums"]["customer_status"] | null
          subscription_plan: string | null
          support_channel_id: string | null
          total_ltv: number | null
          whatsapp_id: string | null
          zip_code: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked?: boolean | null
          city?: string | null
          company?: string | null
          consultant_id?: string | null
          created_at?: string
          customer_type?: string | null
          document?: string | null
          email?: string | null
          first_name: string
          id?: string
          kiwify_customer_id?: string | null
          kiwify_subscription_id?: string | null
          last_contact_date?: string | null
          last_kiwify_event?: string | null
          last_kiwify_event_at?: string | null
          last_name: string
          last_payment_date?: string | null
          neighborhood?: string | null
          next_payment_date?: string | null
          organization_id?: string | null
          phone?: string | null
          recent_orders_count?: number | null
          registration_date?: string | null
          source?: string | null
          state?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["customer_status"] | null
          subscription_plan?: string | null
          support_channel_id?: string | null
          total_ltv?: number | null
          whatsapp_id?: string | null
          zip_code?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked?: boolean | null
          city?: string | null
          company?: string | null
          consultant_id?: string | null
          created_at?: string
          customer_type?: string | null
          document?: string | null
          email?: string | null
          first_name?: string
          id?: string
          kiwify_customer_id?: string | null
          kiwify_subscription_id?: string | null
          last_contact_date?: string | null
          last_kiwify_event?: string | null
          last_kiwify_event_at?: string | null
          last_name?: string
          last_payment_date?: string | null
          neighborhood?: string | null
          next_payment_date?: string | null
          organization_id?: string | null
          phone?: string | null
          recent_orders_count?: number | null
          registration_date?: string | null
          source?: string | null
          state?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["customer_status"] | null
          subscription_plan?: string | null
          support_channel_id?: string | null
          total_ltv?: number | null
          whatsapp_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_support_channel_id_fkey"
            columns: ["support_channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_queue: {
        Row: {
          assigned_at: string | null
          conversation_id: string
          id: string
          priority: number | null
          queued_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          conversation_id: string
          id?: string
          priority?: number | null
          queued_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          conversation_id?: string
          id?: string
          priority?: number | null
          queued_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_ratings: {
        Row: {
          ai_analysis: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          conversation_id: string
          created_at: string
          feedback_text: string | null
          id: string
          manager_alert_sent: boolean
          rating: number
          sentiment_score: string | null
        }
        Insert: {
          ai_analysis?: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          conversation_id: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          manager_alert_sent?: boolean
          rating: number
          sentiment_score?: string | null
        }
        Update: {
          ai_analysis?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          conversation_id?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          manager_alert_sent?: boolean
          rating?: number
          sentiment_score?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_ratings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_mode: Database["public"]["Enums"]["ai_mode"]
          assigned_to: string | null
          auto_closed: boolean | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          closed_at: string | null
          closed_by: string | null
          contact_id: string
          created_at: string
          customer_metadata: Json | null
          department: string | null
          first_response_at: string | null
          id: string
          last_message_at: string
          related_ticket_id: string | null
          session_token: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          support_channel_id: string | null
          whatsapp_instance_id: string | null
        }
        Insert: {
          ai_mode?: Database["public"]["Enums"]["ai_mode"]
          assigned_to?: string | null
          auto_closed?: boolean | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          closed_at?: string | null
          closed_by?: string | null
          contact_id: string
          created_at?: string
          customer_metadata?: Json | null
          department?: string | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          related_ticket_id?: string | null
          session_token?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          support_channel_id?: string | null
          whatsapp_instance_id?: string | null
        }
        Update: {
          ai_mode?: Database["public"]["Enums"]["ai_mode"]
          assigned_to?: string | null
          auto_closed?: boolean | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          closed_at?: string | null
          closed_by?: string | null
          contact_id?: string
          created_at?: string
          customer_metadata?: Json | null
          department?: string | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          related_ticket_id?: string | null
          session_token?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          support_channel_id?: string | null
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_department_fkey"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_support_channel_id_fkey"
            columns: ["support_channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_goals: {
        Row: {
          activation_count: number
          bonus_amount: number
          consultant_id: string
          created_at: string
          created_by: string | null
          id: string
          max_churn_rate: number
          month: string
          target_gmv: number
          target_upsell: number
          updated_at: string
        }
        Insert: {
          activation_count?: number
          bonus_amount?: number
          consultant_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_churn_rate?: number
          month: string
          target_gmv?: number
          target_upsell?: number
          updated_at?: string
        }
        Update: {
          activation_count?: number
          bonus_amount?: number
          consultant_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_churn_rate?: number
          month?: string
          target_gmv?: number
          target_upsell?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_journey_steps: {
        Row: {
          attachments: Json | null
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          contact_id: string
          created_at: string
          id: string
          is_critical: boolean
          notes: string | null
          position: number
          quiz_attempts: number | null
          quiz_correct_option: string | null
          quiz_enabled: boolean | null
          quiz_options: Json | null
          quiz_passed: boolean | null
          quiz_passed_at: string | null
          quiz_question: string | null
          rich_content: string | null
          step_name: string
          updated_at: string
          video_completed: boolean | null
          video_completed_at: string | null
          video_url: string | null
        }
        Insert: {
          attachments?: Json | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_critical?: boolean
          notes?: string | null
          position?: number
          quiz_attempts?: number | null
          quiz_correct_option?: string | null
          quiz_enabled?: boolean | null
          quiz_options?: Json | null
          quiz_passed?: boolean | null
          quiz_passed_at?: string | null
          quiz_question?: string | null
          rich_content?: string | null
          step_name: string
          updated_at?: string
          video_completed?: boolean | null
          video_completed_at?: string | null
          video_url?: string | null
        }
        Update: {
          attachments?: Json | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_critical?: boolean
          notes?: string | null
          position?: number
          quiz_attempts?: number | null
          quiz_correct_option?: string | null
          quiz_enabled?: boolean | null
          quiz_options?: Json | null
          quiz_passed?: boolean | null
          quiz_passed_at?: string | null
          quiz_question?: string | null
          rich_content?: string | null
          step_name?: string
          updated_at?: string
          video_completed?: boolean | null
          video_completed_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_journey_steps_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_journey_steps_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          churn_risk: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          currency: string | null
          expected_close_date: string | null
          expected_revenue: number | null
          id: string
          lead_email: string | null
          lead_phone: string | null
          lead_source: string | null
          lead_whatsapp_id: string | null
          lost_reason: string | null
          organization_id: string | null
          pain_points: string | null
          pipeline_id: string
          probability: number | null
          product_id: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          success_criteria: string | null
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          churn_risk?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string | null
          expected_close_date?: string | null
          expected_revenue?: number | null
          id?: string
          lead_email?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          lead_whatsapp_id?: string | null
          lost_reason?: string | null
          organization_id?: string | null
          pain_points?: string | null
          pipeline_id: string
          probability?: number | null
          product_id?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          success_criteria?: string | null
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          churn_risk?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string | null
          expected_close_date?: string | null
          expected_revenue?: number | null
          id?: string
          lead_email?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          lead_whatsapp_id?: string | null
          lost_reason?: string | null
          organization_id?: string | null
          pain_points?: string | null
          pipeline_id?: string
          probability?: number | null
          product_id?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          success_criteria?: string | null
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          html_body: string
          id: string
          is_active: boolean
          name: string
          subject: string
          trigger_type: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html_body: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          trigger_type?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html_body?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          trigger_type?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verifications: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      forms: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          schema: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          schema?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          schema?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      goal_milestones: {
        Row: {
          achieved_at: string | null
          created_at: string
          goal_id: string
          id: string
          milestone_percentage: number
          notified: boolean | null
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          goal_id: string
          id?: string
          milestone_percentage: number
          notified?: boolean | null
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          milestone_percentage?: number
          notified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "sales_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      group_playbooks: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          playbook_id: string
          position: number | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          playbook_id: string
          position?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          playbook_id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_playbooks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "delivery_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_playbooks_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "onboarding_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          channel: Database["public"]["Enums"]["communication_channel"]
          content: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          metadata: Json | null
          playbook_execution_id: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          channel: Database["public"]["Enums"]["communication_channel"]
          content: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          metadata?: Json | null
          playbook_execution_id?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          content?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          metadata?: Json | null
          playbook_execution_id?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_playbook_execution_id_fkey"
            columns: ["playbook_execution_id"]
            isOneToOne: false
            referencedRelation: "playbook_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_events: {
        Row: {
          created_at: string | null
          customer_email: string | null
          error_message: string | null
          event_type: string
          id: string
          offer_id: string | null
          order_id: string
          payload: Json
          processed: boolean | null
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          offer_id?: string | null
          order_id: string
          payload: Json
          processed?: boolean | null
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          offer_id?: string | null
          order_id?: string
          payload?: Json
          processed?: boolean | null
          product_id?: string | null
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          embedding: string | null
          id: string
          is_published: boolean
          source: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          is_published?: boolean
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          is_published?: boolean
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          channel: Database["public"]["Enums"]["conversation_channel"] | null
          content: string
          conversation_id: string
          created_at: string
          delivery_error: string | null
          id: string
          is_ai_generated: boolean | null
          is_read: boolean | null
          message_type: string | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status: Database["public"]["Enums"]["message_status"] | null
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"] | null
          content: string
          conversation_id: string
          created_at?: string
          delivery_error?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"] | null
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"] | null
          content?: string
          conversation_id?: string
          created_at?: string
          delivery_error?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_playbooks: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          execution_count: number | null
          flow_definition: Json
          id: string
          is_active: boolean | null
          is_template: boolean | null
          name: string
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          flow_definition?: Json
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name: string
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          flow_definition?: Json
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name?: string
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_playbooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_playbooks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: []
      }
      playbook_execution_queue: {
        Row: {
          created_at: string | null
          executed_at: string | null
          execution_id: string
          id: string
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          node_data: Json
          node_id: string
          node_type: string
          retry_count: number
          scheduled_for: string
          status: string
        }
        Insert: {
          created_at?: string | null
          executed_at?: string | null
          execution_id: string
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          node_data?: Json
          node_id: string
          node_type: string
          retry_count?: number
          scheduled_for: string
          status?: string
        }
        Update: {
          created_at?: string | null
          executed_at?: string | null
          execution_id?: string
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          node_data?: Json
          node_id?: string
          node_type?: string
          retry_count?: number
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_execution_queue_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "playbook_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_executions: {
        Row: {
          completed_at: string | null
          completion_reason: Json | null
          contact_id: string
          created_at: string | null
          current_node_id: string | null
          errors: Json | null
          id: string
          nodes_executed: Json | null
          playbook_id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completion_reason?: Json | null
          contact_id: string
          created_at?: string | null
          current_node_id?: string | null
          errors?: Json | null
          id?: string
          nodes_executed?: Json | null
          playbook_id: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completion_reason?: Json | null
          contact_id?: string
          created_at?: string | null
          current_node_id?: string | null
          errors?: Json | null
          id?: string
          nodes_executed?: Json | null
          playbook_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_executions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "onboarding_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_goals: {
        Row: {
          contact_id: string
          created_at: string | null
          description: string | null
          goal_conditions: Json | null
          goal_type: string
          id: string
          is_active: boolean | null
          playbook_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          description?: string | null
          goal_conditions?: Json | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          playbook_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          description?: string | null
          goal_conditions?: Json | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          playbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_goals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_goals_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "onboarding_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          offer_id: string
          offer_name: string
          price: number | null
          product_id: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_id: string
          offer_name: string
          price?: number | null
          product_id: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_id?: string
          offer_name?: string
          price?: number | null
          product_id?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          delivery_group_id: string | null
          description: string | null
          external_id: string | null
          id: string
          is_active: boolean
          name: string
          price: number | null
          requires_account_manager: boolean
          support_channel_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_group_id?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          requires_account_manager?: boolean
          support_channel_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_group_id?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          requires_account_manager?: boolean
          support_channel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_delivery_group_id_fkey"
            columns: ["delivery_group_id"]
            isOneToOne: false
            referencedRelation: "delivery_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_support_channel_id_fkey"
            columns: ["support_channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          availability_status: Database["public"]["Enums"]["availability_status"]
          avatar_url: string | null
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          created_at: string | null
          department: string
          full_name: string
          id: string
          is_archived: boolean | null
          is_blocked: boolean | null
          job_title: string | null
          last_status_change: string | null
          manager_id: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          availability_status?: Database["public"]["Enums"]["availability_status"]
          avatar_url?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string | null
          department: string
          full_name: string
          id: string
          is_archived?: boolean | null
          is_blocked?: boolean | null
          job_title?: string | null
          last_status_change?: string | null
          manager_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          availability_status?: Database["public"]["Enums"]["availability_status"]
          avatar_url?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string | null
          department?: string
          full_name?: string
          id?: string
          is_archived?: boolean | null
          is_blocked?: boolean | null
          job_title?: string | null
          last_status_change?: string | null
          manager_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_skills: {
        Row: {
          created_at: string | null
          proficiency_level: string | null
          profile_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string | null
          proficiency_level?: string | null
          profile_id: string
          skill_id: string
        }
        Update: {
          created_at?: string | null
          proficiency_level?: string | null
          profile_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      public_ticket_portal_config: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          position: number
          product_id: string
          quantity: number
          quote_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          position?: number
          product_id: string
          quantity?: number
          quote_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          position?: number
          product_id?: string
          quantity?: number
          quote_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          deal_id: string
          discount_amount: number | null
          discount_percentage: number | null
          expiration_date: string
          id: string
          pdf_url: string | null
          quote_number: string
          rejected_at: string | null
          rejection_reason: string | null
          signature_data: string | null
          signature_ip: string | null
          signature_token: string | null
          signed_at: string | null
          signed_by_cpf: string | null
          signed_by_name: string | null
          signed_pdf_url: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          discount_amount?: number | null
          discount_percentage?: number | null
          expiration_date: string
          id?: string
          pdf_url?: string | null
          quote_number: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signature_data?: string | null
          signature_ip?: string | null
          signature_token?: string | null
          signed_at?: string | null
          signed_by_cpf?: string | null
          signed_by_name?: string | null
          signed_pdf_url?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          expiration_date?: string
          id?: string
          pdf_url?: string | null
          quote_number?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          signature_data?: string | null
          signature_ip?: string | null
          signature_token?: string | null
          signed_at?: string | null
          signed_by_cpf?: string | null
          signed_by_name?: string | null
          signed_pdf_url?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_type: string
          blocked_until: string | null
          id: string
          identifier: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          action_type: string
          blocked_until?: string | null
          id?: string
          identifier: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          action_type?: string
          blocked_until?: string | null
          id?: string
          identifier?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      rlhf_feedback: {
        Row: {
          created_at: string | null
          created_by: string | null
          feedback_comment: string | null
          feedback_type: string
          id: string
          message_content: string
          persona_id: string
          tool_calls: Json | null
          user_message: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          feedback_comment?: string | null
          feedback_type: string
          id?: string
          message_content: string
          persona_id: string
          tool_calls?: Json | null
          user_message: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          feedback_comment?: string | null
          feedback_type?: string
          id?: string
          message_content?: string
          persona_id?: string
          tool_calls?: Json | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          assigned_to: string | null
          commission_rate: number | null
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department_type"] | null
          description: string | null
          goal_type: string
          id: string
          period_month: number
          period_year: number
          product_targets: Json | null
          status: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"] | null
          description?: string | null
          goal_type: string
          id?: string
          period_month: number
          period_year: number
          product_targets?: Json | null
          status?: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"] | null
          description?: string | null
          goal_type?: string
          id?: string
          period_month?: number
          period_year?: number
          product_targets?: Json | null
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          day_of_month: number | null
          day_of_week: number | null
          email: string
          filters: Json | null
          format: string | null
          frequency: string
          hour: number | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          report_name: string
          report_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          email: string
          filters?: Json | null
          format?: string | null
          frequency: string
          hour?: number | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          report_name: string
          report_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          email?: string
          filters?: Json | null
          format?: string | null
          frequency?: string
          hour?: number | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          report_name?: string
          report_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sla_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_minutes: number
          alert_type: string
          conversation_id: string
          created_at: string | null
          id: string
          notified_managers: Json | null
          resolved_at: string | null
          status: string | null
          threshold_minutes: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_minutes: number
          alert_type?: string
          conversation_id: string
          created_at?: string | null
          id?: string
          notified_managers?: Json | null
          resolved_at?: string | null
          status?: string | null
          threshold_minutes?: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_minutes?: number
          alert_type?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          notified_managers?: Json | null
          resolved_at?: string | null
          status?: string | null
          threshold_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
          probability: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position: number
          probability?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
          probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      support_channels: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      system_configurations: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          attachment_url: string | null
          attachments: Json | null
          category: Database["public"]["Enums"]["ticket_category"] | null
          channel: string | null
          conversation_id: string | null
          created_at: string
          customer_id: string
          department_id: string | null
          description: string
          due_date: string | null
          first_response_at: string | null
          id: string
          internal_note: string | null
          last_email_message_id: string | null
          merged_to_ticket_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          rejection_reason: string | null
          resolved_at: string | null
          source_conversation_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          attachment_url?: string | null
          attachments?: Json | null
          category?: Database["public"]["Enums"]["ticket_category"] | null
          channel?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_id: string
          department_id?: string | null
          description: string
          due_date?: string | null
          first_response_at?: string | null
          id?: string
          internal_note?: string | null
          last_email_message_id?: string | null
          merged_to_ticket_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rejection_reason?: string | null
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          attachment_url?: string | null
          attachments?: Json | null
          category?: Database["public"]["Enums"]["ticket_category"] | null
          channel?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_id?: string
          department_id?: string | null
          description?: string
          due_date?: string | null
          first_response_at?: string | null
          id?: string
          internal_note?: string | null
          last_email_message_id?: string | null
          merged_to_ticket_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rejection_reason?: string | null
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_merged_to_ticket_id_fkey"
            columns: ["merged_to_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          ai_mode: string | null
          api_token: string
          api_url: string
          created_at: string | null
          department_id: string | null
          id: string
          instance_name: string
          name: string
          phone_number: string | null
          qr_code_base64: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_mode?: string | null
          api_token: string
          api_url: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          instance_name: string
          name: string
          phone_number?: string | null
          qr_code_base64?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_mode?: string | null
          api_token?: string
          api_url?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          instance_name?: string
          name?: string
          phone_number?: string | null
          qr_code_base64?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_duplicate_articles: {
        Args: {
          p_article_id?: string
          p_content: string
          similarity_threshold?: number
        }
        Returns: {
          similar_count: number
          top_similar_id: string
          top_similar_title: string
          top_similarity: number
        }[]
      }
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_block_minutes?: number
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      distribute_client_to_consultant: {
        Args: { p_contact_id: string }
        Returns: Json
      }
      find_similar_articles: {
        Args: {
          article_id: string
          max_results?: number
          similarity_threshold?: number
        }
        Returns: {
          category: string
          id: string
          similarity: number
          title: string
        }[]
      }
      generate_quote_number: { Args: never; Returns: string }
      generate_session_token: { Args: never; Returns: string }
      get_ai_usage_metrics: {
        Args: { p_end_date: string; p_start_date: string; p_user_id?: string }
        Returns: {
          feature_type: string
          sentiment_breakdown: Json
          unique_users: number
          usage_count: number
        }[]
      }
      get_avg_first_response_time: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      get_avg_resolution_time: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      get_conversation_heatmap: {
        Args: { p_end: string; p_start: string }
        Returns: {
          count: number
          day_of_week: number
          hour_of_day: number
        }[]
      }
      get_conversion_rate_timeline: {
        Args: { p_days_back?: number }
        Returns: {
          conversion_rate: number
          date: string
          lost_deals: number
          total_deals: number
          won_deals: number
        }[]
      }
      get_least_loaded_consultant: { Args: never; Returns: string }
      get_least_loaded_sales_rep: { Args: never; Returns: string }
      get_or_create_conversation: {
        Args: {
          p_channel?: string
          p_contact_id: string
          p_department_id?: string
        }
        Returns: {
          conversation_id: string
          is_existing: boolean
          was_reopened: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge_articles: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      update_article_embedding: {
        Args: { article_id: string; new_embedding: string }
        Returns: undefined
      }
      upsert_contact_with_interaction:
        | {
            Args: {
              p_company?: string
              p_email: string
              p_first_name: string
              p_last_name: string
              p_organization_id?: string
              p_phone?: string
              p_source?: string
            }
            Returns: {
              contact_id: string
              is_new_contact: boolean
              message: string
              previous_status: Database["public"]["Enums"]["customer_status"]
            }[]
          }
        | {
            Args: {
              p_assigned_to?: string
              p_company?: string
              p_email: string
              p_first_name: string
              p_last_name: string
              p_organization_id?: string
              p_phone?: string
              p_source?: string
            }
            Returns: {
              contact_id: string
              is_new_contact: boolean
              message: string
              previous_status: Database["public"]["Enums"]["customer_status"]
            }[]
          }
    }
    Enums: {
      activity_type: "call" | "meeting" | "email" | "task" | "lunch"
      ai_mode: "autopilot" | "copilot" | "disabled"
      app_role:
        | "admin"
        | "user"
        | "manager"
        | "sales_rep"
        | "consultant"
        | "support_agent"
        | "financial_manager"
        | "support_manager"
        | "cs_manager"
        | "general_manager"
      automation_action:
        | "assign_to_user"
        | "create_activity"
        | "add_tag"
        | "send_notification"
        | "change_status"
        | "send_email_to_customer"
      automation_trigger:
        | "deal_created"
        | "deal_won"
        | "deal_lost"
        | "deal_stage_changed"
        | "activity_overdue"
        | "contact_created"
        | "contact_inactive"
      availability_status: "online" | "busy" | "offline"
      communication_channel:
        | "email"
        | "phone"
        | "whatsapp"
        | "chat"
        | "meeting"
        | "form"
        | "other"
      conversation_channel: "whatsapp" | "email" | "web_chat"
      conversation_status: "open" | "closed"
      customer_status:
        | "lead"
        | "qualified"
        | "customer"
        | "inactive"
        | "churned"
        | "overdue"
      deal_status: "open" | "won" | "lost"
      department_type: "comercial" | "suporte" | "marketing" | "operacional"
      interaction_type:
        | "email_sent"
        | "email_open"
        | "email_click"
        | "call_incoming"
        | "call_outgoing"
        | "whatsapp_msg"
        | "whatsapp_reply"
        | "deal_created"
        | "deal_won"
        | "deal_lost"
        | "note"
        | "status_change"
        | "meeting"
        | "form_submission"
        | "conversation_transferred"
      message_status: "sending" | "sent" | "delivered" | "failed"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      sender_type: "user" | "contact" | "system"
      ticket_category: "financeiro" | "tecnico" | "bug" | "outro"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
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
  public: {
    Enums: {
      activity_type: ["call", "meeting", "email", "task", "lunch"],
      ai_mode: ["autopilot", "copilot", "disabled"],
      app_role: [
        "admin",
        "user",
        "manager",
        "sales_rep",
        "consultant",
        "support_agent",
        "financial_manager",
        "support_manager",
        "cs_manager",
        "general_manager",
      ],
      automation_action: [
        "assign_to_user",
        "create_activity",
        "add_tag",
        "send_notification",
        "change_status",
        "send_email_to_customer",
      ],
      automation_trigger: [
        "deal_created",
        "deal_won",
        "deal_lost",
        "deal_stage_changed",
        "activity_overdue",
        "contact_created",
        "contact_inactive",
      ],
      availability_status: ["online", "busy", "offline"],
      communication_channel: [
        "email",
        "phone",
        "whatsapp",
        "chat",
        "meeting",
        "form",
        "other",
      ],
      conversation_channel: ["whatsapp", "email", "web_chat"],
      conversation_status: ["open", "closed"],
      customer_status: [
        "lead",
        "qualified",
        "customer",
        "inactive",
        "churned",
        "overdue",
      ],
      deal_status: ["open", "won", "lost"],
      department_type: ["comercial", "suporte", "marketing", "operacional"],
      interaction_type: [
        "email_sent",
        "email_open",
        "email_click",
        "call_incoming",
        "call_outgoing",
        "whatsapp_msg",
        "whatsapp_reply",
        "deal_created",
        "deal_won",
        "deal_lost",
        "note",
        "status_change",
        "meeting",
        "form_submission",
        "conversation_transferred",
      ],
      message_status: ["sending", "sent", "delivered", "failed"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
      sender_type: ["user", "contact", "system"],
      ticket_category: ["financeiro", "tecnico", "bug", "outro"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
