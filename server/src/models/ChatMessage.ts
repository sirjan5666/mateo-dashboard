import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IChatMessage {
  babyId: Types.ObjectId;
  // The conversation thread this message belongs to (see models/ChatSession.ts).
  sessionId: Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  // true when this assistant message is the deterministic red-flag escalation
  // (set in routes/chat.ts BEFORE any model call).
  redFlagTriggered: boolean;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    redFlagTriggered: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ChatMessage = model<IChatMessage>('ChatMessage', chatMessageSchema);
