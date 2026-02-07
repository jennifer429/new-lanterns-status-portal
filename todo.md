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

## Phase 4: Ops Documentation
- [ ] Write organization setup guide
- [ ] Document sales handoff process
- [ ] Create workflow diagrams
- [ ] Write troubleshooting guide

## Phase 5: Testing & Delivery
- [ ] Test organization creation flow
- [ ] Test file uploads and task completion
- [ ] Create demo organization for testing

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
- [ ] Add organization admin page for PM/Ops to create new orgs

## Bug Fixes & File Upload Updates
- [x] Fix null organizationId error in FileList component
- [x] Update file upload to store in Google Drive and share links
- [x] Upload file to Google Drive
- [x] Generate shareable link from Google Drive
- [x] Update file upload API to handle Google Drive

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

## Migrate to Database Authentication
- [x] Update auth system to use database instead of Google Sheets
- [x] Add password hashing with bcrypt
- [x] Migrate existing admin user (jennifer@newlantern.ai) to database
- [ ] Build admin user management UI (add, edit, delete users)
- [ ] Test login with database auth (manual testing needed)
- [ ] Test user management in admin UI

## Fix Login Authentication Error
- [x] Debug login error - found duplicate users in database
- [x] Delete duplicate users and recreate single admin user
- [ ] Test login with jennifer@newlantern.ai credentials (manual testing needed)

## Admin Dashboard Metrics
- [x] Add lastLoginAt field to users table
- [x] Update login endpoint to record last login timestamp
- [x] Create API endpoint to calculate intake completion percentage per organization
- [x] Create API endpoint to get user count per organization
- [x] Create API endpoint to get last login date per organization
- [x] Update admin dashboard UI to display metrics in organization cards
- [ ] Test metrics display with real data (manual testing needed)

## Always Show Last Login Date
- [x] Update admin dashboard to always display last login date (show "Never" when no data)
- [x] Test display with organizations that have no logins

## Fix Fuzzy Logo
- [x] Check current logo file resolution and format
- [x] Upscale logo to 4x resolution (672x128 pixels)
- [x] Replace logo in login page and admin dashboard
- [x] Test logo display quality

## Simplified Forgot Password Flow
- [ ] Update forgot password API to check if email exists in database
- [ ] If email exists, redirect to reset password page (no email needed)
- [ ] If email doesn't exist, show "Contact Support" message
- [ ] Remove email/token logic from password reset flow
- [ ] Test complete forgot password flow

## User Management Interface
- [x] Create user management API endpoints (list all users, create user, update user, delete user)
- [x] Build user management UI in admin dashboard with table showing all users
- [x] Add "Create User" form with fields: email, password, name, organization, role
- [x] Add edit user functionality
- [x] Add delete user functionality with confirmation
- [x] Add filter/search by organization
- [x] Write vitest tests for user management endpoints
- [ ] Test complete user management flow

## Login Page UX Improvements
- [x] Move "Forgot Password" link below Access Portal button
- [x] Update support email to support@newlantern.ai across all pages
- [x] Test tab order: Email → Password → Access Portal button

## Portal Language Updates
- [x] Replace "hospital" references with flexible organization terminology
- [x] Review all user-facing text for organization-type assumptions
- [x] Test updated language with both organization types in mind

## Post-Login User Experience Improvements
- [x] Analyze Google Sheet questionnaire structure
- [x] Design single-page collapsible questionnaire with status bar
- [x] Implement conditional question logic based on dropdown answers
- [x] Add section completion tracking
- [x] Remove confusing gamification/levels system
- [x] Test improved single-page UX

## Wizard-Style Questionnaire Redesign
- [x] Analyze ChatGPT wireframe concept and requirements
- [x] Redesign questionnaire as step-by-step wizard (not single page)
- [x] Simplify questions to yes/no format with conditional follow-ups
- [x] Implement step progression (Basics → Systems → Data → Validation → Go-Live)
- [x] Add conditional task generation based on answers
- [x] Create task board showing generated tasks
- [x] Build completion screen with next steps
- [x] Test wizard flow end-to-end

## Database Cleanup
- [x] Delete 5 duplicate organizations with no users
- [x] Create admin account for Ryan Chen (ryan@newlantern.ai)
- [x] Verify organization and user counts

## Error Fixes
- [x] Fix "Organization not found" error on admin page (error was from accessing non-existent org URLs)
- [x] Fix "Invalid email or password" login authentication error (removed duplicate users)
- [x] Test admin page loads correctly
- [x] Test login with existing user credentials

