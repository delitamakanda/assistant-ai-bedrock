import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '@env/environment';
import type { ChatPayloadMessage, ChatReply } from './assistant.models';

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  private readonly http = inject(HttpClient);

  send(messages: ChatPayloadMessage[]): Observable<ChatReply> {
    const url = `${environment.apiUrl}/chat`;
    return this.http.post<ChatReply>(url, { messages });
  }
}
