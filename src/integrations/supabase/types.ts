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
          id: string
          image: string | null
          is_new: boolean | null
          link: string | null
          name: string
          price: number | null
        }
        Insert: {
          brand?: string | null
          category?: string
          created_at?: string
          id?: string
          image?: string | null
          is_new?: boolean | null
          link?: string | null
          name: string
          price?: number | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          id?: string
          image?: string | null
          is_new?: boolean | null
          link?: string | null
          name?: string
          price?: number | null
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
      upvotes: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          visitor_id: string
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          visitor_id: string
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      weekly_schedule: {
        Row: {
          day_of_week: string
          id: number
          tv_show_id: number | null
          movie_id: number | null
        }
        Insert: {
          day_of_week: string
          id?: number
          tv_show_id?: number | null
          movie_id?: number | null
        }
        Update: {
          day_of_week?: string
          id?: number
          tv_show_id?: number | null
          movie_id?: number | null
        }
        Relationships: [
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
