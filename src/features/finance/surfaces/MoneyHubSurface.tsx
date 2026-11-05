import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  MONEY_HUB_COSTS, MONEY_HUB_ELIGIBILITY_LABELS, MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE, MONEY_HUB_MAX_EQUIVALENT_SALARY,
  MONEY_HUB_PROVISION_KINDS, MONEY_HUB_RELOCATION_ITEMS, calculateMoneyHubCity,
  calculateMoneyHubHousingSensitivity, calculateMoneyHubRelocation, compareMoneyHubCity,
  emptyMoneyHubBudget, emptyMoneyHubRelocation, evaluateMoneyHubBudget,
  mapPersonalBudgetToMoneyHub, moneyHubProvisionsFor, solveMoneyHubEquivalentSalary,
  type MoneyHubCityResult, type MoneyHubCostId, type MoneyHubEquivalentSalary,
  type MoneyHubRelocationItemId,
} from '@/lib/finance/money-hub';
import {
  MONEY_HUB_CITIES, MONEY_HUB_COUNTRIES, MONEY_HUB_CURRENCIES, MONEY_HUB_JURISDICTIONS,
  moneyHubJurisdiction, type MoneyHubCityId, type MoneyHubCurrency, type MoneyHubJurisdiction,
} from '@/lib/finance/money-hub-catalogue';
import { convertMoneyHubAmount, moneyHubFxSnapshot } from '@/lib/finance/money-hub-fx';
import { MONEY_HUB_PAYROLL_SCOPES, type MoneyHubPayrollOptions } from '@/lib/finance/money-hub-payroll';
import { DE_AVERAGE_HEALTH_ADDITIONAL_RATE } from '@/lib/finance/de-tax-calculator';
import { UK_AUTO_ENROLMENT, type UkPensionBasis, type UkPensionMethod, type UkUndergradPlan } from '@/lib/finance/uk-tax-calculator';
import { PillSwitch } from '../components/PillSwitch';
import { useFinanceData } from '../FinanceDataContext';
import { useFinanceTotals } from '../useFinanceTotals';

type CostProvenance = 'copied' | 'zero-from-import' | 'manual';
type SalaryMode = 'converted' | 'local-number' | 'offers';

const SALARY_MODES: readonly { key: SalaryMode; label: string }[] = [
  { key: 'converted', label: 'Same salary, converted' },
  { key: 'local-number', label: 'Same number, local currency' },
  { key: 'offers', label: 'Actual offers' },
];

const PENSION_METHODS: readonly { id: UkPensionMethod; label: string }[] = [
  { id: 'salary-sacrifice', label: 'Salary sacrifice' },
  { id: 'net-pay', label: 'Net pay' },
  { id: 'relief-at-source', label: 'Relief at source' },
];

const PENSION_BASES: readonly { id: UkPensionBasis; label: string }[] = [
  { id: 'salary', label: 'Full salary' },
  {
    id: 'qualifying',
    label: `Qualifying earnings (£${UK_AUTO_ENROLMENT.lowerQualifyingEarnings.toLocaleString('en-GB')}–£${UK_AUTO_ENROLMENT.upperQualifyingEarnings.toLocaleString('en-GB')})`,
  },
];

const UNDERGRAD_PLANS: readonly { id: UkUndergradPlan; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'plan1', label: 'Plan 1' },
  { id: 'plan2', label: 'Plan 2' },
  { id: 'plan4', label: 'Plan 4' },
  { id: 'plan5', label: 'Plan 5' },
];

const DEFAULT_BASELINE: MoneyHubCityId = 'london';
const DEFAULT_DESTINATION: MoneyHubCityId = 'berlin';
const DEFAULT_SALARY = '50000';

const formatters = new Map<MoneyHubCurrency, Intl.NumberFormat>();
const formatterFor = (currency: MoneyHubCurrency): Intl.NumberFormat => {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter;
};

