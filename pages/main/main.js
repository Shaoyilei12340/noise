const app = getApp();
const recorderManager = wx.getRecorderManager();
var audioCtx, canvasf, canvasb, ctxf, ctxb, dpr;
var startDate, dBArray, time, cne, threat, buffer, expectedExposure, noiseAlarmLevel;
var allowAlarm = true, isAlarming = false;
console.log("offset: ", offset);
/** 
  * @param {number} offset
  * 本地麦克风设备校准偏移量
  *-67dbFS ~ 10dbSPL 非常安静的房间
  *-35dbFS ~ 60dbSPL 1m 正常谈话
  *10 - (-67) = 77
*/
const offset = wx.getStorageSync('offset');

function getTimeTerm(time=28800){
  return 10 * Math.log10(time);
}

let timeTerm = getTimeTerm(expectedExposure);
/*
const availableAudioSources = wx.getAvailableAudioSources();
*/

function calculateRMS(pcmData) {
  let sumSquares = 0;
  for (let i = 0; i < pcmData.length; i++) {
    // PCM值归一化到[-1, 1]
    let sample = pcmData[i] ;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / pcmData.length); // RMS值
}

function calculatedb(rms, reference = 32767){
  return 20 * Math.log10(Math.max(rms, 1e-12) / reference);
}

/**   calculateShortCNE(dBArray, expectedExposure)
     * 计算短时噪声累积暴露能量 (CNE)
     * @param {number[]} dBArray - 每秒声级测量值数组 (dB)
     * @param {number} expectedExposure - 总暴露时间 (秒)
     * @returns {number} 估算的CNE值 (dB(A)·年)
 */
    
function calculateShortCNE(dBArray) {     
  // 1. 验证输入有效性
  if (!dBArray || dBArray.length === 0) {
      return -1;
  }
  
  // 2. 计算时段等效声级 (Leq)
  const leq = calculateLeq(dBArray);
  
  // 3. 估算峰度因子 (简化波动性评估)
  const kFactor = estimateKFactor(dBArray);

  // 4. 计算CNE 
  console.log("leq&timeTerm&KFactor: ", leq, timeTerm, kFactor);
  cne = leq + timeTerm + (kFactor * 3) - 44.6;
  return cne;
}


/** calculateLeq(dBArray)
 * 计算等效连续A声级 (Leq)
 * @param {number[]} dBArray - 每秒声级测量值数组
 * @returns {number} Leq值 (dB)
 */
function calculateLeq(dBArray) {
  let energySum = 0;
  
  for (var dB of dBArray) {
      // 将dB值转换为能量值累加 (10^(dB/10))
      energySum += Math.pow(10, dB / 10);
  }
  
  // 计算平均值并转换回dB值
  const avgEnergy = energySum / dBArray.length;
  return 10 * Math.log10(avgEnergy);
}
    
/** estimateKFactor(dBArray)
 * 估算峰度因子 (简化版波动性评估)
 * @param {number[]} dBArray - 每秒声级测量值数组
 * @returns {number} 峰度因子 (1=稳态, 2=高波动)
 */
function estimateKFactor(dBArray) {
  // 计算最大值和最小值
  let min = Infinity;
  let max = -Infinity;
  
  for (const dB of dBArray) {
      if (dB < min) min = dB;
      if (dB > max) max = dB;
  }
  
  // 计算波动范围
  const range = max - min;
  
  // 简化判断：波动范围>15dB视为高波动噪声
  return range > 15 ? 2 : 1;
}

/**
 * 风险等级评估
 * @param {number} cne - 计算得到的CNE值
 * @returns {string} 风险等级描述
 */
function evaluateRisk(cne) {
    if (cne < 85) return '安全';
    else if (cne < 105) return '中风险';
    else return '高风险';
}

function recordArray(currentTime, dBSPL){
  dBArray[currentTime] = dBSPL;
}
const globalSize = 300;
const scaleX = 30;
const scaleY = 2;

