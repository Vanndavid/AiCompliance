import { Button, Paper, Typography, List, ListItem, ListItemText, IconButton, Box, Stack } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import type { NotificationItem } from '../types';
import { api } from '../api/client';
import { useState } from 'react';

interface Props {
  notifications: NotificationItem[];
  onRead: (id: string) => void;
  onReminded: (id: string) => void;
}

export const NotificationPanel = ({ notifications, onRead, onReminded }: Props) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (notifications.length === 0) return null;

  const markRead = async (id: string) => {
    await api.patch(`/api/notifications/${id}/read`);
    onRead(id);
  };

  const remind = async (notif: NotificationItem) => {
    setBusyId(notif.id);
    try {
      const res = await api.post<{ mailto?: string; channel?: string }>(
        `/api/notifications/${notif.id}/remind`,
      );
      onReminded(notif.id);
      if (res.data.channel !== 'smtp' && res.data.mailto) {
        window.location.href = res.data.mailto;
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
      <Typography
        variant="h6"
        color="warning.dark"
        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
      >
        <ErrorIcon sx={{ mr: 1 }} /> Who needs a reminder
      </Typography>

      <List dense>
        {notifications.map(notif => (
          <ListItem
            key={notif.id}
            alignItems="flex-start"
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="dismiss"
                size="small"
                onClick={() => {
                  void markRead(notif.id);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={notif.message}
              secondary={
                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {notif.emailSentAt ? 'Reminder sent' : 'Not notified yet'}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    disabled={busyId === notif.id}
                    onClick={() => void remind(notif)}
                  >
                    {busyId === notif.id ? 'Sending…' : 'Remind'}
                  </Button>
                </Stack>
              }
            />
          </ListItem>
        ))}
      </List>
      <Box mt={1}>
        <Typography variant="caption" color="text.secondary">
          Remind sends email to the worker if you have their address, otherwise to you.
        </Typography>
      </Box>
    </Paper>
  );
};
