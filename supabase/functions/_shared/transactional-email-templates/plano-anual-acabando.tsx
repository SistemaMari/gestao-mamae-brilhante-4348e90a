/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nomeProfissional?: string
  nomePlano?: string
  dataFimFormatada?: string
}

const Email = ({ nomeProfissional, nomePlano, dataFimFormatada }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu plano anual do MARI está chegando ao fim</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>MARI</Heading>
        <Heading style={h1}>Seu plano anual está acabando</Heading>
        <Text style={text}>
          Olá, {nomeProfissional || 'profissional'}. Este é um aviso de que o
          ciclo anual do seu plano no MARI está chegando ao fim.
        </Text>

        <Section style={card}>
          <Text style={label}>Plano</Text>
          <Text style={value}>{nomePlano || '—'}</Text>

          <Hr style={hr} />

          <Text style={label}>Última cobrança prevista</Text>
          <Text style={value}>{dataFimFormatada || '—'}</Text>
        </Section>

        <Text style={text}>
          Após essa data, nenhuma nova cobrança será gerada automaticamente e
          o acesso à ferramenta será encerrado ao fim do período já pago. Para
          continuar usando o MARI sem interrupção, entre em contato com a
          nossa equipe para renovar o seu plano.
        </Text>

        <Text style={footer}>
          Dúvidas sobre a renovação? Responda este e-mail que a equipe MARI te ajuda.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '[MARI] Seu plano anual está acabando',
  displayName: 'Plano anual acabando',
  previewData: {
    nomeProfissional: 'Dra. Exemplo',
    nomePlano: 'Inicial',
    dataFimFormatada: '15/09/2026',
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
