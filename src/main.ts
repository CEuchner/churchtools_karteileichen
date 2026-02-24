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

// Don't add the scoping class to `body` here — adding a global class
// can leak styles into the host page. We only mark the extension's
// own container below so styles remain scoped to our UI.

// Also try to attach the scoping class to the extension's own container.
// Some hosts strip classes from <body>, but we can reliably find our
// rendered extension by its heading and mark the nearest `.container`.
try {
    const heading = Array.from(document.querySelectorAll('h1')).find(h => /Karteileichen/.test(h.textContent || ''));
    if (heading) {
        const containerEl = heading.closest('.container');
        if (containerEl && !containerEl.classList.contains('karteileichen-root')) {
            containerEl.classList.add('karteileichen-root');
            containerEl.setAttribute('data-ct-extension', 'karteileichen');
        }
    }
} catch (e) {
    // silent fallback — do not interrupt the host page
}

// Ensure the modal element is marked too — some hosts render the modal
// outside our container and may strip classes. Mark it with an attribute
// so attribute-scoped CSS rules apply.
try {
    const modalEl = document.getElementById('groupModal');
    if (modalEl && !modalEl.hasAttribute('data-ct-extension')) {
        modalEl.setAttribute('data-ct-extension', 'karteileichen');
    }
} catch (e) {
    // ignore — non-critical
}

// Also add the scoping class to the modal element itself. This lets our
// existing selectors like `.karteileichen-root .modal-overlay` still apply
// if we include an alternative selector that matches the modal when it
// carries the scoping class directly.
try {
    const modalEl2 = document.getElementById('groupModal');
    if (modalEl2 && !modalEl2.classList.contains('karteileichen-root')) {
        modalEl2.classList.add('karteileichen-root');
    }
} catch (e) {
    // ignore
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
        // init complete
    } catch (error) {
        showStatus('Fehler beim Laden der Daten: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    }
}

// Initialize app and setup event listeners
initApp();
setupEventListeners();
