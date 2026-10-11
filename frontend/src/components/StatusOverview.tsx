import { Box, Paper, Typography } from '@mui/material';
import type { CrewOverviewTotals } from '../types';

interface Props {
  totals: CrewOverviewTotals | null;
}

const Stat = ({
  value,
  label,
  emphasis,
}: {
  value: number;
  label: string;
  emphasis?: 'danger' | 'warn' | 'ok';
}) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      borderColor:
        emphasis === 'danger' ? 'error.main' : emphasis === 'warn' ? 'warning.main' : 'divider',
    }}
  >
    <Typography
      variant="h4"
      fontWeight={800}
      lineHeight={1.1}
      color={
        emphasis === 'danger'
          ? 'error.main'
          : emphasis === 'warn'
            ? 'warning.dark'
            : emphasis === 'ok'
              ? 'success.main'
              : 'text.primary'
      }
    >
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary" mt={0.5}>
      {label}
    </Typography>
  </Paper>
);

export const StatusOverview = ({ totals }: Props) => {
  const counts = totals ?? {
    blocked: 0,
    expired: 0,
    notCompliant: 0,
    expiringSoon: 0,
    allValid: 0,
    needsHuman: 0,
    processing: 0,
    failed: 0,
    people: 0,
    organisations: 0,
    documents: 0,
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 3,
      }}
    >
      <Stat value={counts.blocked} label="Cannot go on site" emphasis="danger" />
      <Stat value={counts.expiringSoon} label="Expiring this week" emphasis="warn" />
      <Stat value={counts.needsHuman} label="Needs your check" emphasis="warn" />
      <Stat value={counts.allValid} label="All valid" emphasis="ok" />
    </Box>
  );
};
