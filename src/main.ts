import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Group, Service, ServiceGroup, Person, GroupMember, Event } from './utils/ct-types';

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

const baseUrl = window.settings?.base_url ?? import.meta.env.VITE_BASE_URL;
churchtoolsClient.setBaseUrl(baseUrl);

const username = import.meta.env.VITE_USERNAME;
const password = import.meta.env.VITE_PASSWORD;
if (import.meta.env.MODE === 'development' && username && password) {
    await churchtoolsClient.post('/login', { username, password });
}

// Get DOM elements
const groupSelect = document.getElementById('groupSelect') as HTMLSelectElement;
const serviceCheckboxes = document.getElementById('serviceCheckboxes') as HTMLDivElement;
const dateFrom = document.getElementById('dateFrom') as HTMLInputElement;
const dateTo = document.getElementById('dateTo') as HTMLInputElement;
const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const addToGroupBtn = document.getElementById('addToGroupBtn') as HTMLButtonElement;
const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;
const resultsSection = document.getElementById('resultsSection') as HTMLDivElement;
const personList = document.getElementById('personList') as HTMLDivElement;
const resultCount = document.getElementById('resultCount') as HTMLSpanElement;
const selectAllResults = document.getElementById('selectAllResults') as HTMLInputElement;
const groupModal = document.getElementById('groupModal') as HTMLDivElement;
const targetGroupSelect = document.getElementById('targetGroupSelect') as HTMLSelectElement;
const modalCancelBtn = document.getElementById('modalCancelBtn') as HTMLButtonElement;
const modalConfirmBtn = document.getElementById('modalConfirmBtn') as HTMLButtonElement;

// State
interface InactivePersonData {
    person: Person;
    selected: boolean;
}

let groups: Group[] = [];
let services: Service[] = [];
let serviceGroups: ServiceGroup[] = [];
let inactivePersons: InactivePersonData[] = [];

// Initialize app
async function initApp() {
    try {
        // Load groups
        const groupsResponse = await churchtoolsClient.get<Group[]>('/groups?pagesize=9999');
        groups = groupsResponse || [];
        populateGroupSelect();

        // Load service groups
        const serviceGroupsResponse = await churchtoolsClient.get<ServiceGroup[]>('/servicegroups?pagesize=9999');
        serviceGroups = serviceGroupsResponse || [];

        // Load services
        const servicesResponse = await churchtoolsClient.get<Service[]>('/services?pagesize=9999');
        services = servicesResponse || [];
        populateServiceCheckboxes();

        // Set default dates (last 6 months)
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        dateTo.valueAsDate = today;
        dateFrom.valueAsDate = sixMonthsAgo;

        // Mark default buttons as active
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

        groupSelect.disabled = false;
        searchBtn.disabled = false;
    } catch (error) {
        showStatus('Fehler beim Laden der Daten: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    }
}

function populateGroupSelect() {
    groupSelect.innerHTML = '<option value="">-- Gruppe wählen --</option>';
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id.toString();
        option.textContent = group.name || 'Unbenannte Gruppe';
        groupSelect.appendChild(option);
    });
}

function populateTargetGroupSelect() {
    const currentGroupId = groupSelect.value;
    targetGroupSelect.innerHTML = '<option value="">-- Zielgruppe wählen --</option>';
    groups.forEach(group => {
        // Exclude the currently selected search group
        if (group.id.toString() === currentGroupId) {
            return;
        }
        const option = document.createElement('option');
        option.value = group.id.toString();
        option.textContent = group.name || 'Unbenannte Gruppe';
        targetGroupSelect.appendChild(option);
    });
}

