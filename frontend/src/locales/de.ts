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
    purposeTooShort: 'Zweck muss mindestens 10 Zeichen haben~',
    inviteCodeRequired: 'Bitte geben Sie den Einladungscode ein~',
    emailAlreadyRegistered: 'Diese E-Mail ist bereits registriert~',
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
  }
};