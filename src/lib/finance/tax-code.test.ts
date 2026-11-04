import { describe, expect, it } from 'vitest';
import { allowanceFromTaxCode } from './tax-code';

describe('allowanceFromTaxCode', () => {
  it('reads the standard code', () => {
    expect(allowanceFromTaxCode('1257L')).toEqual({ allowance: 12570, nonCumulative: false });
  });

  it('reads an emergency code in every way payslips print it', () => {
    // The owner's payslip prints 1063LX.
    for (const code of ['1063LX', '1063L X', '1063L M1', '1063LW1', '1063L W1/M1', ' 1063lx ']) {
      expect(allowanceFromTaxCode(code)).toEqual({ allowance: 10630, nonCumulative: true });
    }
  });

  it('accepts the Scottish and Welsh prefixes and the other allowance suffixes', () => {
    expect(allowanceFromTaxCode('S1257L')?.allowance).toBe(12570);
    expect(allowanceFromTaxCode('C1257L')?.allowance).toBe(12570);
    expect(allowanceFromTaxCode('1383M')?.allowance).toBe(13830);
    expect(allowanceFromTaxCode('1131N')?.allowance).toBe(11310);
    expect(allowanceFromTaxCode('1257T')?.allowance).toBe(12570);
  });

  it('reads 0T as no allowance, not as a code it cannot read', () => {
    expect(allowanceFromTaxCode('0T')).toEqual({ allowance: 0, nonCumulative: false });
    expect(allowanceFromTaxCode('0T M1')).toEqual({ allowance: 0, nonCumulative: true });
  });

  it('gives no allowance for codes that need more than a number', () => {
    for (const code of ['K475', 'K475X', 'BR', 'D0', 'D1', 'NT', 'SBR', '', '1257', 'L', '1257LX1', '1257L M2']) {
      expect(allowanceFromTaxCode(code)).toBeUndefined();
    }
  });
});