function populateServiceCheckboxes() {
    serviceCheckboxes.innerHTML = '';
    
    if (services.length === 0) {
        serviceCheckboxes.innerHTML = '<p style="color: #999; font-size: 14px; padding: 12px;">Keine Dienste verfügbar</p>';
        return;
    }

    // Group services by serviceGroupId
    const groupedServices = new Map<number | undefined, Service[]>();
    services.forEach(service => {
        const groupId = service.serviceGroupId;
        if (!groupedServices.has(groupId)) {
            groupedServices.set(groupId, []);
        }
        groupedServices.get(groupId)!.push(service);
    });

    // Sort and display groups
    const sortedGroupIds = Array.from(groupedServices.keys()).sort((a, b) => {
        // Put ungrouped services last
        if (a === undefined) return 1;
        if (b === undefined) return -1;
        
        const groupA = serviceGroups.find(g => g.id === a);
        const groupB = serviceGroups.find(g => g.id === b);
        return (groupA?.name || '').localeCompare(groupB?.name || '');
    });

    sortedGroupIds.forEach(groupId => {
        const groupServices = groupedServices.get(groupId) || [];
        
        // Add group header with master checkbox (only for grouped services)
        if (groupId !== undefined) {
            const group = serviceGroups.find(g => g.id === groupId);
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
            
            // Make the whole header clickable to toggle visibility
            header.addEventListener('click', (e) => {
                // Only toggle on toggle-button or empty area clicks (not on checkbox/label)
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT') {
                    itemsContainer.classList.toggle('collapsed');
                    header.classList.toggle('collapsed');
                }
            });
            
            // Checkbox click should not toggle visibility
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
                
                // Make the whole item clickable
                item.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).tagName !== 'LABEL' && (e.target as HTMLElement).tagName !== 'INPUT') {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
                
                checkbox.addEventListener('change', () => {
                    // Update master checkbox state
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
                // Toggle all services in this group
                const checkboxes = itemsContainer.querySelectorAll(
                    `input[type="checkbox"]:not(.group-master-checkbox)`
                ) as NodeListOf<HTMLInputElement>;
                checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
            });
            
            serviceCheckboxes.appendChild(header);
            serviceCheckboxes.appendChild(itemsContainer);
        } else {
            // For ungrouped services, just add them without a header
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
                
                // Make the whole item clickable
                item.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).tagName !== 'LABEL' && (e.target as HTMLElement).tagName !== 'INPUT') {
                        checkbox.checked = !checkbox.checked;
                    }
                });
                
                itemsContainer.appendChild(item);
            });

            serviceCheckboxes.appendChild(itemsContainer);
        }
    });
}

function showStatus(message: string, type: 'loading' | 'error' | 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
}

function hideStatus() {
    statusMessage.style.display = 'none';
}

function setDateFrom(monthsAgo: number) {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    dateFrom.valueAsDate = date;
}

function setDateTo(monthsAhead: number) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthsAhead);
    dateTo.valueAsDate = date;
}

function displayResults(persons: InactivePersonData[]) {
    inactivePersons = persons;
    personList.innerHTML = '';
    resultCount.textContent = persons.length.toString();
    selectAllResults.disabled = persons.length === 0;
    selectAllResults.checked = persons.length > 0 && persons.every(person => person.selected);
    selectAllResults.indeterminate =
        persons.length > 0 &&
        persons.some(person => person.selected) &&
        !persons.every(person => person.selected);

    if (persons.length === 0) {
        personList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Keine inaktiven Personen gefunden</p>';
        resultsSection.classList.add('active');
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
        // Make the whole card clickable
        card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT') {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        checkbox.addEventListener('change', (e) => {
            inactivePersons[parseInt((e.target as HTMLInputElement).dataset.index || '0')].selected = (e.target as HTMLInputElement).checked;
            const selectedCount = inactivePersons.filter(person => person.selected).length;
            selectAllResults.checked = selectedCount === inactivePersons.length && inactivePersons.length > 0;
            selectAllResults.indeterminate = selectedCount > 0 && selectedCount < inactivePersons.length;
        });

        personList.appendChild(card);
    });

    resultsSection.classList.add('active');
}

