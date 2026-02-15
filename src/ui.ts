import { state, elements } from './state';
import type { InactivePersonData } from './state';

// Show status message
export function showStatus(message: string, type: 'loading' | 'error' | 'success') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message status-${type}`;
    elements.statusMessage.style.display = 'block';
}

// Hide status message
export function hideStatus() {
    elements.statusMessage.style.display = 'none';
}

// Populate group dropdown
export function populateGroupSelect() {
    elements.groupSelect.innerHTML = '<option value="">-- Gruppe wählen --</option>';
    state.groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id.toString();
        option.textContent = group.name || 'Unbenannte Gruppe';
        elements.groupSelect.appendChild(option);
    });
}

// Populate target group select (exclude current search group)
export function populateTargetGroupSelect() {
    const currentGroupId = elements.groupSelect.value;
    elements.targetGroupSelect.innerHTML = '<option value="">-- Zielgruppe wählen --</option>';
    state.groups.forEach(group => {
        if (group.id.toString() === currentGroupId) {
            return; // Exclude the currently selected search group
        }
        const option = document.createElement('option');
        option.value = group.id.toString();
        option.textContent = group.name || 'Unbenannte Gruppe';
        elements.targetGroupSelect.appendChild(option);
    });
}

// Populate service checkboxes with grouping
export function populateServiceCheckboxes() {
    elements.serviceCheckboxes.innerHTML = '';

    if (state.services.length === 0) {
        elements.serviceCheckboxes.innerHTML = '<p style="color: #999; font-size: 14px; padding: 12px;">Keine Dienste verfügbar</p>';
        return;
    }

    // Group services by serviceGroupId
    const groupedServices = new Map<number | undefined, typeof state.services>();
    state.services.forEach(service => {
        const groupId = service.serviceGroupId;
        if (!groupedServices.has(groupId)) {
            groupedServices.set(groupId, []);
        }
        groupedServices.get(groupId)!.push(service);
    });

    // Sort and display groups
    const sortedGroupIds = Array.from(groupedServices.keys()).sort((a, b) => {
        if (a === undefined) return 1;
        if (b === undefined) return -1;

        const groupA = state.serviceGroups.find(g => g.id === a);
        const groupB = state.serviceGroups.find(g => g.id === b);
        return (groupA?.name || '').localeCompare(groupB?.name || '');
    });

    sortedGroupIds.forEach(groupId => {
        const groupServices = groupedServices.get(groupId) || [];

        if (groupId !== undefined) {
            const group = state.serviceGroups.find(g => g.id === groupId);
            const groupCheckboxId = `group_${groupId}`;

            const header = document.createElement('div');
            header.className = 'service-group-header collapsed';
            header.innerHTML = `
                <span class="service-group-toggle">▼</span>
                <input type="checkbox" id="${groupCheckboxId}" class="group-master-checkbox" data-group-id="${groupId}" />
                <label for="${groupCheckboxId}">${group?.name || 'Unbekannte Dienstgruppe'}</label>
            `;

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'service-group-items collapsed';

            const masterCheckbox = header.querySelector('input[type="checkbox"]') as HTMLInputElement;

            header.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT') {
                    itemsContainer.classList.toggle('collapsed');
                    header.classList.toggle('collapsed');
                }
            });

            masterCheckbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Add service checkboxes
            groupServices.forEach(service => {
                const item = document.createElement('div');
                item.className = 'service-checkbox-item';
                const checkboxId = `service_${service.id}`;

                item.innerHTML = `
                    <input type="checkbox" id="${checkboxId}" value="${service.id}" data-group-id="${groupId}" />
                    <label for="${checkboxId}">${service.name || 'Unbenannter Dienst'}</label>
                `;

                const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;

                item.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).tagName !== 'LABEL' && (e.target as HTMLElement).tagName !== 'INPUT') {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                checkbox.addEventListener('change', () => {
                    const allCheckboxes = itemsContainer.querySelectorAll(
                        `input[type="checkbox"]:not(.group-master-checkbox)`
                    ) as NodeListOf<HTMLInputElement>;
                    const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
                    const totalCount = allCheckboxes.length;

                    if (checkedCount === 0) {
                        masterCheckbox.checked = false;
                        masterCheckbox.indeterminate = false;
                    } else if (checkedCount === totalCount) {
                        masterCheckbox.checked = true;
                        masterCheckbox.indeterminate = false;
                    } else {
                        masterCheckbox.checked = false;
                        masterCheckbox.indeterminate = true;
                    }
                });

                itemsContainer.appendChild(item);
            });

            masterCheckbox.addEventListener('change', () => {
                const checkboxes = itemsContainer.querySelectorAll(
                    `input[type="checkbox"]:not(.group-master-checkbox)`
                ) as NodeListOf<HTMLInputElement>;
                checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
            });

            elements.serviceCheckboxes.appendChild(header);
            elements.serviceCheckboxes.appendChild(itemsContainer);
        } else {
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'service-group-items';

            groupServices.forEach(service => {
                const item = document.createElement('div');
                item.className = 'service-checkbox-item';
                const checkboxId = `service_${service.id}`;

                item.innerHTML = `
                    <input type="checkbox" id="${checkboxId}" value="${service.id}" />
                    <label for="${checkboxId}">${service.name || 'Unbenannter Dienst'}</label>
                `;

                const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;

                item.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).tagName !== 'LABEL' && (e.target as HTMLElement).tagName !== 'INPUT') {
                        checkbox.checked = !checkbox.checked;
                    }
                });

                itemsContainer.appendChild(item);
            });

            elements.serviceCheckboxes.appendChild(itemsContainer);
        }
    });
}

// Display search results
export function displayResults(persons: InactivePersonData[]) {
    state.inactivePersons = persons;
    elements.personList.innerHTML = '';
    elements.resultCount.textContent = persons.length.toString();
    elements.selectAllResults.disabled = persons.length === 0;
    elements.selectAllResults.checked = persons.length > 0 && persons.every(person => person.selected);
    elements.selectAllResults.indeterminate =
        persons.length > 0 &&
        persons.some(person => person.selected) &&
        !persons.every(person => person.selected);

    if (persons.length === 0) {
        elements.personList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Keine inaktiven Personen gefunden</p>';
        elements.resultsSection.classList.add('active');
        return;
    }

    persons.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'person-card';
        card.innerHTML = `
            <div class="person-info">
                <h3>${data.person.firstName} ${data.person.lastName}</h3>
                <p>${data.person.email || 'Keine Email'}</p>
            </div>
            <input type="checkbox" class="person-checkbox" data-index="${index}" ${data.selected ? 'checked' : ''} />
        `;

        const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement;
        card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT') {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        checkbox.addEventListener('change', (e) => {
            state.inactivePersons[parseInt((e.target as HTMLInputElement).dataset.index || '0')].selected = (e.target as HTMLInputElement).checked;
            const selectedCount = state.inactivePersons.filter(person => person.selected).length;
            elements.selectAllResults.checked = selectedCount === state.inactivePersons.length && state.inactivePersons.length > 0;
            elements.selectAllResults.indeterminate = selectedCount > 0 && selectedCount < state.inactivePersons.length;
        });

        elements.personList.appendChild(card);
    });

    elements.resultsSection.classList.add('active');
}

// Date helper
export function setDateFrom(monthsAgo: number) {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    elements.dateFrom.valueAsDate = date;
}

export function setDateTo(monthsAhead: number) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthsAhead);
    elements.dateTo.valueAsDate = date;
}

// Set default dates and buttons
export function setDefaultDates() {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    elements.dateTo.valueAsDate = today;
    elements.dateFrom.valueAsDate = sixMonthsAgo;

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
}
