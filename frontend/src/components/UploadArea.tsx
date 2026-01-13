import { useRef } from 'react';
import { Paper, Typography, Button, Box, CircularProgress, Alert } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface Props {
  onUpload: (file: File) => void;
  uploading: boolean;
  error: string | null;
}

export const UploadArea = ({ onUpload, uploading, error }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Paper elevation={3} sx={{ p: 6, textAlign: 'center', border: '2px dashed #ccc', borderRadius: 4, mb: 4 }}>
      <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" />

      {uploading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">Uploading & Analyzing...</Typography>
          <Typography variant="body2" color="text.secondary">Gemini is reading your document</Typography>
        </Box>
      ) : (
        <>
          <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>Upload your document here</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Supports JPG, PNG, PDF</Typography>
          <Button 
            variant="contained" 
            size="large" 
            onClick={handleButtonClick} 
            startIcon={<CloudUploadIcon />} 
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', bgcolor: '#0F172A' }}
          >
            Select File
          </Button>
        </>
      )}
      
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Paper>
  );
};