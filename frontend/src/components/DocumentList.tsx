import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CircularProgress from '@mui/material/CircularProgress';
import type { CrewMemberItem, DocumentItem, OpsStatus, ProjectItem } from '../types';
import { PERSON_STATUS_LABEL, OPS_STATUS_LABEL } from '../utils/crew';
import { useState } from 'react';
import { api } from '../api/client';
import { CompactUploadButton } from './CompactUploadButton';

const CREATE_PROJECT_VALUE = '__create__';

const statusChip = (status: OpsStatus) => {
  if (status === 'processing') {
    return <Chip icon={<CircularProgress size={16} />} label={OPS_STATUS_LABEL[status]} color="warning" variant="outlined" />;
  }
  if (status === 'failed') {
    return <Chip icon={<ErrorIcon />} label={OPS_STATUS_LABEL[status]} color="error" variant="outlined" />;
  }
  if (status === 'needs_human') {
    return <Chip icon={<WarningAmberIcon />} label={OPS_STATUS_LABEL[status]} color="warning" variant="outlined" />;
  }
  if (status === 'expired') {
    return <Chip icon={<ErrorIcon />} label={OPS_STATUS_LABEL[status]} color="error" variant="outlined" />;
  }
  if (status === 'expiring') {
    return <Chip icon={<WarningAmberIcon />} label={OPS_STATUS_LABEL[status]} color="warning" variant="outlined" />;
  }
  return <Chip icon={<CheckCircleIcon />} label={OPS_STATUS_LABEL[status]} color="success" variant="outlined" />;
};

const personChip = (status: OpsStatus) => {
  const color =
    status === 'expired' || status === 'failed'
      ? 'error'
      : status === 'valid'
        ? 'success'
        : 'warning';
  return <Chip label={PERSON_STATUS_LABEL[status]} color={color} variant="outlined" />;
};

interface Props {
  crew: CrewMemberItem[];
  projects: ProjectItem[];
  selectedProjectId: number | null;
  onProjectChange: (projectId: number | null) => void;
  onCreateProject: (name: string) => Promise<void>;
  onUpload: (files: File[]) => void;
  onDelete: (docId: string) => Promise<void>;
  onCrewChanged: () => Promise<void>;
  uploading: boolean;
  uploadError: string | null;
}

