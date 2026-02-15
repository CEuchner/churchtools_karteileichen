# Project Status - Karteileichen (ChurchTools Extension)

**Date:** 2026-02-15  
**Status:** ✅ COMPLETE & PRODUCTION-READY

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

## Technical Implementation

### Files
- **index.html** (~470 lines): Complete UI + CSS styling + modals
- **src/main.ts** (~640 lines): All business logic, API integration, state management
- **src/utils/ct-types.d.ts**: Auto-generated API types (34,590 lines)

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
- `GET /groups?pagesize=9999` — Load groups for dropdowns
- `GET /servicegroups?pagesize=9999` — Load service categories
- `GET /services?pagesize=9999` — Load all services
- `GET /groups/{id}/members?pagesize=9999&personFields[]=email` — Load group members with email
- `GET /events?from=...&to=...&include=eventServices` — Load events with service assignments
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

1. **Configurable Role Selection:** Let user choose group role during adding
2. **Export Results:** CSV export of inactive members
3. **Scheduling:** Save search criteria for repeated use
4. **Person Activity Dashboard:** Show when each person last did a service
5. **Notification:** Inform group leaders automaticallyabout inactive members

## File Structure
```
karteileichen/
├── index.html              # UI template + styles
├── src/
│   ├── main.ts            # Core logic
│   ├── utils/
│   │   ├── ct-types.d.ts  # Generated API types
│   │   └── reset.css      # Base styles
│   └── vite-env.d.ts      # Vite types
├── .env                    # Configuration (not in git)
├── vite.config.ts         # Build config
├── tsconfig.json          # TypeScript config
├── package.json           # Dependencies
└── PROJECT_STATUS.md      # This file
```

## Support
For API questions: https://forum.church.tools  
For ChurchTools documentation: https://www.church.tools

---

**Last Updated:** Feb 15, 2026 (Session 2 complete)

