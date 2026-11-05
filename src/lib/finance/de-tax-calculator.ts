/**
 * An annual German income-tax ASSESSMENT estimate (Einkommensteuer, not the
 * monthly Lohnsteuer withholding) for calendar year 2026.
 *
 * Scope is one adult: single (Grundtabelle), resident in Germany all year, only
 * employment income, statutory health insurance (GKV), no church tax, not in
 * Saxony, no other deductions. Anything outside that is not modelled and the
 * page that shows this should say so.
 *
 * Money convention follows the neighbouring calculators: social contributions
 * stay unrounded (an annual estimate); the statute rounds taxable income and
 * income tax DOWN to whole euros and the solidarity surcharge down to the cent.
 *
 * Pure, like everything here: no clock, no Supabase, no model output anywhere
 * near the arithmetic.
 */

export const DE_TAX_YEAR_LABEL = '2026';

/**
 * Tariff zone boundaries, §32a Abs. 1 EStG (zvE in whole euros):
 * https://www.gesetze-im-internet.de/estg/__32a.html
 */
export const DE_BASIC_ALLOWANCE = 12_348;
export const DE_ZONE_2_END = 17_799;
export const DE_ZONE_3_END = 69_878;
export const DE_ZONE_4_END = 277_825;

/**
 * Solidaritätszuschlag, SolZG §§3, 4 (single): Freigrenze on income tax, 5.5%
 * rate, and the 11.9% phase-in cap above the Freigrenze.
 * https://www.gesetze-im-internet.de/solzg_1995/
 */
export const DE_SOLI_FREIGRENZE = 20_350;
export const DE_SOLI_RATE = 0.055;
export const DE_SOLI_PHASE_IN_RATE = 0.119;

/**
 * Arbeitnehmer-Pauschbetrag (§9a EStG) and Sonderausgaben-Pauschbetrag (§10c).
 * https://www.gesetze-im-internet.de/estg/__9a.html
 */
export const DE_EMPLOYEE_ALLOWANCE = 1_230;
export const DE_SPECIAL_EXPENSES_ALLOWANCE = 36;

/**
 * 2026 social insurance, annual contribution ceilings (Beitragsbemessungsgrenzen),
 * https://www.bundesregierung.de (Rechengrößen 2026).
 */
export const DE_PENSION_CEILING = 101_400;
export const DE_HEALTH_CEILING = 69_750;

/**
 * Total rates (employer + employee); the employee pays half of each, DRV and
 * BMG https://www.bundesgesundheitsministerium.de/beitraege
 */
export const DE_PENSION_RATE = 0.186;
export const DE_UNEMPLOYMENT_RATE = 0.026;
export const DE_HEALTH_GENERAL_RATE = 0.146;
/** Average GKV additional rate for 2026 (total, split half/half). */
export const DE_AVERAGE_HEALTH_ADDITIONAL_RATE = 0.029;
export const DE_CARE_RATE = 0.036;
/** Paid only by the employee when childless and aged 23 or over. */
export const DE_CARE_CHILDLESS_SURCHARGE = 0.006;

/** §10 Abs. 4 EStG: cap on health, care and other provisions for employees. */
export const DE_OTHER_PROVISIONS_CAP = 1_900;
/** §10 Abs. 1 Nr. 3a S. 4: 4% off health contributions for Krankengeld. */
export const DE_HEALTH_DEDUCTIBLE_SHARE = 0.96;

/**
 * Übergangsbereich (Midijob) upper bound, §20 Abs. 2 SGB IV: 2,000 EUR/month.
 * At or below it the reduced employee contributions are NOT modelled.
 */
export const DE_MIDIJOB_UPPER_MONTHLY = 2_000;

export interface DeTaxInput {
  /** Annual gross employment pay in EUR, including any guaranteed 13th/14th salary. */
  income: number;
  /** Childless and aged 23 or over: adds the 0.6-point employee-only care surcharge. */
  childless: boolean;
  /** Total GKV additional contribution rate as a fraction (split half/half). Defaults to DE_AVERAGE_HEALTH_ADDITIONAL_RATE. */
  healthAdditionalRate?: number;
}

export interface DeTaxBreakdown {
  income: number;
  pensionInsurance: number; // employee share
  unemploymentInsurance: number; // employee share
  healthInsurance: number; // employee share incl. half the additional rate
  careInsurance: number; // employee share incl. any childless surcharge
  socialContributions: number; // sum of the four
  deductibleProvisions: number; // Vorsorgeaufwendungen deducted from income
  taxableIncome: number; // zvE, whole euros
  incomeTax: number; // whole euros
  solidaritySurcharge: number; // cents
  takeHome: number; // income - socialContributions - incomeTax - solidaritySurcharge
  /** False when income/12 is at or below 2,000 (Midijob/Minijob band, not modelled). */
  supported: boolean;
}

