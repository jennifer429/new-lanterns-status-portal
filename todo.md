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
