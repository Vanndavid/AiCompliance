import { Router } from 'express';
// import { upload } from '../middleware/upload';
import upload from "../config/s3uploader"
import { checkHealth, getDocumentStatus, getAllDocuments, uploadDocument, getNotifications, markAsRead, downloadDocument } from '../controllers/documentController';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/upload', upload.single('document'), uploadDocument);
router.get('/document/:id', getDocumentStatus); 
router.get('/documents', getAllDocuments);
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markAsRead);
router.get('/download/*key', downloadDocument);

export default router;