// Event listeners for quick-select buttons
document.querySelectorAll('.btn-quick-from').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const months = parseInt((e.target as HTMLElement).dataset.months || '0');
        setDateFrom(months);
        
        // Highlight active button
        document.querySelectorAll('.btn-quick-from').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
    });
});

document.querySelectorAll('.btn-quick-to').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const months = parseInt((e.target as HTMLElement).dataset.months || '0');
        setDateTo(months);
        
        // Highlight active button
        document.querySelectorAll('.btn-quick-to').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
    });
});

// Remove active state when manually changing dates
dateFrom.addEventListener('change', () => {
    document.querySelectorAll('.btn-quick-from').forEach(b => b.classList.remove('active'));
});

dateTo.addEventListener('change', () => {
    document.querySelectorAll('.btn-quick-to').forEach(b => b.classList.remove('active'));
});

// Event listeners
selectAllResults.addEventListener('change', () => {
    const shouldSelect = selectAllResults.checked;
    inactivePersons = inactivePersons.map(person => ({
        ...person,
        selected: shouldSelect,
    }));

    const checkboxes = personList.querySelectorAll('input.person-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(checkbox => {
        checkbox.checked = shouldSelect;
    });

    selectAllResults.indeterminate = false;
});

searchBtn.addEventListener('click', async () => {
    const groupId = groupSelect.value;
    const selectedServices = Array.from(
        serviceCheckboxes.querySelectorAll('input[type="checkbox"]:checked')
    ).map(checkbox => parseInt((checkbox as HTMLInputElement).value));
    const fromDate = dateFrom.value;
    const toDate = dateTo.value;

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

    searchBtn.disabled = true;
    showStatus('🔄 Lade Gruppenmitglieder...', 'loading');

    try {
        // 1. Load group members
        const members = await churchtoolsClient.get<GroupMember[]>(
            `/groups/${groupId}/members?pagesize=9999&personFields[]=email&personFields[]=firstName&personFields[]=lastName`
        );

        if (members.length === 0) {
            showStatus('Keine Mitglieder in dieser Gruppe gefunden', 'error');
            resultsSection.classList.remove('active');
            return;
        }

        showStatus('🔄 Lade Events...', 'loading');

        // 2. Load events with services in date range
        // Note: 'to' parameter is exclusive, so add 1 day to include events on the end date
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        const inclusiveToDate = endDate.toISOString().split('T')[0];
        
        const events = await churchtoolsClient.get<Event[]>(
            `/events?from=${fromDate}&to=${inclusiveToDate}&include=eventServices&pagesize=9999`
        );

        showStatus('🔄 Analysiere Diensteinsätze...', 'loading');

        // 3. Build map of person ID -> set of service IDs they've done
        const personServiceMap = new Map<string, Set<number>>();
        
        events.forEach(event => {
            if (event.eventServices) {
                event.eventServices.forEach(eventService => {
                    const personIdentifier = eventService.person?.domainIdentifier;
                    const serviceId = eventService.serviceId;
                    
                    if (personIdentifier && serviceId && selectedServices.includes(serviceId)) {
                        if (!personServiceMap.has(personIdentifier)) {
                            personServiceMap.set(personIdentifier, new Set());
                        }
                        personServiceMap.get(personIdentifier)!.add(serviceId);
                    }
                });
            }
        });

        // 4. Filter members: find those who haven't done ANY of the selected services
        const inactiveMembers = members.filter(member => {
            const personIdentifier = member.person?.domainIdentifier;
            if (!personIdentifier) return false;
            
            const servicesForPerson = personServiceMap.get(personIdentifier);
            // Person is inactive if they haven't done any of the selected services
            return !servicesForPerson || servicesForPerson.size === 0;
        });

        // 5. Display results
        const results: InactivePersonData[] = inactiveMembers.map(member => {
            // Extract email from personFields (it's an object, not an array)
            const personFields = member.personFields as any;
            const email = personFields?.email || 'Keine E-Mail hinterlegt';
            
            return {
                person: {
                    id: member.personId,
                    firstName: member.person.domainAttributes.firstName,
                    lastName: member.person.domainAttributes.lastName,
                    guid: member.person.domainAttributes.guid,
                    email: email,
                } as Person,
                selected: false
            };
        });
        
        displayResults(results);
        
        if (results.length === 0) {
            showStatus('✓ Alle Gruppenmitglieder haben die ausgewählten Dienste gemacht', 'success');
        } else {
            showStatus(`✓ ${results.length} inaktive Person${results.length !== 1 ? 'en' : ''} gefunden`, 'success');
        }
    } catch (error) {
        showStatus('Fehler bei der Suche: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    } finally {
        searchBtn.disabled = false;
    }
});

resetBtn.addEventListener('click', () => {
    groupSelect.value = '';
    
    // Clear service selections
    serviceCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });
    
    // Reset date range to default (today and 6 months ago)
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    dateFrom.valueAsDate = sixMonthsAgo;
    dateTo.valueAsDate = today;
    
    resultsSection.classList.remove('active');
    hideStatus();
    inactivePersons = [];
    
    // Reset quick-button active states to defaults
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

// Add to group button - opens modal
addToGroupBtn.addEventListener('click', () => {
    const selectedPersons = inactivePersons.filter(p => p.selected);
    
    if (selectedPersons.length === 0) {
        showStatus('Bitte wähle mindestens eine Person aus', 'error');
        return;
    }
    
    // Populate target group select and show modal
    populateTargetGroupSelect();
    groupModal.classList.add('active');
});

// Modal cancel button
modalCancelBtn.addEventListener('click', () => {
    groupModal.classList.remove('active');
    targetGroupSelect.value = '';
});

// Modal confirm button - actually adds persons to group
modalConfirmBtn.addEventListener('click', async () => {
    const targetGroupId = targetGroupSelect.value;
    const selectedPersons = inactivePersons.filter(p => p.selected);
    
    if (!targetGroupId) {
        showStatus('Bitte wähle eine Zielgruppe', 'error');
        return;
    }
    
    // Close modal
    groupModal.classList.remove('active');
    
    addToGroupBtn.disabled = true;
    modalConfirmBtn.disabled = true;
    showStatus(`🔄 Füge ${selectedPersons.length} Person${selectedPersons.length !== 1 ? 'en' : ''} zu Gruppe hinzu...`, 'loading');
    
    try {
        let successCount = 0;
        let errorCount = 0;
        let permissionErrors = 0;
        let otherErrors: string[] = [];
        
        for (const personData of selectedPersons) {
            try {
                await churchtoolsClient.put(`/groups/${targetGroupId}/members/${personData.person.id}`, {
                    groupMemberStatus: 'active',
                });
                successCount++;
            } catch (err: any) {
                errorCount++;
                // Check if it's a permission error (HTTP 403)
                if (err?.response?.status === 403) {
                    permissionErrors++;
                } else {
                    const errorMsg = err?.response?.data?.message || err?.message || 'Unbekannter Fehler';
                    if (!otherErrors.includes(errorMsg)) {
                        otherErrors.push(errorMsg);
                    }
                }
                console.error(`Failed to add person ${personData.person.id}:`, err);
            }
        }
        
        if (errorCount === 0) {
            showStatus(`✓ ${successCount} Person${successCount !== 1 ? 'en' : ''} erfolgreich zur Gruppe hinzugefügt`, 'success');
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
        showStatus('Fehler beim Hinzufügen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'), 'error');
    } finally {
        addToGroupBtn.disabled = false;
        modalConfirmBtn.disabled = false;
        targetGroupSelect.value = '';
    }
});

// Close modal when clicking outside
groupModal.addEventListener('click', (e) => {
    if (e.target === groupModal) {
        groupModal.classList.remove('active');
        targetGroupSelect.value = '';
    }
});

// Initialize
initApp();