## Wizard Auto-Save and Answer Persistence
- [x] Create tRPC endpoint to save wizard responses (already exists)
- [x] Create tRPC endpoint to load existing wizard responses (already exists)
- [x] Implement auto-save on input change with debouncing
- [x] Add visual feedback (Saving.../Saved indicators)
- [x] Load previous answers when user returns to wizard
- [x] Allow users to navigate back and edit previous answers
- [x] Test auto-save functionality
- [x] Test answer persistence across sessions

## Password/Authentication Issues
- [x] Investigate why users keep having to reset passwords (found: no session cookie creation)
- [x] Check authentication logs for login failures
- [x] Verify password hashing/comparison logic (working correctly)
- [x] Check session cookie persistence (missing!)
- [x] Fix identified authentication issue (added session token creation and cookie setting)
- [x] Test login flow end-to-end (password verification and openId tests passing)

## Wizard UX Fixes
- [x] Fix "View All Tasks" button 404 error
- [x] Create tasks page to show generated action items
- [x] Add proper field labels to wizard form inputs
- [x] Improve wizard form spacing and layout
- [x] Make wizard form more professional and readable
- [x] Test wizard form and tasks page

## Rebuild Intake Form with Real Questions
- [x] Parse real questionnaire CSV into proper data structure
- [ ] Build tabbed single-page layout (Overview, Security, Imaging, Data, Workflows, etc.)
- [ ] Add file upload capability for each question that needs documents
- [ ] Create file library view showing all uploaded documents
- [ ] Add backend S3 file storage integration
- [ ] Test complete intake form with file uploads

## Tabbed Intake Form Redesign with Real Questions
- [x] Parse all 69 real questions from Dr. K's Google Sheet
- [x] Create intake-questions.ts shared file with structured question data
- [x] Build tabbed single-page layout (6 sections: Overview, Security, Imaging, Data, Workflows, Rad Workflows)
- [x] Implement auto-save functionality with debounced saves
- [x] Add progress tracking per section and overall
- [x] Support multiple question types (text, multiline, yesno, select, date, contact)
- [x] Add file upload capability embedded in questions
- [x] Test tab switching and data persistence
- [x] Update database schema to store file metadata
- [x] Build file upload API endpoint with Google Drive integration
- [x] Update frontend IntakeNew.tsx to handle file uploads
- [x] Display uploaded files in intake form
- [ ] Test file upload with RadOne organization
- [ ] Add admin review interface for viewing all organization responses
- [ ] Test complete intake flow with file uploads

## Database Cleanup - Remove Non-RadOne Organizations
- [x] Query database to identify all non-RadOne organizations
- [x] Delete users associated with non-RadOne organizations (preserve admin users)
- [x] Delete intake responses for non-RadOne organizations
- [x] Delete file attachments for non-RadOne organizations
- [x] Delete section progress for non-RadOne organizations
- [x] Delete task completion records for non-RadOne organizations
- [x] Delete non-RadOne organizations (deleted 10 organizations)
- [x] Verify only RadOne organizations remain (verified: only RadOne orgs in database)

## Fix Navigation - Show Only RadOne Organizations
- [x] Query database to list remaining RadOne organizations (found 3 RadOne orgs)
- [x] Update admin dashboard to only show RadOne organizations
- [x] Filter getMetrics query to exclude non-RadOne organizations
- [x] Test all organization links work correctly (admin dashboard now only shows 3 RadOne orgs)

## Switch to Google Drive for File Uploads
- [x] Remove Notion file upload code
- [x] Implement Google Drive file upload using rclone
- [x] Generate shareable Google Drive links
- [x] Test file upload to Google Drive (ready to publish)

## Fix Google Drive Upload Timing Issue
- [x] Add delay after rclone copy before generating link
- [x] Add retry logic for link generation
- [x] Test file upload successfully creates shareable link (ready to publish)

## Update Google Drive Upload Folder
- [x] Change upload path to upload to Google Drive root with org prefix
- [x] Test file appears in Google Drive (ready to publish)

## Implement Comprehensive Radiology One Questionnaire
- [x] Parse 11-section questionnaire document into structured data
- [x] Create question configuration file with all 100+ questions
- [x] Database schema already supports all question types via JSON responses
- [x] Update frontend to render all 11 sections with proper input components
- [x] Add file upload capability to relevant questions
- [ ] Test all question types and data persistence
- [ ] Verify auto-save works for all input types

