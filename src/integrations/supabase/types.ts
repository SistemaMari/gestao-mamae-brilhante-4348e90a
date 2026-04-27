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
      admins: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      consultas: {
        Row: {
          cenario_clinico: string | null
          created_at: string
          data: string
          id: string
          ig_dias: number | null
          ig_semanas: number | null
          numero_sequencial: number
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          status_gerado: string | null
          tipo: string
        }
        Insert: {
          cenario_clinico?: string | null
          created_at?: string
          data?: string
          id?: string
          ig_dias?: number | null
          ig_semanas?: number | null
          numero_sequencial?: number
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          status_gerado?: string | null
          tipo?: string
        }
        Update: {
          cenario_clinico?: string | null
          created_at?: string
          data?: string
          id?: string
          ig_dias?: number | null
          ig_semanas?: number | null
          numero_sequencial?: number
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          status_gerado?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          convidado_por: string
          created_at: string
          email_convidado: string
          expires_at: string
          id: string
          status: string
          token: string
          unidade_id: string
        }
        Insert: {
          convidado_por: string
          created_at?: string
          email_convidado: string
          expires_at?: string
          id?: string
          status?: string
          token: string
          unidade_id: string
        }
        Update: {
          convidado_por?: string
          created_at?: string
          email_convidado?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      exames_glicemia: {
        Row: {
          consulta_id: string
          created_at: string
          data_exame: string
          id: string
          ig_dias_na_data: number | null
          ig_semanas_na_data: number | null
          paciente_id: string
          profissional_id: string
          tipo_exame: string
          valor_mgdl: number
        }
        Insert: {
          consulta_id: string
          created_at?: string
          data_exame?: string
          id?: string
          ig_dias_na_data?: number | null
          ig_semanas_na_data?: number | null
          paciente_id: string
          profissional_id: string
          tipo_exame?: string
          valor_mgdl: number
        }
        Update: {
          consulta_id?: string
          created_at?: string
          data_exame?: string
          id?: string
          ig_dias_na_data?: number | null
          ig_semanas_na_data?: number | null
          paciente_id?: string
          profissional_id?: string
          tipo_exame?: string
          valor_mgdl?: number
        }
        Relationships: [
          {
            foreignKeyName: "exames_glicemia_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_glicemia_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_glicemia_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      gestores_gerais: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      laudos: {
        Row: {
          cenario_clinico: string | null
          consulta_id: string
          conteudo_laudo: string | null
          created_at: string
          id: string
          metadata: Json | null
          paciente_id: string
          profissional_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cenario_clinico?: string | null
          consulta_id: string
          conteudo_laudo?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          paciente_id: string
          profissional_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cenario_clinico?: string | null
          consulta_id?: string
          conteudo_laudo?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          paciente_id?: string
          profissional_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laudos_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          cidade: string | null
          created_at: string
          data_nascimento: string | null
          data_proximo_retorno: string | null
          data_ultima_consulta: string | null
          dmg_gestacao_anterior: boolean | null
          dum: string | null
          estado: string | null
          id: string
          nome: string
          numero_identificacao: string | null
          pais: string | null
          profissional_id: string
          status_ficha: string
          tipo_identificacao: string | null
          tipo_retorno: string | null
          unidade_id: string | null
          updated_at: string
          usg_data: string | null
          usg_ig_dias: number | null
          usg_ig_semanas: number | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          data_nascimento?: string | null
          data_proximo_retorno?: string | null
          data_ultima_consulta?: string | null
          dmg_gestacao_anterior?: boolean | null
          dum?: string | null
          estado?: string | null
          id?: string
          nome: string
          numero_identificacao?: string | null
          pais?: string | null
          profissional_id: string
          status_ficha?: string
          tipo_identificacao?: string | null
          tipo_retorno?: string | null
          unidade_id?: string | null
          updated_at?: string
          usg_data?: string | null
          usg_ig_dias?: number | null
          usg_ig_semanas?: number | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          data_nascimento?: string | null
          data_proximo_retorno?: string | null
          data_ultima_consulta?: string | null
          dmg_gestacao_anterior?: boolean | null
          dum?: string | null
          estado?: string | null
          id?: string
          nome?: string
          numero_identificacao?: string | null
          pais?: string | null
          profissional_id?: string
          status_ficha?: string
          tipo_identificacao?: string | null
          tipo_retorno?: string | null
          unidade_id?: string | null
          updated_at?: string
          usg_data?: string | null
          usg_ig_dias?: number | null
          usg_ig_semanas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      partos: {
        Row: {
          classificacao_rn: string | null
          created_at: string
          data_parto: string
          descricao_intercorrencia_materna: string | null
          descricao_intercorrencia_neonatal: string | null
          id: string
          ig_parto_dias: number | null
          ig_parto_semanas: number | null
          intercorrencia_materna: boolean
          intercorrencia_neonatal: boolean
          observacoes: string | null
          paciente_id: string
          peso_rn_g: number | null
          profissional_id: string
          unidade_id: string | null
          updated_at: string
          via_parto: string
        }
        Insert: {
          classificacao_rn?: string | null
          created_at?: string
          data_parto: string
          descricao_intercorrencia_materna?: string | null
          descricao_intercorrencia_neonatal?: string | null
          id?: string
          ig_parto_dias?: number | null
          ig_parto_semanas?: number | null
          intercorrencia_materna?: boolean
          intercorrencia_neonatal?: boolean
          observacoes?: string | null
          paciente_id: string
          peso_rn_g?: number | null
          profissional_id: string
          unidade_id?: string | null
          updated_at?: string
          via_parto: string
        }
        Update: {
          classificacao_rn?: string | null
          created_at?: string
          data_parto?: string
          descricao_intercorrencia_materna?: string | null
          descricao_intercorrencia_neonatal?: string | null
          id?: string
          ig_parto_dias?: number | null
          ig_parto_semanas?: number | null
          intercorrencia_materna?: boolean
          intercorrencia_neonatal?: boolean
          observacoes?: string | null
          paciente_id?: string
          peso_rn_g?: number | null
          profissional_id?: string
          unidade_id?: string | null
          updated_at?: string
          via_parto?: string
        }
        Relationships: []
      }
      perfis_glicemicos: {
        Row: {
          consulta_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          decisao: string | null
          dose_insulina_calculada: number | null
          id: string
          paciente_id: string
          percentual_meta: number
          peso_paciente_kg: number | null
          profissional_id: string
          tipo_perfil: string
        }
        Insert: {
          consulta_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          decisao?: string | null
          dose_insulina_calculada?: number | null
          id?: string
          paciente_id: string
          percentual_meta?: number
          peso_paciente_kg?: number | null
          profissional_id: string
          tipo_perfil?: string
        }
        Update: {
          consulta_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          decisao?: string | null
          dose_insulina_calculada?: number | null
          id?: string
          paciente_id?: string
          percentual_meta?: number
          peso_paciente_kg?: number | null
          profissional_id?: string
          tipo_perfil?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_glicemicos_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_glicemicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_glicemicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais: {
        Row: {
          cidade: string | null
          created_at: string
          crm: string | null
          especialidade: string | null
          estado: string | null
          id: string
          identificador_padrao: string | null
          idioma: string | null
          laudos_limite: number
          laudos_usados: number
          nome: string
          pais: string | null
          perfil_institucional: string | null
          periodo_renovacao: string | null
          plano: string
          plano_expira_em: string | null
          plano_status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          telefone: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          crm?: string | null
          especialidade?: string | null
          estado?: string | null
          id?: string
          identificador_padrao?: string | null
          idioma?: string | null
          laudos_limite?: number
          laudos_usados?: number
          nome: string
          pais?: string | null
          perfil_institucional?: string | null
          periodo_renovacao?: string | null
          plano?: string
          plano_expira_em?: string | null
          plano_status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          crm?: string | null
          especialidade?: string | null
          estado?: string | null
          id?: string
          identificador_padrao?: string | null
          idioma?: string | null
          laudos_limite?: number
          laudos_usados?: number
          nome?: string
          pais?: string | null
          perfil_institucional?: string | null
          periodo_renovacao?: string | null
          plano?: string
          plano_expira_em?: string | null
          plano_status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_unidade: {
        Row: {
          arquivo_path: string
          arquivo_tamanho_bytes: number | null
          created_at: string
          gestor_id: string
          id: string
          metricas_resumo: Json | null
          periodo_fim: string
          periodo_inicio: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          arquivo_path: string
          arquivo_tamanho_bytes?: number | null
          created_at?: string
          gestor_id: string
          id?: string
          metricas_resumo?: Json | null
          periodo_fim: string
          periodo_inicio: string
          tipo?: string
          unidade_id: string
        }
        Update: {
          arquivo_path?: string
          arquivo_tamanho_bytes?: number | null
          created_at?: string
          gestor_id?: string
          id?: string
          metricas_resumo?: Json | null
          periodo_fim?: string
          periodo_inicio?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          created_at: string
          id: string
          nome: string
          plano_expira_em: string | null
          plano_status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          plano_expira_em?: string | null
          plano_status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          plano_expira_em?: string | null
          plano_status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      valores_perfil: {
        Row: {
          created_at: string
          dia: number
          id: string
          perfil_id: string
          ponto: string
          valor_mgdl: number
        }
        Insert: {
          created_at?: string
          dia: number
          id?: string
          perfil_id: string
          ponto: string
          valor_mgdl: number
        }
        Update: {
          created_at?: string
          dia?: number
          id?: string
          perfil_id?: string
          ponto?: string
          valor_mgdl?: number
        }
        Relationships: [
          {
            foreignKeyName: "valores_perfil_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_glicemicos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      belongs_to_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_gestor_geral: { Args: { _user_id: string }; Returns: boolean }
      pode_criar_ficha: {
        Args: { p_profissional_id: string }
        Returns: boolean
      }
      pode_gerar_laudo: { Args: { p_profissional_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
