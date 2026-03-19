import type { LocaleKeys } from './zh-CN';

export const zhTW: LocaleKeys = {
  // Common
  common: {
    loading: '載入中...',
    submit: '提交',
    cancel: '取消',
    confirm: '確認',
    back: '返回',
    close: '關閉',
    save: '保存',
    delete: '刪除',
    edit: '編輯',
    or: 'or',
  },

  // Navigation
  nav: {
    home: '主頁',
    story: '物語',
    album: '相冊',
    following: '關注',
    followers: '粉絲',
    settings: '設置',
    login: '登入',
    register: '註冊',
    logout: '退出登入',
  },

  // Auth
  auth: {
    login: '登入',
    register: '註冊',
    loginWith: {
      github: '使用GitHub登入',
      google: '使用Google登入',
      email: '使用郵箱登入',
    },
    registerWith: {
      github: '使用GitHub註冊',
      google: '使用Google註冊',
      email: '使用郵箱註冊',
    },
    noAccount: '沒有帳戶？註冊喵~',
    hasAccount: '已有帳戶？登入喵~',
    waitingEmail: '等待郵件確認中..',
    checkEmail: '請打開郵箱，點擊登入鏈接確認。確認後此頁面會自動登入。',
    emailPlaceholder: '輸入郵箱地址',
    sendLoginLink: '發送登入鏈接',
  },

  // Register
  register: {
    username: '用戶名',
    email: '聯繫郵箱',
    purpose: '來意（至少10個字）',
    inviteCode: '邀請碼',
    backToMethod: '返回選擇註冊方式',
    submit: '註冊',
  },

  // Messages
  messages: {
    loginLinkSent: '登入鏈接已發送，請檢查郵箱',
    registerSuccess: '註冊成功',
    registerSuccessOAuth: '註冊成功，即將跳轉登入喵~',
    registerSuccessEmail: '註冊成功，請等待管理員審核喵~',
    accountPending: '帳號審核中喵~',
    accountRejected: '帳號審核未通過喵~',
    notRegistered: '你還沒有註冊過喵~',
    emailRequired: '請輸入郵箱',
    usernameRequired: '用戶名不能為空喵~',
    emailInvalid: '郵箱不正確喵~',
    invalidEmail: '郵箱格式不正確',
    purposeTooShort: '來意不能少於10個字喵~',
    inviteCodeRequired: '請填寫邀請碼喵~',
    emailAlreadyRegistered: '該郵箱已註冊過啦喵~',
    bindSuccess: '綁定成功',
    alreadyBound: '該帳號已綁定',
    bindFailed: '綁定失敗',
    bindFailedInvalidState: '綁定失敗：無效的狀態',
    bindFailedOAuth: '綁定失敗：OAuth 認證失敗',
    emailAlreadyBound: '該郵箱已被其他帳戶綁定',
    verificationEmailSent: '驗證郵件已發送，請查收郵箱',
    cannotUnbindOnly: '不能解綁唯一的登入方式',
    unbindSuccess: '解綁成功',
    unbindFailed: '解綁失敗',
  },

  // Theme
  theme: {
    toggle: '切換主題',
    language: '語言切換',
  },

  // Languages
  languages: {
    'zh-CN': '簡體中文',
    'zh-TW': '繁體中文',
    'en': 'English',
    'ja': '日本語',
    'de': 'Deutsch',
  },

  // Tooltips
  tooltips: {
    githubRepo: '查看項目倉庫',
    languageSwitcher: '語言切換',
    themeSwitcher: '切換主題',
  },

  // Settings
  settings: {
    title: '設置',
    language: '語言',
    avatar: '頭像',
    username: '用戶名',
    background: '背景',
    backgroundPreview: '背景預覽',
    backgroundOpacity: '背景透明度',
    opacity: '透明度',
    default: '預設',
    cloudSync: '雲端同步',
    localOnly: '僅本地存儲，不會上傳',
    loginRequired: '登入後可設置',
    upload: '上傳',
    uploadAvatar: '上傳頭像',
    uploadBackground: '上傳背景',
    save: '保存',
    reset: '恢復',
    accountBinding: '帳號綁定',
    email: '郵箱',
    noEmailBound: '未綁定郵箱',
    bind: '綁定',
    bindEmail: '綁定郵箱',
    binding: '綁定中..',
    unbind: '解綁',
    sendVerification: '發送驗證郵件',
    confirmUnbind: '確認解綁',
    confirmUnbindBtn: '確認解綁',
    unbindWarning: '確定要解綁 {{provider}} 嗎？解綁後將無法使用此方式登入。',
    inviteCode: '邀請碼管理',
    adminEmail: '管理員郵箱',
    adminEmailDesc: '用於接收新用戶註冊通知',
  },
};