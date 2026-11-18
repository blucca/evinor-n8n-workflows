# Missing entity-ID matching regression

Download either workflow JSON, import it as a new workflow in your n8n editor, then **Execute workflow**. Each has eight standard nodes, is inactive, and needs no credentials, server or API account.

- [Original](evinor-missing-id.original.editor-test.json): the final independent check intentionally errors. The Acme event is assigned to `foreign-company` / `foreign-owner`.
- [Fixed](evinor-missing-id.fixed.editor-test.json): the same check passes with `review`, empty company ID and empty owner ID.

Both use the same synthetic event: HIGH-confidence funding for Acme, whose company role has no `namedEntityId`. The CRM fixture contains only **Other Company**, with `evinor_entity_id` set to the literal string `none` and an owner. The documented matching rule expects review: the event has neither an ID match nor an exact-name match.

The original search turns the absent ID into `none`, so its OR filter admits Other Company. The fixed search includes the entity-ID filter only when an ID exists. ID-first matching and the unique exact-name fallback keep their existing behavior.

These editor files retain the source Normalize, confidence-gate and Resolve code. The search boundary is a **Code mock**: it evaluates the exact original/fixed request expression, then applies OR/EQ/limit to the fixture. They demonstrate the matching contract without making service writes.

[Six independent synthetic fixtures](fixtures.json) preserve the input and expected output. [Observed native results](observed.json) also include a separate six-case comparison using real n8n HTTP nodes against localhost fixtures: all 12 executions succeeded; the original business contract passed 5/6, the fixed contract passed 6/6. The missing-ID case issued two note/task writes to the wrong company/owner before the fix and zero HubSpot writes afterward. The other five matching outputs remained identical. Both editor files were separately imported and executed unchanged in n8n **2.46.6 / Node 24.21.0**: original check error, fixed check passed.

Cases and CRM data are synthetic. Owner production behavior remains to be checked in the owner's environment. Workflow source: [Evinor, commit 1aa36b9](https://github.com/evinor-ai/evinor-n8n-workflows/tree/1aa36b944ff362590f8cbb0a49caeaaf6b6c75c0/workflows/hubspot-account-signals), copyright (c) 2026 Evinor, MIT; see the repository [license](../../../LICENSE.md). The independent check was generated with MIT-licensed [n8n-check](https://github.com/blucca/n8n-check).
