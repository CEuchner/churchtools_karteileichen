import { churchtoolsClient } from '@churchtools/churchtools-client';

// Import modules
import { loadInitialData } from './api';
import { showStatus, populateServiceCheckboxes, setDefaultDates } from './ui';
import { elements } from './state';
import { setupEventListeners } from './events';

// only import reset.css in development mode to keep the production bundle small and to simulate CT environment
if (import.meta.env.MODE === 'development') {
    import('./utils/reset.css');
}

declare const window: Window &
    typeof globalThis & {
        settings: {
            base_url?: string;
        };
    };

// Initialize ChurchTools client
const baseUrl = window.settings?.base_url ?? import.meta.env.VITE_BASE_URL;
churchtoolsClient.setBaseUrl(baseUrl);

const username = import.meta.env.VITE_USERNAME;
const password = import.meta.env.VITE_PASSWORD;
if (import.meta.env.MODE === 'development' && username && password) {
    await churchtoolsClient.post('/login', { username, password });
}

// Initialize application
async function initApp() {
    try {
        await loadInitialData();
        populateServiceCheckboxes();
        setDefaultDates();

        elements.groupSearch.disabled = false;
        elements.searchBtn.disabled = false;
    } catch (error) {
        showStatus('Fehler beim Laden der Daten: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    }
}

// Initialize app and setup event listeners
initApp();
setupEventListeners();