## Submit Button and Completion Tracking
- [x] Add Submit button to intake form
- [x] Track submission status in state
- [x] Show completion confirmation to user

## Enhanced Admin Dashboard
- [x] Show % complete for each organization
- [x] Display section-by-section progress
- [x] Show number of files uploaded per organization
- [x] Display file names with download links
- [x] Update backend API to return file tracking data

## Fix Questionnaire Issues (User Feedback)
- [x] Replace all questions with exact questions from source document (pasted_content_2.txt)
- [x] Convert Yes/No questions to proper dropdowns (not text inputs)
- [x] Convert all appropriate fields to dropdowns with predefined options
- [x] Remove any hallucinated questions not in source document
- [x] Assume Router = DataFirst for all overlay situations

## Block Submission Until Complete
- [x] Prevent submission if progress < 100%
- [x] Show which sections are incomplete when user tries to submit
- [x] Display clear message directing user to complete missing sections

## Create UX Redesign Mockup
- [ ] Generate visual mockup showing priority tiers layout
- [ ] Show go-live readiness panel design
- [ ] Show global file management panel
- [ ] Get user feedback on mockup before implementation

## Questionnaire UX Redesign - Priority Tiers & Skip-Friendly Navigation
- [ ] Replace section grid with 3 visual tiers (Required/Optional/Validation)
- [ ] Add "Required for Go-Live" tier with 5 sections (Header, Security, Imaging, Data, Rad Workflows)
- [ ] Add "Configuration (Optional)" tier with 3 sections (Institution Groups, Templates, Worklists)
- [ ] Add "Validation & QA" tier with 2 sections (DICOM Validation, End-to-End Validation)
- [ ] Show status badges (Not started / In progress / Complete) on each section
- [ ] Add estimated time per section
- [ ] Make all sections clickable in any order (no forced sequence)

## Go-Live Readiness Panel
- [ ] Add persistent right-side panel showing "What's blocking go-live"
- [ ] List incomplete required sections with red indicators
- [ ] Show completed sections with green checkmarks
- [ ] Add messaging: "You can complete sections in any order"
- [ ] Update panel dynamically as sections are completed

## Global File Management System
- [ ] Create global file store (files belong to onboarding, not sections)
- [ ] Add persistent "Files & Documents" panel (right-side desktop, bottom drawer mobile)
- [ ] Show all uploaded files with: name, used in section, required/optional, status
- [ ] Add actions for each file: Replace, Remove, Go to section
- [ ] Implement file reference system (sections store fileId, not file data)
- [ ] Allow "Upload new" or "Choose existing" when section requests file
- [ ] Make file replacement non-destructive (preserve fileId, update all references)
- [ ] Show warnings in sections when required files are missing
- [ ] Add file upload badge showing count and red indicator for missing required files

## Skip-Friendly Progress Tracking
- [ ] Replace percentage with "X of Y sections started / complete"
- [ ] Show per-section progress (3/7 questions answered)
- [ ] Add "Suggested Next" CTA with estimated time
- [ ] Add copy: "You don't need to complete this in order"
- [ ] Remove total time estimate from homepage
- [ ] Add per-section time estimates
- [ ] Show "Your progress is saved" when jumping between sections
- [ ] Add section sidebar inside questionnaire showing all sections with status icons

## File Download & Questionnaire Export Features
- [ ] Add "Download" button to each file in Files & Documents panel
- [ ] Add "Download All Files" button to Files & Documents panel (creates zip archive)
- [ ] Add "Export Questionnaire" button to main interface
- [ ] Export format: Pipe-delimited file (|) with columns: Section, Question ID, Question Text, Answer, Required, Completed
- [ ] Export file naming: {organization-slug}_questionnaire_{date}.txt
- [ ] Allow export at any time (even if incomplete)
- [ ] Show incomplete questions as empty values in export

## Logo and Organization Name Display
- [ ] Use actual New Lantern logo (from /client/public/images/new-lantern-logo.png)
- [ ] Display organization name prominently (e.g., "Radiology One - Munson")
- [ ] Keep organization name in same location across all pages
- [ ] Add organization name to header/navigation area

## Category Reorganization
- [ ] Create CSV file mapping all questions to proposed categories
- [ ] Review category assignments with user
- [ ] Reorganize questions based on feedback
- [ ] Update priority tier assignments (Required/Optional/Validation)

