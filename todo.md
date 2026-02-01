# New Lantern Implementation Portal - TODO

## Phase 1: Organization Setup & Branding
- [x] Update portal title to "New Lantern - Implementation Portal"
- [x] Add database schema for organizations, section progress, task completion
- [x] Create organizations API router
- [ ] Create organization setup admin page
- [ ] Add slug generation for unique URLs
- [ ] Create database seed script for demo data

## Phase 2: URL-based Routing & Data
- [ ] Implement dynamic routing by organization slug
- [ ] Create API endpoints for organization data
- [ ] Update Home page to load organization-specific data
- [ ] Add file upload capability for tasks
- [ ] Create updates/messages feed

## Phase 3: ClickUp/Linear Integration
- [ ] Set up ClickUp MCP integration for task creation
- [ ] Set up Linear MCP integration for issue tracking
- [ ] Create webhook handlers for hospital submissions
- [ ] Add auto-sync for section completion status

## Phase 4: Ops Documentation
- [ ] Write organization setup guide
- [ ] Document sales handoff process
- [ ] Create workflow diagrams
- [ ] Write troubleshooting guide

## Phase 5: Testing & Delivery
- [ ] Test organization creation flow
- [ ] Test file uploads and task completion
- [ ] Test ClickUp/Linear integrations
- [ ] Create demo organization for testing

## Phase 3.5: Zapier Feedback Integration
- [ ] Add activity feed table to database schema
- [ ] Create Zapier webhook endpoint for Linear comments
- [ ] Filter for @Client tagged comments
- [ ] Display activity feed in portal
- [ ] Document Zapier setup in ops guide

## Tetris-Inspired UX Redesign
- [x] Restructure checklist into 4 levels (Identity, Flow, Validation, Confidence)
- [x] Break down tasks into 10-15 minute bite-sized actions
- [x] Rewrite all task language to be supportive and plain English
- [x] Design "Next Task" prominent panel
- [x] Add visual completion with tiles/progress bars
- [x] Add "You're done for today" stopping points
- [x] Implement level locking (complete to unlock next)
- [ ] Add per-role progress tracking (IT/Clinical/Admin)

## Celebratory Messaging Updates
- [x] Replace "done for today" with motivating messages
- [x] Add "crushing it" and competitive language
- [x] Show user performance vs other users
- [x] Add celebration animations

## Achievement System
- [x] Create progressive New Lantern logo badges (25%, 50%, 75%, 100%)
- [x] Add Implementation Champion/Hero/Rock Star tier messaging
- [x] Display achievement status based on completion speed
- [x] Add visual badge progression in sidebar

## Database Persistence & File Upload
- [x] Update Home page to fetch organization data from API
- [x] Wire up task completion to save to database
- [x] Add URL-based routing (/org/:slug)
- [x] Create demo organization seed script
- [x] Add file attachments table to database schema
- [x] Create file upload API endpoint with S3 storage
- [x] Push database schema changes
- [x] Add file upload UI component for tasks
- [x] Display uploaded files in task details
- [x] Trigger ClickUp task when file is uploaded
- [ ] Add organization admin page for PM/Ops to create new orgs

## ClickUp Webhook Integration
- [x] Explore ClickUp MCP to understand available tools
- [x] Create ClickUp integration module in server
- [x] Add webhook trigger when section completes
- [x] Auto-create organization-specific lists in ClickUp
- [ ] Test task creation in ClickUp with demo organization
- [ ] Document ClickUp setup for ops team

## Bug Fixes & File Upload Updates
- [x] Fix null organizationId error in FileList component
- [x] Update file upload to store in Google Drive and share links
- [x] Upload file to Google Drive
- [x] Generate shareable link from Google Drive
- [x] Attach link to ClickUp task
- [x] Attach link to Linear issue
- [x] Update file upload API to handle Google Drive + ClickUp + Linear

## Zapier Linear Feedback Integration
- [x] Add activity feed table to database schema
- [x] Create webhook endpoint to receive Linear comments
- [x] Parse @Client tag from comment body
- [x] Save activity updates to database
- [x] Display activity feed in client portal
- [ ] Create Zapier setup documentation

## Two-Way Linear Communication
- [x] Add linearIssueId field to organizations table
- [x] Add clickupListId and googleDriveFolderId fields to organizations table
- [x] Create API endpoint to post hospital replies to Linear issue
- [x] Add reply button to ActivityFeed component
- [x] Build reply modal/form for hospital users
- [x] Tag hospital replies in Linear with organization name
- [x] Update organization creation to accept Linear/ClickUp/Drive IDs
- [x] Create admin page for PM to set up new organizations
- [x] Test two-way communication flow with demo organization
- [ ] Update ops documentation with simplified setup process

## Core Integration Flow Verification
- [x] Verify Google Drive file upload is working correctly
- [x] Update FileUpload component to pass clickupListId and linearIssueId
- [x] Verify ClickUp/Linear integration code is in place (requires MCP servers to be enabled)
- [x] Document integration setup for PM/Ops team
- [ ] Enable ClickUp and Linear MCP servers in project settings
- [ ] Test complete flow with MCP servers enabled: upload file → Google Drive → ClickUp → Linear

## Intake Portal Development
- [x] Parse Munson Client Checklist Excel file
- [x] Create intake questions database schema (sections, questions, responses)
- [x] Build progressive intake form UI
- [x] Create API endpoints for saving intake responses
- [x] Add progress tracking and completion status
- [x] Test complete intake flow
- [ ] Copy intake checklist structure to Template Client Checklist for reuse

## Navigation to Intake Form
- [x] Add prominent link/button on main portal page to access intake form
- [x] Test navigation flow from portal to intake form

## Google Sheets Authentication System
- [x] Create Google Sheets credentials template (Email, Password, OrgSlug, Role)
- [x] Build login API endpoint that reads from Google Sheets
- [x] Update login page to work with Google Sheets auth
- [x] Add redirect logic based on org slug from sheets
- [x] Add routes for login page
- [x] Create example Munson user in Google Sheets
- [x] Create Munson organization in database
- [ ] Test complete login flow (manual testing needed)
- [ ] Document Google Sheets setup for PM

## Admin Dashboard & User Management
- [ ] Build admin dashboard homepage with organization list
- [ ] Build organization creation form in admin
- [ ] Build user management page in admin
- [ ] Add user creation form with organization assignment and password
- [ ] Test admin creating users and organizations
- [ ] Create Munson organization as example

## Login Page Redesign
- [x] Update login page with dark purple background
- [x] Emphasize "IMPLEMENTATION" in branding/messaging
- [x] Test updated design

## Admin Dashboard with Client Links
- [x] Update auth system to read from "New Lantern Implementation Site - Authentication.xlsx"
- [x] Create organizations for all client sites (Munson, JCRHC, Baycare, Boulder, SouthCenter, Intellirad)
- [x] Build admin dashboard showing list of all clients
- [x] Add clickable links to each client portal
- [ ] Test admin login with jennifer@newlantern.ai credentials (manual testing needed)

## Login Page Header Redesign
- [x] Replace pixelated logo with flame icon
- [x] Add small "New Lantern ©" text in dark purple
- [x] Make "Customer Implementation Portal" the prominent heading
- [x] Test updated design

## Password Reset & Logo Update
- [x] Replace flame emoji with actual New Lantern logo
- [x] Build password reset request API endpoint (checks Google Sheets for email)
- [x] Build password reset confirmation API endpoint
- [x] Create forgot password page
- [x] Create reset password page (with token validation)
- [x] Add "Forgot Password?" link to login page
- [ ] Test complete password reset flow (manual testing needed)
