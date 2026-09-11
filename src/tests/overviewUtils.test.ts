import { computeCrewOverview } from '../utils/overviewUtils';

describe('computeCrewOverview', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-12T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('counts people, not duplicate files', () => {
    const overview = computeCrewOverview([
      {
        id: '1',
        name: 'HRW.pdf',
        status: 'processed',
        extraction: { holderName: 'Amara Nguyen', expiryDate: '2026-11-20' },
      },
      {
        id: '2',
        name: 'HRW copy.pdf',
        status: 'processed',
        contentHash: 'same',
        extraction: { holderName: 'Amara Nguyen', expiryDate: '2026-11-20' },
      },
      {
        id: '3',
        name: 'White Card.pdf',
        status: 'processed',
        extraction: { holderName: 'Jordan Mercer', expiryDate: '2027-03-14' },
      },
      {
        id: '4',
        name: 'SWMS.pdf',
        status: 'processed',
        extraction: { holderName: 'Priya Raman', expiryDate: '2026-02-10' },
      },
    ]);

    expect(overview.totals.people).toBe(3);
    expect(overview.totals.expired).toBe(1);
    expect(overview.totals.siteReady).toBe(2);
  });
});
