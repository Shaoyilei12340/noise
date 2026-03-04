// pages/advanced-calibrate/calibrate/calibrate.js
/**
 * 专业环境声学校准页面 (calibrate.js)
 * 仅保留 1kHz 纯音标准校准 (80dB SPL)
 * 采用 3秒倒计时(防震防遮挡) + 5秒等效连续声级(Leq)积分算法
 */

const app = getApp();
const recorderManager = wx.getRecorderManager();
let audioCtx, dpr;

// --- 全局物理计算变量 ---
let offset = 0;
let dBArray =[];
let time = 0;
let frameCount = 0; 

// 校准专用积分变量 (置于 Page 外避免 setData 拖慢后台采样性能)
let isCalibrating = false;
let calibEnergySum = 0;
let calibSamples = 0;
const CALIB_TARGET_SPL = 80.0; // 固定的 1kHz 纯音参考标准

const globalSize = 300;
const scaleX = 30;
const scaleY = 3;

// --- 基础物理计算函数 ---
function calculateRMS(pcmData) {
  let sumSquares = 0;
  for (let i = 0; i < pcmData.length; i++) {
    let sample = pcmData[i];
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / pcmData.length);
}

function calculatedb(rms, reference = 32768.0) {
  return 20 * Math.log10(Math.max(rms, 1e-12) / reference);
}

function recordArray(currentTime, dBSPL) {
  dBArray[currentTime] = dBSPL;
}


// ================= 页面主逻辑 =================
Page({
  data: {
    dbfs: '0.00',
    dbspl: '0.00',
    newOffset: '0.00',
    
    // --- 新增：专门用于大字提示的 UI 状态 ---
    statusText: '等待开始...\n请将麦克风靠近声级计',
    statusColor: '#333333',
    isCalibratingUI: false // 处于校准流程中时，为 true (可用于隐藏 Canvas)
  },
  isPageActive: false,
  // 核心录音配置：无处理的原始音频
  recordParams: {
    duration: 10000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 48000, 
    format: 'PCM',
    frameSize: 16,
    audioSource: 'camcorder', 
  },
  
  onShow() {
    this.isPageActive = true;
    this.initMonitor();
    this.setupRecorderListeners(); // 新增：统一挂载录音监听器
    this.noiseDetect();
  },

  onHide() { 
    this.isPageActive = false;
    this.stopNoiseMonitoring(); 
  },
  
  onUnload() { 
    this.isPageActive = false;
    this.stopNoiseMonitoring(); 
  },

  initMonitor() {
    try {
      offset = wx.getStorageSync('offset') || 0;
      audioCtx = wx.createWebAudioContext();
      dBArray = [0];
      time = 0;
      frameCount = 0;
      isCalibrating = false;
      this.setData({ isCalibratingUI: false });
    } catch(e) { console.error(e); }
  },

  // 新增的专门处理录音机生命周期的函数
  setupRecorderListeners() {
    // 1. 监听意外停止
    recorderManager.onStop((res) => {
      console.log('[Recorder] Stopped', res);
      // 核心修复：如果页面还在前台，说明是被系统弹窗打断的，自动重启！
      if (this.isPageActive) {
        console.log('[Recorder] 尝试自动恢复录音...');
        setTimeout(() => {
          recorderManager.start(this.recordParams);
        }, 500); 
      }
    });

    // 2. 监听系统级打断恢复 (如接完电话切回)
    recorderManager.onInterruptionEnd(() => {
      if (this.isPageActive) {
        recorderManager.start(this.recordParams);
      }
    });

    // 3. 原本的帧回调逻辑 (直接把原来的代码搬过来)
    recorderManager.onFrameRecorded(res => { 
      const buffer = new Int16Array(res.frameBuffer);
      
      // -- 常规瞬间计算 --
      const energy = calculateRMS(buffer);
      const dbfs = calculatedb(energy);
      const dbspl = dbfs + offset;

      if (!this.data.isCalibratingUI) {
        frameCount++;
        if (frameCount % 2 === 0) {
          time++;
          recordArray(time, dbspl); 
        }
      }

      // -- 核心优化：校准能量积分 (Leq) --
      if (isCalibrating) {
        for (let i = 0; i < buffer.length; i++) {
          let sample = buffer[i] / 32768.0; 
          calibEnergySum += (sample * sample);
        }
        calibSamples += buffer.length;
      }

      this.setData({
        dbfs: dbfs.toFixed(2),
        dbspl: dbspl.toFixed(2),
      }); 
    });
  },

  stopNoiseMonitoring() {
    recorderManager.stop();
    if (audioCtx) audioCtx.close();
  },

  // ================= 严格校准交互流程 =================

  // 1. 唯一校准入口 (仅 1kHz, 80dB)
  startCalibrationProcess() {
    if (isCalibrating || this.data.isCalibratingUI) return;
    recorderManager.start(this.recordParams);
    this.setData({ isCalibratingUI: true });

    let countdown = 3;
    const showCountdown = () => {
      if (countdown > 0) {
        // 倒数标红，提示退后
        this.setData({
          statusText: `准备中：${countdown} 秒\n请松开手机，后退并保持绝对安静！`,
          statusColor: '#FF0000' // 红色警告
        });
        countdown--;
        setTimeout(showCountdown, 1000);
      } else {
        this.executeIntegration();
      }
    };
    showCountdown();
  },

  // 2. 执行5秒物理采样积分
  executeIntegration() {
    calibEnergySum = 0;
    calibSamples = 0;
    isCalibrating = true;

    // 录制标绿
    this.setData({
      statusText: `正在采集中 (5秒)...\n请勿发出任何声响`,
      statusColor: '#FF66BB' 
    });

    setTimeout(() => {
      isCalibrating = false;
      this.finalizeCalibration();
    }, 5000);
  },

  // 3. 计算最终结果并准备保存
  finalizeCalibration() {
    if (calibSamples === 0) {
      this.setData({
        statusText: '采样失败',
        statusColor: '#e64340',
        isCalibratingUI: false
      });
      return;
    }

    // 计算5秒平均能量 -> 求RMS -> 转对数dBFS
    const meanSquare = calibEnergySum / calibSamples;
    const rms = Math.sqrt(meanSquare);
    const leqDbfs = calculatedb(rms, 1.0); 
    
    // 偏移量 = 真实基准声压(80) - 测得数字分贝
    const calibrationOffset = CALIB_TARGET_SPL - leqDbfs;

    this.setData({
      newOffset: calibrationOffset.toFixed(2),
      statusText: `校准完成！\nLeq dBFS: ${leqDbfs.toFixed(2)}\n计算偏移量: ${calibrationOffset.toFixed(2)} dB`,
      statusColor: '#11FF11',
      isCalibratingUI: false
    });
    this.stopNoiseMonitoring();
    this.saveOffset();
  },

  // 4. 保存并应用逻辑
  saveOffset() {
    let that = this;
    let offsetVal = parseFloat(this.data.newOffset);
    
    wx.showModal({
      title: "应用校准结果",
      content: `1kHz基准计算偏移量为：${offsetVal} dB\n是否立即覆盖当前设备配置？`,
      success(res) {
        if (res.confirm) {
          wx.setStorageSync('offset', offsetVal);
          offset = offsetVal; 
          wx.showToast({ title: '校准已生效', icon: 'success' });
        }
      },
      complete() {
        if (that.isPageActive) {
          recorderManager.start(that.recordParams);
        }
      }
    });
  },

  // ================= 实时后台采样 =================
  noiseDetect() {
    recorderManager.start(this.recordParams);
  }
});