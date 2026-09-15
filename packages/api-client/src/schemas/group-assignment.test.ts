import { describe, expect, it } from 'vitest';

import { groupAssignmentSchema } from './group-assignment';
import { updateGroupMemberRolePayloadSchema } from './group-member-write';

/**
 * Shapes taken from `GET /api/group-assignment/group/:groupId` against the
 * local production mirror, trimmed to the fields this client models. Identities
 * here are synthetic: never paste a real user's name, email or id into a
 * fixture. Extra keys the route really sends (the full `contentId` document,
 * `author`, `contentRefModel`, `userActivityId`) are dropped by the non-strict
 * object, not rejected.
 */
const populatedRow = {
  id: '698e38f3973b3e9b2cf550d5',
  assignmentType: 'module',
  contentRefModel: 'V2Lesson',
  contentId: { id: '681a4d84acc6f28eaec5e2a7', title: 'Wrist', slug: 'wrist' },
  courseId: {
    id: '681a4b62779a0d9e6c9cc556',
    title: 'GUSI MSK Essentials',
    slug: 'gusi-msk-essentials',
  },
  lessonId: { id: '681a4d84acc6f28eaec5e2a7', title: 'Wrist', slug: 'wrist' },
  topicId: null,
  user: {
    id: '6879135600000000000000a1',
    userName: 'r.mensah',
    email: 'r.mensah@nw.edu',
    firstName: 'Rita',
    lastName: 'Mensah',
  },
  status: 'active',
  dueDate: null,
  completedAt: null,
  assignedAt: '2026-02-12T20:32:51.314Z',
  createdAt: '2026-02-12T20:32:51.315Z',
};

describe('groupAssignmentSchema', () => {
  it('parses a fully populated row', () => {
    expect(groupAssignmentSchema.parse(populatedRow).contentId?.title).toBe('Wrist');
  });

  // The regression: `user` was non-nullable, and a populate whose target is
  // missing yields null. 14 of 18 rows on that mirror group come back this
  // way, so one unresolvable reference took the whole tab down.
  it('parses a row whose user reference did not resolve', () => {
    const parsed = groupAssignmentSchema.parse({ ...populatedRow, user: null });

    expect(parsed.user).toBeNull();
  });

  it('parses a row with no user key at all', () => {
    const { user: _user, ...withoutUser } = populatedRow;

    expect(groupAssignmentSchema.safeParse(withoutUser).success).toBe(true);
  });

  // The regression: the list was filtered to course-level rows, which is 376
  // of 8,734 on the mirror. All four types have to parse now that it is not.
  it.each(['course', 'module', 'topic', 'quiz'] as const)('parses a %s assignment', (type) => {
    const parsed = groupAssignmentSchema.parse({ ...populatedRow, assignmentType: type });

    expect(parsed.assignmentType).toBe(type);
  });

  it.each(['draft', 'active', 'in_progress', 'completed', 'cancelled'] as const)(
    'parses status %s',
    (status) => {
      expect(groupAssignmentSchema.parse({ ...populatedRow, status }).status).toBe(status);
    },
  );

  it('parses a bare course assignment, where courseId is null', () => {
    const parsed = groupAssignmentSchema.parse({
      ...populatedRow,
      assignmentType: 'course',
      contentId: { id: 'c1', title: 'GUSI POCUS Essentials' },
      courseId: null,
      lessonId: null,
    });

    expect(parsed.courseId).toBeNull();
    expect(parsed.contentId?.title).toBe('GUSI POCUS Essentials');
  });

  it('rejects a status the API does not define, rather than widening', () => {
    expect(groupAssignmentSchema.safeParse({ ...populatedRow, status: 'archived' }).success).toBe(
      false,
    );
  });
});

describe('updateGroupMemberRolePayloadSchema', () => {
  it('accepts an echoed expiry date', () => {
    const parsed = updateGroupMemberRolePayloadSchema.parse({
      role: 'leader',
      expiresAt: '2026-12-31T00:00:00.000Z',
    });

    expect(parsed.expiresAt).toBe('2026-12-31T00:00:00.000Z');
  });

  it('accepts an explicit null for a membership with no expiry', () => {
    expect(
      updateGroupMemberRolePayloadSchema.parse({ role: 'learner', expiresAt: null }).expiresAt,
    ).toBeNull();
  });
});
