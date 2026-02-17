import { state, elements } from './state';
import type { InactivePersonData } from './state';
import type { Service } from './utils/ct-types';

// Check if a service is visible based on user permissions
function isServiceVisible(service: Service): boolean {
    const perms = state.userPermissions;
    if (!perms) return true; // If permissions not loaded, show all (fallback)

    // 0. Check if service group has viewAll=true (public to everyone)
    if (service.serviceGroupId) {
        const serviceGroup = state.serviceGroups.find(sg => sg.id === service.serviceGroupId);
        if (serviceGroup?.viewAll) {
            return true;
        }
    }

    // 1. Check global permission: user can view entire service group
    if (service.serviceGroupId && perms.globalServiceGroupIds.includes(service.serviceGroupId)) {
        return true;
    }

    // 2. Check group-internal permissions (additive across all user groups)
    for (const userGroupId of perms.userGroupIds) {
        const groupPerms = perms.groupPermissions.get(userGroupId);
        if (!groupPerms) continue;

        // Check if this service is restricted to specific groups
        const serviceGroupIds = service.groupIds || [];
        const isServiceInUserGroup = serviceGroupIds.length === 0 || serviceGroupIds.includes(userGroupId);

        if (!isServiceInUserGroup) continue;

        // If user has +edit service in this group, show the service
        if (groupPerms.editService) {
            return true;
        }

        // If user has +view service AND user has one of the service's tags, show the service
        if (groupPerms.viewService) {
            const serviceTagIds = service.tagIds || [];
            if (serviceTagIds.length === 0 || serviceTagIds.some(tagId => perms.userTagIds.includes(tagId))) {
                return true;
            }
        }
    }

    return false;
}

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

function filterGroups(filterText: string, excludeGroupId?: string) {
    const filter = filterText.trim().toLowerCase();
    return state.groups.filter(group => {
        if (excludeGroupId && group.id.toString() === excludeGroupId) {
            return false;
        }
        if (!filter) {
            return true;
        }
        return (group.name || '').toLowerCase().includes(filter);
    });
}

function renderGroupSuggestions(container: HTMLDivElement, groups: typeof state.groups, emptyText: string) {
    container.innerHTML = '';
    if (groups.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'autocomplete-empty';
        empty.textContent = emptyText;
        container.appendChild(empty);
        container.classList.add('is-open');
        return;
    }

    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = group.name || 'Unbenannte Gruppe';
        item.dataset.groupId = group.id.toString();
        container.appendChild(item);
    });

    container.classList.add('is-open');
}

export function updateGroupSuggestions(filterText: string) {
    const groups = filterGroups(filterText);
    renderGroupSuggestions(elements.groupSuggestions, groups, 'Keine Gruppen gefunden');
}

export function updateTargetGroupSuggestions(filterText: string) {
    const groups = filterGroups(filterText, state.selectedGroupId);
    renderGroupSuggestions(elements.targetGroupSuggestions, groups, 'Keine Zielgruppen gefunden');
}

export function closeGroupSuggestions() {
    elements.groupSuggestions.classList.remove('is-open');
    elements.groupSuggestions.innerHTML = '';
}

export function closeTargetGroupSuggestions() {
    elements.targetGroupSuggestions.classList.remove('is-open');
    elements.targetGroupSuggestions.innerHTML = '';
}

export function setSelectedGroup(groupId: string) {
    const group = state.groups.find(item => item.id.toString() === groupId);
    if (!group) {
        return;
    }
    state.selectedGroupId = groupId;
    elements.groupSearch.value = group.name || 'Unbenannte Gruppe';
    closeGroupSuggestions();
}

export function setSelectedTargetGroup(groupId: string) {
    const group = state.groups.find(item => item.id.toString() === groupId);
    if (!group) {
        return;
    }
    state.selectedTargetGroupId = groupId;
    elements.targetGroupSearch.value = group.name || 'Unbenannte Gruppe';
    closeTargetGroupSuggestions();
}

export function clearGroupSelection() {
    state.selectedGroupId = '';
    elements.groupSearch.value = '';
    closeGroupSuggestions();
}

export function clearTargetGroupSelection() {
    state.selectedTargetGroupId = '';
    elements.targetGroupSearch.value = '';
    closeTargetGroupSuggestions();
}

// Populate service checkboxes with grouping
export function populateServiceCheckboxes() {
    elements.serviceCheckboxes.innerHTML = '';

    // Filter services based on user permissions
    const visibleServices = state.services.filter(service => isServiceVisible(service));

    if (visibleServices.length === 0) {
        elements.serviceCheckboxes.innerHTML = '<p style="color: #999; font-size: 14px; padding: 12px;">Keine Dienste verfügbar</p>';
        return;
    }

    // Group services by serviceGroupId
    const groupedServices = new Map<number | undefined, typeof visibleServices>();
    visibleServices.forEach(service => {
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
    const threeMonthsAhead = new Date();
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);
    elements.dateFrom.valueAsDate = sixMonthsAgo;
    elements.dateTo.valueAsDate = threeMonthsAhead;

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
}
