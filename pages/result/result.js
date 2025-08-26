var isEmpty, activeIndex;
function initData(){
  isEmpty = true;
  activeIndex = -1;
}

function refreshResult(){
  let d = wx.getStorageSync('savedResult');
  d.length ? isEmpty = false : isEmpty = true;
  return d;
}

Page({
  data:{
    savedResult: [],
    activeIndex:-1,
    isEmpty:true,
  },

  refresh(){
    this.setData({
      savedResult: refreshResult(),
      activeIndex:activeIndex,
      isEmpty:isEmpty,
    })
  },
  
  onShow: function() {
    initData();
    this.refresh();
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
    activeIndex = this.data.activeIndex;
  },

  handleCardLongPress(e){
    let instance = this;
    const index = e.currentTarget.dataset.index;
    let options = ['删除此记录'];
    console.group("handleCardLongPress");
    console.log(e);
    wx.showActionSheet({
      itemList: options,
      success (res) {
        if(res.tapIndex === 0){instance.delete(index, 1);}
      },
      fail (res) {
        console.log(res.errMsg)
      },
      complete(){
        console.groupEnd();
      }
    })
  },

  confirmDeleteAll(){
    console.group('delete all')
    let instance = this;
    let str = "您即将删除所有记录";
    wx.showModal({
      title: "清空记录",
      content: str,
      success (res) {
        if (res.confirm) {
          console.log("delete all");
          instance.deleteAll();
        } else if (res.cancel) {
          console.log("delete aborted by user");
        }
      },
      complete(){
        console.log("complete");
        console.groupEnd();
      }
    })
  },
  deleteAll(){
    this.delete(0, -1)
    wx.showToast({
      title: '记录已清空',
      icon: 'success',
      duration: 1000
    });
  },
  delete(index, count){
    let savedResult = wx.getStorageSync('savedResult');
    if(count === -1){
      count = savedResult.length;
    }
    console.log(`delete item[${index}]`)
    savedResult.splice(index, count);
    wx.setStorageSync('savedResult', savedResult);
    this.refresh();
    console.log("result: ",this.data.savedResult);
  }
})
