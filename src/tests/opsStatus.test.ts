import { documentOpsStatus, personOpsStatus } from '../utils/opsStatus';

describe('opsStatus', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-12T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('collapses review-pending documents to needs_human', () => {
    expect(
      documentOpsStatus({
        status: 'processed',
        extraction: { expiryDate: '2027-01-01' },
        evaluation: { reviewStatus: 'pending', finalDecision: 'clear' },
      }),
    ).toBe('needs_human');
  });

  it('treats expired documents as expired even if the model said clear', () => {
    expect(
      documentOpsStatus({
        status: 'processed',
        extraction: { expiryDate: '2026-01-01' },
        evaluation: { reviewStatus: 'not_required', finalDecision: 'clear' },
      }),
    ).toBe('expired');
  });

  it('treats documents expiring in the next 7 days as expiring', () => {
    expect(
      documentOpsStatus({
        status: 'processed',
        extraction: { expiryDate: '2026-09-15' },
        evaluation: { reviewStatus: 'not_required', finalDecision: 'clear' },
      }),
    ).toBe('expiring');
  });

  it('stops asking for a human once a reviewer has decided', () => {
    expect(
      documentOpsStatus({
        status: 'processed',
        extraction: { expiryDate: '2027-01-01' },
        evaluation: { reviewStatus: 'approved', finalDecision: 'flagged' },
      }),
    ).toBe('not_compliant');

    expect(
      documentOpsStatus({
        status: 'processed',
        extraction: { expiryDate: '2027-01-01' },
        evaluation: { reviewStatus: 'rejected', finalDecision: 'flagged', overrideDecision: 'clear' },
      }),
    ).toBe('valid');
  });

  it('reports an expired document as expired while it still waits for review', () => {
    expect(
      documentOpsStatus({
        status: 'processed',
        extraction: { expiryDate: '2026-01-01' },
        evaluation: { reviewStatus: 'pending', finalDecision: 'flagged' },
      }),
    ).toBe('expired');
  });

  it('uses the worst document for a person', () => {
    expect(
      personOpsStatus([
        {
          status: 'processed',
          extraction: { expiryDate: '2027-01-01' },
          evaluation: { reviewStatus: 'not_required', finalDecision: 'clear' },
        },
        {
          status: 'processed',
          extraction: { expiryDate: '2026-01-01' },
          evaluation: { reviewStatus: 'not_required', finalDecision: 'clear' },
        },
      ]),
    ).toBe('expired');
  });
});
