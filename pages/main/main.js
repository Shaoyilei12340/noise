/**
 * main.js - 噪声监测主逻辑
 * 【重要说明】: 本计算采用 Z计权 (无计权物理真实声压)。
 * 明天实验室验证时，请务必将专业声级计设置为 Z档 或 Flat档 (非A计权档位)！
 */

const app = getApp();
const recorderManager = wx.getRecorderManager();
const {
  calculateRMS,
  calculateDb,
  calculateShortCNE,
  evaluateRisk,
  AWeightingFilter,
} = require('../../utils/audio-math');
const { LIMITS, CANVAS_CONFIG } = require('../../utils/constants');
const dataModel = require('../../utils/data-model');
const resultManager = require('../../utils/result-manager');
let audioCtx, canvasf, ctxf, dpr;

// --- 全局状态变量 ---
let startDate, offset, dBArray, time, cne, threat, expectedExposure, noiseAlarmLevel;
let location, allowAlarm = true, isAlarming = false, hasAlerted = false;

// --- 实例化一个全局滤波器对象 ---
// 注意：滤波器实例必须在录音生命周期内保持全局唯一，因为它的延迟线（状态寄存器 z1, z2）需要跨帧记忆上一秒的声音
let aFilter = new AWeightingFilter();

// --- 新增：高性能计算专用的全局累加变量 (解决 O(n) 卡死问题) ---
let timeTerm = 0;
let frameCount = 0;
let lastFrameTimestamp = 0;
let elapsedMsAccumulator = 0;
let totalEnergySum = 0;
let globalMaxDB = -Infinity;
let globalMinDB = Infinity;
let instantLimit = LIMITS.INSTANT_DB_LIMIT_DEFAULT;
let mainRecorderListenerBound = false;
let activeMainPage = null;

const globalSize = CANVAS_CONFIG.MONITOR.GLOBAL_SIZE;
const scaleX = CANVAS_CONFIG.MONITOR.SCALE_X;
const scaleY = CANVAS_CONFIG.MONITOR.SCALE_Y;

function recordArray(currentTime, dBSPL){
  // 修复初始点未定义导致 Canvas 报错的问题
  if (currentTime === 1) {
    dBArray[0] = dBSPL; 
  }
  dBArray[currentTime] = dBSPL;
}


// ================= Canvas 渲染函数 (极致性能优化版) =================

function mesh(ctx, mtX, ltX, thresholdLine) {
  // --- 1. 批量绘制基础网格 (合并路径，极省性能) ---
  ctx.strokeStyle = 'rgba(100, 150, 180, 0.3)';
  ctx.lineWidth = 0.2;
  ctx.setLineDash([]);
  
  ctx.beginPath(); // 开启唯一主路径
  for (let db = 0; db <= 130; db += 10) {
    const y = db * scaleY;
    ctx.moveTo(mtX, -y);
    ctx.lineTo(ltX, -y);
  }
  ctx.stroke(); // 循环外一次性渲染所有基础网格！

  // --- 2. 绘制独立的瞬时边界高亮线 ---
  if (thresholdLine !== undefined && thresholdLine !== null) {
    ctx.beginPath();
    ctx.strokeStyle = '#A41F35'; // 华师大红/警戒红
    ctx.lineWidth = 0.35; 
    ctx.setLineDash([5, 3]); 
    
    const targetY = thresholdLine * scaleY;
    ctx.moveTo(mtX, -targetY);
    ctx.lineTo(ltX, -targetY);
    ctx.stroke();
    
    ctx.setLineDash([]); // 重置虚线配置
  }
}

function mark(ctx, thresholdLine) {
  ctx.fillStyle = '#90a4ae';
  ctx.font = '10px Arial';
  
  ctx.textAlign = 'left';
  ctx.fillText('SPL [dB(Z)]', 5, -globalSize + 15); 
  
  ctx.textAlign = 'right';
  for (let db = 130; db >= 0; db -= 20) {
      const y = db * scaleY;
      ctx.fillText(`${db}`, globalSize - 5, -y - 3); 
  }

  // --- 额外绘制红色的瞬时边界数值 ---
  if (thresholdLine !== undefined && thresholdLine !== null) {
    ctx.fillStyle = '#A41F35'; 
    ctx.font = '10px Arial';
    const targetY = thresholdLine * scaleY;
    ctx.fillText(`${thresholdLine}`, globalSize - 5, -targetY - 3); 
  }
}

