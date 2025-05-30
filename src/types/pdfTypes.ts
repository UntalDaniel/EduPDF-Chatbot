export interface PDF {
  id: string;
  title: string;
  description?: string;
  url: string;
  uploadedAt: Date;
  userId: string;
  size: number;
  pageCount: number;
  thumbnailUrl?: string;
}

export interface PDFUploadProgress {
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface PdfType {
    id: string;
    title: string;
    description: string;
    url: string;
    thumbnailUrl?: string;
    size: number;
    pages: number;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
} 