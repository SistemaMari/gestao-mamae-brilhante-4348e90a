import type * as React from 'npm:react@18.3.1'
import { template as feedbackRecebido } from './feedback-recebido.tsx'
import { template as planoAnualAcabando } from './plano-anual-acabando.tsx'
import { template as acessoLiberado } from './acesso-liberado.tsx'
import { template as renovacaoCancelada } from './renovacao-cancelada.tsx'
import { template as naoRenovacaoEquipe } from './nao-renovacao-equipe.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'feedback-recebido': feedbackRecebido,
  'plano-anual-acabando': planoAnualAcabando,
  'acesso-liberado': acessoLiberado,
  'renovacao-cancelada': renovacaoCancelada,
  'nao-renovacao-equipe': naoRenovacaoEquipe,
}
