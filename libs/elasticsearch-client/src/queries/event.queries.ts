export function buildEventSearchQuery(filters: any) {
  const must: any[] = [];
  const filter: any[] = [];

  // Text search
  if (filters.query) {
    must.push({
      multi_match: {
        query: filters.query,
        fields: ['title^3', 'description^2', 'genre', 'city'],
        fuzziness: 'AUTO',
      },
    });
  }

  // Location filter
  if (filters.location) {
    filter.push({
      geo_distance: {
        distance: `${filters.location.radius}km`,
        location: {
          lat: filters.location.latitude,
          lon: filters.location.longitude,
        },
      },
    });
  }

  // Date range filter
  if (filters.dateRange) {
    filter.push({
      range: {
        startDate: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
      },
    });
  }

  // Genre filter
  if (filters.genres && filters.genres.length > 0) {
    filter.push({
      terms: {
        genre: filters.genres,
      },
    });
  }

  // Price range filter
  if (filters.priceRange) {
    filter.push({
      range: {
        price: {
          gte: filters.priceRange.min,
          lte: filters.priceRange.max,
        },
      },
    });
  }

  // Event type filter
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    filter.push({
      terms: {
        eventType: filters.eventTypes,
      },
    });
  }

  // Status filter (default to published)
  filter.push({
    term: {
      status: 'published',
    },
  });

  return {
    query: {
      bool: {
        must: must.length > 0 ? must : undefined,
        filter: filter.length > 0 ? filter : undefined,
      },
    },
    sort: [
      { _score: { order: 'desc' } },
      { startDate: { order: 'asc' } },
    ],
    from: (filters.page - 1) * filters.limit,
    size: filters.limit,
  };
}