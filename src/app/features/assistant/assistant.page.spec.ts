import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Assistant.PageComponent } from './assistant.page.component';

describe('Assistant.PageComponent', () => {
  let component: Assistant.PageComponent;
  let fixture: ComponentFixture<Assistant.PageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Assistant.PageComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(Assistant.PageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
