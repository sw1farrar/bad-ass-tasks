// Auto-generated style Supabase Database types for Badazz Tasks
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
      profiles: {
        Row: {
          id: string
          full_name: string | null
          username: string | null
          location: string | null
          avatar_url: string | null
          email: string | null
          notification_prefs: Json
          created_at: string
          last_active_at: string | null
          access_paused: boolean
          access_paused_at: string | null
          access_paused_reason: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          username?: string | null
          location?: string | null
          avatar_url?: string | null
          email?: string | null
          notification_prefs?: Json
          created_at?: string
          last_active_at?: string | null
          access_paused?: boolean
          access_paused_at?: string | null
          access_paused_reason?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          username?: string | null
          location?: string | null
          avatar_url?: string | null
          email?: string | null
          notification_prefs?: Json
          created_at?: string
          last_active_at?: string | null
          access_paused?: boolean
          access_paused_at?: string | null
          access_paused_reason?: string | null
        }
      }
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
          raw_html: string | null
          email_source?: string | null
          search_plain?: string | null
          email_pipeline_version?: number | null
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
          raw_html?: string | null
          email_source?: string | null
          search_plain?: string | null
          email_pipeline_version?: number | null
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
          raw_html?: string | null
          email_source?: string | null
          search_plain?: string | null
          email_pipeline_version?: number | null
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
      },
      workspace_lists: {
        Row: {
          id: string
          workspace_id: string
          title: string
          color: string
          sort_order: number
          pinned: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          color?: string
          sort_order?: number
          pinned?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          color?: string
          sort_order?: number
          pinned?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      },
      list_items: {
        Row: {
          id: string
          list_id: string
          workspace_id: string
          text: string
          completed: boolean
          sort_order: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          workspace_id: string
          text: string
          completed?: boolean
          sort_order?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          workspace_id?: string
          text?: string
          completed?: boolean
          sort_order?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      },
      dual_auth_challenges: {
        Row: {
          id: string
          user_id: string
          code_hash: string
          expires_at: string
          created_at: string
          consumed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          code_hash: string
          expires_at: string
          created_at?: string
          consumed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          code_hash?: string
          expires_at?: string
          created_at?: string
          consumed_at?: string | null
        }
      },
      note_email_inboxes: {
        Row: {
          id: string
          workspace_id: string
          parent_note_id: string | null
          local_part: string
          label: string | null
          created_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          parent_note_id?: string | null
          local_part: string
          label?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          parent_note_id?: string | null
          local_part?: string
          label?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      },
      note_attachments: {
        Row: {
          id: string
          note_id: string
          workspace_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          source: string
          content_id?: string | null
          created_by: string | null
          created_at: string
          pdf_annotations: unknown
        }
        Insert: {
          id?: string
          note_id: string
          workspace_id: string
          file_name: string
          mime_type?: string
          size_bytes?: number
          storage_path: string
          source?: string
          content_id?: string | null
          created_by?: string | null
          created_at?: string
          pdf_annotations?: unknown
        }
        Update: {
          id?: string
          note_id?: string
          workspace_id?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          source?: string
          content_id?: string | null
          created_by?: string | null
          pdf_annotations?: unknown
          created_at?: string
        }
      },
      task_email_inboxes: {
        Row: {
          id: string
          workspace_id: string
          local_part: string
          label: string | null
          created_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          local_part: string
          label?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          local_part?: string
          label?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      },
      inbound_email_events: {
        Row: {
          id: string
          message_id: string
          inbox_id: string | null
          note_id: string | null
          task_id: string | null
          task_inbox_id: string | null
          local_part: string | null
          processed_at: string
        }
        Insert: {
          id?: string
          message_id: string
          inbox_id?: string | null
          note_id?: string | null
          task_id?: string | null
          task_inbox_id?: string | null
          local_part?: string | null
          processed_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          inbox_id?: string | null
          note_id?: string | null
          task_id?: string | null
          task_inbox_id?: string | null
          local_part?: string | null
          processed_at?: string
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
      exit_workspace: {
        Args: {
          p_workspace_id: string
        }
        Returns: boolean
      }
      delete_workspace_for_owner: {
        Args: {
          p_workspace_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'owner' | 'admin' | 'user'
      task_priority: 'P0' | 'P1' | 'P2' | 'P3'
      task_status: 'backlog' | 'todo' | 'doing' | 'done'
    }
  }
}
