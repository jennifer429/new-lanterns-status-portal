# Integration Setup Guide

This document explains how the portal integrates with ClickUp, Linear, and Google Drive, and what needs to be configured.

## Overview

The portal acts as an **interface layer** that connects hospitals to your existing tools:

- **Google Drive** - Stores all uploaded files
- **ClickUp** - Tracks PM tasks and file reviews
- **Linear** - Manages dev team issues and two-way communication

## Data Flow

```
Hospital User Actions → Portal → Google Drive + ClickUp + Linear
                                       ↓
                               PM/Dev Team Tools
```

### 1. File Upload Flow

When a hospital user uploads a file:

1. **Portal** receives file upload
2. **Google Drive** stores file in `Implementation Files/{OrganizationName}/` folder
3. **ClickUp** gets comment with file link (if clickupListId is configured)
4. **Linear** gets comment with file link (if linearIssueId is configured)
5. **Database** saves file metadata for portal display

**Code:** `server/routers/files.ts` - `upload` procedure

### 2. Team Update Flow (Linear → Portal)

When dev team posts update with @Client tag:

1. **Zapier** watches Linear for comments with @Client tag
2. **Webhook** at `/api/zapier/linear-feedback` receives update
3. **Database** saves to activity feed table
4. **Portal** displays in Team Updates section

**Code:** `server/webhooks.ts` - `/api/zapier/linear-feedback` endpoint

### 3. Hospital Reply Flow (Portal → Linear)

When hospital replies to team update:

1. **Portal** sends reply via ActivityFeed component
2. **API** posts comment to Linear issue (using linearIssueId)
3. **Database** saves reply to activity feed
4. **Linear** shows comment tagged with hospital name

**Code:** `server/routers/organizations.ts` - `postReply` procedure

## Required MCP Server Configuration

The portal uses MCP (Model Context Protocol) to interact with ClickUp and Linear. These servers must be **enabled** in your Manus project settings:

### ClickUp MCP Server

**Status:** Currently disabled (causing errors in console logs)

**Required for:**
- Creating tasks when files are uploaded
- Posting file links as comments
- Auto-creating organization lists

**To enable:**
1. Go to Manus project settings
2. Enable ClickUp MCP server
3. Authenticate with your ClickUp workspace

### Linear MCP Server

**Status:** Currently disabled

**Required for:**
- Posting hospital replies to Linear issues
- Creating comments with @Client tags

**To enable:**
1. Go to Manus project settings
2. Enable Linear MCP server  
3. Authenticate with your Linear workspace

## PM Setup Process (Per Organization)

When onboarding a new hospital, the PM follows these steps:

### Step 1: Create Linear Issue

1. Open Linear
2. Create new issue: `{Hospital Name} - Implementation`
3. Copy the issue ID (e.g., `NL-123`)

### Step 2: Create ClickUp List

1. Open ClickUp
2. Create new list in "Implementations" space: `{Hospital Name} Implementation`
3. Copy the list ID from the URL

### Step 3: Create Google Drive Folder

1. Open Google Drive
2. Navigate to `Implementation Files/`
3. Create folder: `{Hospital Name}`
4. Copy the folder ID from the URL

### Step 4: Create Organization in Portal

1. Go to `/admin` page in portal
2. Fill out the form:
   - Hospital name, contact info, dates
   - Linear Issue ID from Step 1
   - ClickUp List ID from Step 2
   - Google Drive Folder ID from Step 3
3. Click "Create Organization"
4. Share the generated portal URL with hospital contact

## Zapier Setup (One-Time)

To enable Linear → Portal updates:

### Create Zapier Zap

1. **Trigger:** Linear - New Comment
2. **Filter:** Comment body contains "@Client"
3. **Action:** Webhooks by Zapier - POST
   - URL: `https://your-portal.manus.space/api/zapier/linear-feedback`
   - Payload:
     ```json
     {
       "organizationName": "{{Issue Title}}",
       "author": "{{Comment Author}}",
       "message": "{{Comment Body}}",
       "timestamp": "{{Comment Created At}}"
     }
     ```

## Troubleshooting

### Files not appearing in ClickUp/Linear

**Symptom:** Files upload successfully but no comments appear in ClickUp or Linear

**Cause:** MCP servers are disabled or organization doesn't have linearIssueId/clickupListId configured

**Solution:**
1. Enable ClickUp and Linear MCP servers in project settings
2. Verify organization has linearIssueId and clickupListId in database
3. Check server logs for MCP errors

### Activity feed not showing team updates

**Symptom:** Team posts comments in Linear with @Client tag, but nothing appears in portal

**Cause:** Zapier webhook not configured or incorrect organization name matching

**Solution:**
1. Verify Zapier zap is enabled and running
2. Check webhook endpoint is accessible: `curl https://your-portal.manus.space/api/webhooks/test-activity`
3. Ensure Linear issue title matches organization name in database

### Hospital replies not posting to Linear

**Symptom:** Hospital clicks Reply and sends message, but it doesn't appear in Linear

**Cause:** Linear MCP server disabled or linearIssueId not configured

**Solution:**
1. Enable Linear MCP server in project settings
2. Verify organization has valid linearIssueId in database
3. Check browser console and server logs for errors

## Database Schema

### Organizations Table

Key fields for integrations:

- `linearIssueId` - Linear issue ID for two-way communication (e.g., "NL-123")
- `clickupListId` - ClickUp list ID for task tracking (e.g., "123456789")
- `googleDriveFolderId` - Google Drive folder ID for file storage (e.g., "1a2b3c4d5e6f7g8h9i0j")

### Activity Feed Table

Stores all team updates and hospital replies:

- `organizationId` - Links to organization
- `author` - Who posted the message ("PM Team", "Development Team", or hospital name)
- `message` - Message content
- `source` - Where it came from ("linear", "clickup", "portal")
- `createdAt` - Timestamp

### File Attachments Table

Tracks all uploaded files:

- `organizationId` - Links to organization
- `taskId` - Which task the file was uploaded for
- `fileName` - Original filename
- `fileUrl` - Google Drive shareable link
- `fileKey` - Internal reference (gdrive://{org}/{filename})
- `uploadedBy` - Hospital user who uploaded

## Testing Checklist

Before going live with a new organization:

- [ ] MCP servers (ClickUp + Linear) are enabled
- [ ] Organization created in admin page with all integration IDs
- [ ] Test file upload → verify appears in Google Drive, ClickUp, Linear
- [ ] Test team update in Linear with @Client → verify appears in portal
- [ ] Test hospital reply → verify appears in Linear issue
- [ ] Share portal URL with hospital contact
- [ ] Verify hospital can log in and see their tasks

## Future Enhancements

Potential improvements to consider:

1. **Email notifications** - Use ClickUp/Linear's native email automation instead of building custom
2. **Real-time updates** - Add WebSocket support for instant activity feed updates
3. **File preview** - Show file previews in portal instead of just links
4. **Bulk actions** - Allow PM to create multiple organizations at once
5. **Analytics** - Track completion rates, time-to-complete, bottlenecks
