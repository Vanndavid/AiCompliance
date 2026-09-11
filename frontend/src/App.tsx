import { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Container, Fab, Tooltip, Typography } from '@mui/material';
import { Header } from './components/Header';
import { DocumentList } from './components/DocumentList';
import { NotificationPanel } from './components/NotificationPanel';
import { ReviewQueue } from './components/ReviewQueue';
import { SiteReadyOverview } from './components/SiteReadyOverview';
import { DocumentTools } from './components/DocumentTools';
import { useAuth, api } from './auth/AuthContext';
import type { CrewMemberItem, CrewOverviewTotals, CrewResponse, DocumentItem, NotificationItem, ProjectItem } from './types';
import { groupDocumentsByHolder } from './utils/crew';
import GitHubIcon from '@mui/icons-material/GitHub';
import LandingPage from './components/LandingPage';

interface UploadUrlResponse {
  documentId: string;
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [crew, setCrew] = useState<CrewMemberItem[]>([]);
  const [overview, setOverview] = useState<CrewOverviewTotals | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [reviews, setReviews] = useState<DocumentItem[]>([]);
  const [filteredCrew, setFilteredCrew] = useState<CrewMemberItem[] | null>(null);

  const fetchProjects = async () => {
    const res = await api.get<{ projects: ProjectItem[] }>('/api/projects');
    setProjects(res.data.projects);
    return res.data.projects;
  };

  const fetchCrew = useCallback(async (projectId?: number | null) => {
    if (projectId == null) {
      setCrew([]);
      setOverview(null);
      return;
    }

    const res = await api.get<CrewResponse>('/api/crew', { params: { projectId } });
    setCrew(res.data.crew);
    setOverview(res.data.overview.totals);
  }, []);

  const fetchReviews = async (projectId?: number | null) => {
    try {
      const params = projectId != null ? { projectId } : undefined;
      const res = await api.get<{ reviews: DocumentItem[] }>('/api/reviews', { params });
      setReviews(res.data.reviews);
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    }
  };

  const fetchNotifications = async (projectId?: number | null) => {
    try {
      const params = projectId != null ? { projectId } : undefined;
      const res = await api.get<NotificationItem[]>('/api/notifications', { params });
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const refreshProjectData = useCallback(async (projectId?: number | null) => {
    await Promise.all([
      fetchCrew(projectId),
      fetchReviews(projectId),
      fetchNotifications(projectId),
    ]);
  }, [fetchCrew]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCrew([]);
      setOverview(null);
      setProjects([]);
      setSelectedProjectId(null);
      setNotifications([]);
      setReviews([]);
      setFilteredCrew(null);
      return;
    }

    void (async () => {
      const loadedProjects = await fetchProjects();
      if (loadedProjects.length > 0) {
        setSelectedProjectId(loadedProjects[0].id);
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || selectedProjectId == null) {
      if (selectedProjectId == null) {
        setCrew([]);
        setOverview(null);
      }
      return;
    }

    void refreshProjectData(selectedProjectId);
  }, [isAuthenticated, selectedProjectId, refreshProjectData]);

  const searchDocuments = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setFilteredCrew(null);
      setSearchSummary(null);
      await fetchCrew(selectedProjectId);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const res = await api.get('/api/documents/search', {
        params: {
          q: trimmedQuery,
          ...(selectedProjectId != null ? { projectId: selectedProjectId } : {}),
        },
      });
      const data = res.data;
      setFilteredCrew(groupDocumentsByHolder(data.results));

      const keywordSummary = data.interpretedFilters.keywords.length
        ? `keywords: ${data.interpretedFilters.keywords.join(', ')}`
        : 'no keyword filters';
      const expirySummary = data.interpretedFilters.expiryWithinDays
        ? `expiry within ${data.interpretedFilters.expiryWithinDays} days`
        : 'no expiry window';

      setSearchSummary(`Found ${data.results.length} matching document(s) using ${keywordSummary} and ${expirySummary}.`);
    } catch {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = async () => {
    setSearchQuery('');
    setSearchSummary(null);
    setFilteredCrew(null);
    setError(null);
    await fetchCrew(selectedProjectId);
  };

  const pollForStatus = (docId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/document/${docId}`);
        const data = res.data;

        if (data.status === 'processed' || data.status === 'failed') {
          clearInterval(interval);
          await refreshProjectData(selectedProjectId);
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 5000);
  };

  const handleNotificationRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleCreateProject = async (name: string) => {
    const res = await api.post<{ project: ProjectItem }>('/api/projects', { name });
    const project = res.data.project;
    setProjects(prev => [project, ...prev]);
    setSelectedProjectId(project.id);
  };

  const handleDeleteDocument = async (docId: string) => {
    await api.delete(`/api/documents/${docId}`);
    await refreshProjectData(selectedProjectId);
  };

  const uploadFiles = async (files: File[]) => {
    if (selectedProjectId == null) {
      setError('Select or create a project first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const uploadUrlRes = await api.post<UploadUrlResponse>('/api/documents/upload-url', {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          projectId: selectedProjectId,
        });

        const { documentId, uploadUrl } = uploadUrlRes.data;
        const s3Res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        });

        if (!s3Res.ok) {
          throw new Error('S3 upload failed');
        }

        const completeRes = await api.post(`/api/documents/${documentId}/complete-upload`);
        const data = completeRes.data as { duplicate?: boolean; file: { id: string } };

        if (data.duplicate) {
          setError('That file is already in this project.');
          continue;
        }

        pollForStatus(data.file.id);
      }
      await refreshProjectData(selectedProjectId);
    } catch (err) {
      console.error('Upload failed', err);
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#f5f5f5">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" bgcolor="#f5f5f5">
      <Header />

      {isAuthenticated ? (
        <Container maxWidth="md" sx={{ mt: 6 }}>
          <Typography variant="h3" textAlign="center" fontWeight="bold" mb={1}>
            Who's site-ready
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            Upload the pile of tickets. Tomorrow morning you know who cannot go on site, and they already got a reminder.
          </Typography>

          <SiteReadyOverview totals={overview} />
          <NotificationPanel
            notifications={notifications}
            onRead={handleNotificationRead}
            onReminded={() => {
              void fetchNotifications(selectedProjectId);
            }}
          />
          {reviews.length > 0 && (
            <ReviewQueue
              reviews={reviews}
              onReviewed={async () => {
                await refreshProjectData(selectedProjectId);
              }}
            />
          )}
          <DocumentList
            crew={filteredCrew ?? crew}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
            onCreateProject={handleCreateProject}
            onUpload={uploadFiles}
            onDelete={handleDeleteDocument}
            onCrewChanged={async () => {
              await refreshProjectData(selectedProjectId);
            }}
            uploading={uploading}
            uploadError={error}
          />
          <DocumentTools
            selectedProjectId={selectedProjectId}
            searchQuery={searchQuery}
            searching={searching}
            searchSummary={searchSummary}
            onSearchQueryChange={setSearchQuery}
            onSearch={() => void searchDocuments()}
            onClearSearch={() => void clearSearch()}
          />

          <Tooltip title="View Source Code" arrow>
            <Fab
              aria-label="github"
              sx={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                bgcolor: '#000000',
                color: '#ffffff',
                '&:hover': {
                  bgcolor: '#333333',
                },
              }}
              href="https://github.com/Vanndavid/AiCompliance"
              target="_blank"
            >
              <GitHubIcon />
            </Fab>
          </Tooltip>
        </Container>
      ) : (
        <Container>
          <LandingPage />
        </Container>
      )}
    </Box>
  );
}
