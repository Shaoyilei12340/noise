Page({
  data: {
    version: getApp().globalData.version,
    userInfo: {},
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
  },

  onLoad() {
    this.loadUserInfo();
  },

  // 获取用户信息（示例：从全局或本地存储）
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
  },

  // 跳转页面
  navigateTo() {
    wx.showModal({
      title: '提示',
      content: '请登录后查看',
      showCancel: false,       // 只有一个“确定”按钮
      confirmText: '知道了',
      confirmColor: '#4facfe'
    });
  },

  goToSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  login(){
    wx.showModal({
      title: '提示',
      content: '测试中',
      showCancel: false,       // 只有一个“确定”按钮
      confirmText: '知道了',
      confirmColor: '#4facfe'
    });
  },

  bindGetUserInfo (e) {
    wx.setStorageSync('userInfo', e.detail.userInfo);
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          this.setData({ userInfo: {} });
          wx.showToast({ title: '已退出' });
        }
      }
    });
  },

  // 点击头像登录（需用户授权）
  onAvatarTap() {
    if (!this.data.userInfo.nickName) {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          const userInfo = res.userInfo;
          wx.setStorageSync('userInfo', userInfo);
          this.setData({ userInfo });
        }
      });
    }
  }
});