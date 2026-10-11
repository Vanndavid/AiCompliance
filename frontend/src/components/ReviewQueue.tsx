import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useState } from 'react';
import type { DocumentItem } from '../types';
import { ReviewDialog } from './ReviewDialog';

interface Props {
  reviews: DocumentItem[];
  onReviewed: () => Promise<void>;
}

export const ReviewQueue = ({ reviews, onReviewed }: Props) => {
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  return (
    <Card sx={{ border: '1px solid #e0e0e0', mb: 4 }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <FactCheckIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight="bold">
            Needs your check
          </Typography>
          <Chip label={reviews.length} size="small" sx={{ ml: 1 }} />
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          The AI was not confident enough to call these on its own. Open one and say whether it is
          fine or a real problem.
        </Typography>

        {reviews.length === 0 ? (
          <Typography color="text.secondary">Nothing waiting on you.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {reviews.map(doc => (
              <Box
                key={doc.id}
                sx={{ border: '1px solid #eee', borderRadius: 1, p: 1.5, cursor: 'pointer' }}
                onClick={() => setSelected(doc)}
              >
                <Typography fontWeight="bold">{doc.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {doc.extraction?.holderName || 'Unknown holder'} ·{' '}
                  {doc.evaluation?.routingReason}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        <ReviewDialog doc={selected} onClose={() => setSelected(null)} onReviewed={onReviewed} />
      </CardContent>
    </Card>
  );
};
