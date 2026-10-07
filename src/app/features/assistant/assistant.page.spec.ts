import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AssistantPage } from './assistant.page';
import { AssistantService } from './assistant.service';

describe('AssistantPage', () => {
  let fixture: ComponentFixture<AssistantPage>;
  let root: HTMLElement;
  let send: ReturnType<typeof vi.fn>;

  const textarea = () => root.querySelector<HTMLTextAreaElement>('textarea')!;
  const sendButton = () => root.querySelector<HTMLButtonElement>('.send')!;

  async function type(value: string): Promise<void> {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    send = vi.fn(() => of({ content: 'Voici la réponse.' }));
    await TestBed.configureTestingModule({
      imports: [AssistantPage],
      providers: [{ provide: AssistantService, useValue: { send } }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantPage);
    root = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("affiche l'état vide avec des suggestions", () => {
    expect(root.querySelector('.empty')).not.toBeNull();
    expect(root.querySelectorAll('.empty li button')).toHaveLength(3);
  });

  it("désactive l'envoi tant que le champ est vide", async () => {
    expect(sendButton().disabled).toBe(true);

    await type('Bonjour');

    expect(sendButton().disabled).toBe(false);
  });

  it('envoie le message, affiche la réponse et vide le champ', async () => {
    await type('Bonjour');

    sendButton().click();
    await fixture.whenStable();

    const messages = Array.from(root.querySelectorAll('.msg p')).map((p) => p.textContent);
    expect(messages).toEqual(['Bonjour', 'Voici la réponse.']);
    expect(textarea().value).toBe('');
    expect(root.querySelector('.empty')).toBeNull();
  });

  it('envoie avec Entrée mais pas avec Maj+Entrée', async () => {
    await type('Bonjour');

    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true }));
    await fixture.whenStable();
    expect(send).not.toHaveBeenCalled();

    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await fixture.whenStable();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("lance la conversation depuis une suggestion", async () => {
    root.querySelector<HTMLButtonElement>('.empty li button')!.click();
    await fixture.whenStable();

    expect(send).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('.msg')).toHaveLength(2);
  });

  it("annonce l'erreur et propose de réessayer", async () => {
    send.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    await type('Bonjour');
    sendButton().click();
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Le service d'IA ne répond pas");

    alert.querySelector('button')!.click();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelectorAll('.msg')).toHaveLength(2);
  });

  it('repart de zéro avec « Nouvelle conversation »', async () => {
    await type('Bonjour');
    sendButton().click();
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('.ghost')!.click();
    await fixture.whenStable();

    expect(root.querySelectorAll('.msg')).toHaveLength(0);
    expect(root.querySelector('.empty')).not.toBeNull();
  });
});
