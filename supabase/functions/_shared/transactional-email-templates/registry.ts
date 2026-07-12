import type * as React from 'npm:react@18.3.1'
import { template as feedbackRecebido } from './feedback-recebido.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'feedback-recebido': feedbackRecebido,
}
