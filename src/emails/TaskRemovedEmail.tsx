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

interface TaskRemovedEmailProps {
  title?: string;
  deletedByName?: string;
  userEmail: string;
  kanbanUrl?: string;
}

export const TaskRemovedEmail = ({
  title = 'Task',
  deletedByName = 'A team member',
  userEmail = 'user@example.com',
  kanbanUrl = 'https://nexxus.lol/dashboard/kanban',
}: TaskRemovedEmailProps) => {
  const previewText = `Task "${title}" was removed`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Heading style={h1Style}>🗑️ Task Removed</Heading>
          <Text style={textStyle}>
            Hello,
          </Text>
          <Text style={textStyle}>
            The task <strong>&quot;{title}&quot;</strong> was removed by <strong>{deletedByName}</strong> on the Kanban board.
          </Text>
          <Section style={btnContainerStyle}>
            <Button style={buttonStyle} href={kanbanUrl}>
              Open Kanban Board
            </Button>
          </Section>
          <Hr style={hrStyle} />
          <Text style={footerTextStyle}>
            This notification was sent to <strong>{userEmail}</strong>.
          </Text>
          <Text style={footerTextStyle}>
            Nexus — Connecting Students, Supervisors, and Success.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default TaskRemovedEmail;

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

const btnContainerStyle = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const buttonStyle = {
  backgroundColor: '#64748b',
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
