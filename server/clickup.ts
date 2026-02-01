import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ClickUpTaskInput {
  listName: string;
  taskName: string;
  description?: string;
  priority?: "urgent" | "high" | "normal" | "low";
  assignees?: string[];
  tags?: string[];
  dueDate?: string;
}

interface ClickUpTaskResult {
  success: boolean;
  taskId?: string;
  taskUrl?: string;
  error?: string;
}

/**
 * Create a task in ClickUp using the MCP CLI
 */
export async function createClickUpTask(
  input: ClickUpTaskInput
): Promise<ClickUpTaskResult> {
  try {
    // First, get the list ID from the list name
    const listLookupCmd = `manus-mcp-cli tool call clickup_get_list --server clickup --input '${JSON.stringify(
      { list_name: input.listName }
    )}'`;

    const { stdout: listOutput } = await execAsync(listLookupCmd);
    const listResult = JSON.parse(listOutput);

    if (!listResult.content || listResult.content.length === 0) {
      return {
        success: false,
        error: `List "${input.listName}" not found in ClickUp`,
      };
    }

    const listData = JSON.parse(listResult.content[0].text);
    const listId = listData.id;

    // Now create the task
    const taskInput: Record<string, unknown> = {
      list_id: listId,
      name: input.taskName,
    };

    if (input.description) {
      taskInput.markdown_description = input.description;
    }

    if (input.priority) {
      taskInput.priority = input.priority;
    }

    if (input.assignees && input.assignees.length > 0) {
      taskInput.assignees = input.assignees;
    }

    if (input.tags && input.tags.length > 0) {
      taskInput.tags = input.tags;
    }

    if (input.dueDate) {
      taskInput.due_date = input.dueDate;
    }

    const createTaskCmd = `manus-mcp-cli tool call clickup_create_task --server clickup --input '${JSON.stringify(
      taskInput
    ).replace(/'/g, "'\\''")}'`;

    const { stdout: taskOutput } = await execAsync(createTaskCmd);
    const taskResult = JSON.parse(taskOutput);

    if (!taskResult.content || taskResult.content.length === 0) {
      return {
        success: false,
        error: "Failed to create task in ClickUp",
      };
    }

    const taskData = JSON.parse(taskResult.content[0].text);

    return {
      success: true,
      taskId: taskData.id,
      taskUrl: taskData.url,
    };
  } catch (error) {
    console.error("[ClickUp Integration] Error creating task:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ensure organization has a ClickUp list, create if needed
 */
export async function ensureOrganizationList(
  organizationName: string
): Promise<{ success: boolean; listName: string; error?: string }> {
  try {
    const listName = `${organizationName} Implementation`;
    
    // Check if list already exists
    const checkCmd = `manus-mcp-cli tool call clickup_get_list --server clickup --input '${JSON.stringify(
      { list_name: listName }
    )}'`;

    try {
      const { stdout } = await execAsync(checkCmd);
      const result = JSON.parse(stdout);
      if (result.content && result.content.length > 0) {
        // List exists
        return { success: true, listName };
      }
    } catch (error) {
      // List doesn't exist, create it
    }

    // Create list in Implementations space
    const createCmd = `manus-mcp-cli tool call clickup_create_list --server clickup --input '${JSON.stringify(
      {
        space_name: "Implementations",
        name: listName,
        content: `Implementation tracking for ${organizationName}`,
      }
    ).replace(/'/g, "'\\''")}' `;

    await execAsync(createCmd);
    return { success: true, listName };
  } catch (error) {
    console.error("[ClickUp] Error ensuring organization list:", error);
    return {
      success: false,
      listName: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a task when a hospital completes a section
 */
export async function createSectionCompletionTask(
  organizationName: string,
  sectionName: string,
  completedTasks: number,
  totalTasks: number
): Promise<ClickUpTaskResult> {
  // Ensure organization has a list
  const listResult = await ensureOrganizationList(organizationName);
  if (!listResult.success) {
    return {
      success: false,
      error: `Failed to create/find list: ${listResult.error}`,
    };
  }

  const taskName = `Review ${sectionName} Completion`;
  const description = `
**Section:** ${sectionName}
**Progress:** ${completedTasks}/${totalTasks} tasks completed

The hospital has completed the **${sectionName}** section of their PACS onboarding. Please review their submissions and provide feedback.

**Next Steps:**
1. Review uploaded documents and configurations
2. Verify information is complete and accurate
3. Post update in implementation portal or reach out if clarification needed
  `.trim();

  return createClickUpTask({
    listName: listResult.listName,
    taskName,
    description,
    priority: "high",
    tags: ["review-needed"],
  });
}

/**
 * Create a task when a hospital uploads a file
 */
export async function createFileUploadTask(
  organizationName: string,
  fileName: string,
  taskName: string,
  fileUrl: string
): Promise<ClickUpTaskResult> {
  // Ensure organization has a list
  const listResult = await ensureOrganizationList(organizationName);
  if (!listResult.success) {
    return {
      success: false,
      error: `Failed to create/find list: ${listResult.error}`,
    };
  }

  const clickUpTaskName = `Review ${fileName}`;
  const description = `
**Task:** ${taskName}
**File:** ${fileName}
**URL:** ${fileUrl}

The hospital has uploaded a document for the **${taskName}** task. Please review and provide feedback.
  `.trim();

  return createClickUpTask({
    listName: listResult.listName,
    taskName: clickUpTaskName,
    description,
    priority: "normal",
    tags: ["file-review"],
  });
}
