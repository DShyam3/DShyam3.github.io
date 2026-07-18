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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          author: string | null
          category: string
          created_at: string
          id: string
          image_url: string | null
          link: string | null
          notes: string | null
          title: string
        }
        Insert: {
          author?: string | null
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link?: string | null
          notes?: string | null
          title: string
        }
        Update: {
          author?: string | null
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link?: string | null
          notes?: string | null
          title?: string
        }
        Relationships: []
      }
      beliefs: {
        Row: {
          author: string | null
          created_at: string
          id: string
          quote: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          quote: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          quote?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string
          category: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          link: string | null
          price: number | null
          tags: string[] | null
          title: string
        }
        Insert: {
          author: string
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          price?: number | null
          tags?: string[] | null
          title: string
        }
        Update: {
          author?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          price?: number | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      creators: {
        Row: {
          category: string
          created_at: string
          id: string
          image_url: string | null
          link: string | null
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link?: string | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link?: string | null
          name?: string
        }
        Relationships: []
      }
      favourites: {
        Row: {
          category: string | null
          created_at: string | null
          id: number
          media_type: string
          poster: string | null
          title: string
          tmdb_id: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: number
          media_type?: string
          poster?: string | null
          title: string
          tmdb_id?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: number
          media_type?: string
          poster?: string | null
          title?: string
          tmdb_id?: number | null
        }
        Relationships: []
      }
      finance_bank_accounts: {
        Row: {
          annual_fee: number
          balance: number
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_default: boolean
          issuer: string | null
          name: string
          type: string
          updated_at: string
          use_case: string | null
        }
        Insert: {
          annual_fee?: number
          balance?: number
          color?: string | null
          created_at?: string
          emoji?: string | null
          id: string
          is_default?: boolean
          issuer?: string | null
          name: string
          type: string
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          annual_fee?: number
          balance?: number
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_default?: boolean
          issuer?: string | null
          name?: string
          type?: string
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      finance_budget_categories: {
        Row: {
          budgeted: number
          created_at: string
          emoji: string | null
          group_type: string | null
          id: string
          is_default: boolean
          is_template: boolean
          name: string
          updated_at: string
        }
        Insert: {
          budgeted?: number
          created_at?: string
          emoji?: string | null
          group_type?: string | null
          id: string
          is_default?: boolean
          is_template?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          budgeted?: number
          created_at?: string
          emoji?: string | null
          group_type?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_budget_items: {
        Row: {
          budgeted: number
          category_id: string
          created_at: string
          emoji: string | null
          id: string
          is_default: boolean
          is_template: boolean
          linked_account_id: string | null
          name: string
          spent: number
          updated_at: string
        }
        Insert: {
          budgeted?: number
          category_id: string
          created_at?: string
          emoji?: string | null
          id: string
          is_default?: boolean
          is_template?: boolean
          linked_account_id?: string | null
          name: string
          spent?: number
          updated_at?: string
        }
        Update: {
          budgeted?: number
          category_id?: string
          created_at?: string
          emoji?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          linked_account_id?: string | null
          name?: string
          spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budget_presets: {
        Row: {
          created_at: string
          emoji: string | null
          group_type: string | null
          id: string
          is_default: boolean
          name: string
          preset_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          group_type?: string | null
          id?: string
          is_default?: boolean
          name: string
          preset_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          group_type?: string | null
          id?: string
          is_default?: boolean
          name?: string
          preset_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_credit_bureaus: {
        Row: {
          color: string | null
          created_at: string
          emoji: string | null
          gradient: string | null
          id: string
          is_default: boolean
          key: string
          label: string
          max_score: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          gradient?: string | null
          id?: string
          is_default?: boolean
          key: string
          label: string
          max_score: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          gradient?: string | null
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          max_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_credit_scores: {
        Row: {
          bureau: string
          created_at: string
          date: string
          id: string
          is_default: boolean
          score: number
          updated_at: string
        }
        Insert: {
          bureau: string
          created_at?: string
          date: string
          id: string
          is_default?: boolean
          score: number
          updated_at?: string
        }
        Update: {
          bureau?: string
          created_at?: string
          date?: string
          id?: string
          is_default?: boolean
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_data: {
        Row: {
          content: string | null
          key: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          key: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_defaults: {
        Row: {
          content: string | null
          key: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          key: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_goal_contributions: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          date: string
          goal_id: string
          id: string
          is_default: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date: string
          goal_id: string
          id: string
          is_default?: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          is_default?: boolean
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "finance_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_goals: {
        Row: {
          created_at: string
          current_amount: number
          id: string
          is_default: boolean
          name: string
          start_date: string | null
          target_amount: number
          target_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          id: string
          is_default?: boolean
          name: string
          start_date?: string | null
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          id?: string
          is_default?: boolean
          name?: string
          start_date?: string | null
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_holiday_defaults: {
        Row: {
          count: number
          created_at: string
          dates: string | null
          id: string
          is_default: boolean
          month_index: number
          occasion: string | null
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          dates?: string | null
          id?: string
          is_default?: boolean
          month_index: number
          occasion?: string | null
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          dates?: string | null
          id?: string
          is_default?: boolean
          month_index?: number
          occasion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_memberships: {
        Row: {
          annual_fee: number
          created_at: string
          id: string
          is_default: boolean
          name: string
          status: string | null
          type: string
          updated_at: string
          use_case: string | null
        }
        Insert: {
          annual_fee?: number
          created_at?: string
          id: string
          is_default?: boolean
          name: string
          status?: string | null
          type: string
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          annual_fee?: number
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          status?: string | null
          type?: string
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      finance_recurring_bills: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          due_date: number
          due_month: number | null
          emoji: string | null
          frequency: string
          id: string
          is_default: boolean
          is_paid: boolean
          linked_account_id: string | null
          linked_budget_item_id: string | null
          name: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          due_date: number
          due_month?: number | null
          emoji?: string | null
          frequency?: string
          id: string
          is_default?: boolean
          is_paid?: boolean
          linked_account_id?: string | null
          linked_budget_item_id?: string | null
          name: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          due_date?: number
          due_month?: number | null
          emoji?: string | null
          frequency?: string
          id?: string
          is_default?: boolean
          is_paid?: boolean
          linked_account_id?: string | null
          linked_budget_item_id?: string | null
          name?: string
          tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_recurring_templates: {
        Row: {
          budget_category_name: string | null
          category: string
          created_at: string
          default_amount: number
          emoji: string | null
          frequency: string
          id: string
          is_default: boolean
          linked_budget_item_id: string | null
          name: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          budget_category_name?: string | null
          category: string
          created_at?: string
          default_amount?: number
          emoji?: string | null
          frequency?: string
          id?: string
          is_default?: boolean
          linked_budget_item_id?: string | null
          name: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          budget_category_name?: string | null
          category?: string
          created_at?: string
          default_amount?: number
          emoji?: string | null
          frequency?: string
          id?: string
          is_default?: boolean
          linked_budget_item_id?: string | null
          name?: string
          tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          active_savings_types: string[] | null
          bank_holidays: number
          employer_pension_percent: number
          gross_salary: number
          id: string
          is_default: boolean
          pay_day_of_month: number | null
          payday_biweekly_anchor: string | null
          payday_schedule: string | null
          payday_weekday: number | null
          pension_type: string
          personal_allowance: number
          personal_pension_percent: number
          student_loan_plan: string
          tax_code: string
          tax_year: number
          uk_region: string
          updated_at: string
          weekends: number
          work_holidays: number
          working_hours_per_day: number
        }
        Insert: {
          active_savings_types?: string[] | null
          bank_holidays?: number
          employer_pension_percent?: number
          gross_salary?: number
          id?: string
          is_default?: boolean
          pay_day_of_month?: number | null
          payday_biweekly_anchor?: string | null
          payday_schedule?: string | null
          payday_weekday?: number | null
          pension_type?: string
          personal_allowance?: number
          personal_pension_percent?: number
          student_loan_plan?: string
          tax_code?: string
          tax_year?: number
          uk_region?: string
          updated_at?: string
          weekends?: number
          work_holidays?: number
          working_hours_per_day?: number
        }
        Update: {
          active_savings_types?: string[] | null
          bank_holidays?: number
          employer_pension_percent?: number
          gross_salary?: number
          id?: string
          is_default?: boolean
          pay_day_of_month?: number | null
          payday_biweekly_anchor?: string | null
          payday_schedule?: string | null
          payday_weekday?: number | null
          pension_type?: string
          personal_allowance?: number
          personal_pension_percent?: number
          student_loan_plan?: string
          tax_code?: string
          tax_year?: number
          uk_region?: string
          updated_at?: string
          weekends?: number
          work_holidays?: number
          working_hours_per_day?: number
        }
        Relationships: []
      }
      finance_tax_configs: {
        Row: {
          created_at: string
          id: string
          income_tax_bands: Json
          is_default: boolean
          national_insurance_bands: Json
          student_loan_rates: Json
          student_loan_thresholds: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          income_tax_bands: Json
          is_default?: boolean
          national_insurance_bands: Json
          student_loan_rates: Json
          student_loan_thresholds: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          income_tax_bands?: Json
          is_default?: boolean
          national_insurance_bands?: Json
          student_loan_rates?: Json
          student_loan_thresholds?: Json
          updated_at?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string | null
          created_at: string
          date: string
          goal_id: string | null
          id: string
          is_default: boolean
          is_recurring: boolean
          is_reviewed: boolean
          name: string
          notes: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          date: string
          goal_id?: string | null
          id: string
          is_default?: boolean
          is_recurring?: boolean
          is_reviewed?: boolean
          name: string
          notes?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          goal_id?: string | null
          id?: string
          is_default?: boolean
          is_recurring?: boolean
          is_reviewed?: boolean
          name?: string
          notes?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_user_holidays: {
        Row: {
          count: number
          created_at: string
          end_date: string
          id: string
          is_default: boolean
          occasion: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          end_date: string
          id: string
          is_default?: boolean
          occasion?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          end_date?: string
          id?: string
          is_default?: boolean
          occasion?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspirations: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          link: string | null
          name: string
          why_i_like: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          name: string
          why_i_like?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          name?: string
          why_i_like?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          image: string | null
          is_new: boolean | null
          is_wishlist: boolean | null
          link: string | null
          name: string
          price: number | null
          subcategory: string | null
        }
        Insert: {
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          is_new?: boolean | null
          is_wishlist?: boolean | null
          link?: string | null
          name: string
          price?: number | null
          subcategory?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          is_new?: boolean | null
          is_wishlist?: boolean | null
          link?: string | null
          name?: string
          price?: number | null
          subcategory?: string | null
        }
        Relationships: []
      }
      links: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          url?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          genre: string | null
          id: number
          overview: string | null
          platform: string | null
          poster: string | null
          release_date: string | null
          release_year: number | null
          runtime: number | null
          title: string
          tmdb_id: number | null
        }
        Insert: {
          genre?: string | null
          id?: number
          overview?: string | null
          platform?: string | null
          poster?: string | null
          release_date?: string | null
          release_year?: number | null
          runtime?: number | null
          title: string
          tmdb_id?: number | null
        }
        Update: {
          genre?: string | null
          id?: number
          overview?: string | null
          platform?: string | null
          poster?: string | null
          release_date?: string | null
          release_year?: number | null
          runtime?: number | null
          title?: string
          tmdb_id?: number | null
        }
        Relationships: []
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          location: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          location?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          location?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          instructions: string | null
          is_personal: boolean
          link: string | null
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          is_personal?: boolean
          link?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          is_personal?: boolean
          link?: string | null
          title?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content: string | null
          key: string
          metadata: Json | null
          order: number | null
          section: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          key: string
          metadata?: Json | null
          order?: number | null
          section?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          key?: string
          metadata?: Json | null
          order?: number | null
          section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          id: number
          items_synced: number | null
          status: string
          sync_type: string
          synced_at: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          id?: number
          items_synced?: number | null
          status?: string
          sync_type?: string
          synced_at?: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          id?: number
          items_synced?: number | null
          status?: string
          sync_type?: string
          synced_at?: string
        }
        Relationships: []
      }
      tv_show_episodes: {
        Row: {
          episode_number: number
          id: number
          release_date: string | null
          runtime: number | null
          season_id: number | null
          title: string | null
          watched: boolean | null
        }
        Insert: {
          episode_number: number
          id?: number
          release_date?: string | null
          runtime?: number | null
          season_id?: number | null
          title?: string | null
          watched?: boolean | null
        }
        Update: {
          episode_number?: number
          id?: number
          release_date?: string | null
          runtime?: number | null
          season_id?: number | null
          title?: string | null
          watched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_show_episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "tv_show_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_show_seasons: {
        Row: {
          id: number
          release_date: string | null
          release_year: number | null
          season_number: number
          tv_show_id: number | null
          watched: boolean | null
        }
        Insert: {
          id?: number
          release_date?: string | null
          release_year?: number | null
          season_number: number
          tv_show_id?: number | null
          watched?: boolean | null
        }
        Update: {
          id?: number
          release_date?: string | null
          release_year?: number | null
          season_number?: number
          tv_show_id?: number | null
          watched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_show_seasons_tv_show_id_fkey"
            columns: ["tv_show_id"]
            isOneToOne: false
            referencedRelation: "tv_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_shows: {
        Row: {
          genre: string | null
          id: number
          overview: string | null
          platform: string
          poster: string | null
          release_date: string | null
          status: string | null
          title: string
          tmdb_id: number | null
        }
        Insert: {
          genre?: string | null
          id?: number
          overview?: string | null
          platform: string
          poster?: string | null
          release_date?: string | null
          status?: string | null
          title: string
          tmdb_id?: number | null
        }
        Update: {
          genre?: string | null
          id?: number
          overview?: string | null
          platform?: string
          poster?: string | null
          release_date?: string | null
          status?: string | null
          title?: string
          tmdb_id?: number | null
        }
        Relationships: []
      }
      visited_cities: {
        Row: {
          city_name: string
          country_code: string
          created_at: string | null
          dot_col: number
          dot_row: number
          id: number
          lat: number
          lon: number
        }
        Insert: {
          city_name: string
          country_code: string
          created_at?: string | null
          dot_col: number
          dot_row: number
          id?: number
          lat: number
          lon: number
        }
        Update: {
          city_name?: string
          country_code?: string
          created_at?: string | null
          dot_col?: number
          dot_row?: number
          id?: number
          lat?: number
          lon?: number
        }
        Relationships: []
      }
      visited_countries: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          flag_url: string | null
          id: number
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          flag_url?: string | null
          id?: number
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          flag_url?: string | null
          id?: number
        }
        Relationships: []
      }
      weekly_schedule: {
        Row: {
          day_of_week: string
          id: number
          movie_id: number | null
          tv_show_id: number | null
        }
        Insert: {
          day_of_week: string
          id?: number
          movie_id?: number | null
          tv_show_id?: number | null
        }
        Update: {
          day_of_week?: string
          id?: number
          movie_id?: number | null
          tv_show_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_tv_show_id_fkey"
            columns: ["tv_show_id"]
            isOneToOne: false
            referencedRelation: "tv_shows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      content_type:
        | "inventory"
        | "link"
        | "book"
        | "article"
        | "creator"
        | "photo"
        | "recipe"
        | "belief"
        | "inspiration"
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
      content_type: [
        "inventory",
        "link",
        "book",
        "article",
        "creator",
        "photo",
        "recipe",
        "belief",
        "inspiration",
      ],
    },
  },
} as const
