import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  private readonly http = inject(HttpClient);

  send(messages: any[]){
    const url = `${environment.apiUrl}/chat`;
    return this.http.post(url, { messages });
  }
}
