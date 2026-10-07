export type ChatRole = 'system' | 'user' | 'assistant';

/** Message tel qu'attendu par le worker (`POST /chat`). */
export interface ChatPayloadMessage {
  role: ChatRole;
  content: string;
}

/** Message affiché dans la conversation. */
export interface ChatMessage extends ChatPayloadMessage {
  id: string;
}

export interface ChatReply {
  content: string;
}

export type ChatStatus = 'idle' | 'sending' | 'error';
