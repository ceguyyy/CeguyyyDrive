import { useState, useMemo, useEffect } from 'react';

/**
 * Client-side pagination over an in-memory list.
 *
 * The admin tables already fetch their rows in full, so slicing here avoids
 * paginated endpoints for datasets this size. Pass the *filtered* list — the
 * page then reflects what the user is actually looking at.
 */
export function usePagination(items = [], initialRowsPerPage = 10) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

    const count = items.length;
    const lastPage = Math.max(0, Math.ceil(count / rowsPerPage) - 1);

    // Searching, deleting, or a refetch can leave the current page past the end
    // of the list, which renders as a blank table with no obvious way back.
    useEffect(() => {
        if (page > lastPage) setPage(lastPage);
    }, [page, lastPage]);

    const paginated = useMemo(
        () => items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [items, page, rowsPerPage]
    );

    const handlePageChange = (_event, nextPage) => setPage(nextPage);

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return {
        paginated,
        count,
        page: Math.min(page, lastPage),
        rowsPerPage,
        handlePageChange,
        handleRowsPerPageChange
    };
}
