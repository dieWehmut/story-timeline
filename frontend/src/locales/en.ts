import type { LocaleKeys } from './zh-CN';

export const en: LocaleKeys = {
  // Common
  common: {
    loading: 'Loading...',
    submit: 'Submit',
    cancel: 'Cancel',
    confirm: 'Confirm',
    back: 'Back',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    or: 'or',
  },

  // Navigation
  nav: {
    home: 'Home',
    story: 'Story',
    album: 'Album',
    following: 'Following',
    followers: 'Followers',
    settings: 'Settings',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
  },

  // Auth
  auth: {
    login: 'Login',
    register: 'Register',
    loginWith: {
      github: 'Login with GitHub',
      google: 'Login with Google',
      email: 'Login with Email',
    },
    registerWith: {
      github: 'Register with GitHub',
      google: 'Register with Google',
      email: 'Register with Email',
    },
    noAccount: 'No account? Register~',
    hasAccount: 'Have an account? Login~',
    waitingEmail: 'Waiting for email confirmation...',
    checkEmail: 'Please check your email and click the login link. This page will automatically log you in after confirmation.',
    emailPlaceholder: 'Enter email address',
    sendLoginLink: 'Send login link',
  },

  // Register
  register: {
    username: 'Username',
    email: 'Contact Email',
    purpose: 'Purpose (at least 10 characters)',
    inviteCode: 'Invite Code',
    backToMethod: 'Back to registration method',
    submit: 'Register',
  },

  // Messages
  messages: {
    loginLinkSent: 'Login link sent, please check your email',
    registerSuccess: 'Registration successful',
    registerSuccessOAuth: 'Registration successful, redirecting to login~',
    registerSuccessEmail: 'Registration successful, please wait for admin approval~',
    accountPending: 'Account under review~',
    accountRejected: 'Account rejected~',
    notRegistered: 'You haven\'t registered yet~',
    emailRequired: 'Please enter email',
    usernameRequired: 'Username cannot be empty~',
    emailInvalid: 'Invalid email format~',
    purposeTooShort: 'Purpose must be at least 10 characters~',
    inviteCodeRequired: 'Please enter invite code~',
    emailAlreadyRegistered: 'This email is already registered~',
  },

  // Theme
  theme: {
    toggle: 'Toggle theme',
    language: 'Language switcher',
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
    githubRepo: 'View project repository',
    languageSwitcher: 'Language switcher',
    themeSwitcher: 'Toggle theme',
  }
};