import { TestBed } from '@angular/core/testing';

import { AiClientService } from './ai-client.service';

describe('AiClientService', () => {
  let service: AiClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiClientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
