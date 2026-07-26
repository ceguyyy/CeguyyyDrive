-- Role names must be unique within an organization.
--
-- A member's place in the hierarchy is resolved by matching
-- organization_members.role_name against organization_roles.name. Two nodes
-- sharing a name in one organization makes "whose subtree?" unanswerable, and
-- the permission checks built on that tree would be decided by row order.

-- Rename collisions before enforcing the constraint. Within each
-- (organization_id, name) group the earliest row keeps the name; later rows
-- become "name (2)", "name (3)", ...
--
-- Members are deliberately NOT repointed: they keep their existing role_name,
-- which is the name the surviving first row retains, so this migration never
-- moves anyone between branches.
--
-- The loop handles a rename that itself collides with a pre-existing name. It
-- is bounded so a pathological dataset fails at the ADD CONSTRAINT below rather
-- than spinning.
DO $$
DECLARE
    attempts INT := 0;
BEGIN
    LOOP
        attempts := attempts + 1;

        WITH ranked AS (
            SELECT id,
                   name,
                   ROW_NUMBER() OVER (
                       PARTITION BY organization_id, name
                       ORDER BY created_at, id
                   ) AS position
            FROM organization_roles
        )
        UPDATE organization_roles r
        SET name = left(ranked.name, 90) || ' (' || ranked.position || ')'
        FROM ranked
        WHERE r.id = ranked.id
          AND ranked.position > 1;

        EXIT WHEN NOT FOUND OR attempts >= 10;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_role_name'
    ) THEN
        ALTER TABLE organization_roles
            ADD CONSTRAINT unique_org_role_name UNIQUE (organization_id, name);
    END IF;
END $$;
