const db = require('../config/db');

class FolderRepository {
    async create(name, parentId, userId) {
        const result = await db.query(
            `INSERT INTO folders (name, parent_id, user_id) 
             VALUES ($1, $2, $3) RETURNING *`,
            [name, parentId, userId]
        );
        return result.rows[0];
    }

    async findByIdAndUser(id, userId) {
        const result = await db.query(
            `SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
            [id, userId]
        );
        return result.rows[0];
    }

    async findByNameAndParent(name, parentId, userId) {
        let query = `SELECT * FROM folders WHERE name = $1 AND user_id = $2 AND is_deleted = false `;
        const params = [name, userId];
        
        if (parentId) {
            query += `AND parent_id = $3`;
            params.push(parentId);
        } else {
            query += `AND parent_id IS NULL`;
        }

        const result = await db.query(query, params);
        return result.rows[0];
    }

    async findByParentAndUser(parentId, userId) {
        let query = `SELECT * FROM folders WHERE user_id = $1 AND is_deleted = false `;
        const params = [userId];

        if (parentId) {
            query += `AND parent_id = $2`;
            params.push(parentId);
        } else {
            query += `AND parent_id IS NULL`;
        }
        
        query += ` ORDER BY name ASC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async update(id, name, parentId, userId) {
        const result = await db.query(
            `UPDATE folders 
             SET name = COALESCE($1, name), 
                 parent_id = COALESCE($2, parent_id)
             WHERE id = $3 AND user_id = $4 AND is_deleted = false
             RETURNING *`,
            [name, parentId, id, userId]
        );
        return result.rows[0];
    }

    async softDelete(id, userId) {
        const result = await db.query(
            `UPDATE folders 
             SET is_deleted = true 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    async findTrashedByUser(userId) {
        const result = await db.query(
            `SELECT * FROM folders WHERE user_id = $1 AND is_deleted = true`,
            [userId]
        );
        return result.rows;
    }

    async restore(id, userId) {
        const result = await db.query(
            `UPDATE folders 
             SET is_deleted = false 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    async hardDelete(id, userId) {
        await db.query(
            `DELETE FROM folders WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
    }
}

module.exports = new FolderRepository();
