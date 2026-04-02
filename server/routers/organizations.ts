import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { organizations, clients, sectionProgress, taskCompletion, activityFeed, users, intakeResponses, questions, responses, intakeFileAttachments } from "../../drizzle/schema";
import { questionnaireSections } from "../../shared/questionnaireData";
import { calculateProgress } from "../../shared/progressCalculation";
import { SECTION_DEFS as TASK_SECTION_DEFS } from "../../shared/taskDefs";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { createCustomerFolder } from "../googleDrive";

/**
 * Organizations router - handles organization CRUD and data access
 */
export const organizationsRouter = router({
  /**
   * Create a new organization (for PM/Ops during sales handoff)
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/), // URL-safe slug
        clientId: z.number().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        startDate: z.string().optional(),
        goalDate: z.string().optional(),
        linearIssueId: z.string().optional(),
        clickupListId: z.string().optional(),
        googleDriveFolderId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Auto-create Google Drive folder for this customer if not provided
      let googleDriveFolderId = input.googleDriveFolderId;
      if (!googleDriveFolderId) {
        try {
          const folderId = await createCustomerFolder(input.name);
          if (folderId) {
            googleDriveFolderId = folderId;
            console.log(`[Org] Created Drive folder for ${input.name}: ${folderId}`);
          }
        } catch (err: any) {
          console.error(`[Org] Failed to create Drive folder for ${input.name}:`, err.message);
          // Continue without Drive folder — files will go to root folder
        }
      }

      const [org] = await db.insert(organizations).values({
        ...input,
        googleDriveFolderId: googleDriveFolderId || null,
      });
      return { success: true, organizationId: org.insertId, slug: input.slug };
    }),

  /**
   * Get organization by slug (for portal access)
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);
      
      if (!org) {
        throw new Error("Organization not found");
      }

      // Fetch client name if clientId exists
      let clientName = "Unknown Client";
      if (org.clientId) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, org.clientId))
          .limit(1);
        if (client) {
          clientName = client.name;
        }
      }

      return { ...org, clientName };
    }),

  /**
   * Get organization progress data
   */
  getProgress: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const progress = await db
        .select()
        .from(sectionProgress)
        .where(eq(sectionProgress.organizationId, input.organizationId));

      const tasks = await db
        .select()
        .from(taskCompletion)
        .where(eq(taskCompletion.organizationId, input.organizationId));

      return { progress, tasks };
    }),

  /**
   * Update section progress
   */
  updateSectionProgress: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        sectionName: z.string(),
        status: z.enum(["pending", "in-progress", "complete"]),
        progress: z.number().min(0).max(100),
        expectedEnd: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if section progress exists
      const [existing] = await db
        .select()
        .from(sectionProgress)
        .where(
          and(
            eq(sectionProgress.organizationId, input.organizationId),
            eq(sectionProgress.sectionName, input.sectionName)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(sectionProgress)
          .set({
            status: input.status,
            progress: input.progress,
            expectedEnd: input.expectedEnd,
          })
          .where(eq(sectionProgress.id, existing.id));
      } else {
        // Insert new
        await db.insert(sectionProgress).values(input);
      }

      return { success: true };
    }),

  /**
   * Mark task as complete
   */
  completeTask: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        sectionName: z.string(),
        taskId: z.string(),
        completed: z.boolean(),
        completedBy: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if task completion exists
      const [existing] = await db
        .select()
        .from(taskCompletion)
        .where(
          and(
            eq(taskCompletion.organizationId, input.organizationId),
            eq(taskCompletion.taskId, input.taskId)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(taskCompletion)
          .set({
            completed: input.completed ? 1 : 0,
            completedAt: input.completed ? new Date() : null,
            completedBy: input.completedBy,
            notes: input.notes,
          })
          .where(eq(taskCompletion.id, existing.id));
      } else {
        // Insert new
        await db.insert(taskCompletion).values({
          organizationId: input.organizationId,
          sectionName: input.sectionName,
          taskId: input.taskId,
          completed: input.completed ? 1 : 0,
          completedAt: input.completed ? new Date() : null,
          completedBy: input.completedBy,
          notes: input.notes,
        });
      }

      // Check if section is now complete and trigger ClickUp webhook
      if (input.completed) {
        // Get all tasks for this section
        const sectionTasks = await db
          .select()
          .from(taskCompletion)
          .where(
            and(
              eq(taskCompletion.organizationId, input.organizationId),
              eq(taskCompletion.sectionName, input.sectionName)
            )
          );

        const completedCount = sectionTasks.filter(t => t.completed === 1).length;
        const totalCount = sectionTasks.length;

        // If all tasks in section are complete, create ClickUp task
        if (completedCount === totalCount && totalCount > 0) {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, input.organizationId))
            .limit(1);

          // ClickUp integration removed - section completion tracking simplified
        }
      }

      return { success: true };
    }),

  /**
   * List all organizations (for admin/ops view)
   * Filters by user's clientId for access control
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Filter by user's clientId for access control
    if (ctx.user?.clientId) {
      return await db.select().from(organizations).where(eq(organizations.clientId, ctx.user.clientId));
    } else {
      // Super admin or no clientId - show all
      return await db.select().from(organizations);
    }
  }),

  /**
   * Get activity feed for an organization
   */
  getActivityFeed: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const activities = await db
        .select()
        .from(activityFeed)
        .where(eq(activityFeed.organizationId, input.organizationId))
        .orderBy(desc(activityFeed.createdAt));
      return activities;
    }),

  /**
   * Get metrics for all organizations (for admin dashboard)
   * Filters by user's clientId for access control
   */
  getMetrics: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Filter organizations by user's clientId and exclude inactive
    // If user has no clientId (super admin), show all active organizations
    let orgs;
    if (ctx.user?.clientId) {
      orgs = await db
        .select()
        .from(organizations)
        .where(and(
          eq(organizations.clientId, ctx.user.clientId),
          sql`${organizations.status} != 'inactive'`
        ));
    } else {
      // Super admin or no clientId - show all active organizations
      orgs = await db
        .select()
        .from(organizations)
        .where(sql`${organizations.status} != 'inactive'`);
    }
    
    const metrics = await Promise.all(
      orgs.map(async (org) => {
        // Count users for this organization
        const [userCountResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(eq(users.organizationId, org.id));
        const userCount = userCountResult?.count || 0;

        // Get last login time for this organization
        const [lastLoginResult] = await db
          .select({ lastLoginAt: users.lastLoginAt })
          .from(users)
          .where(eq(users.organizationId, org.id))
          .orderBy(sql`${users.lastLoginAt} DESC`)
          .limit(1);
        const lastLoginAt = lastLoginResult?.lastLoginAt || null;

        // Get section-by-section progress using questionnaireSections (same source as Home.tsx)
        // Include workflow sections
        const allQuestions = questionnaireSections.flatMap(section => {
          if (section.questions) {
            // Regular question sections — filter inactive questions to match the org portal
            return section.questions
              .filter(q => !q.inactive)
              .map(q => ({
                id: q.id,
                sectionTitle: section.title,
                questionText: q.text,
                isWorkflow: false,
                type: q.type,
                conditionalOn: q.conditionalOn || null,
              }));
          } else if (section.type === 'workflow') {
            // Workflow sections - count as 1 item each
            return [{
              id: `${section.id}_config`,
              sectionTitle: section.title,
              questionText: `${section.title} Configuration`,
              isWorkflow: true
            }];
          }
          return [];
        });
        const allResponses = await db
          .select()
          .from(intakeResponses)
          .where(eq(intakeResponses.organizationId, org.id));

        // Get file uploads for this organization
        const allFiles = await db
          .select()
          .from(intakeFileAttachments)
          .where(eq(intakeFileAttachments.organizationId, org.id));

        // Use shared progress calculation function
        const progress = calculateProgress(
          allQuestions,
          allResponses,
          allFiles
        );
        
        const { completionPercentage, sectionProgress: sectionStats } = progress;

        // Get file uploads from intakeFileAttachments table
        const uploadedFiles = await db
          .select()
          .from(intakeFileAttachments)
          .where(eq(intakeFileAttachments.organizationId, org.id));
        
        const filesWithUrls = uploadedFiles.map(f => ({
          questionId: f.questionId,
          fileName: f.fileName,
          url: f.fileUrl
        }));

        // Get task completion stats for this organization
        const taskRows = await db
          .select()
          .from(taskCompletion)
          .where(eq(taskCompletion.organizationId, org.id));
        const taskMap: Record<string, typeof taskRows[number]> = {};
        for (const row of taskRows) {
          taskMap[row.taskId] = row;
        }
        const allTaskDefs = TASK_SECTION_DEFS.flatMap(s => s.tasks);
        const taskStats = {
          total: allTaskDefs.length,
          completed: allTaskDefs.filter(t => taskMap[t.id]?.completed === 1 && taskMap[t.id]?.notApplicable !== 1).length,
          inProgress: allTaskDefs.filter(t => taskMap[t.id]?.inProgress === 1 && taskMap[t.id]?.notApplicable !== 1).length,
          blocked: allTaskDefs.filter(t => taskMap[t.id]?.blocked === 1 && taskMap[t.id]?.notApplicable !== 1).length,
          notApplicable: allTaskDefs.filter(t => taskMap[t.id]?.notApplicable === 1).length,
        };

        return {
          ...org,
          userCount,
          lastLoginAt,
          completionPercentage,
          sectionProgress: sectionStats,
          fileCount: filesWithUrls.length,
          files: filesWithUrls,
          taskStats,
        };
      })
    );

    return metrics;
  }),

  /**
   * Get all organizations (for admin management)
   */
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const allOrgs = await db
      .select()
      .from(organizations)
      .where(sql`${organizations.status} != 'inactive'`)
      .orderBy(organizations.name);
    return allOrgs;
  }),

  /**
   * Update organization name (for admin management)
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(organizations)
        .set({ name: input.name })
        .where(eq(organizations.id, input.id));
      return { success: true };
    }),

  /**
   * Inactivate organization (soft delete - hides from dashboard and portal)
   */
  inactivate: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(organizations)
        .set({ status: "inactive" })
        .where(eq(organizations.id, input.id));
      return { success: true };
    }),

  /**
   * Post a reply from hospital to Linear issue
   */
  postReply: publicProcedure
    .input(
      z.object({
        organizationId: z.number(),
        message: z.string().min(1),
        authorName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get organization with Linear issue ID
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (!org) {
        throw new Error("Organization not found");
      }

      if (!org.linearIssueId) {
        throw new Error("No Linear issue configured for this organization");
      }

      // Linear integration removed - save directly to activity feed
      const author = input.authorName || org.contactName || "Hospital Team";
      
      await db.insert(activityFeed).values({
        organizationId: input.organizationId,
        source: "manual",
        author: author,
        message: input.message,
      });

      return { success: true };
    }),
});
