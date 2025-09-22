// app.js
App({
  globalData:{
    version: "Alpha 0.3.0.20250922.1",
    vstamp:"a.0.3.0.20250922.1",
    init: false,
    server:"http://47.117.40.74:9999",
    isLoggedIn: wx.getStorageSync('isLoggedIn'),
    userInfo:wx.getStorageSync('userInfo'),
  },

  ioLog(key, value, option){
    if(option === "set"){
      wx.setStorageSync(key, value);
      console.log(`[Storage IO] ${option} ${key} : ${value}`);
    }else if(option === "get"){
      let res = wx.getStorageSync(key);
      console.log(`[Storage IO] ${option} ${key} : ${res}`);
      return res;
    }else{
      console.log("[Storage IO] Invaild IOlog.")
      return -1;
    }
    
  },

  initApp(){
    console.log("app initialize");
    wx.showLoading({
      title: '初始化',
    });
    var initDataArray = new Array();
    this.ioLog('expectedExposure', 8, 'set')
    this.ioLog('noiseAlarmLevel', 110, 'set');
    this.ioLog('alarm', true, 'set');
    this.ioLog('offset', 77, 'set');
    //this.ioLog('savedResult', initDataArray, 'set');
    this.ioLog('init', true, 'set');
    setTimeout(function () {
      wx.hideLoading()
    }, 1500)
  },

  onLaunch () {
    console.log("app start");
    this.globalData.init = wx.getStorageSync('init'); 
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            desc: '用于分析环境噪声分贝听力级和噪声累积能量',
            scope: 'scope.record',
            success () {
              // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
              console.log("record authorized");
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
        }
      }
    })
    if(!this.globalData.init){
      this.initApp();
      this.globalData.init = true;
    }
  },
})
