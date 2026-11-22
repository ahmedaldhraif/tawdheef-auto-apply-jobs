import { createDemoStore } from './store.mjs';
export const demoStore = createDemoStore({ language: new URLSearchParams(location.search).get('lang') });
export const api = demoStore.request;
