const recorderManager = wx.getRecorderManager();
const audioCtx = wx.createWebAudioContext();

let canvas,bcanvas, ctx, bctx, dpr;

/** 
  * @param {number} offset
  * 本地麦克风设备校准偏移量
  *-67dbFS ~ 10dbSPL 非常安静的房间
  *-35dbFS ~ 60dbSPL 1m 正常谈话
  *10 - (-67) = 77
*/
const offset = 10 - (-67);
const dBArray = new Array();
dBArray[0]=0;
let cne = 0;
let isAlarming = false;
let time = 0;
var threat, buffer;
const expectedExposure = wx.getStorageSync('expectedExposure');
const noiseAlarmLevel = wx.getStorageSync('noiseAlarmLevel');
const timeTerm = getTimeTerm(expectedExposure);


function getTimeTerm(time){
  return 10 * Math.log10(time);
}

/*
const availableAudioSources = wx.getAvailableAudioSources();
*/

/**
   * 执行设备校准
   * @param {number} knownDBSPL - 已知参考声压级 (dBSPL)
   * @param {number} measuredDBFS - 测量到的dBFS值
 */

function calibrate(knownDBSPL, measuredDBFS) {
  calibrationOffset = knownDBSPL - measuredDBFS;
}

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
    
function calculateShortCNE(dBArray, expectedExposure) {     
  // 1. 验证输入有效性
  if (!dBArray || dBArray.length === 0) {
      return -1;
  }
  
  // 2. 计算时段等效声级 (Leq)
  const leq = calculateLeq(dBArray);
  console.log(leq);
  
  // 3. 估算峰度因子 (简化波动性评估)
  const kFactor = estimateKFactor(dBArray);

  // 4. 计算CNE 
  cne = leq + timeTerm + (kFactor * 3) - 44.6;
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
    if (cne < 40) return '安全';
    else if (cne < 60) return '中风险';
    else return '高风险';
}

function recordArray(currentTime, dBSPL){
  dBArray[currentTime] = dBSPL;
}
const globalSize = 300;
const scaleX = 3;
const scaleY = 4;

function canvasInit(){

  // 绘制网格
  ctx.strokeStyle = 'rgba(100, 150, 180, 0.2)';
  ctx.lineWidth = 0.5;
  
  // 水平网格线
  for (let y = 0; y <= globalSize; y += scaleY*10) {
      ctx.beginPath();
      ctx.moveTo(0, -y);
      ctx.lineTo(globalSize, -y);
      ctx.stroke();
  }
  
  // 垂直网格线
  for (let x = 0; x <= globalSize; x += scaleX*10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, -globalSize);
      ctx.stroke();
  }
  
  // 绘制坐标轴
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -globalSize);
  ctx.lineTo(globalSize, -globalSize);
  ctx.stroke();
  
  // 添加刻度标签
  ctx.fillStyle = '#90a4ae';
  ctx.font = '8px Arial';
  ctx.textAlign = 'center';
  for (let db = 100; db >= 0; db -= 10) {
      const y = db*scaleY ;
      ctx.fillText(`${db}dB`, globalSize, -y);
  }
}


function draw (time){ 
  var t = time;
  
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgb(0, 0, 0)';
  var dx = Math.min(t*scaleX, globalSize);
  ctx.moveTo(dx-scaleX,-(dBArray[t-1])*scaleY);
  /* 没做好
  if(t*scaleX>=globalSize){
    console.log( "到顶了")
    shiftCanvasLeft();
  }
  */
  ctx.lineTo(dx, -dBArray[t]*scaleY);
  ctx.stroke()
  // 注册下一帧渲染
  //canvas.requestAnimationFrame(draw)
}
function shiftCanvasLeft() {
  
  ctx.drawImage(
  canvas,
  50, -globalSize, (globalSize-50)*dpr, globalSize*dpr,
  0, -globalSize, (globalSize-50)*dpr, globalSize*dpr
);

  ctx.clearRect(globalSize-50, -globalSize, 50, globalSize);
  ctx.stroke();
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
    query.select('#myCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        canvas = res[0].node;
        ctx = canvas.getContext('2d');
        dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;     
        ctx.scale(dpr, dpr);
        //ctx.fillRect(0, 0, globalSize, globalSize);
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, globalSize, globalSize);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.translate(0,globalSize);

        canvasInit();
      })
      
  },

  onShow(){
    this.noiseDetect();
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
    console.log('ok');
    
    recorderManager.onFrameRecorded(res => { 
      console.log('ok');
      const resbuffer = res.frameBuffer;  // 获取PCM数据
      console.log(resbuffer);
      buffer = new Int16Array(resbuffer);
      
      const energy = calculateRMS(buffer);
      const dbfs = calculatedb(energy);
      const dbspl = dbfs + offset;

      setTimeout(function () {
        time++;
        console.log(time)
        recordArray(time, dbspl);
        draw(time);
      }, 1000)
        
        try{
          calculateShortCNE(dBArray, time);
        }catch(Error){
          console.log(Error);
        }  
        console.log(cne);
        threat = evaluateRisk(cne);
        console.log(threat);
      
      
      this.setData({
        dbfs: dbfs,
        dbspl: dbspl,
        cne: cne,
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
