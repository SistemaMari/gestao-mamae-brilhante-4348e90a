/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no MARI</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>MARI</Heading>
        <Heading style={h1}>Confirme seu e-mail</Heading>
        <Text style={text}>
          Boas-vindas ao{' '}
          <Link href={siteUrl} style={link}>
            <strong>MARI | Inteligência Clínica</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Para ativar sua conta (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ), confirme seu e-mail clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar e-mail
        </Button>
        <Text style={footer}>
          Se você não criou uma conta no MARI, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#9b87f5',
  letterSpacing: '2px',
  margin: '0 0 24px',
}
const h1 = {
  fontFamily: 'Sora, "Plus Jakarta Sans", Arial, sans-serif',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1e293b',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#7E69AB', textDecoration: 'underline' }
const button = {
  backgroundColor: '#9b87f5',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', lineHeight: '1.5' }
