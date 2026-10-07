import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AssistantService } from './assistant.service';
import type { ChatMessage, ChatPayloadMessage, ChatRole, ChatStatus } from './assistant.models';

/** Nombre maximal de messages envoyés au worker, pour borner la taille de la requête. */
export const MAX_HISTORY = 20;

export const SYSTEM_PROMPT: ChatPayloadMessage = {
  role: 'system',
  content: 'Tu es un assistant utile et concis. Réponds en français, sauf si on te demande une autre langue.',
};

@Injectable()
export class AssistantStore {
  private readonly service = inject(AssistantService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _status = signal<ChatStatus>('idle');
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isSending = computed(() => this._status() === 'sending');
  readonly isEmpty = computed(() => this._messages().length === 0);

  send(text: string): void {
    const content = text.trim();
    if (!content || this.isSending()) {
      return;
    }
    this._messages.update((messages) => [...messages, this.createMessage('user', content)]);
    this.request();
  }

  /** Renvoie la conversation telle quelle, après une erreur. */
  retry(): void {
    if (this._status() !== 'error') {
      return;
    }
    this.request();
  }

  reset(): void {
    this._messages.set([]);
    this._error.set(null);
    this._status.set('idle');
  }

  private request(): void {
    this._status.set('sending');
    this._error.set(null);

    const history = this._messages()
      .slice(-MAX_HISTORY)
      .map(({ role, content }): ChatPayloadMessage => ({ role, content }));

    this.service
      .send([SYSTEM_PROMPT, ...history])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ content }) => {
          this._messages.update((messages) => [...messages, this.createMessage('assistant', content)]);
          this._status.set('idle');
        },
        error: (error: unknown) => {
          this._error.set(this.describeError(error));
          this._status.set('error');
        },
      });
  }

  private createMessage(role: ChatRole, content: string): ChatMessage {
    return { id: crypto.randomUUID(), role, content };
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return "Impossible de joindre le serveur. Vérifie ta connexion, puis réessaie.";
      }
      if (error.status >= 500) {
        return "Le service d'IA ne répond pas pour le moment. Réessaie dans un instant.";
      }
      return `La requête a été refusée (code ${error.status}).`;
    }
    return "Une erreur inattendue s'est produite. Réessaie.";
  }
}
