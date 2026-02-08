# New Lantern PACS - Onboarding Status Portal

A multi-tenant web application for managing PACS onboarding processes across multiple partner organizations. Built with React, tRPC, and MySQL with strict partner data isolation.

## Architecture Overview

This application implements a **three-tier access control system** with partner-level data isolation:

### Access Levels

1. **Platform Admins** (New Lantern Staff)
   - Email domain: `@newlantern.ai`
   - Access: ALL organizations across ALL partners
   - URL: `/org/admin`

2. **Partner Admins** (RadOne, SRV, etc.)
   - Email domains: `@radone.com`, `@srv.com`
   - Access: Only their partner's organizations
   - URLs: `/org/RadOne/admin`, `/org/SRV/admin`

3. **Hospital Users**
   - Access: Their own organization's intake form
   - URL: `/org/{hospital-slug}/intake`

### Data Hierarchy

```
New Lantern
-Clients (Partners ID Rad One)
└── Organizations (Hospitals)
    ├── Users
    ├── Responses
    ├── Files
    └── Activity Feed
-Clients (Partners ID SRV)
└── Organizations (Hospitals)
    ├── Users
    ├── Responses
    ├── Files
    └── Activity Feed
```

## Tech Stack

- **Frontend**: React 19 + Tailwind CSS 4 + Wouter (routing)
- **Backend**: Express 4 + tRPC 11 + Drizzle ORM
- **Database**: MySQL/TiDB
- **Authentication**: Email/Password + OAuth
- **File Storage**: S3-compatible storage
- **Testing**: Vitest

## Key Features

### Partner Isolation
- **Database-level filtering**: All queries automatically filter by `clientId`
- **Email-based access control**: User's email domain determines partner assignment
- **Auto-assignment**: New organizations/users automatically tagged with correct `clientId`
- **Zero cross-contamination**: Partners cannot access each other's data

### Intake Form System
- **51 questions** across 6 sections
- **Workflow diagrams**: Visual configuration for Orders, Images, Priors, Reports
- **File uploads**: Google Drive integration for configuration files
- **Progress tracking**: Section-level completion status
- **Auto-save**: Responses saved in real-time

### Admin Dashboards
- **Organization management**: Create, view, update hospital organizations
- **User management**: Create users with automatic partner assignment
- **File management**: View and manage uploaded configuration files
- **Activity feed**: Track updates from Linear/ClickUp

## Getting Started

### Prerequisites
- Node.js 22+
- MySQL 8+ or TiDB
- pnpm 9+

### Installation

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

The following environment variables are automatically injected:

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Session cookie signing secret
- `VITE_APP_ID` - OAuth application ID
- `OAUTH_SERVER_URL` - OAuth backend URL
- `VITE_OAUTH_PORTAL_URL` - OAuth login portal URL

See `.env.example` for additional configuration options.

## Project Structure

```
client/
  src/
    pages/              # Page components
      PlatformAdmin.tsx # New Lantern admin dashboard
      PartnerAdmin.tsx  # Partner admin dashboard (reusable)
      IntakeNewRedesign.tsx # Hospital intake form
    components/         # Reusable UI components
      WorkflowDiagram.tsx # Visual workflow configuration
    lib/trpc.ts         # tRPC client setup

server/
  routers/
    admin.ts            # Admin CRUD operations with partner filtering
    intake.ts           # Intake form operations
  db.ts                 # Database query helpers
  _core/              # Framework-level code (OAuth, context, etc.)

drizzle/
  schema.ts             # Database schema definitions
  migrations/           # Database migration files

shared/
  questionnaireData.ts  # Intake form questions and structure
  types.ts              # Shared TypeScript types
```

## Database Schema

See [DATA_DICTIONARY.md](./DATA_DICTIONARY.md) for complete schema documentation.

## Partner Isolation

See [TENANCY.md](./TENANCY.md) for detailed explanation of the multi-tenant architecture.

## Development Workflow

### Adding a New Partner

1. Insert client record:
```sql
INSERT INTO clients (name, slug, description, status) 
VALUES ('NewPartner', 'NewPartner', 'Description', 'active');
```

2. Add route in `client/src/App.tsx`:
```tsx
<Route path="/org/NewPartner/admin">
  {() => <PartnerAdmin partnerName="NewPartner" allowedDomain="@newpartner.com" />}
</Route>
```

3. Update `createOrganization` in `server/routers/admin.ts` to recognize new email domain.

### Adding Questions

1. Update `shared/questionnaireData.ts` with new question definitions
2. Run `pnpm db:push` to sync schema changes
3. Questions are automatically available in the intake form

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test admin.partner-isolation.test.ts

# Watch mode
pnpm test --watch
```

## Deployment

This application is designed to be deployed on the platform with built-in hosting. The deployment process handles:

- Database migrations
- Environment variable injection
- SSL certificates
- Custom domain configuration

To deploy:
1. Save a checkpoint: `webdev_save_checkpoint`
2. Click "Publish" in the Management UI

## Security Considerations

### Partner Isolation
- **Database queries**: All queries include `WHERE clientId = ?` filter
- **Email validation**: User email domain determines partner assignment
- **Frontend guards**: React components check email domain before rendering
- **Backend validation**: tRPC procedures validate `clientId` on every request

### Authentication
- **Password hashing**: bcrypt with salt rounds = 10
- **Session management**: JWT tokens with HTTP-only cookies
- **OAuth integration**: Supports Google OAuth for SSO

### File Uploads
- **S3 storage**: Files stored in S3, not database
- **Access control**: File URLs filtered by partner `clientId`
- **Virus scanning**: (Recommended) Add ClamAV integration

## Troubleshooting

### Database Connection Issues
```bash
# Check database connection
pnpm db:push

# View database schema
pnpm drizzle-kit studio
```

### Partner Isolation Not Working
1. Check user's `clientId` in database
2. Verify email domain matches expected pattern
3. Run partner isolation tests: `pnpm test admin.partner-isolation.test.ts`

### Workflow Diagrams Not Rendering
1. Check browser console for errors
2. Verify `workflowType` prop is being passed correctly
3. Ensure workflow config questions exist in database

## Contributing

1. Create a feature branch
2. Make changes with tests
3. Run `pnpm test` to verify
4. Save checkpoint with descriptive message
5. Submit for review

## License

Proprietary - New Lantern PACS

## Support

For technical support or questions, contact the New Lantern engineering team.
