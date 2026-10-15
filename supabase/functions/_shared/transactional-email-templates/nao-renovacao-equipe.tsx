/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Aviso interno (suporte/comercial): uma profissional pediu para não renovar.

interface Props {
  nomeProfissional?: string
  emailProfissional?: string
  telefone?: string
  nomePlano?: string
  mesDeUso?: number
  acessoAteFormatado?: string
  motivo?: string
  comentario?: string
  dentroGarantia?: boolean
}

const Email = ({
  nomeProfissional, emailProfissional, telefone, nomePlano, mesDeUso,
  acessoAteFormatado, motivo, comentario, dentroGarantia,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`${nomeProfissional || 'Profissional'} pediu para não renovar`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>MARI · EQUIPE</Heading>
        <Heading style={h1}>Pedido de não renovação</Heading>

        {dentroGarantia && (
          <Section style={cardGarantia}>
            <Text style={textGarantia}>
              ⚠️ Pedido dentro dos 7 dias da compra: a cliente tem direito ao
              reembolso integral (CDC art. 49). Fazer o estorno no Asaas. O
              acesso é encerrado sozinho quando o estorno é confirmado.
            </Text>
          </Section>
        )}

        <Section style={card}>
          <Text style={label}>Profissional</Text>
          <Text style={value}>{nomeProfissional || '—'}</Text>
          <Text style={value}>{emailProfissional || '—'}{telefone ? ` · ${telefone}` : ''}</Text>
          <Hr style={hr} />
          <Text style={label}>Plano</Text>
          <Text style={value}>{nomePlano || '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Mês de uso no pedido</Text>
          <Text style={value}>{mesDeUso ? `${mesDeUso}º mês de 12` : '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Acesso até</Text>
          <Text style={value}>{acessoAteFormatado || '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Motivo</Text>
          <Text style={value}>{motivo || 'Não informado'}</Text>
          {comentario && <Text style={value}>“{comentario}”</Text>}
        </Section>

        <Text style={footer}>Lista completa em Admin → Renovações.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `[MARI] ${d?.dentroGarantia ? 'REEMBOLSO 7 DIAS · ' : ''}Não renovação: ${d?.nomeProfissional || 'profissional'}`,
  displayName: 'Não renovação (aviso à equipe)',
  previewData: {
    nomeProfissional: 'Dra. Exemplo',
    emailProfissional: 'dra.exemplo@email.com',
    telefone: '(11) 99999-0000',
    nomePlano: 'Intermediária',
    mesDeUso: 5,
    acessoAteFormatado: '10/10/2027',
    motivo: 'Não estou usando',
    comentario: 'Mudei de cidade.',
    dentroGarantia: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '14px', fontWeight: 'bold' as const, color: '#9b87f5', letterSpacing: '2px', margin: '0 0 24px' }
const h1 = { fontFamily: 'Sora, "Plus Jakarta Sans", Arial, sans-serif', fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const card = { backgroundColor: '#F5F0FF', borderRadius: '12px', padding: '16px 20px', margin: '0 0 20px' }
const cardGarantia = { backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '12px 16px', margin: '0 0 20px' }
const textGarantia = { fontSize: '13px', color: '#92400E', lineHeight: '1.6', margin: 0 }
const label = { fontSize: '11px', color: '#7E69AB', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 4px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#1e293b', margin: '0 0 4px', lineHeight: '1.5' }
const hr = { borderColor: '#E9E3FA', margin: '12px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
