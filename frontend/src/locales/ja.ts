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
    invalidEmail: 'メール形式が正しくありません',
    purposeTooShort: '目的は10文字以上で入力してくださいにゃ〜',
    inviteCodeRequired: '招待コードを入力してくださいにゃ〜',
    emailAlreadyRegistered: 'このメールアドレスは既に登録されていますにゃ〜',
    bindSuccess: '連携成功',
    alreadyBound: 'このアカウントは既に連携されています',
    bindFailed: '連携失敗',
    bindFailedInvalidState: '連携失敗：無効な状態',
    bindFailedOAuth: '連携失敗：OAuth認証に失敗しました',
    emailAlreadyBound: 'このメールアドレスは他のアカウントに連携されています',
    verificationEmailSent: '確認メールを送信しました。メールをご確認ください',
    cannotUnbindOnly: '唯一のログイン方法を解除することはできません',
    unbindSuccess: '連携解除成功',
    unbindFailed: '連携解除失敗',
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
  },

  // Settings
  settings: {
    title: '設定',
    language: '言語',
    avatar: 'アバター',
    username: 'ユーザー名',
    background: '背景',
    backgroundPreview: '背景プレビュー',
    backgroundOpacity: '背景の透明度',
    opacity: '透明度',
    default: 'デフォルト',
    cloudSync: 'クラウド同期',
    localOnly: 'ローカルのみ、アップロードされません',
    loginRequired: '設定するにはログインが必要です',
    upload: 'アップロード',
    uploadAvatar: 'アバターをアップロード',
    uploadBackground: '背景をアップロード',
    save: '保存',
    reset: 'リセット',
    accountBinding: 'アカウント連携',
    email: 'メール',
    noEmailBound: 'メールが連携されていません',
    bind: '連携',
    bindEmail: 'メールを連携',
    binding: '連携中..',
    unbind: '解除',
    sendVerification: '確認メールを送信',
    confirmUnbind: '連携解除の確認',
    confirmUnbindBtn: '連携解除',
    unbindWarning: '{{provider}}の連携を解除してもよろしいですか？解除後はこの方法でログインできなくなります。',
    inviteCode: '招待コード管理',
    adminEmail: '管理者メール',
    adminEmailDesc: '新規ユーザー登録通知の受信用',
  },
};