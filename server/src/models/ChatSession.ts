import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A single conversation thread with the assistant for one baby. Messages
// (ChatMessage) reference a session via sessionId. A baby can have many
// sessions; the user starts a "new chat", switches between them, and deletes
// them from the Assistant page.
export interface IChatSession {
  babyId: Types.ObjectId;
  // Short label shown in the chat list, derived from the first user message.
  title: string;
  // When the latest message landed — used to sort the list (newest first) and
  // to bucket sessions into Today / Previous 7 days / Older on the client.
  lastMessageAt: Date;
  createdAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    title: { type: String, required: true, default: 'New chat', maxlength: 80 },
    lastMessageAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ChatSession = model<IChatSession>('ChatSession', chatSessionSchema);
