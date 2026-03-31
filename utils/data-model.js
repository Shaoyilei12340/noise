const KEYS = {
  OFFSET: 'offset',
  EXPECTED_EXPOSURE: 'expectedExposure',
  NOISE_ALARM_LEVEL: 'noiseAlarmLevel',
  ALARM: 'alarm',
};
const { STORAGE_DEFAULTS } = require('./constants');

const DEFAULTS = STORAGE_DEFAULTS;

function asValidNumber(value, fallback) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asPositiveNumber(value, fallback) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOffset() {
  return asValidNumber(wx.getStorageSync(KEYS.OFFSET), DEFAULTS.offset);
}

function setOffset(value) {
  const offset = asValidNumber(value, DEFAULTS.offset);
  wx.setStorageSync(KEYS.OFFSET, offset);
  return offset;
}

function getExpectedExposureHours() {
  return asPositiveNumber(wx.getStorageSync(KEYS.EXPECTED_EXPOSURE), DEFAULTS.expectedExposure);
}

function getExpectedExposureSeconds() {
  return getExpectedExposureHours() * 3600;
}

function setExpectedExposureHours(value) {
  const hours = asPositiveNumber(value, DEFAULTS.expectedExposure);
  wx.setStorageSync(KEYS.EXPECTED_EXPOSURE, hours);
  return hours;
}

function getNoiseAlarmLevel() {
  return asValidNumber(wx.getStorageSync(KEYS.NOISE_ALARM_LEVEL), DEFAULTS.noiseAlarmLevel);
}

function setNoiseAlarmLevel(value) {
  const level = asValidNumber(value, DEFAULTS.noiseAlarmLevel);
  wx.setStorageSync(KEYS.NOISE_ALARM_LEVEL, level);
  return level;
}

function getAlarmEnabled() {
  const value = wx.getStorageSync(KEYS.ALARM);
  return value === '' ? DEFAULTS.alarm : value !== false;
}

function setAlarmEnabled(value) {
  const enabled = value !== false;
  wx.setStorageSync(KEYS.ALARM, enabled);
  return enabled;
}

function getDefaults() {
  return {
    offset: DEFAULTS.offset,
    expectedExposure: DEFAULTS.expectedExposure,
    noiseAlarmLevel: DEFAULTS.noiseAlarmLevel,
    alarm: DEFAULTS.alarm,
  };
}

module.exports = {
  KEYS,
  getDefaults,
  getOffset,
  setOffset,
  getExpectedExposureHours,
  getExpectedExposureSeconds,
  setExpectedExposureHours,
  getNoiseAlarmLevel,
  setNoiseAlarmLevel,
  getAlarmEnabled,
  setAlarmEnabled,
};
