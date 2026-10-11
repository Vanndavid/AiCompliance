import { classifyHolder } from '../utils/holderKind';

describe('classifyHolder', () => {
  it('treats worker licences as belonging to a person', () => {
    expect(classifyHolder({ docType: 'White Card', holderName: 'Jordan Mercer' })).toBe('person');
    expect(
      classifyHolder({ docType: 'High Risk Work Licence', holderName: 'Amara Nguyen' }),
    ).toBe('person');
  });

  it('treats insurance and site documents as belonging to an organisation', () => {
    expect(
      classifyHolder({
        docType: 'Certificate of Currency',
        holderName: 'Northside Civil Contracting Pty Ltd',
      }),
    ).toBe('organisation');
    expect(classifyHolder({ docType: 'SWMS', holderName: 'Priya Raman' })).toBe('organisation');
  });

  it('treats a company name as an organisation even without a known doc type', () => {
    expect(classifyHolder({ docType: 'Document', holderName: 'Checkmate company' })).toBe(
      'organisation',
    );
  });

  it('falls back to person when nothing is known', () => {
    expect(classifyHolder({})).toBe('person');
  });
});
