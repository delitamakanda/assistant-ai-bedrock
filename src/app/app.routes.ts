import type { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: 'assistant',
        loadComponent: () => import('./features/assistant/assistant.page').then(m => m.AssistantPage)
    },
    {
        path: '',
        redirectTo: 'assistant',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: 'assistant',
    }
];