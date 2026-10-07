import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { AssistantStore } from './assistant.store';

@Component({
  selector: 'app-assistant-page',
  templateUrl: './assistant.page.html',
  styleUrls: ['./assistant.page.css'],
  providers: [AssistantStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AssistantPage {
  protected readonly store = inject(AssistantStore);

  protected readonly draft = signal('');
  protected readonly suggestions = [
    'Quelles sont les bonnes pratiques pour sécuriser une API ?',
    'Aide-moi à écrire un message de commit clair.',
    "Explique les signals d'Angular en quelques lignes.",
  ];

  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly prompt = viewChild.required<ElementRef<HTMLTextAreaElement>>('prompt');

  constructor() {
    // Garde le dernier message, l'indicateur de chargement ou l'erreur visible.
    afterRenderEffect(() => {
      this.store.messages();
      this.store.isSending();
      this.store.error();
      const log = this.log().nativeElement;
      log.scrollTop = log.scrollHeight;
    });
  }

  protected onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.draft.set(textarea.value);
    this.resize(textarea);
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey || keyboard.isComposing) {
      return;
    }
    keyboard.preventDefault();
    this.submit();
  }

  protected submit(): void {
    const text = this.draft().trim();
    if (!text || this.store.isSending()) {
      return;
    }
    this.store.send(text);
    this.draft.set('');
    const textarea = this.prompt().nativeElement;
    textarea.value = '';
    this.resize(textarea);
    textarea.focus();
  }

  protected ask(suggestion: string): void {
    this.store.send(suggestion);
  }

  private resize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }
}
