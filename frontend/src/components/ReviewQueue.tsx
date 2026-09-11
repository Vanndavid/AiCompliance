import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useState } from 'react';
import { api } from '../api/client';
import type { DocumentEvaluation, DocumentItem } from '../types';

interface Props {
  reviews: DocumentItem[];
  onReviewed: () => Promise<void>;
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const OutcomeSummary = ({ evaluation }: { evaluation: DocumentEvaluation }) => {
  const humanOutcome =
    evaluation.reviewStatus === 'rejected' && evaluation.overrideDecision
      ? evaluation.overrideDecision
      : evaluation.finalDecision;

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2">
        <strong>AI decision:</strong> {evaluation.llmDecision} ({formatPercent(evaluation.confidence)} confidence, {evaluation.risk} risk)
      </Typography>
      <Typography variant="body2">
        <strong>Routed as:</strong> {evaluation.finalDecision}
      </Typography>
      {evaluation.reviewStatus === 'rejected' && evaluation.overrideDecision && (
        <Typography variant="body2">
          <strong>Human override:</strong> {evaluation.overrideDecision}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        Effective outcome: {humanOutcome}
      </Typography>
    </Stack>
  );
};

export const ReviewQueue = ({ reviews, onReviewed }: Props) => {
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluation = selected?.evaluation ?? null;

  const closeDialog = () => {
    if (submitting) {
      return;
    }
    setSelected(null);
    setNote('');
    setError(null);
  };

  const submit = async (action: 'approve' | 'reject', overrideDecision?: 'clear' | 'flagged') => {
    if (!selected) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/documents/${selected.id}/review`, {
        action,
        note: note.trim() || undefined,
        overrideDecision,
      });
      setSelected(null);
      setNote('');
      await onReviewed();
    } catch {
      setError(action === 'approve' ? 'Failed to approve' : 'Failed to override');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const encodedKey = encodeURIComponent(doc.storagePath);
      const response = await api.get(`/api/download/${encodedKey}`, {
        params: { name: doc.name },
      });
      window.open(response.data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Failed to download file.');
    }
  };

  return (
    <Card sx={{ border: '1px solid #e0e0e0', mb: 4 }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <FactCheckIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight="bold">
            Review queue
          </Typography>
          <Chip label={reviews.length} size="small" sx={{ ml: 1 }} />
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Flagged or uncertain evaluations wait here. The model is not the final authority.
        </Typography>

        {reviews.length === 0 ? (
          <Typography color="text.secondary">No documents waiting for review.</Typography>
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
                  {doc.evaluation?.issueType || doc.evaluation?.finalDecision} · {doc.evaluation?.routingReason}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        <Dialog open={Boolean(selected)} onClose={closeDialog} fullWidth maxWidth="sm">
          <DialogTitle>{selected?.name}</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {selected && evaluation && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => void handleDownload(selected)} sx={{ alignSelf: 'flex-start' }}>
                  Open document
                </Button>
                <OutcomeSummary evaluation={evaluation} />
                <Typography variant="body2">
                  <strong>Issue:</strong> {evaluation.issueType || 'None'}
                </Typography>
                <Typography variant="body2">{evaluation.explanation}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {evaluation.routingReason} · {evaluation.modelId} · {evaluation.promptVersion}
                </Typography>
                <Divider />
                <Typography variant="subtitle2">Extracted fields</Typography>
                <Typography variant="body2">Type: {selected.extraction?.docType || 'N/A'}</Typography>
                <Typography variant="body2">Holder: {selected.extraction?.holderName || 'N/A'}</Typography>
                <Typography variant="body2">Number: {selected.extraction?.licenseNumber || 'N/A'}</Typography>
                <Typography variant="body2">Issued: {selected.extraction?.issueDate || 'N/A'}</Typography>
                <Typography variant="body2">Expiry: {selected.extraction?.expiryDate || 'N/A'}</Typography>
                {evaluation.ruleHits.length > 0 && (
                  <>
                    <Typography variant="subtitle2">Deterministic rules</Typography>
                    {evaluation.ruleHits.map(hit => (
                      <Typography key={hit.code} variant="body2">
                        {hit.code}: {hit.message}
                      </Typography>
                    ))}
                  </>
                )}
                {evaluation.evidence.length > 0 && (
                  <>
                    <Typography variant="subtitle2">Evidence</Typography>
                    {evaluation.evidence.map((item, index) => (
                      <Typography key={`${item.quote}-${index}`} variant="body2" sx={{ fontStyle: 'italic' }}>
                        “{item.quote}”{item.page ? ` (p. ${item.page})` : ''}
                      </Typography>
                    ))}
                  </>
                )}
                <TextField
                  label="Reviewer note (optional)"
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button onClick={closeDialog} disabled={submitting}>
              Close
            </Button>
            <Button onClick={() => void submit('approve')} variant="contained" disabled={submitting}>
              Approve
            </Button>
            <Button onClick={() => void submit('reject', 'clear')} color="success" disabled={submitting}>
              Override as clear
            </Button>
            <Button onClick={() => void submit('reject', 'flagged')} color="error" disabled={submitting}>
              Override as flagged
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};
