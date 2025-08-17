const app = getApp();
const recorderManager = wx.getRecorderManager();
var audioCtx, canvasf, canvasb, ctxf, ctxb, dpr;
var offset, dBArray, time, buffer, stopCalibration = false;

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

function recordArray(currentTime, dBSPL){
  dBArray[currentTime] = dBSPL;
}
const globalSize = 300;
const scaleX = 30;
const scaleY = 3;

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
      ctx.fillText(`${db}dB`, globalSize, -y);
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
    stopCalibration = false;
    offset = wx.getStorageSync('offset');
    audioCtx = wx.createWebAudioContext();
    dBArray = new Array();
    dBArray[0]=0;
    time = 0;
  }catch(e){
    console.log(e);
  }
}

function initCanvasFront(query){
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
}

function initCanvasBack(query){
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
}


Page({
  data:{
    dbfs: 0,
    dbspl: 0,
    dbfsSlientRoom:0,
    dbfs1mTalk:0,
    offsetSlientRoom:0,
    offset1mTalk:0,
    presetCalibration:"无",
    newOffset:0,
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
    const query = wx.createSelectorQuery();
    initCanvasFront(query);
    initCanvasBack(query);
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

  stopNoiseMonitoring: function() {
    recorderManager.stop();
    audioCtx.close();
    wx.navigateBack();
  },

  roughCalibrateSlientRoom() {   
    /**
       * 执行设备校准
       * @param {number} knownDBSPL - 已知参考声压级 (dBSPL)
       * @param {number} measuredDBFS - 测量到的dBFS值
     */
    let measuredDBFS=this.data.dbfs, knownDBSPL = 33;
    let roughCalibrationOffset = knownDBSPL - measuredDBFS;
    this.setData({
      dbfsSlientRoom:measuredDBFS,
      offsetSlientRoom:roughCalibrationOffset,
      presetCalibration:"一般安静房间",
      newOffset:roughCalibrationOffset,
    })
    return roughCalibrationOffset;
  },
  
  roughCalibrateTalk() {
    /**
       * 执行设备校准
       * @param {number} knownDBSPL - 已知参考声压级 (dBSPL)
       * @param {number} measuredDBFS - 测量到的dBFS值
     */
    let measuredDBFS=this.data.dbfs, knownDBSPL = 63;
    let roughCalibrationOffset = knownDBSPL - measuredDBFS;
    this.setData({
      dbfs1mTalk:measuredDBFS,
      offset1mTalk:roughCalibrationOffset,
      presetCalibration:"一米正常谈话",
      newOffset:roughCalibrationOffset,
    })
    return roughCalibrationOffset;
  },
  
  autoCalibrateTraffic(knownDBSPL, measuredDBFS) {
    //
  },

  saveOffset(){
    let calibration = this;
    let offset = calibration.data.newOffset;
    let str = `
    您即将应用以下校准：
    类型为${this.data.presetCalibration} ，偏移量为${offset}
    `;
    wx.showModal({
      title: '应用校准',
      content: str,
      success (res) {
        if (res.confirm) {
          wx.setStorageSync('offset', offset);
          offset = wx.getStorageSync('offset');
          console.log(`set offset to ${offset} by user`);
          stopCalibration = true;
        } else if (res.cancel) {
          console.log('calibration aborted by user');
        }
      },
      complete(){
        if(stopCalibration){
          console.log('stop calibration');
          calibration.stopNoiseMonitoring();
        }
      }
    })
  },

  noiseDetect: function () {
    wx.showLoading({
      title: '启动校准',
    });
    setTimeout(function () {
      wx.hideLoading()
    }, 1500)
    
    recorderManager.start(this.recordParams);
    console.log('recorderManager ok');
    
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
        console.groupEnd();
      }, 1000)

      this.setData({
        dbfs: dbfs.toFixed(4),
        dbspl: dbspl.toFixed(4),
      }); 
    });
  },
})
