import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { AssistantStore } from './assistant.store';
import { AssistantService } from './assistant.service';

@Component({
    selector: 'app-assistant-page',
    templateUrl: './assistant.page.html',
    styleUrls: ['./assistant.page.css'],
    providers: [
      AssistantStore
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class AssistantPage implements OnInit {
  private readonly service = inject(AssistantService);
  protected readonly store = inject(AssistantStore);
  
  ngOnInit(): void {
  }

}
