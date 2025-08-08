// 首页逻辑
Page({
  
  data: {
    db: 0,
    noiseLevel: 0,
    maxNoiseLevel: 100,
    isAlarmOn: false,
    threshold: 0.05,      // 噪声判断阈值（归一化能量）
    duration: 10,         // 最大持续时长（秒）
    minContinuous: 3      // 最小连续超标帧数
    
  },
  // 跳转到结果页
  goToResult: function() {
    wx.navigateTo({
      url: '/pages/result/result?noiseLevel=' + this.data.noiseLevel
    });
  },

  noiseDetect: function(){
    const main = require('../main/main.js');
    this.goToMain();
  },
  
  goToMain: function() {
    wx.navigateTo({
      url: '/pages/main/main'
    });
  },

  goToCalibrate: function() {
    wx.showModal({
      title: '提示',
      content: '自助校准将在后续版本开放',
      showCancel: false,       // 只有一个“确定”按钮
      confirmText: '好的',
      confirmColor: '#4facfe'
    });
    /* 开发中
    wx.navigateTo({
      url: '/pages/calibrate/calibrate'
    });
    */
  },

  goToKnowledge: function() {
    wx.navigateTo({
      url: '/pages/knowledge/knowledge'
    });
  },
  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },
  // 跳转到设置页
  /*goToSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },*/

})
