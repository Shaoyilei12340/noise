// app.js
App({
  globalData:{
  },
  onLaunch () {
    console.log("启动");
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success () {
              // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
              wx.showToast({
                title: '您已授权录音',
                icon: 'success',
                duration: 1000
              });
            },
            fail (){
              console.log('reject record');
            }
          })
        wx.showToast({
          title: '您已授权录音',
          icon: 'success',
          duration: 1000
        });
        }
      }
    })
    
  },
 
})
