---
title: "What a Semantic Layer Gave an MCP Server to Be Accurate About"
subtitle: "One credit union member, six interest rates, and a semantic layer that names each one"
date: 2026-09-29
description: "How a declarative semantic layer turns six colliding meanings of 'interest rate' and 'balance' into named, cited, reproducible metrics — and lets an MCP server answer them accurately, with the SQL attached."
tags: [semantic-layer, mcp, agents, ai]
draft: false
---

Allison Hill is member 1 at Meridian Valley Credit Union, a fictional credit union I built for this project. She lives in Ohio, her credit band is good, and she holds one account in each of the six lines of business: checking, mortgage, HELOC, credit card, car insurance, and an IRA. Suppose a supervisor asks what interest rate Allison has. Five of those accounts carry a rate, and the card carries two, so the database holds six answers.

| Line of business | Account | Rate on file |
|---|---|---|
| Mortgage, 30-year fixed | ****0531 | 6.308% note rate |
| HELOC, prime | ****0701 | 9.870% (8.700% base plus 1.170% margin) |
| Credit card, Platinum Visa | ****0951 | 0.0% purchase APR |
| Credit card, same card | ****0951 | 27.351% cash-advance APR |
| Free Checking | ****0001 | 0.0% APY, a rate she earns |
| Investments, IRA | ****1291 | 15.924% year-to-date return |

Every number in that table is correct. Her card is on a 0% introductory purchase rate and charges 27.351% on cash advances, both on the same piece of plastic. The checking APY has the opposite sign convention from the loans. The IRA figure is a return, which some people would say isn't interest at all. Ask "what's her interest rate?" and any of the six is a defensible reply.

"Balance" behaves the same way. Her checking account shows $11,549.52 in the ledger and $11,481.25 available. Her mortgage principal is $612,338.25. She has drawn $126,262.08 against a $167,007.26 HELOC limit, owes $4,570.16 on the card, and holds $82,856.14 in market value in the IRA. Those are six figures under one word, and three of them are money she owes.

