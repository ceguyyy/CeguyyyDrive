-- Migration 014: Approval Audit Logs and Digital Signatures
--
-- Tracks chronological audit trail events, digital signatures, and version history for approval workflows.

CREATE TABLE IF NOT EXISTS approval_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'submitted', 'approved', 'rejected', 'needs_revision', 'resubmitted'
    step_number INT,
    role_name VARCHAR(100),
    comment TEXT,
    signature_base64 TEXT,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    file_name VARCHAR(255),
    version_number INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_request ON approval_audit_logs(request_id);

-- Backfill initial 'submitted' log for existing requests
INSERT INTO approval_audit_logs (request_id, user_id, action, role_name, comment, file_id, file_name, version_number, created_at)
SELECT ar.id, ar.requester_id, 'submitted', 'Requester', 'Initial document submission', ar.file_id, f.original_name, 1, ar.created_at
FROM approval_requests ar
LEFT JOIN files f ON ar.file_id = f.id
WHERE NOT EXISTS (SELECT 1 FROM approval_audit_logs aal WHERE aal.request_id = ar.id AND aal.action = 'submitted');

-- Backfill completed steps from approval_steps
INSERT INTO approval_audit_logs (request_id, user_id, action, step_number, role_name, comment, version_number, created_at)
SELECT s.request_id, s.approver_id, s.status, s.step_number, s.role_name, s.comment, 1, COALESCE(s.action_timestamp, s.created_at)
FROM approval_steps s
WHERE s.status IN ('approved', 'rejected', 'needs_revision')
AND NOT EXISTS (SELECT 1 FROM approval_audit_logs aal WHERE aal.request_id = s.request_id AND aal.step_number = s.step_number AND aal.action = s.status);
