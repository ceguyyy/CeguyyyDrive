/**
 * Resolve the correct presigned-download endpoint for a file.
 *
 * Company Drive files belong to an organization and must use the org-aware
 * endpoint, which authorises by role hierarchy. The personal endpoint resolves
 * files by user_id, so an org file uploaded by one member (e.g. a Manager)
 * returns 404 "File not found" for everyone else -- including the Owner.
 *
 * @param {{ id?: string, file_id?: string, organization_id?: string|null }} file
 * @returns {string|null} API path, or null when there is no file
 */
export function getDownloadUrlPath(file) {
    if (!file) return null;

    const fileId = file.id || file.file_id;
    if (!fileId) return null;

    return file.organization_id
        ? `/organizations/${file.organization_id}/drive/download-url/${fileId}`
        : `/storage/download-url/${fileId}`;
}
