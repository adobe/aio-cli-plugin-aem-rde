const snapshots = [
  {
    name: 'snap1',
    description: 'desc1',
    usage: 1,
    size: { total_size: 1048576 },
    state: 'AVAILABLE',
    created: '2024-06-01T12:00:00Z',
    lastUsed: '2024-06-02T12:00:00Z',
  },
  {
    name: 'snap2',
    description: 'desc2',
    usage: 2,
    size: { total_size: 1073741824 },
    state: 'DELETED',
    created: '2024-06-03T12:00:00Z',
    lastUsed: '2024-06-04T12:00:00Z',
  },
];

const snapshotsResponse = {
  status: 200,
  json: async () => snapshots,
};

module.exports = {
  snapshotsResponse,
  snapshots,
};
