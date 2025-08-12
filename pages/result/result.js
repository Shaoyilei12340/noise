function initData(){
  let d = wx.getStorageSync('savedResult');
  return d;
}

Page({
  data:{
    savedResult: initData(),
  },
  
  onShow: function() {
    this.setData({
      savedResult: initData(),
    })
    console.log("result: ",this.data.savedResult);
  },
})
