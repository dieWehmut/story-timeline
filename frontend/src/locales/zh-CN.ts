export const zhCN = {
  // Common
  common: {
    loading: '加载中...',
    submit: '提交',
    cancel: '取消',
    confirm: '确认',
    back: '返回',
    close: '关闭',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    or: 'or',
  },

  // Navigation
  nav: {
    home: '主页',
    story: '物语',
    album: '相册',
    following: '关注',
    followers: '粉丝',
    settings: '设置',
    login: '登录',
    register: '注册',
    logout: '退出登录',
  },

  // Auth
  auth: {
    login: '登录',
    register: '注册',
    loginWith: {
      github: '使用GitHub登录',
      google: '使用Google登录',
      email: '使用邮箱登录',
    },
    registerWith: {
      github: '使用GitHub注册',
      google: '使用Google注册',
      email: '使用邮箱注册',
    },
    noAccount: '没有账户？注册喵~',
    hasAccount: '已有账户？登录喵~',
    waitingEmail: '等待邮件确认中..',
    checkEmail: '请打开邮箱，点击登录链接确认。确认后此页面会自动登录。',
    emailPlaceholder: '输入邮箱地址',
    sendLoginLink: '发送登录链接',
  },

  // Register
  register: {
    username: '用户名',
    email: '联系邮箱',
    purpose: '来意（至少10个字）',
    inviteCode: '邀请码',
    backToMethod: '返回选择注册方式',
    submit: '注册',
  },

  // Messages
  messages: {
    loginLinkSent: '登录链接已发送，请检查邮箱',
    registerSuccess: '注册成功',
    registerSuccessOAuth: '注册成功，即将跳转登录喵~',
    registerSuccessEmail: '注册成功，请等待管理员审核喵~',
    accountPending: '账号审核中喵~',
    accountRejected: '账号审核未通过喵~',
    notRegistered: '你还没有注册过喵~',
    emailRequired: '请输入邮箱',
    usernameRequired: '用户名不能为空喵~',
    emailInvalid: '邮箱不正确喵~',
    invalidEmail: '邮箱格式不正确',
    purposeTooShort: '来意不能少于10个字喵~',
    inviteCodeRequired: '请填写邀请码喵~',
    emailAlreadyRegistered: '该邮箱已注册过啦喵~',
    bindSuccess: '绑定成功',
    alreadyBound: '该账号已绑定',
    bindFailed: '绑定失败',
    bindFailedInvalidState: '绑定失败：无效的状态',
    bindFailedOAuth: '绑定失败：OAuth 认证失败',
    emailAlreadyBound: '该邮箱已被其他账户绑定',
    verificationEmailSent: '验证邮件已发送，请查收邮箱',
    cannotUnbindOnly: '不能解绑唯一的登录方式',
    unbindSuccess: '解绑成功',
    unbindFailed: '解绑失败',
  },

  // Theme
  theme: {
    toggle: '切换主题',
    language: '语言切换',
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
    githubRepo: '查看项目仓库',
    languageSwitcher: '语言切换',
    themeSwitcher: '切换主题',
  },

  // Settings
  settings: {
    title: '设置',
    language: '语言',
    avatar: '头像',
    username: '用户名',
    background: '背景',
    backgroundPreview: '背景预览',
    backgroundOpacity: '背景透明度',
    opacity: '透明度',
    default: '默认',
    cloudSync: '云端同步',
    localOnly: '仅本地存储，不会上传',
    loginRequired: '登录后可设置',
    upload: '上传',
    uploadAvatar: '上传头像',
    uploadBackground: '上传背景',
    save: '保存',
    reset: '恢复',
    accountBinding: '账号绑定',
    email: '邮箱',
    noEmailBound: '未绑定邮箱',
    bind: '绑定',
    bindEmail: '绑定邮箱',
    binding: '绑定中..',
    unbind: '解绑',
    sendVerification: '发送验证邮件',
    confirmUnbind: '确认解绑',
    confirmUnbindBtn: '确认解绑',
    unbindWarning: '确定要解绑 {{provider}} 吗？解绑后将无法使用此方式登录。',
    inviteCode: '邀请码管理',
    adminEmail: '管理员邮箱',
    adminEmailDesc: '用于接收新用户注册通知',
  },
};

export type LocaleKeys = typeof zhCN;