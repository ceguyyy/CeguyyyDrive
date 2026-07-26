/**
 * The integration API, described once.
 *
 * The documentation on the Integration page and the downloadable Postman
 * collection are both generated from this list, so they cannot drift apart the
 * way hand-written docs and a hand-written collection would.
 *
 * Mirrors backend/src/routes/integration.routes.js.
 */
export const SCOPES = [
    { value: 'files:read', label: 'Read files', hint: 'List folders and get download URLs.' },
    { value: 'files:write', label: 'Write files', hint: 'Upload files and create folders.' },
    { value: 'org:read', label: 'Read organization', hint: 'Organization details, members, and roles.' },
    { value: 'members:write', label: 'Invite members', hint: 'Send invitations. Grants the ability to add people to the organization.' },
    { value: 'approvals:read', label: 'Read approvals', hint: 'Templates, pending and submitted requests.' },
    { value: 'approvals:write', label: 'Write approvals', hint: 'Submit, approve, reject, request revision, and resubmit.' }
];

// Every response sample is the real envelope the API returns: a `status` plus a
// `data` object. Values are illustrative, shapes are not.
export const ENDPOINT_GROUPS = [
    {
        name: 'Diagnostics',
        endpoints: [
            {
                method: 'GET', path: '/whoami', scope: null,
                description: 'Confirms a key works and reports which organization and scopes it carries.',
                response: {
                    status: 'success',
                    data: {
                        organizationId: '9f3c1b7a-4d2e-4f11-9c8a-2b6d5e1f0a34',
                        scopes: ['files:read', 'files:write']
                    }
                }
            }
        ]
    },
    {
        name: 'Company Drive',
        endpoints: [
            {
                method: 'GET', path: '/folders', scope: 'files:read',
                description: 'Lists the drive root.',
                response: {
                    status: 'success',
                    data: {
                        folders: [
                            { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Manager', owner_role_id: 'r-mgr', parent_id: null }
                        ],
                        files: []
                    }
                }
            },
            {
                method: 'GET', path: '/folders/:folderId', scope: 'files:read',
                description: "Lists one folder's subfolders and files.",
                response: {
                    status: 'success',
                    data: {
                        folders: [],
                        files: [
                            {
                                id: 'f1e2d3c4-0000-4000-8000-000000000009',
                                name: 'report.pdf',
                                size: 102400,
                                mime_type: 'application/pdf',
                                created_at: '2026-07-26T04:12:33.000Z'
                            }
                        ]
                    }
                }
            },
            {
                method: 'GET', path: '/files/:fileId/download-url', scope: 'files:read',
                description: 'Returns a short-lived presigned URL for the file.',
                response: {
                    status: 'success',
                    data: { downloadUrl: 'https://bucket.cos.ap-jakarta.myqcloud.com/…?sign=…' }
                }
            },
            {
                method: 'POST', path: '/folders', scope: 'files:write',
                description: 'Creates a folder. Omit parentFolderId to create it at the root.',
                body: { name: 'Invoices', parentFolderId: null },
                response: {
                    status: 'success',
                    data: {
                        folder: {
                            id: 'b7c8d9e0-0000-4000-8000-00000000000f',
                            name: 'Invoices',
                            parent_id: null,
                            organization_id: '9f3c1b7a-4d2e-4f11-9c8a-2b6d5e1f0a34'
                        }
                    }
                }
            },
            {
                method: 'POST', path: '/files/upload-url', scope: 'files:write',
                description: 'Step 1 of 2. Returns a presigned URL; then PUT the bytes straight to that URL.',
                body: { fileName: 'report.pdf', size: 102400, mimeType: 'application/pdf', folderId: 'FOLDER_ID' },
                response: {
                    status: 'success',
                    data: {
                        uploadUrl: 'https://bucket.cos.ap-jakarta.myqcloud.com/…?sign=…',
                        fileId: 'f1e2d3c4-0000-4000-8000-000000000009',
                        key: 'org/9f3c1b7a/report.pdf'
                    }
                },
                followUp: `curl -X PUT "<uploadUrl>" \\\n  -H "Content-Type: application/pdf" \\\n  --data-binary @report.pdf`
            }
        ]
    },
    {
        name: 'Organization',
        endpoints: [
            {
                method: 'GET', path: '/organization', scope: 'org:read',
                description: 'Organization details. Billing internals are not included.',
                response: {
                    status: 'success',
                    data: {
                        organization: {
                            id: '9f3c1b7a-4d2e-4f11-9c8a-2b6d5e1f0a34',
                            name: 'Ceguyyy',
                            plan_name: 'Pro',
                            storage_limit_bytes: '107374182400',
                            max_members: 25,
                            feature_approval_enabled: true,
                            feature_chat_enabled: true,
                            feature_integration_enabled: true,
                            status: 'active'
                        }
                    }
                }
            },
            {
                method: 'GET', path: '/organization/members', scope: 'org:read',
                description: 'Every member with their role and invitation status.',
                response: {
                    status: 'success',
                    data: {
                        members: [
                            {
                                id: 'm1',
                                email: 'anja@example.com',
                                full_name: 'Anja',
                                role_name: 'Manager',
                                status: 'accepted'
                            }
                        ]
                    }
                }
            },
            {
                method: 'GET', path: '/organization/roles', scope: 'org:read',
                description: 'The role hierarchy, including each role parent.',
                response: {
                    status: 'success',
                    data: {
                        roles: [
                            { id: 'r-owner', name: 'Owner', parent_role_id: null },
                            { id: 'r-mgr', name: 'Manager', parent_role_id: 'r-owner' },
                            { id: 'r-staff', name: 'Staff', parent_role_id: 'r-mgr' }
                        ]
                    }
                }
            },
            {
                method: 'POST', path: '/organization/members', scope: 'members:write',
                description: 'Invites someone. The same hierarchy rule as the UI applies: only roles below the key owner, and never Owner.',
                body: { email: 'teammate@example.com', roleName: 'Staff' },
                response: {
                    status: 'success',
                    data: {
                        member: {
                            id: 'm2',
                            email: 'teammate@example.com',
                            role_name: 'Staff',
                            status: 'pending'
                        }
                    }
                }
            }
        ]
    },
    {
        name: 'Approvals',
        endpoints: [
            {
                method: 'GET', path: '/approval-templates', scope: 'approvals:read',
                description: 'Reusable approval flows defined for this organization.',
                response: {
                    status: 'success',
                    data: {
                        templates: [
                            {
                                id: 't1',
                                name: 'Invoice Approval',
                                revision_policy: 'restart',
                                steps: [{ step_number: 1, role_name: 'Manager' }]
                            }
                        ]
                    }
                }
            },
            {
                method: 'GET', path: '/approvals/pending', scope: 'approvals:read',
                description: 'Requests waiting on the key owner to decide.',
                response: {
                    status: 'success',
                    data: {
                        requests: [
                            {
                                id: 'req-1',
                                title: 'Q3 Invoice',
                                status: 'pending',
                                current_step_index: 0,
                                requester_id: 'u-1'
                            }
                        ]
                    }
                }
            },
            {
                method: 'GET', path: '/approvals/submitted', scope: 'approvals:read',
                description: 'Requests the key owner has submitted.',
                response: {
                    status: 'success',
                    data: { requests: [{ id: 'req-2', title: 'Contract', status: 'approved' }] }
                }
            },
            {
                method: 'GET', path: '/approvals/:requestId', scope: 'approvals:read',
                description: 'Full detail of one request, including every step and its status.',
                response: {
                    status: 'success',
                    data: {
                        request: {
                            id: 'req-1',
                            title: 'Q3 Invoice',
                            status: 'pending',
                            organization_id: '9f3c1b7a-4d2e-4f11-9c8a-2b6d5e1f0a34',
                            steps: [
                                { step_number: 1, role_name: 'Manager', status: 'pending', comment: null },
                                { step_number: 2, role_name: 'Owner', status: 'pending', comment: null }
                            ]
                        }
                    }
                }
            },
            {
                method: 'POST', path: '/approvals', scope: 'approvals:write',
                description: 'Submits a file for approval. `steps` lists the role names, in order.',
                body: {
                    fileId: 'FILE_ID',
                    title: 'Q3 Invoice',
                    steps: [{ step_number: 1, role_name: 'Manager' }],
                    revisionPolicy: 'restart'
                },
                response: {
                    status: 'success',
                    data: { request: { id: 'req-3', title: 'Q3 Invoice', status: 'pending', current_step_index: 0 } }
                }
            },
            {
                method: 'POST', path: '/approvals/:requestId/decision', scope: 'approvals:write',
                description: 'Approve, reject, or send back for revision. `decision` is approved, rejected, or needs_revision.',
                body: { decision: 'approved', comment: 'Looks good.' },
                response: {
                    status: 'success',
                    data: { request: { id: 'req-1', status: 'approved', current_step_index: 1 } }
                }
            },
            {
                method: 'POST', path: '/approvals/:requestId/resubmit', scope: 'approvals:write',
                description: 'Resubmits after a revision request. Pass newFileId to replace the document.',
                body: { newFileId: null },
                response: {
                    status: 'success',
                    data: { request: { id: 'req-1', status: 'pending', current_step_index: 0 } }
                }
            }
        ]
    }
];

export const ALL_ENDPOINTS = ENDPOINT_GROUPS.flatMap(g => g.endpoints);

export function curlFor(endpoint, baseUrl) {
    const url = `${baseUrl}${endpoint.path}`;
    if (endpoint.method === 'GET') {
        return `curl ${url} \\\n  -H "X-API-Key: $CGD_API_KEY"`;
    }
    return `curl -X ${endpoint.method} ${url} \\\n  -H "X-API-Key: $CGD_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(endpoint.body ?? {})}'`;
}

/**
 * Postman Collection v2.1.
 *
 * The key is a collection variable rather than a baked-in header value, so the
 * downloaded file carries no credential and is safe to commit or share.
 */
export function buildPostmanCollection(baseUrl, orgName) {
    return {
        info: {
            name: `AbuGreySoft Box Integration — ${orgName}`,
            description:
                'Set the `apiKey` collection variable to your key. It is sent as X-API-Key on every request. '
                + 'The organization is determined by the key, so no organization id is ever passed.',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        variable: [
            { key: 'baseUrl', value: baseUrl, type: 'string' },
            { key: 'apiKey', value: '', type: 'string' }
        ],
        auth: {
            type: 'apikey',
            apikey: [
                { key: 'key', value: 'X-API-Key', type: 'string' },
                { key: 'value', value: '{{apiKey}}', type: 'string' },
                { key: 'in', value: 'header', type: 'string' }
            ]
        },
        item: ENDPOINT_GROUPS.map(group => ({
            name: group.name,
            item: group.endpoints.map(endpoint => {
                const segments = endpoint.path.split('/').filter(Boolean);
                return {
                    name: `${endpoint.method} ${endpoint.path}`,
                    request: {
                        method: endpoint.method,
                        header: endpoint.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
                        ...(endpoint.body
                            ? { body: { mode: 'raw', raw: JSON.stringify(endpoint.body, null, 2) } }
                            : {}),
                        url: {
                            raw: `{{baseUrl}}${endpoint.path}`,
                            host: ['{{baseUrl}}'],
                            path: segments
                        },
                        description: endpoint.scope
                            ? `${endpoint.description}\n\nRequires scope: ${endpoint.scope}`
                            : endpoint.description
                    },
                    // Saved as a Postman example, so the expected shape is visible
                    // in the app without sending a request.
                    response: endpoint.response
                        ? [{
                            name: 'Success',
                            originalRequest: {
                                method: endpoint.method,
                                url: { raw: `{{baseUrl}}${endpoint.path}`, host: ['{{baseUrl}}'], path: segments }
                            },
                            status: 'OK',
                            code: endpoint.method === 'POST' ? 201 : 200,
                            _postman_previewlanguage: 'json',
                            header: [{ key: 'Content-Type', value: 'application/json' }],
                            body: JSON.stringify(endpoint.response, null, 2)
                        }]
                        : []
                };
            })
        }))
    };
}
