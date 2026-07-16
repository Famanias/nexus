import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Button,
  Section,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface TaskCompletedEmailProps {
  creatorName: string;
  taskTitle: string;
  completedByName: string;
  taskUrl: string;
}

export const TaskCompletedEmail = ({
  creatorName = 'Supervisor',
  taskTitle = 'Unknown Task',
  completedByName = 'An OJT',
  taskUrl = 'https://nexxus.lol/dashboard/kanban',
}: TaskCompletedEmailProps) => {
  const previewText = `Task Completed: ${taskTitle}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Task Completed 🎉</Heading>
          
          <Text style={text}>
            Hello {creatorName},
          </Text>
          
          <Text style={text}>
            Good news! <strong>{completedByName}</strong> has just completed a task you created on the Kanban board.
          </Text>

          <Section style={taskBox}>
            <Text style={taskTitleText}>{taskTitle}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={taskUrl}>
              View Kanban Board
            </Button>
          </Section>

          <Hr style={hr} />
          
          <Text style={footer}>
            You are receiving this email because you are the creator of this task.
            <br />
            Nexus Automation System
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default TaskCompletedEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  marginTop: '40px',
  maxWidth: '600px',
};

const h1 = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 20px',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const taskBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const taskTitleText = {
  color: '#166534',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 0 24px',
};

const footer = {
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: '22px',
  textAlign: 'center' as const,
};