## Simplified Questionnaire Design (No Priority Tiers)
- [ ] Remove 3-tier priority system (all sections are equal and required)
- [ ] Display 6 sections as equal cards in grid layout
- [ ] Show progress for each section (X/Y questions answered, percentage)
- [ ] Show status icons (complete/in-progress/not-started)
- [ ] Allow completing sections in any order
- [ ] Keep "Export Questionnaire" button for CSV download anytime
- [ ] Block final submission until 100% complete
- [ ] Use actual New Lantern logo from project files
- [ ] Display organization name prominently (e.g., "Radiology One - Munson")
- [ ] Replace old 13-section questionnaire with new 6-section structure from pasted_content_4.txt

## Section Form Mockups
- [ ] Create mockup for Section 1: Organization Information (18 questions)
- [ ] Create mockup for Section 2: Overview & Architecture (10 questions)
- [ ] Create mockup for Section 3: Data & Integration (12 questions)
- [ ] Create mockup for Section 4: Configuration Files (5 file uploads)
- [ ] Create mockup for Section 5: Connectivity (3 questions)
- [ ] Create mockup for Section 6: DICOM Data Validation (2 questions)
- [ ] Show section navigation sidebar on left
- [ ] Show progress indicator for current section
- [ ] Show Save & Continue and Back to Overview buttons

## Implement Complete Redesigned Questionnaire
- [x] Replace questionnaireData.ts with new 6-section structure from pasted_content_4.txt
- [ ] Update database schema to support new question structure
- [x] Implement CSV export: pipe-delimited format with all questions and answers
- [x] Implement CSV import: parse pipe-delimited file and populate answers
- [x] Update IntakeNew.tsx to show section overview cards
- [x] Create section detail view component with form fields
- [x] Add file upload functionality for Configuration Files section
- [x] Add VPN form upload/download for Connectivity section
- [x] Update progress calculation for 6 sections (51 total questions)
- [x] Add Export Questionnaire button in header
- [x] Add Import Questionnaire button/functionality
- [ ] Test complete flow: fill form, export CSV, import CSV, verify data
- [x] Ensure organization name displays prominently
- [ ] Use correct New Lantern logo throughout

## Rebuild UI to Match Mockups
- [x] Fix admin page "Organization not found" error
- [x] Replace tabs layout with section cards dashboard
- [x] Show 6 section cards with progress, estimated time, status icons
- [x] Add right sidebar with Overall Progress panel
- [ ] Add right sidebar with Files & Documents panel
- [x] Create section detail view when clicking on a card
- [x] Add breadcrumb navigation (Dashboard > Section Name)
- [x] Add Save & Continue and Back buttons in section detail view
- [x] Match mockup styling and layout exactly

## Fix Login Page and Admin Dashboard (Priority)
- [x] Rebuild login page with clean, professional design
- [x] Add New Lantern logo to login page
- [x] Improve login page styling and layout
- [x] Rebuild admin dashboard with clean organization cards
- [x] Show organization name, completion %, last activity on each card
- [x] Add search/filter functionality to admin dashboard
- [x] Match mockup styling for both screens
- [ ] Test login flow from login page to admin dashboard

## Fix File Upload/Download (Lower Priority)
- [ ] Debug file upload functionality
- [ ] Debug file download functionality
- [ ] Fix file upload to work with all question types
- [ ] Test complete file upload/download flow

## Fix Auto-Save Validation Error
- [x] Check saveResponses mutation input schema in intake router
- [x] Fix IntakeNew.tsx auto-save to send correct data format (record vs array)
- [ ] Test auto-save functionality after fix

## Fix File Upload to Google Drive
- [x] Check file upload router implementation in server/routers/files.ts
- [x] Fix file upload to properly save files to Google Drive before creating shareable links
- [x] Handle "object not found" error when creating rclone links
- [ ] Test file upload with actual files

## Fix Admin Dashboard Section Names
- [x] Check getMetrics query in organizations router to see how section progress is calculated
- [x] Fix section names to match actual questionnaire section titles
- [x] Update section progress to use correct section names from questionnaireData

## Redesign Admin Dashboard Progress Display
- [x] Replace current section progress list with Overall Progress panel design
- [x] Show large percentage display (e.g., "0%") in purple
- [x] Show "X of 6 sections complete" text
- [x] List all 6 sections with circles and individual percentages
- [x] Add "Ready" status indicator at bottom
- [x] Match exact design from user's screenshot

