import { TestBed } from '@angular/core/testing';

import { AssistantStore } from './assistant.store';

describe('AssistantStore', () => {
  let service: AssistantStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AssistantStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
