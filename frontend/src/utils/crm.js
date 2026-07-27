/**
 * Where the CRM lives.
 *
 * It is part of this application, not a separate deployment, so this is an
 * in-app path rather than a derived subdomain. It still opens in a new tab: the
 * CRM is a place people sit in for a long stretch, and losing the drive tab to
 * get there is the wrong trade.
 *
 * Kept as a module rather than a literal so the sidebar, and anything else that
 * links here later, cannot disagree about the path.
 */
export const CRM_PATH = '/crm';
