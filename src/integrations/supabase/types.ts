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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      cards: {
        Row: {
          bandeira: string
          cor: string
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          entity_id: string | null
          id: string
          limite: number
          nome: string
          user_id: string
        }
        Insert: {
          bandeira?: string
          cor?: string
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          entity_id?: string | null
          id?: string
          limite?: number
          nome: string
          user_id: string
        }
        Update: {
          bandeira?: string
          cor?: string
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          entity_id?: string | null
          id?: string
          limite?: number
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cor: string
          created_at: string
          entity_id: string | null
          id: string
          keywords: string[]
          monthly_budget: number | null
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          keywords?: string[]
          monthly_budget?: number | null
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          keywords?: string[]
          monthly_budget?: number | null
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_widgets: {
        Row: {
          color: string
          config: Json
          created_at: string
          description: string | null
          entity_id: string
          icon: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          widget_type: string
        }
        Insert: {
          color?: string
          config?: Json
          created_at?: string
          description?: string | null
          entity_id: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          widget_type: string
        }
        Update: {
          color?: string
          config?: Json
          created_at?: string
          description?: string | null
          entity_id?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_widgets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_members: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_members_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entities: {
        Row: {
          active: boolean
          archived_at: string | null
          created_at: string
          document: string | null
          id: string
          is_default: boolean
          legal_name: string | null
          name: string
          nickname: string | null
          owner_user_id: string
          trade_name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          document?: string | null
          id?: string
          is_default?: boolean
          legal_name?: string | null
          name: string
          nickname?: string | null
          owner_user_id: string
          trade_name?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          document?: string | null
          id?: string
          is_default?: boolean
          legal_name?: string | null
          name?: string
          nickname?: string | null
          owner_user_id?: string
          trade_name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      gastos_fixos: {
        Row: {
          ativo: boolean
          auto_debit: boolean
          card_id: string | null
          categoria: string | null
          created_at: string
          descricao: string
          dia: number
          entity_id: string | null
          forma_pagamento: string
          id: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          auto_debit?: boolean
          card_id?: string | null
          categoria?: string | null
          created_at?: string
          descricao: string
          dia: number
          entity_id?: string | null
          forma_pagamento?: string
          id?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean
          auto_debit?: boolean
          card_id?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string
          dia?: number
          entity_id?: string | null
          forma_pagamento?: string
          id?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_fixos_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_fixos_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      global_admins: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      home_profiles: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          is_active: boolean
          layouts: Json
          name: string
          updated_at: string
          user_id: string
          visibility: Json
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          is_active?: boolean
          layouts?: Json
          name: string
          updated_at?: string
          user_id: string
          visibility?: Json
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          layouts?: Json
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "home_profiles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          card_id: string
          created_at: string
          data_compra: string
          entity_id: string | null
          fatura_mes: string
          id: string
          numero_parcela: number
          paga: boolean
          total_parcelas: number
          transaction_id: string
          user_id: string
          valor: number
        }
        Insert: {
          card_id: string
          created_at?: string
          data_compra: string
          entity_id?: string | null
          fatura_mes: string
          id?: string
          numero_parcela: number
          paga?: boolean
          total_parcelas: number
          transaction_id: string
          user_id: string
          valor: number
        }
        Update: {
          card_id?: string
          created_at?: string
          data_compra?: string
          entity_id?: string | null
          fatura_mes?: string
          id?: string
          numero_parcela?: number
          paga?: boolean
          total_parcelas?: number
          transaction_id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "installments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_analyses: {
        Row: {
          card_id: string | null
          created_at: string
          fatura_mes: string | null
          id: string
          nome: string | null
          raw_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          fatura_mes?: string | null
          id?: string
          nome?: string | null
          raw_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          fatura_mes?: string | null
          id?: string
          nome?: string | null
          raw_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_analyses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_analysis_items: {
        Row: {
          analysis_id: string
          categoria: string | null
          created_at: string
          data: string
          descricao_original: string
          finalidade: string | null
          id: string
          parcela_atual: number | null
          total_parcelas: number | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          analysis_id: string
          categoria?: string | null
          created_at?: string
          data: string
          descricao_original: string
          finalidade?: string | null
          id?: string
          parcela_atual?: number | null
          total_parcelas?: number | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          analysis_id?: string
          categoria?: string | null
          created_at?: string
          data?: string
          descricao_original?: string
          finalidade?: string | null
          id?: string
          parcela_atual?: number | null
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_analysis_items_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "invoice_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          card_id: string
          created_at: string
          entity_id: string | null
          fatura_mes: string
          fechamento: string | null
          fim_periodo: string | null
          id: string
          inicio_periodo: string | null
          origem: string
          paid_at: string | null
          status: string | null
          total_despesas: number | null
          total_pagamentos: number | null
          updated_at: string
          user_id: string
          valor_pago: number
          valor_total: number | null
          vencimento: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          entity_id?: string | null
          fatura_mes: string
          fechamento?: string | null
          fim_periodo?: string | null
          id?: string
          inicio_periodo?: string | null
          origem?: string
          paid_at?: string | null
          status?: string | null
          total_despesas?: number | null
          total_pagamentos?: number | null
          updated_at?: string
          user_id: string
          valor_pago?: number
          valor_total?: number | null
          vencimento?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          entity_id?: string | null
          fatura_mes?: string
          fechamento?: string | null
          fim_periodo?: string | null
          id?: string
          inicio_periodo?: string | null
          origem?: string
          paid_at?: string | null
          status?: string | null
          total_despesas?: number | null
          total_pagamentos?: number | null
          updated_at?: string
          user_id?: string
          valor_pago?: number
          valor_total?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          deduplication_key: string | null
          description: string
          entity_id: string | null
          expires_at: string | null
          id: string
          is_read: boolean
          level: string
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          deduplication_key?: string | null
          description: string
          entity_id?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          level?: string
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          deduplication_key?: string | null
          description?: string
          entity_id?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          level?: string
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule: {
        Row: {
          ativo: boolean
          created_at: string
          dia_pagamento: number
          dia_vale: number | null
          id: string
          recebe_vale: boolean
          updated_at: string
          user_id: string
          valor_pagamento: number
          valor_vale: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_pagamento: number
          dia_vale?: number | null
          id?: string
          recebe_vale?: boolean
          updated_at?: string
          user_id: string
          valor_pagamento?: number
          valor_vale?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_pagamento?: number
          dia_vale?: number | null
          id?: string
          recebe_vale?: boolean
          updated_at?: string
          user_id?: string
          valor_pagamento?: number
          valor_vale?: number | null
        }
        Relationships: []
      }
      plan_overrides: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          plan: string
          reason: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          plan: string
          reason?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          plan?: string
          reason?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          ativo: boolean
          auto_debit: boolean
          card_id: string | null
          categoria: string | null
          created_at: string
          descricao: string
          dia: number
          entity_id: string | null
          id: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          auto_debit?: boolean
          card_id?: string | null
          categoria?: string | null
          created_at?: string
          descricao: string
          dia: number
          entity_id?: string | null
          id?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean
          auto_debit?: boolean
          card_id?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string
          dia?: number
          entity_id?: string | null
          id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          price_id: string | null
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          price_id?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          price_id?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          card_id: string | null
          categoria: string | null
          created_at: string
          data_compra: string
          descricao: string
          entity_id: string | null
          fatura_mes_importada: string | null
          id: string
          parcela_atual_importada: number | null
          parcelas: number
          tipo: Database["public"]["Enums"]["transaction_type"]
          total_parcelas_importadas: number | null
          user_id: string
          valor_total: number
        }
        Insert: {
          card_id?: string | null
          categoria?: string | null
          created_at?: string
          data_compra: string
          descricao: string
          entity_id?: string | null
          fatura_mes_importada?: string | null
          id?: string
          parcela_atual_importada?: number | null
          parcelas?: number
          tipo: Database["public"]["Enums"]["transaction_type"]
          total_parcelas_importadas?: number | null
          user_id: string
          valor_total: number
        }
        Update: {
          card_id?: string | null
          categoria?: string | null
          created_at?: string
          data_compra?: string
          descricao?: string
          entity_id?: string | null
          fatura_mes_importada?: string | null
          id?: string
          parcela_atual_importada?: number | null
          parcelas?: number
          tipo?: Database["public"]["Enums"]["transaction_type"]
          total_parcelas_importadas?: number | null
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "financial_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_preferences: {
        Row: {
          accent_color: string | null
          created_at: string
          dashboard_widgets: Json
          density: string | null
          id: string
          is_default: boolean
          layout: Json
          name: string
          preferences: Json
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          dashboard_widgets?: Json
          density?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name: string
          preferences?: Json
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          dashboard_widgets?: Json
          density?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          preferences?: Json
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plan_addons: {
        Row: {
          addon_key: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          quantity: number
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          addon_key: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          addon_key?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_home_profile: {
        Args: { target_profile_id: string }
        Returns: undefined
      }
      admin_dashboard_summary: {
        Args: never
        Returns: {
          active_manual_overrides: number
          total_cards: number
          total_entities: number
          total_transactions: number
          total_users: number
          users_free: number
          users_max: number
          users_premium: number
          users_pro: number
        }[]
      }
      admin_disable_plan_override: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      admin_list_audit_logs: {
        Args: { limit_count?: number }
        Returns: {
          action: string
          admin_email: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_email: string
          target_user_id: string
        }[]
      }
      admin_list_plan_overrides: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          created_by: string
          email: string
          ends_at: string
          is_currently_valid: boolean
          override_id: string
          plan: string
          reason: string
          starts_at: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          cards_count: number
          created_at: string
          current_plan: string
          email: string
          entities_count: number
          is_manual_override: boolean
          manual_override_active: boolean
          manual_override_ends_at: string
          manual_override_plan: string
          manual_override_reason: string
          manual_override_starts_at: string
          transactions_count: number
          user_id: string
        }[]
      }
      admin_upsert_plan_override: {
        Args: {
          override_ends_at?: string
          override_reason: string
          override_starts_at?: string
          target_plan: string
          target_user_id: string
        }
        Returns: string
      }
      apply_scheduled_entries: { Args: never; Returns: undefined }
      archive_financial_entity: {
        Args: { target_entity_id: string }
        Returns: boolean
      }
      calc_first_fatura_mes: {
        Args: { p_data_compra: string; p_dia_fechamento: number }
        Returns: string
      }
      can_add_entity_member: {
        Args: { p_owner_user_id: string }
        Returns: boolean
      }
      can_create_card: { Args: { p_user_id: string }; Returns: boolean }
      can_create_category: { Args: { p_user_id: string }; Returns: boolean }
      can_create_financial_entity: {
        Args: { p_type: string; p_user_id: string }
        Returns: boolean
      }
      can_create_transaction: {
        Args: { p_reference_date?: string; p_user_id: string }
        Returns: boolean
      }
      count_owner_members: { Args: { p_user_id: string }; Returns: number }
      count_user_cards: { Args: { p_user_id: string }; Returns: number }
      count_user_categories: { Args: { p_user_id: string }; Returns: number }
      count_user_entities_by_type: {
        Args: { p_type: string; p_user_id: string }
        Returns: number
      }
      count_user_transactions_in_month: {
        Args: { p_reference_date?: string; p_user_id: string }
        Returns: number
      }
      create_financial_entity: {
        Args: {
          entity_document: string
          entity_legal_name?: string
          entity_nickname: string
          entity_trade_name?: string
          entity_type: string
        }
        Returns: string
      }
      generate_financial_notifications: { Args: never; Returns: undefined }
      get_active_extra_entity_slots: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_entity_limits_summary: { Args: { p_user_id?: string }; Returns: Json }
      get_plan_limits: { Args: { p_plan: string }; Returns: Json }
      get_user_manual_plan_override: {
        Args: { target_user_id: string }
        Returns: {
          ends_at: string
          plan: string
          reason: string
          starts_at: string
        }[]
      }
      get_user_plan: { Args: { p_user_id: string }; Returns: string }
      get_user_plan_limits: { Args: { p_user_id: string }; Returns: Json }
      get_user_plan_summary: { Args: { p_user_id?: string }; Returns: Json }
      is_entity_owner: {
        Args: { _entity_id: string; _user_id: string }
        Returns: boolean
      }
      is_global_admin: { Args: { check_user_id?: string }; Returns: boolean }
      list_my_financial_entities: {
        Args: never
        Returns: {
          active: boolean
          cards_count: number
          categories_count: number
          created_at: string
          document: string
          id: string
          invoices_count: number
          is_default: boolean
          legal_name: string
          name: string
          nickname: string
          owner_user_id: string
          trade_name: string
          transactions_count: number
          type: string
          updated_at: string
        }[]
      }
      run_my_scheduled_entries: { Args: never; Returns: undefined }
      safe_month_day: {
        Args: { p_day: number; p_month: string }
        Returns: string
      }
      set_default_financial_entity: {
        Args: { target_entity_id: string }
        Returns: boolean
      }
      update_financial_entity: {
        Args: {
          entity_document: string
          entity_legal_name?: string
          entity_nickname: string
          entity_trade_name?: string
          target_entity_id: string
        }
        Returns: boolean
      }
      user_can_use_feature: {
        Args: { p_feature: string; p_user_id: string }
        Returns: boolean
      }
      user_has_reached_limit: {
        Args: {
          p_current_value: number
          p_limit_key: string
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      plan_tier: "free" | "pro" | "premium" | "max"
      transaction_type: "entrada" | "debito" | "credito"
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
      plan_tier: ["free", "pro", "premium", "max"],
      transaction_type: ["entrada", "debito", "credito"],
    },
  },
} as const
