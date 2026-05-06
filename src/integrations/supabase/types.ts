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
      admin_access_log: {
        Row: {
          admin_id: string
          created_at: string
          id: number
          ip: string | null
          pais_filtro: string | null
          status_code: number
          user_agent: string | null
          view_consultada: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: number
          ip?: string | null
          pais_filtro?: string | null
          status_code: number
          user_agent?: string | null
          view_consultada: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: number
          ip?: string | null
          pais_filtro?: string | null
          status_code?: number
          user_agent?: string | null
          view_consultada?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          acao: string
          alvo_admin_id: string | null
          alvo_email: string
          alvo_nome: string | null
          created_at: string
          executado_por: string
          executado_por_email: string
          id: string
          metadata: Json | null
        }
        Insert: {
          acao: string
          alvo_admin_id?: string | null
          alvo_email: string
          alvo_nome?: string | null
          created_at?: string
          executado_por: string
          executado_por_email: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          acao?: string
          alvo_admin_id?: string | null
          alvo_email?: string
          alvo_nome?: string | null
          created_at?: string
          executado_por?: string
          executado_por_email?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
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
      asaas_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      consolidacoes: {
        Row: {
          created_at: string
          csv_path: string | null
          gestor_geral_id: string
          id: string
          notas: Json | null
          pdf_path: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          relatorio_ids: string[]
          unidades_incluidas: number
        }
        Insert: {
          created_at?: string
          csv_path?: string | null
          gestor_geral_id: string
          id?: string
          notas?: Json | null
          pdf_path?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          relatorio_ids: string[]
          unidades_incluidas?: number
        }
        Update: {
          created_at?: string
          csv_path?: string | null
          gestor_geral_id?: string
          id?: string
          notas?: Json | null
          pdf_path?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          relatorio_ids?: string[]
          unidades_incluidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "consolidacoes_gestor_geral_id_fkey"
            columns: ["gestor_geral_id"]
            isOneToOne: false
            referencedRelation: "gestores_gerais"
            referencedColumns: ["id"]
          },
        ]
      }
      consultas: {
        Row: {
          cenario_clinico: string | null
          created_at: string
          data: string
          id: string
          ig_dias: number | null
          ig_semanas: number | null
          is_rascunho: boolean
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
          is_rascunho?: boolean
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
          is_rascunho?: boolean
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
      contratantes: {
        Row: {
          cnpj: string
          contato_email: string
          contato_nome: string
          contato_telefone: string | null
          created_at: string
          data_inicio_contrato: string
          data_termino_contrato: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          id: string
          motivo_encerramento: string | null
          nome: string
          observacoes: string | null
          razao_social: string | null
          status: string
        }
        Insert: {
          cnpj: string
          contato_email: string
          contato_nome: string
          contato_telefone?: string | null
          created_at?: string
          data_inicio_contrato: string
          data_termino_contrato?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          id?: string
          motivo_encerramento?: string | null
          nome: string
          observacoes?: string | null
          razao_social?: string | null
          status?: string
        }
        Update: {
          cnpj?: string
          contato_email?: string
          contato_nome?: string
          contato_telefone?: string | null
          created_at?: string
          data_inicio_contrato?: string
          data_termino_contrato?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          id?: string
          motivo_encerramento?: string | null
          nome?: string
          observacoes?: string | null
          razao_social?: string | null
          status?: string
        }
        Relationships: []
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
            referencedRelation: "mv_admin_unidades_resumo"
            referencedColumns: ["unidade_id"]
          },
          {
            foreignKeyName: "convites_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          link_eduzz: string | null
          nome: string
          ordem: number
          plano_minimo: string
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          link_eduzz?: string | null
          nome: string
          ordem?: number
          plano_minimo?: string
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          link_eduzz?: string | null
          nome?: string
          ordem?: number
          plano_minimo?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      execucoes_cron: {
        Row: {
          detalhe_falhas: Json | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          job_nome: string
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string
          total_falha: number | null
          total_sucesso: number | null
          total_unidades: number | null
          total_vazias: number | null
        }
        Insert: {
          detalhe_falhas?: Json | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          job_nome: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          total_falha?: number | null
          total_sucesso?: number | null
          total_unidades?: number | null
          total_vazias?: number | null
        }
        Update: {
          detalhe_falhas?: Json | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          job_nome?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          total_falha?: number | null
          total_sucesso?: number | null
          total_unidades?: number | null
          total_vazias?: number | null
        }
        Relationships: []
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
      gestores_gerais_contratantes: {
        Row: {
          contratante_id: string
          gestor_geral_id: string
          vinculado_em: string
        }
        Insert: {
          contratante_id: string
          gestor_geral_id: string
          vinculado_em?: string
        }
        Update: {
          contratante_id?: string
          gestor_geral_id?: string
          vinculado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestores_gerais_contratantes_contratante_id_fkey"
            columns: ["contratante_id"]
            isOneToOne: false
            referencedRelation: "contratantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestores_gerais_contratantes_gestor_geral_id_fkey"
            columns: ["gestor_geral_id"]
            isOneToOne: false
            referencedRelation: "gestores_gerais"
            referencedColumns: ["id"]
          },
        ]
      }
      gestores_gerais_unidades: {
        Row: {
          created_at: string
          gestor_geral_id: string
          id: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          gestor_geral_id: string
          id?: string
          unidade_id: string
        }
        Update: {
          created_at?: string
          gestor_geral_id?: string
          id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestores_gerais_unidades_gestor_geral_id_fkey"
            columns: ["gestor_geral_id"]
            isOneToOne: false
            referencedRelation: "gestores_gerais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestores_gerais_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_unidades_resumo"
            referencedColumns: ["unidade_id"]
          },
          {
            foreignKeyName: "gestores_gerais_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
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
      log_mudanca_plano: {
        Row: {
          alterado_em: string
          alterado_por: string
          id: string
          motivo: string
          plano_anterior_id: string | null
          plano_novo_id: string | null
          profissional_id: string
        }
        Insert: {
          alterado_em?: string
          alterado_por: string
          id?: string
          motivo: string
          plano_anterior_id?: string | null
          plano_novo_id?: string | null
          profissional_id: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string
          id?: string
          motivo?: string
          plano_anterior_id?: string | null
          plano_novo_id?: string | null
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_mudanca_plano_plano_anterior_id_fkey"
            columns: ["plano_anterior_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_evolucao_mensal_planos"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "log_mudanca_plano_plano_anterior_id_fkey"
            columns: ["plano_anterior_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_profissionais_por_plano"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "log_mudanca_plano_plano_anterior_id_fkey"
            columns: ["plano_anterior_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_mudanca_plano_plano_novo_id_fkey"
            columns: ["plano_novo_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_evolucao_mensal_planos"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "log_mudanca_plano_plano_novo_id_fkey"
            columns: ["plano_novo_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_profissionais_por_plano"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "log_mudanca_plano_plano_novo_id_fkey"
            columns: ["plano_novo_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_mudanca_plano_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      log_transferencia_unidade: {
        Row: {
          contratante_destino_id: string
          contratante_destino_nome_snapshot: string | null
          contratante_origem_id: string | null
          contratante_origem_nome_snapshot: string | null
          id: string
          justificativa: string
          transferido_em: string
          transferido_por: string
          unidade_id: string
        }
        Insert: {
          contratante_destino_id: string
          contratante_destino_nome_snapshot?: string | null
          contratante_origem_id?: string | null
          contratante_origem_nome_snapshot?: string | null
          id?: string
          justificativa: string
          transferido_em?: string
          transferido_por: string
          unidade_id: string
        }
        Update: {
          contratante_destino_id?: string
          contratante_destino_nome_snapshot?: string | null
          contratante_origem_id?: string | null
          contratante_origem_nome_snapshot?: string | null
          id?: string
          justificativa?: string
          transferido_em?: string
          transferido_por?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_transferencia_unidade_contratante_destino_id_fkey"
            columns: ["contratante_destino_id"]
            isOneToOne: false
            referencedRelation: "contratantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_transferencia_unidade_contratante_origem_id_fkey"
            columns: ["contratante_origem_id"]
            isOneToOne: false
            referencedRelation: "contratantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_transferencia_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_unidades_resumo"
            referencedColumns: ["unidade_id"]
          },
          {
            foreignKeyName: "log_transferencia_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
          is_rascunho: boolean
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
          whatsapp: string | null
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
          is_rascunho?: boolean
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
          whatsapp?: string | null
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
          is_rascunho?: boolean
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
          whatsapp?: string | null
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
            referencedRelation: "mv_admin_unidades_resumo"
            referencedColumns: ["unidade_id"]
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
          is_rascunho: boolean
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
          is_rascunho?: boolean
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
          is_rascunho?: boolean
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
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          cursos_inclusos: string[]
          id: string
          laudos_por_mes: number
          link_pagamento_asaas: string | null
          nome: string
          ordem: number
          pacientes_max: number | null
          preco_mensal: number
          slug: string
          suporte: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          cursos_inclusos?: string[]
          id?: string
          laudos_por_mes: number
          link_pagamento_asaas?: string | null
          nome: string
          ordem: number
          pacientes_max?: number | null
          preco_mensal: number
          slug: string
          suporte: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          cursos_inclusos?: string[]
          id?: string
          laudos_por_mes?: number
          link_pagamento_asaas?: string | null
          nome?: string
          ordem?: number
          pacientes_max?: number | null
          preco_mensal?: number
          slug?: string
          suporte?: string
          updated_at?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          acesso_revogado: boolean
          acesso_revogado_em: string | null
          acesso_revogado_por: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          cidade: string | null
          created_at: string
          crm: string | null
          data_inicio_assinatura: string | null
          especialidade: string | null
          estado: string | null
          id: string
          identificador_padrao: string | null
          idioma: string | null
          laudos_limite: number
          laudos_usados: number
          motivo_revogacao: string | null
          nome: string
          pais: string | null
          perfil_clinico: string | null
          perfil_institucional: string | null
          periodo_renovacao: string | null
          plano: string
          plano_expira_em: string | null
          plano_id: string
          plano_status: string
          proxima_renovacao: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          telefone: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acesso_revogado?: boolean
          acesso_revogado_em?: string | null
          acesso_revogado_por?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cidade?: string | null
          created_at?: string
          crm?: string | null
          data_inicio_assinatura?: string | null
          especialidade?: string | null
          estado?: string | null
          id?: string
          identificador_padrao?: string | null
          idioma?: string | null
          laudos_limite?: number
          laudos_usados?: number
          motivo_revogacao?: string | null
          nome: string
          pais?: string | null
          perfil_clinico?: string | null
          perfil_institucional?: string | null
          periodo_renovacao?: string | null
          plano?: string
          plano_expira_em?: string | null
          plano_id: string
          plano_status?: string
          proxima_renovacao?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acesso_revogado?: boolean
          acesso_revogado_em?: string | null
          acesso_revogado_por?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cidade?: string | null
          created_at?: string
          crm?: string | null
          data_inicio_assinatura?: string | null
          especialidade?: string | null
          estado?: string | null
          id?: string
          identificador_padrao?: string | null
          idioma?: string | null
          laudos_limite?: number
          laudos_usados?: number
          motivo_revogacao?: string | null
          nome?: string
          pais?: string | null
          perfil_clinico?: string | null
          perfil_institucional?: string | null
          periodo_renovacao?: string | null
          plano?: string
          plano_expira_em?: string | null
          plano_id?: string
          plano_status?: string
          proxima_renovacao?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_acesso_revogado_por_fkey"
            columns: ["acesso_revogado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_evolucao_mensal_planos"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "profissionais_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_profissionais_por_plano"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "profissionais_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_unidades_resumo"
            referencedColumns: ["unidade_id"]
          },
          {
            foreignKeyName: "profissionais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_atendimento: {
        Row: {
          created_at: string
          id: string
          paciente_id: string
          profissional_crm: string | null
          profissional_especialidade: string | null
          profissional_id: string
          profissional_nome: string
          recurso_id: string | null
          recurso_tipo: string | null
          tipo_operacao: string
          unidade_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          paciente_id: string
          profissional_crm?: string | null
          profissional_especialidade?: string | null
          profissional_id: string
          profissional_nome: string
          recurso_id?: string | null
          recurso_tipo?: string | null
          tipo_operacao: string
          unidade_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          paciente_id?: string
          profissional_crm?: string | null
          profissional_especialidade?: string | null
          profissional_id?: string
          profissional_nome?: string
          recurso_id?: string | null
          recurso_tipo?: string | null
          tipo_operacao?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_atendimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_atendimento_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_atendimento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "mv_admin_unidades_resumo"
            referencedColumns: ["unidade_id"]
          },
          {
            foreignKeyName: "registros_atendimento_unidade_id_fkey"
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
          gestor_id: string | null
          id: string
          metricas_resumo: Json | null
          origem: string
          periodo_fim: string
          periodo_inicio: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          arquivo_path: string
          arquivo_tamanho_bytes?: number | null
          created_at?: string
          gestor_id?: string | null
          id?: string
          metricas_resumo?: Json | null
          origem?: string
          periodo_fim: string
          periodo_inicio: string
          tipo?: string
          unidade_id: string
        }
        Update: {
          arquivo_path?: string
          arquivo_tamanho_bytes?: number | null
          created_at?: string
          gestor_id?: string | null
          id?: string
          metricas_resumo?: Json | null
          origem?: string
          periodo_fim?: string
          periodo_inicio?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: []
      }
      tipos_unidade: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          ativa: boolean
          cidade: string | null
          cnes: string | null
          contratante_id: string
          created_at: string
          estado: string | null
          id: string
          nome: string
          pais: string | null
          plano_expira_em: string | null
          plano_status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tipo: string | null
          tipo_id: string | null
        }
        Insert: {
          ativa?: boolean
          cidade?: string | null
          cnes?: string | null
          contratante_id: string
          created_at?: string
          estado?: string | null
          id?: string
          nome: string
          pais?: string | null
          plano_expira_em?: string | null
          plano_status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo?: string | null
          tipo_id?: string | null
        }
        Update: {
          ativa?: boolean
          cidade?: string | null
          cnes?: string | null
          contratante_id?: string
          created_at?: string
          estado?: string | null
          id?: string
          nome?: string
          pais?: string | null
          plano_expira_em?: string | null
          plano_status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo?: string | null
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_contratante_id_fkey"
            columns: ["contratante_id"]
            isOneToOne: false
            referencedRelation: "contratantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_unidade"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      mv_admin_alertas_operacionais: {
        Row: {
          tipo_alerta: string | null
          total: number | null
        }
        Relationships: []
      }
      mv_admin_distribuicao_geografica: {
        Row: {
          cidade: string | null
          estado: string | null
          pais: string | null
          total_profissionais: number | null
          total_unidades: number | null
        }
        Relationships: []
      }
      mv_admin_evolucao_mensal_planos: {
        Row: {
          mes: string | null
          novos: number | null
          plano_id: string | null
          plano_nome: string | null
          plano_slug: string | null
        }
        Relationships: []
      }
      mv_admin_evolucao_mensal_profissionais: {
        Row: {
          mes: string | null
          novos_profissionais: number | null
          profissionais_ativos: number | null
        }
        Relationships: []
      }
      mv_admin_profissionais_por_plano: {
        Row: {
          ativos_30d: number | null
          ordem: number | null
          plano_id: string | null
          plano_nome: string | null
          plano_slug: string | null
          preco_mensal: number | null
          total: number | null
        }
        Relationships: []
      }
      mv_admin_resumo_global: {
        Row: {
          atualizado_em: string | null
          singleton: number | null
          total_consolidacoes: number | null
          total_gestores_gerais: number | null
          total_profissionais: number | null
          total_unidades: number | null
        }
        Relationships: []
      }
      mv_admin_top_cidades: {
        Row: {
          cidade: string | null
          estado: string | null
          pais: string | null
          posicao: number | null
          total_profissionais: number | null
        }
        Relationships: []
      }
      mv_admin_unidades_resumo: {
        Row: {
          ativa: boolean | null
          cidade: string | null
          estado: string | null
          nome: string | null
          pais: string | null
          tipo: string | null
          total_laudos: number | null
          total_pacientes: number | null
          total_profissionais: number | null
          unidade_id: string | null
        }
        Relationships: []
      }
      mv_profissionais_ativos_30d: {
        Row: {
          profissional_id: string | null
          ultima_acao: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      belongs_to_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      carimbar_atendimento: {
        Args: {
          p_paciente_id: string
          p_recurso_id?: string
          p_recurso_tipo?: string
          p_tipo_operacao: string
        }
        Returns: string
      }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      gestor_da_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      gestor_geral_tem_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_gestor_geral: { Args: { _user_id: string }; Returns: boolean }
      metricas_diagnosticos_admin: { Args: never; Returns: Json }
      pode_criar_ficha: {
        Args: { p_profissional_id: string }
        Returns: boolean
      }
      pode_gerar_laudo: { Args: { p_profissional_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor_geral"
        | "gestor"
        | "institucional"
        | "consultorio"
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
      app_role: [
        "admin",
        "gestor_geral",
        "gestor",
        "institucional",
        "consultorio",
      ],
    },
  },
} as const
