import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

// Allowed image extensions
const allowedExtensions = ['.png', '.jpg', '.jpeg'];

// File filter for image validation
export const imageFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed`
      ),
      false
    );
  }
  
  callback(null, true);
};

// Storage configuration for profile images
export const profileImageStorage = diskStorage({
  destination: './uploads/profile',
  filename: (req, file, callback) => {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    const filename = `profile-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Multer options for profile image upload
export const profileImageUploadOptions = {
  storage: profileImageStorage,
  fileFilter: imageFileFilter,
};

// Allowed media extensions for portfolio (images, videos, and PDFs)
const allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const allowedPdfExtensions = ['.pdf'];
const allowedPortfolioExtensions = [...allowedImageExtensions, ...allowedVideoExtensions, ...allowedPdfExtensions];

// File filter for portfolio media validation (images, videos, PDFs)
export const portfolioMediaFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedPortfolioExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Only ${allowedPortfolioExtensions.join(', ')} files are allowed`
      ),
      false
    );
  }
  
  callback(null, true);
};

// Storage configuration for portfolio media
export const portfolioMediaStorage = diskStorage({
  destination: './uploads/portfolio',
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    let prefix = 'file';
    if (allowedImageExtensions.includes(ext)) {
      prefix = 'image';
    } else if (allowedVideoExtensions.includes(ext)) {
      prefix = 'video';
    } else if (allowedPdfExtensions.includes(ext)) {
      prefix = 'pdf';
    }
    const filename = `portfolio-${prefix}-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Multer options for portfolio media upload (supports multiple files)
export const portfolioMediaUploadOptions = {
  storage: portfolioMediaStorage,
  fileFilter: portfolioMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size per file
  },
};

// Allowed CV extensions (PDF, DOC, DOCX)
const allowedCvExtensions = ['.pdf', '.doc', '.docx'];

// File filter for CV validation
export const cvFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedCvExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Only ${allowedCvExtensions.join(', ')} files are allowed`
      ),
      false
    );
  }
  
  callback(null, true);
};

// Storage configuration for CV files
export const cvStorage = diskStorage({
  destination: './uploads/cv',
  filename: (req, file, callback) => {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    const filename = `cv-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Multer options for CV upload
export const cvUploadOptions = {
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
};
