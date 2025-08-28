export interface UploadedPolicy {
  fileName: string;
  fileUrl?: string;
  uploadedAt: string;
}

export interface ChatSession {
  id: string;
  policies: UploadedPolicy[];
  createdAt: string;
}
