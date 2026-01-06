import { Request, Response } from 'express';
import { analyzeDocument } from '../services/geminiService'; // Use Vision service
import DocumentModel from '../models/Document'; // Import DB Model

// GET /api/health
export const checkHealth = (req: Request, res: Response) => {
  res.json({ status: 'active', message: 'TradeComply API is running 🟢' });
};

// POST /api/test-ai (Optional: Keep for text testing)
export const testAI = async (req: Request, res: Response) => {
  // ... (keep existing logic if you want, or remove) ...
  res.json({ message: "Use upload endpoint for vision" });
};

// POST /api/upload - The Main Logic
export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    console.log(`Analyzing file: ${req.file.path}`);
    
    // 1. Call Gemini Vision
    // Note: ensure analyzeDocument in services/geminiService.ts handles images
    const aiResult = await analyzeDocument(req.file.path, req.file.mimetype);

    // 2. Save to MongoDB
    const newDoc = await DocumentModel.create({
      originalName: req.file.originalname,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
      status: 'processed',
      extractedData: {
        docType: aiResult.type,
        expiryDate: aiResult.expiryDate,
        licenseNumber: aiResult.licenseNumber,
        holderName: aiResult.name,
        confidence: aiResult.confidence
      }
    });

    console.log(`✅ Document saved with ID: ${newDoc._id}`);

    // 3. Return the Extraction to Frontend
    res.json({
      success: true,
      file: {
        id: newDoc._id,
        originalName: newDoc.originalName,
        path: newDoc.storagePath
      },
      extraction: newDoc.extractedData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: 'Processing Failed',
      details: (error as Error).message 
    });
  }
};