/**
 * Organizations (shared workspaces / teams). Every user has a personal org,
 * created on signup or backfilled. Resources (envelopes, templates, API keys,
 * webhook endpoints) are owned by an organization; access is membership-based,
 * so teammates in the same org share visibility.
 */
import { type Database, organizationMembers, organizations, users } from '@penpact/db';
import { and, eq, inArray } from 'drizzle-orm';
import { HttpProblem } from '../lib/problem.js';

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgSummary {
  id: string;
  name: string;
  role: string;
}

/** The org's billing plan string (defaults to 'free' if the org is missing). */
export async function orgPlan(db: Database, orgId: string): Promise<string> {
  const rows = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows[0]?.plan ?? 'free';
}

/** The organizations the user belongs to (ids only) — the access scope. */
export async function accessibleOrgIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  return rows.map((r) => r.id);
}

/** The user's personal organization (created by them), creating one if missing. */
export async function personalOrgId(db: Database, userId: string): Promise<string> {
  const own = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.createdBy, userId))
    .limit(1);
  if (own[0]) return own[0].id;
  // Fall back to any membership, else create a personal org.
  const any = await db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  if (any[0]) return any[0].id;
  return (await createOrganization(db, userId, 'Personal workspace')).id;
}

/** Create an org owned by the user (also adds them as the owner member). */
export async function createOrganization(
  db: Database,
  userId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return db.transaction(async (tx) => {
    const org = (await tx.insert(organizations).values({ name, createdBy: userId }).returning())[0];
    if (!org) throw new Error('Failed to create organization');
    await tx
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId, role: 'owner' })
      .onConflictDoNothing();
    return { id: org.id, name: org.name };
  });
}

/** Ensure the user has a personal org + owner membership; returns its id. */
export async function ensurePersonalOrg(
  db: Database,
  userId: string,
  name?: string,
): Promise<string> {
  return personalOrgId(db, userId).catch(() =>
    createOrganization(db, userId, name ?? 'Personal workspace').then((o) => o.id),
  );
}

/** Throw unless the user is a member of the org (optionally with a min role). */
export async function requireMembership(
  db: Database,
  userId: string,
  orgId: string,
  roles?: OrgRole[],
): Promise<string> {
  const rows = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)),
    )
    .limit(1);
  const role = rows[0]?.role;
  if (!role) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Organization not found.' });
  }
  if (roles && !roles.includes(role as OrgRole)) {
    throw new HttpProblem({
      status: 403,
      title: 'Forbidden',
      detail: 'You do not have permission to manage this organization.',
    });
  }
  return role;
}

export async function listUserOrgs(db: Database, userId: string): Promise<OrgSummary[]> {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId));
  return rows;
}

export interface MemberSummary {
  userId: string;
  email: string;
  role: string;
}

export async function listMembers(
  db: Database,
  userId: string,
  orgId: string,
): Promise<MemberSummary[]> {
  await requireMembership(db, userId, orgId);
  const rows = await db
    .select({ userId: users.id, email: users.email, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));
  return rows;
}

/** Invite an existing Penpact user to the org by email (owner/admin only). */
export async function addMember(
  db: Database,
  actingUserId: string,
  orgId: string,
  email: string,
  role: OrgRole = 'member',
): Promise<MemberSummary> {
  await requireMembership(db, actingUserId, orgId, ['owner', 'admin']);
  const normalized = email.trim().toLowerCase();
  const target = (
    await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1)
  )[0];
  if (!target) {
    throw new HttpProblem({
      status: 404,
      title: 'Not Found',
      detail: 'No Penpact user with that email. They must sign up first.',
    });
  }
  await db
    .insert(organizationMembers)
    .values({ organizationId: orgId, userId: target.id, role })
    .onConflictDoNothing();
  return { userId: target.id, email: target.email, role };
}

/** Remove a member (owner/admin only); the org creator cannot be removed. */
export async function removeMember(
  db: Database,
  actingUserId: string,
  orgId: string,
  targetUserId: string,
): Promise<void> {
  await requireMembership(db, actingUserId, orgId, ['owner', 'admin']);
  const org = (
    await db
      .select({ createdBy: organizations.createdBy })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
  )[0];
  if (org?.createdBy === targetUserId) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'The organization owner cannot be removed.',
    });
  }
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, targetUserId),
      ),
    );
}

/** Restrict a list of org ids to those the user can access (defense in depth). */
export async function filterAccessible(
  db: Database,
  userId: string,
  orgIds: string[],
): Promise<string[]> {
  if (orgIds.length === 0) return [];
  const rows = await db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        inArray(organizationMembers.organizationId, orgIds),
      ),
    );
  return rows.map((r) => r.id);
}
