'use strict';

// Executes this template's source with synthetic CRM responses, a fixed clock
// and fresh static data. Only its current IF/Switch/expression forms are supported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflow.json'), 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'branch-fixtures.json'), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
const node = name => { const n = workflow.nodes.find(n => n.name === name); assert.ok(n, name); return n; };
const source = name => node(name).parameters;
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [fixtures.clock])); }
  static now() { return Date.parse(fixtures.clock); }
}
function code(name, inputs, store, json = {}, event = {}) {
  assert.equal(node(name).type, 'n8n-nodes-base.code');
  return plain(vm.runInNewContext(`(function(){\n${source(name).jsCode}\n})()`, {
    Date: Clock, $json: json, $input: {all: () => inputs.map(json => ({json}))},
    $getWorkflowStaticData: scope => { assert.equal(scope, 'global'); return store; },
    $: name => { assert.equal(name, 'Normalize event'); return {item: {json: event}}; },
  }));
}
function expression(text, json) {
  assert.ok(text.startsWith('={{') && text.endsWith('}}'), 'Expected whole n8n expression');
  return vm.runInNewContext(text.slice(3, -2).trim(), {$json: json});
}
function slack(name, json) {
  const text = source(name).text;
  assert.ok(text.startsWith('='), 'Expected Slack expression/template');
  return {channel: source(name).channelId.value, text: text.startsWith('={{')
    ? expression(text, json) : text.slice(1).replace(/{{(.*?)}}/g, (_, expr) =>
      String(vm.runInNewContext(expr.trim(), {$json: json})))};
}
function step(trace, output = 0) {
  const name = trace.at(-1), links = workflow.connections[name]?.main?.[output] ?? [];
  assert.equal(links.length, 1, `${name} output ${output}: one connection`);
  assert.equal(links[0].type, 'main'); assert.equal(links[0].index, 0);
  trace.push(links[0].node); return links[0].node;
}
function terminal(name) {
  assert.ok((workflow.connections[name]?.main ?? []).every(links => links.length === 0), `${name}: no downstream writes`);
}
function condition(group, json, operator) {
  assert.equal(group.combinator, 'and'); assert.equal(group.conditions.length, 1);
  assert.deepEqual(group.options, {caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2});
  const c = group.conditions[0]; assert.deepEqual(c.operator, operator);
  const left = expression(c.leftValue, json);
  return operator.type === 'boolean' ? left === true : left === c.rightValue;
}
function search(event, companies) {
  const body = JSON.parse(expression(source('Find HubSpot company').jsonBody, event));
  const matched = companies.filter(company => body.filterGroups.some(group => group.filters.every(filter => {
    assert.equal(filter.operator, 'EQ');
    return String(company.properties?.[filter.propertyName] ?? '') === String(filter.value);
  })));
  return {total: matched.length, results: matched.slice(0, body.limit ?? 10).map(company => ({
    id: company.id, properties: Object.fromEntries(body.properties.map(key => [key, company.properties[key] ?? null])),
  }))};
}
function branch(fixture) {
  const event = code('Normalize event', [fixtures.events[fixture.event]], {})[0].json;
  const trace = ['Normalize event']; assert.equal(step(trace), 'HIGH confidence + company?');
  const gate = condition(source(trace.at(-1)).conditions, event, {type: 'boolean', operation: 'true', singleValue: true});
  let current = step(trace, gate ? 0 : 1), result = event;
  if (gate) {
    assert.equal(current, 'Find HubSpot company');
    const response = search(event, fixture.companies);
    assert.equal(step(trace), 'Resolve CRM match');
    result = code('Resolve CRM match', [], {}, response, event).json;
    assert.equal(step(trace), 'Route');
    const hits = source('Route').rules.values.flatMap((rule, index) => {
      assert.equal(rule.renameOutput, true);
      assert.equal(rule.outputKey, rule.conditions.conditions[0].rightValue);
      return condition(rule.conditions, result, {type: 'string', operation: 'equals'}) ? [index] : [];
    });
    assert.equal(hits.length, 1, 'Exactly one Switch output'); current = step(trace, hits[0]);
  }
  if (current === 'Shape lead row') {
    const rows = code(current, [result], {}); assert.equal(rows.length, 1);
    assert.equal(step(trace), 'Append lead to sheet'); terminal(trace.at(-1));
    return {trace, row: rows[0].json};
  }
  assert.equal(current, 'Post to review channel'); terminal(current);
  return {trace, slack: slack(current, result)};
}
function digest(fixture) {
  const store = {};
  for (const delivery of fixture.deliveries) {
    code('Normalize event', Array.from({length: delivery.count}, () => fixtures.events[delivery.event]), store);
  }
  const buffer = plain(store.digest ?? []), trace = ['Every morning'];
  assert.equal(step(trace), 'Build digest');
  const items = code('Build digest', [], store), clearedBeforePost = plain(store.digest);
  const posts = [];
  if (items.length) {
    assert.equal(items.length, 1); assert.equal(step(trace), 'Post daily digest'); terminal(trace.at(-1));
    posts.push(slack(trace.at(-1), items[0].json));
  }
  return {trace, buffered: {count: buffer.length, first: buffer[0] ?? null, last: buffer.at(-1) ?? null},
    items: items.length, posts, clearedBeforePost, secondBuild: code('Build digest', [], store)};
}
let passed = 0;
const cases = [...fixtures.branches.map(f => [f, branch]), ...fixtures.digests.map(f => [f, digest])];
try {
  for (const [name, expected] of Object.entries(fixtures.config)) {
    const actual = {...source(name)}; delete actual.text; assert.deepEqual(actual, expected, `${name} configuration`);
  }
  assert.equal(node('HIGH confidence + company?').type, 'n8n-nodes-base.if');
  assert.equal(node('Route').type, 'n8n-nodes-base.switch');
  assert.deepEqual(source('HIGH confidence + company?').options, {}); assert.deepEqual(source('Route').options, {});
  for (const name of ['Post to review channel', 'Post daily digest']) assert.equal(node(name).type, 'n8n-nodes-base.slack');
  assert.equal(node('Append lead to sheet').type, 'n8n-nodes-base.googleSheets');
  for (const [fixture, run] of cases) {
    let actual;
    try { actual = run(fixture); assert.deepEqual(actual, fixture.expected); passed++; console.log(`PASS ${fixture.name}`); }
    catch (error) { console.error(`FAIL ${fixture.name}\n${JSON.stringify({expected: fixture.expected, actual, error: error.message}, null, 2)}`); }
  }
} catch (error) { console.error(`FAIL workflow configuration: ${error.message}`); }
console.log(`${passed}/${cases.length} branch cases passed`);
process.exitCode = passed === cases.length ? 0 : 1;