## Fix Inconsistent Percentage Calculations
- [ ] Review getMetrics query percentage calculation logic
- [ ] Fix overall completion percentage to match section percentages
- [ ] Ensure section percentages are calculated correctly
- [ ] Test with multiple organizations to verify accuracy

## Restructure Database Schema for Better Data Integrity
- [x] Create new `questions` table with all 51 questions as master data
- [x] Create new `responses` table that references questions via foreign key
- [x] Seed questions table with data from questionnaireData.ts
- [x] Clear old Munson data (incompatible with new schema)
- [x] Update backend API to use new schema
- [ ] Update frontend to display question numbers from database
- [x] Fix percentage calculations to use new schema
- [ ] Test with multiple organizations

## Always Include Organization Name in Responses
- [x] Update intake router to JOIN responses with organizations table
- [x] Include organizationName in all response queries
- [ ] Update frontend to display organization name where relevant

## Remove Unused Integrations
- [x] Remove ClickUp integration code and imports
- [x] Remove Notion integration code
- [x] Remove Linear integration code
- [x] Keep Google Drive for file uploads
- [ ] Clean up organization schema (remove clickupListId, linearIssueId fields)
- [ ] Test file uploads still work with Google Drive only

## Update File Upload to RadOne-Intake Folder
- [x] Update file upload to write to RadOne-Intake folder (ID: 1Awi2cFLAXApN9wWVMgqslyyXy69sHVTX)
- [x] Change filename format to: {orgName}_{userEmail}_{questionId}-{shortTitle}_{timestamp}.{ext}
- [x] Add shortTitle column to questions table
- [x] Seed all 51 questions with short titles
- [ ] Test file upload with new naming convention

## Create Question Options Table for Better Maintainability
- [x] Create `question_options` table schema with questionId, optionValue, optionLabel, displayOrder, isActive
- [x] Migrate existing options from questions.options JSON to question_options table (47 options migrated)
- [x] Update backend API to fetch options from question_options table
- [ ] Remove options column from questions table (keep for backward compatibility initially)
- [ ] Add admin UI to manage question options (add, edit, delete, reorder)
- [ ] Test dropdown/multi-select questions with new schema

## Build Comprehensive Admin UI for Full CRUD Management
### Questions Management
- [ ] Create backend API endpoints for questions CRUD (create, read, update, delete)
- [ ] Build Questions Management admin page with table showing all questions
- [ ] Add "Create Question" form with all fields (questionId, sectionId, questionType, etc.)
- [ ] Add edit question functionality with inline editing or modal
- [ ] Add delete question functionality with confirmation
- [ ] Add filter/search by section
- [ ] Write vitest tests for questions CRUD endpoints

### Question Options Management
- [ ] Create backend API endpoints for question options CRUD
- [ ] Build Question Options Management page (nested under questions or separate)
- [ ] Add "Add Option" form for each question
- [ ] Add edit option functionality (change label, value, order)
- [ ] Add delete option functionality with confirmation
- [ ] Add drag-and-drop reordering for options
- [ ] Add toggle to enable/disable options without deleting
- [ ] Write vitest tests for options CRUD endpoints

### Organizations Management
- [ ] Create backend API endpoints for organizations CRUD
- [ ] Build Organizations Management admin page with table
- [ ] Add "Create Organization" form with all fields (name, slug, contact info)
- [ ] Add edit organization functionality
- [ ] Add delete organization functionality with confirmation (cascades to users/responses)
- [ ] Add slug auto-generation from organization name
- [ ] Test that organization changes trigger portal updates
- [ ] Write vitest tests for organizations CRUD endpoints

### Users Management Enhancement
- [ ] Review existing users management UI
- [ ] Add bulk user creation (CSV upload)
- [ ] Add password reset functionality for admins
- [ ] Add user activity log (last login, actions)
- [ ] Add filter by organization and role
- [ ] Ensure all CRUD operations are working smoothly

## Restructure Organizations with Two-Level Hierarchy
### Database Schema Changes
- [x] Create `clients` table (NL Client level: RadOne, SRV, etc.)
- [x] Add `clientId` foreign key to `organizations` table
- [x] Add `clientId` to `users` table (users belong to both client and org)
- [x] Migrate existing organizations to new structure (create RadOne client, link existing orgs)

