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

interface ReportApprovedEmailProps {
  title: string;
  studentName?: string;
  studentEmail?: string;
  approvedByName?: string;
  feedback?: string;
  reportsUrl?: string;
}

export const ReportApprovedEmail = ({
  title = 'Weekly Report',
  studentName = 'Student',
  studentEmail = 'student@example.com',
  approvedByName = 'Supervisor',
  feedback,
  reportsUrl = 'https://nexxus.lol/dashboard/reports',
}: ReportApprovedEmailProps) => {
  const previewText = `Your report "${title}" has been approved!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Heading style={h1Style}>🎉 Report Approved!</Heading>
          <Text style={textStyle}>
            Hello <strong>{studentName}</strong>,
          </Text>
          <Text style={textStyle}>
            Great news! Your report <strong>&quot;{title}&quot;</strong> has been approved by <strong>{approvedByName}</strong>.
          </Text>
          {feedback && (
            <Text style={feedbackBoxStyle}>
              <strong>Supervisor Feedback:</strong> &quot;{feedback}&quot;
            </Text>
          )}
          <Section style={btnContainerStyle}>
            <Button style={buttonStyle} href={reportsUrl}>
              View Reports
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

export default ReportApprovedEmail;

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

const feedbackBoxStyle = {
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #22c55e',
  padding: '12px 16px',
  color: '#15803d',
  fontSize: '15px',
  margin: '20px 0',
};

const btnContainerStyle = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const buttonStyle = {
  backgroundColor: '#22c55e',
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
