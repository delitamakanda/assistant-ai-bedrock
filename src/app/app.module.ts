import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { Assistant } from './features/assistant/assistant.page/assistant.page.component';

@NgModule({
  declarations: [
    AppComponent,
    Assistant.PageComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
