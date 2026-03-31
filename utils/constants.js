const RISK_THRESHOLDS = {
  SAFE_MAX: 85,
  MEDIUM_MAX: 105,
};

const CNE_FORMULA = {
  K_FACTOR_WEIGHT: 3,
  BASE_OFFSET: 44.6,
};

const STORAGE_DEFAULTS = {
  offset: 77,
  expectedExposure: 8,
  noiseAlarmLevel: 85,
  alarm: true,
};

const OFFSET_IMPORT_RANGE = {
  MIN: -200,
  MAX: 200,
};

const LIMITS = {
  INSTANT_DB_LIMIT_DEFAULT: 80,
  CALIB_TARGET_SPL: 80.0,
};

const CANVAS_CONFIG = {
  MONITOR: {
    GLOBAL_SIZE: 300,
    SCALE_X: 30,
    SCALE_Y: 2,
  },
  CALIBRATE: {
    GLOBAL_SIZE: 300,
    SCALE_X: 30,
    SCALE_Y: 3,
  },
};

const APP_CONFIG = {
  SERVER_BY_ENV: {
    default: 'http://47.117.40.74:9999',
    dev: 'http://47.117.40.74:9999',
    prod: 'http://47.117.40.74:9999',
  },
};

module.exports = {
  RISK_THRESHOLDS,
  CNE_FORMULA,
  STORAGE_DEFAULTS,
  OFFSET_IMPORT_RANGE,
  LIMITS,
  CANVAS_CONFIG,
  APP_CONFIG,
};
