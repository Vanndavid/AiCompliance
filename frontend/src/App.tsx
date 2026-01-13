import { useEffect, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Header } from './components/Header';
import { UploadArea } from './components/UploadArea';
import { DocumentList } from './components/DocumentList';
import { NotificationPanel } from './components/NotificationPanel';

import type { DocumentItem, NotificationItem } from './types';

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  useEffect(() => {
    fetchDocuments();
    fetchNotifications();
  }, []);

  const fetchDocuments = async () => {
    const res = await fetch('http://localhost:3000/api/documents');
    if (res.ok) setDocuments(await res.json());
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };
  const pollForStatus = (docId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/document/${docId}`);
        const data = await res.json();

        if (data.status === 'processed' || data.status === 'failed') {
          clearInterval(interval);

          setDocuments(prev =>
            prev.map(doc =>
              doc.id === docId
                ? { ...doc, status: data.status, extraction: data.extraction }
                : doc
            )
          );
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 2000);
  };

  const handleNotificationRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n._id !== id));
  };
  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const res = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setDocuments(prev => [
        { id: data.file.id, name: data.file.originalName, status: 'pending' },
        ...prev
      ]);
      pollForStatus(data.file.id);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box minHeight="100vh" bgcolor="#f5f5f5">
      <Header />

      <Container maxWidth="md" sx={{ mt: 6 }}>
        <Typography variant="h3" textAlign="center" fontWeight="bold" mb={4}>
          AI Compliance Officer
        </Typography>
        <NotificationPanel notifications={notifications} onRead={handleNotificationRead} />
        <UploadArea uploading={uploading} error={error} onUpload={uploadFile} />
        <DocumentList documents={documents} />
      </Container>
    </Box>
  );
}
