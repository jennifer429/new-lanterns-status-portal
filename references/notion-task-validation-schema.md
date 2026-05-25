# Notion Database Schemas for Task Completions & Validation Results

## Task Completion Records
- Database ID: bf0d616d-9f92-42b9-86a3-497814b14e46
- Data Source ID: ddf65e15-4b76-459a-a0fc-15c0fab023b0

| Notion Column | Type | MySQL Field |
|---|---|---|
| Name | title | (generated: "orgSlug/taskId") |
| Organization ID | number | organizationId |
| Section Name | text | sectionName |
| Task Key | text | taskId |
| Status | select: Complete, In Progress, Blocked, N/A, Not Started | derived from completed/inProgress/blocked/notApplicable |
| Target Date | text | targetDate |
| Notes | text | notes |
| Completed At | text | completedAt (ISO) |
| Completed By | text | completedBy |
| Site | relation | (org relation) |

## Validation Results
- Database ID: 17813c6e-932c-4b1f-9c60-c4645f9cfbbb
- Data Source ID: 2294cf68-e0b5-40b9-87d5-60c2da095926

| Notion Column | Type | MySQL Field |
|---|---|---|
| Name | title | (generated: "orgSlug/testKey") |
| Organization ID | number | organizationId |
| Test Key | text | testKey |
| Status | select: Pass, Fail, Not Tested, Pending, N/A, In Progress, Blocked | status |
| Actual | text | actual |
| Sign Off | text | signOff |
| Notes | text | notes |
| Tested Date | text | testedDate |
| Updated By | text | updatedBy |
| Site | relation | (org relation) |
