import mongoose, { Document, Schema } from 'mongoose';

export interface IDocument extends Document {
  userId: string;        // Linked to Clerk ID
  userEmail?: string; 
  originalName: string;
  storagePath: string;
  mimeType: string;
  uploadDate: Date;
  status: 'pending' | 'processed' | 'failed';
  extractedData?: {
    docType?: string;
    expiryDate?: string;
    licenseNumber?: string;
    holderName?: string;
    confidence?: number;
  };
}

const DocumentSchema = new Schema<IDocument>({
  userId: { type: String, required: false, index: true },    
  userEmail: { type: String },  
  originalName: { type: String, required: true },
  storagePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'processed', 'failed'],
    default: 'pending' 
  },
  extractedData: {
    docType: String,
    expiryDate: String, // Storing as string for now to match JSON, can parse to Date later
    licenseNumber: String,
    holderName: String,
    confidence: Number
  }
});

export default mongoose.model<IDocument>('Document', DocumentSchema);