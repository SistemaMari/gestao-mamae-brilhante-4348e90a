/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nomeProfissional?: string
  nomePlano?: string
  dataFimFormatada?: string
  linkRenovar?: string
}

// Enviado 60 dias antes do fim do ano pago (verificar-inadimplencia). A MARI
// não renova sozinha: sem renovar, o acesso termina na data.
const Email = ({ nomeProfissional, nomePlano, dataFimFormatada, linkRenovar }: Props) => (
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

          <Text style={label}>Seu plano vale até</Text>
          <Text style={value}>{dataFimFormatada || '—'}</Text>
        </Section>

        <Text style={text}>
          A renovação não é automática: nenhuma cobrança nova é feita sem você
          pedir. Para continuar usando a MARI sem interrupção, renove pelo app,
          em Meu perfil → Meu plano → Renovar. Se você renovar antes do
          vencimento, o novo ano começa só quando o atual terminar: você não
          perde nenhum dia.
        </Text>
        {linkRenovar && (
          <Button href={linkRenovar} style={button}>Renovar meu plano</Button>
        )}
        <Text style={text}>
          Não quer renovar? Avise pelo mesmo lugar (Meu perfil → Meu plano →
          Não quero renovar). Sem renovação, o acesso termina em
          {' '}{dataFimFormatada || 'a data acima'}.
        </Text>

        <Text style={footer}>
          Dúvidas sobre a renovação? Responda este e-mail ou escreva para
          SuporteMari@novodmg.com.br.
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
    linkRenovar: 'https://maridmg.com.br/perfil',
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
const button = { backgroundColor: '#7E69AB', color: '#ffffff', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', margin: '0 0 20px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
