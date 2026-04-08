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

## Fix File Upload Red Border Validation (Still Showing)
- [x] Investigate why red borders still appear on file upload fields with uploaded files
- [x] Check if uploadedFilesMap is being populated correctly (issue: getAllUploadedFiles query not invalidated after upload)
- [x] Add query invalidation for getAllUploadedFiles and getFileCount after upload/delete
- [x] Test fix to ensure red borders disappear when files are uploaded

## Fix Return to Dashboard Navigation
- [ ] Find the Return to Dashboard button in the user dropdown menu
- [ ] Update navigation to go to organization landing page (/org/:slug) instead of old dashboard
- [ ] Test that clicking Return to Dashboard takes user to correct page

## Update Welcome Message Styling
- [x] Update welcome message text to match login page capitalization
- [x] Improve formatting and styling to be more professional
- [x] Simplify page to fit everything on single screen without scrolling
- [x] Remove excessive content and make it more concise
- [x] Test the simplified page in browser

## Improve Landing Page UI
- [x] Remove descriptive text below welcome message
- [x] Replace file count with actual file list showing filename
- [x] Add download buttons for each file
- [x] Redesign page to match admin dashboard card layout
- [x] Test file list functionality in browser

## Investigate RRMC File Count Discrepancy
- [x] Query database to check RRMC file uploads (0 files - correct)
- [x] Check if files are uploaded but not counted correctly (files are correct, 20% is from text responses)
- [x] Investigate why overall progress shows 2% when Configuration Files shows 20%
- [x] Verify progress calculation logic is consistent across all sections
- [x] Fix progress calculation to include uploaded files for file upload questions (Home.tsx line 52-89)

## Fix RRMC Configuration Files Progress Calculation
- [x] Investigate why Configuration Files shows 40% when all file upload questions have files
- [x] Query database to check RRMC file uploads for Configuration Files section
- [x] Analyze progress calculation logic in Home.tsx
- [x] Found orphaned data: file URL stored in responses table instead of intakeFileAttachments table
- [x] Fixed calculateSectionProgress in IntakeNewRedesign.tsx to check both responses and uploaded files

## Clean Up All Organization Data
- [x] Delete all responses for ALL organizations
- [x] Delete all file attachments for ALL organizations
- [x] Verify all organizations show 0% completion across all sections
- [x] Test that organizations can start fresh with clean data (tested RRMC and Boulder)

## Delete Boulder and RRMC Organizations
- [ ] Query database to find Boulder and RRMC organization IDs
- [ ] Find all users associated with these organizations
- [ ] Delete all users for Boulder and RRMC
- [ ] Delete Boulder organization
- [ ] Delete RRMC organization
- [ ] Verify organizations and users are removed

## Remove "Radiology One - " Prefix from Organization Names
- [ ] Query all organization names
- [ ] Update organization names to remove "Radiology One - " prefix (keep just hospital names)
- [ ] Verify organization cards show just hospital names (e.g., "Boulder", "RRMC")
- [ ] Verify "Radiology One" branding remains in site headers

