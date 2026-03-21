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
      admin_onboarding_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          status: string
          step_key: string
          updated_at: string | null
          user_id: string
          validated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          step_key: string
          updated_at?: string | null
          user_id: string
          validated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          step_key?: string
          updated_at?: string | null
          user_id?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_onboarding_steps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_primary: boolean
          profile_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_primary?: boolean
          profile_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_primary?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_departments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_quality_metrics: {
        Row: {
          agent_id: string
          classification_label: string | null
          conversation_id: string
          copilot_active: boolean | null
          created_at: string | null
          created_kb_gap: boolean | null
          csat_rating: number | null
          id: string
          resolution_time_seconds: number | null
          suggestions_available: number | null
          suggestions_used: number | null
        }
        Insert: {
          agent_id: string
          classification_label?: string | null
          conversation_id: string
          copilot_active?: boolean | null
          created_at?: string | null
          created_kb_gap?: boolean | null
          csat_rating?: number | null
          id?: string
          resolution_time_seconds?: number | null
          suggestions_available?: number | null
          suggestions_used?: number | null
        }
        Update: {
          agent_id?: string
          classification_label?: string | null
          conversation_id?: string
          copilot_active?: boolean | null
          created_at?: string | null
          created_kb_gap?: boolean | null
          csat_rating?: number | null
          id?: string
          resolution_time_seconds?: number | null
          suggestions_available?: number | null
          suggestions_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_quality_metrics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
      ai_anomaly_logs: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          change_percent: number
          current_value: number
          department_id: string | null
          detected_at: string | null
          id: string
          metric_type: string
          previous_value: number
          severity: string | null
          threshold_percent: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          change_percent: number
          current_value: number
          department_id?: string | null
          detected_at?: string | null
          id?: string
          metric_type: string
          previous_value: number
          severity?: string | null
          threshold_percent: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          change_percent?: number
          current_value?: number
          department_id?: string | null
          detected_at?: string | null
          id?: string
          metric_type?: string
          previous_value?: number
          severity?: string | null
          threshold_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_anomaly_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decision_logs: {
        Row: {
          channel: string | null
          conversation_id: string
          correlation_id: string
          created_at: string
          decision: string
          decision_reason: string | null
          department: string | null
          error: string | null
          id: string
          message_id: string | null
          persona_id: string | null
          rule_id: string | null
        }
        Insert: {
          channel?: string | null
          conversation_id: string
          correlation_id: string
          created_at?: string
          decision: string
          decision_reason?: string | null
          department?: string | null
          error?: string | null
          id?: string
          message_id?: string | null
          persona_id?: string | null
          rule_id?: string | null
        }
        Update: {
          channel?: string | null
          conversation_id?: string
          correlation_id?: string
          created_at?: string
          decision?: string
          decision_reason?: string | null
          department?: string | null
          error?: string | null
          id?: string
          message_id?: string | null
          persona_id?: string | null
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_events: {
        Row: {
          created_at: string
          department_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          input_summary: string | null
          latency_ms: number | null
          model: string
          output_json: Json
          prompt_version: string | null
          score: number | null
          tokens_used: number | null
          trace_id: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          input_summary?: string | null
          latency_ms?: number | null
          model: string
          output_json?: Json
          prompt_version?: string | null
          score?: number | null
          tokens_used?: number | null
          trace_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          input_summary?: string | null
          latency_ms?: number | null
          model?: string
          output_json?: Json
          prompt_version?: string | null
          score?: number | null
          tokens_used?: number | null
          trace_id?: string | null
        }
        Relationships: []
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
      ai_governor_reports: {
        Row: {
          ai_analysis: string | null
          created_at: string | null
          date: string
          generated_at: string | null
          id: string
          metrics_snapshot: Json
          sent_to_phones: string[] | null
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string | null
          date: string
          generated_at?: string | null
          id?: string
          metrics_snapshot?: Json
          sent_to_phones?: string[] | null
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string | null
          date?: string
          generated_at?: string | null
          id?: string
          metrics_snapshot?: Json
          sent_to_phones?: string[] | null
        }
        Relationships: []
      }
      ai_learning_timeline: {
        Row: {
          confidence: string | null
          department_id: string | null
          id: string
          learned_at: string | null
          learning_type: string
          metadata: Json | null
          rejection_reason: string | null
          related_article_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_conversation_ids: string[] | null
          source_conversations: number | null
          status: string | null
          summary: string
        }
        Insert: {
          confidence?: string | null
          department_id?: string | null
          id?: string
          learned_at?: string | null
          learning_type: string
          metadata?: Json | null
          rejection_reason?: string | null
          related_article_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_conversation_ids?: string[] | null
          source_conversations?: number | null
          status?: string | null
          summary: string
        }
        Update: {
          confidence?: string | null
          department_id?: string | null
          id?: string
          learned_at?: string | null
          learning_type?: string
          metadata?: Json | null
          rejection_reason?: string | null
          related_article_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_conversation_ids?: string[] | null
          source_conversations?: number | null
          status?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_learning_timeline_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_learning_timeline_related_article_id_fkey"
            columns: ["related_article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_message_templates: {
        Row: {
          category: string
          content: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          title: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          title: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          title?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
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
          auto_handoff_on_low_confidence: boolean | null
          conservative_mode: boolean | null
          created_at: string | null
          data_access: Json | null
          id: string
          is_active: boolean | null
          knowledge_base_paths: string[] | null
          max_tokens: number | null
          min_confidence_threshold: number | null
          name: string
          role: string
          system_prompt: string
          temperature: number | null
          updated_at: string | null
          use_priority_instructions: boolean | null
        }
        Insert: {
          auto_handoff_on_low_confidence?: boolean | null
          conservative_mode?: boolean | null
          created_at?: string | null
          data_access?: Json | null
          id?: string
          is_active?: boolean | null
          knowledge_base_paths?: string[] | null
          max_tokens?: number | null
          min_confidence_threshold?: number | null
          name: string
          role: string
          system_prompt: string
          temperature?: number | null
          updated_at?: string | null
          use_priority_instructions?: boolean | null
        }
        Update: {
          auto_handoff_on_low_confidence?: boolean | null
          conservative_mode?: boolean | null
          created_at?: string | null
          data_access?: Json | null
          id?: string
          is_active?: boolean | null
          knowledge_base_paths?: string[] | null
          max_tokens?: number | null
          min_confidence_threshold?: number | null
          name?: string
          role?: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string | null
          use_priority_instructions?: boolean | null
        }
        Relationships: []
      }
      ai_quality_logs: {
        Row: {
          action_taken: string | null
          ai_response: string | null
          articles_count: number | null
          articles_used: Json | null
          confidence_score: number | null
          contact_id: string | null
          conversation_id: string | null
          correction_at: string | null
          correction_by: string | null
          coverage_score: number | null
          created_at: string | null
          customer_message: string
          feedback_notes: string | null
          feedback_type: string | null
          had_conflicts: boolean | null
          handoff_reason: string | null
          id: string
          persona_id: string | null
          retrieval_score: number | null
          was_corrected: boolean | null
        }
        Insert: {
          action_taken?: string | null
          ai_response?: string | null
          articles_count?: number | null
          articles_used?: Json | null
          confidence_score?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          correction_at?: string | null
          correction_by?: string | null
          coverage_score?: number | null
          created_at?: string | null
          customer_message: string
          feedback_notes?: string | null
          feedback_type?: string | null
          had_conflicts?: boolean | null
          handoff_reason?: string | null
          id?: string
          persona_id?: string | null
          retrieval_score?: number | null
          was_corrected?: boolean | null
        }
        Update: {
          action_taken?: string | null
          ai_response?: string | null
          articles_count?: number | null
          articles_used?: Json | null
          confidence_score?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          correction_at?: string | null
          correction_by?: string | null
          coverage_score?: number | null
          created_at?: string | null
          customer_message?: string
          feedback_notes?: string | null
          feedback_type?: string | null
          had_conflicts?: boolean | null
          handoff_reason?: string | null
          id?: string
          persona_id?: string | null
          retrieval_score?: number | null
          was_corrected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_quality_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_logs_correction_by_fkey"
            columns: ["correction_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quality_logs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
        ]
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
          classification_label: string | null
          confidence_score: number | null
          context: Json | null
          conversation_id: string
          created_at: string
          id: string
          kb_gap_description: string | null
          suggested_reply: string
          suggestion_type: string | null
          used: boolean
        }
        Insert: {
          classification_label?: string | null
          confidence_score?: number | null
          context?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          kb_gap_description?: string | null
          suggested_reply: string
          suggestion_type?: string | null
          used?: boolean
        }
        Update: {
          classification_label?: string | null
          confidence_score?: number | null
          context?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          kb_gap_description?: string | null
          suggested_reply?: string
          suggestion_type?: string | null
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
      broadcast_jobs: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          failed: number
          id: string
          message: string
          results: Json | null
          sent: number
          skipped: number
          started_at: string | null
          status: string
          target_filter: Json | null
          total: number
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed?: number
          id?: string
          message: string
          results?: Json | null
          sent?: number
          skipped?: number
          started_at?: string | null
          status?: string
          target_filter?: Json | null
          total?: number
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed?: number
          id?: string
          message?: string
          results?: Json | null
          sent?: number
          skipped?: number
          started_at?: string | null
          status?: string
          target_filter?: Json | null
          total?: number
        }
        Relationships: []
      }
      business_holidays: {
        Row: {
          created_at: string | null
          date: string
          description: string
          id: string
          is_recurring: boolean | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description: string
          id?: string
          is_recurring?: boolean | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          is_recurring?: boolean | null
        }
        Relationships: []
      }
      business_hours_config: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_working_day: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time?: string
          id?: string
          is_working_day?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_working_day?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      business_messages_config: {
        Row: {
          after_hours_tag_id: string | null
          created_at: string | null
          description: string | null
          id: string
          message_key: string
          message_template: string
          updated_at: string | null
        }
        Insert: {
          after_hours_tag_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          message_key: string
          message_template: string
          updated_at?: string | null
        }
        Update: {
          after_hours_tag_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          message_key?: string
          message_template?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_messages_config_after_hours_tag_id_fkey"
            columns: ["after_hours_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
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
          condition_else_step_id: string | null
          condition_next_step_id: string | null
          condition_type: string | null
          created_at: string
          day_offset: number
          id: string
          is_automated: boolean
          message_template: string | null
          position: number
          position_x: number | null
          position_y: number | null
          step_type: string
          task_description: string | null
          task_title: string | null
          template_id: string | null
        }
        Insert: {
          cadence_id: string
          condition_else_step_id?: string | null
          condition_next_step_id?: string | null
          condition_type?: string | null
          created_at?: string
          day_offset?: number
          id?: string
          is_automated?: boolean
          message_template?: string | null
          position?: number
          position_x?: number | null
          position_y?: number | null
          step_type: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
        }
        Update: {
          cadence_id?: string
          condition_else_step_id?: string | null
          condition_next_step_id?: string | null
          condition_type?: string | null
          created_at?: string
          day_offset?: number
          id?: string
          is_automated?: boolean
          message_template?: string | null
          position?: number
          position_x?: number | null
          position_y?: number | null
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
            foreignKeyName: "cadence_steps_condition_else_step_id_fkey"
            columns: ["condition_else_step_id"]
            isOneToOne: false
            referencedRelation: "cadence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_steps_condition_next_step_id_fkey"
            columns: ["condition_next_step_id"]
            isOneToOne: false
            referencedRelation: "cadence_steps"
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
      cadence_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          steps: Json
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          steps?: Json
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          steps?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      cadences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          meetings_booked: number | null
          name: string
          total_responses: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          meetings_booked?: number | null
          name: string
          total_responses?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          meetings_booked?: number | null
          name?: string
          total_responses?: number | null
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
      chat_flow_states: {
        Row: {
          collected_data: Json | null
          completed_at: string | null
          conversation_id: string
          current_node_id: string
          flow_id: string
          id: string
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          collected_data?: Json | null
          completed_at?: string | null
          conversation_id: string
          current_node_id: string
          flow_id: string
          id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          collected_data?: Json | null
          completed_at?: string | null
          conversation_id?: string
          current_node_id?: string
          flow_id?: string
          id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_flow_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_flow_states_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chat_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_flows: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          flow_definition: Json
          id: string
          is_active: boolean | null
          is_master_flow: boolean | null
          name: string
          priority: number | null
          support_channel_id: string | null
          trigger_keywords: string[] | null
          triggers: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          flow_definition?: Json
          id?: string
          is_active?: boolean | null
          is_master_flow?: boolean | null
          name: string
          priority?: number | null
          support_channel_id?: string | null
          trigger_keywords?: string[] | null
          triggers?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          flow_definition?: Json
          id?: string
          is_active?: boolean | null
          is_master_flow?: boolean | null
          name?: string
          priority?: number | null
          support_channel_id?: string | null
          trigger_keywords?: string[] | null
          triggers?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_flows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_flows_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_flows_support_channel_id_fkey"
            columns: ["support_channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_logs: {
        Row: {
          created_at: string
          error_type: Database["public"]["Enums"]["client_error_type"]
          id: string
          message: string
          metadata: Json | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_type: Database["public"]["Enums"]["client_error_type"]
          id?: string
          message: string
          metadata?: Json | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_type?: Database["public"]["Enums"]["client_error_type"]
          id?: string
          message?: string
          metadata?: Json | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
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
          ai_summary: string | null
          ai_summary_updated_at: string | null
          assigned_to: string | null
          avatar_url: string | null
          birth_date: string | null
          blocked: boolean | null
          city: string | null
          company: string | null
          consultant_id: string | null
          consultant_manually_removed: boolean | null
          created_at: string
          customer_type: string | null
          do_not_disturb: boolean
          document: string | null
          email: string | null
          external_ids: Json | null
          first_name: string
          id: string
          kiwify_customer_id: string | null
          kiwify_subscription_id: string | null
          kiwify_validated: boolean | null
          kiwify_validated_at: string | null
          last_contact_date: string | null
          last_kiwify_event: string | null
          last_kiwify_event_at: string | null
          last_name: string
          last_payment_date: string | null
          lead_classification: string | null
          lead_score: number | null
          neighborhood: string | null
          next_payment_date: string | null
          onboarding_completed: boolean | null
          onboarding_submission_id: string | null
          organization_id: string | null
          phone: string | null
          preferred_agent_id: string | null
          preferred_department_id: string | null
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
          ai_summary?: string | null
          ai_summary_updated_at?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked?: boolean | null
          city?: string | null
          company?: string | null
          consultant_id?: string | null
          consultant_manually_removed?: boolean | null
          created_at?: string
          customer_type?: string | null
          do_not_disturb?: boolean
          document?: string | null
          email?: string | null
          external_ids?: Json | null
          first_name: string
          id?: string
          kiwify_customer_id?: string | null
          kiwify_subscription_id?: string | null
          kiwify_validated?: boolean | null
          kiwify_validated_at?: string | null
          last_contact_date?: string | null
          last_kiwify_event?: string | null
          last_kiwify_event_at?: string | null
          last_name: string
          last_payment_date?: string | null
          lead_classification?: string | null
          lead_score?: number | null
          neighborhood?: string | null
          next_payment_date?: string | null
          onboarding_completed?: boolean | null
          onboarding_submission_id?: string | null
          organization_id?: string | null
          phone?: string | null
          preferred_agent_id?: string | null
          preferred_department_id?: string | null
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
          ai_summary?: string | null
          ai_summary_updated_at?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked?: boolean | null
          city?: string | null
          company?: string | null
          consultant_id?: string | null
          consultant_manually_removed?: boolean | null
          created_at?: string
          customer_type?: string | null
          do_not_disturb?: boolean
          document?: string | null
          email?: string | null
          external_ids?: Json | null
          first_name?: string
          id?: string
          kiwify_customer_id?: string | null
          kiwify_subscription_id?: string | null
          kiwify_validated?: boolean | null
          kiwify_validated_at?: string | null
          last_contact_date?: string | null
          last_kiwify_event?: string | null
          last_kiwify_event_at?: string | null
          last_name?: string
          last_payment_date?: string | null
          lead_classification?: string | null
          lead_score?: number | null
          neighborhood?: string | null
          next_payment_date?: string | null
          onboarding_completed?: boolean | null
          onboarding_submission_id?: string | null
          organization_id?: string | null
          phone?: string | null
          preferred_agent_id?: string | null
          preferred_department_id?: string | null
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
            foreignKeyName: "contacts_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "onboarding_submissions"
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
            foreignKeyName: "contacts_preferred_agent_id_fkey"
            columns: ["preferred_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_preferred_department_id_fkey"
            columns: ["preferred_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      conversation_assignment_logs: {
        Row: {
          algorithm: string
          assigned_to: string | null
          candidates_count: number | null
          conversation_id: string
          created_at: string | null
          department_id: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          algorithm: string
          assigned_to?: string | null
          candidates_count?: number | null
          conversation_id: string
          created_at?: string | null
          department_id?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          algorithm?: string
          assigned_to?: string | null
          candidates_count?: number | null
          conversation_id?: string
          created_at?: string | null
          department_id?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignment_logs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignment_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignment_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_dispatch_jobs: {
        Row: {
          attempts: number | null
          conversation_id: string
          created_at: string | null
          department_id: string | null
          id: string
          last_error: string | null
          max_attempts: number | null
          next_attempt_at: string | null
          priority: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          conversation_id: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          conversation_id?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_dispatch_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_dispatch_jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          department_id: string | null
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
          department_id?: string | null
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
          department_id?: string | null
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
          {
            foreignKeyName: "conversation_ratings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string | null
          created_by: string | null
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_mode: Database["public"]["Enums"]["ai_mode"]
          assigned_to: string | null
          auto_closed: boolean | null
          awaiting_rating: boolean | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          contact_id: string
          created_at: string
          customer_metadata: Json | null
          deal_id: string | null
          department: string | null
          dispatch_attempts: number | null
          dispatch_status: string | null
          first_response_at: string | null
          handoff_executed_at: string | null
          id: string
          is_test_mode: boolean | null
          last_classified_at: string | null
          last_dispatch_at: string | null
          last_message_at: string
          last_suggestion_at: string | null
          learned_at: string | null
          needs_human_review: boolean | null
          previous_agent_id: string | null
          rating_sent_at: string | null
          related_ticket_id: string | null
          resolved_by: string | null
          session_token: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          support_channel_id: string | null
          whatsapp_instance_id: string | null
          whatsapp_meta_instance_id: string | null
          whatsapp_provider: string | null
          window_keep_alive_sent_at: string | null
        }
        Insert: {
          ai_mode?: Database["public"]["Enums"]["ai_mode"]
          assigned_to?: string | null
          auto_closed?: boolean | null
          awaiting_rating?: boolean | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          contact_id: string
          created_at?: string
          customer_metadata?: Json | null
          deal_id?: string | null
          department?: string | null
          dispatch_attempts?: number | null
          dispatch_status?: string | null
          first_response_at?: string | null
          handoff_executed_at?: string | null
          id?: string
          is_test_mode?: boolean | null
          last_classified_at?: string | null
          last_dispatch_at?: string | null
          last_message_at?: string
          last_suggestion_at?: string | null
          learned_at?: string | null
          needs_human_review?: boolean | null
          previous_agent_id?: string | null
          rating_sent_at?: string | null
          related_ticket_id?: string | null
          resolved_by?: string | null
          session_token?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          support_channel_id?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_meta_instance_id?: string | null
          whatsapp_provider?: string | null
          window_keep_alive_sent_at?: string | null
        }
        Update: {
          ai_mode?: Database["public"]["Enums"]["ai_mode"]
          assigned_to?: string | null
          auto_closed?: boolean | null
          awaiting_rating?: boolean | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          contact_id?: string
          created_at?: string
          customer_metadata?: Json | null
          deal_id?: string | null
          department?: string | null
          dispatch_attempts?: number | null
          dispatch_status?: string | null
          first_response_at?: string | null
          handoff_executed_at?: string | null
          id?: string
          is_test_mode?: boolean | null
          last_classified_at?: string | null
          last_dispatch_at?: string | null
          last_message_at?: string
          last_suggestion_at?: string | null
          learned_at?: string | null
          needs_human_review?: boolean | null
          previous_agent_id?: string | null
          rating_sent_at?: string | null
          related_ticket_id?: string | null
          resolved_by?: string | null
          session_token?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          support_channel_id?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_meta_instance_id?: string | null
          whatsapp_provider?: string | null
          window_keep_alive_sent_at?: string | null
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
            foreignKeyName: "conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
            foreignKeyName: "conversations_previous_agent_id_fkey"
            columns: ["previous_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "conversations_whatsapp_meta_instance_id_fkey"
            columns: ["whatsapp_meta_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_insights_cache: {
        Row: {
          cache_key: string
          confidence: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          insights: Json
          source: string | null
          total_conversations: number | null
        }
        Insert: {
          cache_key: string
          confidence?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          insights: Json
          source?: string | null
          total_conversations?: number | null
        }
        Update: {
          cache_key?: string
          confidence?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          insights?: Json
          source?: string | null
          total_conversations?: number | null
        }
        Relationships: []
      }
      copilot_insights_events: {
        Row: {
          action: string | null
          confidence: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          health_score_at_time: number | null
          health_score_version: string | null
          id: string
          insight_type: string
          source: string | null
          title: string
          total_conversations_at_time: number | null
        }
        Insert: {
          action?: string | null
          confidence?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          health_score_at_time?: number | null
          health_score_version?: string | null
          id?: string
          insight_type: string
          source?: string | null
          title: string
          total_conversations_at_time?: number | null
        }
        Update: {
          action?: string | null
          confidence?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          health_score_at_time?: number | null
          health_score_version?: string | null
          id?: string
          insight_type?: string
          source?: string | null
          title?: string
          total_conversations_at_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_insights_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          form_id: string | null
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
          step_type: string | null
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
          form_id?: string | null
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
          step_type?: string | null
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
          form_id?: string | null
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
          step_type?: string | null
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
          {
            foreignKeyName: "customer_journey_steps_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
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
      dashboard_blocks: {
        Row: {
          config_json: Json
          dashboard_id: string
          height: number
          id: string
          position_x: number
          position_y: number
          report_id: string
          sort_order: number
          title: string | null
          visualization_type: string
          width: number
        }
        Insert: {
          config_json?: Json
          dashboard_id: string
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          report_id: string
          sort_order?: number
          title?: string | null
          visualization_type: string
          width?: number
        }
        Update: {
          config_json?: Json
          dashboard_id?: string
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          report_id?: string
          sort_order?: number
          title?: string | null
          visualization_type?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_blocks_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_blocks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      data_catalog: {
        Row: {
          allow_aggregate: boolean
          allow_filter: boolean
          allow_group: boolean
          allowed_roles: string[] | null
          category: string | null
          created_at: string
          description: string | null
          entity: string
          field_name: string
          field_type: string
          id: string
          is_sensitive: boolean
          label: string | null
          sort_order: number
        }
        Insert: {
          allow_aggregate?: boolean
          allow_filter?: boolean
          allow_group?: boolean
          allowed_roles?: string[] | null
          category?: string | null
          created_at?: string
          description?: string | null
          entity: string
          field_name: string
          field_type: string
          id?: string
          is_sensitive?: boolean
          label?: string | null
          sort_order?: number
        }
        Update: {
          allow_aggregate?: boolean
          allow_filter?: boolean
          allow_group?: boolean
          allowed_roles?: string[] | null
          category?: string | null
          created_at?: string
          description?: string | null
          entity?: string
          field_name?: string
          field_type?: string
          id?: string
          is_sensitive?: boolean
          label?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      deals: {
        Row: {
          affiliate_commission: number | null
          affiliate_email: string | null
          affiliate_name: string | null
          assigned_to: string | null
          became_rotten_at: string | null
          churn_risk: string | null
          closed_at: string | null
          company_contact_id: string | null
          company_name_snapshot: string | null
          contact_id: string | null
          created_at: string
          currency: string | null
          existing_products: Json | null
          expected_close_date: string | null
          expected_revenue: number | null
          external_order_id: string | null
          gross_value: number | null
          id: string
          is_organic_sale: boolean | null
          is_returning_customer: boolean | null
          kiwify_fee: number | null
          kiwify_offer_id: string | null
          lead_email: string | null
          lead_phone: string | null
          lead_source: string | null
          lead_whatsapp_id: string | null
          lost_reason: string | null
          net_value: number | null
          organization_id: string | null
          pain_points: string | null
          pending_kiwify_event_id: string | null
          pending_payment_at: string | null
          pipeline_id: string
          probability: number | null
          product_id: string | null
          rotten_escalated_at: string | null
          rotten_notified_at: string | null
          sales_channel_id: string | null
          sales_channel_name: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          success_criteria: string | null
          title: string
          tracking_code: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          affiliate_commission?: number | null
          affiliate_email?: string | null
          affiliate_name?: string | null
          assigned_to?: string | null
          became_rotten_at?: string | null
          churn_risk?: string | null
          closed_at?: string | null
          company_contact_id?: string | null
          company_name_snapshot?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string | null
          existing_products?: Json | null
          expected_close_date?: string | null
          expected_revenue?: number | null
          external_order_id?: string | null
          gross_value?: number | null
          id?: string
          is_organic_sale?: boolean | null
          is_returning_customer?: boolean | null
          kiwify_fee?: number | null
          kiwify_offer_id?: string | null
          lead_email?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          lead_whatsapp_id?: string | null
          lost_reason?: string | null
          net_value?: number | null
          organization_id?: string | null
          pain_points?: string | null
          pending_kiwify_event_id?: string | null
          pending_payment_at?: string | null
          pipeline_id: string
          probability?: number | null
          product_id?: string | null
          rotten_escalated_at?: string | null
          rotten_notified_at?: string | null
          sales_channel_id?: string | null
          sales_channel_name?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          success_criteria?: string | null
          title: string
          tracking_code?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          affiliate_commission?: number | null
          affiliate_email?: string | null
          affiliate_name?: string | null
          assigned_to?: string | null
          became_rotten_at?: string | null
          churn_risk?: string | null
          closed_at?: string | null
          company_contact_id?: string | null
          company_name_snapshot?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string | null
          existing_products?: Json | null
          expected_close_date?: string | null
          expected_revenue?: number | null
          external_order_id?: string | null
          gross_value?: number | null
          id?: string
          is_organic_sale?: boolean | null
          is_returning_customer?: boolean | null
          kiwify_fee?: number | null
          kiwify_offer_id?: string | null
          lead_email?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          lead_whatsapp_id?: string | null
          lost_reason?: string | null
          net_value?: number | null
          organization_id?: string | null
          pain_points?: string | null
          pending_kiwify_event_id?: string | null
          pending_payment_at?: string | null
          pipeline_id?: string
          probability?: number | null
          product_id?: string | null
          rotten_escalated_at?: string | null
          rotten_notified_at?: string | null
          sales_channel_id?: string | null
          sales_channel_name?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          success_criteria?: string | null
          title?: string
          tracking_code?: string | null
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
            foreignKeyName: "deals_company_contact_id_fkey"
            columns: ["company_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            foreignKeyName: "deals_pending_kiwify_event_id_fkey"
            columns: ["pending_kiwify_event_id"]
            isOneToOne: false
            referencedRelation: "kiwify_events"
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
            foreignKeyName: "deals_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
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
          after_hours_keep_open: boolean | null
          ai_auto_close_minutes: number | null
          ai_auto_close_tag_id: string | null
          auto_close_enabled: boolean | null
          auto_close_minutes: number | null
          color: string | null
          created_at: string
          description: string | null
          human_auto_close_minutes: number | null
          human_auto_close_tag_id: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          send_rating_on_close: boolean | null
          slow_response_alert_enabled: boolean
          slow_response_alert_minutes: number | null
          slow_response_alert_tag_id: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          after_hours_keep_open?: boolean | null
          ai_auto_close_minutes?: number | null
          ai_auto_close_tag_id?: string | null
          auto_close_enabled?: boolean | null
          auto_close_minutes?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          human_auto_close_minutes?: number | null
          human_auto_close_tag_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          send_rating_on_close?: boolean | null
          slow_response_alert_enabled?: boolean
          slow_response_alert_minutes?: number | null
          slow_response_alert_tag_id?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          after_hours_keep_open?: boolean | null
          ai_auto_close_minutes?: number | null
          ai_auto_close_tag_id?: string | null
          auto_close_enabled?: boolean | null
          auto_close_minutes?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          human_auto_close_minutes?: number | null
          human_auto_close_tag_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          send_rating_on_close?: boolean | null
          slow_response_alert_enabled?: boolean
          slow_response_alert_minutes?: number | null
          slow_response_alert_tag_id?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_ai_auto_close_tag_id_fkey"
            columns: ["ai_auto_close_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_human_auto_close_tag_id_fkey"
            columns: ["human_auto_close_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_slow_response_alert_tag_id_fkey"
            columns: ["slow_response_alert_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      email_block_conditions: {
        Row: {
          action: string | null
          block_id: string
          created_at: string | null
          field: string
          group_index: number | null
          id: string
          logic_group: string | null
          operator: string
          value: string
        }
        Insert: {
          action?: string | null
          block_id: string
          created_at?: string | null
          field: string
          group_index?: number | null
          id?: string
          logic_group?: string | null
          operator: string
          value: string
        }
        Update: {
          action?: string | null
          block_id?: string
          created_at?: string | null
          field?: string
          group_index?: number | null
          id?: string
          logic_group?: string | null
          operator?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_block_conditions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "email_template_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      email_branding: {
        Row: {
          created_at: string | null
          footer_logo_url: string | null
          footer_text: string | null
          header_color: string | null
          id: string
          is_default_customer: boolean | null
          is_default_employee: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          footer_logo_url?: string | null
          footer_text?: string | null
          header_color?: string | null
          id?: string
          is_default_customer?: boolean | null
          is_default_employee?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          footer_logo_url?: string | null
          footer_text?: string | null
          header_color?: string | null
          id?: string
          is_default_customer?: boolean | null
          is_default_employee?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          send_id: string
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          send_id: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          send_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      email_layout_library: {
        Row: {
          blocks: Json
          category: string
          created_at: string | null
          created_by: string | null
          default_styles: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          preview_image_url: string | null
          thumbnail_url: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          blocks?: Json
          category: string
          created_at?: string | null
          created_by?: string | null
          default_styles?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          preview_image_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          blocks?: Json
          category?: string
          created_at?: string | null
          created_by?: string | null
          default_styles?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          preview_image_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string | null
          status: string | null
          template_name: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          status?: string | null
          template_name?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          status?: string | null
          template_name?: string | null
        }
        Relationships: []
      }
      email_senders: {
        Row: {
          created_at: string | null
          department_id: string | null
          from_email: string
          from_name: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          from_email: string
          from_name: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          from_email?: string
          from_name?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_senders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          contact_id: string | null
          deal_id: string | null
          error_message: string | null
          id: string
          language_code: string | null
          opened_at: string | null
          playbook_execution_id: string | null
          playbook_node_id: string | null
          recipient_email: string
          replied_at: string | null
          resend_email_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          ticket_id: string | null
          variables_used: Json | null
          variant_id: string | null
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          deal_id?: string | null
          error_message?: string | null
          id?: string
          language_code?: string | null
          opened_at?: string | null
          playbook_execution_id?: string | null
          playbook_node_id?: string | null
          recipient_email: string
          replied_at?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          ticket_id?: string | null
          variables_used?: Json | null
          variant_id?: string | null
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          deal_id?: string | null
          error_message?: string | null
          id?: string
          language_code?: string | null
          opened_at?: string | null
          playbook_execution_id?: string | null
          playbook_node_id?: string | null
          recipient_email?: string
          replied_at?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          ticket_id?: string | null
          variables_used?: Json | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "email_template_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_blocks: {
        Row: {
          block_type: string
          column_index: number | null
          content: Json
          created_at: string | null
          id: string
          parent_block_id: string | null
          position: number
          responsive: Json | null
          styles: Json | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          block_type: string
          column_index?: number | null
          content?: Json
          created_at?: string | null
          id?: string
          parent_block_id?: string | null
          position: number
          responsive?: Json | null
          styles?: Json | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          block_type?: string
          column_index?: number | null
          content?: Json
          created_at?: string | null
          id?: string
          parent_block_id?: string | null
          position?: number
          responsive?: Json | null
          styles?: Json | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_blocks_parent_block_id_fkey"
            columns: ["parent_block_id"]
            isOneToOne: false
            referencedRelation: "email_template_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_template_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_translations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          language_code: string
          preheader: string | null
          subject: string
          template_id: string
          translated_blocks: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language_code: string
          preheader?: string | null
          subject: string
          template_id: string
          translated_blocks?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language_code?: string
          preheader?: string | null
          subject?: string
          template_id?: string
          translated_blocks?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_translations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_variants: {
        Row: {
          blocks_override: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_control: boolean | null
          preheader: string | null
          subject: string
          template_id: string
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_opened: number | null
          total_sent: number | null
          total_spam: number | null
          updated_at: string | null
          variant_name: string
          weight_percent: number | null
        }
        Insert: {
          blocks_override?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_control?: boolean | null
          preheader?: string | null
          subject: string
          template_id: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_spam?: number | null
          updated_at?: string | null
          variant_name: string
          weight_percent?: number | null
        }
        Update: {
          blocks_override?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_control?: boolean | null
          preheader?: string | null
          subject?: string
          template_id?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_spam?: number | null
          updated_at?: string | null
          variant_name?: string
          weight_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_variants_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          branding_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          design_json: Json | null
          html_body: string
          id: string
          is_active: boolean
          name: string
          sender_id: string | null
          subject: string
          trigger_type: string | null
          trigger_types: string[] | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          branding_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          design_json?: Json | null
          html_body: string
          id?: string
          is_active?: boolean
          name: string
          sender_id?: string | null
          subject: string
          trigger_type?: string | null
          trigger_types?: string[] | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          branding_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          design_json?: Json | null
          html_body?: string
          id?: string
          is_active?: boolean
          name?: string
          sender_id?: string | null
          subject?: string
          trigger_type?: string | null
          trigger_types?: string[] | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_branding_id_fkey"
            columns: ["branding_id"]
            isOneToOne: false
            referencedRelation: "email_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "email_senders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates_v2: {
        Row: {
          ab_testing_enabled: boolean | null
          branding_id: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          default_preheader: string | null
          default_subject: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          legacy_template_id: string | null
          name: string
          sender_id: string | null
          trigger_type: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          ab_testing_enabled?: boolean | null
          branding_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_preheader?: string | null
          default_subject?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          legacy_template_id?: string | null
          name: string
          sender_id?: string | null
          trigger_type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          ab_testing_enabled?: boolean | null
          branding_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_preheader?: string | null
          default_subject?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          legacy_template_id?: string | null
          name?: string
          sender_id?: string | null
          trigger_type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_v2_branding_id_fkey"
            columns: ["branding_id"]
            isOneToOne: false
            referencedRelation: "email_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_v2_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_v2_legacy_template_id_fkey"
            columns: ["legacy_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_v2_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "email_senders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking_events: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email_id: string
          event_type: string
          id: string
          metadata: Json | null
          playbook_execution_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          playbook_execution_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          playbook_execution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_events_playbook_execution_id_fkey"
            columns: ["playbook_execution_id"]
            isOneToOne: false
            referencedRelation: "playbook_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_variable_definitions: {
        Row: {
          category: string
          created_at: string | null
          data_type: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          sample_value: string | null
          variable_key: string
        }
        Insert: {
          category: string
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          sample_value?: string | null
          variable_key: string
        }
        Update: {
          category?: string
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          sample_value?: string | null
          variable_key?: string
        }
        Relationships: []
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
      error_digests: {
        Row: {
          created_at: string
          digest_date: string
          edge_function_failures: Json | null
          errors_by_type: Json | null
          id: string
          top_errors: Json | null
          total_errors: number
        }
        Insert: {
          created_at?: string
          digest_date: string
          edge_function_failures?: Json | null
          errors_by_type?: Json | null
          id?: string
          top_errors?: Json | null
          total_errors?: number
        }
        Update: {
          created_at?: string
          digest_date?: string
          edge_function_failures?: Json | null
          errors_by_type?: Json | null
          id?: string
          top_errors?: Json | null
          total_errors?: number
        }
        Relationships: []
      }
      form_automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string | null
          form_id: string
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          trigger_config: Json | null
          trigger_type: string
        }
        Insert: {
          action_config: Json
          action_type: string
          created_at?: string | null
          form_id: string
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          trigger_config?: Json | null
          trigger_type?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string | null
          form_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          trigger_config?: Json | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_automations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_board_integrations: {
        Row: {
          auto_assign_user_id: string | null
          board_id: string | null
          confirmation_email_template_id: string | null
          created_at: string | null
          form_id: string | null
          id: string
          is_active: boolean | null
          send_confirmation_email: boolean | null
          target_column_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_assign_user_id?: string | null
          board_id?: string | null
          confirmation_email_template_id?: string | null
          created_at?: string | null
          form_id?: string | null
          id?: string
          is_active?: boolean | null
          send_confirmation_email?: boolean | null
          target_column_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_assign_user_id?: string | null
          board_id?: string | null
          confirmation_email_template_id?: string | null
          created_at?: string | null
          form_id?: string | null
          id?: string
          is_active?: boolean | null
          send_confirmation_email?: boolean | null
          target_column_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_board_integrations_auto_assign_user_id_fkey"
            columns: ["auto_assign_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_board_integrations_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_board_integrations_confirmation_email_template_id_fkey"
            columns: ["confirmation_email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_board_integrations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_board_integrations_target_column_id_fkey"
            columns: ["target_column_id"]
            isOneToOne: false
            referencedRelation: "project_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      form_calculations: {
        Row: {
          created_at: string | null
          display_in_results: boolean | null
          form_id: string
          formula: string
          id: string
          name: string
          result_type: string | null
        }
        Insert: {
          created_at?: string | null
          display_in_results?: boolean | null
          form_id: string
          formula: string
          id?: string
          name: string
          result_type?: string | null
        }
        Update: {
          created_at?: string | null
          display_in_results?: boolean | null
          form_id?: string
          formula?: string
          id?: string
          name?: string
          result_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_calculations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_conditions: {
        Row: {
          condition_type: string
          created_at: string | null
          field_id: string
          form_id: string
          id: string
          logic_group: string | null
          operator: string
          parent_condition_id: string | null
          priority: number | null
          target_field_id: string | null
          target_value: Json | null
          value: Json | null
        }
        Insert: {
          condition_type?: string
          created_at?: string | null
          field_id: string
          form_id: string
          id?: string
          logic_group?: string | null
          operator: string
          parent_condition_id?: string | null
          priority?: number | null
          target_field_id?: string | null
          target_value?: Json | null
          value?: Json | null
        }
        Update: {
          condition_type?: string
          created_at?: string | null
          field_id?: string
          form_id?: string
          id?: string
          logic_group?: string | null
          operator?: string
          parent_condition_id?: string | null
          priority?: number | null
          target_field_id?: string | null
          target_value?: Json | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_conditions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_conditions_parent_condition_id_fkey"
            columns: ["parent_condition_id"]
            isOneToOne: false
            referencedRelation: "form_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers: Json
          automations_triggered: Json | null
          calculated_scores: Json | null
          card_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          form_id: string
          id: string
          session_metadata: Json | null
        }
        Insert: {
          answers: Json
          automations_triggered?: Json | null
          calculated_scores?: Json | null
          card_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          form_id: string
          id?: string
          session_metadata?: Json | null
        }
        Update: {
          answers?: Json
          automations_triggered?: Json | null
          calculated_scores?: Json | null
          card_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          form_id?: string
          id?: string
          session_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string | null
          description: string | null
          distribution_rule:
            | Database["public"]["Enums"]["form_distribution_rule"]
            | null
          id: string
          is_active: boolean | null
          max_submissions_per_contact: number | null
          name: string
          notify_manager: boolean | null
          routing_field_id: string | null
          routing_field_mappings: Json | null
          schema: Json
          score_routing_rules: Json | null
          target_board_id: string | null
          target_column_id: string | null
          target_department_id: string | null
          target_pipeline_id: string | null
          target_type: Database["public"]["Enums"]["form_target_type"] | null
          target_user_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          distribution_rule?:
            | Database["public"]["Enums"]["form_distribution_rule"]
            | null
          id?: string
          is_active?: boolean | null
          max_submissions_per_contact?: number | null
          name: string
          notify_manager?: boolean | null
          routing_field_id?: string | null
          routing_field_mappings?: Json | null
          schema?: Json
          score_routing_rules?: Json | null
          target_board_id?: string | null
          target_column_id?: string | null
          target_department_id?: string | null
          target_pipeline_id?: string | null
          target_type?: Database["public"]["Enums"]["form_target_type"] | null
          target_user_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          distribution_rule?:
            | Database["public"]["Enums"]["form_distribution_rule"]
            | null
          id?: string
          is_active?: boolean | null
          max_submissions_per_contact?: number | null
          name?: string
          notify_manager?: boolean | null
          routing_field_id?: string | null
          routing_field_mappings?: Json | null
          schema?: Json
          score_routing_rules?: Json | null
          target_board_id?: string | null
          target_column_id?: string | null
          target_department_id?: string | null
          target_pipeline_id?: string | null
          target_type?: Database["public"]["Enums"]["form_target_type"] | null
          target_user_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_target_board_id_fkey"
            columns: ["target_board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_target_column_id_fkey"
            columns: ["target_column_id"]
            isOneToOne: false
            referencedRelation: "project_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      inbox_view: {
        Row: {
          ai_mode: string | null
          assigned_agent_avatar: string | null
          assigned_agent_name: string | null
          assigned_to: string | null
          channels: string[] | null
          contact_avatar: string | null
          contact_email: string | null
          contact_id: string
          contact_kiwify_validated: boolean | null
          contact_name: string | null
          contact_phone: string | null
          contact_status: string | null
          contact_whatsapp_id: string | null
          conversation_id: string
          created_at: string | null
          department: string | null
          department_color: string | null
          department_name: string | null
          has_attachments: boolean | null
          has_audio: boolean | null
          last_channel: string | null
          last_message_at: string | null
          last_sender_type: string | null
          last_snippet: string | null
          short_id: string | null
          sla_status: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
          whatsapp_instance_id: string | null
          whatsapp_meta_instance_id: string | null
          whatsapp_provider: string | null
        }
        Insert: {
          ai_mode?: string | null
          assigned_agent_avatar?: string | null
          assigned_agent_name?: string | null
          assigned_to?: string | null
          channels?: string[] | null
          contact_avatar?: string | null
          contact_email?: string | null
          contact_id: string
          contact_kiwify_validated?: boolean | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_status?: string | null
          contact_whatsapp_id?: string | null
          conversation_id: string
          created_at?: string | null
          department?: string | null
          department_color?: string | null
          department_name?: string | null
          has_attachments?: boolean | null
          has_audio?: boolean | null
          last_channel?: string | null
          last_message_at?: string | null
          last_sender_type?: string | null
          last_snippet?: string | null
          short_id?: string | null
          sla_status?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_meta_instance_id?: string | null
          whatsapp_provider?: string | null
        }
        Update: {
          ai_mode?: string | null
          assigned_agent_avatar?: string | null
          assigned_agent_name?: string | null
          assigned_to?: string | null
          channels?: string[] | null
          contact_avatar?: string | null
          contact_email?: string | null
          contact_id?: string
          contact_kiwify_validated?: boolean | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_status?: string | null
          contact_whatsapp_id?: string | null
          conversation_id?: string
          created_at?: string | null
          department?: string | null
          department_color?: string | null
          department_name?: string | null
          has_attachments?: boolean | null
          has_audio?: boolean | null
          last_channel?: string | null
          last_message_at?: string | null
          last_sender_type?: string | null
          last_snippet?: string | null
          short_id?: string | null
          sla_status?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_meta_instance_id?: string | null
          whatsapp_provider?: string | null
        }
        Relationships: []
      }
      instagram_accounts: {
        Row: {
          access_token: string
          created_at: string | null
          followers_count: number | null
          id: string
          instagram_user_id: string
          is_active: boolean | null
          last_sync_at: string | null
          page_id: string | null
          profile_picture_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          username: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          followers_count?: number | null
          id?: string
          instagram_user_id: string
          is_active?: boolean | null
          last_sync_at?: string | null
          page_id?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          username: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          followers_count?: number | null
          id?: string
          instagram_user_id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          page_id?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string
          workspace_id?: string
        }
        Relationships: []
      }
      instagram_comment_replies: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          instagram_reply_id: string | null
          sent_by: string | null
          text: string
          timestamp: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          instagram_reply_id?: string | null
          sent_by?: string | null
          text: string
          timestamp?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          instagram_reply_id?: string | null
          sent_by?: string | null
          text?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "instagram_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comment_replies_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_comments: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          id: string
          instagram_account_id: string | null
          instagram_comment_id: string
          instagram_user_id: string | null
          notes: string | null
          post_id: string | null
          replied: boolean | null
          status: string | null
          text: string
          timestamp: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string
          instagram_account_id?: string | null
          instagram_comment_id: string
          instagram_user_id?: string | null
          notes?: string | null
          post_id?: string | null
          replied?: boolean | null
          status?: string | null
          text: string
          timestamp?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string
          instagram_account_id?: string | null
          instagram_comment_id?: string
          instagram_user_id?: string | null
          notes?: string | null
          post_id?: string | null
          replied?: boolean | null
          status?: string | null
          text?: string
          timestamp?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_comments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "instagram_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_messages: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          conversation_id: string
          created_at: string | null
          deal_id: string | null
          from_instagram_id: string | null
          from_username: string | null
          id: string
          instagram_account_id: string | null
          is_from_business: boolean | null
          media_url: string | null
          message_id: string
          read: boolean | null
          status: string | null
          text: string | null
          timestamp: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          conversation_id: string
          created_at?: string | null
          deal_id?: string | null
          from_instagram_id?: string | null
          from_username?: string | null
          id?: string
          instagram_account_id?: string | null
          is_from_business?: boolean | null
          media_url?: string | null
          message_id: string
          read?: boolean | null
          status?: string | null
          text?: string | null
          timestamp?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          conversation_id?: string
          created_at?: string | null
          deal_id?: string | null
          from_instagram_id?: string | null
          from_username?: string | null
          id?: string
          instagram_account_id?: string | null
          is_from_business?: boolean | null
          media_url?: string | null
          message_id?: string
          read?: boolean | null
          status?: string | null
          text?: string | null
          timestamp?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_messages_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_messages_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          caption: string | null
          comments_count: number | null
          created_at: string | null
          id: string
          instagram_account_id: string | null
          instagram_post_id: string
          likes_count: number | null
          media_type: string | null
          media_url: string | null
          permalink: string | null
          thumbnail_url: string | null
          timestamp: string | null
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          instagram_post_id: string
          likes_count?: number | null
          media_type?: string | null
          media_url?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          instagram_post_id?: string
          likes_count?: number | null
          media_type?: string | null
          media_url?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_sync_log: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instagram_account_id: string | null
          items_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instagram_account_id?: string | null
          items_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instagram_account_id?: string | null
          items_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_sync_log_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
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
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
      internal_requests: {
        Row: {
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          form_submission_id: string | null
          id: string
          metadata: Json | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          form_submission_id?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          form_submission_id?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_requests_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
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
          linked_deal_id: string | null
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
          linked_deal_id?: string | null
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
          linked_deal_id?: string | null
          offer_id?: string | null
          order_id?: string
          payload?: Json
          processed?: boolean | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_events_linked_deal_id_fkey"
            columns: ["linked_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_import_queue: {
        Row: {
          completed_at: string | null
          contacts_created: number | null
          contacts_skipped: number | null
          contacts_updated: number | null
          created_at: string
          id: string
          job_id: string
          last_error: string | null
          max_retries: number
          retry_count: number
          sales_fetched: number | null
          scheduled_for: string
          started_at: string | null
          status: string
          window_end: string
          window_start: string
        }
        Insert: {
          completed_at?: string | null
          contacts_created?: number | null
          contacts_skipped?: number | null
          contacts_updated?: number | null
          created_at?: string
          id?: string
          job_id: string
          last_error?: string | null
          max_retries?: number
          retry_count?: number
          sales_fetched?: number | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          window_end: string
          window_start: string
        }
        Update: {
          completed_at?: string | null
          contacts_created?: number | null
          contacts_skipped?: number | null
          contacts_updated?: number | null
          created_at?: string
          id?: string
          job_id?: string
          last_error?: string | null
          max_retries?: number
          retry_count?: number
          sales_fetched?: number | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_import_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_webhook_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string | null
          confidence_score: number | null
          content: string
          created_at: string
          created_by: string | null
          department_id: string | null
          draft_from_gap_id: string | null
          embedding: string | null
          embedding_generated: boolean | null
          id: string
          is_published: boolean
          needs_review: boolean | null
          problem: string | null
          product_tags: string[]
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          solution: string | null
          source: string | null
          source_conversation_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          version: number | null
          when_not_to_use: string | null
          when_to_use: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          confidence_score?: number | null
          content: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          draft_from_gap_id?: string | null
          embedding?: string | null
          embedding_generated?: boolean | null
          id?: string
          is_published?: boolean
          needs_review?: boolean | null
          problem?: string | null
          product_tags?: string[]
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          solution?: string | null
          source?: string | null
          source_conversation_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number | null
          when_not_to_use?: string | null
          when_to_use?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          confidence_score?: number | null
          content?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          draft_from_gap_id?: string | null
          embedding?: string | null
          embedding_generated?: boolean | null
          id?: string
          is_published?: boolean
          needs_review?: boolean | null
          problem?: string | null
          product_tags?: string[]
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          solution?: string | null
          source?: string | null
          source_conversation_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number | null
          when_not_to_use?: string | null
          when_to_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_articles_draft_from_gap_id_fkey"
            columns: ["draft_from_gap_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_articles_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_candidates: {
        Row: {
          ai_confidence_score: number | null
          category: string | null
          clarity_score: number | null
          completeness_score: number | null
          confidence_score: number | null
          contains_pii: boolean
          created_at: string | null
          department_id: string | null
          duplicate_of: string | null
          evidence_snippets: Json
          extracted_by: string | null
          id: string
          problem: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string
          sanitized_solution: string | null
          solution: string
          source_conversation_id: string | null
          status: string | null
          system_confidence_score: number | null
          tags: string[] | null
          updated_at: string | null
          when_not_to_use: string | null
          when_to_use: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          category?: string | null
          clarity_score?: number | null
          completeness_score?: number | null
          confidence_score?: number | null
          contains_pii?: boolean
          created_at?: string | null
          department_id?: string | null
          duplicate_of?: string | null
          evidence_snippets?: Json
          extracted_by?: string | null
          id?: string
          problem: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          sanitized_solution?: string | null
          solution: string
          source_conversation_id?: string | null
          status?: string | null
          system_confidence_score?: number | null
          tags?: string[] | null
          updated_at?: string | null
          when_not_to_use?: string | null
          when_to_use?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          category?: string | null
          clarity_score?: number | null
          completeness_score?: number | null
          confidence_score?: number | null
          contains_pii?: boolean
          created_at?: string | null
          department_id?: string | null
          duplicate_of?: string | null
          evidence_snippets?: Json
          extracted_by?: string | null
          id?: string
          problem?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          sanitized_solution?: string | null
          solution?: string
          source_conversation_id?: string | null
          status?: string | null
          system_confidence_score?: number | null
          tags?: string[] | null
          updated_at?: string | null
          when_not_to_use?: string | null
          when_to_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_candidates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_candidates_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_versions: {
        Row: {
          category: string | null
          change_reason: string | null
          changed_by: string | null
          content: string
          created_at: string | null
          id: string
          knowledge_article_id: string
          problem: string | null
          solution: string | null
          tags: string[] | null
          title: string
          version: number
        }
        Insert: {
          category?: string | null
          change_reason?: string | null
          changed_by?: string | null
          content: string
          created_at?: string | null
          id?: string
          knowledge_article_id: string
          problem?: string | null
          solution?: string | null
          tags?: string[] | null
          title: string
          version?: number
        }
        Update: {
          category?: string | null
          change_reason?: string | null
          changed_by?: string | null
          content?: string
          created_at?: string | null
          id?: string
          knowledge_article_id?: string
          problem?: string | null
          solution?: string | null
          tags?: string[] | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_versions_knowledge_article_id_fkey"
            columns: ["knowledge_article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_logs: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          distribution_type: string
          id: string
          metadata: Json | null
          previous_assigned_to: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          distribution_type?: string
          id?: string
          metadata?: Json | null
          previous_assigned_to?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          distribution_type?: string
          id?: string
          metadata?: Json | null
          previous_assigned_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_logs_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_logs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_logs_previous_assigned_to_fkey"
            columns: ["previous_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_attachments: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          file_size: number
          height: number | null
          id: string
          message_id: string | null
          mime_type: string
          original_filename: string
          processing_error: string | null
          status: string | null
          storage_bucket: string
          storage_path: string
          thumbnail_path: string | null
          transcoded_mime_type: string | null
          transcoded_path: string | null
          updated_at: string | null
          uploaded_by: string | null
          waveform_data: Json | null
          width: number | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size: number
          height?: number | null
          id?: string
          message_id?: string | null
          mime_type: string
          original_filename: string
          processing_error?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path: string
          thumbnail_path?: string | null
          transcoded_mime_type?: string | null
          transcoded_path?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          waveform_data?: Json | null
          width?: number | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size?: number
          height?: number | null
          id?: string
          message_id?: string | null
          mime_type?: string
          original_filename?: string
          processing_error?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path?: string
          thumbnail_path?: string | null
          transcoded_mime_type?: string | null
          transcoded_path?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          waveform_data?: Json | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_buffer: {
        Row: {
          contact_id: string | null
          conversation_id: string
          created_at: string
          flow_context: Json | null
          flow_data: Json | null
          from_number: string | null
          id: string
          instance_id: string | null
          message_content: string
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          contact_id?: string | null
          conversation_id: string
          created_at?: string
          flow_context?: Json | null
          flow_data?: Json | null
          from_number?: string | null
          id?: string
          instance_id?: string | null
          message_content: string
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          contact_id?: string | null
          conversation_id?: string
          created_at?: string
          flow_context?: Json | null
          flow_data?: Json | null
          from_number?: string | null
          id?: string
          instance_id?: string | null
          message_content?: string
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_buffer_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          max_retries: number | null
          media_url: string | null
          message: string
          message_type: string | null
          metadata: Json | null
          phone_number: string
          priority: number | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          max_retries?: number | null
          media_url?: string | null
          message: string
          message_type?: string | null
          metadata?: Json | null
          phone_number: string
          priority?: number | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          max_retries?: number | null
          media_url?: string | null
          message?: string
          message_type?: string | null
          metadata?: Json | null
          phone_number?: string
          priority?: number | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          channel: Database["public"]["Enums"]["conversation_channel"] | null
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          delivery_error: string | null
          external_id: string | null
          id: string
          is_ai_generated: boolean | null
          is_internal: boolean | null
          is_read: boolean | null
          message_type: string | null
          metadata: Json | null
          provider_message_id: string | null
          quoted_message_id: string | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status: Database["public"]["Enums"]["message_status"] | null
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"] | null
          client_message_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          delivery_error?: string | null
          external_id?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          quoted_message_id?: string | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"] | null
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"] | null
          client_message_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          delivery_error?: string | null
          external_id?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          quoted_message_id?: string | null
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
            foreignKeyName: "messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
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
          support_phone: string | null
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
          support_phone?: string | null
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
          support_phone?: string | null
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
      onboarding_submissions: {
        Row: {
          classification: string | null
          contact_id: string | null
          created_at: string | null
          dropshipping_experience: string | null
          email: string
          formalization: string | null
          has_online_store: boolean | null
          id: string
          investment_budget: string | null
          knowledge_internet: number | null
          knowledge_it: number | null
          main_device: string | null
          metadata: Json | null
          name: string
          platform_used: string | null
          score_breakdown: Json | null
          score_total: number | null
          social_networks: string[] | null
          updated_at: string | null
          whatsapp: string
        }
        Insert: {
          classification?: string | null
          contact_id?: string | null
          created_at?: string | null
          dropshipping_experience?: string | null
          email: string
          formalization?: string | null
          has_online_store?: boolean | null
          id?: string
          investment_budget?: string | null
          knowledge_internet?: number | null
          knowledge_it?: number | null
          main_device?: string | null
          metadata?: Json | null
          name: string
          platform_used?: string | null
          score_breakdown?: Json | null
          score_total?: number | null
          social_networks?: string[] | null
          updated_at?: string | null
          whatsapp: string
        }
        Update: {
          classification?: string | null
          contact_id?: string | null
          created_at?: string | null
          dropshipping_experience?: string | null
          email?: string
          formalization?: string | null
          has_online_store?: boolean | null
          id?: string
          investment_budget?: string | null
          knowledge_internet?: number | null
          knowledge_it?: number | null
          main_device?: string | null
          metadata?: Json | null
          name?: string
          platform_used?: string | null
          score_breakdown?: Json | null
          score_total?: number | null
          social_networks?: string[] | null
          updated_at?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_phones: {
        Row: {
          created_at: string | null
          id: string
          label: string
          organization_id: string
          phone: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          organization_id: string
          phone: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          organization_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_phones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_department_id: string | null
          domain: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_department_id?: string | null
          domain?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_department_id?: string | null
          domain?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_default_department_id_fkey"
            columns: ["default_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verification_audit: {
        Row: {
          attempt_number: number | null
          channel: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          otp_reason: string | null
          result: string
        }
        Insert: {
          attempt_number?: number | null
          channel?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          otp_reason?: string | null
          result: string
        }
        Update: {
          attempt_number?: number | null
          channel?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          otp_reason?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_verification_audit_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_sales_reps: {
        Row: {
          created_at: string | null
          id: string
          pipeline_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pipeline_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pipeline_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_sales_reps_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_sales_reps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
          execution_context: Json | null
          id: string
          nodes_executed: Json | null
          playbook_id: string
          started_at: string | null
          status: string
          triggered_by: string | null
          triggered_by_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completion_reason?: Json | null
          contact_id: string
          created_at?: string | null
          current_node_id?: string | null
          errors?: Json | null
          execution_context?: Json | null
          id?: string
          nodes_executed?: Json | null
          playbook_id: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          triggered_by_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completion_reason?: Json | null
          contact_id?: string
          created_at?: string | null
          current_node_id?: string | null
          errors?: Json | null
          execution_context?: Json | null
          id?: string
          nodes_executed?: Json | null
          playbook_id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          triggered_by_user_id?: string | null
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
          {
            foreignKeyName: "playbook_executions_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      playbook_products: {
        Row: {
          created_at: string | null
          id: string
          playbook_id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          playbook_id: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          playbook_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_products_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "onboarding_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_test_runs: {
        Row: {
          created_at: string
          current_node_id: string | null
          error_message: string | null
          executed_nodes: number
          execution_id: string
          flow_snapshot: Json
          id: string
          last_event_at: string | null
          last_node_type: string | null
          next_scheduled_for: string | null
          playbook_id: string | null
          speed_multiplier: number
          started_by: string
          status: string
          tester_email: string
          tester_name: string | null
          total_nodes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_node_id?: string | null
          error_message?: string | null
          executed_nodes?: number
          execution_id: string
          flow_snapshot: Json
          id?: string
          last_event_at?: string | null
          last_node_type?: string | null
          next_scheduled_for?: string | null
          playbook_id?: string | null
          speed_multiplier?: number
          started_by: string
          status?: string
          tester_email: string
          tester_name?: string | null
          total_nodes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_node_id?: string | null
          error_message?: string | null
          executed_nodes?: number
          execution_id?: string
          flow_snapshot?: Json
          id?: string
          last_event_at?: string | null
          last_node_type?: string | null
          next_scheduled_for?: string | null
          playbook_id?: string | null
          speed_multiplier?: number
          started_by?: string
          status?: string
          tester_email?: string
          tester_name?: string | null
          total_nodes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_test_runs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "playbook_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_test_runs_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "onboarding_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_board_mappings: {
        Row: {
          auto_assign_user_id: string | null
          board_id: string
          created_at: string
          email_template_id: string | null
          form_filled_column_id: string | null
          form_id: string | null
          id: string
          initial_column_id: string
          is_active: boolean | null
          product_id: string
          send_welcome_email: boolean | null
          updated_at: string
        }
        Insert: {
          auto_assign_user_id?: string | null
          board_id: string
          created_at?: string
          email_template_id?: string | null
          form_filled_column_id?: string | null
          form_id?: string | null
          id?: string
          initial_column_id: string
          is_active?: boolean | null
          product_id: string
          send_welcome_email?: boolean | null
          updated_at?: string
        }
        Update: {
          auto_assign_user_id?: string | null
          board_id?: string
          created_at?: string
          email_template_id?: string | null
          form_filled_column_id?: string | null
          form_id?: string | null
          id?: string
          initial_column_id?: string
          is_active?: boolean | null
          product_id?: string
          send_welcome_email?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_board_mappings_auto_assign_user_id_fkey"
            columns: ["auto_assign_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_board_mappings_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_board_mappings_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_board_mappings_form_filled_column_id_fkey"
            columns: ["form_filled_column_id"]
            isOneToOne: false
            referencedRelation: "project_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_board_mappings_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_board_mappings_initial_column_id_fkey"
            columns: ["initial_column_id"]
            isOneToOne: false
            referencedRelation: "project_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_board_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          kiwify_product_id: string | null
          offer_id: string
          offer_name: string
          price: number | null
          product_id: string
          source: string | null
          source_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kiwify_product_id?: string | null
          offer_id: string
          offer_name: string
          price?: number | null
          product_id: string
          source?: string | null
          source_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kiwify_product_id?: string | null
          offer_id?: string
          offer_name?: string
          price?: number | null
          product_id?: string
          source?: string | null
          source_type?: string | null
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
      product_tags: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
          default_persona_id: string | null
          default_pipeline_id: string | null
          department: string | null
          full_name: string
          id: string
          is_archived: boolean | null
          is_blocked: boolean | null
          job_title: string | null
          last_status_change: string | null
          manager_id: string | null
          manual_offline: boolean | null
          notify_ai_governor: boolean | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_progress: number | null
          updated_at: string | null
          whatsapp_number: string | null
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
          default_persona_id?: string | null
          default_pipeline_id?: string | null
          department?: string | null
          full_name: string
          id: string
          is_archived?: boolean | null
          is_blocked?: boolean | null
          job_title?: string | null
          last_status_change?: string | null
          manager_id?: string | null
          manual_offline?: boolean | null
          notify_ai_governor?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_progress?: number | null
          updated_at?: string | null
          whatsapp_number?: string | null
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
          default_persona_id?: string | null
          default_pipeline_id?: string | null
          department?: string | null
          full_name?: string
          id?: string
          is_archived?: boolean | null
          is_blocked?: boolean | null
          job_title?: string | null
          last_status_change?: string | null
          manager_id?: string | null
          manual_offline?: boolean | null
          notify_ai_governor?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_progress?: number | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_persona_id_fkey"
            columns: ["default_persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_pipeline_id_fkey"
            columns: ["default_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
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
      project_activity_log: {
        Row: {
          action: string
          board_id: string | null
          card_id: string | null
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          board_id?: string | null
          card_id?: string | null
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          board_id?: string | null
          card_id?: string | null
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_log_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_log_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_board_templates: {
        Row: {
          columns: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_board_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_boards: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_boards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boards_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_board_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_card_assignees: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          card_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          card_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          card_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_card_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_assignees_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_card_attachments: {
        Row: {
          card_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          card_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_card_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_card_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string | null
          id: string
          is_system: boolean | null
          mentions: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          mentions?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          mentions?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_card_labels: {
        Row: {
          card_id: string
          label_id: string
        }
        Insert: {
          card_id: string
          label_id: string
        }
        Update: {
          card_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_card_labels_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "project_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      project_cards: {
        Row: {
          actual_hours: number | null
          board_id: string
          column_id: string
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          form_submission_id: string | null
          id: string
          is_completed: boolean | null
          kiwify_order_id: string | null
          position: number
          priority: string | null
          start_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          board_id: string
          column_id: string
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          form_submission_id?: string | null
          id?: string
          is_completed?: boolean | null
          kiwify_order_id?: string | null
          position?: number
          priority?: string | null
          start_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          board_id?: string
          column_id?: string
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          form_submission_id?: string | null
          id?: string
          is_completed?: boolean | null
          kiwify_order_id?: string | null
          position?: number
          priority?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "project_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cards_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cards_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklist_items: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          position: number | null
          title: string
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          position?: number | null
          title: string
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          position?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "project_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklists: {
        Row: {
          card_id: string
          created_at: string | null
          id: string
          position: number | null
          title: string
        }
        Insert: {
          card_id: string
          created_at?: string | null
          id?: string
          position?: number | null
          title: string
        }
        Update: {
          card_id?: string
          created_at?: string | null
          id?: string
          position?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "project_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      project_columns: {
        Row: {
          board_id: string
          color: string | null
          created_at: string | null
          email_template_id: string | null
          id: string
          is_final: boolean | null
          name: string
          notify_client_on_enter: boolean | null
          position: number
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string | null
          email_template_id?: string | null
          id?: string
          is_final?: boolean | null
          name: string
          notify_client_on_enter?: boolean | null
          position?: number
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string | null
          email_template_id?: string | null
          id?: string
          is_final?: boolean | null
          name?: string
          notify_client_on_enter?: boolean | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_columns_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_labels: {
        Row: {
          board_id: string
          color: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "project_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      protected_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protected_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protected_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
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
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
          whatsapp_number?: string | null
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
          blocked_reason: string | null
          blocked_until: string | null
          day_count: number | null
          hour_count: number | null
          id: string
          identifier: string
          instance_id: string | null
          is_blocked: boolean | null
          last_day_reset: string | null
          last_hour_reset: string | null
          last_minute_reset: string | null
          max_per_day: number | null
          max_per_hour: number | null
          max_per_minute: number | null
          min_delay_any: number | null
          min_delay_same_number: number | null
          minute_count: number | null
          request_count: number | null
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          action_type: string
          blocked_reason?: string | null
          blocked_until?: string | null
          day_count?: number | null
          hour_count?: number | null
          id?: string
          identifier: string
          instance_id?: string | null
          is_blocked?: boolean | null
          last_day_reset?: string | null
          last_hour_reset?: string | null
          last_minute_reset?: string | null
          max_per_day?: number | null
          max_per_hour?: number | null
          max_per_minute?: number | null
          min_delay_any?: number | null
          min_delay_same_number?: number | null
          minute_count?: number | null
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          action_type?: string
          blocked_reason?: string | null
          blocked_until?: string | null
          day_count?: number | null
          hour_count?: number | null
          id?: string
          identifier?: string
          instance_id?: string | null
          is_blocked?: boolean | null
          last_day_reset?: string | null
          last_hour_reset?: string | null
          last_minute_reset?: string | null
          max_per_day?: number | null
          max_per_hour?: number | null
          max_per_minute?: number | null
          min_delay_any?: number | null
          min_delay_same_number?: number | null
          minute_count?: number | null
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      report_definitions: {
        Row: {
          base_entity: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          is_template: boolean
          joins: Json
          name: string
          updated_at: string | null
        }
        Insert: {
          base_entity: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          is_template?: boolean
          joins?: Json
          name: string
          updated_at?: string | null
        }
        Update: {
          base_entity?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          is_template?: boolean
          joins?: Json
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      report_fields: {
        Row: {
          alias: string | null
          entity: string
          field_name: string
          id: string
          report_id: string
          sort_order: number
        }
        Insert: {
          alias?: string | null
          entity: string
          field_name: string
          id?: string
          report_id: string
          sort_order?: number
        }
        Update: {
          alias?: string | null
          entity?: string
          field_name?: string
          id?: string
          report_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_fields_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_filters: {
        Row: {
          entity: string
          field_name: string
          id: string
          is_required: boolean
          operator: string
          report_id: string
          value: Json | null
        }
        Insert: {
          entity: string
          field_name: string
          id?: string
          is_required?: boolean
          operator: string
          report_id: string
          value?: Json | null
        }
        Update: {
          entity?: string
          field_name?: string
          id?: string
          is_required?: boolean
          operator?: string
          report_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "report_filters_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_groupings: {
        Row: {
          entity: string
          field_name: string
          id: string
          report_id: string
          sort_order: number
          time_grain: string | null
        }
        Insert: {
          entity: string
          field_name: string
          id?: string
          report_id: string
          sort_order?: number
          time_grain?: string | null
        }
        Update: {
          entity?: string
          field_name?: string
          id?: string
          report_id?: string
          sort_order?: number
          time_grain?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_groupings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_metrics: {
        Row: {
          aggregation_type: string
          entity: string
          field_name: string | null
          id: string
          metric_name: string | null
          report_id: string
          sort_order: number
        }
        Insert: {
          aggregation_type: string
          entity: string
          field_name?: string | null
          id?: string
          metric_name?: string | null
          report_id: string
          sort_order?: number
        }
        Update: {
          aggregation_type?: string
          entity?: string
          field_name?: string | null
          id?: string
          metric_name?: string | null
          report_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_metrics_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      return_reasons: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      returns: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string
          description: string | null
          external_order_id: string
          id: string
          photos: Json | null
          product_items: Json | null
          reason: string
          registered_email: string | null
          seller_name: string | null
          status: string
          tracking_code_original: string | null
          tracking_code_return: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          external_order_id: string
          id?: string
          photos?: Json | null
          product_items?: Json | null
          reason: string
          registered_email?: string | null
          seller_name?: string | null
          status?: string
          tracking_code_original?: string | null
          tracking_code_return?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          external_order_id?: string
          id?: string
          photos?: Json | null
          product_items?: Json | null
          reason?: string
          registered_email?: string | null
          seller_name?: string | null
          status?: string
          tracking_code_original?: string | null
          tracking_code_return?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
      rls_policy_backup: {
        Row: {
          backed_up_at: string | null
          cmd: string | null
          id: number
          policyname: string | null
          qual: string | null
          schemaname: string | null
          tablename: string | null
          with_check: string | null
        }
        Insert: {
          backed_up_at?: string | null
          cmd?: string | null
          id?: number
          policyname?: string | null
          qual?: string | null
          schemaname?: string | null
          tablename?: string | null
          with_check?: string | null
        }
        Update: {
          backed_up_at?: string | null
          cmd?: string | null
          id?: number
          policyname?: string | null
          qual?: string | null
          schemaname?: string | null
          tablename?: string | null
          with_check?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          permission_category: string
          permission_key: string
          permission_label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          permission_category?: string
          permission_key: string
          permission_label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          permission_category?: string
          permission_key?: string
          permission_label?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_order_id: boolean | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_order_id?: boolean | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_order_id?: boolean | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      saque_operation_logs: {
        Row: {
          amount: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          pix_key_type: string | null
          status: string
          step: string
          ticket_id: string | null
        }
        Insert: {
          amount?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          pix_key_type?: string | null
          status?: string
          step: string
          ticket_id?: string | null
        }
        Update: {
          amount?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          pix_key_type?: string | null
          status?: string
          step?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saque_operation_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_deal_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_ticket_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          is_pinned: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_pinned?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_pinned?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      scoring_config: {
        Row: {
          created_at: string | null
          field_label: string
          field_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          value_rules: Json
        }
        Insert: {
          created_at?: string | null
          field_label: string
          field_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          value_rules?: Json
        }
        Update: {
          created_at?: string | null
          field_label?: string
          field_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          value_rules?: Json
        }
        Relationships: []
      }
      scoring_ranges: {
        Row: {
          classification: string
          color: string
          created_at: string | null
          id: string
          max_score: number | null
          min_score: number
          priority: number | null
        }
        Insert: {
          classification: string
          color: string
          created_at?: string | null
          id?: string
          max_score?: number | null
          min_score: number
          priority?: number | null
        }
        Update: {
          classification?: string
          color?: string
          created_at?: string | null
          id?: string
          max_score?: number | null
          min_score?: number
          priority?: number | null
        }
        Relationships: []
      }
      semantic_metrics: {
        Row: {
          created_at: string
          created_by: string | null
          default_filters: Json
          denominator_field: string | null
          description: string | null
          entity_base: string
          expression: string | null
          expression_type: string
          id: string
          is_active: boolean
          label: string | null
          name: string
          numerator_field: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_filters?: Json
          denominator_field?: string | null
          description?: string | null
          entity_base: string
          expression?: string | null
          expression_type: string
          id?: string
          is_active?: boolean
          label?: string | null
          name: string
          numerator_field?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_filters?: Json
          denominator_field?: string | null
          description?: string | null
          entity_base?: string
          expression?: string | null
          expression_type?: string
          id?: string
          is_active?: boolean
          label?: string | null
          name?: string
          numerator_field?: string | null
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
      sla_policies: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: string | null
          resolution_time_unit: string
          resolution_time_value: number
          response_time_unit: string
          response_time_value: number
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          resolution_time_unit?: string
          resolution_time_value?: number
          response_time_unit?: string
          response_time_value?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          resolution_time_unit?: string
          resolution_time_value?: number
          response_time_unit?: string
          response_time_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          auto_move_config: Json | null
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
          probability: number | null
        }
        Insert: {
          auto_move_config?: Json | null
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position: number
          probability?: number | null
        }
        Update: {
          auto_move_config?: Json | null
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
      sync_jobs: {
        Row: {
          auth_users_created: number | null
          completed_at: string | null
          contacts_created: number | null
          created_at: string | null
          created_by: string | null
          created_items: number | null
          customers_churned: number | null
          deals_created: number | null
          deals_updated: number | null
          errors: Json | null
          id: string
          job_type: string
          options: Json | null
          processed_items: number | null
          started_at: string | null
          status: string | null
          tags_added: number | null
          total_items: number | null
          updated_items: number | null
        }
        Insert: {
          auth_users_created?: number | null
          completed_at?: string | null
          contacts_created?: number | null
          created_at?: string | null
          created_by?: string | null
          created_items?: number | null
          customers_churned?: number | null
          deals_created?: number | null
          deals_updated?: number | null
          errors?: Json | null
          id?: string
          job_type: string
          options?: Json | null
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          tags_added?: number | null
          total_items?: number | null
          updated_items?: number | null
        }
        Update: {
          auth_users_created?: number | null
          completed_at?: string | null
          contacts_created?: number | null
          created_at?: string | null
          created_by?: string | null
          created_items?: number | null
          customers_churned?: number | null
          deals_created?: number | null
          deals_updated?: number | null
          errors?: Json | null
          id?: string
          job_type?: string
          options?: Json | null
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          tags_added?: number | null
          total_items?: number | null
          updated_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      team_channels: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          team_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          team_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_settings: {
        Row: {
          auto_assign: boolean | null
          created_at: string | null
          department_id: string | null
          id: string
          max_concurrent_chats: number | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          auto_assign?: boolean | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          max_concurrent_chats?: number | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          auto_assign?: boolean | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          max_concurrent_chats?: number | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_settings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean | null
          source: string | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          source?: string | null
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          source?: string | null
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
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notification_rules: {
        Row: {
          created_at: string | null
          email_template_id: string | null
          event_type: string
          id: string
          is_active: boolean | null
          ticket_category: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_template_id?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          ticket_category: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_template_id?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          ticket_category?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notification_rules_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notification_sends: {
        Row: {
          channel: string
          created_at: string
          id: string
          recipient_user_id: string
          ticket_event_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          recipient_user_id: string
          ticket_event_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          recipient_user_id?: string
          ticket_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notification_sends_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notification_sends_ticket_event_id_fkey"
            columns: ["ticket_event_id"]
            isOneToOne: false
            referencedRelation: "ticket_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_operations: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_origins: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      ticket_stakeholders: {
        Row: {
          added_at: string | null
          id: string
          role: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          role: string
          ticket_id: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          role?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_stakeholders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_stakeholders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_statuses: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          display_order: number
          email_template_id: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_archived_status: boolean | null
          is_final_status: boolean | null
          label: string
          name: string
          send_email_notification: boolean | null
          send_whatsapp_notification: boolean | null
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          email_template_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_archived_status?: boolean | null
          is_final_status?: boolean | null
          label: string
          name: string
          send_email_notification?: boolean | null
          send_whatsapp_notification?: boolean | null
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          email_template_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_archived_status?: boolean | null
          is_final_status?: boolean | null
          label?: string
          name?: string
          send_email_notification?: boolean | null
          send_whatsapp_notification?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_statuses_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          tag_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          tag_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          tag_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tags_ticket_id_fkey"
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
          created_by: string | null
          customer_id: string | null
          department_id: string | null
          description: string
          due_date: string | null
          first_response_at: string | null
          id: string
          idempotency_key: string | null
          internal_note: string | null
          last_email_message_id: string | null
          merged_to_ticket_id: string | null
          metadata: Json | null
          operation_id: string | null
          origin_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          rejection_reason: string | null
          requesting_department_id: string | null
          resolved_at: string | null
          source_conversation_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string | null
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
          created_by?: string | null
          customer_id?: string | null
          department_id?: string | null
          description: string
          due_date?: string | null
          first_response_at?: string | null
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          last_email_message_id?: string | null
          merged_to_ticket_id?: string | null
          metadata?: Json | null
          operation_id?: string | null
          origin_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rejection_reason?: string | null
          requesting_department_id?: string | null
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number?: string | null
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
          created_by?: string | null
          customer_id?: string | null
          department_id?: string | null
          description?: string
          due_date?: string | null
          first_response_at?: string | null
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          last_email_message_id?: string | null
          merged_to_ticket_id?: string | null
          metadata?: Json | null
          operation_id?: string | null
          origin_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          rejection_reason?: string | null
          requesting_department_id?: string | null
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_number?: string | null
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
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
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
            foreignKeyName: "tickets_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "ticket_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "ticket_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requesting_department_id_fkey"
            columns: ["requesting_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      tour_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          tour_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          tour_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          tour_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tracking_cache: {
        Row: {
          created_at: string | null
          external_created_at: string | null
          external_updated_at: string | null
          fetched_at: string | null
          id: string
          platform: string | null
          status: string | null
          tracking_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_created_at?: string | null
          external_updated_at?: string | null
          fetched_at?: string | null
          id?: string
          platform?: string | null
          status?: string | null
          tracking_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_created_at?: string | null
          external_updated_at?: string | null
          fetched_at?: string | null
          id?: string
          platform?: string | null
          status?: string | null
          tracking_code?: string
          updated_at?: string | null
        }
        Relationships: []
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
      whatsapp_instance_health_log: {
        Row: {
          alert_sent: boolean | null
          api_response: Json | null
          created_at: string | null
          detected_at: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          resolved_at: string | null
          restart_attempts: number | null
          status: string
        }
        Insert: {
          alert_sent?: boolean | null
          api_response?: Json | null
          created_at?: string | null
          detected_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          resolved_at?: string | null
          restart_attempts?: number | null
          status: string
        }
        Update: {
          alert_sent?: boolean | null
          api_response?: Json | null
          created_at?: string | null
          detected_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          resolved_at?: string | null
          restart_attempts?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_health_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          ai_mode: string | null
          api_token: string
          api_url: string
          auto_restart_enabled: boolean | null
          consecutive_failures: number | null
          created_at: string | null
          department_id: string | null
          id: string
          inbox_enabled: boolean | null
          instance_name: string
          last_health_check: string | null
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
          auto_restart_enabled?: boolean | null
          consecutive_failures?: number | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          inbox_enabled?: boolean | null
          instance_name: string
          last_health_check?: string | null
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
          auto_restart_enabled?: boolean | null
          consecutive_failures?: number | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          inbox_enabled?: boolean | null
          instance_name?: string
          last_health_check?: string | null
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
      whatsapp_message_templates: {
        Row: {
          body_text: string | null
          category: string | null
          created_at: string | null
          description: string | null
          has_variables: boolean | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          language_code: string
          name: string
          updated_at: string | null
          variable_examples: Json | null
        }
        Insert: {
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          has_variables?: boolean | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          language_code?: string
          name: string
          updated_at?: string | null
          variable_examples?: Json | null
        }
        Update: {
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          has_variables?: boolean | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          language_code?: string
          name?: string
          updated_at?: string | null
          variable_examples?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_instances: {
        Row: {
          access_token: string
          app_secret: string | null
          business_account_id: string
          created_at: string | null
          id: string
          name: string
          phone_number: string
          phone_number_id: string
          status: string | null
          updated_at: string | null
          verify_token: string
          webhook_verified: boolean | null
        }
        Insert: {
          access_token: string
          app_secret?: string | null
          business_account_id: string
          created_at?: string | null
          id?: string
          name: string
          phone_number: string
          phone_number_id: string
          status?: string | null
          updated_at?: string | null
          verify_token: string
          webhook_verified?: boolean | null
        }
        Update: {
          access_token?: string
          app_secret?: string | null
          business_account_id?: string
          created_at?: string | null
          id?: string
          name?: string
          phone_number?: string
          phone_number_id?: string
          status?: string | null
          updated_at?: string | null
          verify_token?: string
          webhook_verified?: boolean | null
        }
        Relationships: []
      }
      window_keeper_logs: {
        Row: {
          ai_latency_ms: number | null
          ai_model: string | null
          ai_tokens_used: number | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message_content: string | null
          message_source: string
          provider: string | null
          skipped_reason: string | null
          success: boolean
          trigger_reason: string
        }
        Insert: {
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_tokens_used?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string | null
          message_source: string
          provider?: string | null
          skipped_reason?: string | null
          success?: boolean
          trigger_reason: string
        }
        Update: {
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_tokens_used?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string | null
          message_source?: string
          provider?: string | null
          skipped_reason?: string | null
          success?: boolean
          trigger_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "window_keeper_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "window_keeper_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_integrations: {
        Row: {
          created_at: string | null
          encrypted_secrets: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          provider: string
          public_config: Json
          status: string
          updated_at: string | null
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_secrets?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          provider: string
          public_config?: Json
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_secrets?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string
          public_config?: Json
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      unmapped_kiwify_offers: {
        Row: {
          detected_source_type: string | null
          event_count: number | null
          kiwify_product_id: string | null
          kiwify_product_name: string | null
          plan_id: string | null
          plan_name: string | null
          total_revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_ticket_secure: {
        Args: { p_assigned_to?: string; p_ticket_id: string }
        Returns: Json
      }
      audit_rls_health: {
        Args: never
        Returns: {
          delete_policies: number
          has_role_policies: number
          insert_policies: number
          select_policies: number
          table_name: string
          total_policies: number
          update_policies: number
        }[]
      }
      audit_search_users: {
        Args: { p_search_term?: string }
        Returns: {
          email: string
          full_name: string
          roles: string[]
          user_id: string
        }[]
      }
      audit_security_checks: { Args: never; Returns: Json }
      audit_user_effective_permissions: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          granted_by_roles: string[]
          permission_key: string
        }[]
      }
      auto_assign_on_send: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      backfill_emails_from_messages: {
        Args: never
        Returns: {
          contacts_updated: number
          conversations_moved: number
          emails_found: number
        }[]
      }
      batch_validate_kiwify_contacts: { Args: never; Returns: Json }
      calculate_business_due_date: {
        Args: {
          p_start_date: string
          p_time_unit: string
          p_time_value: number
        }
        Returns: string
      }
      calculate_lead_score: { Args: { submission_id: string }; Returns: number }
      calculate_onboarding_progress: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_sla_status: {
        Args: {
          p_last_message_at: string
          p_last_sender_type: string
          p_status: string
        }
        Returns: string
      }
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
      check_submission_limit: {
        Args: { p_email: string; p_form_id: string }
        Returns: Json
      }
      claim_playbook_queue_items: {
        Args: { batch_size?: number }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "playbook_execution_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_insights_cache: { Args: never; Returns: number }
      cleanup_invalid_consultant_ids: { Args: never; Returns: number }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      cleanup_single_contact_test: {
        Args: { p_contact_id: string }
        Returns: Json
      }
      custom_auth_email_hook: { Args: { event: Json }; Returns: Json }
      distribute_client_to_consultant: {
        Args: { p_contact_id: string }
        Returns: Json
      }
      distribute_clients_round_robin: {
        Args: {
          p_consultant_ids: string[]
          p_contact_ids: string[]
          p_source_consultant_name: string
        }
        Returns: Json
      }
      distribute_unassigned_customers_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      exec_report_sql: { Args: { p_sql: string }; Returns: Json }
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
      find_ticket_by_partial_id: {
        Args: { partial_id: string }
        Returns: {
          assigned_to: string
          channel: string
          customer_id: string
          id: string
          last_email_message_id: string
          status: string
          subject: string
        }[]
      }
      fix_leads_that_are_kiwify_customers: {
        Args: never
        Returns: {
          contacts_updated: number
          conversations_updated: number
        }[]
      }
      generate_session_token: { Args: never; Returns: string }
      get_active_conversation_counts: { Args: never; Returns: Json }
      get_ai_resolution_daily: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          ai_resolved: number
          day: string
          handoff: number
          human: number
          total: number
        }[]
      }
      get_ai_resolution_metrics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          ai_resolution_rate: number
          ai_resolved: number
          handoff_rate: number
          human_handoff: number
          human_rate: number
          human_resolved: number
          mixed_resolved: number
          total_closed: number
          unclassified: number
        }[]
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
      get_assignee_for_form:
        | {
            Args: {
              p_department_id?: string
              p_distribution_rule: string
              p_pipeline_id?: string
              p_target_user_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_department_id: string
              p_distribution_rule: string
              p_target_user_id: string
            }
            Returns: string
          }
      get_auth_email: { Args: never; Returns: string }
      get_avg_first_response_time: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      get_avg_resolution_time: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      get_channel_performance_consolidated: {
        Args: { p_end: string; p_start: string }
        Returns: {
          ai_handled: number
          avg_csat: number
          channel: string
          closed_conversations: number
          conversion_rate: number
          human_handled: number
          total_conversations: number
          total_messages: number
        }[]
      }
      get_commercial_conversations_drilldown:
        | {
            Args: {
              p_agent_id?: string
              p_category_id?: string
              p_channel?: string
              p_department_id?: string
              p_end: string
              p_limit?: number
              p_no_tag?: boolean
              p_offset?: number
              p_search?: string
              p_start: string
              p_status?: string
            }
            Returns: {
              agent_name: string
              category_color: string
              category_name: string
              channel: string
              closed_at: string
              contact_name: string
              contact_phone: string
              conversation_id: string
              created_at: string
              department_name: string
              short_id: string
              status: string
              total_count: number
            }[]
          }
        | {
            Args: {
              p_agent_id?: string
              p_category: string
              p_channel?: string
              p_department_id: string
              p_end: string
              p_limit?: number
              p_offset?: number
              p_start: string
              p_status?: string
            }
            Returns: {
              assigned_agent_name: string
              closed_at: string
              contact_name: string
              contact_phone: string
              conversation_id: string
              created_at: string
              short_id: string
              status: string
              tag_name: string
              total_count: number
            }[]
          }
      get_commercial_conversations_kpis: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_start: string
          p_status?: string
        }
        Returns: {
          avg_csat: number
          avg_duration_seconds: number
          avg_waiting_seconds: number
          total_closed: number
          total_conversations: number
          total_open: number
          total_without_tag: number
        }[]
      }
      get_commercial_conversations_pivot: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_start: string
          p_status?: string
        }
        Returns: {
          category: string
          conversation_count: number
          department_id: string
          department_name: string
        }[]
      }
      get_commercial_conversations_report: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_start: string
          p_status?: string
        }
        Returns: {
          assigned_agent_name: string
          bot_flow: string
          closed_at: string
          contact_email: string
          contact_name: string
          contact_organization: string
          contact_phone: string
          conversation_id: string
          created_at: string
          csat_comment: string
          csat_score: number
          department_name: string
          duration_seconds: number
          first_customer_message: string
          handoff_at: string
          human_first_response_seconds: number
          human_resolution_seconds: number
          interactions_count: number
          last_conversation_tag: string
          origin: string
          participants: string
          short_id: string
          status: string
          tags_all: string[]
          tags_auto: string[]
          ticket_id: string
          total_count: number
          waiting_after_assignment_seconds: number
          waiting_time_seconds: number
        }[]
      }
      get_consultant_contact_ids: {
        Args: { consultant_user_id: string }
        Returns: string[]
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
      get_copilot_comparison: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_csat: number
          avg_resolution_seconds: number
          avg_suggestions_used: number
          group_label: string
          total_conversations: number
        }[]
      }
      get_copilot_health_score: {
        Args: {
          p_department_id?: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          adoption_component: number
          avg_csat_with_copilot: number
          avg_csat_without_copilot: number
          avg_resolution_time_with_copilot: number
          avg_resolution_time_without_copilot: number
          copilot_active_count: number
          copilot_adoption_rate: number
          csat_component: number
          csat_improvement_percent: number
          data_quality: string
          health_score: number
          health_score_version: string
          kb_component: number
          kb_coverage_rate: number
          kb_gap_count: number
          resolution_improvement_percent: number
          suggestion_usage_rate: number
          suggestions_available_total: number
          suggestions_used_total: number
          total_conversations: number
          usage_component: number
        }[]
      }
      get_copilot_monthly_evolution: {
        Args: { p_department_id?: string; p_months?: number }
        Returns: {
          adoption_rate: number
          avg_csat: number
          avg_resolution_time: number
          copilot_active_count: number
          kb_gaps_created: number
          month: string
          month_date: string
          total_conversations: number
        }[]
      }
      get_distinct_knowledge_categories: {
        Args: never
        Returns: {
          category: string
        }[]
      }
      get_distinct_product_tags: {
        Args: never
        Returns: {
          product_tag: string
        }[]
      }
      get_email_evolution: {
        Args: { p_days?: number; p_end?: string; p_start?: string }
        Returns: {
          clicked: number
          day: string
          delivered: number
          opened: number
          sent: number
        }[]
      }
      get_inbox_time_report: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_start: string
          p_status?: string
          p_tag_id?: string
          p_transferred?: string
        }
        Returns: {
          agent_first_msg_at: string
          ai_duration_sec: number
          ai_first_msg_at: string
          ai_first_response_sec: number
          assigned_agent_name: string
          channel: string
          contact_name: string
          contact_phone: string
          conversation_id: string
          csat_score: number
          customer_first_msg_at: string
          department_name: string
          handoff_at: string
          human_pickup_sec: number
          human_resolution_sec: number
          kpi_avg_ai_duration: number
          kpi_avg_ai_first_response: number
          kpi_avg_csat: number
          kpi_avg_human_pickup: number
          kpi_avg_human_resolution: number
          kpi_avg_total_resolution: number
          kpi_csat_response_rate: number
          kpi_p50_ai_first_response: number
          kpi_p90_ai_first_response: number
          kpi_pct_resolved_no_human: number
          resolved_at: string
          short_id: string
          status: string
          tags_all: string[]
          time_to_handoff_sec: number
          total_count: number
          total_resolution_sec: number
        }[]
      }
      get_kb_gaps_by_category: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          category: string
          gap_count: number
          gap_rate: number
          total_conversations: number
        }[]
      }
      get_least_loaded_consultant: { Args: never; Returns: string }
      get_least_loaded_sales_rep: { Args: never; Returns: string }
      get_least_loaded_sales_rep_for_pipeline: {
        Args: { p_pipeline_id?: string }
        Returns: string
      }
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
      get_playbook_email_sequence_report: {
        Args: { p_end?: string; p_playbook_id?: string; p_start?: string }
        Returns: {
          contact_email: string
          contact_name: string
          email_bounced_at: string
          email_clicked_at: string
          email_opened_at: string
          email_order: number
          email_sent_at: string
          email_status: string
          email_subject: string
          email_template_name: string
          execution_id: string
          playbook_name: string
          sale_date: string
        }[]
      }
      get_playbook_kpis: {
        Args: { p_end?: string; p_start?: string }
        Returns: Json
      }
      get_playbook_performance: {
        Args: { p_end?: string; p_start?: string }
        Returns: {
          completed: number
          emails_opened: number
          emails_sent: number
          executions: number
          failed: number
          open_rate: number
          playbook_id: string
          playbook_name: string
        }[]
      }
      get_ready_buffer_conversations: {
        Args: { p_cutoff: string }
        Returns: {
          conversation_id: string
        }[]
      }
      get_sla_compliance_v2: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_start: string
          p_status?: string
        }
        Returns: {
          compliance_rate: number
          on_time: number
          overdue: number
          pending: number
          total: number
        }[]
      }
      get_support_dashboard_counts: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_support_drilldown_v2: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_limit?: number
          p_metric?: string
          p_offset?: number
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_start: string
          p_status?: string
        }
        Returns: {
          agent_name: string
          channel: string
          created_at: string
          customer_name: string
          department_name: string
          due_date: string
          first_response_at: string
          frt_minutes: number
          id: string
          mttr_minutes: number
          resolved_at: string
          sla_status: string
          status: string
          ticket_number: string
          total_count: number
        }[]
      }
      get_support_metrics_consolidated: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_support_metrics_filtered: {
        Args: {
          p_agent_id?: string
          p_department_id?: string
          p_end: string
          p_start: string
        }
        Returns: Json
      }
      get_support_metrics_v2: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_start: string
          p_status?: string
        }
        Returns: {
          frt_avg_minutes: number
          frt_count: number
          mttr_avg_minutes: number
          mttr_count: number
        }[]
      }
      get_team_performance_consolidated: {
        Args: { p_end: string; p_start: string }
        Returns: {
          agent_id: string
          agent_name: string
          avatar_url: string
          avg_csat: number
          avg_response_minutes: number
          chats_attended: number
          sales_closed: number
          total_csat_ratings: number
          total_revenue: number
        }[]
      }
      get_tickets_export_report: {
        Args: {
          p_agent_ids?: string[]
          p_department_id?: string
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_priority?: string
          p_search?: string
          p_start?: string
          p_status?: string
        }
        Returns: {
          assigned_to_name: string
          category: string
          channel: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          department_name: string
          due_date: string
          first_response_at: string
          frt_minutes: number
          operation_name: string
          origin_name: string
          priority: string
          requesting_department_name: string
          resolution_minutes: number
          resolved_at: string
          sla_resolution_time_unit: string
          sla_resolution_time_value: number
          sla_response_time_unit: string
          sla_response_time_value: number
          status: string
          subject: string
          tags_list: string
          ticket_number: string
          total_count: number
        }[]
      }
      get_volume_resolution_consolidated: {
        Args: { p_end: string; p_start: string }
        Returns: {
          date_bucket: string
          opened: number
          resolved: number
        }[]
      }
      get_volume_vs_resolution_v2: {
        Args: {
          p_agent_id?: string
          p_channel?: string
          p_department_id?: string
          p_end: string
          p_start: string
        }
        Returns: {
          date_bucket: string
          opened: number
          resolved: number
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_rate_limit_counters: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      match_knowledge_articles: {
        Args: {
          match_count?: number
          match_threshold?: number
          product_filter?: string[]
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          problem: string
          similarity: number
          solution: string
          title: string
          when_to_use: string
        }[]
      }
      merge_duplicate_contacts: {
        Args: { p_duplicate_ids: string[]; p_master_id: string }
        Returns: Json
      }
      normalize_phone: { Args: { phone: string }; Returns: string }
      reset_inbox_unread_count: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      resolve_contact_by_identity: {
        Args: {
          p_channel?: string
          p_email?: string
          p_external_id?: string
          p_phone_e164?: string
        }
        Returns: string
      }
      search_similar_articles: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
          title: string
        }[]
      }
      set_agent_departments: {
        Args: {
          p_additional_department_ids?: string[]
          p_primary_department_id: string
          p_profile_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      take_control_secure: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      transfer_conversation_secure: {
        Args: {
          p_conversation_id: string
          p_to_department_id: string
          p_to_user_id: string
          p_transfer_note?: string
        }
        Returns: Json
      }
      transfer_ticket_secure: {
        Args: {
          p_assigned_to?: string
          p_department_id: string
          p_internal_note?: string
          p_ticket_id: string
        }
        Returns: Json
      }
      try_lock_conversation_buffer: {
        Args: { conv_id: string }
        Returns: boolean
      }
      update_article_embedding: {
        Args: { article_id: string; new_embedding: string }
        Returns: undefined
      }
      update_rate_limit_counters: {
        Args: { p_instance_id: string }
        Returns: {
          can_send: boolean
          wait_ms: number
        }[]
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
      ai_mode: "autopilot" | "copilot" | "disabled" | "waiting_human"
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
        | "financial_agent"
        | "ecommerce_analyst"
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
      availability_status: "online" | "busy" | "away" | "offline"
      client_error_type:
        | "runtime"
        | "network"
        | "edge_function"
        | "chunk"
        | "unhandled_rejection"
      communication_channel:
        | "email"
        | "phone"
        | "whatsapp"
        | "chat"
        | "meeting"
        | "form"
        | "other"
        | "web_chat"
      conversation_channel: "whatsapp" | "email" | "web_chat"
      conversation_status: "open" | "resolved" | "closed" | "waiting_human"
      customer_status:
        | "lead"
        | "qualified"
        | "customer"
        | "inactive"
        | "churned"
        | "overdue"
      deal_status: "open" | "won" | "lost"
      department_type: "comercial" | "suporte" | "marketing" | "operacional"
      form_distribution_rule: "round_robin" | "manager_only" | "specific_user"
      form_target_type:
        | "deal"
        | "ticket"
        | "internal_request"
        | "none"
        | "kanban_card"
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
        | "ticket_created"
        | "ticket_assigned"
        | "ticket_status_changed"
        | "ticket_transferred"
        | "ticket_resolved"
        | "ticket_closed"
        | "internal_note"
        | "email_delivered"
        | "email_bounce"
      message_status: "sending" | "sent" | "delivered" | "failed" | "read"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      sender_type: "user" | "contact" | "system"
      ticket_category:
        | "financeiro"
        | "tecnico"
        | "bug"
        | "outro"
        | "duvida"
        | "problema_tecnico"
        | "sugestao"
        | "reclamacao"
        | "saque"
        | "cancelamento"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
        | "returned"
        | "loja_bloqueada"
        | "loja_concluida"
        | "pending_approval"
        | "approved"
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
      ai_mode: ["autopilot", "copilot", "disabled", "waiting_human"],
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
        "financial_agent",
        "ecommerce_analyst",
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
      availability_status: ["online", "busy", "away", "offline"],
      client_error_type: [
        "runtime",
        "network",
        "edge_function",
        "chunk",
        "unhandled_rejection",
      ],
      communication_channel: [
        "email",
        "phone",
        "whatsapp",
        "chat",
        "meeting",
        "form",
        "other",
        "web_chat",
      ],
      conversation_channel: ["whatsapp", "email", "web_chat"],
      conversation_status: ["open", "resolved", "closed", "waiting_human"],
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
      form_distribution_rule: ["round_robin", "manager_only", "specific_user"],
      form_target_type: [
        "deal",
        "ticket",
        "internal_request",
        "none",
        "kanban_card",
      ],
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
        "ticket_created",
        "ticket_assigned",
        "ticket_status_changed",
        "ticket_transferred",
        "ticket_resolved",
        "ticket_closed",
        "internal_note",
        "email_delivered",
        "email_bounce",
      ],
      message_status: ["sending", "sent", "delivered", "failed", "read"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
      sender_type: ["user", "contact", "system"],
      ticket_category: [
        "financeiro",
        "tecnico",
        "bug",
        "outro",
        "duvida",
        "problema_tecnico",
        "sugestao",
        "reclamacao",
        "saque",
        "cancelamento",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
        "returned",
        "loja_bloqueada",
        "loja_concluida",
        "pending_approval",
        "approved",
      ],
    },
  },
} as const
