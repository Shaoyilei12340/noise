// pages/pilot/pilot.js
Page({
  data: {

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

  goToUsage(){
    wx.navigateTo({
      url: '/pages/usage/usage',
    })
  },

  goToAdvancedCalibrate(){
    wx.navigateTo({
      url: '/pages/advanced-calibrate/advanced-calibrate',
    })
  }
})