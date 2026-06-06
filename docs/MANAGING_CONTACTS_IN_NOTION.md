# Managing Contacts in Notion

This guide explains how to add, edit, and manage contacts for organizations in the Notion Contacts database. Contacts are the single source of truth and automatically sync to the portal.

## Overview

**Contacts Database:** [Notion Contacts v2](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)

**Sync Behavior:**
- Contacts are stored in Notion (source of truth)
- Changes sync automatically to MySQL every 5 minutes
- Portal displays contacts from the MySQL cache
- Dual-write: Portal edits go to both Notion and MySQL

**Key Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Site | Text | Yes | Organization/site name (e.g., "RMC Anniston Radiology", "RMCA") |
| Role | Select | Yes | Contact role (e.g., "IT Director", "Compliance Officer", "Project Manager") |
| Name | Text | Yes | Contact's full name |
| Email | Email | Yes | Contact's email address |
| Phone | Phone | No | Contact's phone number |
| Active | Checkbox | No | Whether this contact is currently active |

---

## Adding a New Contact

### Step 1: Open the Contacts Database
1. Go to [Notion Contacts v2](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)
2. Click **+ Add a record** (or **+ New** in table view)

### Step 2: Fill in Contact Details
1. **Site** — Select or type the organization name (e.g., "RMCA", "RMC Anniston Radiology")
   - If the site doesn't exist, type it and press Enter to create it
2. **Role** — Select from existing roles or create a new one
   - Common roles: IT Director, Compliance Officer, Project Manager, Clinical Lead, Radiology Manager
3. **Name** — Enter the contact's full name
4. **Email** — Enter their email address (required for notifications)
5. **Phone** — Enter their phone number (optional)
6. **Active** — Check this box if the contact is currently active

### Step 3: Save
- Click outside the row or press Escape to save
- The contact will sync to the portal within 5 minutes

---

## Editing an Existing Contact

### In Notion
1. Open the [Contacts database](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)
2. Find the contact by Site or Name
3. Click on the row to open the detail view
4. Edit any field and save
5. Changes sync to the portal within 5 minutes

### In the Portal
1. Navigate to an organization's questionnaire
2. Scroll to **Organization Info** section
3. Click **Edit Contacts**
4. Add, edit, or remove contacts
5. Click **Save** — changes go to both Notion and MySQL

---

## Deleting a Contact

### Option 1: Archive (Recommended)
1. Open the contact in Notion
2. Uncheck the **Active** checkbox
3. The contact will be hidden from the portal but preserved in history

### Option 2: Delete Permanently
1. Open the [Contacts database](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)
2. Right-click the row and select **Delete**
3. Confirm the deletion
4. The contact will be removed from the portal within 5 minutes

---

## Bulk Operations

### Add Multiple Contacts at Once
1. Open the [Contacts database](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)
2. Use Notion's **Duplicate** feature to copy a similar contact
3. Edit the fields for the new contact
4. Repeat as needed

### Bulk Edit Sites
If an organization name changes (e.g., "RMC Anniston Radiology" → "RMC Anniston"):
1. Open the [Contacts database](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)
2. Filter by the old site name
3. Select all rows (Cmd/Ctrl + A)
4. Use Notion's bulk edit to update the Site field
5. Changes sync within 5 minutes

---

## Roles Reference

Common roles used in the portal:

| Role | Typical Responsibilities |
|------|--------------------------|
| **IT Director** | Overall IT infrastructure, system architecture, vendor management |
| **Compliance Officer** | HIPAA, security, audit, regulatory compliance |
| **Project Manager** | Implementation timeline, coordination, deliverables |
| **Clinical Lead** | Workflow requirements, clinical validation, end-user testing |
| **Radiology Manager** | Department operations, staff training, go-live readiness |
| **PACS Administrator** | System configuration, user access, technical support |
| **Network Administrator** | Network connectivity, firewall, HL7 routing |
| **Security Officer** | Access control, authentication, encryption |

**To add a new role:**
1. Open a contact in Notion
2. Click the **Role** field
3. Type a new role name and press Enter
4. The role is now available for all future contacts

---

## Sync Behavior & Timing

### How Sync Works
1. **Portal → Notion:** When you edit a contact in the portal, it's written to Notion immediately
2. **Notion → Portal:** Changes made directly in Notion sync to the portal every 5 minutes
3. **Conflict Resolution:** If a contact is edited in both places simultaneously, Notion is the source of truth

### Last Synced Timestamp
- The portal displays when contacts were last synced
- Check the **Sync Status** dashboard to see sync health
- If sync is delayed, check the **Notion Sync Log** in Notion

### Manual Refresh
- In the portal, admin users can click **Refresh Contacts** to force an immediate sync
- This is useful if you've made changes in Notion and want to see them right away

---

## Troubleshooting

### Contact Not Appearing in Portal
1. **Check Active Status** — Is the contact marked as Active in Notion?
2. **Check Site Name** — Does the Site field match the organization in the portal?
3. **Wait for Sync** — Changes take up to 5 minutes to sync
4. **Manual Refresh** — In the portal, click **Refresh Contacts** to force sync
5. **Check Sync Log** — Look at the Notion Sync Log for errors

### Duplicate Contacts
1. Open the [Contacts database](https://www.notion.so/newlantern/Contacts-v2-NOTION_CONTACTS_DATABASE_ID)
2. Look for rows with the same Site + Role + Name
3. Delete or archive the duplicate
4. Sync within 5 minutes

### Contact Disappeared from Portal
1. Check if the contact was archived (Active checkbox unchecked)
2. Check if the Site name was changed
3. Check the Notion Sync Log for any errors
4. If needed, restore from Notion history (Notion's version history feature)

---

## Best Practices

✅ **DO:**
- Keep Site names consistent (e.g., always "RMCA" not "RMC Anniston")
- Use standardized roles (see Roles Reference above)
- Mark inactive contacts as archived rather than deleted
- Review contacts quarterly to keep data clean
- Use the portal's contact editor for quick changes

❌ **DON'T:**
- Edit the same contact in Notion and portal simultaneously
- Delete contacts without archiving first (use Archive to preserve history)
- Create duplicate roles with different capitalization
- Leave blank email addresses (required for notifications)
- Manually edit the MySQL contacts table (changes will be overwritten by sync)

---

## Integration with Portal Features

### Organization Info Section
- The portal's **Organization Info** green check requires at least one contact
- Contacts are displayed in a dynamic table (no fixed slot limit)
- Portal users can add/edit contacts directly in the questionnaire

### Notifications & Outreach
- Contacts' email addresses are used for:
  - Status update emails
  - Implementation milestones
  - Go-live coordination
  - Post-implementation follow-up

### Reports & Analytics
- Contact data is included in:
  - Implementation dashboards
  - Team rosters
  - Stakeholder reports

---

## Questions?

For issues or questions about managing contacts:
1. Check the **Sync Status** dashboard in the portal
2. Review the **Notion Sync Log** for errors
3. Contact the implementation team for assistance

---

**Last Updated:** June 6, 2026  
**Sync Interval:** Every 5 minutes  
**Source of Truth:** Notion Contacts v2 database
