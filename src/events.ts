import { state, elements } from './state';
import {
    showStatus,
    hideStatus,
    updateGroupSuggestions,
    updateTargetGroupSuggestions,
    closeGroupSuggestions,
    closeTargetGroupSuggestions,
    setSelectedGroup,
    setSelectedTargetGroup,
    clearGroupSelection,
    clearTargetGroupSelection,
    displayResults,
    setDateFrom,
    setDateTo,
} from './ui';
import { searchInactiveMembers, addPersonsToGroup } from './api';

export function setupEventListeners(): void {
    setupDateButtonListeners();
    setupDateInputListeners();
    setupGroupSearch();
    setupTargetGroupSearch();
    setupSelectAllCheckbox();
    setupSearchButton();
    setupResetButton();
    setupAddToGroupButton();
    setupModalButtons();
}

function setupGroupSearch(): void {
    setupAutocomplete(
        elements.groupSearch,
        elements.groupSuggestions,
        updateGroupSuggestions,
        setSelectedGroup,
        closeGroupSuggestions
    );
}

function setupTargetGroupSearch(): void {
    setupAutocomplete(
        elements.targetGroupSearch,
        elements.targetGroupSuggestions,
        updateTargetGroupSuggestions,
        setSelectedTargetGroup,
        closeTargetGroupSuggestions
    );
}

function setupAutocomplete(
    input: HTMLInputElement,
    list: HTMLDivElement,
    updateSuggestions: (filterText: string) => void,
    onSelect: (groupId: string) => void,
    onClose: () => void
): void {
    input.addEventListener('input', () => {
        if (input === elements.groupSearch) {
            state.selectedGroupId = '';
        }
        if (input === elements.targetGroupSearch) {
            state.selectedTargetGroupId = '';
        }
        if (input.value.trim() === '') {
            onClose();
        } else {
            updateSuggestions(input.value);
        }
        resetActiveSuggestion(list);
    });

    input.addEventListener('focus', () => {
        if (input.value.trim() !== '') {
            updateSuggestions(input.value);
        }
    });

    input.addEventListener('keydown', (event) => {
        handleAutocompleteKeydown(event, list, onSelect, onClose);
    });

    list.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const item = target.closest('.autocomplete-item') as HTMLElement | null;
        if (!item || !item.dataset.groupId) {
            return;
        }
        onSelect(item.dataset.groupId);
        resetActiveSuggestion(list);
    });

    document.addEventListener('click', (event) => {
        const target = event.target as Node;
        if (!input.contains(target) && !list.contains(target)) {
            onClose();
            resetActiveSuggestion(list);
        }
    });
}

function handleAutocompleteKeydown(
    event: KeyboardEvent,
    list: HTMLDivElement,
    onSelect: (groupId: string) => void,
    onClose: () => void
): void {
    const items = Array.from(list.querySelectorAll('.autocomplete-item')) as HTMLElement[];
    if (items.length === 0) {
        return;
    }

    const currentIndex = parseInt(list.dataset.activeIndex || '-1', 10);

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = currentIndex + 1 >= items.length ? 0 : currentIndex + 1;
        setActiveSuggestion(list, items, nextIndex);
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = currentIndex - 1 < 0 ? items.length - 1 : currentIndex - 1;
        setActiveSuggestion(list, items, prevIndex);
        return;
    }

    if (event.key === 'Enter') {
        if (currentIndex >= 0 && items[currentIndex]?.dataset.groupId) {
            event.preventDefault();
            onSelect(items[currentIndex].dataset.groupId as string);
            resetActiveSuggestion(list);
        }
        return;
    }

    if (event.key === 'Escape') {
        onClose();
        resetActiveSuggestion(list);
    }
}

function setActiveSuggestion(list: HTMLDivElement, items: HTMLElement[], index: number): void {
    items.forEach(item => item.classList.remove('active'));
    const item = items[index];
    if (!item) {
        return;
    }
    item.classList.add('active');
    list.dataset.activeIndex = index.toString();

    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const listTop = list.scrollTop;
    const listBottom = listTop + list.clientHeight;

    if (itemTop < listTop) {
        list.scrollTop = itemTop;
    } else if (itemBottom > listBottom) {
        list.scrollTop = itemBottom - list.clientHeight;
    }
}

function resetActiveSuggestion(list: HTMLDivElement): void {
    list.dataset.activeIndex = '-1';
    list.querySelectorAll('.autocomplete-item.active').forEach(item => item.classList.remove('active'));
}

function setupDateButtonListeners(): void {
    // Quick date buttons - FROM
    document.querySelectorAll('.btn-quick-from').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const months = parseInt((e.target as HTMLElement).dataset.months || '0');
            setDateFrom(months);

            document.querySelectorAll('.btn-quick-from').forEach(b => b.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');
        });
    });

    // Quick date buttons - TO
    document.querySelectorAll('.btn-quick-to').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const months = parseInt((e.target as HTMLElement).dataset.months || '0');
            setDateTo(months);

            document.querySelectorAll('.btn-quick-to').forEach(b => b.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');
        });
    });
}

function setupDateInputListeners(): void {
    // Remove active state when manually changing dates
    elements.dateFrom.addEventListener('change', () => {
        document.querySelectorAll('.btn-quick-from').forEach(b => b.classList.remove('active'));
    });

    elements.dateTo.addEventListener('change', () => {
        document.querySelectorAll('.btn-quick-to').forEach(b => b.classList.remove('active'));
    });
}

function setupSelectAllCheckbox(): void {
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
}

function setupSearchButton(): void {
    elements.searchBtn.addEventListener('click', async () => {
        const groupId = state.selectedGroupId;
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
}

function setupResetButton(): void {
    elements.resetBtn.addEventListener('click', () => {
        clearGroupSelection();
        clearTargetGroupSelection();

        elements.serviceCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            (cb as HTMLInputElement).checked = false;
        });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const threeMonthsAhead = new Date();
        threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

        elements.dateFrom.valueAsDate = sixMonthsAgo;
        elements.dateTo.valueAsDate = threeMonthsAhead;

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
            if ((btn as HTMLElement).dataset.months === '3') {
                btn.classList.add('active');
            }
        });
    });
}

function setupAddToGroupButton(): void {
    elements.addToGroupBtn.addEventListener('click', () => {
        const selectedPersons = state.inactivePersons.filter(p => p.selected);

        if (selectedPersons.length === 0) {
            showStatus('Bitte wähle mindestens eine Person aus', 'error');
            return;
        }

        clearTargetGroupSelection();
        elements.groupModal.classList.add('active');
        elements.targetGroupSearch.focus();
    });
}

function setupModalButtons(): void {
    // Modal cancel button
    elements.modalCancelBtn.addEventListener('click', () => {
        elements.groupModal.classList.remove('active');
        clearTargetGroupSelection();
    });

    // Modal confirm button
    elements.modalConfirmBtn.addEventListener('click', async () => {
        const targetGroupId = state.selectedTargetGroupId;
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
            const { successCount, errorCount, permissionErrors, alreadyMembers,otherErrors } = await addPersonsToGroup(
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
                if (alreadyMembers > 0) {
                    errorMessage += ` (${alreadyMembers} Person${alreadyMembers !== 1 ? 'en' : ''} bereits Mitglied)`;
                }
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
            clearTargetGroupSelection();
        }
    });

    // Close modal when clicking outside
    elements.groupModal.addEventListener('click', (e) => {
        if (e.target === elements.groupModal) {
            elements.groupModal.classList.remove('active');
            clearTargetGroupSelection();
        }
    });
}