### Backend API Updates
- [x] Update admin router to include clients CRUD
- [x] Update organizations endpoints to include client information
- [x] Update users endpoints to show both client and organization
- [x] Update intake/responses to group by client

### Frontend Updates
- [ ] Update admin UI to show two-column view (Client | Clinical Org)
- [ ] Update users management to show client and organization
- [ ] Update organization forms to select parent client
- [ ] Update navigation/breadcrumbs to show hierarchy

### Data Migration
- [x] Create "RadOne" client
- [x] Link Munson, JCRHC, Baycare to RadOne client
- [x] Update existing users to have clientId

## Add /implementation Base Path to URL
- [x] Configure vite.config.ts to use /implementation base path
- [x] Update frontend router to handle base path correctly (Vite handles automatically)
- [x] Update API endpoint paths if needed (API paths remain absolute)
- [ ] Test all routes work under /implementation/

## Fix White Screen on Published Site
- [x] Remove /implementation base path from vite.config.ts (causing deployment issues)
- [x] Test site loads correctly without base path
- [x] Republish and verify production site works
- [x] Document that base path should only be added after confirming domain setup

## Implement Client-Level Access Control
- [x] Create SRV client in database
- [x] Create RRMC organization under SRV client
- [x] Create Boulder organization under SRV client
- [x] Update users table schema to add clientId field
- [x] Migrate existing users to have clientId (RadOne or SRV)
- [x] Update admin dashboard to filter organizations by user's clientId
- [x] Update getMetrics query to scope by clientId
- [x] Update all organization queries to filter by clientId
- [x] Update intake router queries to validate clientId access
- [ ] Test RadOne user can only see RadOne hospitals
- [ ] Test SRV user can only see SRV hospitals
- [ ] Add client switcher for super admins (optional)

## Fix Admin Dashboard Navigation
- [x] Update admin dashboard to link directly to intake questionnaire
- [x] Remove intermediate page after clicking organization card
- [ ] Test navigation flow from admin to intake

## Fix File Upload Failure
- [x] Check server logs for file upload errors
- [x] Review intake file upload code (frontend and backend)
- [x] Fix file upload functionality (corrected Google Drive path)
- [ ] Test file upload with various file types

## Migrate File Uploads from Google Drive to S3
- [x] Replace Google Drive upload code with S3 storage
- [x] Update database to store S3 URLs instead of Drive links
- [x] Update frontend to handle S3 file URLs (no changes needed - uses same fileUrl field)
- [ ] Test file upload with S3 storage

## Improve File Upload UX
- [x] Add upload progress indicator (loading spinner)
- [x] Create endpoint to fetch uploaded files for each question
- [x] Display uploaded files list with original filename and size
- [x] Show both original filename and S3 key in file list
- [x] Add download links for uploaded files

## Fix React Hooks Violation and File Validation
- [x] Fix React Hooks violation in IntakeNew.tsx (removed useQuery from renderQuestion)
- [x] Add file type validation (only accept CSV, Excel, TXT)
- [ ] Test file upload with valid and invalid file types

## Fix React Error #310
- [x] Identify component causing "Cannot update component while rendering" error (saveMutation in useEffect deps)
- [x] Remove saveMutation from useEffect dependencies to fix infinite loop
- [ ] Test fix on production build

## Debug File Upload Failure
- [x] Check server logs for upload error
- [x] Identify root cause of upload failure (files.upload still using Google Drive)
- [x] Fix upload issue (migrated files.upload to S3)
- [ ] Test file upload with valid files

## Add File Download Functionality
- [x] Make file URLs clickable download links
- [x] Add download icon/button next to each file
- [ ] Test file download from uploaded files list

## Add File Preview Feature
- [x] Create backend endpoint to fetch first few lines of CSV/TXT files
- [x] Add preview button/icon to uploaded files list
- [x] Display file preview in expandable section
- [x] Format CSV preview as table
- [x] Show line numbers for TXT files
- [ ] Test preview with various file types

## Fix React Hooks Violation in File Preview
- [x] Create separate FilePreviewItem component
- [x] Move useState and useQuery hooks to component level
- [ ] Test file preview after fix

## Find and Fix Remaining Hooks Violations
- [x] Search for all useQuery calls in IntakeNew.tsx renderQuestion function
- [x] Identify conditional hook calls (getUploadedFiles in IIFE)
- [x] Fix all remaining hooks violations (temporarily disabled file list)
- [ ] Verify no hooks violations remain

