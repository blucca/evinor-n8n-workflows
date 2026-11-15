# HubSpot account signals

When a target account raises money, changes leadership or lays people off, this workflow updates HubSpot and tells the right person.

**Import:** [`workflow.json`](workflow.json)

## What it does

1. **Three Evinor Triggers**, one per sensor, all on the same target-account watchlist.
2. **Normalize event** flattens the delivery: company, entity ID, amount, round, investors, people, event date (respecting its precision), outlets and confidence. It also buffers the event for the daily digest.
3. **Confidence gate.** Only `HIGH` events that name a company go on automatically. Everything else goes to the review channel.
4. **Find HubSpot company.** Searches by the `evinor_entity_id` company property, and by exact name.
5. **Route:**

| Situation                                               | Action                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Owned account, funding or leadership change             | Timeline note on the company, plus a task for the owner due in two days |
| Owned account, layoff                                   | Review channel, so a person decides the tone                            |
| Company in HubSpot with no owner                        | Row appended to a Google Sheet as a lead                                |
| No match, or several companies with that name           | Review channel, with the Evinor entity ID to paste into HubSpot         |
| `MEDIUM` / `LOW` confidence, or no company on the event | Review channel                                                          |

6. **Daily digest.** Every morning at 8, one Slack message lists everything since the previous digest.

## Sensors

Create these in Evinor on your target-account watchlist, then pick each one in its trigger node:

| Trigger node      | Event type          | Filters                                              |
| ----------------- | ------------------- | ---------------------------------------------------- |
| Funding ≥ $10M    | `FUND_RAISING`      | `AMOUNT_RAISED` ≥ 10,000,000 USD, at least 2 reports |
| Leadership change | `LEADERSHIP_CHANGE` | At least 2 reports                                   |
| Layoff            | `LAYOFF`            | At least 1 report, so you hear early                 |

## Setup

1. Install `@evinor/n8n-nodes-evinor` and add an **Evinor API** credential to the three trigger nodes.
2. In HubSpot, create a private app that can read companies and create notes and tasks. The required scopes are listed on HubSpot's Companies, Notes and Tasks API pages. Add its token as a **HubSpot App Token** credential on the three HTTP Request nodes.
3. In HubSpot, create a single-line text **company** property with the internal name `evinor_entity_id`. The search fails without it.
4. In **Append lead to sheet**, pick your spreadsheet and sheet. The first row should have these headers: `Added`, `Company`, `Event`, `Event date`, `Amount`, `Unit`, `Round`, `Investors`, `Summary`, `Outlets`, `Confidence`, `HubSpot company id`, `Evinor event id`.
5. Set the Slack channels in **Post to review channel** (default `#evinor-review`) and **Post daily digest** (default `#account-signals`).
6. Activate the workflow.

## Matching companies

Evinor sends a resolved entity ID, not a company domain. The workflow:

1. Prefers a HubSpot company whose `evinor_entity_id` equals the event's entity ID.
2. Otherwise accepts exactly one company with the same name.
3. Otherwise sends the event to review with the entity ID, so you can paste it into the right company. The next event for that company then matches exactly.

## Known limits

- The digest buffer uses n8n workflow static data, which only persists for an active workflow, not for manual test runs. The buffer is cleared when the digest is built, so if the Slack post fails, that day's digest is lost.
- Name matching uses HubSpot's exact `EQ` filter, so "Acme" will not match "Acme Inc." until the entity ID is set.
- Events with `isTest: true` (test deliveries from the editor) go through the workflow but are left out of the digest.
