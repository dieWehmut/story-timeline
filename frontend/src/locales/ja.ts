import type { LocaleKeys } from './zh-CN';

export const ja: LocaleKeys = {
  // Common
  common: {
    loading: '読み込み中...',
    submit: '送信',
    cancel: 'キャンセル',
    confirm: '確認',
    back: '戻る',
    close: '閉じる',
    save: '保存',
    delete: '削除',
    edit: '編集',
    or: 'または',
  },

  // Navigation
  nav: {
    home: 'ホーム',
    story: 'ストーリー',
    album: 'アルバム',
    following: 'フォロー中',
    followers: 'フォロワー',
    settings: '設定',
    login: 'ログイン',
    register: '登録',
    logout: 'ログアウト',
  },

  // Auth
  auth: {
    login: 'ログイン',
    register: '登録',
    loginWith: {
      github: 'GitHubでログイン',
      google: 'Googleでログイン',
      email: 'メールでログイン',
    },
    registerWith: {
      github: 'GitHubで登録',
      google: 'Googleで登録',
      email: 'メールで登録',
    },
    noAccount: 'アカウントをお持ちでない？登録にゃ〜',
    hasAccount: 'アカウントをお持ち？ログインにゃ〜',
    waitingEmail: 'メール確認を待機中...',
    checkEmail: 'メールボックスを開いて、ログインリンクをクリックして確認してください。確認後、このページに自動的にログインします。',
    emailPlaceholder: 'メールアドレスを入力',
    sendLoginLink: 'ログインリンクを送信',
  },

  // Register
  register: {
    username: 'ユーザー名',
    email: '連絡先メール',
    purpose: '目的（10文字以上）',
    inviteCode: '招待コード',
    backToMethod: '登録方法選択に戻る',
    submit: '登録',
  },

  // Messages
  messages: {
    loginLinkSent: 'ログインリンクを送信しました。メールをご確認ください',
    registerSuccess: '登録が完了しました',
    registerSuccessOAuth: '登録成功、ログインにリダイレクト中にゃ〜',
    registerSuccessEmail: '登録成功、管理者の承認をお待ちくださいにゃ〜',
    accountPending: 'アカウント審査中にゃ〜',
    accountRejected: 'アカウントが拒否されましたにゃ〜',
    notRegistered: 'まだ登録されていませんにゃ〜',
    emailRequired: 'メールアドレスを入力してください',
    usernameRequired: 'ユーザー名は空にできませんにゃ〜',
    emailInvalid: 'メール形式が正しくありませんにゃ〜',
    purposeTooShort: '目的は10文字以上で入力してくださいにゃ〜',
    inviteCodeRequired: '招待コードを入力してくださいにゃ〜',
    emailAlreadyRegistered: 'このメールアドレスは既に登録されていますにゃ〜',
  },

  // Theme
  theme: {
    toggle: 'テーマ切り替え',
    language: '言語切り替え',
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
    githubRepo: 'プロジェクトリポジトリを表示',
    languageSwitcher: '言語切り替え',
    themeSwitcher: 'テーマ切り替え',
  }
};