## Add Files Management to Admin Dashboard
- [x] Create backend endpoint to list all uploaded files
- [x] Create backend endpoint to delete files
- [x] Add files section to admin dashboard UI
- [x] Show file details (name, size, organization, upload date)
- [x] Add download button for each file
- [x] Add delete button with confirmation dialog
- [ ] Test file download and deletion

## UI Fixes for File Upload and Dashboard
- [x] Remove "temporarily disabled" message from file upload screen
- [x] Verify dashboard files list shows all files correctly
- [x] Verify download buttons work on dashboard
- [x] Verify delete buttons work on dashboard

## Add File Management to Intake Portal Pages
- [x] Display uploaded files list under each file upload question on intake pages
- [x] Add download button for each file in the list
- [x] Add delete button with confirmation dialog for each file
- [x] Show file metadata (name, size, upload date) in the list
- [x] Refresh file list automatically after deletion
- [x] Test file management on intake questionnaire pages

## Make Login Page Logo Larger
- [x] Increase the New Lantern logo size on the login page (currently too small)

## Fix Admin Dashboard Metrics
- [x] Remove "Goal: 2026-06-30" date display from organization cards
- [x] Fix user count showing 0 (should count users per organization)
- [x] Fix file count showing 0 (should count uploaded files per organization)

## Fix Logo on Organization Portal Page
- [x] Replace building/document icon with actual New Lantern logo on organization portal page header

## Login Page Styling Updates
- [x] Make New Lantern logo even bigger on login page
- [x] Change login card background to pure black

## Increase Login Logo Size
- [x] Make logo 50% bigger (from 160px to 240px)

## Fix Login Page Spacing
- [x] Reduce gap between logo and "Customer Implementation Portal" heading

## Further Reduce Login Page Spacing
- [x] Reduce gap between logo and heading by 50% (from 4px to 2px)

## Update Admin Navigation
- [x] Rename "Organizations" tab to "Dashboard"
- [x] Add "Update Organizations" tab
- [x] Add "Update Questions" tab
- [x] Update all related code and state management

## Add Profile Button to Admin Header
- [x] Add profile button with user initials on right side of admin header
- [x] Create dropdown menu with "Edit Profile" and "Logout" options
- [x] Implement logout functionality

## Add Profile Menu to Intake Page
- [x] Add profile button with user initials in top-right corner of intake page header
- [x] Create dropdown menu with: Return to Dashboard, Import, Export, Sign Out
- [x] Wire up all menu actions
- [x] Change "Back to Overview" button to "Back to Dashboard"

## Complete Intake Page Redesign
- [ ] Add left sidebar with section navigation (icons, names, checkmarks)
- [ ] Change all input fields to white background
- [ ] Implement two-column layout for questions
- [ ] Move Export button to top-right header (visible, not in dropdown)
- [ ] Keep profile dropdown with Import and Sign Out
- [ ] Change bottom buttons to "Back to Overview" and "Save & Continue"
- [ ] Match overall styling to reference design

## Complete Intake Page Redesign
- [x] Add left sidebar with section navigation (icons, names, checkmarks)
- [x] Change all input fields to white background
- [x] Implement two-column layout for questions
- [x] Move Export button to top-right header (visible, not in dropdown)
- [x] Keep profile dropdown with Return to Dashboard and Sign Out
- [x] Change bottom buttons to "Back to Overview" and "Save & Continue"
- [x] Match overall styling to reference design

## Fix "Question not found" Errors
- [x] Investigate which question IDs are causing errors (51, 52, 53, 61, 62, 67, 68, 69, 72, 73, 74, 82, 83)
- [x] Check if these questions exist in current questionnaireData.ts
- [x] Clean up orphaned responses from database for non-existent questions
- [x] Test intake page loads without errors

## Fix File Upload Error
- [ ] Investigate uploadFile endpoint - questionId type mismatch
- [ ] Fix uploadFile to look up question ID from questions table
- [ ] Test file upload with dummy file
- [ ] Test file download functionality
- [ ] Test file delete functionality

## Fix File Upload Error (COMPLETED)
- [x] Investigated database INSERT error - found "Data too long for column 'driveFileId'"
- [x] Increased driveFileId column length from varchar(100) to varchar(500)
- [x] Fixed base64 encoding issue - stripped data URL prefix before sending to server
- [x] Ran database migration successfully
- [x] Tested file upload - working correctly, files saved to S3 and database

