# Project Status - Karteileichen (ChurchTools Extension)

**Date:** 2026-02-24  
**Version:** v1.0.5  
**Status:** ✅ COMPLETE & ENHANCED (All Priority Features Implemented)

## Development Process

This extension was developed with AI pair programming using GitHub Copilot, enabling rapid iteration and implementation of all features in a single development session.

## Overview
ChurchTools extension to identify inactive group members who haven't performed selected services within a specified time period. Users can then add these inactive members to other groups.

## ✅ Completed Features

### Phase 1: UI (Feb 14-15)
- Two-column responsive layout (group/services left, dates right)
- Mobile-responsive (stacks vertically at 768px)
- Collapsible service groups with master checkboxes
- Service list with scrolling (max-height: 500px)
- Quick date buttons for fast date range selection (3M/6M/12M ago, Today, +1M/+2M/+3M)
- Result cards with per-person checkboxes + select-all
- Indeterminate checkbox states for partial selection
- Full click-to-toggle interaction (entire rows/cards)
- Reset button with proper state management
- Professional styling (rounded buttons, clean colors, proper spacing)

### Phase 2: API Integration (Feb 15)
✅ **Real Search Logic**
- Loads group members: `GET /groups/{groupId}/members?pagesize=9999&personFields[]=email`
- Loads events with services: `GET /events?from=...&to=...&include=eventServices`
- Filters: finds members who have NOT done ANY of the selected services in the date range
- Displays results with name and email address

✅ **Add to Group Functionality**
- Modal dialog for selecting target group
- Excludes the search group from options (no self-adding)
- Uses `PUT /groups/{groupId}/members/{personId}` API
- Batch processing: adds multiple persons in one operation
- Detailed error reporting:
  - Shows count of successful/failed additions
  - Identifies permission errors (HTTP 403)
  - Shows other error messages from API
  - Deduplicates error messages

✅ **Date Range Handling**
- Inclusive date range (adds +1 day to 'to' parameter for exclusive API endpoint)
- Default: last 6 months (configurable via quick buttons)
- Mobile-friendly date picker

### Phase 3: Post-Testing Enhancements (Feb 17)
✅ **Autocomplete Group Search**
- Replaced dropdown menus with text input + autocomplete suggestions
- Real-time filtering as user types
- Keyboard navigation (Arrow keys, Enter, Escape)
- Implemented for both main group search and target group modal
- Improved UX for instances with many groups

✅ **Extended Quick Date Buttons**
- Added "Heute" (Today) button for "Von" (From) date
- Changed default "Nach" (To) date to +3 months
- Quick buttons now cover: Heute, 1M-12M backwards and 1M-12M forwards
- Enhanced date selection workflow

✅ **API Pagination Optimization**
- Added configurable `limit` parameter to `fetchAllPages()`
- Endpoint-specific limits: `/events` uses 100 (API max), `/groups` uses 200
- Safety guards: MAX_PAGES=100, signature-based duplicate detection
- Fixed `/services` endpoint (no pagination support)

✅ **Permission-Based Service Filtering**
- Implemented comprehensive permission system for service visibility
- Loads user permissions from 4 endpoints: `/whoami`, `/groups?only_my_groups=true`, `/permissions/global`, `/permissions/internal/groups`
- Filter logic respects:
  - ServiceGroup `viewAll` flag (public for everyone)
  - Global `view servicegroup` permissions
  - Group-internal `+edit service` permissions (shows service regardless of tags)
  - Group-internal `+view service` + matching user tags
- Permissions are additive across all user groups
- Only authorized services are displayed in the UI

✅ **Bug Fixes**
- Fixed state reset issue in autocomplete (target group was reset when typing in main search)
- Removed unused variable in events.ts (cleanup)
- Fixed API response handling for permissions endpoints

✅ **Production Stability & Integration Fixes (Feb 22-24)**
- Scoped extension CSS under `.karteileichen-root` and added attribute fallbacks (`[data-ct-extension="karteileichen"]`) to prevent style leakage into ChurchTools host UI.
- Added high-specificity modal fallbacks and ID-based overrides so the `#groupModal` remains styled even when rendered outside the extension container or when host strips classes.
- Runtime scoping: do not add global `body` classes; instead mark only the extension container and modal at runtime to keep host styles intact.
- Parallelized initial data loads (`loadInitialData` and `loadUserPermissions`) to reduce startup latency.
- Packaging fix: ZIP now places `index.html` and `assets/` at the archive root for ChurchTools upload compatibility.

## Technical Implementation

### Files (v1.0.3 - Enhanced)
- **index.html** (122 lines): UI structure with autocomplete inputs
- **src/styles.css** (528 lines): All styling including autocomplete overlays
- **src/main.ts** (46 lines): Entry point & initialization
- **src/state.ts** (51 lines): State management, DOM refs, UserPermissions interface
- **src/api.ts** (247 lines): ChurchTools API calls, pagination, permission loading
- **src/ui.ts** (379 lines): UI updates, DOM manipulation, autocomplete, permission filtering
- **src/events.ts** (389 lines): Event listeners with keyboard navigation
- **src/utils/ct-types.d.ts**: Auto-generated API types

### Key Code Segments

