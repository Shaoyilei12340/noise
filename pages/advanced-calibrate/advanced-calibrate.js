// pages/advanced-calibrate.js
const app = getApp();
Page({

  data: {
    currentOffset: wx.getStorageSync('offset'),
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  fetchDeviceInfo(){
    const {brand, model, friendlyName} = this.getQuickDeviceInfo();
    const r = `品牌：${brand}\n型号：${model}\n友好名称：${friendlyName}\n当前偏移量：${this.data.currentOffset}`
    wx.showModal({
      title: '设备信息详情',
      editable: false,
      showCancel: false,
      content: r,
      success (res) {
        if (res.confirm) {
          console.log(`device info ok with "${r}"`)
        } 
      }
    })
  },

  getQuickDeviceInfo() {
    const deviceInfo = wx.getDeviceInfo();
    
    // 处理大小写兼容
    const brand = deviceInfo.brand.charAt(0).toUpperCase() + deviceInfo.brand.slice(1);
    const model = deviceInfo.model; 
    
    // 同样使用防重复拼接逻辑
    const friendlyName = model.toLowerCase().startsWith(brand.toLowerCase()) 
        ? model 
        : `${brand} ${model}`;
  
    return {
      brand: brand,
      model: model,
      friendlyName: friendlyName
    };
  },

  goToAdvancedCalibration()
  {
    wx.navigateTo({
      url: '/pages/advanced-calibrate/calibrate/calibrate',
    });
  },

  importCalibration() {
    const that = this;
    wx.getClipboardData({
      success(res) {
        // 去除前后空格
        const clipboardText = res.data.trim(); 
        
        if (!clipboardText) {
          wx.showToast({ title: '剪贴板为空', icon: 'none' });
          return;
        }

        try {
          // 1. 将 Base64 字符串解码为 ArrayBuffer (微信原生 API)
          const buffer = wx.base64ToArrayBuffer(clipboardText);
          
          // 2. 将 ArrayBuffer 转换为 UTF-8 字符串 (支持中文防乱码)
          let decodedJsonString = '';
          decodedJsonString = String.fromCharCode.apply(null, new Uint8Array(buffer));
          //decodedJsonString = new TextDecoder('utf-8').decode(buffer);
          console.log("decoded: "+ decodedJsonString);

          // 3. 解析 JSON
          const data = JSON.parse(decodedJsonString);

          // 4. 校验来源并应用数据
          if (data.source === "NoiCali") {
            const offset = data.offset;
            const deviceName = data.friendlyName;
            
            // 存入缓存
            wx.setStorageSync('offset', offset);

            wx.showModal({
              title: '参数导入成功',
              content: `校准设备：${deviceName}\n偏移量：${offset.toFixed(2)} dB`,
              showCancel: false
            });

            // 清空剪贴板避免重复读取旧数据
            wx.setClipboardData({ data: ' ' });
            
            // 刷新页面数据
            that.setData({ currentOffset: offset });
          } else {
            throw new Error("Invalid Source");
          }
        } catch (e) {
          console.error("解密或解析失败", e);
          wx.showToast({ title: '剪贴板内无有效的校准参数', icon: 'none' });
        }
      }
    });
  },

  // 辅助函数：降级处理 ArrayBuffer 转 UTF-8 字符串
  decodeUtf8BufferToString(buffer) {
    const array = new Uint8Array(buffer);
    let out = "", i = 0, len = array.length;
    let c, char2, char3;
    while(i < len) {
        c = array[i++];
        switch(c >> 4) { 
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
                break;
        }
    }
    return out;
  }

})