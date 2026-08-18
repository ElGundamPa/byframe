/**
 * types/database.ts
 *
 * Tipos del esquema público, escritos a mano para corresponder exactamente con
 * supabase/migrations/0001_schema.sql.
 *
 * Cuando cambies el esquema puedes regenerarlos con la CLI de Supabase en vez
 * de editarlos a mano:
 *
 *   npx supabase gen types typescript --project-id <REF> --schema public > types/database.ts
 *
 * donde <REF> es la parte variable de la URL del proyecto
 * (https://<REF>.supabase.co). Requiere haber iniciado sesión con
 * `npx supabase login`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** Formatos admitidos. Corresponde al CHECK de projects.format. */
export type ProjectFormat = 'horizontal' | 'vertical'

/** Enlaces sociales de un miembro del equipo (team_members.links). */
export type TeamLinks = {
  instagram?: string | null
  vimeo?: string | null
  linkedin?: string | null
  behance?: string | null
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          slug: string
          title: string
          client: string | null
          year: number | null
          format: ProjectFormat
          description: string | null
          hls_url: string | null
          poster_url: string | null
          loop_url: string | null
          duration: number | null
          sort_order: number
          published: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          client?: string | null
          year?: number | null
          format: ProjectFormat
          description?: string | null
          hls_url?: string | null
          poster_url?: string | null
          loop_url?: string | null
          duration?: number | null
          sort_order?: number
          published?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          client?: string | null
          year?: number | null
          format?: ProjectFormat
          description?: string | null
          hls_url?: string | null
          poster_url?: string | null
          loop_url?: string | null
          duration?: number | null
          sort_order?: number
          published?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      project_credits: {
        Row: {
          id: string
          project_id: string
          role: string
          name: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          role: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          role?: string
          name?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_credits_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }

      team_members: {
        Row: {
          id: string
          name: string
          role: string | null
          bio: string | null
          photo_url: string | null
          links: TeamLinks
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          role?: string | null
          bio?: string | null
          photo_url?: string | null
          links?: TeamLinks
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string | null
          bio?: string | null
          photo_url?: string | null
          links?: TeamLinks
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      site_settings: {
        Row: {
          id: string
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      home_hero: {
        Row: {
          id: string
          project_id: string | null
          custom_video_url: string | null
          custom_poster_url: string | null
          overlay_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          custom_video_url?: string | null
          custom_poster_url?: string | null
          overlay_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          custom_video_url?: string | null
          custom_poster_url?: string | null
          overlay_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'home_hero_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/* Atajos de uso frecuente en el resto del código. */
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type ProjectCredit = Database['public']['Tables']['project_credits']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type SiteSetting = Database['public']['Tables']['site_settings']['Row']
export type HomeHero = Database['public']['Tables']['home_hero']['Row']
