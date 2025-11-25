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
        }
        Relationships: []
      }
      ai_routing_rules: {
        Row: {
          channel: string
          created_at: string | null
          department: Database["public"]["Enums"]["department_type"] | null
          id: string
          is_active: boolean | null
          persona_id: string | null
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          department?: Database["public"]["Enums"]["department_type"] | null
          id?: string
          is_active?: boolean | null
          persona_id?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          department?: Database["public"]["Enums"]["department_type"] | null
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
        ]
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
          last_contact_date: string | null
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
          last_contact_date?: string | null
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
          last_contact_date?: string | null
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
        ]
      }
      conversations: {
        Row: {
          ai_mode: Database["public"]["Enums"]["ai_mode"]
          assigned_to: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          contact_id: string
          created_at: string
          department: string | null
          id: string
          last_message_at: string
          related_ticket_id: string | null
          status: Database["public"]["Enums"]["conversation_status"]
        }
        Insert: {
          ai_mode?: Database["public"]["Enums"]["ai_mode"]
          assigned_to?: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          contact_id: string
          created_at?: string
          department?: string | null
          id?: string
          last_message_at?: string
          related_ticket_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
        }
        Update: {
          ai_mode?: Database["public"]["Enums"]["ai_mode"]
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          contact_id?: string
          created_at?: string
          department?: string | null
          id?: string
          last_message_at?: string
          related_ticket_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
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
        ]
      }
      customer_journey_steps: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          contact_id: string
          created_at: string
          id: string
          is_critical: boolean
          notes: string | null
          position: number
          step_name: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_critical?: boolean
          notes?: string | null
          position?: number
          step_name: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_critical?: boolean
          notes?: string | null
          position?: number
          step_name?: string
          updated_at?: string
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
          closed_at: string | null
          contact_id: string | null
          created_at: string
          currency: string | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          organization_id: string | null
          pipeline_id: string
          probability: number | null
          product_id: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          organization_id?: string | null
          pipeline_id: string
          probability?: number | null
          product_id?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          organization_id?: string | null
          pipeline_id?: string
          probability?: number | null
          product_id?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
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
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
      knowledge_articles: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
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
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message_type: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_account_manager: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_account_manager?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_account_manager?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string
          full_name: string
          id: string
          job_title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department: string
          full_name: string
          id: string
          job_title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string
          full_name?: string
          id?: string
          job_title?: string | null
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
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department_type"] | null
          description: string | null
          goal_type: string
          id: string
          period_month: number
          period_year: number
          status: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"] | null
          description?: string | null
          goal_type: string
          id?: string
          period_month: number
          period_year: number
          status?: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"] | null
          description?: string | null
          goal_type?: string
          id?: string
          period_month?: number
          period_year?: number
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
      stages: {
        Row: {
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
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
          assigned_to: string | null
          attachment_url: string | null
          category: Database["public"]["Enums"]["ticket_category"] | null
          created_at: string
          customer_id: string
          description: string
          due_date: string | null
          id: string
          internal_note: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          source_conversation_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["ticket_category"] | null
          created_at?: string
          customer_id: string
          description: string
          due_date?: string | null
          id?: string
          internal_note?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["ticket_category"] | null
          created_at?: string
          customer_id?: string
          description?: string
          due_date?: string | null
          id?: string
          internal_note?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
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
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      distribute_client_to_consultant: {
        Args: { p_contact_id: string }
        Returns: Json
      }
      get_ai_usage_metrics: {
        Args: { p_end_date: string; p_start_date: string; p_user_id?: string }
        Returns: {
          feature_type: string
          sentiment_breakdown: Json
          unique_users: number
          usage_count: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      communication_channel:
        | "email"
        | "phone"
        | "whatsapp"
        | "chat"
        | "meeting"
        | "form"
        | "other"
      conversation_channel: "whatsapp" | "email"
      conversation_status: "open" | "closed"
      customer_status:
        | "lead"
        | "qualified"
        | "customer"
        | "inactive"
        | "churned"
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
      sender_type: "user" | "contact"
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
      communication_channel: [
        "email",
        "phone",
        "whatsapp",
        "chat",
        "meeting",
        "form",
        "other",
      ],
      conversation_channel: ["whatsapp", "email"],
      conversation_status: ["open", "closed"],
      customer_status: ["lead", "qualified", "customer", "inactive", "churned"],
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
      sender_type: ["user", "contact"],
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
