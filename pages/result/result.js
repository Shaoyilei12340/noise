function initData(){
  let d = wx.getStorageSync('savedResult');
  return d;
}

Page({
  data:{
    savedResult: initData(),
    activeIndex:-1,
  },
  
  onShow: function() {
    this.setData({
      savedResult: initData(),
    })
    console.log("result: ",this.data.savedResult);
  },
  
  handleCardTap(e) {
    console.log(e);
    const index = e.currentTarget.dataset.index;
    if (this.data.activeIndex === index) {
      // 点击了已展开的卡片，则收起
      this.setData({ activeIndex: -1 });
    } else {
      // 展开新卡片
      this.setData({ activeIndex: index });
    }
  },
})
