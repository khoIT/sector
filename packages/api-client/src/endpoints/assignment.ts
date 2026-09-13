import type { ApiClient } from '../client';
import {
  assignmentListResponseSchema,
  type AssignmentListResponse,
  type GroupAssignmentStatus,
  type GroupAssignmentType,
} from '../schemas/assignment';

export type AssignmentListQuery = {
  groupId: string;
  keyword?: string;
  assignmentType?: GroupAssignmentType;
  status?: GroupAssignmentStatus;
  skip?: number;
  limit?: number;
};

function assignmentListParams(query: AssignmentListQuery) {
  return {
    groupId: query.groupId,
    skip: String(query.skip ?? 0),
    limit: String(query.limit ?? 20),
    ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
    ...(query.assignmentType ? { assignmentType: query.assignmentType } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

/**
 * GET /api/group-assignment — assignments for one group, requires
 * `read:group-assignment` (every seeded group-leader/administrator role holds
 * it; a bare subscriber does not).
 */
export async function getGroupAssignments(
  client: ApiClient,
  query: AssignmentListQuery,
  signal?: AbortSignal,
): Promise<AssignmentListResponse> {
  return client.get('/api/group-assignment', {
    query: assignmentListParams(query),
    schema: assignmentListResponseSchema,
    signal,
  });
}
