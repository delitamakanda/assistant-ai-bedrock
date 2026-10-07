import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AssistantService } from './assistant.service';

describe('AssistantService', () => {
  let service: AssistantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssistantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('poste les messages sur /chat sans double slash', () => {
    const messages = [{ role: 'user' as const, content: 'Bonjour' }];
    let reply: unknown;

    service.send(messages).subscribe((value) => (reply = value));

    const request = http.expectOne(`${environment.apiUrl}/chat`);
    expect(request.request.method).toBe('POST');
    expect(request.request.url).not.toContain('//chat');
    expect(request.request.body).toEqual({ messages });

    request.flush({ content: 'Salut !' });
    expect(reply).toEqual({ content: 'Salut !' });
  });
});
