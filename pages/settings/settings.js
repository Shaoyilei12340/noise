/*Page({
  data: {
    expectedExposure: 28800,
    noiseAlarmLevel: 80,
  },
  onShow:function(){
    try{
      this.setData({
        expectedExposure: wx.getStorageSync('expectedExposure'),
        noiseAlarmLevel: wx.getStorageSync('noiseAlarmLevel')
      });
    }catch(Error){
      console.log("Local variable unavailable, using default settings.");
    }
  },
  // 更新最大噪声累积量
  updateExpectedExposure: function(e) {
    this.setData({
      expectedExposure: e.detail.value
    });
  },
  updateNoiseLevel: function(e) {
    this.setData({
      noiseAlarmLevel: e.detail.value
    });
  },
  // 保存设置
  saveSettings: function() {
    wx.setStorageSync('expectedExposure', this.data.expectedExposure);
    wx.setStorageSync('noiseAlarmLevel', this.data.noiseAlarmLevel);
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 2000
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
  }
})*/
const app = getApp();

Page({
  data: {
    duration: wx.getStorageSync('expectedExposure'),
    energy: wx.getStorageSync('noiseAlarmLevel'),
    unitIndex: 0,
    units: [{ name: 'dB SPL' },{ name: 'Pa²·h' } ],
    alarm: wx.getStorageSync('alarm'),
    offset: wx.getStorageSync('offset'),
    darkMode: false,
    syncCloud: false,
    intervalIndex: 1,
    intervals: [1, 5, 10, 30, 60]
  },

  /*changeDuration(e) {
    let delta = parseFloat(e.currentTarget.dataset.delta);
    let newVal = Math.max(0, this.data.duration + delta);
    this.setData({ duration: newVal.toFixed(1) });
  },*/

  changeDuration(e) {
    let delta = parseFloat(e.currentTarget.dataset.delta || 0);
    let current = parseFloat(this.data.duration || 0);
  
    // 精度控制：让它是 0.5 的倍数（最多保留 1 位小数）
    let newVal = Math.max(0, current + delta);
    newVal = Math.round(newVal * 2) / 2; // 保证是 0.5 的倍数
  
    this.setData({
      duration: newVal.toFixed(1)
    });
  },

  changeEnergy(e) {
    this.setData({ energy: e.detail.value });
  },

  changeUnit(e) {
    this.setData({ unitIndex: e.detail.value });
  },

  toggleAlarm(e) {
    this.setData({ alarm: e.detail.value });
  },

  changeOffset(e) {
    this.setData({ offset: e.detail.value })
  },

  toggleDark(e) {
    this.setData({ darkMode: e.detail.value });
  },

  toggleSync(e) {
    this.setData({ syncCloud: e.detail.value });
  },

  changeInterval(e) {
    this.setData({ intervalIndex: e.detail.value });
  },

  requestRecord() {
    wx.openSetting();
  },

  clearCache() {
    app.globalData.init = false;
    wx.clearStorage({
      success() {
        wx.showToast({ title: '已清除缓存', icon: 'success' });
      }
    });
  },

  save() {
    wx.setStorageSync('expectedExposure', this.data.duration);
    wx.setStorageSync('noiseAlarmLevel', this.data.energy);
    wx.setStorageSync('alarm', this.data.alarm);
    wx.setStorageSync('offset', this.data.offset);
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 2000
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
  
  },

  reset() {
    this.setData({
      duration: 8.0,
      energy: 110,
      unitIndex: 0,
      alarm: true,
      offset: 77,
      darkMode: false,
      syncCloud: false,
      intervalIndex: 1
    });
    wx.showToast({ title: '已恢复默认', icon: 'none' });
  }
});
