// Auto-generated style Supabase Database types for Bad Ass Tasks
// Update this file after running `supabase gen types typescript` in the future
// NOTE (QA): App-level domain types (Task/Note/Workspace/PendingOperation) live in ./index.ts and are
// the source of truth for UI + hybrid layer. These DB types are for raw Supabase client queries only.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          owner_id: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          owner_id?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          owner_id?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          title: string
          description: string | null
          status: 'backlog' | 'todo' | 'doing' | 'done'
          priority: 'P0' | 'P1' | 'P2' | 'P3'
          due_date: string | null
          assignee_ids: string[]
          parent_task_id: string | null
          recurring_rule: string | null
          exception_dates: string[] | null
          time_estimate: number | null
          time_spent: number | null
          tags: string[]
          linked_note_ids: string[]
          created_by: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          description?: string | null
          status?: 'backlog' | 'todo' | 'doing' | 'done'
          priority?: 'P0' | 'P1' | 'P2' | 'P3'
          due_date?: string | null
          assignee_ids?: string[]
          parent_task_id?: string | null
          recurring_rule?: string | null
          exception_dates?: string[] | null
          time_estimate?: number | null
          time_spent?: number | null
          tags?: string[]
          linked_note_ids?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          description?: string | null
          status?: 'backlog' | 'todo' | 'doing' | 'done'
          priority?: 'P0' | 'P1' | 'P2' | 'P3'
          due_date?: string | null
          assignee_ids?: string[]
          parent_task_id?: string | null
          recurring_rule?: string | null
          exception_dates?: string[] | null
          time_estimate?: number | null
          time_spent?: number | null
          tags?: string[]
          linked_note_ids?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      notes: {
        Row: {
          id: string
          workspace_id: string
          title: string
          content: Json | null
          parent_note_id: string | null
          is_archived: boolean
          tags: string[]
          linked_task_ids: string[]
          linked_note_ids?: string[] // M2 note-to-note links (added 2026-05-30)
          sort_order?: number | null // M2 drag ordering within parent
          snapshots?: Json | null // M2 version history array
          created_by: string | null
          created_at: string
          updated_at: string
          last_edited_by: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          content?: Json | null
          parent_note_id?: string | null
          is_archived?: boolean
          tags?: string[]
          linked_task_ids?: string[]
          linked_note_ids?: string[] // M2
          sort_order?: number | null // M2
          snapshots?: Json | null // M2
          created_by?: string | null
          created_at?: string
          updated_at?: string
          last_edited_by?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          content?: Json | null
          parent_note_id?: string | null
          is_archived?: boolean
          tags?: string[]
          linked_task_ids?: string[]
          linked_note_ids?: string[] // M2
          sort_order?: number | null // M2
          snapshots?: Json | null // M2
          created_by?: string | null
          created_at?: string
          updated_at?: string
          last_edited_by?: string | null
        }
      },
      // Added for Phase 2 collaboration (workspace_members was missing from prior types)
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'user'
          joined_at: string
          invited_by: string | null
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'user'
          joined_at?: string
          invited_by?: string | null
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'user'
          joined_at?: string
          invited_by?: string | null
        }
      },
      workspace_invites: {
        Row: {
          id: string
          workspace_id: string
          email: string | null
          role: 'owner' | 'admin' | 'user'
          invited_by: string | null
          invited_user_id: string | null
          expires_at: string | null
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email?: string | null
          role?: 'owner' | 'admin' | 'user'
          invited_by?: string | null
          invited_user_id?: string | null
          expires_at?: string | null
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string | null
          role?: 'owner' | 'admin' | 'user'
          invited_by?: string | null
          invited_user_id?: string | null
          expires_at?: string | null
          accepted_at?: string | null
          created_at?: string
        }
      },
      workspace_messages: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
      },
      workspace_message_reactions: {
        Row: {
          id: string
          workspace_id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      },
      activity_logs: {
        Row: {
          id: string
          workspace_id: string
          user_id: string | null
          action_type: string
          target_type: string
          target_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id?: string | null
          action_type: string
          target_type: string
          target_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string | null
          action_type?: string
          target_type?: string
          target_id?: string | null
          metadata?: Json
          created_at?: string
        }
      },
      notifications: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          type: string
          title: string
          message: string
          link: string | null
          activity_log_id: string | null
          metadata: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          type: string
          title: string
          message: string
          link?: string | null
          activity_log_id?: string | null
          metadata?: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          link?: string | null
          activity_log_id?: string | null
          metadata?: Json
          read_at?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_workspace_for_user: {
        Args: {
          user_id: string
          workspace_name: string
          workspace_slug: string
        }
        Returns: string
      },
      // Phase 2 collaboration RPCs
      create_workspace_invite: {
        Args: {
          p_workspace_id: string
          p_email: string | null
          p_role: 'owner' | 'admin' | 'user'
        }
        Returns: string
      },
      accept_workspace_invite: {
        Args: {
          p_invite_id: string
        }
        Returns: string
      }
    }
    Enums: {
      user_role: 'owner' | 'admin' | 'user'
      task_priority: 'P0' | 'P1' | 'P2' | 'P3'
      task_status: 'backlog' | 'todo' | 'doing' | 'done'
    }
  }
}