function draw(ctx, currentTime) { 
  // 1. 基于当前坐标系精确清空绘图区域
  ctx.clearRect(0, -globalSize, globalSize, globalSize);
  
  // 2. 绘制静态背景 (网格与刻度)
  mesh(ctx, 0, globalSize, instantLimit);
  mark(ctx, instantLimit);
  
  // 3. 计算波形可视窗口
  const maxPoints = Math.floor(globalSize / scaleX); 
  const startIdx = Math.max(1, currentTime - maxPoints + 1);
  const xOffset = (currentTime <= maxPoints) ? 0 : (currentTime - maxPoints) * scaleX;
  
  ctx.lineWidth = 2.5; 
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  // 4. 动态波形分段渲染
  for (let t = startIdx; t <= currentTime; t++) {
    let currentDB = dBArray[t];
    let previousDB = dBArray[t-1];
    
    // 动态确定当前线段颜色
    let targetColor = '#4fc3f7';
    if (currentDB >= 105) targetColor = '#f44336';
    else if (currentDB >= 85) targetColor = '#ff9800';

    let startX = (t - 1) * scaleX - xOffset;
    let endX = t * scaleX - xOffset;
    
    ctx.beginPath();
    ctx.strokeStyle = targetColor; // 仅在需要时切换状态
    ctx.moveTo(startX, -previousDB * scaleY);
    ctx.lineTo(endX, -currentDB * scaleY);
    ctx.stroke();
  }
}

function initCanvasFront(query){
  query.select('#canvas-front').fields({ node: true, size: true }).exec((res) => {
      canvasf = res[0].node;
      ctxf = canvasf.getContext('2d');
      dpr = wx.getWindowInfo().pixelRatio;
      
      // 物理像素映射
      canvasf.width = res[0].width * dpr;
      canvasf.height = res[0].height * dpr;   
      
      ctxf.scale(dpr, dpr);
      ctxf.translate(0, globalSize);
  });
}

// ================= 页面主逻辑 =================

