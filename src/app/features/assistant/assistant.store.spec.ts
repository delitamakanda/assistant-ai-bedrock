import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AssistantService } from './assistant.service';
import { AssistantStore, MAX_HISTORY, SYSTEM_PROMPT } from './assistant.store';
import type { ChatPayloadMessage, ChatReply } from './assistant.models';

describe('AssistantStore', () => {
  let store: AssistantStore;
  let send: ReturnType<typeof vi.fn<(messages: ChatPayloadMessage[]) => Observable<ChatReply>>>;

  beforeEach(() => {
    send = vi.fn<(messages: ChatPayloadMessage[]) => Observable<ChatReply>>(() => of({ content: 'Réponse' }));
    TestBed.configureTestingModule({
      providers: [AssistantStore, { provide: AssistantService, useValue: { send } }],
    });
    store = TestBed.inject(AssistantStore);
  });

  it('démarre vide et au repos', () => {
    expect(store.isEmpty()).toBe(true);
    expect(store.status()).toBe('idle');
    expect(store.error()).toBeNull();
  });

  it('ajoute le message utilisateur puis la réponse', () => {
    store.send('  Bonjour  ');

    expect(store.messages().map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: 'Réponse' },
    ]);
    expect(store.status()).toBe('idle');
  });

  it("envoie le prompt système puis l'historique", () => {
    store.send('Bonjour');

    expect(send).toHaveBeenCalledWith([SYSTEM_PROMPT, { role: 'user', content: 'Bonjour' }]);
  });

  it('ignore les messages vides', () => {
    store.send('   ');

    expect(send).not.toHaveBeenCalled();
    expect(store.isEmpty()).toBe(true);
  });

  it("ignore un nouvel envoi tant qu'une réponse est attendue", () => {
    send.mockReturnValue(new Subject<ChatReply>());

    store.send('Premier');
    store.send('Second');

    expect(send).toHaveBeenCalledTimes(1);
    expect(store.isSending()).toBe(true);
    expect(store.messages()).toHaveLength(1);
  });

  it("borne l'historique envoyé", () => {
    for (let i = 0; i < MAX_HISTORY; i++) {
      store.send(`Message ${i}`);
    }
    send.mockClear();

    store.send('Dernier');

    const [payload] = send.mock.calls[0];
    expect(payload).toHaveLength(MAX_HISTORY + 1);
    expect(payload[0]).toEqual(SYSTEM_PROMPT);
    expect(payload.at(-1)).toEqual({ role: 'user', content: 'Dernier' });
  });

  it('passe en erreur avec un message lisible, sans perdre la conversation', () => {
    send.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    store.send('Bonjour');

    expect(store.status()).toBe('error');
    expect(store.error()).toContain("Le service d'IA ne répond pas");
    expect(store.messages()).toHaveLength(1);
  });

  it('distingue une panne réseau', () => {
    send.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

    store.send('Bonjour');

    expect(store.error()).toContain('Impossible de joindre le serveur');
  });

  it('réessaie sans dupliquer le message utilisateur', () => {
    send.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.send('Bonjour');

    store.retry();

    expect(send).toHaveBeenCalledTimes(2);
    expect(store.messages().map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(store.error()).toBeNull();
    expect(store.status()).toBe('idle');
  });

  it("ne réessaie pas s'il n'y a pas d'erreur", () => {
    store.retry();

    expect(send).not.toHaveBeenCalled();
  });

  it('réinitialise la conversation', () => {
    send.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.send('Bonjour');

    store.reset();

    expect(store.isEmpty()).toBe(true);
    expect(store.status()).toBe('idle');
    expect(store.error()).toBeNull();
  });
});
