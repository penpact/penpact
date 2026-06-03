/**
 * Lightweight i18n for signer-facing surfaces (hosted signing page + emails).
 * Legal text (the ESIGN/UETA consent disclosure) stays in English by design —
 * only the surrounding chrome is localized. The same dictionary is shipped to
 * the browser by the sign page, so keep it serializable.
 */
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(input: string | null | undefined): Locale {
  const base = (input ?? 'en').slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as Locale) : 'en';
}

export interface Strings {
  document: string;
  beforeYouSign: string;
  consentIntro: string;
  consentAgree: string;
  continue: string;
  adoptSignature: string;
  adoptHint: string;
  fullName: string;
  signatureLabel: string;
  type: string;
  draw: string;
  clear: string;
  signButton: string;
  declineButton: string;
  signing: string;
  legalLine: string;
  verifyTitle: string;
  verifyOtpHint: string;
  verifyCodeHint: string;
  verify: string;
  codePlaceholder: string;
  accessPlaceholder: string;
  poweredBy: string;
  // emails
  emailInviteSubject: string; // {doc}
  emailInviteIntro: string; // {name}
  emailInviteBody: string; // {doc}
  emailInviteCta: string;
  emailInviteIgnore: string;
  emailOtpSubject: string; // {code}
  emailOtpIntro: string; // {name}
  emailOtpBody: string;
  emailOtpExpiry: string;
}

const en: Strings = {
  document: 'Document',
  beforeYouSign: 'Before you sign',
  consentIntro:
    'Federal law (the U.S. ESIGN Act) requires your consent to do business electronically.',
  consentAgree: 'I consent to use electronic records and signatures for this document.',
  continue: 'Continue',
  adoptSignature: 'Adopt your signature',
  adoptHint: 'Type your full legal name, then type or draw your signature.',
  fullName: 'Full name',
  signatureLabel: 'Signature',
  type: 'Type',
  draw: 'Draw',
  clear: 'Clear',
  signButton: 'Sign document',
  declineButton: 'Decline to sign',
  signing: 'Signing…',
  legalLine:
    'By clicking Sign document, you agree that this typed name is your signature on this document and is as legally binding as a handwritten one.',
  verifyTitle: 'Verify your identity',
  verifyOtpHint: 'We emailed a one-time code to {email}. Enter it to continue.',
  verifyCodeHint: 'This document is protected. Enter the access code the sender gave you.',
  verify: 'Verify',
  codePlaceholder: '6-digit code',
  accessPlaceholder: 'Access code',
  poweredBy: 'Secured by Penpact',
  emailInviteSubject: 'Please sign: {doc}',
  emailInviteIntro: 'Hi {name},',
  emailInviteBody: '{doc} is ready for your signature.',
  emailInviteCta: 'Review & sign the document',
  emailInviteIgnore: 'If you did not expect this, you can ignore this email.',
  emailOtpSubject: 'Your signing verification code: {code}',
  emailOtpIntro: 'Hi {name},',
  emailOtpBody: 'Use this one-time code to verify your identity and continue signing:',
  emailOtpExpiry: 'This code expires in 10 minutes. If you did not request it, ignore this email.',
};

const es: Strings = {
  document: 'Documento',
  beforeYouSign: 'Antes de firmar',
  consentIntro:
    'La ley federal de EE. UU. (ESIGN Act) exige su consentimiento para realizar trámites de forma electrónica.',
  consentAgree:
    'Doy mi consentimiento para usar registros y firmas electrónicas en este documento.',
  continue: 'Continuar',
  adoptSignature: 'Adopte su firma',
  adoptHint: 'Escriba su nombre legal completo y luego escriba o dibuje su firma.',
  fullName: 'Nombre completo',
  signatureLabel: 'Firma',
  type: 'Escribir',
  draw: 'Dibujar',
  clear: 'Borrar',
  signButton: 'Firmar documento',
  declineButton: 'Rechazar la firma',
  signing: 'Firmando…',
  legalLine:
    'Al hacer clic en Firmar documento, acepta que este nombre escrito es su firma en este documento y tiene la misma validez legal que una firma manuscrita.',
  verifyTitle: 'Verifique su identidad',
  verifyOtpHint: 'Enviamos un código de un solo uso a {email}. Introdúzcalo para continuar.',
  verifyCodeHint:
    'Este documento está protegido. Introduzca el código de acceso que le dio el remitente.',
  verify: 'Verificar',
  codePlaceholder: 'Código de 6 dígitos',
  accessPlaceholder: 'Código de acceso',
  poweredBy: 'Protegido por Penpact',
  emailInviteSubject: 'Por favor, firme: {doc}',
  emailInviteIntro: 'Hola {name}:',
  emailInviteBody: '{doc} está listo para su firma.',
  emailInviteCta: 'Revisar y firmar el documento',
  emailInviteIgnore: 'Si no esperaba esto, puede ignorar este correo.',
  emailOtpSubject: 'Su código de verificación de firma: {code}',
  emailOtpIntro: 'Hola {name}:',
  emailOtpBody: 'Use este código de un solo uso para verificar su identidad y continuar firmando:',
  emailOtpExpiry: 'Este código caduca en 10 minutos. Si no lo solicitó, ignore este correo.',
};

