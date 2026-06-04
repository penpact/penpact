---
title: "Are electronic signatures legally binding? ESIGN, UETA, eIDAS"
description: "Electronic signatures are legally binding in the US and EU when four elements are met. A developer's guide to ESIGN, UETA, and eIDAS, and what your app must capture."
slug: are-electronic-signatures-legally-binding
excerpt: "Yes, in the US and EU, when four elements are present. What ESIGN, UETA, and eIDAS actually require, and the audit trail your app needs to make a signature hold up."
author: "Penpact Team"
publishedAt: "2026-06-04"
updatedAt: "2026-06-04"
category: "Compliance"
keywords: [are electronic signatures legally binding, esign act, ueta, eidas, electronic signature law, e-signature compliance]
---

# Are electronic signatures legally binding? ESIGN, UETA & eIDAS for developers

Yes. Electronic signatures are legally binding in the United States and the European Union, and have been for over two decades, provided the signing process captures the right evidence. In the US, the ESIGN Act (2000) and UETA (1999) give a compliant electronic signature the same legal effect as a handwritten one. In the EU, the eIDAS Regulation (EU 910/2014) recognizes electronic signatures and forbids denying them legal effect solely because they are electronic. The catch is the word "compliant": the law cares less about the pixels of the signature and more about whether you can prove who signed, that they meant to, that they agreed to sign electronically, and that the document was not changed afterward. This guide explains what each law requires and what your application has to record.

## What makes an electronic signature legally binding?

An electronic signature is legally binding when four elements are present: intent to sign, consent to do business electronically, attribution of the signature to a specific person, and integrity of the signed record. These are not arbitrary; they map to what a court needs to enforce an agreement. Intent shows the person chose to sign. Consent shows they agreed to use electronic records instead of paper. Attribution links the signature to an identifiable signer through evidence such as email and IP. Integrity proves the document presented in court is the one that was signed. Miss one, and the signature gets weaker, not necessarily void, but easier to challenge.

## What does the US ESIGN Act require?

The ESIGN Act (15 U.S.C. §7001) is the US federal law that makes electronic signatures and records valid across interstate commerce. Its core rule is simple: a signature, contract, or record may not be denied legal effect just because it is in electronic form. For transactions with consumers, ESIGN adds a specific consent requirement: before you can use electronic records in place of paper, the consumer must affirmatively consent, and you must disclose their right to a paper copy and the hardware and software needed to access the records (§7001(c)). In practice this means your app should show a clear electronic-records disclosure and record that the signer agreed to it before they sign.

## How is UETA different from ESIGN?

UETA (the Uniform Electronic Transactions Act, 1999) is the state-level companion to ESIGN, adopted by nearly every US state. The two overlap heavily; the practical relationship is that UETA governs at the state level and ESIGN fills the gaps and covers interstate commerce. UETA also articulates the attribution principle clearly: an electronic signature is attributable to a person if it was the act of that person, which can be shown by "the efficacy of any security procedure applied." Translation for developers: the audit trail you keep, the link you sent, the IP and timestamp you logged, is the security procedure that attributes the signature. Build that trail and you are doing what UETA asks.

## What about the EU and eIDAS?

In the European Union, the eIDAS Regulation (EU 910/2014) governs electronic signatures and defines three tiers. A **simple electronic signature (SES)** is data in electronic form used to sign, which covers most everyday agreements. An **advanced electronic signature (AES)** adds a stronger link to the signer and tamper-evidence. A **qualified electronic signature (QES)** is created with a qualified certificate on a qualified device and, under eIDAS, carries the same legal effect as a handwritten signature across the EU. Crucially, eIDAS states that a signature cannot be denied legal effect merely for being electronic or for not being qualified. So an SES is valid and useful for the large majority of contracts; QES is reserved for cases where law or counterparty demands the highest assurance.

## When do you need a qualified signature (QES)?

You need a qualified electronic signature only when a law or a specific counterparty requires it, not for everyday business. Most B2B and B2C agreements, NDAs, order forms, statements of work, consent forms, are well served by a simple or advanced electronic signature with a solid audit trail. QES becomes relevant for certain regulated documents in some EU member states, or when a counterparty contractually insists on it. The practical advice: ship simple electronic signatures with strong evidence first, and reach for AES or QES only when a real requirement appears. Adding QES later is a provider choice, not a rewrite of your app.

