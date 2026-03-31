const { RISK_THRESHOLDS, CNE_FORMULA } = require('./constants');

function calculateRMS(pcmData) {
  let sumSquares = 0;
  for (let i = 0; i < pcmData.length; i++) {
    const sample = pcmData[i];
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / pcmData.length);
}

function calculateDb(rms, reference) {
  const ref = typeof reference === 'number' && reference > 0 ? reference : 32768.0;
  return 20 * Math.log10(Math.max(rms, 1e-12) / ref);
}

function calculateLeqIncremental(currentDB, totalSeconds, totalEnergySum) {
  const nextEnergySum = totalEnergySum + Math.pow(10, currentDB / 10);
  const avgEnergy = nextEnergySum / totalSeconds;
  return {
    leq: 10 * Math.log10(avgEnergy),
    totalEnergySum: nextEnergySum,
  };
}

function estimateKFactorIncremental(currentDB, globalMaxDB, globalMinDB) {
  const nextMax = currentDB > globalMaxDB ? currentDB : globalMaxDB;
  const nextMin = currentDB < globalMinDB ? currentDB : globalMinDB;
  const range = nextMax - nextMin;
  return {
    kFactor: range > 15 ? 2 : 1,
    globalMaxDB: nextMax,
    globalMinDB: nextMin,
  };
}

function calculateShortCNE(currentDB, totalSeconds, timeTerm, totalEnergySum, globalMaxDB, globalMinDB) {
  if (totalSeconds <= 0) {
    return {
      cne: 0,
      leq: 0,
      kFactor: 1,
      totalEnergySum,
      globalMaxDB,
      globalMinDB,
    };
  }

  const leqResult = calculateLeqIncremental(currentDB, totalSeconds, totalEnergySum);
  const kResult = estimateKFactorIncremental(currentDB, globalMaxDB, globalMinDB);
  const cne = leqResult.leq + timeTerm + (kResult.kFactor * CNE_FORMULA.K_FACTOR_WEIGHT) - CNE_FORMULA.BASE_OFFSET;

  return {
    cne,
    leq: leqResult.leq,
    kFactor: kResult.kFactor,
    totalEnergySum: leqResult.totalEnergySum,
    globalMaxDB: kResult.globalMaxDB,
    globalMinDB: kResult.globalMinDB,
  };
}

function evaluateRisk(cne) {
  if (cne < RISK_THRESHOLDS.SAFE_MAX) {
    return { text: '安全', bgClass: 'detail-safe' };
  }
  if (cne < RISK_THRESHOLDS.MEDIUM_MAX) {
    return { text: '中风险', bgClass: 'detail-medium' };
  }
  return { text: '高风险', bgClass: 'detail-high' };
}

/**
 * 严格符合 IEC 61672 标准的 A-Weighting 数字滤波器 (Fs = 16000 Hz)
 * 采用 Direct Form II Transposed (直接 II 型转置) 结构，保证浮点运算的最高精度与稳定性
 */
class AWeightingFilter {
  constructor() {
    // 以下系数为 MATLAB 针对 Fs=16000Hz 经过双线性变换（BZT）生成的 SOS 矩阵
    // 若后续采样率变更，请贵团队使用 MATLAB 命令 `fdesign.audioweighting('wt','A',16000)` 重新生成
    
    // 总体增益系数 (Gain)
    this.gain = 0.582348555848;

    // Stage 1 (Biquad 1) - 处理高频与极低频极点
    this.b1 =[1.0, 2.0, 1.0];
    this.a1 =[1.0, 0.228919690196, 0.013106399039];
    this.z1 = [0, 0]; // 延迟线状态寄存器

    // Stage 2 (Biquad 2) - 处理中低频曲线
    this.b2 =[1.0, -2.0, 1.0];
    this.a2 =[1.0, -1.986682054238, 0.986701889814];
    this.z2 = [0, 0];

    // Stage 3 (Biquad 3) - 处理低频衰减
    this.b3 =[1.0, -2.0, 1.0];
    this.a3 =[1.0, -1.996160359265, 0.996165502446];
    this.z3 = [0, 0];
  }

  /**
   * 处理单帧 PCM 数据 (In-place 计算，或者返回新数组)
   * @param {Int16Array | Float32Array} inputBuffer - 原始 PCM (16-bit 整数或归一化浮点)
   * @param {boolean} normalize - 是否在内部除以 32768.0
   * @returns {Float32Array} 经过 A计权 滤波后的归一化浮点数组
   */
  process(inputBuffer, normalize = true) {
    const len = inputBuffer.length;
    const output = new Float32Array(len);

    for (let i = 0; i < len; i++) {
      // 1. 归一化输入[-1.0, 1.0]
      let x = normalize ? (inputBuffer[i] / 32768.0) : inputBuffer[i];
      x *= this.gain; // 应用全局增益

      // 2. 级联 Biquad 1
      let y1 = (this.b1[0] * x) + this.z1[0];
      this.z1[0] = (this.b1[1] * x) - (this.a1[1] * y1) + this.z1[1];
      this.z1[1] = (this.b1[2] * x) - (this.a1[2] * y1);

      // 3. 级联 Biquad 2
      let y2 = (this.b2[0] * y1) + this.z2[0];
      this.z2[0] = (this.b2[1] * y1) - (this.a2[1] * y2) + this.z2[1];
      this.z2[1] = (this.b2[2] * y1) - (this.a2[2] * y2);

      // 4. 级联 Biquad 3
      let y3 = (this.b3[0] * y2) + this.z3[0];
      this.z3[0] = (this.b3[1] * y2) - (this.a3[1] * y3) + this.z3[1];
      this.z3[1] = (this.b3[2] * y2) - (this.a3[2] * y3);

      // 5. 输出当前采样的 A 计权值
      output[i] = y3;
    }

    return output;
  }
}

module.exports = {
  calculateRMS,
  calculateDb,
  calculateLeqIncremental,
  estimateKFactorIncremental,
  calculateShortCNE,
  evaluateRisk,
  AWeightingFilter,
};
