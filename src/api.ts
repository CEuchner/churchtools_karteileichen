import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Group, Service, ServiceGroup, GroupMember, Event, Person } from './utils/ct-types';
import { state } from './state';
import type { UserPermissions } from './state';

const DEFAULT_LIMIT = 200;
const MAX_PAGES = 100;

async function fetchAllPages<T>(
    path: string,
    query: string = '',
    options: { supportsPagination?: boolean; limit?: number } = {}
): Promise<T[]> {
    const results: T[] = [];
    const supportsPagination = options.supportsPagination ?? true;
    const limit = options.limit ?? DEFAULT_LIMIT;
    let page = 1;
    let lastSignature = '';

    while (true) {
        if (!supportsPagination) {
            const url = query ? `${path}?${query}` : path;
            const response = await churchtoolsClient.get<any>(url);
            const data = Array.isArray(response) ? response : response?.data ?? [];
            return data;
        }

        if (page > MAX_PAGES) {
            throw new Error(`Pagination abort for ${path}: exceeded ${MAX_PAGES} pages`);
        }

        const joiner = query ? '&' : '';
        const url = `${path}?${query}${joiner}limit=${limit}&page=${page}`;
        const response = await churchtoolsClient.get<any>(url);

        const data = Array.isArray(response) ? response : response?.data ?? [];
        results.push(...data);

        const meta = !Array.isArray(response) ? response?.meta?.pagination : undefined;
        if (meta && page >= meta.lastPage) {
            break;
        }

        if (!meta && data.length === 0) {
            break;
        }

        if (!meta) {
            const firstId = (data[0] as any)?.id ?? '';
            const lastId = (data[data.length - 1] as any)?.id ?? '';
            const signature = `${data.length}:${firstId}:${lastId}`;
            if (signature === lastSignature) {
                break;
            }
            lastSignature = signature;
        }

        if (!meta && data.length < limit) {
            break;
        }

        page += 1;
    }

    return results;
}

// Load user permissions
export async function loadUserPermissions(): Promise<UserPermissions> {
    try {
        // 1. Get current user info with tags
        const whoamiResponse = await churchtoolsClient.get<any>('/whoami');
        const whoami = whoamiResponse.data || whoamiResponse;
        const userId = whoami.id;
        const userTagIds = (whoami.tags || []).map((tag: any) => tag.id);

        // 2. Get user's groups
        const userGroups = await fetchAllPages<Group>('/groups', 'only_my_groups=true');
        const userGroupIds = userGroups.map(g => g.id);

        // 3. Get global permissions
        const globalPermsResponse = await churchtoolsClient.get<any>('/permissions/global');
        const globalPerms = globalPermsResponse.data || globalPermsResponse;
        const viewServiceGroupPerms = globalPerms?.churchservice?.['view servicegroup'] || [];
        const globalServiceGroupIds = Array.isArray(viewServiceGroupPerms) ? viewServiceGroupPerms : [];

        // 4. Get group-internal permissions
        const internalPermsResponse = await churchtoolsClient.get<any>('/permissions/internal/groups');
        const internalPerms = internalPermsResponse.data || internalPermsResponse;
        const groupPermissions = new Map<number, { viewService: boolean; editService: boolean }>();

        for (const groupId of userGroupIds) {
            const perms = internalPerms?.[groupId]?.churchservice || {};
            groupPermissions.set(groupId, {
                viewService: perms['+view service'] === true,
                editService: perms['+edit service'] === true,
            });
        }

        return {
            userId,
            userGroupIds,
            userTagIds,
            globalServiceGroupIds,
            groupPermissions,
        };
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Fehler beim Laden der Berechtigungen');
    }
}

// Load all data from ChurchTools
export async function loadInitialData() {
    try {
        // Load user permissions first
        state.userPermissions = await loadUserPermissions();

        // Load groups
        state.groups = await fetchAllPages<Group>('/groups');

        // Load service groups
        state.serviceGroups = await fetchAllPages<ServiceGroup>('/servicegroups');

        // Load services (no pagination support on this endpoint)
        state.services = await fetchAllPages<Service>('/services', '', { supportsPagination: false });

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
        const members = await fetchAllPages<GroupMember>(
            `/groups/${groupId}/members`,
            'personFields[]=email&personFields[]=firstName&personFields[]=lastName'
        );

        if (members.length === 0) {
            throw new Error('Keine Mitglieder in dieser Gruppe gefunden');
        }

        // 2. Load events with services in date range
        // Note: 'to' parameter is exclusive, so add 1 day to include events on the end date
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        const inclusiveToDate = endDate.toISOString().split('T')[0];

        const events = await fetchAllPages<Event>(
            '/events',
            `from=${fromDate}&to=${inclusiveToDate}&include=eventServices`,
            { limit: 100 }
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
            await churchtoolsClient.put(`/groups/${targetGroupId}/members/${personId}`, {
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