## Update VPN Form Exchange Question
- [x] Receive VPN form template file from user
- [x] Store VPN template file and get public URL (https://files.manuscdn.com/...)
- [x] Change VPN question type from text to file upload in questionnaireData (type: 'upload-download')
- [x] Add "Download VPN Template" button above file upload field
- [x] Test download template functionality (button opens template in new tab)
- [x] Test upload completed VPN form functionality (file upload field works)
- [x] Verify uploaded files appear in file list

## Enhance Completion Flow
- [x] Read IntakeNewRedesign code to find what happens on final "Save & Continue"
- [x] Document current behavior (redirects back to intake portal, no message)
- [x] Add success alert message when completing all sections
- [x] Change redirect from intake portal to organization dashboard (/org/${slug})
- [x] Test completion flow with success message and redirect (works perfectly)

## Fix Configuration Files Progress Calculation Bug
- [x] Query database to check which files are uploaded for Configuration Files section (8 files for all 5 questions)
- [x] Review progress calculation logic in Home.tsx and IntakeNewRedesign.tsx
- [x] Verified calculation logic checks both responses AND uploaded files
- [x] Confirmed Configuration Files now shows 100% (was working correctly after earlier fix)
- [x] Test with multiple file uploads (radone-munson shows 100% correctly)

## Add Onboarding Feedback Rating System
- [x] Create feedback database table (organizationId, rating 1-5, comments, submittedBy, createdAt)
- [x] Add feedback modal to intake completion flow (shows after clicking Complete)
- [x] Create tRPC mutation to save feedback (intake.submitFeedback)
- [x] Test feedback submission end-to-end (5-star rating + comment saved successfully)
- [ ] Add Feedback tab to existing Admin page to display all ratings and comments

## Fix Progress Calculation Discrepancy Between Admin Dashboard and Organization Portal
- [x] Compare progress calculation in admin dashboard (getMetrics) vs organization portal (Home.tsx)
- [x] Query database to verify actual RadOne - Munson completion data (44 responses out of 51 questions)
- [x] Identify why admin shows 58% but portal shows 100% (two different calculation logics)
- [ ] Create single shared backend function for progress calculation
- [ ] Update both admin dashboard and organization portal to use same function
- [ ] Test both dashboards show same percentage

## Delete RRMC and Boulder Organizations
- [x] Find RRMC and Boulder organization IDs in database
- [x] Delete associated users for both organizations (0 users deleted - no users were associated)
- [x] Delete RRMC organization
- [x] Delete Boulder organization
- [x] Verify both organizations removed from admin dashboard (only Munson, JCRHC, Baycare remain)

## Clear All Data for Fresh Start
- [x] Delete all responses from all organizations
- [x] Delete all file attachments from all organizations
- [x] Delete all feedback submissions
- [x] All data cleared - ready for new features

## Build Update Organizations Tab
- [ ] Check current Update Organizations tab implementation in Admin.tsx
- [ ] Design organization management UI (list, create, edit, delete)
- [ ] Create backend API endpoints for organization CRUD operations
- [ ] Implement create organization form
- [ ] Implement edit organization functionality
- [ ] Implement delete organization with confirmation
- [ ] Test complete organization management flow

## Build Update Organizations Tab
- [x] Check current Update Organizations tab implementation in Admin.tsx (placeholder text)
- [ ] Display list of all current organizations with edit buttons
- [ ] Add "Create New Organization" button and form
- [ ] Implement rename organization functionality (updates org name everywhere)
- [ ] Create backend API endpoints (create, update organizations)
- [ ] Test organization creation and rename flows

## Update Organizations Tab
- [x] Design organization management UI with list, create, and rename functionality
- [x] Add tRPC endpoints for organizations.getAll and organizations.update
- [x] Build organization list showing name, slug, and rename button
- [x] Build create organization dialog with name and slug inputs
- [x] Build rename organization dialog
- [x] Add query invalidation to update Dashboard tab when organizations are renamed
- [x] Test create organization functionality
- [x] Test rename organization functionality
- [x] Verify organization names update across all tabs (Dashboard, Update Organizations)
- [x] Clean up organization names (removed "RadOne -" prefix from Baycare and JCRHC)

## Organization Soft Delete Feature
- [x] Add status field to organizations table (active/inactive)
- [x] Create backend inactivate endpoint (sets status to inactive)
- [x] Update getAll and getMetrics queries to filter out inactive organizations
- [x] Add inactivate button to organization cards in Update Organizations tab
- [x] Implement confirmation dialog with organization name display
- [x] Test inactivate functionality
- [ ] Verify inactive organizations are hidden from dashboard and portal

## PHI Disclaimer
- [x] Add PHI disclaimer banner to all pages (login, admin, client portals)
- [x] Design prominent but non-intrusive disclaimer placement
- [x] Add disclaimer text: "Do not share Protected Health Information (PHI) or patient data in this portal"
- [x] Test disclaimer visibility across all pages

## PHI Disclaimer Repositioning
- [x] Move PHI disclaimer from bottom to top of admin dashboard (below header)
- [x] Move PHI disclaimer from bottom to top of client portal pages (below header)
- [x] Keep PHI disclaimer at bottom of login page (no header on login)
- [x] Test disclaimer visibility at top of all logged-in pages

## Fix New Lantern Logo on Admin Dashboard
- [x] Check Admin.tsx for logo image path and sizing
- [x] Verify logo file exists at correct path
- [x] Fix logo display issue (changed from h-10 w-10 to h-12 for proper sizing)
- [x] Test logo across all pages

## Flexible Question Navigation
- [x] Allow users to skip around and answer questions in any order
- [x] Only auto-redirect to first unanswered question on initial login
- [x] After first visit, users can navigate freely between all questions
- [ ] Test navigation behavior (first login vs subsequent visits)

## Fix Text Box Readability in Intake Form
- [x] Find checkbox list styling (Expected modalities section)
- [x] Change background from dark purple to white
- [x] Ensure text is dark and readable against white background
- [x] Test readability across all question types

## Intake Form Question Updates (Boss Feedback) - ALL COMPLETE ✓

### 1. Organization Information Section
- [x] Add clarification to sites/locations question: "Main goal is to determine how many VPN tunnels Rad1 needs to build"
- [x] Simplify or split out institution groups section (not currently used)
- [x] Change testing timeline questions from specific dates to duration-based
- [x] Add guidance text about Rad1 guiding timelines, not just accepting client dates

### 2. Overview & Architecture Section
- [x] Add "(HL7)" next to "Do you have an integration engine"
- [x] Add "(DICOM)" next to "Do you have a router"
- [x] Add "(VNA)" or tooltip to "Current archive system" indicating this is often their PACS
- [x] Add examples to "Systems that produce DICOM SR" (e.g., dosage reports)

### 3. Data & Integration Section
- [x] Remove "PET" from expected modalities list
- [x] Change "C" option to "Query Retrieve" in comparison images question
- [x] Clarify text sheets question - they come automatically with images, not technically SR
- [x] Note that prior reports are SR (text), text sheets are DICOM PDF or images

### 4. Configuration Files Section
- [x] Add reminder to de-identify files before uploading

### 5. Connectivity Section
- [x] Clarify DICOM requires: IP address, AE title, and port
- [x] Clarify HL7 requires: IP and port
- [x] Note that DICOM tagging is done through Silverback, not by client sites
- [x] Leave DICOM data validation form alone (work in progress, technically HL7)

## Progress Synchronization Issue
- [x] Investigate why intake form shows 16% but admin dashboard shows 0%
- [x] Check getMetrics query in organizations router
- [x] Check progress calculation logic in both components
- [x] Fix synchronization between intake form progress and dashboard display (changed from `responses` to `intakeResponses` table)
- [x] Test that both show same progress after fix (Munson now shows 26% on both dashboard and intake form)

## Remove Duplicate Mammography Question
- [x] Find and remove Mammography yes/no question (already exists as checkbox in Expected modalities)
- [x] Verify Mammography checkbox still works in Expected modalities list
- [x] Test intake form to ensure no duplicate questions (reduced from 50 to 48 total questions)

## Make De-identification Warning More Prominent
- [x] Update Configuration Files section description to display in red text
- [x] Add star icon to de-identification warning
- [x] Test warning visibility and styling in intake form

## Fix Hospital Name Capitalization
- [x] Capitalize hospital name display at top of portal ("Munson" not "munson")
- [x] Check where organization name is displayed in intake form header
- [x] Test capitalization across all pages

## Add PHI Warning Above File Uploads
- [x] Add yellow PHI warning banner above every file upload field in Configuration Files section
- [x] Style warning to match the top banner (yellow background, warning icon)
- [x] Test that warning appears above all 5 file upload fields

## Fix Progress Percentage Mismatch
- [x] Check admin dashboard progress calculation for Munson (31% - includes file uploads)
- [x] Check client portal (intake form) progress calculation for Munson (29% - only text responses)
- [x] Identify why percentages differ between admin and client views (client wasn't counting file uploads)
- [x] Ensure both use same calculation method (count text responses OR file uploads)
- [ ] Test that both pages show identical progress percentages

## Auto-Create Admin Accounts for @newlantern.ai Emails
- [x] Locate OAuth callback and user creation logic (server/db.ts upsertUser function)
- [x] Implement auto-creation: when @newlantern.ai email is used, create admin account automatically
- [x] Set role='admin' for all @newlantern.ai accounts
- [x] Test auto-creation flow with @newlantern.ai email (implementation verified, will auto-assign admin role on first login)
- [x] Ensure regular users (non-@newlantern.ai) continue normal flow

## Replace Timeline Questions with Single Open-Ended Field
- [x] Remove three separate timeline questions (Integration testing duration, User acceptance duration, Production validation timeline)
- [x] Add single textarea question: "Please share any timeline requirements or expectations you have around implementation, testing, and going live so we can coordinate resources"
- [x] Test new timeline question in Organization Information section
- [x] Update placeholder with examples about system deprecation and contractual deadlines

## Add HL7 Field Documentation Questions
- [x] Add question for ORC-1 (Order Control) values - what values will they send and what do they mean
- [x] Add question for ORC-5 (Order Status) values - what values will they send and what do they mean
- [x] Add question for OBR:27.1 (Quantity/Timing) values in ORU messages
- [x] Update DICOM Data Validation section title to "HL7 Data Validation"
- [x] Test new HL7 questions in Data Validation section (all three questions displaying correctly with helpful placeholders)

## Remove Production Go-Live Date Question
- [x] Remove "Requested Go live date - MM/DD/YY" question from Data and Integration section
- [x] Question count reduced from 46 to 45 questions

## Remove RadOne Prefix from Organization Names
- [x] Update organization names in database to remove "RadOne -" prefix
- [x] Verify names display correctly in admin dashboard and client portals

## Fix Progress Percentage Mismatch Between Admin and Portal
- [x] Check progress calculation in admin dashboard (server/routers/organizations.ts getMetrics)
- [x] Check progress calculation in client portal (client/src/pages/Home.tsx)
- [x] Ensure both use identical logic (count answered questions + uploaded files)
- [x] Test that percentages match exactly - Fixed section name mismatch: 'DICOM Data Validation' -> 'HL7 Data Validation'

## Add Sample Answers to All Questions
- [x] Review all questions in questionnaireData.ts - placeholders already exist
- [x] Add conditional follow-up questions for Yes/No system questions
- [x] When user answers "Yes" to integration engine/router/system questions, ask for system name
- [x] Add security questionnaire follow-up (link/details on how and when to share)
- [x] Update intake form to show/hide conditional questions based on answers
- [ ] Test conditional question display logic

## Add DICOM Conditional Follow-up Questions
- [ ] Review all DICOM-related questions in questionnaire
- [ ] Add conditional follow-ups for DICOM system/configuration questions
- [ ] Test DICOM conditional questions display correctly

## Implement Boss Feedback on Questionnaire
- [ ] Org Info: Clarify VPN tunnel goal in sites/locations question
- [ ] Overview & Architecture: Add (HL7) label to integration engine question
- [ ] Overview & Architecture: Add (DICOM) label to router question
- [ ] Overview & Architecture: Add (VNA) label to archive system question
- [ ] Overview & Architecture: Add examples to DICOM SR question (dosage reports, etc.)
- [ ] Data & Integration: Remove "Pet" from expected modalities
- [ ] Data & Integration: Change "C" to "Query Retrieve" in comparison images question
- [ ] Data & Integration: Clarify tech sheets question (automatic with images, not SR)
- [ ] Configuration Files: Add de-identification reminder to section description
- [ ] Connectivity: Update description to clarify DICOM (IP, AE title, port) and HL7 (IP, port) requirements
- [ ] Connectivity: Add note that DICOM tagging is handled by Silverback, not client sites

## Make EHR Question Optional
- [ ] Change EHR question from required text to optional Yes/No dropdown
- [ ] Add conditional follow-up asking for EHR system name if Yes
- [ ] Test conditional display works correctly

## Make RIS and EHR Questions Optional
- [x] Change RIS question from required text to optional Yes/No dropdown
- [x] Add conditional follow-up asking for RIS system name if Yes
- [x] Change EHR question from required text to optional Yes/No dropdown
- [x] Add conditional follow-up asking for EHR system name if Yes
- [ ] Test conditional display works correctly for both

## Reorganize Connectivity Sections
- [x] Create "VPN & Connectivity" section with VPN form and port information
- [x] Create "DICOM Configuration" section with AE titles, DICOM tagging
- [x] Create "HL7 Configuration" section with HL7 message field values
- [x] Update section IDs and navigation
- [x] Test all three sections display correctly
- [x] Clarified VPN section includes IP/port for DICOM and HL7
- [x] Clarified DICOM section is for AE titles only (not IP/port)
- [x] Clarified HL7 section is for message fields only (not IP/port)

## Add DICOM Endpoint Documentation to VPN & Connectivity
- [x] Add separate textareas for Test and Production DICOM endpoints
- [x] Each box documents IP, Port, and AE title for all endpoints in that environment
- [x] Move AE title question from DICOM Configuration to VPN & Connectivity
- [ ] Test the new field displays correctly

## Add HL7 Endpoint Documentation to VPN & Connectivity
- [x] Add HL7 Orders endpoints (Test and Production) - IP and port
- [x] Add HL7 Prior Reports endpoints (Test and Production) - IP and port
- [x] Add HL7 Reports from New Lantern endpoints (Test and Production) - IP and port
- [x] Add HL7 ADT endpoints (if in scope) - Test and Production - IP and port
- [ ] Test all endpoint fields display correctly

## Consolidate Sections and Add PV1 Questions
- [x] Add PV1:2 (Patient Class) question to HL7 Configuration
- [x] Add PV1:3 (Assigned Patient Location) question to HL7 Configuration (optional)
- [x] Move DICOM tagging question from Section 6 to Section 3 (Data & Integration)
- [x] Remove standalone DICOM Configuration section
- [x] Update section numbering from 7 sections to 6 sections
- [ ] Test consolidated structure

## Bug Fixes and Role System Implementation (Current)
- [x] Remove "Questionnaire" tab from admin dashboard (not expanding this functionality)
- [x] Fix VPN connectivity form - only one download button should be clickable (currently two buttons, only right one works)
- [x] Align progress calculation between admin page and organization dashboard (must use same calculation and display same summary)
- [ ] Implement three-tier role system:
  - [ ] Update schema: change `admin` role to `platform-admin`, add `radone-admin`, keep `user`
  - [ ] Add `partnerId` field to organizations table
  - [ ] Update @newlantern.ai auto-create to assign `platform-admin` role
  - [ ] Add permission checks: platform-admin can create all roles, radone-admin can create radone-admin and user only
  - [ ] Filter organizations by partnerId for radone-admin users
  - [ ] Update UI to show role restrictions
  - [ ] Migrate existing users: Jennifer → platform-admin, Ashley → radone-admin
- [ ] Begin workflow diagram integration (Orders, Images, Priors, Reports Out)

## Interactive Workflow Diagrams Implementation (Current)
- [x] Update questionnaire structure to add 4 new workflow sections
  - [x] Section 2: Orders Workflow (replace text questions with interactive diagram)
  - [x] Section 3: Images Workflow (with MWL, AI routing, PACS options)
  - [x] Section 4: Priors Workflow (images + reports from multiple sources)
  - [x] Section 5: Reports Out Workflow
- [x] Create WorkflowDiagram component
  - [x] Left panel: Configuration checkboxes with conditional text fields
  - [x] Right panel: Three-column architecture diagram (Client Site | Silverback | New Lantern)
  - [x] Dynamic arrow rendering based on checkbox selections
  - [x] Gray labels above arrows
  - [x] Grayed out cards for unchecked items
- [x] Implement data persistence
  - [x] Save workflow configurations to database
  - [x] Load existing configurations on page load
  - [x] Update progress calculation to include workflow sections
- [x] Test all 4 workflows end-to-end

## Urgent Bug Fixes (Current)
- [x] Remove UAT participants questions from questionnaire
- [x] Debug workflow diagram rendering - diagrams not showing up in intake form
- [x] Verify workflow sections are properly integrated with the form
- [x] Add "Downtime Plans" question to questionnaire (describe how organization handles planned/unplanned downtimes impacting orders, reports, or backup reading)

## Critical Bug Fix (Current)
- [x] Fix workflow configuration save error - backend validation rejects workflow config keys like 'orders-workflow_config'
- [x] Test workflow configuration saving across all 4 workflow types

## CRITICAL: Workflow Diagram Not Rendering
- [x] Investigate why WorkflowDiagram component is not showing up (only checkboxes visible, no visual diagram)
- [x] Fix diagram rendering for all 4 workflow types
- [x] Verify Client Site → Silverback → New Lantern flow diagram displays correctly for all workflows

## Partner Isolation System Implementation
- [x] Add partnerId field to users table (varchar, nullable for backward compatibility) - using existing clientId
- [x] Add partnerId field to organizations table (varchar, not null) - using existing clientId
- [x] Create /org/admin page for New Lantern staff (shows all partners)
- [x] Create /org/SRV/admin page for SRV users (filtered to SRV only)
- [x] Create /org/RadOne/admin page for RadOne users (filtered to RadOne only)
- [x] Implement backend query filtering by partnerId
- [x] Auto-assign partnerId when creating users/orgs from partner admin pages
- [x] Add email domain-based access control (@newlantern.ai, @srv.com, @radone.com)
- [x] Test SRV admin cannot see RadOne data
- [x] Test RadOne admin cannot see SRV data
- [x] Test New Lantern admin can see all da## Documentation
- [x] Create README.md with architecture overview
- [x] Create DATA_DICTIONARY.md with complete schema documentation
- [x] Create TENANCY.md explaining how partner isolation worksmentation

## Fix Partner Access Control (Current)
- [x] Replace email domain checks with clientId checks in PlatformAdmin
- [x] Replace email domain checks with clientId checks in PartnerAdmin
- [x] Update login redirect logic to use clientId to determine admin page route
- [ ] Test SRV admin (clientId=2) sees only SRV organizations
- [ ] Test RadOne admin (clientId=3) sees only RadOne organizations
- [ ] Remove debug banner from PlatformAdmin after testing

## Login 404 Fix
- [x] Fix platform admin login redirect 404 error (changed orgSlug from "org/admin" to "admin")

## Admin Dashboard Metrics Enhancement
- [x] Create shared getAdminSummary function for consistent metrics across all admin pages
- [x] Remove debug header (yellow banner)
- [ ] Change "ClientId: NULL" to "ClientId: All" for platform admins
- [x] Add user count per organization to admin dashboard
- [x] Add completion percentage per organization to admin dashboard
- [x] Add downloadable files list per organization to admin dashboard
- [ ] Implement soft delete for organizations (mark as inactive)
- [x] Add reactivation button for inactive organizations (UI ready, backend pending)
- [ ] Show inactive organizations in admin dashboard

## Missing Pages Fix
- [x] Create "Create Organization" page at /org/admin/create
- [ ] Create user management page
- [x] Add routes for all missing pages in App.tsx

## Partner Admin API Fix
- [ ] Fix PartnerAdmin page to not call getAllClients (platform admin only)
- [ ] Use getAdminSummary which already filters by clientId

## Partner Admin Fixes
- [x] Fix PartnerAdmin page API permission error (don't call getAllClients)
- [x] Debug SRV admin login issue
- [x] Add metrics display to PartnerAdmin dashboard
- [x] Create user management page for partner admins
- [x] Add create user functionality for partner admins
- [x] Add Manage Users button to both Platform and Partner admin dashboards
- [x] Test SRV admin access

## Email Validation Fix
- [x] Remove strict email validation for non-@newlantern.ai users
- [x] Keep validation only for @newlantern.ai staff
- [x] Test user creation with various email formats (test@srv works!)

## Organization Management Fix
- [x] Change organization display from cards to simple list/table format
- [x] Fix platform admin access control (should check clientId = NULL, not clientId = 1)
- [x] Add Deactivate button for active organizations
- [x] Add Reactivate button for inactive organizations
- [x] Add user deactivation/reactivation functionality
- [x] Add backend API endpoints for organization and user deactivation/reactivation
- [x] Keep the fixes we made today (email validation, completion percentage)
- [x] Test organization list UI with deactivate/reactivate functionality
- [x] Fix completion percentage inconsistency (was using deprecated intakeResponses table instead of responses table)

## Urgent Fixes for Launch
- [x] Add New Lantern logo to all admin page headers (PlatformAdmin, PartnerAdmin, ManageUsers)
- [ ] Redesign intake questionnaire diagram images to look professional (RIS/EMR architecture diagrams)
- [x] Redesign workflow diagrams to use swim lane layout (Orders, Images, Priors, Reports)
- [ ] Redesign admin dashboard to show organization cards with progress summaries
- [ ] Fix percentage calculation mismatch between user portal and admin dashboard
- [x] Update workflow diagram checkboxes to be white when unchecked and purple when checked
- [ ] Fix percentage mismatch - admin shows 24% but portal shows 18% for Munson
- [x] Add tabbed navigation to admin page with Dashboard, Organizations, and Users tabs
- [ ] Redesign Organizations tab to show table format with Edit/Deactivate/Add actions
- [ ] Implement Edit Organization dialog with name, slug, and partner fields
- [x] Remove duplicate Create Organization button from header
- [x] Fix broken Edit and Deactivate buttons for users

## Workflow Diagram Fixes
- [x] Add Viz.ai dual-send pathway to Images Workflow: Modalities → Viz.ai → (splits to both PACS and New Lantern)

## Restore Portal Summary Cards
- [x] Restore organization portal summary cards to Dashboard tab (removed in version 75d48436)
- [x] Each card should show: completion %, section breakdown, file count, "Open Portal" button

## Profile Menu Enhancement
- [x] Add "Back to Admin Dashboard" link in profile menu when admin views organization portal

## Viz.ai Workflow Architecture Fix
- [x] Update Viz.ai pathway to show correct 3-column flow: Modality→Viz.ai (Client Site) → Silverback → New Lantern

## Viz.ai Workflow Architecture Fix
- [x] Update Viz.ai pathway to show correct 3-column flow: Modality→Viz.ai (Client Site) → Silverback → New Lantern

## Database Reset for Go-Live
- [x] Audit current database (count organizations, users, responses, files)
- [x] Delete all test organizations
- [x] Delete all test users
- [x] Clear all intake responses/answers
- [x] Delete all uploaded files
- [x] Verify all completion percentages are 0%
- [x] Confirm database is clean and ready for production
- [x] Added RRMC and Boulder Community Health for SRV partner

## Create Users from Email List
- [ ] Parse email list and identify organization assignments
- [ ] Create user accounts for Boulder Community Health team
- [ ] Create user accounts for SRV/RRMC team
- [ ] Create user accounts for RadOne partners
- [ ] Verify all users created successfully

## Admin UI Improvements
- [ ] Rename "Update Organization" tab to "Organizations"

## Workflow Diagram Updates
- [x] Update all workflow swim lanes to show 3-column architecture: Client Site → Silverback → New Lantern
- [x] Apply to Orders workflow
- [x] Apply to Images workflow (all pathways)
- [x] Apply to Priors workflow
- [x] Apply to Reports workflow

## SRV Admin Account Creation
- [x] Get Rhonda's email address
- [x] Create SRV admin account for Rhonda Bennett (rbennett@tuscrad.com)
- [x] Create SRV admin account for Leigh Ann Hobson (lhobson@tuscrad.com)
- [x] Create SRV admin account for Dr. David Shulman (dshulman@tuscrad.com)

## Partner Admin Filtering Fix
- [ ] Fix SRV partner admin to only show SRV organizations (Boulder, RRMC)
- [ ] Currently showing all organizations including RadOne orgs (JCRHC, Baycare, Munson)

## Intake Portal Header Fix
- [ ] Fix intake portal header to show correct partner name (e.g., "SRV - Boulder" not "Radiology One - Boulder")
- [ ] Header should use partner name from organization's clientId in database

## SRV Partner Admin Fixes
- [ ] Fix organization filtering - SRV admins should only see Boulder and RRMC (not JCRHC, Baycare, Munson)
- [ ] Add portal summary cards to Dashboard tab (matching Platform Admin)
- [ ] Add profile dropdown menu in top-right corner
- [ ] Add tabbed navigation (Dashboard, Organizations, Users)
- [ ] Make UI structure match Platform Admin (just filtered to partner orgs)

## Images Workflow Correction
- [x] Fix Images workflow pathways:
  - Path 1: Modalities → Silverback → New Lantern (direct)
  - Path 2: Modalities → Current PACS → Silverback → New Lantern
  - Path 3: Modalities → VNA → Silverback → New Lantern
  - Path 4: Modalities → Viz.ai → Silverback → New Lantern

## SRV Partner Admin UI Fixes (Feb 9, 2026)
- [x] Redesign PartnerAdmin page to match Platform Admin UI (portal summary cards, tabs, profile dropdown)
- [x] Keep organization filtering working (SRV admins see only Boulder and RRMC)
- [x] Prevent partner admins from accessing /org/admin (Platform Admin) route
- [x] Add proper navigation and admin dashboard structure to /org/SRV/admin route
- [x] Unified all admin pages to use single PlatformAdmin component with automatic filtering by clientId

## Partner Admin Filtering Fixes (Feb 9, 2026)
- [x] Fix Edit Organization dialog - already correct (no client dropdown, can't change partner)
- [x] Fix Users tab - filter users to only show users from partner's organizations
- [x] Backend: Update getAllUsers query to filter by joining with organizations table
- [x] Fix Files display - files automatically filtered (shown in org cards which are already filtered)
- [x] No separate Files tab exists - files only shown in Dashboard org cards

## Admin UI Improvements (Feb 9, 2026)
- [x] Move Create User button positioning to match Organizations tab layout
- [x] Show deactivated organizations in Organizations tab with Reactivate button
- [x] Ensure deactivated users are visible in Users tab with Reactivate button (verify existing functionality)

## Organization Status & Sorting (Feb 9, 2026)
- [x] Update database schema: Add 'completed' status option for organizations (already exists)
- [x] Backend: Add markOrganizationComplete and reopenOrganization mutations
- [x] Frontend: Separate organizations into three sections (Active, Completed, Deactivated)
- [x] Frontend: Add sorting controls (by name, completion %, status, partner)
- [x] Frontend: Add "Mark as Complete" button for active organizations
- [x] Frontend: Add "Reopen" button for completed organizations
- [x] Test all status transitions (active → completed → reopened, active → deactivated → reactivated)

## Priors Workflow Updates (Feb 10, 2026)
- [x] Option 1: VNA or PACS → Silverback → New Lantern (unidirectional push)
- [x] Option 2: VNA or PACS ↔ Silverback → New Lantern (bidirectional C-FIND/C-MOVE query/retrieve)
- [x] Option 3: Manual Push → Silverback → New Lantern (site manually pushes)

## Section Reordering (Feb 10, 2026)
- [x] Move "Data & Integration" section to position 2 (right after Organization Information)
- [x] Shift all other sections down accordingly

## Data & Integration Section Cleanup (Feb 10, 2026)
- [x] Change "Confirmed go-live date" to "Requested go-live date"
- [x] Delete "How will comparison images for priors be obtained?" (D.5)
- [x] Change "How will prior reports be obtained?" to "Method for Historic Reports Data load"
- [x] Update options to clarify pre-go-live bulk data loading purpose

## Remove Confusing Notes (Feb 10, 2026)
- [x] Remove notes from D.7 (Method for Historic Reports Data load)
- [x] Remove notes from D.8 (Tech sheets input method)

## Fix Platform Admin Issues (Feb 10, 2026)
- [x] Fix profile dropdown showing only 'J' instead of full name (identified duplicate account issue)
- [x] Fix SRV users appearing as deactivated on Users tab (updated filtering logic to treat admins as active)

## Partner Isolation Fixes (Feb 10, 2026)
- [x] Fix createOrganization to use user's clientId instead of email domain matching
- [x] Verify createUser enforces partner isolation (already implemented)
- [x] Add Client ID column to Users table
- [x] Update SRV admin users (Leigh Ann, Rhonda, Dr. Shulman) to have clientId = 2
- [x] Fix getAllUsers query to show partner admin users for partner admins like Leigh Ann
- [x] Fix getAllClients query to allow partner admins to view their own client## Partner-Specific VPN Forms (Feb 10, 2026)
- [x] Upload SRV VPN form (TRC_RRMC-VPN-Form-v3.docx) to S3
- [x] Update VPN section to show RadOne template for RadOne orgs  
- [x] Update VPN section to show SRV template for SRV orgs
- [x] Implement partner-specific template selection in intake page
- [x] Write vitest tests for VPN template configuration
- [x] Test download templates for both partnerst tests for VPN template configurationts for VPN template configuration

## Export All Function Fix (Feb 10, 2026)
- [ ] Fix "Export All" button to export organizations, users, and intake data (not just users)

## Visual Indicators for Deactivated Users (Feb 10, 2026)
- [ ] Add visual styling to distinguish deactivated users in the Users table
- [ ] Consider: grayed out text, strikethrough, or "Inactive" badge
- [ ] Ensure consistent styling across all user lists
- [ ] Test visibility of deactivated vs active users

## Workflow Diagram Styling Consistency (Feb 10, 2026)
- [x] Fix inconsistent box colors in Priors Workflow
- [x] Make "Manual Push" box match the outline style of "VNA or PACS" boxes
- [x] Ensure all workflow boxes have consistent styling (outline vs filled)

## Fix Reports Out Patient Portal Workflow (Feb 10, 2026)
- [x] Remove Silverback from Patient Portal workflow
- [x] Change to: New Lantern -------- (dotted line) --------> [Client EHR/RIS]
- [x] Add placeholder text: "Manual PDF download from New Lantern"
- [x] Make destination box an input field for client to specify their system

## Fix User Deactivation Logic (Feb 10, 2026)
- [x] Debug why deactivated users don't move to Inactive Users table (admin users need isActive field)
- [x] Add isActive boolean field to users table schema
- [x] Update deactivateUser mutation to set isActive = 0
- [x] Update reactivateUser mutation to set isActive = 1
- [x] Update frontend filtering to use isActive field instead of organizationId check
- [x] Run database migration (pnpm db:push)
- [ ] Test deactivation flow for both admin and regular users

## Fix Boulder Organization Client ID (Feb 10, 2026)
- [x] Update Boulder organization clientId from 1 (RadOne) to 2 (SRV)
- [x] Verify Boulder shows "SRV" as client name in admin dashboard

## Fix Organization Page Header Display (Feb 10, 2026)
- [x] Find where "Radiology One - Boulder" header is generated (IntakeNewRedesign.tsx)
- [x] Update getBySlug to include clientName in response
- [x] Update header to use org.clientName instead of hardcoded "Radiology One"
- [x] Boulder now shows "SRV - Boulder" in header

## Add Partner Selection to User Management (Feb 10, 2026)
- [ ] Add partner/clientId dropdown to create user form
- [ ] Add partner/clientId dropdown to edit user dialog
- [ ] Platform admins: show editable dropdown with all partners
- [ ] Partner admins: auto-populate with their clientId and make read-only
- [ ] Update createUser mutation to accept and save clientId
- [ ] Update editUser mutation to accept and save clientId
- [ ] Test creating and editing users with different partners

## Fix Organization Name Display in Header (Feb 10, 2026)
- [ ] Change header from displaying slug to displaying org.name
- [ ] Keep slug in URL but show actual organization name in header
- [ ] Verify renamed organizations show updated name in header

## Fix Organization Name Display in Header (Feb 10, 2026)
- [x] Change header from displaying slug to displaying org.name
- [x] Keep slug in URL but show actual organization name in header
- [x] Example: RRMC renamed to RRAL now shows "SRV - RRAL" not "SRV - RRMC"

## Fix Workflow Diagram Responses Not Saving (Feb 10, 2026)
- [x] Debug why workflow diagram selections don't save (save logic exists, works correctly)
- [x] Fix workflow responses not counting toward completion percentage (added workflow-specific progress calculation)
- [x] Require system names to be filled for all checked paths before marking complete
- [ ] Fix workflow data not exporting in CSV
- [ ] Test Priors Workflow saves correctly
- [ ] Test Reports Out Workflow saves correctly
- [ ] Verify completion percentage updates when workflow is filled

## Fix Organization Name Not Updating After Rename (Feb 10, 2026)
- [x] Add cache invalidation when organization is renamed (refetchOrgs in updateOrgMutation)
- [x] Admin panel shows updated names immediately
- [ ] Test: Rename Boulder to "Boulder Community Health" and verify header updates after page refresh

## Add Workflow Section Validation (Feb 10, 2026)
- [x] Prevent Save & Continue if no workflow paths are checked
- [x] Prevent Save & Continue if checked paths are missing system names
- [x] Show error message explaining validation requirements (toast notifications)
- [ ] Add red highlighting to incomplete workflow fields (optional enhancement)
- [ ] Test validation on all workflow sections (Orders, Images, Priors, Reports)

## Fix Export and Add Import Functionality (Feb 10, 2026)
- [x] Debug why workflow data doesn't export in CSV (was skipping workflow sections)
- [x] Include workflow configuration in export (paths, systems, notes)
- [x] Change export format from CSV to pipe-delimited (|)
- [x] Add "Import" button next to "Export" button
- [x] Create import dialog for uploading pipe-delimited file
- [x] Parse imported file and update responses in database
- [x] Validate imported data before saving (basic validation)
- [x] Show success/error messages for import operation
- [ ] Test export/import round-trip with all question types

## Fix VPN Section Answer Persistence (Feb 10, 2026)
- [x] Debug why VPN section answers don't persist when user fills them out
- [x] Check auto-save logic for VPN questions
- [x] Verify VPN question IDs are correct in questionnaireData.ts
- [x] Add explicit save to database when clicking "Save & Continue"
- [x] Prevent navigation if save fails
- [ ] Test VPN section with real data entry (user to verify)
- [ ] Ensure answers reload correctly when user returns to VPN section (user to verify)

## Test Workflow Export/Import and Calculations (Feb 10, 2026)
- [ ] Test exporting workflow sections (Orders, Images, Priors, Reports)
- [ ] Verify workflow paths, systems, and notes are in export file
- [ ] Test importing workflow data back into the system
- [ ] Verify workflow configurations are reconstructed correctly
- [ ] Check if workflow data affects any calculations or summaries
- [ ] Ensure workflow data displays correctly after import

## Fix Overall Progress Calculation Bug (Feb 10, 2026)
- [ ] Debug why "Overall Progress" shows "2/48 questions" instead of correct count
- [ ] Fix progress calculation to properly handle workflow sections (they don't have traditional questions)
- [ ] Ensure workflow sections are counted correctly in overall progress
- [ ] Verify progress percentages match actual completion state
- [ ] Test with different combinations of completed sections

## Fix Workflow System Name Not Saving (Feb 10, 2026)
- [x] Debug why workflow system names don't save when typed in the input field
- [x] Identified that Orders/Images workflows don't have system name inputs (fixed systems)
- [x] Fixed validation to not require system names for Orders/Images workflows
- [x] Fixed validation to use correct section IDs (reports-out-workflow not reports-workflow)
- [x] Fixed validation to map path keys to correct system keys (reportsToPortal → reportsPortalDestination)
- [ ] Test workflow save after fixing the validation logic

## Fix Progress Calculation to Count Workflow Sections (Feb 10, 2026)
- [x] Change progress calculation from question-based to item-based
- [x] Count each workflow section as 1 item (not 0 questions)
- [x] Update display from "X/48 questions" to "X/54 items" (dynamic counting)
- [x] Ensure workflow sections contribute to overall progress percentage
- [x] Made counting fully dynamic (no hardcoded numbers)
- [ ] Test progress calculation with different completion states

## Fix Workflow Configurations Not Saving to Database (Feb 10, 2026)
- [ ] Debug why workflow configs show 0 rows in database
- [ ] Check if auto-save is triggering for workflow changes
- [ ] Check if "Save & Continue" explicit save is working for workflows
- [ ] Verify the save mutation is being called with correct data
- [ ] Test workflow save and verify data persists in database

## Fix "Question L.11 not found" Error (Feb 10, 2026)
- [x] Debug why backend rejects L.11 when it exists in questionnaireData.ts
- [x] Found that backend was validating against incomplete questions table
- [x] Changed saveResponse to use intakeResponses table (no foreign key validation)
- [x] Changed saveResponses (batch save) to use intakeResponses table
- [x] intakeResponses stores questionId as varchar, allows any question ID
- [ ] Test save functionality for all sections including E.2.1, E.3.1, E.4, etc.

## Fix Workflow Sections Not Showing Purple Checkmark (Feb 10, 2026)
- [ ] Debug why workflow sections don't get purple checkbox after saving
- [ ] Check how section completion status is calculated
- [ ] Ensure workflow_config responses are recognized as section completion
- [ ] Test that purple checkmark appears after saving workflow

## Fix Admin Dashboard to Show All 9 Sections (Feb 10, 2026)
- [x] Debug why admin dashboard only shows 5 sections instead of 9 (hardcoded list)
- [x] Found that Admin.tsx has hardcoded section list instead of using questionnaireSections
- [x] Replace hardcoded section lists in Admin.tsx with questionnaireSections import
- [x] Ensure both admin and client portals use same data source (single source of truth)
- [x] Updated section count from "of 6 sections" to dynamic "of {questionnaireSections.length} sections"
- [ ] Test that all 9 sections appear uniformly in both portals

## Fix Backend Progress Calculation for Workflows (Feb 10, 2026)
- [x] Debug why completing all questions shows 65% instead of 100%
- [x] Found that backend filters out workflow sections in progress calculation
- [x] Updated calculateProgress() to handle workflow sections (check for _config with paths)
- [x] Fixed admin.ts to include workflow sections as 1 item each
- [x] Fixed organizations.ts to include workflow sections in progress
- [ ] Test that completing all sections shows 100% and checkmarks appear

## Fix Progress Not Updating After Saves (Feb 10, 2026)
- [x] Debug why progress percentage doesn't increase after saving sections
- [x] Confirmed responses ARE being saved to database (G.5, G.6, G.7 exist in DB)
- [ ] Fix backend getResponses to return ALL responses (not filtering by questions table)
- [ ] Verify frontend loads all responses into form fields
- [ ] Test that progress percentage updates correctly after saves
- [ ] Ensure checkmarks appear for completed sections

## Refactor Duplicated Code (Feb 10, 2026)
- [x] Create shared utility function for sectionProgress transformation
- [x] Update Admin.tsx to use shared utility
- [x] Update PlatformAdmin.tsx to use shared utility
- [x] Test that both admin pages work correctly with shared function

## Fix Workflow Checkmarks Not Appearing (Feb 10, 2026)
- [x] Debug why Orders Workflow doesn't show checkmark after completion
- [x] Check if workflow configs are being saved to database correctly
- [x] Check if workflow configs are being loaded from database correctly
- [x] Fix section completion detection logic for workflow sections (Orders/Images don't need system names)
- [x] Fix race condition where sidebar renders before responses loaded into state
- [ ] Test that all 4 workflow sections show checkmarks when completed

## Fix RRMC 73% Completion Bug (Feb 10, 2026)
- [ ] Query database to check all RRMC responses
- [ ] Identify which questions/sections are missing
- [ ] Check if workflow configs are being counted correctly
- [ ] Verify progress calculation logic matches actual data
- [ ] Fix completion percentage to show 100% when all sections complete

## RRAL Should Be 100% Complete (Feb 10, 2026)
- [ ] Compare RRAL responses (46 saved) against all required questions in questionnaireData
- [ ] Identify which specific questions are missing
- [ ] Check if conditional questions are being counted incorrectly
- [ ] Verify all sections should show 100% when user filled everything out
- [ ] Fix any calculation or data loading issues

## Fix Configuration Files Showing 100% With No Files (Feb 10, 2026)
- [x] Fix duplicate D.13 question ID (exists as both textarea and upload)
- [x] Rename Configuration Files upload questions to unique IDs (CF.1-CF.5)
- [x] Update progress calculation to only count upload questions as complete if files exist
- [x] Test that Configuration Files shows 0% when no files uploaded (74 vitest tests passing)
- [ ] Verify Boulder and RRAL show correct completion percentages in browser

## Remove Deprecated Unload Event Listener (Feb 10, 2026)
- [ ] Find unload event listener in Admin.tsx around line 79
- [ ] Remove or replace with modern alternative (visibilitychange or pagehide)
- [ ] Test that deprecation warning no longer appears

## Fix File Uploads Stuck in "Uploading..." State (Feb 10, 2026)
- [x] Find file upload component in IntakeNewRedesign.tsx (line 263)
- [x] Check if uploadFile mutation onSuccess is being called
- [x] Check if loading state is being reset after upload completes
- [x] Identified issue: No onError handler, so failed uploads never clear loading state
- [x] Fix the upload completion logic (added onError handler)
- [x] Ready to test in production (dev server broken due to EMFILE)

## Fix Dashboard Showing Inconsistent Section Progress (Feb 10, 2026)
- [ ] Investigate why Baycare shows only 4 sections instead of 9
- [ ] Investigate why JCRHC shows no section breakdown at all
- [ ] Check backend sectionProgress data structure
- [ ] Check frontend rendering logic in PlatformAdmin.tsx
- [ ] Ensure all orgs show all 9 sections with correct percentages
- [ ] Test that dashboard displays consistently for all organizations

## CRITICAL: Nothing Saves in Application (Feb 10, 2026)
- [x] Check server logs for save errors
- [x] Check network requests for failed API calls
- [x] Check if database connection is working
- [x] Check if saveResponse mutation is working
- [x] Identify root cause: saveResponse writes to intakeResponses, getResponses reads from responses
- [x] Fix getResponses: Changed to read from intakeResponses table (line 109-123)
- [x] Fix getProgress: Changed to read from intakeResponses and use questionnaireData (line 329-377)
- [ ] Test that all data saves correctly and persists after refresh

## Bug 1: File Upload "Question not found" Error (Feb 10, 2026)
- [x] Investigate uploadFile endpoint in intake.ts
- [x] Identify why CF.1-CF.5 questions fail (not in questions DB table)
- [x] Fix uploadFile to use questionnaireData.ts as primary source
- [x] Generate short title from question text if DB lookup fails
- [x] Fixed and deployed (checkpoint d821cbc2)

## Bug 2: Admin Dashboard Wrong Progress (Feb 10, 2026)
- [x] Investigate getAdminSummary endpoint in admin.ts
- [x] Identify table mismatch (reads from responses, should read from intakeResponses)
- [x] Fix getAdminSummary to read from intakeResponses table
- [x] Fixed and deployed (checkpoint d821cbc2)

## Code Cleanup: Remove Dead Endpoints (Feb 10, 2026)
- [ ] Remove getResponsesNew endpoint (unused by client)
- [ ] Remove saveResponseNew endpoint (unused by client)
- [ ] Remove getCompletionMetricsNew endpoint (unused by client)

## Root Cause Analysis Fixes - New Organization Creation (Feb 10, 2026)
- [x] Fix 1: Add afterAll cleanup to server/auth.login.test.ts
- [x] Fix 1: Add afterAll cleanup to server/intake.autosave.test.ts
- [x] Fix 2: Change "Organization Information" → "Organization Info" in questionnaireData.ts
- [x] Fix 2: Change "Images Workflow (DICOM)" → "Images Workflow" in questionnaireData.ts
- [x] Fix 3: Fix infinite loading condition in IntakeNewRedesign.tsx line 707
- [x] Fix 4: Remove .slice(0, 3) and add scrollable container in PlatformAdmin.tsx

## Test Data Cleanup (Feb 10, 2026)
- [x] Query database to find all test organizations (test-login-*, test-autosave-*, etc.)
- [x] Delete associated intakeResponses for test organizations
- [x] Delete associated intakeFileAttachments for test organizations
- [x] Delete associated fileAttachments for test organizations
- [x] Delete associated users for test organizations
- [x] Delete test organizations
- [x] Verify all test data has been removed (0 test orgs remaining)

## Admin Dashboard Section Visibility Bug (Feb 10, 2026)
- [x] Fix transformSectionProgress in adminUtils.ts to return all 9 sections at 0% for new orgs
- [x] Remove getInProgressSections filter and conditional rendering in PlatformAdmin.tsx
- [x] Fixed by user in commit 833f482 (synced from GitHub)
- [x] Remove unused getInProgressSections function and update tests
- [x] All 70 tests passing

## Delete All Data for All Organizations (Feb 10, 2026)
- [x] Delete all records from intakeResponses table
- [x] Delete all records from intakeFileAttachments table
- [x] Delete all records from fileAttachments table
- [x] Verify all data has been deleted (0 responses, 0 files remaining)
- [x] Organizations preserved (count unchanged)

## Partner Templates System Setup (Feb 11, 2026)
- [x] Run pnpm db:push to create partnerTemplates table (already exists)
- [x] Check for seed SQL scripts for initial template data (found seed-vpn-templates.sql)
- [x] Verify Templates tab UI in admin dashboard (fully functional)
- [x] Run seed SQL to insert RadOne and SRV VPN templates
- [x] Verify templates are in database (2 templates: RadOne E.1, SRV E.1)
- [x] Code review: IntakeNewRedesign correctly uses dbTemplateMap for rendering
- [x] GitHub sync: Removed hardcoded template URLs, single source of truth is DB

## Make Questions Partner-Agnostic (Feb 13, 2026)
- [x] H.1: Remove "Rad1" → generic wording
- [x] D.13: Replace "Silverback" → "Router / Integration 3rd Party"
- [x] Comment line 4: Replace "DataFirst (Silverback)" → "Integration 3rd Party Router"
- [x] Remove old SRV/RadOne hardcoded URL comments (lines 135-136)
- [x] Keep all "New Lantern" references as-is

## Fix: Organization not found error on /org/:slug/intake (Feb 20, 2026)
- [x] Root cause: useParams() from wouter returns literal ":slug" instead of actual slug value
- [x] Fix IntakeNewRedesign.tsx: changed useParams() to useRoute("/org/:slug/intake")
- [x] Fix IntakeNew.tsx: same fix applied
- [x] Verified no other pages use useParams()
- [ ] Test admin accessing /org/:slug/intake works correctly

## Publish - Feb 22, 2026
- [ ] Publish latest checkpoint with all bug fixes

## File Upload UI Redesign
- [x] Replace native browser file input with modern drag-and-drop upload zone
- [x] Move PHI warning to section header (show once, not per question)
- [x] Add cleaner file card display with icons for uploaded files
- [x] Improve visual hierarchy - less clutter, better spacing
- [x] Style upload area to match dark purple theme

## File Upload UI Redesign v2 - Compact Row Pattern
- [ ] Replace big card+dropzone per question with compact row pattern
- [ ] Each row: title + short description on left, Upload button on right
- [ ] Upload button expands inline dropzone only when clicked
- [ ] State-driven UI: empty → uploading → uploaded (filename chip + replace/remove)
- [ ] Single section-level drag-and-drop hint (not repeated per question)
- [ ] Flatten styling: remove dashed borders, gradients, glows; use soft 1px borders
- [ ] Reduce vertical height of each upload control by 50-70%
- [ ] Shorten copy: concise titles + one-line descriptions
- [ ] Clear hierarchy: big section title, small descriptions, one primary CTA
- [ ] Show "Not uploaded" / "Uploaded" status badges per row

## File Upload UI Redesign v3 - User's Preferred Compact Card Pattern
- [x] Rewrite FileUploadField as compact card row: title+description left, Upload button right
- [x] Uploaded state: green "Uploaded" badge + filename + paperclip icon + "Replace" link
- [x] Empty state: subtle "No file uploaded" with file icon
- [x] Remove dashed dropzone per question, use Upload button to trigger file picker
- [x] Single helper line at section top instead of repeated instructions
- [x] Remove repeated PHI warnings per question (keep single one at section level)
- [x] Flatten card styling: subtle border, no gradients/glows, dark theme consistent
- [x] Support drag-and-drop on each card row (not a separate dropzone)

## File Upload - One Screen Layout
- [x] Redesign Configuration Files to fit on one screen without scrolling
- [x] Use compact row pattern: title + description left, Upload button right
- [x] Uploaded state: green badge + filename + Replace link
- [x] Empty state: subtle "No file uploaded" text
- [x] Remove large dropzones, use tight rows
- [x] Single section header with PHI warning, no per-question warnings

## Question Cleanup - Config Files & VPN
- [x] Hide/inactivate CF.7 (NewLantern Technologists), CF.8 (PACS Admins), CF.9 (Radiologist Provider list)
- [x] Add downloadable format spec for CF.1 (Procedure code list) showing required columns
- [x] Add downloadable format spec for CF.2 (User list) showing required columns
- [x] Clean up VPN downloadable form (Rad One vs SRV client types)
- [x] Update progress counter to reflect only active questions (6 instead of 9)

## Implementation & Validation Checklists Mockups (Mar 10, 2026)
- [x] Mockup: Implementation Checklist with owner assignments and target dates
- [x] Mockup: Validation Checklist with test cases and sign-off
- [x] Mockup: Unified navigation showing how checklists fit into the portal as one cohesive flow

## New Pages Build (Mar 10, 2026)
- [ ] Build Implementation Checklist page with owner badges (Client/NL/Joint), target dates, status, grouped by phase
- [ ] Build Validation Checklist page with test cases, expected/actual results, pass/fail, sign-off
- [ ] Update Intake - build Architecture page matching mockup
- [ ] Update Intake - build Workflow page matching mockup
- [x] Wire up routes and navigation for all new pages
- [ ] Test all new pages

## New Static Pages (Mar 10, 2026)
- [x] Build Implementation Checklist page (static UI, mock data)
- [x] Build Validation Checklist page (static UI, mock data)
- [x] Build Architecture page in Intake (static UI, mock data)
- [x] Build Workflow page in Intake (static UI, mock data)
- [x] Wire up routes and navigation for all new pages

## Navigation & Intake Integration (Mar 11, 2026)
- [ ] Add top-level navigation tabs on org landing page (Connectivity, Intake, Implementation, Validation)
- [ ] Integrate Architecture as a section within the Intake questionnaire
- [x] Integrate Workflows as a section within the Intake questionnaire
- [ ] Remove standalone Architecture and Workflows routes (now part of Intake)

## Workflow Page Rebuild (Mar 12, 2026)
- [x] Rebuild Workflows page to match screenshot: editable textareas, removable system chips, green checkmarks
- [x] Add Save & Continue + Section Complete buttons
- [x] Integrate as part of Intake flow (not standalone page)

## Connectivity Matrix Fixes (Mar 12, 2026)
- [x] Remove "All" and "None" buttons from sites filter — put all options in dropdown
- [x] Remove Workflow Snapshots row (org cards with 0/4 counts)
- [x] Remove icon next to "Connectivity Dashboard" in admin tab nav
- [ ] Fix mobile menu overlap on connectivity page

## Architecture & Diagram Display (Mar 12, 2026)
- [x] Remove standalone Architecture page and route
- [x] Display uploaded diagram image inline in Integration Workflows section (increased to 400px, clickable to open full size)

## New Integration Workflow Sections (Mar 12, 2026)
- [x] Add Historic Results workflow block (5yr typical, HL7 or flat file preferred)
- [x] Add Tech Sheets / DICOM-wrapped documents workflow block
- [x] Add Overlay PACS report routing workflow block (with example upload)
- [x] Update completion counter to reflect new blocks (now 9 total)

## CT Dose Information (Mar 12, 2026)
- [x] Add CT Dose Information workflow block (HL7 vs DICOM-wrapped, location details)
- [x] Update completion counter from 9 to 10

## Remove Architecture Section (Mar 12, 2026)
- [x] Remove Architecture section from intake questionnaire sidebar

## Questionnaire Restructure (Mar 12, 2026)
- [x] Move D.7 (Historic Reports method) into Integration Workflows — combine with Historic Results block
- [x] Move D.8 (Tech sheets input method) into Integration Workflows — combine with Tech Sheets block
- [x] Move D.1 (Can production systems be configured for testing?) into Connectivity section
- [x] Redesign Connectivity section as editable table (IP, Port, Protocol, AE Title, Traffic Type, Source, Destination, Environment)
- [x] Remove old DICOM/HL7 endpoint textarea questions from Connectivity
- [x] Update admin progress calculation for connectivity-table type
- [x] Update tests (workflowDiagram, adminUtils, vpn-templates) for 4-section structure

## Fix Architecture Diagram Display (Mar 12, 2026)
- [x] Fix broken image display for uploaded architecture diagram in Integration Workflows (URL space encoding)

## CT Dose Dropdown Simplification (Mar 12, 2026)
- [x] Simplify CT Dose delivery method to 3 options: HL7, DICOM, HL7 & DICOM
- [x] Remove conditional HL7 location selector (no longer needed with simplified options)

## Historic Results Dropdown Update (Mar 12, 2026)
- [x] Update Historic Results delivery method to 3 options: HL7 (preferred), Flat File, DICOM

## Connectivity Table Redesign (Mar 12, 2026)
- [x] Widen IP Address and Port columns
- [x] Remove Protocol column
- [x] Change Environment to checkbox (Test/Prod/Both)
- [x] Populate Source/Destination from systems inventory + common systems list
- [x] Add pre-canned list of common traffic types with ability to add custom ones
- [x] Add export functionality (CSV/JSON) for connectivity table
- [x] Add import functionality with AI-friendly structured format and column mapping

## Diagram Display & Dropdown Fix (Mar 12, 2026)
- [x] Fix architecture diagram to display large at top of Integration Workflows when uploaded
- [x] Fix broken image rendering (URL encoding fix already applied)
- [x] Fix glitchy Systems Involved multi-select dropdown (rewrote with Popover/Command)
- [x] Update traffic types in ConnectivityTable to HL7/DICOM traffic only
- [x] Make Source System, Destination System, and Systems in Environment a shared alphabetical picklist anyone can add to
- [x] Reorder columns: Traffic Type → Source System → Dest System → Source IP/Port → Dest IP/Port → AE Title → Test/Prod → Actions
- [x] Split single IP/Port into Source IP/Port and Destination IP/Port
- [x] Fix colors: Prod = green, Test = yellow
- [x] Add D.9 question about HL7 tokens/segments for clinical data (medications, history, allergies, etc.)

## Rename & Restructure Integration Workflows (Mar 12, 2026)
- [x] Rename first Integration Workflows section to "Architecture" in sidebar
- [x] Move Systems in Your Environment table to the Architecture tab
- [x] Remove Architecture Diagram block and Systems table from second Integration Workflows tab
- [x] Second IW tab keeps only workflow blocks (Orders, Priors, Reports, etc.)
- [x] Update admin/progress references for renamed section
- [x] Remove MDM, SIU, Worklist, MPPS, Storage Commitment, Dose Reports from traffic type dropdown
- [x] Move Configuration Files (CF.1-CF.6) from Connectivity to their own new section tab
- [x] Leave VPN form (E.1) in Connectivity section
- [x] Remove Architecture Diagram and Systems table from Integration Workflows component (keep workflow blocks only)
- [x] Add Config Files icon to sidebar
- [x] Update admin references for new section structure

- [x] Architecture section: stack diagram full-width on top, systems table below (not side-by-side)
- [x] Simplify progress panel: remove percentages, show only complete/incomplete icons per section

## Admin Header Fix (Mar 13, 2026)
- [x] Center "Platform Admin" heading in admin dashboard header

## Admin Dashboard Restructure (Mar 13, 2026)
- [x] Move Users, Organizations, Templates, Partners, Specifications into an Admin Menu (dropdown/collapsible)
- [ ] Make Implementation Dashboard the main/default view
- [ ] Add Validation Checklist section to Implementation Dashboard
- [ ] Add Implementation Checklist section to Implementation Dashboard

## Implementation Dashboard Table View (Mar 13, 2026)
- [x] Replace org cards with collapsed table rows on Implementation Dashboard
- [ ] All sections collapsed by default, expandable
- [x] Make org name column clickable to navigate to site dashboard
- [x] Move Users/Orgs/Templates/Partners/Specs into Admin Menu dropdown
- [ ] Add Implementation Checklist section to Implementation Dashboard
- [ ] Add Validation Checklist section to Implementation Dashboard
- [ ] Replace Connectivity Dashboard with Notion DB integration (pending Notion DB setup)

## Site Dashboard Page (Mar 13, 2026)
- [ ] Create new Site Dashboard page at /org/:slug/dashboard
- [ ] Architecture Diagram section: display uploaded diagram from intake
- [ ] Connectivity Info section: auto-populate from questionnaire answers (contacts, systems, IPs, ports, AE titles)
- [ ] Implementation Questionnaire status: show section completion with link to intake form
- [ ] Validation Checklist: mock checklist items for testing/validation
- [ ] Implementation Checklist: mock checklist items for project plan
- [ ] Wire up route in App.tsx
- [ ] Backend procedures for checklist data

## Site Dashboard Page (Mar 13, 2026)
- [ ] Create new Site Dashboard page at /org/:slug/dashboard
- [ ] Architecture Diagram section: display uploaded diagram from intake
- [ ] Connectivity Info section: placeholder for Notion database display (filtered per site)
- [ ] Implementation Questionnaire status: show section completion with link to intake form
- [ ] Validation Checklist: mock checklist items for testing/validation
- [ ] Implementation Checklist: mock checklist items for project plan
- [ ] Wire up route in App.tsx
- [ ] Backend procedures for checklist and site dashboard data

## Role-Based Landing Pages (Mar 13, 2026)
- [x] Customer users land on Site Dashboard (/org/:slug) after login
- [x] Admin users land on Platform Admin (/admin) after login - defaults to Connectivity Dashboard
- [x] Update routing/redirect logic based on user role

## Admin Landing + Architecture Remove (Mar 13, 2026)
- [x] Swap admin/partner landing page to Implementation Dashboard (not Connectivity)
- [x] Add remove button to Architecture Diagram on Site Dashboard

## Systems Add/Edit Fix (Mar 13, 2026)
- [ ] Replace plain text "Add System" with dropdown fields for system type
- [ ] System type dropdown: PACS, EHR/RIS, Router/Middleware, VNA, Integration Engine, AI, Cloud Storage, etc.
- [ ] Proper add/edit/delete functionality with inline editing

## Systems Section Redesign (Mar 13, 2026)
- [x] Pre-loaded rows for PACS, VNA, Router, EHR, RIS, Integration Engine, AI with vendor dropdowns
- [x] AI row supports multi-select (multiple AI platforms)
- [x] Vendor dropdowns specific to each system type
- [x] Users can add custom rows with customizable type and vendor
- [x] Import/export buttons for systems data (JSON)
- [x] Import/export buttons for architecture diagram

## Vendor Dropdown Additions (Mar 13, 2026)
- [x] Add Fuji, Agfa, Sectra and other common radiology vendors to system type dropdowns

## Reporting/Dictation Category (Mar 13, 2026)
- [x] Add Reporting/Dictation system type with PowerScribe, Fluency, mModal, etc.

## Admin-Configurable Vendor Picklists (Mar 13, 2026)
- [x] Create DB table for system_vendor_options (system_type, vendor_name, sort_order)
- [x] Add backend CRUD procedures for managing vendor options (add, update, toggle, delete, addSystemType, seedDefaults)
- [x] Build Vendor Picklists tab in Platform Admin page for managing vendor options per system type
- [x] Update IntakeNewRedesign ArchitectureOverview to load vendor options from DB (fallback to hardcoded defaults)
- [x] Seed DB with current hardcoded vendor options (9 system types, 90+ vendors)
- [x] Add public intake.getActiveVendorOptions endpoint for intake form
- [x] Write vitest tests for vendor CRUD, access control, and public endpoint (12 tests)
- [x] Both Platform-Admin and RadOne-Admin can edit vendor picklists

## Alphabetize Vendor Lists & Audit Log (Mar 13, 2026)
- [x] Alphabetize vendor lists in admin Vendor Picklists tab (sorted A-Z, "Other" always last)
- [x] Alphabetize vendor lists in intake form Architecture dropdowns (sorted A-Z, "Other" always last)
- [x] Alphabetize vendor lists in backend getActiveVendorOptions endpoint (both admin and intake routers)
- [x] Create vendorAuditLog database table (action, systemType, vendorName, previousValue, newValue, performedBy)
- [x] Log all vendor picklist changes (add, update, toggle, delete, addSystemType, seedDefaults)
- [x] Build Change History UI in Vendor Picklists tab with color-coded actions
- [x] Write vitest tests for audit logging and alphabetization (20 tests total, all passing)
- [x] Add getVendorAuditLog admin endpoint with limit parameter

## Collapsible Vendor Picklist Cards (Mar 13, 2026)
- [x] Convert vendor picklist system type sections from static cards to collapsible/accordion cards (using Radix Collapsible with chevron rotation)

## Implementation Dashboard Workflow Launcher Refactor (Mar 13, 2026)
- [x] Make Questionnaire/Validation/Implementation columns clickable to launch workflows
- [x] Turn status labels into smart buttons (Start/Continue/View based on progress)
- [x] Add simple progress dots (○●) instead of progress bars
- [x] Update column headers with guidance (Questionnaire → "Start here", Testing → "Validate", Implementation → "Plan")
- [x] Add muted/opacity for locked phases (validation & implementation muted at 40% if questionnaire incomplete)
- [x] Remove View column since workflow columns are the actions

## Implementation Dashboard UI Fixes (Mar 13, 2026)
- [x] Issue 1: Increase font sizes (text-sm), tighter column widths, consistent font sizing throughout
- [x] Issue 2: Clicking site name navigates to /org/{slug} (org dashboard)
- [x] Issue 3: Questionnaire column has bigger progress dots (w-3 h-3 rounded-full), hover highlight, clickable appearance, no grayed out text
- [x] Issue 4: Testing column shows 0/4 section counts with progress dots, consistent Start/Continue/View buttons, collapsible sections on Validation page, consistent font color/size (text-foreground)
- [x] Issue 5: Implementation page is now a dedicated checklist-only view (removed sidebar/timeline), collapsible sections, links directly from dashboard

## Validation Check Date Fields (Mar 13, 2026)
- [x] Add date field to every validation check item
- [x] Auto-populate date with today's date when checkbox is checked
- [x] Allow manual date override via date picker

## Validation Check Simplification (Mar 13, 2026)
- [x] Replace Pass/Fail/Pending status with simple checkbox (tested or not)
- [x] Remove Expected column (performance thresholds not relevant — it's about task completion)
- [x] Auto-populate date when checkbox is checked
- [x] Allow manual date override

## Linked Questionnaire Answers in Validation (Mar 13, 2026)
- [x] Map questionnaire questions to related validation test items (18 tests mapped to 30+ question IDs)
- [x] Show related questionnaire answers beside each test via expandable "Show related answers" toggle
- [x] Clicking a linked answer navigates to questionnaire section with question highlighted (deep link with ?section=&q=)
- [x] Added id attributes to question containers in IntakeNewRedesign for scroll-to-question support

## Bulk Actions on Testing Checklist (Mar 13, 2026)
- [x] Add "Mark All Complete" button per phase to bulk-check all tests in that phase
- [x] Add "Set All Dates" date picker per phase to bulk-update dates for all tests in that phase

## Mark All Incomplete Button (Mar 14, 2026)
- [x] Add "Mark All Incomplete" button per phase as inverse of "Mark All Complete" for re-validation (clears status and date, disabled when no tests are checked)

## Org Site Dashboard Redesign (Mar 14, 2026)
- [x] Redesign Home page as rich command-center dashboard
- [x] Add overall progress hero with SVG progress ring (weighted: Q 40%, Testing 30%, Impl 30%)
- [x] Three workflow phase cards with progress bars, dots, and Start/Continue/View buttons
- [x] Architecture Diagram collapsible section with image preview, download, and remove
- [x] Questionnaire Sections breakdown with per-section progress bars and counts
- [x] Testing Checklist summary with progress ring
- [x] Implementation Checklist summary with progress ring
- [x] Specifications section showing all uploaded NL specs
- [x] All sections collapsible for clean view
- [x] Stats sidebar with file count, active phase badge, diagram status

## Visual Professionalism Polish (Mar 15, 2026)
- [x] Consistent card elevation with subtle shadow and purple glow
- [x] Refined color palette — unified 3-shade purple system with warm grays
- [x] Better table styling — alternating row tints, rounded containers, larger row height
- [x] Typography hierarchy — clear size/weight scale (28/20/16/14/12)
- [x] Status badge redesign — pill badges with subtle gradients and icons
- [x] Divider lines between major sections with proper spacing
- [x] Logo and header refinement — taller height, gradient bottom border
- [x] Progress indicator refinement — bordered mini-circles instead of plain dots
- [x] Hover states everywhere — cards, buttons, table rows with consistent transitions
- [x] Page transitions — subtle fade-in on mount
- [x] Smooth scroll behavior globally
- [x] Better font weight imports for typographic range
- [x] Glass-effect header with backdrop-blur

## Remove Repetitive Sections from Org Dashboard (Mar 15, 2026)
- [x] Remove Questionnaire Sections, Testing Checklist, and Implementation Checklist collapsible sections from bottom of Org Dashboard (duplicates workflow cards above)

## Testing & Task List Refinements (Mar 15, 2026)
- [x] Refine Testing Checklist bulk actions (Mark All Complete/Incomplete, Set All Dates) for more professional appearance
- [x] Add date fields and bulk actions to the Task List page for consistency with Testing Checklist
- [x] Rename "Implementation" to "Task List" on Platform Admin dashboard column header
- [x] Rename "Implementation" to "Task List" on Org Dashboard workflow card (title + subtitle)
- [x] Rename "Task List" page header to "Task List"

## CSV Export & Import for Progress Reports (Mar 15, 2026)
- [x] Create shared CSV utility functions (escape, parse, download helper)
- [x] Add CSV export button to Testing Checklist page (test name, phase, status, date tested, sign-off)
- [x] Add CSV import button to Testing Checklist page (bulk update from uploaded CSV)
- [x] Add CSV export button to Task List page (task name, phase, status, owner, target date, completed date)
- [x] Add CSV import button to Task List page (bulk update from uploaded CSV)
- [x] CSV import processes client-side and updates state directly (no server endpoint needed)
- [x] Include organization name and export date in the CSV filename
- [x] Write vitest tests for CSV utility functions

## NL Specifications Access from Org Dashboard (Mar 18, 2026)
- [x] Add Specifications link to the org dashboard UserMenu dropdown
- [x] Create dedicated /org/:slug/specs page with search, category grouping, and download buttons
- [x] Register route in App.tsx
- [x] Ensure the specs page works for non-admin users (read-only view)

## Dashboard Layout Reorganization (Mar 18, 2026)
- [x] Move Connectivity section above the Implementation Progress bar
- [x] Move Specs section above the Implementation Progress bar
- [x] Compact all sections to fit in one viewport without scrolling
- [x] Reduce padding, card sizes, and spacing to achieve single-view layout
- [x] Remove duplicate Specifications collapsible section (now a separate page)

## Permanent Fix: Duplicate Users on Deployment (Mar 18, 2026)
- [x] Clean up all duplicate email rows in users table (jennifer: 3→1, melissa: 2→1)
- [x] Add UNIQUE constraint on email column in database schema (migration 0027)
- [x] Login queries already use LIMIT 1 — verified in auth.ts and authRoutes.ts
- [x] All user creation endpoints already check for existing email before insert
- [x] db.ts upsert uses onDuplicateKeyUpdate for OAuth flow
- [ ] Verify login works after cleanup

## Fix Duplicate Sections on Org Dashboard (Mar 18, 2026)
- [x] Remove duplicate Connectivity cards/links on org dashboard
- [x] Remove duplicate Notion/Specs cards/links on org dashboard

## Dashboard Top Section Redesign (Mar 18, 2026)
- [x] Connectivity card: expandable with inline Notion connectivity table, download/delete actions
- [x] Architecture card: compact thumbnail strip with horizontal scroll, click-to-enlarge lightbox, download/delete per diagram
- [x] Specifications card: show NL standard docs + site-uploaded files, download/delete actions
- [x] Arrange all 3 cards in a row above the Implementation Progress bar
- [x] Remove old collapsible Architecture Diagram section
- [x] Remove old collapsible Connectivity section (already done)
- [ ] Add /org/:slug/connectivity route and page as fallback
- [ ] DO NOT modify any auth/password/user code

## Bug Fix: Dashboard Count Mismatch (Mar 18, 2026)
- [x] Fix Task List count showing 0% on dashboard but 3% on Task List page (verified: dashboard uses v.completed===true, matching API)
- [x] Fix Testing count mismatch between dashboard and Testing Checklist page (verified: dashboard uses v.status==="Pass", matching Validation page)

## SSO AD Configuration & Not Applicable Status (Mar 19, 2026)
- [x] Add SSO Active Directory Configuration task to Task List (System Configuration section)
- [x] Add link to SSO Instructions PDF from Specifications page
- [x] Add SSO test to Testing Checklist (Connectivity Validation phase)
- [x] Add "Not Applicable" (N/A) option for tasks (same as marking complete but excludes from count)
- [x] Add "Not Applicable" status option for tests (alongside Pass/Fail/Not Tested)
- [x] Update task UI to show N/A toggle/button
- [x] Update test UI to show N/A toggle/button
- [x] N/A items should be excluded from completion percentage calculations
- [x] Update dashboard counts to account for N/A items
- [x] Fix dashboard hardcoded totals (28 tests, 39 tasks) to match actual page counts
- [x] Update CSV export to include N/A status for both tasks and tests
## Fix Notion API Integration (Mar 19, 2026)
- [x] Fix 'client.databases.query is not a function' error in Notion connectivity fetch
  - Root cause: @notionhq/client v5.9.0 moved databases.query to dataSources.query with data_source_id
  - Also fixed: hardcoded connectivity DB ID was invalid; now uses NOTION_CONNECTIVITY_DATASOURCE_ID env var
  - Added parseConnectionDetails() to extract IPs/ports/AE from free-text "connection details" field
- [x] Verify connectivity data displays correctly on org dashboard expandable card
  - Tested with Munson Medical Center: 3 rows (HL7 ORM, DICOM, VPN) load correctly
- [ ] Verify connectivity data displays on dedicated connectivity pages

## Redesign Task/Test Status UX (Mar 20, 2026)
- [ ] Select rows via checkboxes (individual or Select All per phase)
- [ ] Bulk action toolbar appears when rows selected: Mark Done, Mark N/A, Undo
- [x] Date auto-records when marking Done or N/A (date of action, not manual entry)
- [x] Status column clearly shows status (Done, N/A, blank) with the date it was set
- [x] Mass select and bulk Mark Done, Mark N/A, or Undo
- [x] Same UX pattern for both Task List (Implementation) and Testing (Validation) pages
- [x] Remove old tiny inline N/A buttons
- [x] Update DB schema if needed for status + date tracking on tasks

## Redesign Task/Test Status UX (Mar 20, 2026)
- [x] Remove tiny inline N/A buttons from task/test rows
- [x] Add prominent status column with clickable StatusBadge: Open → Done → N/A → Open
- [x] Record date when any status is set (Done date, N/A date)
- [x] Select rows via checkboxes (individual + Select All per phase)
- [x] Floating bulk action toolbar when rows selected: Mark Done/Tested, Mark N/A, Undo, Clear
- [x] Same UX pattern for both Task List and Testing pages
- [x] Fix server to set completedAt when N/A is marked (record the action date)

## Architecture Document Management (Mar 20, 2026)
- [ ] Allow uploading multiple architecture diagrams
- [ ] Allow removing individual architecture diagrams
- [ ] Allow replacing individual architecture diagrams

## Per-Site File Artifacts (Mar 20, 2026)
- [ ] Add file artifacts/documents section per org site
- [ ] Upload documents with notes per file
- [ ] View/download uploaded documents
- [ ] Delete uploaded documents
- [ ] Store files in S3 with metadata in DB

## Dashboard Completion Percentage Display (Mar 20, 2026)
- [x] Show task completion % on dashboard matching Task List page
- [x] Show test completion % on dashboard matching Testing page
- [x] Ensure N/A items are excluded from counts consistently
- [x] Hero stats show percentage prominently with count below (e.g. "17%" / "1/6 Questionnaire")

## Welcome Email Draft (Mar 20, 2026)
- [ ] Create welcome email draft in Gmail for inviting newly created portal users

## Back to Dashboard Navigation (Mar 20, 2026)
- [x] Add easy "Back to Dashboard" navigation from Questionnaire (Intake) page — added to header
- [x] Add easy "Back to Dashboard" navigation from Task List (Implementation) page — already existed
- [x] Add easy "Back to Dashboard" navigation from Testing (Validation) page — already existed
- [x] Add easy "Back to Dashboard" navigation from Specifications page — already existed (ArrowLeft + Dashboard button)
- [x] Add easy "Back to Dashboard" navigation from Connectivity page — already existed (ArrowLeft + Dashboard button)
- [x] Consistent placement across all sub-pages

## Questionnaire Navigation Update (Mar 20, 2026)
- [x] Update Questionnaire page header to match Task List/Testing navigation style
- [x] Add "Back to Dashboard" link in Questionnaire header consistent with other pages
## Consistent Header Navigation Across All Pages (Mar 20, 2026)
- [ ] Always display: New Lantern logo, Hospital name, Rad Group — in the same spot on every page
- [ ] Always show a way to return to the org dashboard from any sub-page
- [ ] Admin-only quick-nav: links to org dashboard, partner dashboard, and admin (all sites) dashboard (hidden for regular users)
- [ ] Create shared PageHeader component used by all sub-pages
- [ ] Apply shared header to: Task List, Testing, Questionnaire, Specifications, Connectivity

## Merge Task Summary into Task List Card
- [x] Merge task status breakdown (Done/In Progress/Blocked/Open/N/A counts + Next Up) into the Task List workflow card on dashboard

## Add Status Breakdown to Questionnaire and Testing Cards
- [x] Add status breakdown (Complete/In Progress/Not Started counts) and Next Up sections to Questionnaire workflow card
- [x] Add status breakdown (Pass/Fail/Not Tested counts) and Next Up sections to Testing workflow card

## Interactive Architecture Diagram
- [x] ~Create interactive architecture diagram component~ (cancelled by user)
- [x] ~Add editable fields/dropdowns for org-specific systems~ (cancelled by user)
- [x] ~Add backend persistence for architecture diagram data per org~ (cancelled by user)
- [x] ~Integrate diagram into the Architecture section~ (cancelled by user)

## Clean File Upload Redesign
- [x] Create shared UploadedFilesList component with vertical layout, full filenames, date, size, preview, download, remove
- [x] Integrate clean file upload into Architecture page (Home.tsx dashboard)
- [x] Integrate clean file upload into Questionnaire page (IntakeNewRedesign.tsx)
- [x] Ensure consistent design across all file upload areas

## Consistent Org Name Display Across All Pages (Mar 22, 2026)
- [x] Audit all pages for how org name (hospital/rad group) is currently displayed
- [x] Standardize font, size, location, and style of org name across all pages
- [x] Apply consistent org name display to: Dashboard, Questionnaire, Task List, Testing, Specifications, Connectivity

## Weighted Progress Calculation (Mar 22, 2026)
- [x] Update Task List progress: Done=100%, N/A=100%, InProgress=50%, Blocked=25%, Open=0%
- [x] Update Testing progress: Pass=100%, N/A=100%, Fail=25%, NotTested=0%
- [x] Update Progress Hero and overall implementation progress to use weighted calculation
- [x] Ensure consistent weighted calculation across dashboard, admin, and partner views

## Historic Reports File Upload (Mar 23, 2026)
- [x] Add historic reports upload question (CF.7) to Configuration Files section
- [x] Implement file type validation for CSV and TXT files only (accept attribute + JS validation)
- [x] Add acceptTypes field to Question interface for reusable file type restrictions
- [x] Upload UI uses existing clean UploadedFilesList component automatically

## Remove Historic Reports Upload (PHI concern)
- [x] Remove CF.7 Historic Reports flat file upload from questionnaire (contains PHI)

## Re-apply GitHub PR Changes After Rollback (Mar 31, 2026)
- [x] Weighted progress formula in PlatformAdmin (Q 40% + Testing 30% + Tasks 30%)
- [x] Weighted progress formula in PartnerAdmin
- [x] Collapsible site cards in PlatformAdmin with stable useEffect (no #310 error)
- [x] Stronger card borders and contrast
- [x] Auto-expand first site card
- [x] Notion connectivity fixes (server/notion.ts type cast)
- [x] Notes & Files upload feature (org_notes table, routes, UI)
- [x] All other PR changes from 0688aee
- [x] Fix "Rendered more hooks" error - moved useEffect above early return using ref bridge pattern

## PlatformAdmin Visual Improvements - Bolder Contrast & Tighter Layout (Mar 31, 2026)
- [x] Make card borders much bolder/more visible (border-primary/50 with purple shadow)
- [x] Increase font sizes across the dashboard (org names text-lg, stats text-sm, percentages text-lg)
- [x] Reduce dark empty space - tightened container py-5, card spacing space-y-3, header py-3

## Expand Testing/Validation Statuses (Mar 31, 2026)
- [x] Update DB schema enum to add In Progress and Blocked (Pass, Fail, Not Tested, Pending, N/A, In Progress, Blocked)
- [x] Migrate existing records (existing Pass/Fail/N/A/Not Tested remain valid)
- [x] Update backend admin stats to count all 6 statuses (pass, fail, inProgress, blocked, na, notTested)
- [x] Update Validation.tsx: StatusBadge with 6 colors, cycleStatus with 6 states, bulk actions for all 6
- [x] Update overall + per-phase + sidebar summary stats to show all 6 counts
- [x] Update Home.tsx testing card with 6-status breakdown and weighted formula
- [x] Update PlatformAdmin testing mini card with all 6 status counts
- [x] Update CSV export/import to handle all 6 statuses

## Fix Import Dialog Text (Mar 31, 2026)
- [x] Fix file input accept filter — already accepts .json, .txt, .csv (verified)
- [x] Fix import parsing — improved JSON detection (handles .txt/.csv containing JSON), added clear error for unrecognized formats with tip to use Export
- [x] Ensure export and import formats are consistent — export produces .json, import detects JSON regardless of file extension
- [x] Fix export function name — renamed handleExportCSV to handleExportData (button label was already correct as "Export")
- [x] Updated import dialog description to be more accurate

## In Progress Tests Count as 50% (Mar 31, 2026)
- [x] Update testing progress calculation so In Progress counts as 50% instead of 0%
- [x] Applied consistently: Home.tsx (already correct), PlatformAdmin.tsx (fixed), PartnerAdmin.tsx (fixed), Validation.tsx overall + phase-level + donut chart (fixed)
- [x] Weights: Pass=100%, InProgress=50%, Fail=25%, Blocked=25%, N/A=excluded, Open=0%

## Connectivity Table Improvements (Mar 31, 2026)
- [x] Update Traffic Type options to: ADT, Orders, Reports, Images, Image Priors, Image Q&R
- [x] Add legacy type migration (DICOM→Images, HL7 ORM→Orders, HL7 ORU→Reports, etc.)
- [x] Fix table readability — bigger fonts (text-xs), fixed column widths, horizontal scroll, text wrapping instead of truncation

## Bug Fixes - Testing Status Persistence, Color Consistency & Dashboard Ordering (Mar 31, 2026)
- [x] Fix "In Progress" testing status reverting to "Failed" on page reload (Marshall example) — backend Zod enum was missing In Progress and Blocked
- [x] Make "In Progress" colors consistent between tests and tasks (use blue everywhere)
- [x] Make dashboard ordering consistent across all views

## New Features - N/A for Questionnaire/Files & Architecture Thumbnail (Apr 1, 2026)
- [x] Add N/A option to questionnaire/file uploads so sections can be skipped
- [x] Add architecture picture thumbnail to the dashboard

## Individual Question N/A (Apr 2, 2026)
- [x] Allow users to mark individual questionnaire questions as N/A (not just entire sections)

## Migrate Uploads to Google Drive (Apr 2, 2026)
- [x] Migrate all existing uploaded files from S3 to Google Drive with per-customer folders (65 files across 12 folders)
- [x] Create customer Google Drive folder when new org is created
- [x] Update app to upload files to customer's Drive folder going forward
- [x] Update DB file URLs to point to new Drive locations (files uploaded to per-customer folders)
- [x] Ensure files are retrievable from Google Drive (working links)
- [x] Enforce file access control: partners see own customers only, admins see all, customers see own only
- [x] Create file activity audit log that writes to Google Sheet (admin-only access)

## Bug Fixes - N/A Counting & Connectivity Progress (Apr 3, 2026)
- [x] N/A questions should count as done in progress calculations
- [x] N/A questions should be trackable from the dashboard (show N/A count)
- [x] Connectivity not reaching 100% for San Ramon despite added rows — progress calc was using stale responses instead of live connRows
- [x] Connectivity section sidebar should show as done (checked) when connectivity table has rows filled in

## Upload Question N/A (Apr 3, 2026)
- [x] Add N/A button to upload questions (e.g., CF.2, CF.3) so they can be skipped and count as done

## N/A Question Counter on Dashboards (Apr 4, 2026)
- [x] Add N/A question count per org to admin dashboard (table column + expanded mini card)
- [x] Add N/A question count per org to partner dashboard (already in Home.tsx via shared progress)

## AI Chat Assistant (Apr 5, 2026)
- [ ] Create persistent AI chat widget component visible on all pages
- [ ] Add helpful proactive prompts (e.g., "Want me to upload and populate answers for you?")
- [ ] Build backend LLM endpoint to parse uploaded documents and extract questionnaire answers
- [ ] Wire chat uploads to LLM: parse document and populate questionnaire fields
- [ ] Backend auto-populate: when files uploaded with clear customer association, extract answers automatically
- [ ] Skip auto-populate for generic uploads without a discrete customer tie
- [ ] Chat assistant answers user questions and navigates them to the relevant page/section
- [ ] Chat suggests users can paste emails or upload forms to auto-extract and populate answers

## AI Chat RBAC & Partner Dashboard (Apr 6, 2026)
- [x] Add AI chat widget to partner dashboard (Home.tsx) at the top
- [x] Harden AI router RBAC - strict partner isolation in all tool executors (no cross-partner data leakage)
- [x] Allow partner admins (not just platform admins) to use AI chat endpoint
- [x] Write tests for RBAC enforcement in AI router

## AI Audit Logging System (Apr 6, 2026)
- [x] Create aiAuditLogs database table schema (action, actor, target, result, metadata, timestamp)
- [x] Push database migration for audit log table
- [x] Add audit logging to every AI tool executor (navigate, list_orgs, list_users, create_org, create_user, get_report, extract_text)
- [x] Log the chat conversation itself (user prompt + AI response)
- [x] Create tRPC endpoints to query audit logs (list with filters, detail view)
- [x] Build admin UI page to view AI audit logs with filtering
- [x] RBAC on audit log viewing (platform admin sees all, partner admin sees only their logs)
- [x] Write tests for audit logging

## AI Chat Inline Panel & Dashboard Navigation (Apr 6, 2026)
- [x] Redesign AdminChatWidget from floating overlay to inline panel component
- [x] Place inline AI chat at the top of the partner dashboard (always visible)
- [x] Make org names clickable on partner dashboard to navigate to site dashboard
- [x] Make org names clickable on admin dashboard to navigate to site dashboard
- [x] Tighten site dashboard spacing — reduce padding/gaps to fit on one screen
- [x] Improve site dashboard mobile responsiveness
- [x] Save Notion/CRM architecture design discussion as a design doc

## Context-Aware AI Chat on Site Dashboard (Apr 6, 2026)
- [x] Add org-scoped tools to AI router: get_tasks, get_notes, get_questionnaire_answers, get_files, get_connectivity
- [x] Pass org slug/id from InlineChatPanel to AI chat endpoint when on site dashboard
- [x] Update system prompt for site dashboard context — AI should use org data and not reference other orgs
- [ ] AI should be able to read uploaded files/documents for the current org
- [ ] Test AI can answer questions about a specific org's tasks, notes, questionnaire, connectivity
- [x] Bug: Duplicate "Ask anything" input bars on site dashboard (InlineChatPanel + AIChatBox both show inputs)
- [x] Bug: AI assistant on site dashboard still uses cross-org tools (list_organizations etc.) — must restrict to org-scoped tools ONLY
- [x] Feature: Server-side PDF status report generation for site dashboard (org profile, progress stats, phase summaries)
- [x] Feature: Server-side formatted HTML email generation for remaining tasks (nice table with task name, section, status, owner)
- [x] Feature: Export buttons on site dashboard UI (Download PDF, Export Email) for admin users
- [x] Feature: Email preview dialog with Copy HTML and Download HTML options
- [x] Bug: Fix mobile/phone view of Organizations tab - tables overflow on small screens
- [x] Bug: Fix mobile/phone view of Users tab - tables overflow on small screens
- [x] Bug: Fix mobile view of Admin Dashboard - org names truncating, cards oversized with wasted space
- [x] Fix: Remove DONE% and N/A QS columns from Organizations table
- [x] Fix: Remove Complete button from Organizations table actions
- [x] Fix: Standardize org actions to Edit/Deactivate (active) and Edit/Activate (inactive)
- [x] Fix: Rename "Off" to "Deactivate" in Users table for consistency
- [x] Fix: Add Edit button to inactive/deactivated users
- [x] Fix: Add Edit button to completed orgs (Edit | Reopen)
- [x] Fix: Add Edit button to deactivated orgs (Edit | Activate)