function mesh(ctx=ctxb, mtX, ltX){
  // translated
  //ctx.globalCompositeOperation = 'source-in';
  /*
  ctx.fillStyle = 'rgb(25, 255, 255)';
  ctx.fillRect(0, -globalSize, globalSize, globalSize);
  ctx.lineWidth = 0;
  */
  // 绘制网格
  ctx.strokeStyle = 'rgba(100, 150, 180, 1)';
  ctx.lineWidth = 0.2;
  // 水平网格线
  for (let y = 0; y < scaleY*10*14; y += scaleY*10) {
    ctx.beginPath();
    ctx.moveTo(mtX, -y);
    ctx.lineTo(ltX, -y);
    ctx.stroke();
  }
  /*
  // 垂直网格线
  for (let x = 0; x <= globalSize; x += scaleX*10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, -globalSize);
      ctx.stroke();
  }
  
  // 绘制坐标轴
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  ctx.moveTo(0, -globalSize);
  ctx.lineTo(globalSize, -globalSize);
  ctx.stroke();
  */
}

function mark(ctx=ctxb){
  // translated
  // 添加刻度标签
  ctx.fillStyle = '#90a4ae';
  ctx.font = '8px Arial';
  ctx.textAlign = 'left';
  for (let db = 130; db >= 0; db -= 10) {
      const y = db*scaleY ;
      ctx.fillText(`${db} dB`, globalSize, -y);
  }
}

