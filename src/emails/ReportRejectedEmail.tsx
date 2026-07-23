import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';

interface ReportRejectedEmailProps {
  title: string;
  studentName?: string;
  studentEmail?: string;
  rejectedByName?: string;
  reason?: string;
  reportsUrl?: string;
}

export const ReportRejectedEmail = ({
  title = 'Weekly Report',
  studentName = 'Student',
  studentEmail = 'student@example.com',
  rejectedByName = 'Supervisor',
  reason,
  reportsUrl = 'https://nexxus.lol/dashboard/reports',
}: ReportRejectedEmailProps) => {
  const previewText = `Revision requested for report "${title}"`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Heading style={h1Style}>⚠️ Report Revision Requested</Heading>
          <Text style={textStyle}>
            Hello <strong>{studentName}</strong>,
          </Text>
          <Text style={textStyle}>
            Your submitted report <strong>&quot;{title}&quot;</strong> requires changes before it can be approved by <strong>{rejectedByName}</strong>.
          </Text>
          {reason && (
            <Text style={reasonBoxStyle}>
              <strong>Feedback / Reason:</strong> &quot;{reason}&quot;
            </Text>
          )}
          <Text style={textStyle}>
            Please review the feedback, update your report, and resubmit it for review.
          </Text>
          <Section style={btnContainerStyle}>
            <Button style={buttonStyle} href={reportsUrl}>
              Edit & Resubmit Report
            </Button>
          </Section>
          <Hr style={hrStyle} />
          <Text style={footerTextStyle}>
            This notification was sent to <strong>{studentEmail}</strong>.
          </Text>
          <Text style={footerTextStyle}>
            Nexus — Connecting Students, Supervisors, and Success.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default ReportRejectedEmail;

const mainStyle = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
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

const reasonBoxStyle = {
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #ef4444',
  padding: '12px 16px',
  color: '#b91c1c',
  fontSize: '15px',
  margin: '20px 0',
};

const btnContainerStyle = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const buttonStyle = {
  backgroundColor: '#ef4444',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
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
