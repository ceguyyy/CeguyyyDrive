const test = require('node:test');
const assert = require('node:assert/strict');

const { getDescendantNames, isDescendantRole } = require('./roleHierarchyService');

// Default tree provisioned by organizationRepository.createOrganization.
const defaultRoles = [
    { id: 'r-owner', name: 'Owner', parent_role_id: null },
    { id: 'r-manager', name: 'Manager', parent_role_id: 'r-owner' },
    { id: 'r-staff', name: 'Staff', parent_role_id: 'r-manager' }
];

// Two sibling branches under one root.
const branchedRoles = [
    { id: 'r-owner', name: 'Owner', parent_role_id: null },
    { id: 'r-mgr-a', name: 'ManagerA', parent_role_id: 'r-owner' },
    { id: 'r-mgr-b', name: 'ManagerB', parent_role_id: 'r-owner' },
    { id: 'r-staff-a', name: 'StaffA', parent_role_id: 'r-mgr-a' },
    { id: 'r-staff-b', name: 'StaffB', parent_role_id: 'r-mgr-b' }
];

const sorted = (set) => [...set].sort();

test('descendants reach every level below the actor', () => {
    assert.deepEqual(sorted(getDescendantNames(defaultRoles, 'Owner')), ['Manager', 'Staff']);
});

test('descendants stop at the actor, excluding the actor itself', () => {
    assert.deepEqual(sorted(getDescendantNames(defaultRoles, 'Manager')), ['Staff']);
});

test('a leaf role has no descendants', () => {
    assert.deepEqual(sorted(getDescendantNames(defaultRoles, 'Staff')), []);
});

test('a role is not its own descendant', () => {
    assert.equal(isDescendantRole(defaultRoles, 'Manager', 'Manager'), false);
});

test('staff cannot reach manager', () => {
    assert.equal(isDescendantRole(defaultRoles, 'Staff', 'Manager'), false);
});

test('manager cannot reach owner', () => {
    assert.equal(isDescendantRole(defaultRoles, 'Manager', 'Owner'), false);
});

test('sibling branches do not see each other', () => {
    assert.equal(isDescendantRole(branchedRoles, 'ManagerA', 'StaffB'), false);
    assert.equal(isDescendantRole(branchedRoles, 'ManagerA', 'ManagerB'), false);
    assert.equal(isDescendantRole(branchedRoles, 'ManagerA', 'StaffA'), true);
});

test('the root still reaches both branches', () => {
    assert.deepEqual(
        sorted(getDescendantNames(branchedRoles, 'Owner')),
        ['ManagerA', 'ManagerB', 'StaffA', 'StaffB']
    );
});

test('an unknown actor role manages nobody', () => {
    // organization_members.role_name defaults to 'Member', which names no node.
    assert.deepEqual(sorted(getDescendantNames(defaultRoles, 'Member')), []);
    assert.deepEqual(sorted(getDescendantNames(defaultRoles, null)), []);
});

test('an orphan role is nobody\'s descendant', () => {
    assert.equal(isDescendantRole(defaultRoles, 'Owner', 'Member'), false);
});

test('a cyclic parent chain terminates', () => {
    // saveRoles does not validate acyclicity, so a crafted payload can produce
    // this. A naive walk would hang the request thread.
    const cyclicRoles = [
        { id: 'a', name: 'A', parent_role_id: 'c' },
        { id: 'b', name: 'B', parent_role_id: 'a' },
        { id: 'c', name: 'C', parent_role_id: 'b' }
    ];
    assert.deepEqual(sorted(getDescendantNames(cyclicRoles, 'A')), ['B', 'C']);
    assert.equal(isDescendantRole(cyclicRoles, 'A', 'A'), false);
});

test('an empty or missing role list yields no descendants', () => {
    assert.deepEqual(sorted(getDescendantNames([], 'Owner')), []);
    assert.deepEqual(sorted(getDescendantNames(null, 'Owner')), []);
});