## What does your app actually have to capture?

To make a signature hold up, your application (or the API behind it) must record four things, ideally automatically:

- **Intent and the signature act.** The moment and method the signer used (typed, drawn, or adopted) and what they signed.
- **Electronic-records consent.** The exact disclosure shown and a record that the signer agreed, with version and timestamp.
- **Attribution.** Signer email, IP address, user agent, and the time of each step, tied to the unique signing link.
- **Integrity.** A cryptographic hash of the final document, and ideally a digital signature on the PDF (PAdES), so any later change is detectable.

A developer-first e-signature API gives you all four out of the box. [Penpact](/e-signature-api), for example, captures intent, ESIGN-style consent, attribution by email and IP, and integrity through a SHA-256 hash plus a PAdES digital signature, then bundles the evidence into a Certificate of Completion. That certificate is what you keep alongside the sealed PDF.

## The short version for builders

Electronic signatures are legally binding in the US and EU when your process proves intent, consent, attribution, and integrity. ESIGN and UETA cover the US; eIDAS covers the EU with SES, AES, and QES tiers. For almost everything you will build, a simple electronic signature with a real audit trail is both valid and sufficient. Use an API that records the evidence for you, store the certificate, and you have a signature that stands up. This article is a developer's overview, not legal advice; for high-stakes or regulated documents, confirm the requirements with a qualified lawyer in the relevant jurisdiction.

## Related reading

- [How to add e-signatures to your app](/blog/how-to-add-e-signatures-to-your-app)
- [E-signature API: how to add electronic signatures](/e-signature-api)
- [Open-source DocuSign alternative](/open-source-docusign-alternative)

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Are electronic signatures legally binding? ESIGN, UETA & eIDAS for developers",
  "description": "Electronic signatures are legally binding in the US and EU when four elements are met. A developer's guide to ESIGN, UETA, and eIDAS, and what your app must capture.",
  "author": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "publisher": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev", "logo": { "@type": "ImageObject", "url": "https://penpact.dev/favicon.svg" } },
  "datePublished": "2026-06-04",
  "dateModified": "2026-06-04",
  "mainEntityOfPage": "https://penpact.dev/blog/are-electronic-signatures-legally-binding",
  "keywords": "are electronic signatures legally binding, ESIGN Act, UETA, eIDAS, electronic signature law"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Are electronic signatures legally binding?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Electronic signatures are legally binding in the United States and the European Union when the process captures intent to sign, consent to do business electronically, attribution to the signer, and integrity of the record. In the US the ESIGN Act and UETA apply; in the EU, the eIDAS Regulation applies." }
    },
    {
      "@type": "Question",
      "name": "What does the ESIGN Act require for electronic signatures?",
      "acceptedAnswer": { "@type": "Answer", "text": "The ESIGN Act (15 U.S.C. §7001) says a signature or record cannot be denied legal effect merely for being electronic. For consumer transactions, it requires the consumer to affirmatively consent to electronic records and to be told of their right to a paper copy and the hardware and software needed to access the records." }
    },
    {
      "@type": "Question",
      "name": "Do you need a qualified electronic signature (QES)?",
      "acceptedAnswer": { "@type": "Answer", "text": "Only when a law or a specific counterparty requires it. Under the EU eIDAS Regulation, a simple electronic signature (SES) with a solid audit trail is valid for the large majority of agreements. QES, created with a qualified certificate, is reserved for the highest-assurance cases." }
    },
    {
      "@type": "Question",
      "name": "What does an app need to record to make an e-signature defensible?",
      "acceptedAnswer": { "@type": "Answer", "text": "Four things: the signature act and intent, recorded electronic-records consent with a timestamp, attribution data such as email and IP, and integrity via a cryptographic hash and ideally a PAdES digital signature on the final PDF. Bundling these into a Certificate of Completion is the standard way to keep the evidence." }
    }
  ]
}
</script>