**Search Logic:**
```typescript
1. Load group members
2. Load events in date range (with eventServices)
3. Build map: person → set of services they've done
4. Filter: return members NOT in the map
5. Display results with email addresses
```

**Add to Group:**
```typescript
1. User selects persons from results
2. Clicks "Zu Gruppe hinzufügen"
3. Modal shows available groups (excluding search group)
4. User selects target group
5. PUT request for each person
6. Detailed error feedback
```

### API Endpoints Used
- `GET /whoami` — Current user info with tags
- `GET /groups?limit=200&page=X` — Load groups with pagination
- `GET /groups?only_my_groups=true` — Load user's groups for permission checks
- `GET /permissions/global` — Global permissions (view servicegroup)
- `GET /permissions/internal/groups` — Group-internal permissions (+view/+edit service)
- `GET /servicegroups?limit=200&page=X` — Load service categories with pagination
- `GET /services` — Load all services (no pagination support)
- `GET /groups/{id}/members?personFields[]=email&personFields[]=firstName&personFields[]=lastName&limit=200&page=X` — Group members with pagination
- `GET /events?from=...&to=...&limit=100&page=X&include=eventServices` — Load events (limit 100 max)
- `PUT /groups/{id}/members/{personId}` — Add person to group

## Development

### Setup
```bash
git clone <repo>
cd karteileichen
npm install
npm run dev
```

### Environment (.env)
```
VITE_BASE_URL=https://your-instance.church.tools
VITE_USERNAME=your-username
VITE_PASSWORD=your-password
VITE_KEY=your-api-key
```

### Build & Deploy
```bash
npm run build   # Creates dist/ folder
# Upload contents of dist/ to ChurchTools extension directory
```

## Testing

**To test Karteileichen:**

1. Start dev server: `npm run dev`
2. Navigate to extension in ChurchTools
3. **Select a group** with members who have service assignments
4. **Select services** you want to filter by
5. **Set date range** (e.g., last 6 months)
6. **Click "Suchen"** to find inactive members
7. **Select persons** from results
8. **Click "Zu Gruppe hinzufügen"**
9. **Choose target group** and confirm

**Expected behavior:**
- ✅ Shows only members who haven't done the selected services
- ✅ Email addresses display correctly
- ✅ Persons can be added to another group
- ✅ Errors show detailed messages

## Known Limitations

1. **Permission Filtering:** Shows all groups; relies on error handling for permissions
2. **Role Selection:** Uses group's default role (not customizable from UI)
3. **Batch Size:** Limited to page size (currently 9,999) - works for most groups

## Future Enhancements (Optional)

**Next Priority:**
- **User Preferences (KV-Store):** Save default date range, last group, favorite services
- **Duplicate Handling:** Better UX when adding person already in group

**Additional Ideas:**
- CSV export, configurable role selection, activity dashboard
- Test suite (unit, integration, E2E)
- Performance optimizations (code splitting, lazy loading, caching)

## File Structure (v1.0.4)
```
karteileichen/
├── index.html              # UI template with autocomplete inputs
├── src/
│   ├── main.ts            # Entry point (40 lines)
│   ├── state.ts           # State management + permissions (55 lines)
│   ├── api.ts             # API calls + pagination + permissions (245 lines)
│   ├── ui.ts              # UI updates + permission filtering (370 lines)
│   ├── events.ts          # Event listeners + keyboard nav (390 lines)
│   ├── styles.css         # All styling + autocomplete (520 lines)
│   ├── utils/
│   │   ├── ct-types.d.ts  # Generated API types
│   │   └── reset.css      # Base styles
│   └── vite-env.d.ts      # Vite types
├── .env                    # Configuration (not in git)
├── vite.config.ts         # Build config
├── tsconfig.json          # TypeScript config
├── package.json           # Dependencies
├── PROJECT_STATUS.md      # This file
├── TESTING_CHECKLIST.md   # Testing & feature tracking
└── key-value-store.md     # KV-Store API documentation
```

## Support
For API questions: https://forum.church.tools  
For ChurchTools documentation: https://www.church.tools

## Refactoring (v1.0.1)

✅ **Code Organization**
- Extracted CSS from HTML to separate file
- Split monolithic main.ts (890 lines) into modular architecture:
  - `state.ts`: Centralized state & DOM references
  - `api.ts`: All ChurchTools API communication
  - `ui.ts`: UI updates & rendering
  - `events.ts`: Event listener setup
  - `main.ts`: Entry point (reduced to 40 lines)
- Better maintainability & testability
- No functionality changes

---

**Changelog:**
 - **v1.0.5** (Feb 24, 2026): Scoped CSS and modal integration fixes; runtime scoping; parallelized initial data loads; packaging fix; stability improvements.
 - **v1.0.4** (Feb 18, 2026): Added Message for the case people are already member of group 
 - **v1.0.3** (Feb 18, 2026): Permission-based service filtering, all top-3 priority features completed
- **v1.0.2+** (Feb 17, 2026): Autocomplete group search, extended quick date buttons, API pagination optimization, bug fixes
- **v1.0.2** (Feb 17, 2026): PUT fix for adding members
- **v1.0.1** (Feb 15, 2026): Code refactoring to modular architecture
- **v1.0.0** (Feb 14, 2026): Initial release

**Last Updated:** Feb 24, 2026 (v1.0.5)

