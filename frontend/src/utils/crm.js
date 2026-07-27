/**
 * Where the CRM lives.
 *
 * CRM is a separate application on its own subdomain, not a route in this app,
 * so the sidebar entry is an external link rather than a <NavLink>.
 *
 * VITE_CRM_URL wins when set. Otherwise the host is derived by replacing the
 * first label with "crm" — app.example.com becomes crm.example.com — which is
 * right for every deployed environment and wrong for localhost, where there is
 * no subdomain to swap. Local development therefore needs the variable set, and
 * the entry point stays hidden until it is.
 */
const CONFIGURED = String(import.meta.env.VITE_CRM_URL || '').trim();

function deriveFromHost() {
    if (typeof window === 'undefined') return '';

    const { protocol, hostname } = window.location;

    // No subdomain to replace, and "crm.localhost" resolves nowhere by default.
    const isLocal = hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname.endsWith('.localhost');
    if (isLocal) return '';

    const labels = hostname.split('.');
    // A bare apex (example.com) gains a subdomain; anything deeper has its
    // first label swapped, so app.example.com does not become crm.app.example.com.
    const host = labels.length <= 2
        ? ['crm', ...labels].join('.')
        : ['crm', ...labels.slice(1)].join('.');

    return `${protocol}//${host}`;
}

export const crmUrl = CONFIGURED || deriveFromHost();

// Without a URL there is nothing to link to, so the entry point is not shown at
// all rather than rendered as a dead link.
export const isCrmUrlKnown = () => crmUrl.length > 0;
