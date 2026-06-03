import { sha256Hex } from './lib/crypto.js';

/**
 * ESIGN §7001(c) Electronic Record and Signature Disclosure.
 *
 * DRAFT — must be reviewed by a lawyer before GA (PLAN §8). Versioned: any wording
 * change MUST bump `version`, which produces a new `hash`. We store the exact text
 * shown and its hash against each signer's consent so we can prove what they agreed to.
 */
const DISCLOSURE_TEXT = `ELECTRONIC RECORD AND SIGNATURE DISCLOSURE

By selecting "I agree", you consent to use electronic records and electronic signatures
in connection with this document, and you confirm that:

1. Legal effect. Your electronic signature is legally binding and has the same effect
   as a handwritten signature, under the U.S. ESIGN Act, UETA, and (where applicable)
   the EU eIDAS Regulation.

2. Paper copies. You may request a paper copy of any record. You may also download and
   retain a copy of the signed document and its Certificate of Completion.

3. Withdrawing consent. You may withdraw your consent to use electronic records at any
   time before completing your signature by declining to sign.

4. Hardware and software. To access and retain these records you need a current web
   browser, an internet connection, and the ability to view and save PDF files.

5. Scope. This consent applies to the documents presented to you in this signing session.`;

export const CONSENT_DISCLOSURE = {
  version: '2026-06-01',
  text: DISCLOSURE_TEXT,
  hash: sha256Hex(DISCLOSURE_TEXT),
} as const;
