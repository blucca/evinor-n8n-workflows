# Evinor n8n workflows

Ready-to-import [n8n](https://n8n.io) workflows that act on [Evinor](https://evinor.ai) events: funding rounds, acquisitions, layoffs, leadership changes and more, delivered as structured data instead of headlines.

Every workflow here starts from the [Evinor Trigger](https://github.com/evinor-ai/n8n-nodes-evinor) community node, which binds to one Evinor sensor and verifies each delivery's signature.

## Workflows

| Workflow                                                      | Events                             | Sends to                      | What it does                                                                                                                                     |
| ------------------------------------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [HubSpot account signals](workflows/hubspot-account-signals/) | Funding, leadership change, layoff | HubSpot, Google Sheets, Slack | Notes and tasks the owner of a target account, logs unowned companies as leads, routes anything uncertain to a person, and posts a daily digest. |

More are on the way. To ask for one, [open a workflow request](../../issues/new?template=workflow-request.md).

## Using a workflow

1. In n8n, install the community node: **Settings → Community nodes → Install** and enter `@evinor/n8n-nodes-evinor`.
2. Create an **Evinor API** credential with an API key that has the `SENSORS_READ` and `SENSORS_WRITE` scopes.
3. Download the workflow's `workflow.json` and import it: **Workflows → Import from file**.
4. Follow the setup in the workflow's README (each workflow also carries the same steps in a sticky note), then activate it.

You need an Evinor account to create sensors. The free plan needs no card.

## How the data arrives

The trigger outputs one item per event. With **Simplify** off, which every workflow here uses, the useful fields are:

| Field                                      | Meaning                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `eventCodeName`                            | Event type, e.g. `FUND_RAISING`, `LAYOFF`, `LEADERSHIP_CHANGE`                                                               |
| `externalEventId`                          | The event's ID, stable across sensors that match the same event                                                              |
| `eventDate.value`, `.precision`, `.source` | When it happened. A `MONTH` (or `null`) precision date has no real day; `ESTIMATED` dates are estimates                      |
| `details.roles[]`                          | Extracted values: `code`, `textValue`, and where available `parsedAmount`, `parsedAmountUnit`, `parsedDate`, `namedEntityId` |
| `details.confidence.band`                  | `HIGH`, `MEDIUM` or `LOW`. Branch on the band, not the score                                                                 |
| `details.reportingOutlets[]`               | Outlets that reported the event (`id`, optional `name`)                                                                      |
| `details.generatedSentence`                | A one-line description of the event                                                                                          |
| `details.triggeringReport.sourceKind`      | `article`, `user` or `represented`                                                                                           |
| `isTest`                                   | `true` for test deliveries from the editor                                                                                   |

Evinor identifies companies by a resolved entity ID (`namedEntityId`). It does not send company domains, so CRM matching uses that ID or the company name. Each workflow's README says how it handles this.

## Contributing

Workflow requests and fixes are welcome. Each workflow lives in its own folder under `workflows/` with:

- `workflow.json`: exported from n8n with credentials removed
- `README.md`: what it does, the sensors it expects, setup steps, and known limits

## License

MIT
