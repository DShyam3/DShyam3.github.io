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
    PostgrestVersion: "14.1"
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
      movies: {
        Row: {
          genre: string | null
          id: number
          overview: string | null
          platform: string
          poster: string | null
          release_date: string | null
          release_year: number | null
          runtime: number | null
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
          release_year?: number | null
          runtime?: number | null
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
          release_year?: number | null
          runtime?: number | null
          status?: string | null
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
      | "creator"
      | "quote"
      | "inspiration"
      | "photo"
      | "article"
      | "recipe"
      | "belief"
      | "watchlist"
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
        "creator",
        "quote",
        "inspiration",
        "photo",
        "article",
        "recipe",
        "belief",
        "watchlist",
      ],
    },
  },
} as const
