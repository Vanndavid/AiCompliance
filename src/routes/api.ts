import { Router } from 'express';
import { upload } from '../middleware/upload';
import { checkHealth, getDocumentStatus, getAllDocuments, uploadDocument } from '../controllers/documentController';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/upload', upload.single('document'), uploadDocument);
router.get('/document/:id', getDocumentStatus); 
router.get('/documents', getAllDocuments);
export default router;