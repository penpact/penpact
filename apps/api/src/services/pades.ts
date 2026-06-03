import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';

/**
 * PAdES-basic digital signature for sealed PDFs.
 *
 * Activation is a deployment input, not a code gap:
 *  - set PENPACT_SIGNING_P12_BASE64 (+ PENPACT_SIGNING_P12_PASSPHRASE) to sign with a
 *    CA-issued certificate (trusted chain), or
 *  - leave it unset to sign with a per-process self-signed certificate (valid PAdES
 *    structure, untrusted chain — fine for self-host / SES-level assurance).
 */
const SELF_SIGNED_PASSPHRASE = 'penpact';
let cachedSelfSigned: Buffer | undefined;
const signer = new SignPdf();

function selfSignedP12(): Buffer {
  if (cachedSelfSigned) {
    return cachedSelfSigned;
  }
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
  const attrs = [
    { name: 'commonName', value: 'Penpact (self-signed)' },
    { name: 'organizationName', value: 'Penpact' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], SELF_SIGNED_PASSPHRASE, {
    algorithm: '3des',
  });
  cachedSelfSigned = Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
  return cachedSelfSigned;
}

function resolveCertificate(): { p12: Buffer; passphrase: string } {
  const base64 = process.env.PENPACT_SIGNING_P12_BASE64;
  if (base64) {
    return {
      p12: Buffer.from(base64, 'base64'),
      passphrase: process.env.PENPACT_SIGNING_P12_PASSPHRASE ?? '',
    };
  }
  return { p12: selfSignedP12(), passphrase: SELF_SIGNED_PASSPHRASE };
}

/** Apply a PAdES-basic signature to a PDF and return the signed bytes. */
export async function sealPdfWithPades(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: 'Signed with Penpact',
    contactInfo: 'penpact.dev',
    name: 'Penpact',
    location: 'penpact.dev',
    subFilter: 'ETSI.CAdES.detached',
  });
  const withPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  const { p12, passphrase } = resolveCertificate();
  const signed = await signer.sign(withPlaceholder, new P12Signer(p12, { passphrase }));
  return new Uint8Array(signed);
}
