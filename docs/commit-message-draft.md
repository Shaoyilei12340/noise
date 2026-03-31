# Commit Message Draft

## 建议提交标题
refactor(core): unify audio math/data model/result manager and centralize constants

## 建议提交正文
- add shared utility modules:
  - utils/audio-math.js
  - utils/data-model.js
  - utils/result-manager.js
  - utils/constants.js
- refactor monitor/calibration/settings/result pages to use shared modules
- align app init defaults with centralized config source
- harden advanced calibration import with offset range validation
- add missing page navigation titles for profile and 1kHz calibration page
- add manual regression checklist for end-to-end verification

## 建议拆分提交（可选）
1. feat(utils): add shared audio/data/result/constants modules
2. refactor(pages): migrate main/calibrate/advanced-calibrate/settings/result to shared modules
3. chore(config): align app defaults and page titles
4. docs(test): add manual regression checklist and change summary

## 提交前建议
1. 仅暂存本轮重构涉及文件，避免混入无关 UI 改动。
2. 保持 images 外部资源改动不纳入本轮提交（按当前决策）。
