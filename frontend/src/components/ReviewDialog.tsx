import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { api } from '../api/client';
import type { DocumentEvaluation, DocumentItem } from '../types';

interface Props {
  doc: DocumentItem | null;
  onClose: () => void;
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
        <strong>AI decision:</strong> {evaluation.llmDecision} (
        {formatPercent(evaluation.confidence)} confidence, {evaluation.risk} risk)
      </Typography>
      <Typography variant="body2">
        <strong>Routed as:</strong> {evaluation.finalDecision}
      </Typography>
      {evaluation.reviewStatus === 'rejected' && evaluation.overrideDecision && (
        <Typography variant="body2">
          <strong>Your last call:</strong> {evaluation.overrideDecision}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        Effective outcome: {humanOutcome}
      </Typography>
    </Stack>
  );
};

/**
 * Two outcomes only. "Approve" and "Override as flagged" used to sit side by
 * side and produce the same result, which is why approving appeared to do
 * nothing to the list.
 */
export const ReviewDialog = ({ doc, onClose, onReviewed }: Props) => {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluation = doc?.evaluation ?? null;
  const alreadyReviewed = Boolean(
    evaluation && evaluation.reviewStatus !== 'pending' && evaluation.reviewStatus !== 'not_required',
  );

  const close = () => {
    if (submitting) {
      return;
    }
    setNote('');
    setError(null);
    onClose();
  };

  const submit = async (action: 'approve' | 'reject', overrideDecision?: 'clear' | 'flagged') => {
    if (!doc) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/documents/${doc.id}/review`, {
        action,
        note: note.trim() || undefined,
        overrideDecision,
      });
      setNote('');
      onClose();
      await onReviewed();
    } catch {
      setError('Failed to save your decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!doc) {
      return;
    }
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
    <Dialog open={Boolean(doc)} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{doc?.name}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {alreadyReviewed && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You already decided this one. Saving again replaces your previous call.
          </Alert>
        )}
        {doc && evaluation && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => void handleDownload()} sx={{ alignSelf: 'flex-start' }}>
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
            <Typography variant="body2">Type: {doc.extraction?.docType || 'N/A'}</Typography>
            <Typography variant="body2">Holder: {doc.extraction?.holderName || 'N/A'}</Typography>
            <Typography variant="body2">Number: {doc.extraction?.licenseNumber || 'N/A'}</Typography>
            <Typography variant="body2">Issued: {doc.extraction?.issueDate || 'N/A'}</Typography>
            <Typography variant="body2">Expiry: {doc.extraction?.expiryDate || 'N/A'}</Typography>
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
              label="Note (optional)"
              value={note}
              onChange={event => setNote(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Typography variant="caption" color="text.secondary">
              Your choice is what the list will say. Either way this document leaves the check queue.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={close} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={() => void submit('reject', 'clear')}
          color="success"
          variant="contained"
          disabled={submitting}
        >
          This one is fine
        </Button>
        <Button
          onClick={() => void submit('approve')}
          color="error"
          variant="outlined"
          disabled={submitting}
        >
          This is a real problem
        </Button>
      </DialogActions>
    </Dialog>
  );
};
