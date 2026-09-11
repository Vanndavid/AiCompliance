import { Grid, Paper, Typography } from '@mui/material';
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
      height: '100%',
      borderColor:
        emphasis === 'danger' ? 'error.light' : emphasis === 'warn' ? 'warning.light' : 'divider',
      bgcolor:
        emphasis === 'danger'
          ? 'error.50'
          : emphasis === 'warn'
            ? 'warning.50'
            : emphasis === 'ok'
              ? 'success.50'
              : 'background.paper',
    }}
  >
    <Typography variant="h4" fontWeight={800} lineHeight={1.1}>
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary" mt={0.5}>
      {label}
    </Typography>
  </Paper>
);

export const SiteReadyOverview = ({ totals }: Props) => {
  const empty = totals ?? {
    expired: 0,
    expiringSoon: 0,
    siteReady: 0,
    needsHuman: 0,
    processing: 0,
    failed: 0,
    people: 0,
    documents: 0,
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Stat value={empty.expired} label="Cannot go on site" emphasis="danger" />
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Stat value={empty.expiringSoon} label="Expiring this week" emphasis="warn" />
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Stat value={empty.needsHuman} label="Needs a human" emphasis="warn" />
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Stat value={empty.siteReady} label="Site-ready" emphasis="ok" />
      </Grid>
    </Grid>
  );
};
