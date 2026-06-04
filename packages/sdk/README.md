# @penpact/sdk

Official, fully-typed TypeScript SDK for the [Penpact](https://penpact.dev)
e-signature API — the open, embeddable DocuSign alternative. Zero runtime
dependencies; works in Node, browsers, edge runtimes, and tests (inject your
own `fetch`).

```bash
npm install @penpact/sdk
```

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });

// Create → upload → place a field → send.
const envelope = await penpact.createEnvelope({
  documentName: 'NDA',
  signers: [{ name: 'Ada Lovelace', email: 'ada@example.com' }],
});
await penpact.uploadDocument(envelope.id, pdfBytes);
const [field] = await penpact.placeFields(envelope.id, [
  { type: 'signature', signerId: envelope.signers[0].id, page: 1, x: 72, y: 600, width: 180, height: 48 },
]);
await penpact.send(envelope.id);
```

Generate a document from a template, send to many recipients, or publish a
public self-serve link:

```ts
await penpact.generateDocument({
  documentName: 'Service Agreement',
  template: '# Agreement\n\nBetween {{company}} and {{client}}.',
  variables: { company: 'Penpact', client: 'Ada' },
  signers: [{ name: 'Ada', email: 'ada@example.com' }],
});

await penpact.bulkSendTemplate(templateId, [
  { name: 'Ada', email: 'ada@example.com' },
  { name: 'Grace', email: 'grace@example.com' },
]);

const { publicUrl } = await penpact.publishTemplate(templateId);
```

Errors are typed (`PenpactError`) and carry the RFC 7807 problem details.

## Options

```ts
new PenpactClient({
  apiKey: 'pk_live_…',        // or pk_test_… for an isolated test workspace
  baseUrl: 'https://api.penpact.dev', // override for self-host
  fetch: myFetch,             // inject a fetch implementation
});
```

Idempotent retries: pass an `Idempotency-Key` header via your own `fetch`
wrapper, or rely on the API's safe-retry semantics.

## License

AGPL-3.0-only. Source: <https://github.com/penpact/penpact>.