Page({
  data:{
    dbfs: '0.00',
    dbspl: '0.00',
    cne: '0.00',
    threat: "暂无数据",
    threatClass:"detail-init",
  },

  // 核心录音参数：必须用 camcorder 绕过通话降噪处理
  recordParams: {
    duration: 600000,
    sampleRate: 16000,    
    numberOfChannels: 1,
    encodeBitRate: 48000,
    format: 'PCM',
    frameSize: 16, // 16KB约等于0.5秒
    audioSource: 'camcorder',
  },
  
  onReady() {
    const query = wx.createSelectorQuery();
    initCanvasFront(query);
  },

  onShow() {
    activeMainPage = this;
    this.initMonitor();
    this.noiseDetect();
  },

  onHide() {
    this.cleanupMonitoring();
    activeMainPage = null;
  },

  onUnload() {
    this.cleanupMonitoring();
    activeMainPage = null;
  },

  initMonitor() {
    try {
      audioCtx = wx.createWebAudioContext();

      // 重置滤波器的状态寄存器，防止上一轮监测的残余能量影响本次
      aFilter = new AWeightingFilter(); 
      
      offset = dataModel.getOffset();
      expectedExposure = dataModel.getExpectedExposureSeconds();
      noiseAlarmLevel = dataModel.getNoiseAlarmLevel();
      allowAlarm = dataModel.getAlarmEnabled();
      isAlarming = false;
      hasAlerted = false;
      
      // 【修改位置】：确保 timeTerm 随配置更新
      timeTerm = 10 * Math.log10(expectedExposure);
      
      // 【修改位置】：重置增量计算变量
      dBArray = []; 
      time = 0;
      frameCount = 0;
      lastFrameTimestamp = 0;
      elapsedMsAccumulator = 0;
      cne = 0;
      totalEnergySum = 0;
      globalMaxDB = -Infinity;
      globalMinDB = Infinity;
  
      console.log(`[initMonitor] offset:${offset}, expectedExposure:${expectedExposure}, noiseAlarmLevel:${noiseAlarmLevel}, allowAlarm:${allowAlarm}`);
    } catch(e) {
      console.log(e);
    } 
  },

  archive() {
    let currentDate = Date.now();
    let duration = (currentDate - startDate)/1000; 
    let formattedDate = new Date(currentDate).toLocaleString("zh-CN");
    
    let d = wx.getDeviceInfo();
    let device = d.brand + ' ' + d.model;
    let system = d.system;
    
    return {
      name: null,
      date: formattedDate,
      duration: duration.toFixed(3),
      exposure: expectedExposure,
      cne: parseFloat(this.data.cne),
      threat: this.data.threat,
      location: location,
      extra: null,
      device: device,
      system: system,
      offset: offset,
      vstamp: app.globalData.vstamp,
    };
  },

  saveResult(){
    console.group('save')
    let _save = this.archive();
    console.log("archived: ", _save)
    const savedResult = resultManager.add(_save);
    console.log("formed: ", savedResult);
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

  cleanupMonitoring: function() {
    try {
      recorderManager.stop();
    } catch (e) {
      console.log(e);
    }
    try {
      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }
    } catch (e) {
      console.log(e);
    }
  },

  stopNoiseMonitoring: function() {
    this.cleanupMonitoring();
    wx.navigateBack();
  },

  recordMyLocation() {
    wx.showLoading({ title: '获取位置信息' });
    wx.getLocation({
      type: 'gcj02',
      altitude: true,
      isHighAccuracy: true,
      highAccuracyExpireTime: 3500,
      success (res) {
        location = {
          latitude: res.latitude,
          longitude: res.longitude,
          altitude: res.altitude,
          accuracy: res.accuracy,
        }
      },
      complete() {
        wx.hideLoading();
      }
    });
  },

/**
 * @param {number} count 震动次数
 * @param {number} interval 每次震动的间隔时间（ms），建议大于 450ms (因为vibrateLong持续约400ms)
 */
doVibrate(count, interval = 600) {
  if (count <= 0) return;
  wx.vibrateLong(); // 触发长震动 (约400ms)
  let currentCount = 1;
  const timer = setInterval(() => {
    if (currentCount >= count) {
      clearInterval(timer);
      return;
    }
    wx.vibrateLong();
    currentCount++;
  }, interval);
},

  noiseDetect: function () {
    if (!mainRecorderListenerBound) {
      recorderManager.onFrameRecorded(res => { 
      const page = activeMainPage;
      if (!page) {
        return;
      }
      const resbuffer = res.frameBuffer;
      const buffer = new Int16Array(resbuffer); // 这是 Z计权 的原始数据
      
      // 1. Z 计权（无计权）计算：直接用于屏幕顶部的实时声压级显示与画图
      // 保持界面示波器的物理绝对准确性
      const energyZ = calculateRMS(buffer); 
      // 假设 calculateRMS 内部没有归一化，这里传入 32768.0 
      const dbfsZ = calculateDb(energyZ, 32768.0);
      const dbsplZ = dbfsZ + offset;

      // 2. 【核心亮点】A 计权（等响度）计算：专用于 CNE 积分与职业健康预警
      // 让原始数据通过 IIR 滤波器
      const bufferA = aFilter.process(buffer, true); // 输出已经是归一化的浮点数
      
      // 对滤波后的数据求 RMS。由于已经归一化，计算 DB 时 reference 传 1.0
      let energyA = 0;
      for (let i = 0; i < bufferA.length; i++) {
         energyA += bufferA[i] * bufferA[i];
      }
      energyA = Math.sqrt(energyA / bufferA.length);
      
      const dbfsA = calculateDb(energyA, 1.0); 
      const dbsplA = dbfsA + offset; // 这就是严谨的 dB(A) 值！

      // 3. 处理帧逻辑
      frameCount++;
      const now = Date.now();
      if (lastFrameTimestamp === 0) {
        lastFrameTimestamp = now;
        return;
      }
      elapsedMsAccumulator += (now - lastFrameTimestamp);
      lastFrameTimestamp = now;
      
      if (elapsedMsAccumulator >= 1000) {
        elapsedMsAccumulator -= 1000;
        time++; 
        
        // 示波器画图：画 Z 计权 (符合物理声学仪器习惯)
        recordArray(time, dbsplZ);
        draw(ctxf, time);
        
        // 累积能量 CNE 计算：必须使用 A 计权！
        const cneResult = calculateShortCNE(
          dbsplA, // 传入真 A 计权值参与 CNE 和 K-Factor 计算
          time,
          timeTerm,
          totalEnergySum,
          globalMaxDB,
          globalMinDB
        );
        cne = cneResult.cne;
        totalEnergySum = cneResult.totalEnergySum;
        globalMaxDB = cneResult.globalMaxDB;
        globalMinDB = cneResult.globalMinDB;

        let riskStatus = evaluateRisk(cne);
        threat = riskStatus.text; 

        // 界面数据绑定
        page.setData({
          dbfs: dbfsZ.toFixed(2),    // UI显示原始电平
          dbspl: dbsplZ.toFixed(2),  // UI显示 Z计权声压
          cne: cne.toFixed(2),       // 这是符合职业卫生标准的 A计权能量
          threat: threat,
          threatClass: riskStatus.bgClass
        });
        // main.js 中的 noiseDetect() 警报逻辑修改为：
        if (allowAlarm && cne >= noiseAlarmLevel && !isAlarming && !hasAlerted) {
          isAlarming = true;
          hasAlerted = true; // 标记本次监测已发出过警报
          wx.showModal({
            title: '警报',
            content: '噪声累积能量预计将超过健康暴露水平',
            showCancel: false,
            complete: () => { 
              isAlarming = false; 
              // 注意：这里不要重置 hasAlerted，确保本次监测期间只弹一次
            }
          });
          for(let i = 0; i < 5; i++)
          {
             page.doVibrate(5, 500);
          }
        }
      }
      });
      mainRecorderListenerBound = true;
    }

    recorderManager.start(this.recordParams);
  },
  
});