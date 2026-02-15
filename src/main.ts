import { churchtoolsClient } from '@churchtools/churchtools-client';

// Import modules
import { loadInitialData, searchInactiveMembers, addPersonsToGroup } from './api';
import {
    showStatus,
    hideStatus,
    populateGroupSelect,
    populateServiceCheckboxes,
    populateTargetGroupSelect,
    displayResults,
    setDateFrom,
    setDateTo,
    setDefaultDates,
} from './ui';
import { state, elements } from './state';

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
        populateGroupSelect();
        populateServiceCheckboxes();
        setDefaultDates();

        elements.groupSelect.disabled = false;
        elements.searchBtn.disabled = false;
    } catch (error) {
        showStatus('Fehler beim Laden der Daten: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    }
}

// Quick date button listeners
document.querySelectorAll('.btn-quick-from').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const months = parseInt((e.target as HTMLElement).dataset.months || '0');
        setDateFrom(months);

        document.querySelectorAll('.btn-quick-from').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
    });
});

document.querySelectorAll('.btn-quick-to').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const months = parseInt((e.target as HTMLElement).dataset.months || '0');
        setDateTo(months);

        document.querySelectorAll('.btn-quick-to').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
    });
});

// Remove active state when manually changing dates
elements.dateFrom.addEventListener('change', () => {
    document.querySelectorAll('.btn-quick-from').forEach(b => b.classList.remove('active'));
});

elements.dateTo.addEventListener('change', () => {
    document.querySelectorAll('.btn-quick-to').forEach(b => b.classList.remove('active'));
});

// Select all results checkbox
elements.selectAllResults.addEventListener('change', () => {
    const shouldSelect = elements.selectAllResults.checked;
    state.inactivePersons = state.inactivePersons.map(person => ({
        ...person,
        selected: shouldSelect,
    }));

    const checkboxes = elements.personList.querySelectorAll('input.person-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(checkbox => {
        checkbox.checked = shouldSelect;
    });

    elements.selectAllResults.indeterminate = false;
});

// Search button
elements.searchBtn.addEventListener('click', async () => {
    const groupId = elements.groupSelect.value;
    const selectedServices = Array.from(
        elements.serviceCheckboxes.querySelectorAll('input[type="checkbox"]:checked')
    ).map(checkbox => parseInt((checkbox as HTMLInputElement).value));
    const fromDate = elements.dateFrom.value;
    const toDate = elements.dateTo.value;

    if (!groupId) {
        showStatus('Bitte wähle eine Gruppe', 'error');
        return;
    }

    if (selectedServices.length === 0) {
        showStatus('Bitte wähle mindestens einen Dienst', 'error');
        return;
    }

    if (!fromDate || !toDate) {
        showStatus('Bitte gebe einen vollständigen Zeitraum ein', 'error');
        return;
    }

    elements.searchBtn.disabled = true;
    showStatus('🔄 Lade Gruppenmitglieder...', 'loading');

    try {
        showStatus('🔄 Analysiere Daten...', 'loading');
        const results = await searchInactiveMembers(groupId, selectedServices, fromDate, toDate);

        displayResults(results);

        if (results.length === 0) {
            showStatus('✓ Alle Gruppenmitglieder haben die ausgewählten Dienste gemacht', 'success');
        } else {
            showStatus(`✓ ${results.length} inaktive Person${results.length !== 1 ? 'en' : ''} gefunden`, 'success');
        }
    } catch (error) {
        showStatus('Fehler bei der Suche: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    } finally {
        elements.searchBtn.disabled = false;
    }
});

// Reset button
elements.resetBtn.addEventListener('click', () => {
    elements.groupSelect.value = '';

    elements.serviceCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });

    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    elements.dateFrom.valueAsDate = sixMonthsAgo;
    elements.dateTo.valueAsDate = today;

    elements.resultsSection.classList.remove('active');
    hideStatus();
    state.inactivePersons = [];

    document.querySelectorAll('.btn-quick').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.btn-quick-from').forEach(btn => {
        if ((btn as HTMLElement).dataset.months === '6') {
            btn.classList.add('active');
        }
    });
    document.querySelectorAll('.btn-quick-to').forEach(btn => {
        if ((btn as HTMLElement).dataset.months === '0') {
            btn.classList.add('active');
        }
    });
});

// Add to group button
elements.addToGroupBtn.addEventListener('click', () => {
    const selectedPersons = state.inactivePersons.filter(p => p.selected);

    if (selectedPersons.length === 0) {
        showStatus('Bitte wähle mindestens eine Person aus', 'error');
        return;
    }

    populateTargetGroupSelect();
    elements.groupModal.classList.add('active');
});

// Modal cancel button
elements.modalCancelBtn.addEventListener('click', () => {
    elements.groupModal.classList.remove('active');
    elements.targetGroupSelect.value = '';
});

// Modal confirm button
elements.modalConfirmBtn.addEventListener('click', async () => {
    const targetGroupId = elements.targetGroupSelect.value;
    const selectedPersons = state.inactivePersons.filter(p => p.selected);

    if (!targetGroupId) {
        showStatus('Bitte wähle eine Zielgruppe', 'error');
        return;
    }

    elements.groupModal.classList.remove('active');

    elements.addToGroupBtn.disabled = true;
    elements.modalConfirmBtn.disabled = true;
    showStatus(
        `🔄 Füge ${selectedPersons.length} Person${selectedPersons.length !== 1 ? 'en' : ''} zu Gruppe hinzu...`,
        'loading'
    );

    try {
        const personIds = selectedPersons.map(p => p.person.id);
        const { successCount, errorCount, permissionErrors, otherErrors } = await addPersonsToGroup(
            targetGroupId,
            personIds
        );

        if (errorCount === 0) {
            showStatus(
                `✓ ${successCount} Person${successCount !== 1 ? 'en' : ''} erfolgreich zur Gruppe hinzugefügt`,
                'success'
            );
        } else {
            let errorMessage = `⚠️ ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`;
            if (permissionErrors > 0) {
                errorMessage += ` (${permissionErrors}× keine Berechtigung dieser Gruppe Personen hinzuzufügen)`;
            }
            if (otherErrors.length > 0) {
                errorMessage += ` - ${otherErrors.join(', ')}`;
            }
            showStatus(errorMessage, 'error');
        }
    } catch (error) {
        showStatus(
            'Fehler beim Hinzufügen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'),
            'error'
        );
    } finally {
        elements.addToGroupBtn.disabled = false;
        elements.modalConfirmBtn.disabled = false;
        elements.targetGroupSelect.value = '';
    }
});

// Close modal when clicking outside
elements.groupModal.addEventListener('click', (e) => {
    if (e.target === elements.groupModal) {
        elements.groupModal.classList.remove('active');
        elements.targetGroupSelect.value = '';
    }
});

// Initialize app on load
initApp();