function draw(ctx=ctxf, time){ 
  // translated
  var t = time;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgb(0, 0, 0)';
  var dx = Math.min(t*scaleX, globalSize);
  ctx.save();
  if(t*scaleX>globalSize){
    shiftCanvasLeft(canvasf, ctxf);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(dx-scaleX,-(dBArray[t-1])*scaleY);
  ctx.lineTo(dx, -dBArray[t]*scaleY);
  ctx.stroke()
}
function shiftCanvasLeft(canvas=canvasf, ctx=ctxf) {  
  //ctxb.globalCompositeOperation = 'destination-atop';
  ctx.globalCompositeOperation = 'copy';
  ctx.translate(0, -globalSize);
  ctx.drawImage(
  canvas,
  scaleX*dpr, 0, (globalSize-scaleX)*dpr, globalSize*dpr,
  0, 0, (globalSize-scaleX), globalSize
);
  ctx.clearRect((globalSize-scaleX), 0, scaleX, globalSize);
  ctx.translate(0, globalSize);
  mesh(ctxb, globalSize-scaleX, globalSize);
  //mark(ctxb);
  ctx.globalCompositeOperation = 'source-over';
  
}
function initMonitor(){
  try{
    audioCtx = wx.createWebAudioContext();
    expectedExposure = (wx.getStorageSync('expectedExposure'))*3600;
    noiseAlarmLevel = wx.getStorageSync('noiseAlarmLevel');
    allowAlarm = wx.getStorageSync('alarm');
    isAlarming = false;
    console.log("en：", expectedExposure, noiseAlarmLevel);
    dBArray = new Array();
    dBArray[0]=0;
    cne = 0;
    
    time = 0;
  }catch(e){
    console.log(e);
  }
  
}

Page({
  data:{
    dbfs: 0,
    dbspl: 0,
    cne: 0,
    threat: "暂无数据",
  },
  recordParams: {
    duration: 600000,
    sampleRate: 16000,    // 采样率（Hz）
    numberOfChannels: 1,
    encodeBitRate: 24000,
    format:'PCM',
    frameSize: 16,      // 每帧采样点数
    audioSource:'auto',
  },
  
  onReady() {
    const query = wx.createSelectorQuery()
    query.select('#canvas-front')
      .fields({ node: true, size: true })
      .exec((res) => {
        canvasf = res[0].node;
        ctxf = canvasf.getContext('2d');
        dpr = wx.getWindowInfo().pixelRatio;
        canvasf.width = res[0].width * dpr;
        canvasf.height = res[0].height * dpr; 
        console.log("canvas px: ",canvasf.width, "x", canvasf.height);    
        ctxf.scale(dpr, dpr);
        ctxf.lineWidth = 0;
        //ctxf.strokeStyle = 'rgb(0, 0, 0)';
        ctxf.translate(0, globalSize);
        console.log("canvas ok")
      })
    query.select('#canvas-back')
    .fields({ node: true, size: true })
    .exec((res) => {
      canvasb = res[0].node;
      ctxb = canvasb.getContext('2d');
      canvasb.width = res[0].width * dpr;
      canvasb.height = res[0].height * dpr; 
      ctxb.scale(dpr, dpr);
      ctxb.translate(0, globalSize);
      mesh(ctxb, 0, globalSize);
      mark(ctxb);
      //ctxb.globalCompositeOperation = 'destination-over';
    })
  },

  onShow(){
    initMonitor();
    this.noiseDetect();
  },
  onHide(){
    this.stopNoiseMonitoring();
  },

  onUnload(){
    this.stopNoiseMonitoring();
  },

  archive(){
    /*
    let options = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    };
    */ // 不支持Intl
    let currentDate = Date.now();
    let duration = (currentDate - startDate)/1000; // ms -> s
    currentDate = new Date(currentDate);
    //let fd = new Intl.DateTimeFormat("zh-CN", options).format(currentDate) // 不支持Intl
    currentDate = currentDate.toLocaleString("zh-CN");
    let d = wx.getDeviceInfo();
    let device = d.brand + ' ' + d.model;
    let system = d.system;
    const data = {
      date:currentDate,
      duration:duration.toFixed(3),
      exposure:expectedExposure,
      cne:this.data.cne,
      threat:this.data.threat,
      extra:null,
      device:device,
      system:system,
      offset:offset,
      vstamp:app.globalData.vstamp,
    };
    return data;
  },

  saveResult(){
    console.group('save')
    let savedResult = wx.getStorageSync('savedResult');
    if (!Array.isArray(savedResult)) {
      savedResult = [];
    }
    console.log("svd: ", savedResult)
    let _save = this.archive();
    console.log("archived: ", _save)
    savedResult.unshift(_save);
    console.log("formed: ", savedResult);
    wx.setStorageSync('savedResult', savedResult);
    console.groupEnd();
    wx.showToast({
      title: '保存结果',
      icon: 'success',
      duration: 1000
    });
  },

  _saveResult(){
    try{
      this.saveResult();
    }catch(e){
      console.log(e);
    };
  },

  stopNoiseMonitoring: function() {
    recorderManager.stop();
    audioCtx.close();
    wx.navigateBack();
  },

  noiseDetect: function () {
    wx.showLoading({
      title: '启动监测',
    });
    setTimeout(function () {
      wx.hideLoading()
    }, 1500)
    
    recorderManager.start(this.recordParams);
    console.log('recorderManager ok');
    startDate = Date.now();
    console.log("record start@ ", startDate);
    recorderManager.onFrameRecorded(res => { 
      console.group("recordAnalysis");
      const resbuffer = res.frameBuffer;  // 获取PCM数据
      console.log("pcmBuffer: ",resbuffer);
      buffer = new Int16Array(resbuffer);
      
      const energy = calculateRMS(buffer);
      const dbfs = calculatedb(energy);
      const dbspl = dbfs + offset;
      

      setTimeout(function () {
        time++;
        console.log("recorded: ",time)
        recordArray(time, dbspl);
        draw(ctxf, time);
        try{
          cne = calculateShortCNE(dBArray, time);
        }catch(Error){
          console.log(Error);
        }  
        console.log("cne: ",cne);
        threat = evaluateRisk(cne);
        console.log("threat: ",threat);
        console.groupEnd();
      }, 1000)

      this.setData({
        dbfs: dbfs.toFixed(4),
        dbspl: dbspl.toFixed(4),
        cne: cne.toFixed(4),
        threat: threat,
      });


      if (cne >= noiseAlarmLevel && !isAlarming) {
        isAlarming = true;
        wx.vibrateLong(); // 触发震动警报
        wx.showModal({
          title: '警报',
          content: '噪声累积能量预计将超过健康暴露水平',
          showCancel: false
      });
    }
      
    });
    
  },

})
