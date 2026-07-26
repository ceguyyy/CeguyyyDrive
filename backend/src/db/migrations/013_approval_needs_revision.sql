-- Migration 013: "Needs revision" outcome for approval workflows
--
-- An approver can send a request back to the requester with a comment instead
-- of only approving or rejecting. What happens on resubmission is chosen per
-- template:
--   'restart' -- every approver reviews the revised file again from step 1
--   'resume'  -- earlier approvals stand; review restarts at the step that
--                sent it back
--
-- The policy is copied onto each request at submission time so that editing a
-- template later never changes the rules of a request already in flight.

ALTER TABLE approval_templates
    ADD COLUMN IF NOT EXISTS revision_policy VARCHAR(20) DEFAULT 'restart';

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS revision_policy VARCHAR(20) DEFAULT 'restart';

-- Step that requested changes; the resume policy restarts from here.
ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS revision_step_number INT;

-- How many times this request has been sent back, for the audit trail.
ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0;

ALTER TABLE approval_templates
    DROP CONSTRAINT IF EXISTS approval_templates_revision_policy_check;
ALTER TABLE approval_templates
    ADD CONSTRAINT approval_templates_revision_policy_check
    CHECK (revision_policy IN ('restart', 'resume'));

ALTER TABLE approval_requests
    DROP CONSTRAINT IF EXISTS approval_requests_revision_policy_check;
ALTER TABLE approval_requests
    ADD CONSTRAINT approval_requests_revision_policy_check
    CHECK (revision_policy IN ('restart', 'resume'));

UPDATE approval_templates SET revision_policy = 'restart' WHERE revision_policy IS NULL;
UPDATE approval_requests SET revision_policy = 'restart' WHERE revision_policy IS NULL;
UPDATE approval_requests SET revision_count = 0 WHERE revision_count IS NULL;
