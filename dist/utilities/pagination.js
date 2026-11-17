"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaginationParams = parsePaginationParams;
function parsePaginationParams(req, defaultSortBy = 'created_at') {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const rawLimit = parseInt(req.query.limit, 10) || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
    const sortBy = typeof req.query.sortBy === 'string' && req.query.sortBy.trim() ? req.query.sortBy.trim() : defaultSortBy;
    const rawOrder = (req.query.sortOrder || req.query.order || '').toLowerCase();
    const sortOrder = rawOrder === 'asc' ? 'asc' : 'desc';
    // Extract other filter params, excluding pagination keywords
    const reservedKeys = new Set(['page', 'limit', 'search', 'sortBy', 'sortOrder', 'order']);
    const filters = {};
    for (const [key, value] of Object.entries(req.query)) {
        if (!reservedKeys.has(key) && value !== undefined && value !== '') {
            filters[key] = value;
        }
    }
    return {
        page,
        limit,
        offset,
        search,
        sortBy,
        sortOrder,
        filters,
    };
}
//# sourceMappingURL=pagination.js.map