-- Create approval_templates table
CREATE TABLE IF NOT EXISTS approval_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create approval_template_steps table
CREATE TABLE IF NOT EXISTS approval_template_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES approval_templates(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_approval_templates_org ON approval_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_template_steps_template ON approval_template_steps(template_id);
