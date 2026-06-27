import { api } from './client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  redFlagTriggered: boolean;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface SessionList {
  sessions: ChatSession[];
  assistantEnabled: boolean;
}

export interface SessionThread {
  session: ChatSession;
  messages: ChatMessage[];
  assistantEnabled: boolean;
}

export interface ChatSend {
  sessionId: string;
  session: ChatSession;
  messages: ChatMessage[];
  redFlag?: boolean;
  assistantEnabled?: boolean;
}

// All chat threads for a baby, newest activity first.
export function listSessions(babyId: string) {
  return api<SessionList>(`/babies/${babyId}/chat/sessions`);
}

// The messages of a single thread.
export function getSession(babyId: string, sessionId: string) {
  return api<SessionThread>(`/babies/${babyId}/chat/sessions/${sessionId}`);
}

// Send a message. Omit sessionId to start a new thread. `language` (the app's
// current UI language) lets the assistant reply in that language.
export function sendChat(babyId: string, message: string, sessionId?: string, language?: string) {
  return api<ChatSend>(`/babies/${babyId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, sessionId, language }),
  });
}

// Delete a thread and all of its messages.
export function deleteSession(babyId: string, sessionId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/chat/sessions/${sessionId}`, { method: 'DELETE' });
}
