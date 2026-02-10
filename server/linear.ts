import { execSync } from "child_process";

/**
 * Linear integration for two-way communication
 * Uses MCP CLI to interact with Linear API
 */

/**
 * Post a comment to a Linear issue
 * @param issueId Linear issue ID (e.g., "NL-123")
 * @param comment Comment text to post
 * @param authorName Name of the comment author (hospital contact)
 * @returns Success status and comment ID
 */
export async function postLinearComment(
  issueId: string,
  comment: string,
  authorName: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    // Format comment with hospital attribution
    const formattedComment = `**${authorName} (Hospital):**\n\n${comment}`;

    // Call Linear MCP to create comment
    const result = execSync(
      `manus-mcp-cli tool call create_comment --server linear --input '${JSON.stringify({
        issueId,
        body: formattedComment,
      }).replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );

    console.log("[Linear] Comment posted successfully:", result.substring(0, 100));

    // Parse response to get comment ID
    try {
      const parsed = JSON.parse(result);
      return {
        success: true,
        commentId: parsed.id || parsed.commentId,
      };
    } catch {
      // If parsing fails, still return success
      return { success: true };
    }
  } catch (error) {
    console.error("[Linear] Error posting comment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get comments from a Linear issue
 * @param issueId Linear issue ID
 * @returns Array of comments
 */
export async function getLinearComments(
  issueId: string
): Promise<{ success: boolean; comments?: any[]; error?: string }> {
  try {
    const result = execSync(
      `manus-mcp-cli tool call get_issue --server linear --input '${JSON.stringify({
        issueId,
      }).replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(result);
    
    return {
      success: true,
      comments: parsed.comments || [],
    };
  } catch (error) {
    console.error("[Linear] Error fetching comments:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a new Linear issue for an organization
 * @param title Issue title (e.g., "Memorial General Hospital - Implementation")
 * @param description Issue description
 * @param teamId Linear team ID
 * @returns Issue ID
 */
export async function createLinearIssue(
  title: string,
  description: string,
  teamId?: string
): Promise<{ success: boolean; issueId?: string; error?: string }> {
  try {
    const input: any = {
      title,
      description,
    };

    if (teamId) {
      input.teamId = teamId;
    }

    const result = execSync(
      `manus-mcp-cli tool call create_issue --server linear --input '${JSON.stringify(input).replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(result);

    return {
      success: true,
      issueId: parsed.id || parsed.issueId,
    };
  } catch (error) {
    console.error("[Linear] Error creating issue:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
