import type { Group, Service, ServiceGroup, Person } from './utils/ct-types';

// State Types
export interface InactivePersonData {
    person: Person;
    selected: boolean;
}

// Global State
export const state = {
    groups: [] as Group[],
    services: [] as Service[],
    serviceGroups: [] as ServiceGroup[],
    inactivePersons: [] as InactivePersonData[],
};

// DOM Elements
export const elements = {
    groupSelect: document.getElementById('groupSelect') as HTMLSelectElement,
    serviceCheckboxes: document.getElementById('serviceCheckboxes') as HTMLDivElement,
    dateFrom: document.getElementById('dateFrom') as HTMLInputElement,
    dateTo: document.getElementById('dateTo') as HTMLInputElement,
    searchBtn: document.getElementById('searchBtn') as HTMLButtonElement,
    resetBtn: document.getElementById('resetBtn') as HTMLButtonElement,
    addToGroupBtn: document.getElementById('addToGroupBtn') as HTMLButtonElement,
    statusMessage: document.getElementById('statusMessage') as HTMLDivElement,
    resultsSection: document.getElementById('resultsSection') as HTMLDivElement,
    personList: document.getElementById('personList') as HTMLDivElement,
    resultCount: document.getElementById('resultCount') as HTMLSpanElement,
    selectAllResults: document.getElementById('selectAllResults') as HTMLInputElement,
    groupModal: document.getElementById('groupModal') as HTMLDivElement,
    targetGroupSelect: document.getElementById('targetGroupSelect') as HTMLSelectElement,
    modalCancelBtn: document.getElementById('modalCancelBtn') as HTMLButtonElement,
    modalConfirmBtn: document.getElementById('modalConfirmBtn') as HTMLButtonElement,
};
