export const EVENT_INDEX_MAPPING = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        custom_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      title: { type: 'text', analyzer: 'custom_analyzer' },
      description: { type: 'text', analyzer: 'custom_analyzer' },
      genre: { type: 'keyword' },
      eventType: { type: 'keyword' },
      location: {
        type: 'geo_point',
      },
      city: { type: 'keyword' },
      country: { type: 'keyword' },
      startDate: { type: 'date' },
      endDate: { type: 'date' },
      price: { type: 'float' },
      capacity: { type: 'integer' },
      bookedCount: { type: 'integer' },
      vendorId: { type: 'keyword' },
      status: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

export const EVENT_INDEX_NAME = 'events';