import { pickWorkingMonth } from './working-month';

type M = { id: string; status: 'open' | 'reopened' | 'draft' | 'closed' };
const m = (id: string, status: M['status']): M => ({ id, status });

describe('pickWorkingMonth', () => {
  it('MON-16: returns undefined when there are no months', () => {
    expect(pickWorkingMonth<M>([])).toBeUndefined();
  });

  it('MON-16: prefers open over reopened and draft', () => {
    const months = [m('draft', 'draft'), m('reopened', 'reopened'), m('open', 'open'), m('closed', 'closed')];
    expect(pickWorkingMonth(months)?.id).toBe('open');
  });

  it('MON-16: prefers reopened over draft when no month is open', () => {
    const months = [m('draft', 'draft'), m('closed', 'closed'), m('reopened', 'reopened')];
    expect(pickWorkingMonth(months)?.id).toBe('reopened');
  });

  it('MON-16: picks the draft when it is the only mutable month', () => {
    expect(pickWorkingMonth([m('closed-late', 'closed'), m('draft', 'draft')])?.id).toBe('draft');
  });

  it('MON-16: falls back to the first (latest) month when all are closed', () => {
    expect(pickWorkingMonth([m('latest', 'closed'), m('older', 'closed')])?.id).toBe('latest');
  });

  it('MON-16: a single month is returned whatever its status', () => {
    expect(pickWorkingMonth([m('only', 'closed')])?.id).toBe('only');
    expect(pickWorkingMonth([m('only', 'open')])?.id).toBe('only');
  });

  it('MON-16: with several months of the same preferred status the first one wins', () => {
    expect(pickWorkingMonth([m('a', 'open'), m('b', 'open')])?.id).toBe('a');
  });

  it('MON-16: does not mutate the input and returns the same object reference', () => {
    const months = [m('draft', 'draft'), m('open', 'open')];
    const copy = [...months];
    expect(pickWorkingMonth(months)).toBe(months[1]);
    expect(months).toEqual(copy);
  });
});
