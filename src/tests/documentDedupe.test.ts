import { collapseDuplicateDocuments } from '../utils/documentDedupe';

describe('collapseDuplicateDocuments', () => {
  it('keeps one row per content hash', () => {
    const docs = [
      { id: 'new', name: 'SWMS.pdf', status: 'processed', contentHash: 'abc' },
      { id: 'old', name: 'SWMS.pdf', status: 'processed', contentHash: 'abc' },
    ];

    expect(collapseDuplicateDocuments(docs).map(doc => doc.id)).toEqual(['new']);
  });

  it('collapses the same file identity when hashes are missing', () => {
    const docs = [
      {
        id: 'a',
        name: 'SWMS Tower Crane Lift Operations.pdf',
        status: 'processed',
        extraction: { holderName: 'Priya Raman', licenseNumber: 'SWMS-TC-014', expiryDate: '2026-02-10' },
      },
      {
        id: 'b',
        name: 'SWMS Tower Crane Lift Operations.pdf',
        status: 'pending',
        extraction: { holderName: 'Priya Raman', licenseNumber: 'SWMS-TC-014', expiryDate: '2026-02-10' },
      },
    ];

    expect(collapseDuplicateDocuments(docs).map(doc => doc.id)).toEqual(['a']);
  });

  it('keeps a renewed ticket with a new expiry', () => {
    const docs = [
      {
        id: 'renewed',
        name: 'HRW.pdf',
        status: 'processed',
        extraction: { holderName: 'Amara Nguyen', licenseNumber: 'HRW-1', expiryDate: '2027-11-20' },
      },
      {
        id: 'old',
        name: 'HRW.pdf',
        status: 'processed',
        extraction: { holderName: 'Amara Nguyen', licenseNumber: 'HRW-1', expiryDate: '2026-11-20' },
      },
    ];

    expect(collapseDuplicateDocuments(docs)).toHaveLength(2);
  });
});