const parseAmount = (raw: string): number | null => raw.trim() === '' ? null : Number(raw);
const formatPercent = (share: number | null): string => share === null ? '—' : `${(share * 100).toFixed(1)}%`;
const formatDeltaLabel = (delta: number): string => {
  const pct = Math.round(delta * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
};
const formatMonths = (months: number | null, hidden: boolean): string =>
  hidden ? '••••' : months === null || !Number.isFinite(months) ? '—' : `${months.toFixed(1)} months`;
const formatFieldAmount = (amount: number): string => String(Math.round(amount * 100) / 100);
const formatPercentInput = (share: number): string => share > 0 ? String(Number((share * 100).toPrecision(12))) : '0';
const cityById = (id: MoneyHubCityId) => MONEY_HUB_CITIES.find(city => city.id === id)!;
const costLabel = (id: MoneyHubCostId, jurisdiction: MoneyHubJurisdiction): string =>
  id === 'localCharges' ? jurisdiction.localChargesLabel : MONEY_HUB_COSTS.find(cost => cost.id === id)!.label;
const isUk = (jurisdiction: MoneyHubJurisdiction) => jurisdiction.countryCode === 'GB';

interface ShownCity {
  id: MoneyHubCityId;
  name: string;
  jurisdiction: MoneyHubJurisdiction;
  currency: MoneyHubCurrency;
  budget: ReturnType<typeof emptyMoneyHubBudget>;
  gross: number | null;
  grossKey: string;
  validGross: boolean;
  /** Take-home comes from the calculator rather than the user. */
  calculated: boolean;
  /** The calculator declined this income; the user's net figure stands in. */
  unsupported: string | null;
  rawNet: string;
  result: MoneyHubCityResult;
}

function CityPicker({ id, label, value, exclude, onChange }: {
  id: string;
  label: string;
  value: MoneyHubCityId;
  exclude?: MoneyHubCityId;
  onChange: (value: MoneyHubCityId) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONEY_HUB_COUNTRIES.map(country => (
            <SelectGroup key={country.countryCode}>
              <SelectLabel>{country.countryName}</SelectLabel>
              {country.cities.filter(city => city.id !== exclude).map(city => (
                <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CurrencyPicker({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: MoneyHubCurrency;
  onChange: (value: MoneyHubCurrency) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONEY_HUB_CURRENCIES.map(currency => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function MoneyHubSurface({ figuresHidden = false }: { figuresHidden?: boolean }) {
  const { budgetCategories } = useFinanceData();
  const { results: financeTotals, isItemActive } = useFinanceTotals();

  const [mode, setMode] = useState<SalaryMode>('converted');
  const [salary, setSalary] = useState(DEFAULT_SALARY);
  const [salaryCurrency, setSalaryCurrency] = useState<MoneyHubCurrency>('GBP');
  const [offers, setOffers] = useState<Partial<Record<MoneyHubCityId, string>>>({});
  const [baseline, setBaseline] = useState<MoneyHubCityId>(DEFAULT_BASELINE);
  const [destination, setDestination] = useState<MoneyHubCityId>(DEFAULT_DESTINATION);
  const [displayCurrency, setDisplayCurrency] = useState<MoneyHubCurrency>('GBP');
  const [fxAnchor, setFxAnchor] = useState<MoneyHubCurrency>('GBP');
  /** Raw rate inputs keyed `${anchor}/${currency}`, so changing the anchor and back keeps them. */
  const [rates, setRates] = useState<Record<string, string>>({});
  const [rateDate, setRateDate] = useState('');
  const [manualNet, setManualNet] = useState<Partial<Record<MoneyHubCityId, { gross: string; raw: string }>>>({});
  const [ownNet, setOwnNet] = useState<Partial<Record<MoneyHubCityId, boolean>>>({});
  const [costs, setCosts] = useState<Partial<Record<MoneyHubCityId, Partial<Record<MoneyHubCostId, string>>>>>({});
  const [provenance, setProvenance] = useState<Partial<Record<MoneyHubCityId, Partial<Record<MoneyHubCostId, CostProvenance>>>>>({});
  const [relocation, setRelocation] = useState<Partial<Record<MoneyHubCityId, Partial<Record<MoneyHubRelocationItemId, string>>>>>({});
  const [pensionPercent, setPensionPercent] = useState('0');
  const [pensionMethod, setPensionMethod] = useState<UkPensionMethod>('salary-sacrifice');
  const [pensionBasis, setPensionBasis] = useState<UkPensionBasis>('salary');
  const [undergradPlan, setUndergradPlan] = useState<UkUndergradPlan>('none');
  const [postgradLoan, setPostgradLoan] = useState(false);
  const [personalAllowance, setPersonalAllowance] = useState('');
  const [deAged23, setDeAged23] = useState(true);
  const [deHealthPercent, setDeHealthPercent] = useState('');
  const [copiedNote, setCopiedNote] = useState<string | null>(null);
  const [hasCopiedPersonalData, setHasCopiedPersonalData] = useState(false);

  const resetToDefaults = () => {
    setMode('converted');
    setBaseline(DEFAULT_BASELINE);
    setDestination(DEFAULT_DESTINATION);
    setSalary(DEFAULT_SALARY);
    setSalaryCurrency('GBP');
    setOffers({});
    setDisplayCurrency('GBP');
    setFxAnchor('GBP');
    setRates({});
    setRateDate('');
    setManualNet({});
    setOwnNet({});
    setCosts({});
    setProvenance({});
    setRelocation({});
    setPensionPercent('0');
    setPensionMethod('salary-sacrifice');
    setPensionBasis('salary');
    setUndergradPlan('none');
    setPostgradLoan(false);
    setPersonalAllowance('');
    setDeAged23(true);
    setDeHealthPercent('');
    setCopiedNote(null);
    setHasCopiedPersonalData(false);
  };

  useEffect(() => {
    if (figuresHidden && hasCopiedPersonalData) {
      resetToDefaults();
    }
  }, [figuresHidden, hasCopiedPersonalData]);

  const payrollOptions: MoneyHubPayrollOptions = {
    uk: {
      pensionPercent: pensionPercent.trim() === '' ? 0 : Number(pensionPercent),
      pensionMethod,
      pensionBasis,
      undergradPlan,
      postgradLoan,
      personalAllowance: personalAllowance.trim() === '' ? null : Number(personalAllowance),
    },
    de: {
      aged23OrOver: deAged23,
      healthAdditionalPercent: deHealthPercent.trim() === '' ? null : Number(deHealthPercent),
    },
  };

  const baselineCity = cityById(baseline);
  const destinationCity = cityById(destination);
  const baselineJurisdiction = moneyHubJurisdiction(baselineCity.jurisdiction);
  const destinationJurisdiction = moneyHubJurisdiction(destinationCity.jurisdiction);

  // Every currency this comparison touches; each one other than the anchor needs a rate.
  const involved = [...new Set<MoneyHubCurrency>([
    baselineJurisdiction.currency,
    destinationJurisdiction.currency,
    displayCurrency,
    ...(mode === 'converted' ? [salaryCurrency] : []),
  ])];
  const needsFx = involved.length > 1;
  const rateCurrencies = involved.filter(currency => currency !== fxAnchor);
  const rateKey = (currency: MoneyHubCurrency) => `${fxAnchor}/${currency}`;
  const fx = moneyHubFxSnapshot(
    rateDate,
    fxAnchor,
    Object.fromEntries(rateCurrencies.map(currency => [currency, parseAmount(rates[rateKey(currency)] ?? '')])),
  );
  const missingRates = rateCurrencies.filter(currency => fx?.perAnchor[currency] === undefined);
  const fxReady = !needsFx || (fx !== null && missingRates.length === 0);
  const fxTouched = rateDate !== '' || rateCurrencies.some(currency => (rates[rateKey(currency)] ?? '') !== '');

  const shown: ShownCity[] = [baselineCity, destinationCity].map(city => {
    const jurisdiction = moneyHubJurisdiction(city.jurisdiction);
    const currency = jurisdiction.currency;
    const budget = emptyMoneyHubBudget();
    for (const cost of MONEY_HUB_COSTS) budget[cost.id] = parseAmount(costs[city.id]?.[cost.id] ?? '');
    const gross = mode === 'offers'
      ? parseAmount(offers[city.id] ?? '')
      : mode === 'local-number'
      ? parseAmount(salary)
      : convertMoneyHubAmount(parseAmount(salary), salaryCurrency, currency, fx);
    const grossKey = String(gross);
    const validGross = gross !== null && Number.isFinite(gross) && gross >= 0;
    const rawNet = manualNet[city.id]?.gross === grossKey ? manualNet[city.id]!.raw : '';
    const wantsCalculation = jurisdiction.payroll === 'calculated' && !ownNet[city.id];
    const calculatedResult = wantsCalculation ? calculateMoneyHubCity(jurisdiction.id, gross, budget, payrollOptions) : null;
    const unsupported = calculatedResult?.unsupported ?? null;
    const calculated = calculatedResult !== null && unsupported === null;
    return {
      id: city.id,
      name: city.name,
      jurisdiction,
      currency,
      budget,
      gross,
      grossKey,
      validGross,
      calculated,
      unsupported,
      rawNet,
      result: calculated ? calculatedResult : evaluateMoneyHubBudget(validGross ? parseAmount(rawNet) : null, budget),
    };
  });
  const [baselineShown, destinationShown] = shown;

  const money = (value: number | null, currency: MoneyHubCurrency) =>
    figuresHidden ? '••••' : value === null || !Number.isFinite(value) ? '—' : formatterFor(currency).format(value);

  const equivalentFor = (city: ShownCity): MoneyHubEquivalentSalary | null => {
    // The current gross may sit in an unmodelled band; the solver searches every income and says if the answer does too.
    if (city.jurisdiction.payroll !== 'calculated' || ownNet[city.id]) return null;
    const target = convertMoneyHubAmount(baselineShown.result.monthlySurplus, baselineShown.currency, city.currency, fx);
    return solveMoneyHubEquivalentSalary(city.jurisdiction.id, city.budget, target, payrollOptions);
  };

  const formatEquivalentSalary = (equivalent: MoneyHubEquivalentSalary | null, city: ShownCity): string => {
    if (equivalent === null) return 'Needs calculated payroll';
    if (figuresHidden) return '••••';
    switch (equivalent.status) {
      case 'complete': return `${money(equivalent.annualGross, city.currency)} a year`;
      case 'unattainable-below-zero': return `Not needed: ${money(0, city.currency)} still beats the baseline deficit`;
      case 'unattainable-above-bound': return `Outside the ${money(MONEY_HUB_MAX_EQUIVALENT_SALARY, city.currency)} solver bound`;
      case 'unattainable': return `No gross reproduces this surplus within ${MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE} a month`;
      case 'unsupported': return 'Below the incomes this calculator covers';
      case 'not-calculated': return 'Needs calculated payroll';
      default: return '—';
    }
  };

  const shownJurisdictions = [...new Map(shown.map(city => [city.jurisdiction.id, city.jurisdiction])).values()];
  const showsUkOptions = shown.some(city => isUk(city.jurisdiction) && city.jurisdiction.payroll === 'calculated' && !ownNet[city.id]);
  const showsDeOptions = shown.some(city => city.jurisdiction.id === 'DE' && !ownNet[city.id]);
  const canCopy = !figuresHidden && isUk(baselineJurisdiction);

  const handleCopyPersonalFigures = () => {
    if (!canCopy) return;
    setManualNet({});
    const taxInput = financeTotals.taxInput;
    const grossText = taxInput.income > 0 ? formatFieldAmount(taxInput.income) : '0';
    if (mode === 'offers') {
      setOffers(previous => ({ ...previous, [baseline]: grossText }));
    } else {
      setSalary(grossText);
      setSalaryCurrency('GBP');
    }
    setPensionPercent(formatPercentInput(taxInput.pensionShare ?? 0));
    setPensionMethod(taxInput.pensionMethod);
    setPensionBasis(taxInput.pensionBasis ?? 'salary');
    setUndergradPlan(taxInput.undergradPlan);
    setPostgradLoan(taxInput.postgradLoan);
    setPersonalAllowance(taxInput.personalAllowance === undefined ? '' : String(taxInput.personalAllowance));
    // Money Hub models an employee with no other income, so say what Tax & Income has that it leaves out.
    const notCopied = [
      taxInput.kind === 'self-employed' && 'self-employment (pay is treated as employment here)',
      taxInput.pensionContribution > 0 && 'a fixed pension contribution',
      taxInput.benefitsInKind > 0 && 'benefits in kind',
      (taxInput.children > 0 || taxInput.childcareSupport > 0) && 'child benefit and childcare support',
      taxInput.marriageAllowance && 'marriage allowance',
      (taxInput.region === 'scotland') !== (baselineJurisdiction.id === 'GB-SCT')
        && `${taxInput.region === 'scotland' ? 'Scottish' : 'England, Wales and NI'} income tax bands (${baselineCity.name} uses its own nation's)`,
    ].filter((item): item is string => typeof item === 'string');
    const notCopiedNote = notCopied.length > 0
      ? ` Not copied, so take-home here can differ from Tax & Income: ${notCopied.join('; ')}.`
      : '';

    const activeCategories = budgetCategories.map(cat => ({
      name: cat.name,
      group: cat.group,
      budgeted: cat.budgeted,
      items: (cat.items ?? []).filter(item => isItemActive(item, cat)).map(item => ({
        name: item.name,
        budgeted: item.budgeted,
      })),
    }));
    const imported = mapPersonalBudgetToMoneyHub(activeCategories);
    if (imported.copiedCategories.length > 0) {
      const nextCityCosts: Partial<Record<MoneyHubCostId, string>> = {};
      const nextCityProvenance: Partial<Record<MoneyHubCostId, CostProvenance>> = {};
      for (const cost of MONEY_HUB_COSTS) {
        const val = imported.budget[cost.id];
        nextCityCosts[cost.id] = val === null ? '' : formatFieldAmount(val);
        nextCityProvenance[cost.id] = imported.copiedCategories.includes(cost.id) ? 'copied' : 'zero-from-import';
      }
      setCosts(previous => ({ ...previous, [baseline]: nextCityCosts }));
      setProvenance(previous => ({ ...previous, [baseline]: nextCityProvenance }));
      setCopiedNote(
        `Copied your Tax & Income settings and ${imported.copiedCategories.length} budget ${imported.copiedCategories.length === 1 ? 'category' : 'categories'} into ${baselineCity.name}. Unmatched categories in ${baselineCity.name} were set to 0. Edits here never change your saved records.${notCopiedNote}`,
      );
    } else {
      setCopiedNote(
        `Copied your Tax & Income settings into this scenario. Your saved Budget has no positive non-savings amounts to copy into ${baselineCity.name}.${notCopiedNote}`,
      );
    }
    setHasCopiedPersonalData(true);
  };

  const countryCount = MONEY_HUB_COUNTRIES.length;
  const calculatedCountries = [...new Set(MONEY_HUB_JURISDICTIONS.filter(j => j.payroll === 'calculated').map(j => j.countryName))];

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <h2 className="font-sans text-2xl font-bold">Money Hub</h2>
        <p className="font-sans text-xl">How far does your salary go?</p>
        <p className="text-sm text-muted-foreground">
          Compare take-home pay and living costs between {MONEY_HUB_CITIES.length} cities in {countryCount} countries.
          Pay is calculated for {calculatedCountries.join(', ')}; elsewhere you enter the net pay from an offer or an official calculator.
          Costs and exchange rates are your own inputs, not market estimates.
        </p>
      </header>

      <section className="space-y-4" aria-label="Comparison settings">
        <PillSwitch label="Salary basis" options={SALARY_MODES} value={mode} onChange={setMode} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={!canCopy} onClick={handleCopyPersonalFigures}>
            Copy my Tax &amp; Income &amp; Budget (to {baselineCity.name})
          </Button>
          <Button variant="ghost" onClick={resetToDefaults}>Reset to defaults</Button>
        </div>
        {figuresHidden && (
          <p className="text-xs text-muted-foreground">
            Show figures in the toolbar to copy your saved Tax &amp; Income settings and Budget into this scenario.
          </p>
        )}
        {!figuresHidden && !isUk(baselineJurisdiction) && (
          <p className="text-xs text-muted-foreground">
            Your saved records are UK pay and a GBP budget, so they copy only into a UK baseline city.
          </p>
        )}
        {copiedNote && !figuresHidden && (
          <p className="text-xs text-muted-foreground" role="status">{copiedNote}</p>
        )}

        {mode !== 'offers' && (
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="money-hub-salary">
                {mode === 'converted' ? 'Annual gross salary' : 'Annual gross (same number in each local currency)'}
              </Label>
              <Input id="money-hub-salary" type={figuresHidden ? 'password' : 'text'} inputMode="decimal" value={salary} onChange={event => setSalary(event.target.value)} autoComplete="off" />
            </div>
            {mode === 'converted' && (
              <CurrencyPicker id="money-hub-salary-currency" label="Salary currency" value={salaryCurrency} onChange={setSalaryCurrency} />
            )}
          </div>
        )}
        {mode === 'local-number' && (
          <p className="text-xs text-muted-foreground">
            The same number in different currencies is a different amount of money; use it to compare local pay scales, not purchasing power.
          </p>
        )}

        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <CityPicker
            id="money-hub-baseline"
            label="Baseline city"
            value={baseline}
            onChange={value => {
              setBaseline(value);
              if (value === destination) setDestination(baseline);
            }}
          />
          <CityPicker id="money-hub-destination" label="Compare with" value={destination} exclude={baseline} onChange={setDestination} />
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <CurrencyPicker id="money-hub-display-currency" label="Comparison currency" value={displayCurrency} onChange={setDisplayCurrency} />
            {needsFx && (
              <>
                <CurrencyPicker id="money-hub-fx-anchor" label="Rates quoted per 1" value={fxAnchor} onChange={setFxAnchor} />
                <div className="space-y-2">
                  <Label htmlFor="money-hub-rate-date">Exchange rate date</Label>
                  <Input id="money-hub-rate-date" type="date" value={rateDate} onChange={event => setRateDate(event.target.value)} />
                </div>
              </>
            )}
          </div>
          {needsFx && rateCurrencies.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {rateCurrencies.map(currency => (
                <div key={currency} className="space-y-2">
                  <Label htmlFor={`money-hub-rate-${currency}`}>{currency} per 1 {fxAnchor}</Label>
                  <Input
                    id={`money-hub-rate-${currency}`}
                    type={figuresHidden ? 'password' : 'text'}
                    inputMode="decimal"
                    value={rates[rateKey(currency)] ?? ''}
                    onChange={event => {
                      const next = event.target.value;
                      setRates(previous => ({ ...previous, [rateKey(currency)]: next }));
                    }}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {needsFx
              ? `This comparison uses ${involved.join(', ')}. Rates are your own dated quotes, not live. They convert ${mode === 'converted' ? 'the salary into each city\'s currency, which sets the gross that is taxed there, and ' : ''}the surpluses and the target for the gross needed. Living costs come from each city's own budget, not from the rate; choosing the comparison currency changes only how results are shown.`
              : `Everything here is in ${involved[0]}, so no exchange rate is needed.`}
          </p>
          {needsFx && !fxReady && fxTouched && (
            <p role="alert" className="text-sm text-destructive">
              {fx === null ? 'Enter a valid date (YYYY-MM-DD) for these rates.' : `Enter a positive rate for ${missingRates.join(', ')}.`}
            </p>
          )}
        </div>

        {showsUkOptions && (
          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              UK payroll options (pension, student loan, tax code allowance)
            </summary>
            <p className="pt-3 text-xs text-muted-foreground">
              Employee pension starts at 0%. The Tax Calculator&apos;s Standard assumes the {UK_AUTO_ENROLMENT.minimumEmployeeShare * 100}% auto-enrolment minimum, so set it here to compare like with like.
            </p>
            <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="money-hub-pension-percent">Employee pension (%)</Label>
                <Input id="money-hub-pension-percent" type={figuresHidden ? 'password' : 'text'} inputMode="decimal" value={pensionPercent} onChange={event => setPensionPercent(event.target.value)} placeholder="0" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="money-hub-pension-method">Pension method</Label>
                <Select value={pensionMethod} onValueChange={(value: UkPensionMethod) => setPensionMethod(value)}>
                  <SelectTrigger id="money-hub-pension-method"><SelectValue /></SelectTrigger>
                  <SelectContent>{PENSION_METHODS.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="money-hub-pension-basis">Pension earnings basis</Label>
                <Select value={pensionBasis} onValueChange={(value: UkPensionBasis) => setPensionBasis(value)}>
                  <SelectTrigger id="money-hub-pension-basis"><SelectValue /></SelectTrigger>
                  <SelectContent>{PENSION_BASES.map(basis => <SelectItem key={basis.id} value={basis.id}>{basis.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="money-hub-undergrad-plan">Undergraduate student loan</Label>
                <Select value={undergradPlan} onValueChange={(value: UkUndergradPlan) => setUndergradPlan(value)}>
                  <SelectTrigger id="money-hub-undergrad-plan"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNDERGRAD_PLANS.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="money-hub-personal-allowance">Base personal allowance (£/yr)</Label>
                <Input id="money-hub-personal-allowance" type={figuresHidden ? 'password' : 'text'} inputMode="decimal" value={personalAllowance} onChange={event => setPersonalAllowance(event.target.value)} placeholder="12570 (default)" autoComplete="off" />
              </div>
              <div className="flex items-center justify-between gap-3 pt-6">
                <Label htmlFor="money-hub-postgrad-loan">Postgraduate loan</Label>
                <Switch id="money-hub-postgrad-loan" checked={postgradLoan} onCheckedChange={setPostgradLoan} />
              </div>
            </div>
          </details>
        )}

        {showsDeOptions && (
          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">Germany payroll options (age, health fund)</summary>
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 pt-6">
                <Label htmlFor="money-hub-de-aged-23">Aged 23 or over (childless care surcharge)</Label>
                <Switch id="money-hub-de-aged-23" checked={deAged23} onCheckedChange={setDeAged23} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="money-hub-de-health">Health fund additional rate (%)</Label>
                <Input
                  id="money-hub-de-health"
                  type={figuresHidden ? 'password' : 'text'}
                  inputMode="decimal"
                  value={deHealthPercent}
                  onChange={event => setDeHealthPercent(event.target.value)}
                  placeholder={`${(DE_AVERAGE_HEALTH_ADDITIONAL_RATE * 100).toFixed(1)} (2026 average)`}
                  autoComplete="off"
                />
              </div>
            </div>
          </details>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map(city => {
          const isBaseline = city.id === baseline;
          const difference = compareMoneyHubCity(city.result, city.currency, baselineShown.result, baselineShown.currency, displayCurrency, fx);
          const commonSurplus = convertMoneyHubAmount(city.result.monthlySurplus, city.currency, displayCurrency, fx);
          const equivalent = isBaseline ? null : equivalentFor(city);
          const targetSurplusInCityCurrency = isBaseline
            ? null
            : convertMoneyHubAmount(baselineShown.result.monthlySurplus, baselineShown.currency, city.currency, fx);
          const housingSensitivity = calculateMoneyHubHousingSensitivity(city.result, city.budget, targetSurplusInCityCurrency);
          const relocationInputs = emptyMoneyHubRelocation();
          for (const item of MONEY_HUB_RELOCATION_ITEMS) {
            relocationInputs[item.id] = parseAmount(relocation[city.id]?.[item.id] ?? '');
          }
          const surplusGainInCityCurrency = isBaseline
            ? null
            : compareMoneyHubCity(city.result, city.currency, baselineShown.result, baselineShown.currency, city.currency, fx);
          const relocationResult = calculateMoneyHubRelocation(relocationInputs, city.result.monthlySurplus, surplusGainInCityCurrency);
          const manualInput = !city.calculated;
          return (
            <Card key={city.id}>
              <CardHeader>
                <CardTitle className="text-xl">{city.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {city.jurisdiction.name === city.jurisdiction.countryName ? city.jurisdiction.countryName : `${city.jurisdiction.name}, ${city.jurisdiction.countryName}`} · {city.currency}
                </p>
                <p className="text-xs text-muted-foreground">{isBaseline ? 'Baseline' : `Compared with ${baselineShown.name}`}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {mode === 'offers' && (
                  <div className="space-y-2">
                    <Label htmlFor={`money-hub-offer-${city.id}`}>Annual gross offer ({city.currency})</Label>
                    <Input id={`money-hub-offer-${city.id}`} type={figuresHidden ? 'password' : 'text'} inputMode="decimal" value={offers[city.id] ?? ''} onChange={event => { const next = event.target.value; setOffers(previous => ({ ...previous, [city.id]: next })); }} autoComplete="off" />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">Annual local gross: {money(city.gross, city.currency)}</p>
                {city.jurisdiction.payroll === 'calculated' && (
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`money-hub-own-net-${city.id}`} className="text-sm font-normal">Use my own net figure instead</Label>
                    <Switch id={`money-hub-own-net-${city.id}`} checked={ownNet[city.id] ?? false} onCheckedChange={checked => setOwnNet(previous => ({ ...previous, [city.id]: checked }))} />
                  </div>
                )}
                {city.unsupported && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {figuresHidden ? 'This gross is outside what the calculator covers.' : city.unsupported} Enter net pay instead.
                  </p>
                )}
                {manualInput && (
                  <div className="space-y-2">
                    {city.jurisdiction.payroll === 'user-supplied' && <p className="text-sm font-medium">Pay is not calculated here yet: enter the net pay</p>}
                    <Label htmlFor={`money-hub-net-${city.id}`}>Monthly net pay ({city.currency})</Label>
                    <Input
                      id={`money-hub-net-${city.id}`}
                      type={figuresHidden ? 'password' : 'text'}
                      inputMode="decimal"
                      value={city.rawNet}
                      disabled={!city.validGross}
                      onChange={event => { const next = event.target.value; setManualNet(previous => ({ ...previous, [city.id]: { gross: city.grossKey, raw: next } })); }}
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Net pay for this gross after all income tax, social insurance and payroll deductions, averaged monthly. Period: {city.jurisdiction.taxPeriod}. Changing the gross clears it.{' '}
                      Official starting point:{' '}
                      {city.jurisdiction.references.map((reference, index) => (
                        <span key={reference.url}>
                          {index > 0 && ', '}
                          <a className="underline underline-offset-4" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a>
                        </span>
                      ))}.
                    </p>
                  </div>
                )}
                {city.gross !== null && !city.validGross && <p role="alert" className="text-sm text-destructive">Enter a valid annual gross amount of zero or more.</p>}
                {city.result.invalid && <p role="alert" className="text-sm text-destructive">Enter valid amounts of zero or more, with percentages in range. Negative amounts and non-numeric values cannot be compared.</p>}
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-muted-foreground">Monthly take-home {city.calculated ? '(calculated)' : '(your figure)'}</dt><dd className="text-xl font-bold tabular-nums">{money(city.result.monthlyTakeHome, city.currency)}</dd></div>
                  {city.result.monthlyDeductions && (
                    <div>
                      <dt className="text-muted-foreground">Monthly deductions</dt>
                      <dd>
                        <ul className="space-y-1 pt-1">
                          {city.result.monthlyDeductions.map(line => (
                            <li key={line.id} className="flex items-baseline justify-between gap-3">
                              <span>{line.label}</span>
                              <span className="tabular-nums">{money(line.amount, city.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  <div><dt className="text-muted-foreground">Monthly basket total</dt><dd className="tabular-nums">{money(city.result.monthlyCosts, city.currency)}</dd></div>
                  <div><dt className="text-muted-foreground">Housing share of take-home</dt><dd className="tabular-nums">{figuresHidden ? '••••' : formatPercent(city.result.housingShareOfTakeHome)}</dd></div>
                  <div>
                    <dt className="text-muted-foreground">Largest monthly cost</dt>
                    <dd className="tabular-nums">
                      {figuresHidden ? '••••' : city.result.largestCost ? `${costLabel(city.result.largestCost.id, city.jurisdiction)} (${money(city.result.largestCost.amount, city.currency)})` : '—'}
                    </dd>
                  </div>
                  <div><dt className="text-muted-foreground">Monthly surplus / deficit</dt><dd className={cn('text-xl font-bold tabular-nums', !figuresHidden && city.result.monthlySurplus !== null && city.result.monthlySurplus < 0 && 'text-destructive')}>{money(city.result.monthlySurplus, city.currency)}</dd></div>
                  {city.currency !== displayCurrency && (
                    <div><dt className="text-muted-foreground">Monthly surplus in {displayCurrency}</dt><dd className="tabular-nums">{money(commonSurplus, displayCurrency)}</dd></div>
                  )}
                  {!isBaseline && (
                    <>
                      <div><dt className="text-muted-foreground">Surplus difference vs {baselineShown.name} ({displayCurrency})</dt><dd className="tabular-nums">{money(difference, displayCurrency)}</dd></div>
                      <div><dt className="text-muted-foreground">Gross needed to match {baselineShown.name}&apos;s surplus</dt><dd className="font-semibold tabular-nums">{formatEquivalentSalary(equivalent, city)}</dd></div>
                    </>
                  )}
                  {housingSensitivity && (
                    <>
                      <div>
                        <dt className="text-muted-foreground">Break-even monthly housing</dt>
                        <dd className="tabular-nums">
                          {figuresHidden
                            ? '••••'
                            : housingSensitivity.breakEvenHousing === null
                            ? 'Non-housing costs exceed take-home'
                            : money(housingSensitivity.breakEvenHousing, city.currency)}
                        </dd>
                      </div>
                      {!isBaseline && (
                        <div>
                          <dt className="text-muted-foreground">Housing to match {baselineShown.name}&apos;s surplus</dt>
                          <dd className="tabular-nums">
                            {figuresHidden
                              ? '••••'
                              : targetSurplusInCityCurrency === null
                              ? '—'
                              : housingSensitivity.housingToMatchBaselineSurplus === null
                              ? 'Requires negative housing'
                              : money(housingSensitivity.housingToMatchBaselineSurplus, city.currency)}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
                {city.result.monthlyTakeHome === null && !city.result.invalid && !city.unsupported && (
                  <p className="text-xs text-muted-foreground">
                    {city.gross === null && mode === 'converted' && city.currency !== salaryCurrency && !fxReady
                      ? `Converting the salary into ${city.currency} needs a dated rate above.`
                      : manualInput ? 'Enter a valid gross and its monthly net pay.' : 'Enter a valid gross salary.'}
                  </p>
                )}
                {city.result.missingCosts.length > 0 && <p className="text-xs text-muted-foreground">Complete every cost below to calculate the basket and surplus. Enter 0 where none applies.</p>}
                {housingSensitivity && (
                  <details className="border-t border-border pt-4">
                    <summary className="cursor-pointer text-sm font-medium">Housing sensitivity (-20% to +20%)</summary>
                    <ul className="space-y-2 pt-3 text-xs">
                      {housingSensitivity.points.map(point => (
                        <li key={point.delta} className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {formatDeltaLabel(point.delta)} ({money(point.housingCost, city.currency)})
                          </span>
                          <span className={cn('tabular-nums', !figuresHidden && point.monthlySurplus < 0 && 'text-destructive')}>
                            Surplus {money(point.monthlySurplus, city.currency)} · {figuresHidden ? '••••' : formatPercent(point.housingShareOfTakeHome)} of take-home
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <details className="border-t border-border pt-4">
                  <summary className="cursor-pointer text-sm font-medium">Edit monthly costs ({city.currency})</summary>
                  <div className="space-y-3 pt-4">
                    {MONEY_HUB_COSTS.map(cost => {
                      const rawVal = costs[city.id]?.[cost.id] ?? '';
                      const source = provenance[city.id]?.[cost.id];
                      const sourceLabel = source === 'copied'
                        ? 'Copied from Budget'
                        : source === 'zero-from-import'
                        ? '0 from Budget'
                        : rawVal.trim() !== ''
                        ? 'Manual'
                        : null;
                      return (
                        <div key={cost.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={`money-hub-${city.id}-${cost.id}`}>{costLabel(cost.id, city.jurisdiction)}</Label>
                            {sourceLabel && <Badge variant="secondary">{sourceLabel}</Badge>}
                          </div>
                          <Input
                            id={`money-hub-${city.id}-${cost.id}`}
                            type={figuresHidden ? 'password' : 'text'}
                            inputMode="decimal"
                            value={rawVal}
                            placeholder="Required; 0 if none"
                            autoComplete="off"
                            onChange={event => {
                              const nextValue = event.target.value;
                              setCosts(previous => ({ ...previous, [city.id]: { ...previous[city.id], [cost.id]: nextValue } }));
                              setProvenance(previous => ({
                                ...previous,
                                [city.id]: { ...previous[city.id], [cost.id]: nextValue.trim() === '' ? undefined : 'manual' },
                              }));
                            }}
                          />
                          {cost.id === 'healthcare' && <p className="text-xs text-muted-foreground">{city.jurisdiction.healthcareNote}</p>}
                        </div>
                      );
                    })}
                  </div>
                </details>
                <details className="border-t border-border pt-4">
                  <summary className="cursor-pointer text-sm font-medium">Upfront relocation costs &amp; deposits ({city.currency})</summary>
                  <div className="space-y-3 pt-4">
                    <p className="text-xs text-muted-foreground">
                      Refundable deposits tie up cash upfront; consumed expenses are one-off moving costs. Enter 0 where none applies.
                    </p>
                    {MONEY_HUB_RELOCATION_ITEMS.map(item => (
                      <div key={item.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`money-hub-reloc-${city.id}-${item.id}`}>{item.label}</Label>
                          <Badge variant="outline">{item.kind === 'deposit' ? 'Refundable deposit' : 'Consumed expense'}</Badge>
                        </div>
                        <Input
                          id={`money-hub-reloc-${city.id}-${item.id}`}
                          type={figuresHidden ? 'password' : 'text'}
                          inputMode="decimal"
                          value={relocation[city.id]?.[item.id] ?? ''}
                          placeholder="0 if none"
                          autoComplete="off"
                          onChange={event => {
                            const nextValue = event.target.value;
                            setRelocation(previous => ({ ...previous, [city.id]: { ...previous[city.id], [item.id]: nextValue } }));
                          }}
                        />
                      </div>
                    ))}
                    {relocationResult.invalid && (
                      <p role="alert" className="text-sm text-destructive">
                        Enter valid relocation amounts of zero or more.
                      </p>
                    )}
                    <dl className="space-y-2 border-t border-border pt-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Refundable deposits tied up</dt>
                        <dd className="tabular-nums">{money(relocationResult.depositsTiedUp, city.currency)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Consumed moving expenses</dt>
                        <dd className="tabular-nums">{money(relocationResult.consumedExpenses, city.currency)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Total upfront cash needed</dt>
                        <dd className="font-semibold tabular-nums">{money(relocationResult.totalUpfrontCash, city.currency)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Months of surplus to recover consumed costs</dt>
                        <dd className="tabular-nums">{formatMonths(relocationResult.monthsOfSurplusToRecoverConsumed, figuresHidden)}</dd>
                      </div>
                      {!isBaseline && (
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">Months of surplus gain vs {baselineShown.name} to recover consumed costs</dt>
                          <dd className="tabular-nums">{formatMonths(relocationResult.monthsOfGainToRecoverConsumed, figuresHidden)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section className="space-y-3 border-t border-border pt-6 text-sm" aria-label="Payroll coverage">
        <h3 className="font-sans text-lg font-semibold">How take-home is worked out</h3>
        {shownJurisdictions.map(jurisdiction => {
          const scope = jurisdiction.id in MONEY_HUB_PAYROLL_SCOPES
            ? MONEY_HUB_PAYROLL_SCOPES[jurisdiction.id as keyof typeof MONEY_HUB_PAYROLL_SCOPES]
            : null;
          return (
            <p key={jurisdiction.id}>
              <span className="font-medium">{jurisdiction.name === jurisdiction.countryName ? jurisdiction.name : `${jurisdiction.name}, ${jurisdiction.countryName}`}</span>
              {' '}· {jurisdiction.taxPeriod}:{' '}
              {scope
                ? `${scope.rules}, calculated locally. Covers ${scope.covers.charAt(0).toLowerCase()}${scope.covers.slice(1)} Not modelled: ${scope.excludes.charAt(0).toLowerCase()}${scope.excludes.slice(1)}`
                : 'not calculated here yet. Net pay is your own figure and is not verified.'}
              {' '}Official reference:{' '}
              {jurisdiction.references.map((reference, index) => (
                <span key={reference.url}>
                  {index > 0 && ', '}
                  <a className="underline underline-offset-4" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a>
                </span>
              ))}.
            </p>
          );
        })}
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer font-medium">Coverage: {MONEY_HUB_CITIES.length} cities in {countryCount} countries</summary>
          <ul className="space-y-2 pt-4">
            {MONEY_HUB_JURISDICTIONS.map(jurisdiction => (
              <li key={jurisdiction.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {jurisdiction.name === jurisdiction.countryName ? jurisdiction.name : `${jurisdiction.name}, ${jurisdiction.countryName}`}
                </span>
                {' '}· {MONEY_HUB_CITIES.filter(city => city.jurisdiction === jurisdiction.id).map(city => city.name).join(', ')}
                {' '}· {jurisdiction.currency} · {jurisdiction.taxPeriod} · {jurisdiction.payroll === 'calculated' ? 'pay calculated' : 'net pay entered by you'}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="space-y-4 border-t border-border pt-6" aria-label="Benefits, services and protections">
        <div className="space-y-1">
          <h3 className="font-sans text-lg font-semibold">Benefits, services and protections</h3>
          <p className="text-sm text-muted-foreground">
            Non-cash entitlements and unassessed benefits never add cash to take-home or surplus.
          </p>
        </div>
        {shownJurisdictions.map(jurisdiction => {
          const provisions = moneyHubProvisionsFor(jurisdiction.id);
          if (provisions.length === 0) {
            return (
              <p key={jurisdiction.id} className="text-sm text-muted-foreground">
                {jurisdiction.name}: not assessed yet. Nothing here describes its healthcare, pensions, benefits or employment rights.
              </p>
            );
          }
          return (
            <div key={jurisdiction.id} className="space-y-3">
              <h4 className="text-sm font-medium">{jurisdiction.name}</h4>
              <div className="grid gap-4 lg:grid-cols-3">
                {MONEY_HUB_PROVISION_KINDS.map(group => (
                  <Card key={group.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{group.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {provisions.filter(provision => provision.kind === group.id).map(provision => (
                        <div key={provision.id} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h5 className="font-medium text-foreground">{provision.title}</h5>
                            <Badge variant="outline">{MONEY_HUB_ELIGIBILITY_LABELS[provision.eligibilityState]}</Badge>
                          </div>
                          <dl className="space-y-1.5 text-xs text-muted-foreground">
                            <div><dt className="font-medium text-foreground">Statutory baseline</dt><dd>{provision.statutoryEntitlement}</dd></div>
                            <div><dt className="font-medium text-foreground">Employer package</dt><dd>{provision.employerPackageNote}</dd></div>
                            <div><dt className="font-medium text-foreground">Charges and limits</dt><dd>{provision.separateChargesAndLimits}</dd></div>
                            <div><dt className="font-medium text-foreground">Across {jurisdiction.name}</dt><dd>{provision.cityComparisonNote}</dd></div>
                          </dl>
                          <p className="text-xs text-muted-foreground">
                            Source:{' '}
                            <a className="underline underline-offset-4" href={provision.sourceUrl} target="_blank" rel="noreferrer">{provision.sourceLabel}</a>{' '}
                            (reviewed {provision.reviewedDate}).
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2 border-t border-border pt-6 text-sm text-muted-foreground" aria-label="Assumptions and sources">
        <h3 className="font-medium text-foreground">Assumptions and sources</h3>
        <p>One adult, employed for the full tax period in the city&apos;s jurisdiction, with no other income and no cash benefits. Calculated figures are annual estimates divided by 12, not a payslip; German income tax is the annual assessment, not monthly withholding.</p>
        <p>The gross needed to match the baseline is solved only where pay is calculated: the annual gross, between 0 and {MONEY_HUB_MAX_EQUIVALENT_SALARY.toLocaleString('en-GB')} in the destination&apos;s currency, that covers that city&apos;s basket and keeps the baseline&apos;s monthly surplus or deficit, converted at your rates and verified within {MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE} a month.</p>
        <p>Use comparable homes and the same lifestyle in each city. Blank costs are unknown; enter 0 where none applies. Break-even housing and ±10% / ±20% housing sensitivity hold non-housing costs constant. Upfront relocation separates refundable deposits tied up from one-off consumed moving expenses; recovery months divide only consumed expenses by positive monthly surplus or positive surplus gain over the baseline. Copying your Tax &amp; Income settings and Budget fills a UK baseline locally, tags each cost as copied, 0 from your Budget, or manual, and never changes your saved records.</p>
        <p>Inputs stay on this screen and clear when you leave it, hide figures after copying, or switch profiles.</p>
      </section>
    </div>
  );
}