/** Floats like 5499.999999999999 must not lose a cent to the floor. */
const floorTo = (value: number, scale: number): number => Math.floor(value * scale + 1e-7) / scale;

/** Income tax (Grundtabelle) on a taxable income; fractions are dropped first. */
export const deIncomeTax = (taxableIncome: number): number => {
  if (!Number.isFinite(taxableIncome)) return 0;
  const zve = Math.floor(taxableIncome);
  if (zve <= DE_BASIC_ALLOWANCE) return 0;
  let tax: number;
  if (zve <= DE_ZONE_2_END) {
    const y = (zve - DE_BASIC_ALLOWANCE) / 10_000;
    tax = (914.51 * y + 1_400) * y;
  } else if (zve <= DE_ZONE_3_END) {
    const z = (zve - DE_ZONE_2_END) / 10_000;
    tax = (173.1 * z + 2_397) * z + 1_034.87;
  } else if (zve <= DE_ZONE_4_END) {
    tax = 0.42 * zve - 11_135.63;
  } else {
    tax = 0.45 * zve - 19_470.38;
  }
  return Math.floor(tax + 1e-7);
};

/** Solidarity surcharge on a given income tax, rounded down to the cent. */
export const deSolidaritySurcharge = (incomeTax: number): number => {
  if (!Number.isFinite(incomeTax) || incomeTax <= DE_SOLI_FREIGRENZE) return 0;
  const full = DE_SOLI_RATE * incomeTax;
  const capped = DE_SOLI_PHASE_IN_RATE * (incomeTax - DE_SOLI_FREIGRENZE);
  return floorTo(Math.min(full, capped), 100);
};

/**
 * Annual estimate for one single employee. A negative or non-finite income is
 * treated as 0: callers validate first.
 */
export const calculateDeTax = (input: DeTaxInput): DeTaxBreakdown => {
  const income = Number.isFinite(input.income) && input.income > 0 ? input.income : 0;
  const rate = input.healthAdditionalRate ?? DE_AVERAGE_HEALTH_ADDITIONAL_RATE;
  const additional = Number.isFinite(rate) && rate > 0 ? rate : 0;

  const pensionBase = Math.min(income, DE_PENSION_CEILING);
  const healthBase = Math.min(income, DE_HEALTH_CEILING);

  const pensionInsurance = pensionBase * (DE_PENSION_RATE / 2);
  const unemploymentInsurance = pensionBase * (DE_UNEMPLOYMENT_RATE / 2);
  const healthInsurance = healthBase * ((DE_HEALTH_GENERAL_RATE + additional) / 2);
  const careInsurance =
    healthBase * (DE_CARE_RATE / 2 + (input.childless ? DE_CARE_CHILDLESS_SURCHARGE : 0));
  const socialContributions =
    pensionInsurance + unemploymentInsurance + healthInsurance + careInsurance;

  // §10 EStG. Retirement: the employee pension share only (the employer share is
  // tax-free and added back by §10 Abs. 3 S. 5). Basic health/care is always
  // deductible in full; unemployment tops it up to the 1,900 cap.
  const basic = healthInsurance * DE_HEALTH_DEDUCTIBLE_SHARE + careInsurance;
  const healthCareOther = Math.max(
    basic,
    Math.min(basic + unemploymentInsurance, DE_OTHER_PROVISIONS_CAP),
  );
  const deductibleProvisions = pensionInsurance + healthCareOther;

  const taxableIncome = Math.floor(
    Math.max(
      0,
      income -
        Math.min(DE_EMPLOYEE_ALLOWANCE, income) -
        DE_SPECIAL_EXPENSES_ALLOWANCE -
        deductibleProvisions,
    ),
  );
  const incomeTax = deIncomeTax(taxableIncome);
  const solidaritySurcharge = deSolidaritySurcharge(incomeTax);
  const takeHome = income - socialContributions - incomeTax - solidaritySurcharge;

  return {
    income,
    pensionInsurance,
    unemploymentInsurance,
    healthInsurance,
    careInsurance,
    socialContributions,
    deductibleProvisions,
    taxableIncome,
    incomeTax,
    solidaritySurcharge,
    takeHome,
    supported: income / 12 > DE_MIDIJOB_UPPER_MONTHLY,
  };
};
