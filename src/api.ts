import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Group, Service, ServiceGroup, GroupMember, Event, Person } from './utils/ct-types';
import { state } from './state';

// Load all data from ChurchTools
export async function loadInitialData() {
    try {
        // Load groups
        const groupsResponse = await churchtoolsClient.get<Group[]>('/groups?pagesize=9999');
        state.groups = groupsResponse || [];

        // Load service groups
        const serviceGroupsResponse = await churchtoolsClient.get<ServiceGroup[]>('/servicegroups?pagesize=9999');
        state.serviceGroups = serviceGroupsResponse || [];

        // Load services
        const servicesResponse = await churchtoolsClient.get<Service[]>('/services?pagesize=9999');
        state.services = servicesResponse || [];

        return true;
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Fehler beim Laden der Daten');
    }
}

// Search for inactive members
export async function searchInactiveMembers(
    groupId: string,
    selectedServiceIds: number[],
    fromDate: string,
    toDate: string
): Promise<Array<{ person: Person; selected: boolean }>> {
    try {
        // 1. Load group members
        const members = await churchtoolsClient.get<GroupMember[]>(
            `/groups/${groupId}/members?pagesize=9999&personFields[]=email&personFields[]=firstName&personFields[]=lastName`
        );

        if (members.length === 0) {
            throw new Error('Keine Mitglieder in dieser Gruppe gefunden');
        }

        // 2. Load events with services in date range
        // Note: 'to' parameter is exclusive, so add 1 day to include events on the end date
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        const inclusiveToDate = endDate.toISOString().split('T')[0];

        const events = await churchtoolsClient.get<Event[]>(
            `/events?from=${fromDate}&to=${inclusiveToDate}&include=eventServices&pagesize=9999`
        );

        // 3. Build map of person ID -> set of service IDs they've done
        const personServiceMap = new Map<string, Set<number>>();

        events.forEach(event => {
            if (event.eventServices) {
                event.eventServices.forEach(eventService => {
                    const personIdentifier = eventService.person?.domainIdentifier;
                    const serviceId = eventService.serviceId;

                    if (personIdentifier && serviceId && selectedServiceIds.includes(serviceId)) {
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

        // 5. Map to Person objects with email
        const results = inactiveMembers.map(member => {
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

        return results;
    } catch (error) {
        throw new Error(
            error instanceof Error ? error.message : 'Fehler bei der Suche'
        );
    }
}

// Add persons to group
export async function addPersonsToGroup(targetGroupId: string, personIds: number[]) {
    let successCount = 0;
    let errorCount = 0;
    let permissionErrors = 0;
    const otherErrors: string[] = [];

    for (const personId of personIds) {
        try {
            await churchtoolsClient.patch(`/groups/${targetGroupId}/members/${personId}`, {
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
            console.error(`Failed to add person ${personId}:`, err);
        }
    }

    return { successCount, errorCount, permissionErrors, otherErrors };
}
