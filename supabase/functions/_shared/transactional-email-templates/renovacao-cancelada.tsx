/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Confirmação para a profissional que pediu para NÃO renovar o plano.

interface Props {
  nomeProfissional?: string
  nomePlano?: string
  acessoAteFormatado?: string
  pedidoEmFormatado?: string
  dentroGarantia?: boolean
  linkRenovar?: string
  emailSuporte?: string
}

const Email = ({
  nomeProfissional, nomePlano, acessoAteFormatado, pedidoEmFormatado,
  dentroGarantia, linkRenovar, emailSuporte,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recebemos seu pedido: seu plano MARI não será renovado</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>MARI</Heading>
        <Heading style={h1}>Seu plano não será renovado</Heading>
        <Text style={text}>
          Olá, {nomeProfissional || 'profissional'}. Recebemos o seu pedido para
          não renovar o plano da MARI.
        </Text>

        <Section style={card}>
          <Text style={label}>Plano</Text>
          <Text style={value}>{nomePlano || '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Você continua usando a MARI até</Text>
          <Text style={value}>{acessoAteFormatado || '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Pedido feito em</Text>
          <Text style={value}>{pedidoEmFormatado || '—'}</Text>
        </Section>

        <Text style={textStrong}>O que muda (e o que não muda)</Text>
        <Text style={text}>
          • O plano da MARI é uma anuidade: o ano atual já está contratado.
          Este pedido cancela a <strong>renovação</strong>, não o ano em curso.
        </Text>
        <Text style={text}>
          • Se você pagou no cartão parcelado, as parcelas que faltam continuam
          sendo cobradas normalmente até a última.
        </Text>
        <Text style={text}>
          • Você continua com acesso completo até {acessoAteFormatado || 'o fim do período contratado'}.
          Depois dessa data, o acesso é encerrado e nenhuma cobrança nova é feita.
        </Text>

        {dentroGarantia && (
          <Section style={cardGarantia}>
            <Text style={textGarantia}>
              Sua compra tem menos de 7 dias. Pelo direito de arrependimento
              (Código de Defesa do Consumidor, art. 49), você pode receber o
              reembolso integral. Nossa equipe vai entrar em contato para fazer
              o estorno. Com o estorno, o acesso é encerrado.
            </Text>
          </Section>
        )}

        <Text style={text}>
          Mudou de ideia? É só renovar pelo app, em Meu perfil → Meu plano.
        </Text>
        {linkRenovar && (
          <Button href={linkRenovar} style={button}>Abrir Meu plano</Button>
        )}

        <Text style={footer}>
          Dúvidas? Escreva para {emailSuporte || 'a equipe MARI'}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '[MARI] Recebemos seu pedido: plano não será renovado',
  displayName: 'Renovação cancelada (profissional)',
  previewData: {
    nomeProfissional: 'Dra. Exemplo',
    nomePlano: 'Intermediária',
    acessoAteFormatado: '10/10/2027',
    pedidoEmFormatado: '16/10/2026',
    dentroGarantia: true,
    linkRenovar: 'https://maridmg.com.br/perfil',
    emailSuporte: 'SuporteMari@novodmg.com.br',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '14px', fontWeight: 'bold' as const, color: '#9b87f5', letterSpacing: '2px', margin: '0 0 24px' }
const h1 = { fontFamily: 'Sora, "Plus Jakarta Sans", Arial, sans-serif', fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 12px' }
const textStrong = { ...text, color: '#1e293b', fontWeight: 'bold' as const, margin: '8px 0 8px' }
const card = { backgroundColor: '#F5F0FF', borderRadius: '12px', padding: '16px 20px', margin: '0 0 20px' }
const cardGarantia = { backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '12px 16px', margin: '8px 0 20px' }
const textGarantia = { fontSize: '13px', color: '#92400E', lineHeight: '1.6', margin: 0 }
const label = { fontSize: '11px', color: '#7E69AB', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 4px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#1e293b', margin: '0 0 4px', lineHeight: '1.5' }
const hr = { borderColor: '#E9E3FA', margin: '12px 0' }
const button = { backgroundColor: '#7E69AB', color: '#ffffff', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', margin: '4px 0 8px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
