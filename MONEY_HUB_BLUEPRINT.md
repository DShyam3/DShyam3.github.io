# Money Hub — initial blueprint

Status: remaining scope after the jurisdiction-neutral implementation ·
Working name: Money Hub. Committed; not deployed.

The user has requested a global comparison hub and confirmed private placement
within Finance. England is the first calculated tax adapter, not the scope
boundary. The built comparison covers 41 cities in 22 countries and is described
in [FEATURES.md](FEATURES.md). Pay is calculated for England, Scotland, Wales,
Northern Ireland, Germany and the Netherlands. German results match the BMF
official calculator, and Dutch results match ten rows of the Belastingdienst 2026
white monthly wage tax table within €0.30 a month, both as reference tests.
Benefits, services and protections cover the six calculated jurisdictions where
their sources apply, and housing sensitivity and upfront relocation cash are
built; [FEATURES.md](FEATURES.md) describes them. Every other city takes a
user-supplied net figure and states that benefits, services and protections are
not yet assessed. Remaining public access, data purchases, persistence and
validated international tax coverage below are proposals, not deployment
authorisation. Sourcing and maintenance decisions remain open.

This is a supporting specification for [REHAUL_PLAN.md](REHAUL_PLAN.md#money-hub--remaining-scope).
The main plan owns project priorities and binding decisions; this file owns the
hub's detailed proposal. [FEATURES.md](FEATURES.md) continues to describe only
what is built. Move completed work through the document flow in
[AGENTS.md](AGENTS.md), rather than turning either plan into a progress diary.

## 1. Purpose

> Where could I live well on my income, what would I receive for what I pay,
> and what would change if I moved?

A single place to explore the financial side of living and working somewhere:
earnings, taxes, everyday costs, benefits, public services, pensions and
employment protections. Cities are the main entry point; country and regional
rules sit underneath them.

The hub should serve someone browsing places, comparing salaries or job offers,
or considering a move. A relocation decision is one use case, not a requirement
to use the hub. It should work with manually entered scenarios and public
reference data, without requiring personal finance records or a model API key.

## 2. Scope established in the conversation

- Compare the same salary within one country and across countries.
- Explore what £50,000 affords across London, Manchester, Exeter, Southampton,
  Berlin, Munich and Amsterdam, then expand to cities globally.
- Explore salaries by occupation, industry, seniority and location.
- Bring taxation and living costs together with healthcare, education,
  pensions, benefits and protections.
- Support browsing a hub as well as using a calculator.
- Explain trade-offs; avoid implying that lowest tax alone means best outcome.

Belgium, France, Spain, the UK and Switzerland also appeared in the original
reference. They remain candidate coverage, not a commitment to launch all five.

## 3. Questions the hub should answer

| Question | Result |
|---|---|
| How far does £50,000 go in these four UK cities? | Take-home, a comparable spending basket and monthly surplus |
| What does the same salary buy in Berlin or Amsterdam? | Explicit currency conversion, local deductions and local costs |
| What salary would match my London lifestyle elsewhere? | Required gross pay to fund a comparable basket and preserve a chosen savings amount |
| Which of these actual offers works better for me? | Cash, pension, other compensation, costs and protections side by side |
| What could someone in my role earn there? | Sourced salary distribution with role, experience, hours and date |
| What do I receive in return for taxes and contributions? | Coverage, benefits and services, including eligibility and separate charges |
| What would moving cost initially? | One-off expenses and cash tied up in deposits, separate from ongoing costs |

No universal best-city score is proposed. Users should be able to sort by an
explicit measure and inspect the trade-offs behind it.

## 4. Hub structure and journeys

Proposed navigation: **Overview · Places · Salaries · Compare · Benefits & protections**.
Taxes and living costs have dedicated sections within each place and comparison.
Final placement within the site remains open.

### Explore a place

A city profile brings together:

- Overview: location, currency, relevant jurisdictions and coverage status.
- Earnings: available role/industry benchmarks and their limitations.
- Taxes: supported employee scenarios, deductions and take-home calculations.
- Living costs: housing and an editable basket of recurring expenses.
- Services and protections: relevant national, regional and local provisions.
- Sources: dates, definitions, assumptions and missing coverage.
- Actions: add to comparison, set as baseline, or create a salary scenario.

Country pages explain shared rules and link to supported cities. A city can have
an informational profile before its tax calculation is supported; the UI must
make that distinction visible.

### Compare places or job offers

1. Choose a baseline and destinations; multiple cities in one country are valid.
2. Select the comparison mode and define the household.
3. Enter compensation and choose a common lifestyle basket.
4. Review results, edit assumptions and inspect sources.
5. Save or export a scenario once storage and sharing are deliberately designed.

### Apply it to personal finances

A later optional action can copy selected income and spending into a scenario.
Scenario edits must never alter actual income settings, budgets or ledger rows.
Users can inspect which values came from their records and replace them.

## 5. Comparison modes

| Mode | Meaning |
|---|---|
| Same gross, common currency | Convert £50,000 into each destination currency at one dated exchange-rate snapshot |
| Same numeric local salary | Compare 50,000 GBP, 50,000 EUR, etc.; explicitly different amounts of money |
| Actual offers | Enter each offer in its original currency and compare the resulting household budget |
| Equivalent lifestyle and savings | Solve for gross pay that funds the destination basket and retains the chosen baseline surplus |
| Local salary benchmark | Use a selected role/seniority benchmark when suitable source data exists |

Default to the first mode for the user's £50,000 example. Never switch currency
interpretation silently. Show original currency values alongside the common
display currency. Employer-cost comparisons can be a later advanced mode with
employer contributions separated from employee gross pay.

Changing display currency changes presentation, not the underlying scenario.
Currency conversion is not a cost-of-living adjustment. The local spending
basket supplies that adjustment; do not apply a second index to the same costs.

## 6. Inputs and budget

### Shared assumptions

- Scenario year and each jurisdiction's actual tax period.
- Household adults, earners and dependants; dependent ages when relevant.
- Housing type, bedrooms, central/outer area and sharing arrangements.
- Transport needs and an explicit spending basket.
- Base currency, exchange-rate snapshot and optional manual override.

### Per-location assumptions

- Country, region and municipality where required; city boundaries must be clear.
- Work and residence location; initially require them to be in the same country.
- Employment income, guaranteed extra salary payments and supported deductions.
- Pension contributions and other compensation, shown separately from cash.
- Local rent, healthcare costs and any other overrides.
- Continuing obligations, including debts that remain after a move.
- Eligibility information only where needed for supported benefits.

Start with a full-year resident employee and one adult. Household and employment
options should become selectable only when the relevant calculations are covered.
Do not imply that a generic household selector makes every country support it.

### Editable recurring basket

| Category | Definition to keep comparable |
|---|---|
| Housing | Same sharing arrangement and bedroom count; actual rent can override the estimate |
| Utilities and connectivity | Record which bills are included in rent |
| Groceries and household goods | Comparable quantities and household size |
| Transport | Public transport or explicit vehicle ownership costs |
| Healthcare | Required premiums and expected out-of-pocket costs, avoiding payroll duplication |
| Education and childcare | Type, dependent ages and attendance; only where supported |
| Leisure | Eating out, entertainment and subscriptions, with quantities or editable totals |
| Local household charges | Applicable charges not already included elsewhere |
| Continuing commitments | Debt repayments and other retained obligations not already deducted from income |

Every amount has provenance: sourced estimate, user input, copied personal value
or explicit zero. Missing is a separate state. Show lower, typical and higher
spending scenarios where justified; these are sensitivity cases, not statistical
confidence intervals. Annual or irregular bills can be monthlyised explicitly.

## 7. Results and proposed screen

Primary outputs:

- Monthly take-home and monthly money remaining after the selected basket.
- Difference from the baseline in a common currency.
- Gross salary needed to match baseline lifestyle and cash savings.
- Housing share of take-home and the basket's largest costs.
- Pension saving and non-cash compensation alongside cash outcomes.
- Benefits, services and protections in a separate comparison.
- Assumptions most likely to change the outcome, especially rent and salary.

Illustrative layout only; dashes below are placeholders, not calculated figures:

```text
MONEY HUB                   Overview  Places  Salaries  Compare  Benefits

How far does my salary go?
Baseline: London       Compare: Manchester · Exeter · Southampton
Mode: Same gross       Salary: £50,000/year       Display: GBP/month
Household: One adult   Housing: One-bedroom rental

                           London   Manchester   Exeter   Southampton
Annual gross salary           —          —          —          —
Monthly take-home             —          —          —          —
Housing                       —          —          —          —
Other costs                   —          —          —          —
MONEY REMAINING                —          —          —          —
Difference from baseline      —          —          —          —

Tax breakdown | Edit spending | Services & protections | Sources
```

Use the existing design system. Desktop can show comparison columns; mobile
should keep a baseline and one selected destination readable. Add locations
without forcing a seven-column layout onto a small screen.

Useful charts are salary allocation, salary versus surplus, and sensitivity to
rent. Negative surplus must be represented as a deficit rather than hidden or
clamped to zero. Maps are an optional browsing aid after comparisons work well.

## 8. Benefits, services and protections

Separate three kinds of provision:

| Kind | What to show |
|---|---|
| Employer package | Employer pension contributions, insurance, allowances, bonus and equity |
| Public benefits and services | Healthcare, education, childcare support, cash benefits and public pensions |
| Employment protections | Holiday, sick leave/pay, parental leave, dismissal protections and unemployment support |

For each provision, record coverage, eligibility, qualifying contributions or
residence, waiting periods, limits, separate charges and a dated official source.
Distinguish statutory entitlement from an employer's enhanced package. Distinguish
documented coverage from actual access or quality; any access metric needs its
own source and comparable definition.

Avoid blanket labels such as “free healthcare”, “free education” or “good pension”.
Explain what is covered and for whom. Public and private schooling, education
levels, tuition eligibility, pension contribution history and portability can
change the answer materially and need separate research before inclusion.

Eligibility states: **included in estimate · potentially eligible · not eligible
under these assumptions · not assessed**. An unassessed benefit must not silently
add cash to the result. Any computable cash benefit needs a supported rule set.

Leave days and protections remain non-cash comparisons unless a user explicitly
chooses a documented valuation method. State-pension summaries do not promise a
personal retirement income without the necessary history and calculation model.

## 9. Salary benchmarks

Benchmarks need role, industry, seniority, geography, employment type, working
hours, source period, sample information and currency. Distinguish base salary,
guaranteed cash, variable bonus, equity and total compensation.

Prefer median and supported percentiles over a single average. Explain whether
the population is current workers, advertised jobs or self-reported salaries.
Do not invent a city/seniority estimate from an incompatible national average.
Show broader geography as a labelled fallback, or report insufficient data.

Guaranteed annual pay is the default cash basis. Treat bonuses and equity as
separate scenarios, with country-specific tax support required before calculating
their net value. Normalise guaranteed 13th/14th salary payments into annual pay;
monthly values are annual averages, not a promise of each month's payslip.

## 10. Calculation and architecture boundaries

Reuse the existing pure UK engine in
[`src/lib/finance/uk-tax-calculator.ts`](src/lib/finance/uk-tax-calculator.ts)
and its tests as the UK starting point. The existing
[`TaxCalculatorSurface`](src/features/finance/surfaces/TaxCalculatorSurface.tsx)
is a potential entry point, not a requirement to place the entire hub inside it.
Recheck current interfaces before implementation because other sessions are
changing the calculator.

Proposed components, not files or database schemas to create now:

| Responsibility | Contract |
|---|---|
| Location catalogue | Stable country/region/city IDs, currencies and jurisdiction mappings |
| Tax modules | Versioned jurisdiction-specific rules with explicit supported inputs |
| Common breakdown | Gross, income taxes, employee contributions, pension, other deductions and cash benefits |
| Cost basket | Item definitions, quantities, local prices and user overrides |
| Salary observations | Comparable compensation definitions, populations and source metadata |
| Benefits catalogue | Structured provisions and eligibility with sourced explanatory content |
| Exchange rates | Dated currency pairs and reproducible conversion |
| Scenario calculator | Combine results, compare baselines, calculate sensitivity and equivalent pay |
| Saved scenarios | User assumptions and exact reference versions; storage choice remains open |

All arithmetic runs deterministically in local pure functions, with tests.
Models may help explain supported results but never generate rates, prices,
eligibility decisions or calculated figures. No model is required to use the hub.

Use this accounting definition consistently:

```text
annual cash available = gross employment cash
                      - income taxes
                      - employee social contributions
                      - employee pension contributions
                      - other supported payroll deductions
                      + eligible cash benefits included exactly once

monthly surplus = annual cash available / 12
                - monthly living costs
                - continuing commitments not already deducted
```

Tax modules determine taxable bases and pension treatment; the accounting display
must not substitute for jurisdiction rules. Separate final annual tax estimates
from payroll withholding. Avoid duplicating VAT embedded in consumer prices,
health insurance deducted from salary, or a student loan already in take-home.
Do not assume UK loan or pension rules transfer unchanged when moving abroad.

Equivalent salary means funding a comparable destination basket and preserving
a stated cash surplus in the base currency. Specify solver bounds, rounding and
tolerance. Benefit cliffs can make the function discontinuous or non-monotonic:
verify any returned salary and report unattainable or unsupported targets.

Match tax periods deliberately: show UK fiscal-year and calendar-year labels
where applicable, and identify mismatches. Do not silently reuse expired rules.
Keep tax-rule versions, prices and exchange rates independently dated. A saved
scenario retains its original versions; refreshing is an explicit recalculation.

## 11. Data sourcing and maintenance

| Data | Source strategy | Release condition |
|---|---|---|
| Taxes and mandatory contributions | Official authorities and official calculators | Rule coverage and reference calculations checked for the chosen period |
| Benefits and protections | Official government, pension and public-service sources | Eligibility, jurisdiction and exclusions documented |
| Salaries | Official earnings statistics or licensed salary datasets | Population, compensation definition and reuse rights understood |
| Housing and living costs | Official statistics, licensed datasets and user overrides | Geography, basket definitions, observation dates and reuse rights understood |
| Exchange rates | A documented authoritative rate source | Timestamp, quote direction and supported currencies validated |

Record source URL, publisher, geography, unit, currency, effective/observation
period, retrieval/review dates, methodology, licence and revision identifier.
Keep “official”, “community reported” and “user supplied” distinct. Do not present
a data-quality score without a defined method.

Candidate references from initial exploration:

- [Aukmind comparison](https://aukmind.com/tax/compare/?c=be%2Cfr%2Ces%2Cgb%2Cch):
  interaction reference for tax comparisons; not a source of verified city costs.
- [Swiss Federal Tax Administration calculator](https://swisstaxcalculator.estv.admin.ch/):
  a candidate validation reference if Swiss calculations are selected.
- [Numbeo cost-of-living API](https://www.numbeo.com/api/cost-of-living-api):
  candidate city data; commercial terms and suitability remain unassessed.

This blueprint contains no country rate tables or verified salary/cost dataset.
Provider selection, licence review, recurring cost and data acquisition remain
open. No scraping rights or redistribution rights are assumed.

Assign a maintainer and review cadence before releasing each dataset. New tax
periods require validation before activation. Missing or stale data must remain
visible; incomplete baskets cannot participate in a fully-costed ranking without
the user filling the gaps. Provider failures should leave dated cached data
available where permitted, rather than substituting generated figures.

## 12. Privacy and storage

Keep public reference data separate from personal scenarios. Reference-data
updates should not require sending a salary, household details or a personal
budget to a provider. Provider credentials must never enter frontend code.

Start with manual scenarios and decide persistence separately. If personal
finance import is added, make it explicit and show the copied values. Sharing
should start with selected locations and public defaults; including personal
salary or household details requires an intentional preview and choice. Do not
place private records or identifiers in share URLs.

## 13. Proposed rollout and acceptance gates

### Phase 0 — remaining product and data decisions

- [ ] Decide whether and how to offer public access beyond private Finance.
- [ ] Define source requirements for a comparable one-adult rental basket.
- [ ] Decide reference-data storage, licensing, maintenance ownership and budget.
- [ ] Resolve tax-year versioning beyond the initial fixed 2026/27 comparison.

Exit: sourced expansion has a bounded brief, supported cases and an owner.

### Phase 1 — remaining comparison foundations

- [ ] Add sourced city profiles and presets with coverage and freshness labels.
- [ ] Verify mobile, keyboard, screen-reader and cross-theme behaviour in a browser.

Exit: supported city budgets are traceable and unsupported data stays visibly
incomplete. Verify the cross-currency comparison and the distinction between
calculated and user-supplied net pay in the browser.

### Phase 2 — validated international tax and services

- [x] Implement German and Dutch employee tax adapters with official reference tests. *Germany: BMF Einkommensteuer cases match exactly and BMF Lohnsteuer cases sit within the expected withholding gap, as reference tests. Netherlands: built from Belastingdienst 2026 Tables 1 and 2a/2b, and checked against ten rows of the published 2026 white monthly wage tax table within €0.30 a month as reference tests. No row covers labour-credit segment 1 (up to €11,965 a year).*
- [ ] Validate social contributions, healthcare treatment and supported household cases. *German employee insurance and Dutch first-bracket volksverzekeringen are modelled; German private health insurance, church tax, the Dutch 30% ruling, occupational pensions and household cases are not.*
- [x] Add equivalent-gross solving only where the local tax adapter is validated. *Solving runs for the UK, Germany and the Netherlands, all backed by official reference tests.*
- [ ] Show country-specific benefits/protections and eligibility differences alongside cash results. *Built locally for all six calculated jurisdictions (`GB-ENG`, `GB-SCT`, `GB-WLS`, `GB-NIR`, `DE`, `NL`); the 25 user-supplied jurisdictions state not assessed.*

Exit: each calculated jurisdiction passes official reference cases and comparable
budget checks; unsupported circumstances do not receive a confident net figure.
Manual foreign net quotes remain explicitly labelled until then.

### Phase 3 — salaries and richer packages

- [ ] Add role, industry and seniority benchmarks with sample and date context.
- [ ] Add employer package comparisons, supported household cases and benefits.
- [ ] Add saved scenarios.

Exit: every new figure has a supported deterministic calculation and a traceable
input; non-cash comparisons remain distinguishable from spendable income.

### Phase 4 — broader global coverage

- [ ] Prioritise additional countries and cities by demand and maintainable data.
- [ ] Add a coverage matrix listing tax years, regions and supported circumstances. *A coverage list exists, showing each jurisdiction's cities, currency, tax period and whether pay is calculated. Supported circumstances are not yet listed.*
- [ ] Add advanced cases only with dedicated rules and reference tests.

Global coverage is a direction, not an initial launch promise. Cross-border work,
split-year residence, self-employment, investment income and special expatriate
regimes remain outside the first release.

## 14. Verification before implementation can ship

- UK outputs agree with the existing engine for identical assumptions.
- Each new jurisdiction has official reference cases and threshold/rounding tests.
- The same inputs and reference versions reproduce the same results.
- Currency direction, annual/monthly units and extra salary payments are tested.
- Basket totals reconcile; deductions and benefits are counted once.
- Equivalent-salary outputs reproduce the target within documented tolerance,
  including tests around discontinuities and unsupported targets.
- Missing data, stale versions, zero income and deficits have explicit outcomes.
- Mobile, keyboard and screen-reader comparisons remain understandable.
- Scenario edits cannot mutate actual finance records or leak between profiles.
- Applicable repository lint, typechecks, tests, build and ship-check pass;
  no country or dataset is described as verified without its own evidence.

## 15. Decisions still open

1. Final name; any future standalone entry beyond the confirmed Finance surface?
2. Whether to add public reference browsing beyond the confirmed private audience?
3. Which housing/basket definitions make cross-country comparisons meaningful?
4. Which licensed or official datasets can be maintained within the budget?
5. Which occupations and industries should salary benchmarks cover first?
6. Which tax years, household types and employment cases are initially supported?
7. Where should versioned reference data and saved scenarios live?
8. Who reviews changes, and what freshness limits apply to each dataset?

Recommended next task: run dark-theme, keyboard/screen-reader and signed-in
production checks once the work is committed by the agreed committer. Sourced
comparable city budgets and benefits, services and protections for the 25
user-supplied jurisdictions follow. Broader global coverage is central to the
hub, not dependent on first completing every UK feature.
