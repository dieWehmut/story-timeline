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
    purposeTooShort: '来意不能少于10个字喵~',
    inviteCodeRequired: '请填写邀请码喵~',
    emailAlreadyRegistered: '该邮箱已注册过啦喵~',
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
  }
};

export type LocaleKeys = typeof zhCN;