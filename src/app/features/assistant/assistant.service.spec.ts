import { TestBed } from '@angular/core/testing';

import { Assistant.ServiceService } from './assistant.service.service';

describe('Assistant.ServiceService', () => {
  let service: Assistant.ServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Assistant.ServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