This article walks from the database that stores those numbers to the layer that names them, and then to an MCP server that lets an LLM ask for them by name. It follows a demo I built, and the repository is public: [github.com/HendoCode/contact-center-ai](https://github.com/HendoCode/contact-center-ai). All data is synthetic, generated deterministically with seed 42, so the numbers below can be reproduced by running the generator.

## Background

I built an MCP server for a financial institution's contact center. It began as a proof of concept. Supervisors could search call transcripts, pull a summary of a single call, and look at CSAT survey scores, all backed by a RAG pipeline on pgvector. For those three jobs it worked well, because the questions were about calls: find the ones where the member mentioned fraud, summarize this one, show me the low scores.

Then the client wanted the MCP to answer a wider range of questions. The questions moved from "find me calls where" toward aggregate ones about rates, balances, and revenue. The server began answering them by writing SQL against the OLAP tables and guessing at what the columns meant.

Two problems followed quickly. The first was ambiguity and hallucination that we couldn't easily prevent. A model that has to decide, from column names alone, what "balance" means will decide, and it won't always decide the same way twice. The second was trust. The line call-center workers, their team leads, and a few customers who were on calls where the MCP was used as heavily as possible all had reason to doubt what the system told them, and doubt of that kind is slow to repair.

The real deployment doesn't have a semantic layer yet. This project is where I worked out what one should look like, on data I'm free to show.

Meridian Valley is sized to run on a laptop: 700 members, 1,400 accounts, 1,250 call interactions, 943 CSAT responses, 25,000 ledger transactions, and 500 mortgage rate locks. It is modeled the way real credit unions store things, which is where the trouble starts.

## The transactional data model

The transactional layer has 21 tables covering members, households, staff, products, accounts, calls, surveys, ledger transactions, and rate locks. The account table is a shared core, and each line of business hangs its own typed child table off it. That pattern is called Table-Per-Type.

The schema has no `balance` column and no `interest_rate` column anywhere. What it has is this:

- A mortgage stores `note_rate`.
- A HELOC stores `base_rate` and `margin`, two columns that add up to the rate.
- A card stores `purchase_apr` and `cash_advance_apr`, two different rates on the same account.
- A checking account stores `apy`, the one rate the member earns instead of pays.
- An investment account stores `ytd_return_pct`.

Five of the six child tables carry a rate, in seven columns. The sixth, insurance, carries premiums and coverage limits instead. Nothing in the schema is wrong. Each column is named for what it holds, and the trouble begins when someone asks for "the rate" in English.

Pulling the featured member is one query:

```sql
SELECT member_id, legal_name, credit_score_band, residence_state
FROM member WHERE member_id = 1;
-- 1 | Allison Hill | good | OH
```

Her four seeded calls are CALL-00260 (online banking), CALL-00421 (loan inquiry), CALL-00791 (insurance service), and CALL-01089 (investment review). We will come back to that last one.

## Ambiguous terms

Six words in this domain carry two or more meanings that live in different physical columns. I'll take them in order of how much damage they do.

Interest rate is the one we started with. Portfolio-wide, the same word resolves to an average mortgage note rate of 6.5888%, an average card purchase APR of 18.1192%, an average deposit APY of 1.9373%, an average HELOC rate of 10.1101%, and an average investment return of 7.4710%. That is five averages from one question, before counting the weighted mortgage rate and the cash-advance APR.

Balance is worse, because the sign changes. A checking balance is an asset to the member and a card balance is a liability. Summing "balance" across banking and card accounts gives $40,641,908.52, which is true of nothing. It adds $38,287,038.69 in available banking balances to $2,354,869.83 in card debt. The figure that answers the question a supervisor probably meant, what members hold net of what they owe on cards, is $35,932,168.86.

LCV and LTV sound alike when spoken. Marketing means lifetime customer value, which is a convention and exists nowhere as a column. Underwriting means loan-to-value, which is a fact: Allison's is 60.42% and the portfolio average is 77.63%. If a model asked for the top members by LCV routes to loan-to-value, it returns the members carrying the most risk, sorted as though they were the most valuable.

The remaining three do less damage but follow the same pattern.

| Word | One meaning | Another meaning |
|---|---|---|
| Limit | Credit capacity: a HELOC's $167,007.26 and a card's $10,149.14 | Coverage: Allison's $1,811.83 auto deductible, which has nothing to do with credit |
| Premium | Her $3,266.12 annual insurance premium ($272.18 a month) | The 1.170% margin on her HELOC, a rate premium over an index |
| Lock | The mortgage pipeline's rate lock: 500 rows, 142 exercised and 183 expired | A fraud department saying "we locked her account," a call outcome with no table behind it |

A count of locks this quarter answered from the wrong source is off by the entire fraud workload.

None of this is a defect in the synthetic data. Real credit unions store these figures in separate places, and a BI tool with a flat list of columns invites `SUM(balance)`.

## The star schema

The warehouse layer is built with dbt, and it turns those 21 normalized tables into a star of fact tables and conformed dimensions.

| Fact table | One row per | Rows |
|---|---|---|
| `f_interaction` | call | 1,250 |
| `f_csat` | survey response | 943 |
| `f_account_snapshot` | account per snapshot date | 1,400 (at 2026-08-31) |
| `f_transaction` | ledger entry | 25,000 |
| `f_rate_lock` | rate lock | 500 |
| `f_rate` | posted product rate | 126 |
| `f_interaction_account` (bridge) | call and account it touched, for calls that touch more than one account | 1,383 |

The dimensions include `d_member`, `d_product`, `d_date`, `d_staff`, `d_team`, `d_category`, and `d_household`. Two of them are deliberate snowflakes: `d_account` points to `d_product`, so the line-of-business discriminator lives in exactly one place, and `d_staff` points to `d_team`.

The grain is kept strict. `f_account_snapshot` holds stocks, the as-of balances, which are semi-additive and never summed across dates. `f_transaction` holds flows, signed ledger entries with credits positive and debits negative. "Principal paid this year" comes from the flow table and never from the snapshot. Average daily balance is derived from transactions and is not stored anywhere.

The choice I care most about is what `f_account_snapshot` leaves out. It has no column named `balance` or `interest_rate`. It has `mortgage_note_rate`, `purchase_apr`, `deposit_apy`, `banking_available_balance`, and `card_outstanding_balance`, each null for accounts of the wrong type. The warehouse inherits the ambiguity on purpose and passes it up to the one layer that can give each meaning a name.

## The semantic layer

That layer is dbt with MetricFlow: open source, runs locally, and declared in YAML committed to git. The rule is short. No metric is named `interest_rate`, `balance`, `limit`, or `lcv`. Every ambiguous word maps to several lob-filtered metric names, and none keeps the bare word. The catalog holds 43 metrics in `olap/dbt/models/marts/semantic/metrics.yml`.

| The word | What it resolves to |
|---|---|
| interest rate | `average_mortgage_note_rate`, `weighted_mortgage_portfolio_rate`, `average_heloc_current_rate`, `average_credit_card_purchase_apr`, `average_credit_card_cash_advance_apr`, `average_deposit_apy`, `average_investment_return_pct` |
| balance | `banking_available_balance` (asset), `credit_card_outstanding` (liability), `mortgage_principal_balance`, `heloc_drawn_balance`, `investment_market_value`, `escrow_balance`, and `net_member_liquidity`, the only declared blend |
| LCV, LTV | `loan_to_value` (a fact) and `member_lifetime_value` (a declared convention) |
| limit | `credit_card_credit_limit` and `heloc_credit_limit` (capacity), `insurance_coverage_limit` (coverage) |
| lock | `rate_locks_count`, the mortgage pipeline, and never a fraud freeze |

Here is what four of those look like in the file:

```yaml
### Interest rate
- name: average_mortgage_note_rate      # what she PAYS on a first-lien, fixed
  type: simple
  type_params: { measure: mortgage_note_rate }
  filter: "{{ Dimension('product__lob') }} = 'mortgage'"

- name: average_deposit_apy             # what she EARNS, sign flipped
  type: simple
  type_params: { measure: deposit_apy }
  filter: "{{ Dimension('product__lob') }} = 'banking'"

### Balance
- name: net_member_liquidity            # asset MINUS liability
  type: derived
  type_params:
    expr: banking_available_balance - credit_card_outstanding

### Lifetime value vs loan-to-value
- name: member_lifetime_value
  type: derived
  type_params:
    expr: relationship_revenue * 24 / active_members
```

Three properties of this file matter to me. Every metric carries a description, and the file is in git, so the question "what does this number mean?" has a commit history behind it. `net_member_liquidity` is a derived metric, so the asset-minus-liability convention exists in exactly one committed formula and no dashboard can quietly add the two. And LCV is written out with its parameters. Relationship revenue is fee plus interest income over a trailing window of about six months. The 24 packs two assumptions: multiplying by 2 annualizes the window, and multiplying by 12 is an assumed relationship tenure in years. Those assumptions can be argued over in a pull request, which is a better place for the argument than a slide deck.

## The same questions, answered by declared metrics

With the layer in place, each ambiguous word becomes a query with named metrics, run from `olap/dbt/` with `mf query`.

The five interest rates:

```bash
uv run --group dbt mf query \
  --metrics average_mortgage_note_rate,average_credit_card_purchase_apr,average_deposit_apy,average_heloc_current_rate,average_investment_return_pct \
  --decimals 4
```

| Metric | Value |
|---|---|
| `average_mortgage_note_rate` | 6.5888 |
| `average_credit_card_purchase_apr` | 18.1192 |
| `average_deposit_apy` | 1.9373 |
| `average_heloc_current_rate` | 10.1101 |
| `average_investment_return_pct` | 7.4710 |

The sign trap. Before, `SELECT SUM(balance)` returns $40,641,908.52. After:

```bash
uv run --group dbt mf query --metrics banking_available_balance,credit_card_outstanding,net_member_liquidity --decimals 2
```

| Metric | Value |
|---|---|
| `banking_available_balance` (asset) | 38,287,038.69 |
| `credit_card_outstanding` (liability) | 2,354,869.83 |
| `net_member_liquidity` (asset minus liability) | 35,932,168.86 |

LCV against LTV:

```bash
uv run --group dbt mf query --metrics loan_to_value,member_lifetime_value --decimals 2
```

| Metric | Value |
|---|---|
| `loan_to_value` (underwriting risk, a fact) | 77.63 |
| `member_lifetime_value` (marketing convention) | $760,635.25 |

### How the $760,635.25 comes about

```
LCV = (fees + interest income) ÷ active members × 2 × 12
```

| Step | Figure | Source |
|---|---|---|
| Fees, trailing six months | $8,553,593.77 | ledger |
| Interest income, same window | $8,243,767.90 | ledger |
| Relationship revenue | $16,797,361.67 | ledger |
| Per active member (530) | $31,693 | ledger |
| Annualized (× 2) | $63,386 | declared in `metrics.yml` |
| Assumed twelve-year tenure (× 12) | $760,635.25 | declared in `metrics.yml` |

The first four rows come from the ledger. The last two are declared in one line of `metrics.yml`, so anyone who thinks the tenure should be eight years can change a single number in a pull request and see what happens. The size of the final figure comes from how the synthetic ledger was generated. The formula is what the example shows, and the magnitude isn't meant to describe a real credit union.

Two more cases I computed directly from the seed data. "What does our mortgage book cost?" is a weighted question, and a plain average of note rates gives 6.5888. `weighted_mortgage_portfolio_rate` is declared as a ratio of numerator to denominator, note rate times principal over principal across the 170 mortgages, and gives 6.5695 on $62,977,671.64 in principal. Declaring the weighting once means nobody has to remember it. And of 340 cards, 59 sit on a 0% introductory rate. Average purchase APR across all cards is 18.1192, excluding the teasers it is 21.9236, and cash-advance APR averages 24.428. One card portfolio yields three defensible figures depending on the question.

## The MCP server

Everything so far was the analytics side. The other half is a GenAI client speaking MCP to the server. `ccai_mcp/server.py` registers five tools.

| Tool | What it does | Added |
|---|---|---|
| `search_transcripts` | Vector search over call transcripts | proof of concept |
| `get_call_summary` | Pulls the summary of one call | proof of concept |
| `query_csat` | Reads satisfaction scores from Postgres (`f_csat`), filtered by score range and category | proof of concept |
| `query_metric` | Runs declared metrics through the semantic layer and returns the table with the generated SQL | semantic layer |
| `ask_the_analyst` | Resolves a plain-English question to declared metrics and answers with the SQL attached | semantic layer |

The first three are retrieval tools from the proof of concept, and they are honest about what they do.

Here is what that honesty looks like. Asked to find calls where a member asked what interest rate they were paying, `search_transcripts` surfaces CALL-00047. Michael Freeman (MBR-000239) asked what interest rate he was currently paying, and the agent on the call told him his annual percentage yield was 5.209%. The APY is the rate he earns. The transcript reproduces the ambiguity faithfully, and the retrieval tool quotes it faithfully. Only a declared metric knows which number "interest rate" should have routed to.

`get_call_summary(call_id="CALL-01089")` returns Allison's IRA review: a market value of $82,856.14, $7,149.52 in settled cash, and a year-to-date return of 15.92%. The agent's closing line on that call mentions her lifetime value to the credit union, which is where LCV enters a call transcript.

`query_csat()` returns 943 responses averaging 4.09 out of 5. The weakest category is `escrow_analysis` at 3.00 across 10 responses, and the strongest is `investment_review` at 4.67 across 45. The distribution is 30 ones, 60 twos, 155 threes, 252 fours, and 446 fives.

Ask any of those three what the average interest rate is, or what fee revenue looks like this quarter, and they have nothing to say. They return calls about rates. This is the same gap that opened on the real engagement, and the other two tools are built to close it by going through the semantic layer.

`query_metric` takes one or more declared metric names, with optional `group_by`, `decimals`, and `limit`, and returns the result table along with the SQL MetricFlow generated. The tool description tells the model the rule up front: there is no bare "interest rate" or "balance" or "LCV," so resolve the word to a specific metric name first.

`ask_the_analyst` takes a natural-language question and resolves it to declared metrics, using the descriptions in `metrics.yml` as its retrieval context. It executes those metrics through the semantic layer and returns a grounded answer with the SQL attached. Its tool description says it will not return a single blended number, and that it returns each declared metric. This is the one tool that makes an LLM call at runtime, so it needs a provider key. The repository routes through the same provider-swap setting as the rest of the pipeline, so it can point at OpenAI, an OpenAI-compatible endpoint such as OpenRouter, or a local Ollama model.

I'm still working on the client-side transcripts for these two tools, so what follows describes what they are built to return.

| Question | Resolves to | The answer |
|---|---|---|
| "What's our average interest rate?" | the five declared rate metrics from the earlier table | Each metric with its name and description, and the SQL behind them. There is no single average to report, and the answer says so. |
| "What are our members' total balances, net of what they owe us?" | `net_member_liquidity` | $35,932,168.86, with the formula `banking_available_balance − credit_card_outstanding` quoted alongside. A bare `SUM(balance)` lands on $40,641,908.52 instead. |
| "What's our LCV?" | `member_lifetime_value` | The declared formula, with `loan_to_value` named as a separate metric that is available if asked for. |

What moves in these exchanges is where the definitions live. The model reads a committed YAML file, and its answer cites the metric it used. When someone on a call floor asks where a number came from, the answer is a metric name and a line in a file that anyone can read.

## Recommendation

> If an LLM is going to answer questions about numbers, put the definitions in a file it has to cite, and keep that file in version control.

That is the recommendation I would give a team facing the situation I was in, and the repository is the evidence for it.

Some limits are worth stating. The data is synthetic and small, and 700 members will never surface the problems that 700,000 would. The real deployment doesn't have a semantic layer yet, so I can't report what one changes for the call-center workers and team leads whose trust was the real problem there. What I can show is that on this data each ambiguous word resolves to named, reproducible numbers, and that an MCP client can be handed those numbers along with the SQL behind them. I'm continuing to build out the MCP side, and the repository is where the current state lives.

The definitions are in `olap/dbt/models/marts/semantic/metrics.yml`, the tools are in `ccai_mcp/server.py`, and the generator that produces Allison Hill and everyone else in the data is `data/synthetic/generate_data.py`. Run it with seed 42 and you will get her six accounts back.
