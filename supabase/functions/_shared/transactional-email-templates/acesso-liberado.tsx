/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nomeProfissional?: string
  nomePlano?: string
  email?: string
  validadeFormatada?: string
  linkCriarSenha?: string
  linkLogin?: string
}

const Email = ({ nomeProfissional, nomePlano, email, validadeFormatada, linkCriarSenha, linkLogin }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pagamento confirmado: crie sua senha e entre na MARI</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>MARI</Heading>
        <Heading style={h1}>Seu acesso à MARI está liberado</Heading>
        <Text style={text}>
          Olá, {nomeProfissional || 'profissional'}. Recebemos a confirmação do seu
          pagamento. Falta só criar a sua senha para entrar.
        </Text>

        <Section style={card}>
          <Text style={label}>Seu login</Text>
          <Text style={value}>{email || '—'}</Text>

          <Hr style={hr} />

          <Text style={label}>Plano</Text>
          <Text style={value}>{nomePlano || '—'}</Text>

          {validadeFormatada ? (
            <>
              <Hr style={hr} />
              <Text style={label}>Acesso válido até</Text>
              <Text style={value}>{validadeFormatada}</Text>
            </>
          ) : null}
        </Section>

        <Button style={button} href={linkCriarSenha}>
          Criar minha senha
        </Button>

        <Text style={text}>
          Por segurança, o botão vale por tempo limitado. Se ele expirar, entre em{' '}
          {linkLogin || 'maridmg.com.br/login'}, clique em "Esqueci minha senha" e
          use este mesmo e-mail.
        </Text>

        <Text style={footer}>
          Alguma dúvida? Responda este e-mail que a equipe MARI te ajuda.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '[MARI] Seu acesso está liberado: crie sua senha',
  displayName: 'Acesso liberado (compra confirmada)',
  previewData: {
    nomeProfissional: 'Dra. Exemplo',
    nomePlano: 'Inicial',
    email: 'dra.exemplo@email.com',
    validadeFormatada: '13/10/2027',
    linkCriarSenha: 'https://maridmg.com.br/nova-senha',
    linkLogin: 'https://maridmg.com.br/login',
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
const button = { backgroundColor: '#7C4DBA', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none', margin: '0 0 24px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