export const DocumentList = ({
  crew,
  projects,
  selectedProjectId,
  onProjectChange,
  onCreateProject,
  onUpload,
  onDelete,
  onCrewChanged,
  uploading,
  uploadError,
}: Props) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const handleOpen = (doc: DocumentItem) => setSelectedDoc(doc);
  const handleClose = () => setSelectedDoc(null);

  const handleProjectSelect = (event: SelectChangeEvent<number | string>) => {
    const value = event.target.value;
    if (value === CREATE_PROJECT_VALUE) {
      setCreateProjectError(null);
      setNewProjectName('');
      setCreateDialogOpen(true);
      return;
    }

    onProjectChange(typeof value === 'number' ? value : Number(value));
  };

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      setCreateProjectError('Project name is required');
      return;
    }

    setCreatingProject(true);
    setCreateProjectError(null);

    try {
      await onCreateProject(trimmedName);
      setCreateDialogOpen(false);
      setNewProjectName('');
    } catch {
      setCreateProjectError('Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();

    try {
      const encodedKey = encodeURIComponent(doc.storagePath);
      const response = await api.get(`/api/download/${encodedKey}`, {
        params: { name: doc.name },
      });
      const downloadUrl = response.data.url;
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file.');
    }
  };

  const openDeleteDialog = (doc: DocumentItem) => {
    setDeleteError(null);
    setDocToDelete(doc);
  };

  const closeDeleteDialog = () => {
    if (deleting) {
      return;
    }
    setDocToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(docToDelete.id);
      if (selectedDoc?.id === docToDelete.id) {
        setSelectedDoc(null);
      }
      setDocToDelete(null);
    } catch {
      setDeleteError('Failed to remove document.');
    } finally {
      setDeleting(false);
    }
  };

  const togglePerson = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveEmail = async (member: CrewMemberItem) => {
    if (!member.id) {
      return;
    }
    const email = (emailDrafts[member.id] ?? member.email ?? '').trim();
    await api.patch(`/api/crew/${member.id}`, { email: email || null });
    await onCrewChanged();
  };

  const remindPerson = async (member: CrewMemberItem) => {
    if (!member.id) {
      return;
    }
    setRemindingId(member.id);
    try {
      const res = await api.post<{ mailto?: string; channel?: string }>(`/api/crew/${member.id}/remind`);
      if (res.data.channel !== 'smtp' && res.data.mailto) {
        window.location.href = res.data.mailto;
      }
      await onCrewChanged();
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <Card sx={{ border: '1px solid #e0e0e0', animation: 'fadeIn 0.5s ease-in', mb: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <GroupIcon color="primary" sx={{ mr: 1 }} />
            <FormControl size="small" sx={{ minWidth: 220, flex: 1, maxWidth: 360 }}>
              <InputLabel id="project-select-label">Project</InputLabel>
              <Select
                labelId="project-select-label"
                label="Project"
                value={selectedProjectId ?? ''}
                onChange={handleProjectSelect}
                displayEmpty
              >
                {projects.length === 0 && (
                  <MenuItem value="" disabled>
                    No projects yet
                  </MenuItem>
                )}
                {projects.map(project => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <MenuItem value={CREATE_PROJECT_VALUE}>Create new project…</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <CompactUploadButton
            onUpload={onUpload}
            uploading={uploading}
            disabled={!selectedProjectId}
          />
        </Box>

        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {uploadError}
          </Alert>
        )}

        {crew.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            {selectedProjectId
              ? 'Upload the pile of tickets. We will group them by person.'
              : 'Select or create a project to upload documents.'}
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {crew.map(person => {
              const key = person.id || person.name;
              const isOpen = expanded[key] ?? (person.status !== 'valid');
              return (
                <Box key={key} py={1.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box>
                      <Typography fontWeight={700}>{person.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {person.documents.length} document{person.documents.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      {personChip(person.status)}
                      {(person.status === 'expired' || person.status === 'expiring') && person.id && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={remindingId === person.id}
                          onClick={() => void remindPerson(person)}
                        >
                          {remindingId === person.id ? 'Sending…' : 'Remind'}
                        </Button>
                      )}
                      <IconButton
                        aria-label={isOpen ? 'Hide documents' : 'Show documents'}
                        size="small"
                        onClick={() => togglePerson(key)}
                      >
                        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Stack>
                  </Box>

                  <Collapse in={isOpen}>
                    {person.id && (
                      <TextField
                        size="small"
                        label="Reminder email"
                        placeholder="worker@example.com"
                        value={emailDrafts[person.id] ?? person.email ?? ''}
                        onChange={event =>
                          setEmailDrafts(prev => ({ ...prev, [person.id as string]: event.target.value }))
                        }
                        onBlur={() => void saveEmail(person)}
                        sx={{ mt: 1.5, maxWidth: 360 }}
                      />
                    )}
                    <Stack spacing={1.5} mt={1.5}>
                      {person.documents.map(doc => (
                        <Box key={doc.id} sx={{ pl: 1, borderLeft: '3px solid #e0e0e0' }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                            <Typography fontWeight={600}>
                              <Link href="#" onClick={e => void handleDownload(e, doc)}>
                                {doc.extraction?.docType || doc.name}
                              </Link>
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {statusChip(doc.opsStatus ?? 'valid')}
                              <Tooltip title="Remove document">
                                <IconButton
                                  aria-label={`Remove ${doc.name}`}
                                  size="small"
                                  onClick={() => openDeleteDialog(doc)}
                                  disabled={deleting && docToDelete?.id === doc.id}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {doc.extraction?.expiryDate
                              ? `Expiry ${doc.extraction.expiryDate}`
                              : 'No expiry extracted'}
                            {doc.extraction?.licenseNumber ? ` · ${doc.extraction.licenseNumber}` : ''}
                          </Typography>
                          {doc.status === 'processed' && doc.extraction?.content && (
                            <Button size="small" onClick={() => handleOpen(doc)} sx={{ mt: 0.5, px: 0 }}>
                              View text
                            </Button>
                          )}
                          {doc.status === 'failed' && (
                            <Typography variant="body2" color="error" mt={0.5}>
                              Analysis failed{doc.processingError ? `: ${doc.processingError}` : '.'}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        )}

        <Dialog open={createDialogOpen} onClose={() => !creatingProject && setCreateDialogOpen(false)}>
          <DialogTitle>Create new project</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Project name"
              fullWidth
              value={newProjectName}
              onChange={event => setNewProjectName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  void handleCreateProject();
                }
              }}
              error={Boolean(createProjectError)}
              helperText={createProjectError}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={creatingProject}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateProject()} variant="contained" disabled={creatingProject}>
              {creatingProject ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(selectedDoc)} onClose={handleClose}>
          <DialogTitle>{selectedDoc?.name}</DialogTitle>
          <DialogContent>{selectedDoc?.extraction?.content}</DialogContent>
        </Dialog>

        <Dialog open={Boolean(docToDelete)} onClose={closeDeleteDialog}>
          <DialogTitle>Remove document</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Remove {docToDelete?.name}? This deletes the file and its analysis.
            </DialogContentText>
            {deleteError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {deleteError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleConfirmDelete()}
              color="error"
              variant="contained"
              disabled={deleting}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};