const fr: Strings = {
  document: 'Document',
  beforeYouSign: 'Avant de signer',
  consentIntro:
    'La loi fédérale américaine (ESIGN Act) exige votre consentement pour effectuer des démarches par voie électronique.',
  consentAgree:
    "J'accepte d'utiliser des enregistrements et des signatures électroniques pour ce document.",
  continue: 'Continuer',
  adoptSignature: 'Adoptez votre signature',
  adoptHint: 'Saisissez votre nom légal complet, puis tapez ou dessinez votre signature.',
  fullName: 'Nom complet',
  signatureLabel: 'Signature',
  type: 'Saisir',
  draw: 'Dessiner',
  clear: 'Effacer',
  signButton: 'Signer le document',
  declineButton: 'Refuser de signer',
  signing: 'Signature…',
  legalLine:
    'En cliquant sur Signer le document, vous acceptez que ce nom saisi soit votre signature sur ce document et ait la même valeur juridique qu’une signature manuscrite.',
  verifyTitle: 'Vérifiez votre identité',
  verifyOtpHint: 'Nous avons envoyé un code à usage unique à {email}. Saisissez-le pour continuer.',
  verifyCodeHint: "Ce document est protégé. Saisissez le code d'accès fourni par l'expéditeur.",
  verify: 'Vérifier',
  codePlaceholder: 'Code à 6 chiffres',
  accessPlaceholder: "Code d'accès",
  poweredBy: 'Sécurisé par Penpact',
  emailInviteSubject: 'Veuillez signer : {doc}',
  emailInviteIntro: 'Bonjour {name},',
  emailInviteBody: '{doc} est prêt pour votre signature.',
  emailInviteCta: 'Consulter et signer le document',
  emailInviteIgnore: 'Si vous ne vous attendiez pas à cela, vous pouvez ignorer cet e-mail.',
  emailOtpSubject: 'Votre code de vérification de signature : {code}',
  emailOtpIntro: 'Bonjour {name},',
  emailOtpBody:
    'Utilisez ce code à usage unique pour vérifier votre identité et continuer la signature :',
  emailOtpExpiry:
    'Ce code expire dans 10 minutes. Si vous ne l’avez pas demandé, ignorez cet e-mail.',
};

const de: Strings = {
  document: 'Dokument',
  beforeYouSign: 'Vor der Unterschrift',
  consentIntro:
    'Das US-Bundesgesetz (ESIGN Act) verlangt Ihre Zustimmung, um Geschäfte elektronisch abzuwickeln.',
  consentAgree:
    'Ich stimme der Verwendung elektronischer Aufzeichnungen und Signaturen für dieses Dokument zu.',
  continue: 'Weiter',
  adoptSignature: 'Übernehmen Sie Ihre Unterschrift',
  adoptHint:
    'Geben Sie Ihren vollständigen rechtlichen Namen ein und tippen oder zeichnen Sie dann Ihre Unterschrift.',
  fullName: 'Vollständiger Name',
  signatureLabel: 'Unterschrift',
  type: 'Tippen',
  draw: 'Zeichnen',
  clear: 'Löschen',
  signButton: 'Dokument unterschreiben',
  declineButton: 'Unterschrift ablehnen',
  signing: 'Wird unterschrieben…',
  legalLine:
    'Indem Sie auf „Dokument unterschreiben“ klicken, stimmen Sie zu, dass dieser eingegebene Name Ihre Unterschrift auf diesem Dokument ist und rechtlich ebenso bindend wie eine handschriftliche Unterschrift.',
  verifyTitle: 'Bestätigen Sie Ihre Identität',
  verifyOtpHint:
    'Wir haben einen Einmalcode an {email} gesendet. Geben Sie ihn ein, um fortzufahren.',
  verifyCodeHint:
    'Dieses Dokument ist geschützt. Geben Sie den vom Absender bereitgestellten Zugangscode ein.',
  verify: 'Bestätigen',
  codePlaceholder: '6-stelliger Code',
  accessPlaceholder: 'Zugangscode',
  poweredBy: 'Gesichert durch Penpact',
  emailInviteSubject: 'Bitte unterschreiben: {doc}',
  emailInviteIntro: 'Hallo {name},',
  emailInviteBody: '{doc} ist bereit für Ihre Unterschrift.',
  emailInviteCta: 'Dokument prüfen und unterschreiben',
  emailInviteIgnore: 'Wenn Sie dies nicht erwartet haben, können Sie diese E-Mail ignorieren.',
  emailOtpSubject: 'Ihr Bestätigungscode für die Unterschrift: {code}',
  emailOtpIntro: 'Hallo {name},',
  emailOtpBody:
    'Verwenden Sie diesen Einmalcode, um Ihre Identität zu bestätigen und fortzufahren:',
  emailOtpExpiry:
    'Dieser Code läuft in 10 Minuten ab. Falls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail.',
};

export const TRANSLATIONS: Record<Locale, Strings> = { en, es, fr, de };

export function strings(locale: string | null | undefined): Strings {
  return TRANSLATIONS[normalizeLocale(locale)];
}

/** Replace {placeholders} in a translated string. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
