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
const dataModel = require('../../utils/data-model');
const { OFFSET_IMPORT_RANGE } = require('../../utils/constants');

function clampOffset(value) {
  return Math.min(OFFSET_IMPORT_RANGE.MAX, Math.max(OFFSET_IMPORT_RANGE.MIN, value));
}

Page({
  data: {
    duration: dataModel.getExpectedExposureHours(),
    energy: dataModel.getNoiseAlarmLevel(),
    unitIndex: 0,
    units: [{ name: 'dB SPL' },{ name: 'Pa²·h' } ],
    alarm: dataModel.getAlarmEnabled(),
    offset: dataModel.getOffset(),
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
  onShow:function(){
    try{
      this.setData({
        duration: dataModel.getExpectedExposureHours(),
        energy: dataModel.getNoiseAlarmLevel(),
        alarm: dataModel.getAlarmEnabled(),
        offset: dataModel.getOffset(),
      })
    }catch(Error){
      console.log("local variable unavailable.");
      this.reset();
    }
  },

  changeDuration(e) {
    let delta = parseFloat(e.currentTarget.dataset.delta || 0);
    let current = parseFloat(this.data.duration || 0);
  
    // 精度控制：让它是 0.5 的倍数（最多保留 1 位小数）
    let newVal = Math.max(0.5, current + delta);
    newVal = Math.round(newVal * 2) / 2; // 保证是 0.5 的倍数
  
    this.setData({
      duration: newVal.toFixed(1)
    });
  },

  changeEnergy(e) {
    const val = parseFloat(e.detail.value);
    this.setData({ energy: Number.isFinite(val) ? val : dataModel.getNoiseAlarmLevel() });
  },

  changeUnit(e) {
    this.setData({ unitIndex: e.detail.value });
  },

  toggleAlarm(e) {
    this.setData({ alarm: e.detail.value });
  },

  changeOffset(e) {
    const val = parseFloat(e.detail.value);
    this.setData({ offset: Number.isFinite(val) ? clampOffset(val) : dataModel.getOffset() })
  },

  toggleDark(e) {
    //this.setData({ darkMode: e.detail.value });
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
    // 当前版本不清理设置、登录态、结果记录与环境配置；该按钮仅保留为轻量反馈入口。
    wx.showToast({ title: '已清除缓存', icon: 'success' });
  },

  save() {
    const duration = parseFloat(this.data.duration);
    const energy = parseFloat(this.data.energy);
    const offset = parseFloat(this.data.offset);
    const normalizedOffset = Number.isFinite(offset) ? clampOffset(offset) : dataModel.getOffset();

    dataModel.setExpectedExposureHours(Number.isFinite(duration) && duration > 0 ? duration : dataModel.getExpectedExposureHours());
    dataModel.setNoiseAlarmLevel(Number.isFinite(energy) ? energy : dataModel.getNoiseAlarmLevel());
    dataModel.setAlarmEnabled(this.data.alarm);
    dataModel.setOffset(normalizedOffset);
    this.setData({ offset: normalizedOffset });
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
      energy: 85,
      unitIndex: 0,
      alarm: true,
      offset: 77,
      darkMode: false,
      syncCloud: false,
      intervalIndex: 1
    });
    // 建议在恢复默认时也顺便写入缓存，或者加一句 Toast 提醒用户点保存
    wx.showToast({ title: '已恢复默认，请点击保存', icon: 'none' });
  }
  
});
