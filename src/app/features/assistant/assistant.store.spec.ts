import { TestBed } from '@angular/core/testing';

import { Assistant.StoreService } from './assistant.store.service';

describe('Assistant.StoreService', () => {
  let service: Assistant.StoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Assistant.StoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
