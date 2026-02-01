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
