Page({
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
})
