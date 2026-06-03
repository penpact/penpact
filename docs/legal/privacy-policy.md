# Privacy Policy

> **DRAFT — NOT LEGAL ADVICE.** Engineering draft for the Penpact cloud service; have a licensed
> attorney review before relying on it. Entity name and jurisdiction are placeholders.

**Last updated:** 2026-06-03 · **Effective:** [DATE]

## 1. Who we are

[LEGAL ENTITY] ("Penpact") operates the hosted Penpact e-signature service. For personal data
processed on behalf of our business customers, the customer is the **controller** and Penpact is
the **processor** (see the [DPA](dpa.md)). For personal data about our own account holders and
website visitors, Penpact is the controller.

## 2. Data we process

- **Account data:** name, email, hashed API-key material, billing details.
- **Envelope & signer data (Customer Data):** documents, signer names/emails, signature values,
  and — to prove a valid signature — an audit trail: timestamps, IP address, user agent, approximate
  geolocation, consent records, and device hints.
- **Usage & technical data:** logs, request metadata, and diagnostics.

We collect signer attribution data specifically to establish **intent, consent, attribution, and
integrity** as required by e-signature law (US ESIGN/UETA, EU eIDAS SES).

## 3. How we use it

To provide and secure the Service, capture legally-relevant signing evidence, prevent abuse, comply
with law, and communicate with account holders. We do **not** sell personal data and do not use
Customer Data to train models.

## 4. Legal bases (GDPR)

Contract performance (providing the Service), legitimate interests (security, fraud prevention,
service improvement), legal obligation, and — where required — consent (e.g. the electronic-records
consent a signer accepts before signing).

## 5. Sharing & subprocessors

We share data with infrastructure subprocessors strictly to run the Service (e.g. cloud hosting,
managed Postgres, object storage, email delivery, and — when AI field-detection is used — Anthropic
for processing the uploaded document). A current subprocessor list is available on request and in
the [DPA](dpa.md). We may disclose data if required by law.

## 6. Retention

Envelope records and their audit trail are retained for the period needed to provide the Service and
to preserve signing evidence (and any legally required period), then deleted or anonymized. Account
data is retained for the life of the account plus any required period.

## 7. Security

Encryption in transit; access controls; API keys stored only as hashes; immutable, append-only audit
logs; object-lock retention for documents. No method is perfectly secure, but we maintain reasonable
technical and organizational measures.

## 8. International transfers

Where personal data is transferred across borders, we rely on appropriate safeguards (e.g. EU
Standard Contractual Clauses). EU customers can choose EU-region hosting where offered.

## 9. Your rights

Subject to law, individuals may request access, correction, deletion, portability, or restriction.
For Customer Data, direct requests to the relevant customer (controller); we assist as processor.
Contact **privacy@penpact.dev** (alias to be provisioned) or **hello@penpact.dev**.

## 10. Children

The Service is not directed to children and is intended for business use.

## 11. Changes & contact

We will post updates here and notify of material changes. Contact: **hello@penpact.dev**;
security issues: **security@penpact.dev**.
