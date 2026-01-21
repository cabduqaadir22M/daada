
export type Role = 'user' | 'assistant' | 'system';

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64
  name: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  reasoning?: string;
  isSafetyWarning?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isPrivate?: boolean;
}

export interface GeneratedImage {
  id: string;
  userId: string;
  prompt: string;
  url: string;
  timestamp: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  interests?: string[];
  passwordHash?: string;
  privateHistoryPasswordHash?: string;
  strikes?: number;
  banUntil?: number;
}

export type ViewType = 'chat' | 'image-gen' | 'settings' | 'admin';
