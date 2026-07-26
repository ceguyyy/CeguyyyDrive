/**
 * Pure helpers over the `organization_roles` tree.
 *
 * Authorization for member management is expressed as one rule: an actor may
 * manage members whose role is a strict descendant of the actor's role, may
 * assign roles that are strict descendants of the actor's role, and may reshape
 * only the part of the hierarchy that lies strictly below their own role.
 *
 * No database access lives here on purpose — this is the part worth testing.
 */

const asId = (value) =>
    value === null || value === undefined || value === '' ? null : String(value);

const asQuota = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : String(parsed);
};

/**
 * Ids strictly below `startId`, breadth-first.
 *
 * `saveRoles` does not guarantee an acyclic payload, so a cycle must terminate
 * rather than spin. Seeding `visited` with the start id also keeps a role out of
 * its own descendant set when it sits on a cycle.
 */
function collectDescendantIds(roles, startId) {
    const descendants = new Set();
    if (!Array.isArray(roles) || !startId) return descendants;

    const childrenByParentId = new Map();
    for (const role of roles) {
        const parentId = asId(role.parent_role_id);
        if (!parentId) continue;
        if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
        childrenByParentId.get(parentId).push(role);
    }

    const visited = new Set([String(startId)]);
    const queue = [String(startId)];

    while (queue.length > 0) {
        const currentId = queue.shift();
        for (const child of childrenByParentId.get(currentId) || []) {
            const childId = asId(child.id);
            if (!childId || visited.has(childId)) continue;
            visited.add(childId);
            descendants.add(childId);
            queue.push(childId);
        }
    }

    return descendants;
}

/**
 * Role names strictly below `actorRoleName` in the tree.
 *
 * Returns an empty set when the actor's role names no node: members carry a
 * free-form `role_name` (the column defaults to 'Member', and canvas edits can
 * delete a role out from under them), and such an actor must manage nobody.
 *
 * @param {Array<{id: string, name: string, parent_role_id: ?string}>} roles
 * @param {?string} actorRoleName
 * @returns {Set<string>}
 */
function getDescendantNames(roles, actorRoleName) {
    if (!Array.isArray(roles) || !actorRoleName) return new Set();

    const actor = roles.find(role => role.name === actorRoleName);
    if (!actor) return new Set();

    const descendantIds = collectDescendantIds(roles, asId(actor.id));
    const names = new Set();
    for (const role of roles) {
        if (descendantIds.has(asId(role.id))) names.add(role.name);
    }
    return names;
}

/**
 * Ids strictly below `actorRoleId` — the portion of the tree an actor may edit.
 *
 * @param {Array<{id: string, parent_role_id: ?string}>} roles
 * @param {?string} actorRoleId
 * @returns {Set<string>}
 */
function getDescendantIds(roles, actorRoleId) {
    return collectDescendantIds(roles, asId(actorRoleId));
}

/**
 * Whether `descendantRoleName` sits strictly below `ancestorRoleName`.
 *
 * @param {Array<{id: string, name: string, parent_role_id: ?string}>} roles
 * @param {?string} ancestorRoleName
 * @param {?string} descendantRoleName
 * @returns {boolean}
 */
function isDescendantRole(roles, ancestorRoleName, descendantRoleName) {
    if (!descendantRoleName) return false;
    return getDescendantNames(roles, ancestorRoleName).has(descendantRoleName);
}

/**
 * Whether following parent links from any role loops back on itself.
 *
 * Nodes without an id are new rows nothing can reference yet, so they cannot
 * participate in a cycle.
 *
 * @param {Array<{id: ?string, parent_role_id: ?string}>} roles
 * @returns {boolean}
 */
function hasCycle(roles) {
    if (!Array.isArray(roles)) return false;

    const parentById = new Map();
    for (const role of roles) {
        const id = asId(role.id);
        if (id) parentById.set(id, asId(role.parent_role_id));
    }

    for (const startId of parentById.keys()) {
        const seen = new Set([startId]);
        let currentId = parentById.get(startId);
        while (currentId) {
            if (seen.has(currentId)) return true;
            seen.add(currentId);
            if (!parentById.has(currentId)) break;
            currentId = parentById.get(currentId);
        }
    }

    return false;
}

/**
 * Ways a submitted hierarchy oversteps what the actor's role may reshape.
 *
 * The actor owns exactly the subtree strictly below their own role. Everything
 * at or above them — including their own node — must come back untouched, and
 * anything they add or move must land inside that subtree. An empty array means
 * the save is within scope.
 *
 * Canvas position and colour are deliberately not checked: they carry no
 * authority, and ReactFlow lets any viewer drag a card.
 *
 * @param {Array<Object>} existingRoles rows currently stored for the org
 * @param {Array<Object>} submittedRoles rows the actor wants to save
 * @param {?string} actorRoleId the actor's own role
 * @returns {string[]} human-readable violations, empty when allowed
 */
function findScopeViolations(existingRoles, submittedRoles, actorRoleId) {
    const violations = [];
    if (!actorRoleId) return ['Your role is not part of this hierarchy, so you cannot edit it.'];

    const editableIds = getDescendantIds(existingRoles, actorRoleId);
    const allowedParentIds = new Set([...editableIds, asId(actorRoleId)]);

    const existingIds = new Set(existingRoles.map(role => asId(role.id)));
    const submittedById = new Map();
    for (const role of submittedRoles) {
        const id = asId(role.id);
        if (id) submittedById.set(id, role);
    }

    // Everything at or above the actor must survive the save unchanged.
    for (const existing of existingRoles) {
        const id = asId(existing.id);
        if (editableIds.has(id)) continue;

        const submitted = submittedById.get(id);
        if (!submitted) {
            violations.push(`You cannot remove the role "${existing.name}" — it is not below your own role.`);
            continue;
        }
        if (submitted.name !== existing.name) {
            violations.push(`You cannot rename the role "${existing.name}" — it is not below your own role.`);
        }
        if (asId(submitted.parent_role_id) !== asId(existing.parent_role_id)) {
            violations.push(`You cannot move the role "${existing.name}" — it is not below your own role.`);
        }
        if (asQuota(submitted.storage_limit) !== asQuota(existing.storage_limit)) {
            violations.push(`You cannot change the storage quota of "${existing.name}" — it is not below your own role.`);
        }
    }

    // Anything created or moved must land inside the actor's subtree.
    for (const submitted of submittedRoles) {
        const id = asId(submitted.id);
        const isUntouchable = id && existingIds.has(id) && !editableIds.has(id);
        if (isUntouchable) continue;

        if (!allowedParentIds.has(asId(submitted.parent_role_id))) {
            violations.push(`"${submitted.name}" must sit below your own role.`);
        }
    }

    return violations;
}

module.exports = {
    getDescendantNames,
    getDescendantIds,
    isDescendantRole,
    hasCycle,
    findScopeViolations
};
