import type { LocaleKeys } from './zh-CN';

export const de: LocaleKeys = {
  // Common
  common: {
    loading: 'Lädt...',
    submit: 'Senden',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    back: 'Zurück',
    close: 'Schließen',
    save: 'Speichern',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    or: 'oder',
  },

  // Navigation
  nav: {
    home: 'Startseite',
    story: 'Geschichte',
    album: 'Album',
    following: 'Folge ich',
    followers: 'Follower',
    settings: 'Einstellungen',
    login: 'Anmelden',
    register: 'Registrieren',
    logout: 'Abmelden',
  },

  // Auth
  auth: {
    login: 'Anmelden',
    register: 'Registrieren',
    loginWith: {
      github: 'Mit GitHub anmelden',
      google: 'Mit Google anmelden',
      email: 'Mit E-Mail anmelden',
    },
    registerWith: {
      github: 'Mit GitHub registrieren',
      google: 'Mit Google registrieren',
      email: 'Mit E-Mail registrieren',
    },
    noAccount: 'Kein Konto? Registrieren~',
    hasAccount: 'Haben Sie ein Konto? Anmelden~',
    waitingEmail: 'Warten auf E-Mail-Bestätigung...',
    checkEmail: 'Bitte öffnen Sie Ihre E-Mail und klicken Sie auf den Anmeldelink. Diese Seite meldet Sie nach der Bestätigung automatisch an.',
    emailPlaceholder: 'E-Mail-Adresse eingeben',
    sendLoginLink: 'Anmeldelink senden',
  },

  // Register
  register: {
    username: 'Benutzername',
    email: 'Kontakt-E-Mail',
    purpose: 'Zweck (mindestens 10 Zeichen)',
    inviteCode: 'Einladungscode',
    backToMethod: 'Zurück zur Registrierungsmethode',
    submit: 'Registrieren',
  },

  // Messages
  messages: {
    loginLinkSent: 'Anmeldelink gesendet, bitte überprüfen Sie Ihre E-Mail',
    registerSuccess: 'Registrierung erfolgreich',
    registerSuccessOAuth: 'Registrierung erfolgreich, weiterleiten zur Anmeldung~',
    registerSuccessEmail: 'Registrierung erfolgreich, bitte warten Sie auf die Admin-Genehmigung~',
    accountPending: 'Konto wird überprüft~',
    accountRejected: 'Konto abgelehnt~',
    notRegistered: 'Sie haben sich noch nicht registriert~',
    emailRequired: 'Bitte geben Sie eine E-Mail ein',
    usernameRequired: 'Benutzername darf nicht leer sein~',
    emailInvalid: 'Ungültiges E-Mail-Format~',
    invalidEmail: 'Ungültiges E-Mail-Format',
    purposeTooShort: 'Zweck muss mindestens 10 Zeichen haben~',
    inviteCodeRequired: 'Bitte geben Sie den Einladungscode ein~',
    emailAlreadyRegistered: 'Diese E-Mail ist bereits registriert~',
    bindSuccess: 'Verknüpfung erfolgreich',
    alreadyBound: 'Dieses Konto ist bereits verknüpft',
    bindFailed: 'Verknüpfung fehlgeschlagen',
    bindFailedInvalidState: 'Verknüpfung fehlgeschlagen: Ungültiger Status',
    bindFailedOAuth: 'Verknüpfung fehlgeschlagen: OAuth-Authentifizierung fehlgeschlagen',
    emailAlreadyBound: 'Diese E-Mail ist bereits mit einem anderen Konto verknüpft',
    verificationEmailSent: 'Bestätigungs-E-Mail gesendet, bitte überprüfen Sie Ihr Postfach',
    cannotUnbindOnly: 'Die einzige Anmeldemethode kann nicht entfernt werden',
    unbindSuccess: 'Verknüpfung aufgehoben',
    unbindFailed: 'Verknüpfung aufheben fehlgeschlagen',
  },

  // Theme
  theme: {
    toggle: 'Theme wechseln',
    language: 'Sprache wechseln',
  },

  // Languages
  languages: {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': 'English',
    'ja': '日本語',
    'de': 'Deutsch',
  },

  // Tooltips
  tooltips: {
    githubRepo: 'Projekt-Repository anzeigen',
    languageSwitcher: 'Sprache wechseln',
    themeSwitcher: 'Theme wechseln',
  },

  // Settings
  settings: {
    title: 'Einstellungen',
    language: 'Sprache',
    avatar: 'Avatar',
    username: 'Benutzername',
    background: 'Hintergrund',
    backgroundPreview: 'Hintergrundvorschau',
    backgroundOpacity: 'Hintergrundtransparenz',
    opacity: 'Transparenz',
    default: 'Standard',
    cloudSync: 'Cloud-Sync',
    localOnly: 'Nur lokal, wird nicht hochgeladen',
    loginRequired: 'Anmeldung erforderlich',
    upload: 'Hochladen',
    uploadAvatar: 'Avatar hochladen',
    uploadBackground: 'Hintergrund hochladen',
    save: 'Speichern',
    reset: 'Zurücksetzen',
    accountBinding: 'Kontoverknüpfung',
    email: 'E-Mail',
    noEmailBound: 'Keine E-Mail verknüpft',
    bind: 'Verknüpfen',
    bindEmail: 'E-Mail verknüpfen',
    binding: 'Verknüpfen..',
    unbind: 'Aufheben',
    sendVerification: 'Bestätigungs-E-Mail senden',
    confirmUnbind: 'Verknüpfung aufheben bestätigen',
    confirmUnbindBtn: 'Verknüpfung aufheben',
    unbindWarning: 'Sind Sie sicher, dass Sie {{provider}} trennen möchten? Nach dem Trennen können Sie sich nicht mehr mit dieser Methode anmelden.',
    inviteCode: 'Einladungscode-Verwaltung',
    adminEmail: 'Admin-E-Mail',
    adminEmailDesc: 'Für den Empfang von Benachrichtigungen über neue Benutzerregistrierungen',
  },
};