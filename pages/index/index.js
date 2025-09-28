// 首页逻辑
Page({
  data: { 
  },
  goToResult: function() {
    wx.navigateTo({
      url: '/pages/result/result'
    });
  },

  noiseDetect: function(){
    this.goToMain();
  },
  
  goToMain: function() {
    wx.navigateTo({
      url: '/pages/main/main'
    });
  },

  goToCalibrate: function() {
    wx.navigateTo({
      url: '/pages/calibrate/calibrate'
    });
  },

  goToPilot(){
    wx.navigateTo({
      url: '/pages/pilot/pilot'
    })
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
})
