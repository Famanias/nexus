import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';

interface InvitationEmailProps {
  orgName: string;
  role: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: string;
  email: string;
}

export const InvitationEmail = ({
  orgName = 'Nexus Organization',
  role = 'OJT',
  inviterName = 'Administrator',
  inviteUrl = 'http://localhost:3000/invite/placeholder',
  expiresAt = '7 days',
  email = 'recipient@example.com',
}: InvitationEmailProps) => {
  const previewText = `Join ${orgName} on Nexus`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Heading style={h1Style}>🌌 Nexus</Heading>
          <Text style={textStyle}>
            Hello,
          </Text>
          <Text style={textStyle}>
            <strong>{inviterName}</strong> has invited you to join <strong>{orgName}</strong> as a <strong>{role.toUpperCase()}</strong> on Nexus.
          </Text>
          <Section style={btnContainerStyle}>
            <Button style={buttonStyle} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>
          <Text style={textStyle}>
            If the button doesn&apos;t work, copy and paste this link into your browser:
          </Text>
          <Link href={inviteUrl} style={linkStyle}>
            {inviteUrl}
          </Link>
          <Hr style={hrStyle} />
          <Text style={footerTextStyle}>
            This invitation was sent to <strong>{email}</strong> and is intended only for this recipient. It will expire on {expiresAt}.
          </Text>
          <Text style={footerTextStyle}>
            Nexus — Connecting Students, Supervisors, and Success.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InvitationEmail;

const mainStyle = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const containerStyle = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '580px',
};

const h1Style = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
  letterSpacing: '1px',
};

const textStyle = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '26px',
};

const btnContainerStyle = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const buttonStyle = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const linkStyle = {
  color: '#6366f1',
  fontSize: '14px',
  wordBreak: 'break-all' as const,
};

const hrStyle = {
  borderColor: '#e2e8f0',
  margin: '30px 0',
};

const footerTextStyle = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '20px',
};
