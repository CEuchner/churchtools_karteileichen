# Karteileichen - ChurchTools Extension

Find inactive group members who haven't performed specific services within a configurable time period. Quickly identify members to re-engage and add them to follow-up groups.

## Features

✅ **Autocomplete Group Search** - Type to search groups with real-time suggestions and keyboard navigation  
✅ **Permission-Based Service Filtering** - Only shows services you're authorized to view based on ChurchTools permissions  
✅ **Service-Based Filtering** - Select multiple services to filter by  
✅ **Flexible Date Ranges** - Quick buttons (Heute, 1M-12M) or custom dates  
✅ **Smart Search** - Finds members who have NOT done ANY selected service in the timeframe  
✅ **Batch Operations** - Add multiple inactive members to another group at once  
✅ **Responsive Design** - Works on desktop and mobile devices  
✅ **Email Display** - Shows member email addresses for direct contact  
✅ **Detailed Feedback** - Clear error messages for permission or validation issues  
✅ **Optimized API** - Endpoint-specific pagination with safety guards  

## Quick Start

### Prerequisites

-   Node.js (v16+)
-   npm or yarn
-   ChurchTools instance with API access

### Installation

1. Clone the repository
   ```bash
   git clone <repo-url>
   cd karteileichen
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `.env.example` if available):
   ```
   VITE_BASE_URL=https://your-instance.church.tools
   VITE_USERNAME=your-username
   VITE_PASSWORD=your-password
   VITE_KEY=karteileichen
   ```

### Optional: Using Dev Container

This project includes a dev container configuration. If you use VS Code with the "Dev Containers" extension:

1. Open the repository in VS Code
2. Click the Remote Indicator in the bottom-left corner
3. Select "Reopen in Container"

The container includes Node.js pre-installed and runs `npm install` automatically.

## Development

### Development Server

Start the development server with hot-reload:

```bash
npm run dev
```

Access the extension at `http://localhost:5173` (or as shown in terminal).

**CORS Configuration Required:**

For local development, configure CORS in your ChurchTools instance:
1. Go to "System Settings" > "Integrations" > "API" > "Cross-Origin Resource Sharing"
2. Add your dev server URL (e.g., `http://localhost:5173`)

**Safari Development Issues?**

If login works in Chrome but not Safari, Safari's stricter cookie handling is the issue:
- Safari blocks `Secure; SameSite=None` cookies on `http://localhost`
- Safari blocks third-party cookies across domains

**Fix:**
1. Use a Vite proxy so API calls go through your local server (`/api → https://your-instance.church.tools`)
2. Run dev server with **HTTPS** using [mkcert](https://github.com/FiloSottile/mkcert) for trusted certificates

With proxy + HTTPS, Safari will accept cookies like Chrome does.

### Building for Production

Build the project:

```bash
npm run build
```

Output goes to the `dist/` directory.

### Preview Production Build

Test the production build locally:

```bash
npm run preview
```

## Deployment

### Package for ChurchTools

Create a deployable ZIP file:

```bash
npm run build
npm run deploy
```

The ZIP file will be created in the `releases/` directory and contains:
- All compiled code in `dist/`
- CSS and assets (minified)
- manifest.json (if applicable)

### Install in ChurchTools

1. Go to ChurchTools Admin Panel
2. Navigate to "Extensions" or "Modules"
3. Click "Upload" or "Add Extension"
4. Select the ZIP file from `releases/`
5. Follow the installation wizard

## Usage

### Finding Inactive Members

1. **Search for a Group** - Type group name in the search field, select from suggestions
2. **Choose Services** - Select which services to filter by (collapsible groups)
3. **Set Date Range** - Use quick buttons (Heute, 1M-12M) or pick custom dates
4. **Search** - Click "Suchen" to find inactive members
5. **Review Results** - See names, email addresses, and member status
6. **Select Members** - Checkbox individual members or "Alle auswählen" for all
7. **Add to Group** - Type to search target group, select and confirm

### Tips

- **Autocomplete Search** - Type to filter groups, use Arrow keys to navigate, Enter to select, Escape to close
- **Use Quick Buttons** - "Heute" = today, "vor 3M" = last 3 months, "vor 6M" = last 6 months, etc.
- **Multiple Services** - Select multiple services to find members missing ANY of them
- **Different Groups** - Add results to a different group (e.g., "Follow-up" or "Re-engagement")
- **Reset** - Use "Zurücksetzen" to clear all selections and start over

## Technical Details

### Architecture

- **Frontend**: TypeScript + Vite
- **Styling**: Vanilla CSS (responsive grid layout)
- **State Management**: Centralized state module
- **API Client**: `@churchtools/churchtools-client`
- **Code Structure**: Modular (v1.0.1+ refactored)

### Key Files

```
src/
├── main.ts              # Entry point & initialization (46 lines)
├── state.ts             # State management & permissions (51 lines)
├── api.ts               # API calls + pagination + permissions (247 lines)
├── ui.ts                # UI updates + permission filtering (379 lines)
├── events.ts            # Event listeners + keyboard navigation (389 lines)
├── styles.css           # All styling + autocomplete (528 lines)
├── vite-env.d.ts        # TypeScript definitions
└── utils/
    ├── ct-types.d.ts    # ChurchTools API types
    └── reset.css        # Base styles
```

**Module Responsibilities:**
- `state.ts` - Global state + DOM element references
- `api.ts` - `loadInitialData()`, `searchInactiveMembers()`, `addPersonsToGroup()`
- `ui.ts` - Status messages, dropdowns, results display
- `events.ts` - Button clicks, date pickers, modal interactions

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
- `PUT /groups/{id}/members/{personId}` — Add person to group (note: PUT, not POST)

### Search Algorithm

1. Load all members from selected group
2. Load all events in date range with service assignments
3. Build map of `personId → set of services they've done`
4. Filter members: return only those NOT in the map
5. Display with email and person details

## Troubleshooting

### "Keine Mitglieder in dieser Gruppe gefunden"
- Verify the group ID and selection
- Check user has permission to view group members

### "Fehler bei der Suche" - HTTP 400/403
- Verify CORS is configured in ChurchTools
- Check API credentials in `.env`
- Ensure date range is valid

### "Keine Berechtigung dieser Gruppe Personen hinzuzufügen"
- User lacks permission to modify the target group
- Contact a group administrator or ChurchTools admin

### Nothing happens when clicking "Suchen"
- Open Developer Tools (F12) and check the Console for errors
- Check the Network tab for failed API calls
- Verify `.env` configuration is complete

## Configuration Reference

### Environment Variables

Required in `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_BASE_URL` | ChurchTools instance URL (no trailing slash) | `https://myparish.church.tools` |
| `VITE_USERNAME` | API test user account | `api_user` |
| `VITE_PASSWORD` | API user password | `secure_password` |
| `VITE_KEY` | Extension key | `karteileichen` |

### Build Process

1. TypeScript compilation
2. Vite bundling and code splitting
3. CSS minification
4. Asset optimization
5. ZIP packaging for deployment

## Support & Resources

- **ChurchTools API Docs**: https://forum.church.tools
- **Vite Documentation**: https://vitejs.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs

## Development

This extension was developed with AI assistance using GitHub Copilot.

## Project Status

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed technical documentation, implementation notes, and development guidelines.

---

**Version**: 1.0.4  
**Last Updated**: Feb 19, 2026
