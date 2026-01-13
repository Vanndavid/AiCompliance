import { Paper, Typography, List, ListItem, ListItemText } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Box } from '@mui/material';
import type { NotificationItem } from '../types';

interface Props {
  notifications: NotificationItem[];
  onRead: (id: string) => void;
}

const demoNotifications: NotificationItem[] = [
  {
    _id: 'demo-1',
    type: 'EXPIRY_WARNING',
    message: 'White Card expires in 14 days',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'demo-2',
    type: 'SYSTEM_INFO',
    message: 'Insurance document pending review',
    createdAt: new Date().toISOString(),
  },
];




export const NotificationPanel = ({ notifications, onRead }: Props) => {
  if (notifications.length === 0) return null;
  const dataToRender =notifications;
  const markRead = async (id: string) => {
    await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
      method: 'PATCH'
    });
    onRead(id);
  };
  return (
    <Paper sx={{ p: 2, mb: 4, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
      <Typography
        variant="h6"
        color="warning.dark"
        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
      >
        <ErrorIcon sx={{ mr: 1 }} /> Compliance Alerts
      </Typography>

      <List dense>
        {dataToRender.map((notif) => (
          <ListItem key={notif._id} 
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="mark as read"
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // ⛔ prevent row click
                  markRead(notif._id);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={notif.message}
              secondary={new Date(notif.createdAt).toLocaleTimeString()}
            />
          </ListItem>
        ))}
      </List>

      {notifications.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Demo data shown
        </Typography>
      )}
    </Paper>
  );
};
