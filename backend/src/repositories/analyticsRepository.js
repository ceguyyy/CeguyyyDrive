const db = require('../config/db');

class AnalyticsRepository {
    async getTotalStorageUsed(userId) {
        // We sum sizes from active files + soft deleted files 
        // AND sizes from all file_versions for this user.
        // Trashed items still count against storage until permanently emptied.
        
        const result = await db.query(
            `WITH file_totals AS (
                SELECT COALESCE(SUM(size), 0) as total FROM files WHERE user_id = $1
            ),
            version_totals AS (
                SELECT COALESCE(SUM(v.size), 0) as total 
                FROM file_versions v
                JOIN files f ON v.file_id = f.id
                WHERE f.user_id = $1
            )
            SELECT (SELECT total FROM file_totals) + (SELECT total FROM version_totals) as total_bytes`,
            [userId]
        );
        return result.rows[0].total_bytes;
    }

    async getStorageBreakdownByType(userId) {
        // Group by high-level category using PostgreSQL CASE
        // This only groups active/trashed files for simplicity, 
        // older versions will fall into the same category as their parent file.
        const result = await db.query(
            `WITH all_files AS (
                -- Current files
                SELECT mime_type, size FROM files WHERE user_id = $1
                UNION ALL
                -- Versions
                SELECT f.mime_type, v.size 
                FROM file_versions v
                JOIN files f ON v.file_id = f.id
                WHERE f.user_id = $1
            )
            SELECT 
                CASE 
                    WHEN mime_type ILIKE 'image/%' THEN 'Images'
                    WHEN mime_type ILIKE 'video/%' THEN 'Videos'
                    WHEN mime_type ILIKE 'audio/%' THEN 'Audio'
                    WHEN mime_type ILIKE 'application/pdf' 
                      OR mime_type ILIKE 'application/msword' 
                      OR mime_type ILIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                      OR mime_type ILIKE 'text/%' THEN 'Documents'
                    ELSE 'Others'
                END as category,
                SUM(size) as total_bytes
            FROM all_files
            GROUP BY category
            ORDER BY total_bytes DESC`,
            [userId]
        );
        return result.rows;
    }
}

module.exports = new AnalyticsRepository();