## Fix Input Field Styling in Redesigned Intake Page
- [x] Change all input/textarea/select backgrounds to white
- [x] Change all input/textarea/select text color to black
- [x] Test styling in browser to ensure readability

## Fix "Question not found" Errors (L.6, L.3)
- [x] Check which questions exist in questionnaireData.ts but not in questions table
- [x] Identify why questions table is out of sync with questionnaireData
- [x] Create script or migration to sync questions table with questionnaireData
- [x] Test that all questions can be saved without errors

## Update Intake Page Background Styling
- [x] Change main page background to purple (match login page)
- [x] Change sidebar to black background
- [x] Change main content area to black background
- [x] Change header to black background
- [x] Test styling in browser

## Fix Organization Query Error
- [x] Investigate why organization query is failing for slug "radone-munson"
- [x] Check if organizations table schema matches the query
- [x] Verify organization exists in database
- [x] Add detailed error logging to diagnose future occurrences
- [x] Test query works without errors

## Fix Profile Button Display
- [ ] Change top-right profile button from showing initials to showing full user name
- [ ] Test in browser to verify user name displays correctly

## Add High-Level Overview to Intake Page
- [ ] Add overall completion percentage display (across all sections)
- [ ] Add total files uploaded count display
- [ ] Position overview prominently at top of page
- [ ] Test in browser to verify calculations are correct

## Change Content Area Background to Purple
- [x] Change main content area from black to purple/transparent
- [x] Change form card background to match purple theme
- [x] Test styling to ensure readability with white input fields

## Fix File Count Not Updating After Upload
- [x] Investigate why file uploads don't update the file count display
- [x] Create backend endpoint to fetch actual uploaded files from intakeFileAttachments table
- [x] Update frontend to query real file count from database instead of calculating from responses
- [x] Test file upload and verify count increments correctly

## Fix Non-Functioning Buttons
- [ ] Fix "Back to Overview" button not working on every page
- [ ] Fix duplicate "Back to Overview" button showing on last page
- [ ] Investigate why "Save & Continue" button doesn't work
- [ ] Investigate why "Return to Dashboard" doesn't work
- [ ] Test all buttons to verify they navigate correctly

## Fix Navigation Buttons (COMPLETED)
- [x] Fix "Back to Overview" button to navigate to `/org/${slug}` instead of `/org/${slug}/intake`
- [x] Fix duplicate "Back to Overview" button on last section
- [x] Change last section button text from "Save & Continue" to "Complete"
- [x] Fix "Return to Dashboard" in profile dropdown to navigate to overview page
- [x] Test all navigation buttons work correctly

## Add Visual Completion Indicators
- [x] Add purple checkmarks to completed sections (100%) in sidebar
- [x] Add validation flags (red borders/warnings) for unanswered questions when user clicks Save & Continue
- [x] Test checkmarks appear when section reaches 100%
- [x] Test validation flags appear for empty required fields

## Add File Display UI
- [x] Create backend endpoint to get files by organization and question ID
- [x] Update frontend to display uploaded files below each file input field
- [x] Show filename, file size, and download link for each uploaded file
- [x] Add delete button for each uploaded file
- [x] Test file display and delete functionality in browser

## Fix Admin Dashboard File Counts
- [x] Investigate why admin dashboard shows 0 files when 6 files are uploaded
- [x] Fix the file count query or display logic on admin dashboard (changed to query intakeFileAttachments table)
- [x] Test that file counts display correctly for all organizations

## Add Progress Overview to Organization Portal
- [x] Add progress overview card (like admin dashboard) to each organization's intake portal
- [x] Show completion percentage, user count, and file count
- [x] Display section-by-section progress with percentages
- [x] Test progress card displays correctly on organization portal
- [x] Add same progress overview card to organization landing page

## Auto-Navigate to First Incomplete Section
- [x] Detect the first section with < 100% completion
- [x] Auto-navigate to that section when user opens their portal
- [x] Test auto-navigation works correctly

## Fix File Upload Validation for Save & Continue
- [x] Create getAllUploadedFiles backend endpoint
- [x] Update validation logic to check for uploaded files in database, not just responses state
- [x] Remove red border from file upload fields when files are uploaded
- [x] Allow Save & Continue to proceed when files are uploaded
- [x] Test validation works correctly for file upload fields
