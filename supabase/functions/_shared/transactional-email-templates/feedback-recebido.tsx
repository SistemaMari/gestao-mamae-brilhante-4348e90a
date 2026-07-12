/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  tipo?: string
  autorNome?: string
  autorEmail?: string
  mensagem?: string
  anexoUrl?: string | null
}

const TIPO_LABEL: Record<string, string> = {
  sugestao: 'Sugestão',
  elogio: 'Elogio',
  erro: 'Reportar erro',
  duvida: 'Dúvida',
}

const Email = ({ tipo, autorNome, autorEmail, mensagem, anexoUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo feedback recebido no MARI</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>MARI</Heading>
        <Heading style={h1}>Novo feedback recebido</Heading>
        <Text style={text}>
          Um usuário enviou um feedback pelo perfil do MARI.
        </Text>

        <Section style={card}>
          <Text style={label}>Tipo</Text>
          <Text style={value}>{tipo ? (TIPO_LABEL[tipo] || tipo) : '—'}</Text>

          <Hr style={hr} />

          <Text style={label}>De</Text>
          <Text style={value}>
            {autorNome || 'Usuário'}{autorEmail ? ` — ${autorEmail}` : ''}
          </Text>

          <Hr style={hr} />

          <Text style={label}>Mensagem</Text>
          <Text style={{ ...value, whiteSpace: 'pre-wrap' as const }}>
            {mensagem || '—'}
          </Text>

          {anexoUrl && (
            <>
              <Hr style={hr} />
              <Text style={label}>Anexo</Text>
              <Text style={value}>{anexoUrl}</Text>
            </>
          )}
        </Section>

        <Text style={footer}>
          Acesse o painel admin do MARI para gerenciar este feedback.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `[MARI] Novo feedback — ${d?.tipo ? (TIPO_LABEL[d.tipo] || d.tipo) : 'usuário'}`,
  displayName: 'Feedback recebido',
  previewData: {
    tipo: 'sugestao',
    autorNome: 'Dra. Exemplo',
    autorEmail: 'exemplo@dramari.com',
    mensagem: 'Seria ótimo ter atalho de teclado para salvar a ficha.',
    anexoUrl: null,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '14px', fontWeight: 'bold' as const, color: '#9b87f5', letterSpacing: '2px', margin: '0 0 24px' }
const h1 = { fontFamily: 'Sora, "Plus Jakarta Sans", Arial, sans-serif', fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#F5F0FF', borderRadius: '12px', padding: '16px 20px', margin: '0 0 24px' }
const label = { fontSize: '11px', color: '#7E69AB', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 4px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#1e293b', margin: '0 0 4px', lineHeight: '1.5' }
const hr = { borderColor: '#E9E3FA', margin: '12px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
