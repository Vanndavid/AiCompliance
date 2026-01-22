import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"; // Import GetObjectCommand
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // Import the signer
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";
import { Request } from "express";

dotenv.config();

// 1. Setup AWS Client
const s3Config = new S3Client({
    region: process.env.AWS_REGION || "ap-southeast-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!, // The '!' tells TS "I promise this exists"
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});

// 2. Setup Multer
const upload = multer({
    storage: multerS3({
        s3: s3Config,
        bucket: process.env.AWS_BUCKET_NAME!,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
            cb(null, `uploads/${fileName}`);
        }
    })
});

// 3. NEW: Function to generate a Download Link
export const generatePresignedUrl = async (fileKey: string) => {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
    });

    // Generate a URL that expires in 1 hour (3600 seconds)
    const url = await getSignedUrl(s3Config, command, { expiresIn: 3600 });
    return url;
};

export default upload;