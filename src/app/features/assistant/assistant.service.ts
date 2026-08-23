import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  private readonly http = inject(HttpClient);

  send(message: string) {
    const url = `${environment.apiUrl}/assistant`;
    return this.http.post(url, { message });
  }
}
