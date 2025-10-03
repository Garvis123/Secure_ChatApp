import express from 'express';
import { param } from 'express-validator';
import multer from 'multer';
import {
  uploadFile,
  downloadFile,
  deleteFile,
  embedSteganography,
  extractSteganography
} from '../controllers/fileController.js';
import { validate } from '../middleware/validation.js';
import { fileLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types but sanitize
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
      'audio/mpeg', 'audio/ogg', 'audio/wav',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'application/zip', 'application/x-rar-compressed'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// File upload
router.post('/upload',
  fileLimiter,
  upload.single('file'),
  uploadFile
);

// File download
router.get('/download/:fileId',
  [param('fileId').notEmpty()],
  validate,
  downloadFile
);

// Delete file
router.delete('/:fileId',
  [param('fileId').notEmpty()],
  validate,
  deleteFile
);

// Steganography endpoints
router.post('/steganography/embed',
  fileLimiter,
  upload.single('image'),
  embedSteganography
);

router.post('/steganography/extract',
  fileLimiter,
  upload.single('image'),
  extractSteganography
);

export default router;