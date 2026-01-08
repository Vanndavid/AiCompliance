import { useState, useRef, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button, Paper, Grid, CircularProgress, Alert, Card, CardContent, List, ListItem, ListItemText, ListItemIcon, Chip, Divider } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArticleIcon from '@mui/icons-material/Article';
import PendingIcon from '@mui/icons-material/Pending';
import ErrorIcon from '@mui/icons-material/Error';

interface AiExtraction {
  type?: string;
  expiryDate?: string;
  licenseNumber?: string;
  name?: string;
  confidence?: number;
}

interface DocumentItem {
  id: string;
  name: string;
  status: 'pending' | 'processed' | 'failed';
  extraction?: AiExtraction;
}

function App() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NEW: Fetch History on Load ---
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        
        // If any docs are still pending from previous session, poll them!
        data.forEach((doc: DocumentItem) => {
          if (doc.status === 'pending') {
            pollForStatus(doc.id);
          }
        });
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const pollForStatus = async (docId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/document/${docId}`);
        const data = await res.json();

        if (data.status === 'processed' || data.status === 'failed') {
          clearInterval(interval);
          setDocuments(prevDocs => prevDocs.map(doc => 
            doc.id === docId 
              ? { ...doc, status: data.status, extraction: data.extraction } 
              : doc
          ));
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      
      const newDoc: DocumentItem = {
        id: data.file.id,
        name: data.file.originalName,
        status: 'pending'
      };
      
      setDocuments(prev => [newDoc, ...prev]);
      pollForStatus(data.file.id);

    } catch (err) {
      console.error(err);
      setError('Failed to upload document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusChip = (status: string, extraction?: AiExtraction) => {
    if (status === 'pending') return <Chip icon={<CircularProgress size={16} />} label="Processing" color="warning" variant="outlined" />;
    if (status === 'failed') return <Chip icon={<ErrorIcon />} label="Failed" color="error" variant="outlined" />;
    
    const isValid = extraction?.expiryDate && extraction?.licenseNumber;
    return <Chip icon={<CheckCircleIcon />} label={isValid ? "Valid" : "Review"} color={isValid ? "success" : "info"} variant="outlined" />;
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static" sx={{ backgroundColor: '#0F172A' }}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            TradeComply
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 8, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" color="text.primary">
            AI Compliance Officer
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Upload your licenses, insurance, or certifications. 
            <br />
            Our Gemini AI extracts the data and ensures you are site-ready.
          </Typography>
        </Box>

        {/* Upload Card */}
        <Paper elevation={3} sx={{ p: 6, textAlign: 'center', border: '2px dashed #ccc', borderRadius: 4, mb: 4 }}>
          <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" />

          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6">Uploading...</Typography>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" gutterBottom>Drag and drop your document here</Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>Supports JPG, PNG, PDF</Typography>
              <Button variant="contained" size="large" onClick={handleButtonClick} startIcon={<CloudUploadIcon />} sx={{ px: 4, py: 1.5, fontSize: '1.1rem', bgcolor: '#0F172A' }}>
                Select File
              </Button>
            </>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Paper>

        {/* Documents List */}
        {documents.length > 0 && (
          <Card sx={{ border: '1px solid #e0e0e0', animation: 'fadeIn 0.5s ease-in' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ArticleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h5" fontWeight="bold">Recent Uploads</Typography>
              </Box>
              
              <List>
                {documents.map((doc, index) => (
                  <Box key={doc.id}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                      <ListItemIcon>
                        <ArticleIcon fontSize="large" color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" component="span">
                              {doc.extraction?.type || doc.name}
                            </Typography>
                            {getStatusChip(doc.status, doc.extraction)}
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'block', mt: 1 }}>
                            {doc.status === 'processed' && doc.extraction ? (
                              <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}>
                                  <Typography variant="caption" color="text.secondary">Expiry</Typography>
                                  <Typography variant="body2" fontWeight="bold" color={doc.extraction.expiryDate ? 'success.main' : 'error.main'}>
                                    {doc.extraction.expiryDate || 'N/A'}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={4}>
                                  <Typography variant="caption" color="text.secondary">Number</Typography>
                                  <Typography variant="body2">{doc.extraction.licenseNumber || 'N/A'}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={5}>
                                  <Typography variant="caption" color="text.secondary">Holder</Typography>
                                  <Typography variant="body2">{doc.extraction.name || 'N/A'}</Typography>
                                </Grid>
                              </Grid>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                {doc.status === 'pending' ? 'Analyzing document...' : 'Analysis failed.'}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

      </Container>
    </Box>
  );
}

export default App;