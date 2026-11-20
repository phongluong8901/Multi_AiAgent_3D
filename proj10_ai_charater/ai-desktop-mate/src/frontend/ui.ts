import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { appState, PRESET_ALICIA_URL, PRESET_VRM1_URL } from '../core/state';
import { applyRendererEcoQuality } from '../core/scene';
import {
  AUTO_BEHAVIOR_CATALOG,
  AutoBehaviorKey,
  CapturedWindowFrame,
  ChatEntry,
  createDefaultAutoBehaviors,
  CustomSkillRecord,
  IngestedFileAnalysis,
  MiniWebStatus,
  MiniWindowEntry,
  OcrRegionResult,
  ScheduledNoteEntry,
  TarotReadingRecord,
  TarotStatusResponse,
  ToolForgeDraft,
  TranslateResult,
  WeatherEffectMode,
} from '../core/types';
import {
  spawnParticles,
  spawnScanEffect,
  triggerDuckTarot3DFlipEffect,
} from '../core/particles';
import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  playAlertBeep,
  playSuccessChimeSound,
  playTarotFlipSound,
} from '../core/soundFx';
import {
  triggerBackflip,
  triggerBlackHoleTeleport,
  triggerClimbWindow,
  triggerDuckRadarScan,
  triggerDuckSleepMode,
  triggerDuckWheelRoll,
  triggerExploreInsideWindow,
  triggerInteractInsideWindow,
  triggerJumpToWindow,
  triggerSpawnRandomFood,
  triggerSpin,
  triggerStartSwimming,
  triggerStopSwimming,
  triggerWindowSwing,
  isWaterPoolActive,
} from '../physics/physics';
import {
  fetchNotificationHistory,
  fetchNotificationSettings,
  updateNotificationSettings,
  clearNotificationHistory,
  triggerTestNotification,
  scanRunningWindowsApps,
  listenToDesktopNotifications,
  NotificationSettings,
} from '../backend/notificationService';
import {
  clearCachedVrm,
  loadCachedVrm,
  loadVrmFromBlobUrl,
  loadVrmFromUrl,
  applyVrmScaleAndOffset,
  applyGlbScaleAndOffset,
} from '../characters/vrmManager';
import {
  createDetailedAnimeCharacter,
  createMicroDuckCharacter,
  switchBuiltinCharacterType,
  equipAccessory3D,
  rigRoot,
} from '../characters/characterRig';
import {
  clearTemporaryAccessoryTimer,
  triggerGooseMischiefMode,
  triggerManualBeatDance,
  triggerTerritoryDefenseMode,
} from '../core/rhythmAndGoose';
import {
  disconnectP2pRoom,
  emergencyReleaseP2pControl,
  getP2pCombatVitals,
  getP2pStatusSnapshot,
  initP2pArena,
  isP2pCombatControlsActive,
  isP2pDuelActive,
  LanPeerInfo,
  migrateDuckOutToPeer,
  performP2pSkill,
  recallDuckFromPeer,
  refreshP2pStatus,
  registerP2pCallbacks,
  requestP2pHandshake,
  respondP2pHandshake,
  sendWinnerRemoteCmd,
  setCrossScreenAutoMigrate,
  setLiveMouseStreamEnabled,
  setP2pBulletShield,
  startP2pPkMatch,
  startSimPeerTest,
  triggerP2pBlackHoleHide,
  triggerP2pMove,
} from '../core/p2pArena';
import {
  autoCheckEnabled,
  chatWithLocalLlm,
  clearLocalMemory,
  cpuAlertPct,
  geminiApiKey,
  geminiModel,
  isAssistantBusy,
  llmRouteMode,
  loadAndSpeakLiveNews,
  loadNextEnglishLesson,
  handleDroppedAnyFile,
  ollamaModel,
  playEnglishVocabAudio,
  ramAlertGb,
  refreshLongMemoryUi,
  resetContentScheduleTimer,
  runBitcoinCheck,
  runCheckAppMetrics,
  runClipboardTool,
  runEnglishMiniQuiz,
  runFullDashboardScan,
  runGeminiVisionScreen,
  runGitStatusCheck,
  runHardwareAction,
  runHardwareCheck,
  runMacroRoutine,
  runMemoryCheck,
  runNetworkCheck,
  runOcrAndSummarize,
  runOpenLatestScreenshot,
  runPcMedia,
  runPcOpen,
  runPcScreenshot,
  runPortManager,
  runProcessManager,
  runShowSuggestion,
  runSmartDbSupportBriefing,
  summarizeLastIngestedFile,
  syncLiveWeather3D,
  translateTextWithAi,
  triggerRandomFeatureOrEffect,
  triggerScheduledContentNow,
  saveLongMemoryEntry,
  setAutoCheckEnabled,
  setCpuAlertPct,
  setGeminiApiKey,
  setGeminiModel,
  setLlmRouteMode,
  setOllamaModel,
  setRamAlertGb,
  updateStudioWeatherPreviewUi,
  LlmRouteMode,
} from '../backend/assistant';
import {
  arrangeDesktopWindows,
  findTargetWindow,
  performWindowAction,
  startPhysicalPush,
  startPhysicalResize,
} from '../physics/windowInteract';
import {
  arrangeDesktopIcons,
  fetchDesktopIcons,
  startDragDesktopIcon,
} from '../physics/desktopIconInteract';
import { mountUi } from './components/mountUi';
import { renderDataExpertDashboardCharts } from './components/dataChartEngine';
import {
  confirmAndSaveToolDraft,
  executeSavedSkillWithSelfHeal,
  forgeNewToolFromRequest,
  getCachedCustomSkills,
  getLatestToolForgeDraft,
  parseExpectedKeywords,
  parseTriggers,
  refreshCustomSkills,
  runDraftInSandbox,
  selfHealDraftWithGemini,
  setLatestToolForgeDraft,
} from '../backend/toolForge';

export let leftTelemetryPanel!: HTMLElement;
export let rightActionPanel!: HTMLElement;
export let speechBubble!: HTMLDivElement;
export let chatDialogPanel!: HTMLElement;
export let companionDock!: HTMLDivElement;
export let studioPanel!: HTMLDivElement;
export let longMemoryPanel!: HTMLElement;
export let notificationPanel!: HTMLDivElement;
export let p2pArenaPanel!: HTMLDivElement;
export let pcControlModal!: HTMLDivElement;
export let ocrTranslateModal!: HTMLDivElement;
export let toolForgeModal!: HTMLDivElement;
export let tarotModal!: HTMLDivElement;
export let miniScreenPanel!: HTMLDivElement;
export let fileInput!: HTMLInputElement;

let btnCloseLeft!: HTMLButtonElement;
let btnCloseRight!: HTMLButtonElement;
let btnRefreshAll!: HTMLButtonElement;
let bubbleContent!: HTMLDivElement;
let timerBadge!: HTMLSpanElement;
let btnMinimizeBubble!: HTMLButtonElement;
let btnCloseChat!: HTMLButtonElement;
let btnClearChat!: HTMLButtonElement;
let btnOpenChatFromBubble!: HTMLButtonElement;
let chatHistoryList!: HTMLDivElement;
let btnActHw!: HTMLButtonElement;
let btnActAppMetrics!: HTMLButtonElement;
let btnActNet!: HTMLButtonElement;
let btnActBtc!: HTMLButtonElement;
let btnActMem!: HTMLButtonElement;
let btnActSmartSupport!: HTMLButtonElement;
let btnActSuggest!: HTMLButtonElement;
let btnClearMemory!: HTMLButtonElement;
let suggestionActions!: HTMLDivElement;
let btnSugAccept!: HTMLButtonElement;
let btnSugDismiss!: HTMLButtonElement;
let btnActJump!: HTMLButtonElement;
let btnActDance!: HTMLButtonElement;
let btnActPat!: HTMLButtonElement;
let btnActFlip!: HTMLButtonElement;
let btnActSpin!: HTMLButtonElement;
let btnActDuck!: HTMLButtonElement;
let btnActWheel!: HTMLButtonElement;
let btnActRadar!: HTMLButtonElement;
let btnActSleep!: HTMLButtonElement;
let btnActTimer!: HTMLButtonElement;
let btnActCenter!: HTMLButtonElement;
let btnActFeed!: HTMLButtonElement;
let btnActClimb!: HTMLButtonElement;
let btnActEnterWin!: HTMLButtonElement;
let btnActFrameKey!: HTMLButtonElement;
let btnPcYt!: HTMLButtonElement;
let btnPcShot!: HTMLButtonElement;
let btnPcOpenShot!: HTMLButtonElement;
let btnPcNote!: HTMLButtonElement;
let btnPcCleanRam!: HTMLButtonElement;
let btnPcBrightDown!: HTMLButtonElement;
let btnPcBrightUp!: HTMLButtonElement;
let btnPcVision!: HTMLButtonElement;
let btnPcOcr!: HTMLButtonElement;
let btnPcVolDown!: HTMLButtonElement;
let btnPcPlay!: HTMLButtonElement;
let btnPcVolUp!: HTMLButtonElement;
let btnPcTopProc!: HTMLButtonElement;
let btnPcClipboard!: HTMLButtonElement;
let btnPcStickyNote!: HTMLButtonElement;
let btnPcPorts!: HTMLButtonElement;
let btnPcGit!: HTMLButtonElement;
let btnPcMacro!: HTMLButtonElement;
let btnPcGoogle!: HTMLButtonElement;
let btnPcGoogleSearch!: HTMLButtonElement;
let inputPcGoogleQuery!: HTMLInputElement;
let btnPcOcrRegion!: HTMLButtonElement;
let btnPcToolForge!: HTMLButtonElement;
let btnPcMiniScreen!: HTMLButtonElement;
let btnClosePcControl!: HTMLButtonElement;
let btnActEdgePeek!: HTMLButtonElement;
let btnActSwing!: HTMLButtonElement;
let btnActWeather3D!: HTMLButtonElement;
let btnActDefend!: HTMLButtonElement;
let btnActRandomFx!: HTMLButtonElement;
let btnActNews!: HTMLButtonElement;
let btnActEnglish!: HTMLButtonElement;
let stickyNotesWidget: HTMLDivElement | null = null;
let stickyNotesListEl: HTMLDivElement | null = null;
let winTargetName!: HTMLDivElement;
let selectActiveWin!: HTMLSelectElement;
let selectDesktopIcon!: HTMLSelectElement;
let btnIconRefresh!: HTMLButtonElement;
let btnIconDrag!: HTMLButtonElement;
let btnIconCircle!: HTMLButtonElement;
let btnIconGrid!: HTMLButtonElement;
let btnIconRestore!: HTMLButtonElement;
let btnWinPushL!: HTMLButtonElement;
let btnWinPushR!: HTMLButtonElement;
let btnWinShrink!: HTMLButtonElement;
let btnWinExpand!: HTMLButtonElement;
let btnWinMin!: HTMLButtonElement;
let btnWinSplit!: HTMLButtonElement;
let btnWinGrid!: HTMLButtonElement;
let btnWinCascade!: HTMLButtonElement;
let btnWinCenter!: HTMLButtonElement;
let bubbleInput!: HTMLInputElement;
let btnSendMsg!: HTMLButtonElement;
let btnOpenStudio!: HTMLButtonElement;
let btnLoadVrm!: HTMLButtonElement;
let dockBtnLeft!: HTMLButtonElement;
let dockBtnChat!: HTMLButtonElement;
let dockBtnRight!: HTMLButtonElement;
let dockBtnPcControl!: HTMLButtonElement;
let dockBtnMiniScreen!: HTMLButtonElement;
let dockBtnStudio!: HTMLButtonElement;
let dockBtnEdgePeek!: HTMLButtonElement;
let btnCloseStudio!: HTMLButtonElement;
let presetAlicia!: HTMLButtonElement;
let presetVrm1!: HTMLButtonElement;
let presetBuiltin!: HTMLButtonElement;
let presetMicroduck!: HTMLButtonElement;
let vrmUrlInput!: HTMLInputElement;
let btnLoadUrl!: HTMLButtonElement;
let btnStudioFile!: HTMLButtonElement;
let colorDuckBody!: HTMLInputElement;
let colorDuckAccent!: HTMLInputElement;
let sliderScale!: HTMLInputElement;
let valScale!: HTMLSpanElement;
let sliderGravity!: HTMLInputElement;
let valGravity!: HTMLSpanElement;
let sliderBounce!: HTMLInputElement;
let valBounce!: HTMLSpanElement;
let chkSoundFx!: HTMLInputElement;
let sliderSoundVolume!: HTMLInputElement;
let valSoundVolume!: HTMLSpanElement;
let chkAutoroam!: HTMLInputElement;
let chkLookat!: HTMLInputElement;
let chkWinInteract!: HTMLInputElement;
let inputAutoActionSec!: HTMLInputElement;
let autoBehaviorsListEl!: HTMLDivElement;
let autoBehaviorCountBadge!: HTMLSpanElement;
let btnAutoBehAll!: HTMLButtonElement;
let btnAutoBehDefault!: HTMLButtonElement;
let btnAutoBehNone!: HTMLButtonElement;
let inputOllamaModel!: HTMLInputElement;
let inputGeminiKey!: HTMLInputElement;
let inputGeminiModel!: HTMLInputElement;
let selectLlmRoute!: HTMLSelectElement;
let chkAutocheck!: HTMLInputElement;
let inputAlertCpu!: HTMLInputElement;
let inputAlertRam!: HTMLInputElement;
let btnOpenLongMem!: HTMLButtonElement;
let btnCloseLongMem!: HTMLButtonElement;
let lmPresetCute!: HTMLButtonElement;
let lmPresetDev!: HTMLButtonElement;
let lmPresetTsun!: HTMLButtonElement;
let lmPersonaInput!: HTMLTextAreaElement;
let btnSavePersona!: HTMLButtonElement;
let lmCatSelect!: HTMLSelectElement;
let lmTitleInput!: HTMLInputElement;
let lmContentInput!: HTMLInputElement;
let btnAddLongMem!: HTMLButtonElement;

let btnActBlackHole!: HTMLButtonElement;
let btnActHat!: HTMLButtonElement;
let btnActBeat!: HTMLButtonElement;
let btnActGoose!: HTMLButtonElement;
let btnActSwim!: HTMLButtonElement;
let btnOpenNotif!: HTMLButtonElement;
let dockBtnP2p!: HTMLButtonElement;
let dockBtnTarot!: HTMLButtonElement;
let dockTarotReadyDot!: HTMLSpanElement;
let btnCloseNotif!: HTMLButtonElement;
let btnCloseP2p!: HTMLButtonElement;
let notifMasterToggle!: HTMLInputElement;
let notifTtsToggle!: HTMLInputElement;
let notifReactToggle!: HTMLInputElement;
let tabBtnWinNotif!: HTMLButtonElement;
let tabBtnWebNotif!: HTMLButtonElement;
let tabBtnHistNotif!: HTMLButtonElement;
let tabContentWinNotif!: HTMLDivElement;
let tabContentWebNotif!: HTMLDivElement;
let tabContentHistNotif!: HTMLDivElement;
let btnScanWinApps!: HTMLButtonElement;
let btnTestWinNotif!: HTMLButtonElement;
let inputNewWinApp!: HTMLInputElement;
let btnAddWinApp!: HTMLButtonElement;
let containerWinApps!: HTMLDivElement;
let btnTestWebNotif!: HTMLButtonElement;
let btnCopyWebhookUrl!: HTMLButtonElement;
let btnCopyCurlCmd!: HTMLButtonElement;
let inputNewWebOrigin!: HTMLInputElement;
let btnAddWebOrigin!: HTMLButtonElement;
let containerWebOrigins!: HTMLDivElement;
let btnClearNotifHistory!: HTMLButtonElement;
let containerNotifHistory!: HTMLDivElement;

let tabBtnStudioSystem!: HTMLButtonElement;
let tabBtnStudioAvatar!: HTMLButtonElement;
let tabBtnStudioPhysics!: HTMLButtonElement;
let tabBtnStudioLlm!: HTMLButtonElement;
let studioTabSystem!: HTMLDivElement;
let studioTabAvatar!: HTMLDivElement;
let studioTabPhysics!: HTMLDivElement;
let studioTabLlm!: HTMLDivElement;
let chkCfgVoiceTts!: HTMLInputElement;
let btnToggleChatSide!: HTMLButtonElement;
let selectChatDockSide!: HTMLSelectElement;
let inputCfgEnglishMin!: HTMLInputElement;
let inputCfgNewsMin!: HTMLInputElement;
let inputCfgWeatherMin!: HTMLInputElement;
let inputCfgAppMetricsMin!: HTMLInputElement;
let inputCfgBtcMin!: HTMLInputElement;
let selectCfgWeatherSource!: HTMLSelectElement;
let cfgWeatherApiBox!: HTMLDivElement;
let cfgWeatherCustomBox!: HTMLDivElement;
let inputCfgWeatherCity!: HTMLInputElement;
let selectCfgWeatherCustomMode!: HTMLSelectElement;
let inputCfgWeatherTemp!: HTMLInputElement;
let inputCfgWeatherHum!: HTMLInputElement;
let inputCfgWeatherLoc!: HTMLInputElement;
let inputCfgWeatherDesc!: HTMLInputElement;
let studioOllamaStatus!: HTMLSpanElement;
let studioGeminiStatus!: HTMLSpanElement;
let btnScanOllamaModels!: HTMLButtonElement;
let ollamaModelsChips!: HTMLDivElement;
let btnToggleGeminiKey!: HTMLButtonElement;

function bindDomRefs() {
  leftTelemetryPanel = document.getElementById('left-telemetry-panel') as HTMLElement;
  rightActionPanel = document.getElementById('right-action-panel') as HTMLElement;
  btnCloseLeft = document.getElementById('btn-close-left') as HTMLButtonElement;
  btnCloseRight = document.getElementById('btn-close-right') as HTMLButtonElement;
  btnRefreshAll = document.getElementById('btn-refresh-all') as HTMLButtonElement;

  speechBubble = document.getElementById('speech-bubble') as HTMLDivElement;
  bubbleContent = document.getElementById('bubble-content') as HTMLDivElement;
  timerBadge = document.getElementById('timer-badge') as HTMLSpanElement;
  btnMinimizeBubble = document.getElementById('btn-minimize-bubble') as HTMLButtonElement;
  chatDialogPanel = document.getElementById('chat-dialog-panel') as HTMLElement;
  btnCloseChat = document.getElementById('btn-close-chat') as HTMLButtonElement;
  btnClearChat = document.getElementById('btn-clear-chat') as HTMLButtonElement;
  btnOpenChatFromBubble = document.getElementById('btn-open-chat-from-bubble') as HTMLButtonElement;
  chatHistoryList = document.getElementById('chat-history-list') as HTMLDivElement;
  btnActHw = document.getElementById('btn-act-hw') as HTMLButtonElement;
  btnActAppMetrics = document.getElementById('btn-act-app-metrics') as HTMLButtonElement;
  btnActNet = document.getElementById('btn-act-net') as HTMLButtonElement;
  btnActBtc = document.getElementById('btn-act-btc') as HTMLButtonElement;
  btnActMem = document.getElementById('btn-act-mem') as HTMLButtonElement;
  btnActSmartSupport = document.getElementById('btn-act-smart-support') as HTMLButtonElement;
  btnActSuggest = document.getElementById('btn-act-suggest') as HTMLButtonElement;
  btnClearMemory = document.getElementById('btn-clear-memory') as HTMLButtonElement;
  suggestionActions = document.getElementById('suggestion-actions') as HTMLDivElement;
  btnSugAccept = document.getElementById('btn-sug-accept') as HTMLButtonElement;
  btnSugDismiss = document.getElementById('btn-sug-dismiss') as HTMLButtonElement;
  btnActJump = document.getElementById('btn-act-jump') as HTMLButtonElement;
  btnActDance = document.getElementById('btn-act-dance') as HTMLButtonElement;
  btnActPat = document.getElementById('btn-act-pat') as HTMLButtonElement;
  btnActFlip = document.getElementById('btn-act-flip') as HTMLButtonElement;
  btnActSpin = document.getElementById('btn-act-spin') as HTMLButtonElement;
  btnActDuck = document.getElementById('btn-act-duck') as HTMLButtonElement;
  btnActWheel = document.getElementById('btn-act-wheel') as HTMLButtonElement;
  btnActRadar = document.getElementById('btn-act-radar') as HTMLButtonElement;
  btnActSleep = document.getElementById('btn-act-sleep') as HTMLButtonElement;
  btnActTimer = document.getElementById('btn-act-timer') as HTMLButtonElement;
  btnActCenter = document.getElementById('btn-act-center') as HTMLButtonElement;
  btnActFeed = document.getElementById('btn-act-feed') as HTMLButtonElement;
  btnActClimb = document.getElementById('btn-act-climb') as HTMLButtonElement;
  btnActEnterWin = document.getElementById('btn-act-enter-win') as HTMLButtonElement;
  btnActFrameKey = document.getElementById('btn-act-frame-key') as HTMLButtonElement;
  btnPcYt = document.getElementById('btn-pc-yt') as HTMLButtonElement;
  btnPcShot = document.getElementById('btn-pc-shot') as HTMLButtonElement;
  btnPcOpenShot = document.getElementById('btn-pc-openshot') as HTMLButtonElement;
  btnPcNote = document.getElementById('btn-pc-note') as HTMLButtonElement;
  btnPcCleanRam = document.getElementById('btn-pc-cleanram') as HTMLButtonElement;
  btnPcBrightDown = document.getElementById('btn-pc-brightdown') as HTMLButtonElement;
  btnPcBrightUp = document.getElementById('btn-pc-brightup') as HTMLButtonElement;
  btnPcVision = document.getElementById('btn-pc-vision') as HTMLButtonElement;
  btnPcOcr = document.getElementById('btn-pc-ocr') as HTMLButtonElement;
  btnPcVolDown = document.getElementById('btn-pc-voldown') as HTMLButtonElement;
  btnPcPlay = document.getElementById('btn-pc-play') as HTMLButtonElement;
  btnPcVolUp = document.getElementById('btn-pc-volup') as HTMLButtonElement;
  btnPcTopProc = document.getElementById('btn-pc-topproc') as HTMLButtonElement;
  btnPcClipboard = document.getElementById('btn-pc-clipboard') as HTMLButtonElement;
  btnPcStickyNote = document.getElementById('btn-pc-stickynote') as HTMLButtonElement;
  btnPcPorts = document.getElementById('btn-pc-ports') as HTMLButtonElement;
  btnPcGit = document.getElementById('btn-pc-git') as HTMLButtonElement;
  btnPcMacro = document.getElementById('btn-pc-macro') as HTMLButtonElement;
  btnPcGoogle = document.getElementById('btn-pc-google') as HTMLButtonElement;
  btnPcGoogleSearch = document.getElementById('btn-pc-google-search') as HTMLButtonElement;
  inputPcGoogleQuery = document.getElementById('input-pc-google-query') as HTMLInputElement;
  btnPcOcrRegion = document.getElementById('btn-pc-ocr-region') as HTMLButtonElement;
  btnPcToolForge = document.getElementById('btn-pc-tool-forge') as HTMLButtonElement;
  btnPcMiniScreen = document.getElementById('btn-pc-mini-screen') as HTMLButtonElement;
  btnClosePcControl = document.getElementById('btn-close-pc-control') as HTMLButtonElement;
  btnActEdgePeek = document.getElementById('btn-act-edge-peek') as HTMLButtonElement;
  btnActSwing = document.getElementById('btn-act-swing') as HTMLButtonElement;
  btnActWeather3D = document.getElementById('btn-act-weather3d') as HTMLButtonElement;
  btnActDefend = document.getElementById('btn-act-defend') as HTMLButtonElement;
  btnActRandomFx = document.getElementById('btn-act-random-fx') as HTMLButtonElement;
  btnActNews = document.getElementById('btn-act-news') as HTMLButtonElement;
  btnActEnglish = document.getElementById('btn-act-english') as HTMLButtonElement;
  winTargetName = document.getElementById('win-target-name') as HTMLDivElement;
  selectActiveWin = document.getElementById('select-active-win') as HTMLSelectElement;
  selectDesktopIcon = document.getElementById('select-desktop-icon') as HTMLSelectElement;
  btnIconRefresh = document.getElementById('btn-icon-refresh') as HTMLButtonElement;
  btnIconDrag = document.getElementById('btn-icon-drag') as HTMLButtonElement;
  btnIconCircle = document.getElementById('btn-icon-circle') as HTMLButtonElement;
  btnIconGrid = document.getElementById('btn-icon-grid') as HTMLButtonElement;
  btnIconRestore = document.getElementById('btn-icon-restore') as HTMLButtonElement;
  btnWinPushL = document.getElementById('btn-win-push-l') as HTMLButtonElement;
  btnWinPushR = document.getElementById('btn-win-push-r') as HTMLButtonElement;
  btnWinShrink = document.getElementById('btn-win-shrink') as HTMLButtonElement;
  btnWinExpand = document.getElementById('btn-win-expand') as HTMLButtonElement;
  btnWinMin = document.getElementById('btn-win-min') as HTMLButtonElement;
  btnWinSplit = document.getElementById('btn-win-split') as HTMLButtonElement;
  btnWinGrid = document.getElementById('btn-win-grid') as HTMLButtonElement;
  btnWinCascade = document.getElementById('btn-win-cascade') as HTMLButtonElement;
  btnWinCenter = document.getElementById('btn-win-center') as HTMLButtonElement;
  bubbleInput = document.getElementById('bubble-input') as HTMLInputElement;
  btnSendMsg = document.getElementById('btn-send-msg') as HTMLButtonElement;
  btnOpenStudio = document.getElementById('btn-open-studio') as HTMLButtonElement;
  btnLoadVrm = document.getElementById('btn-load-vrm') as HTMLButtonElement;

  companionDock = document.getElementById('companion-dock') as HTMLDivElement;
  dockBtnLeft = document.getElementById('dock-btn-left') as HTMLButtonElement;
  dockBtnChat = document.getElementById('dock-btn-chat') as HTMLButtonElement;
  dockBtnRight = document.getElementById('dock-btn-right') as HTMLButtonElement;
  dockBtnPcControl = document.getElementById('dock-btn-pc-control') as HTMLButtonElement;
  dockBtnMiniScreen = document.getElementById('dock-btn-mini-screen') as HTMLButtonElement;
  dockBtnStudio = document.getElementById('dock-btn-studio') as HTMLButtonElement;
  dockBtnEdgePeek = document.getElementById('dock-btn-edge-peek') as HTMLButtonElement;

  studioPanel = document.getElementById('studio-panel') as HTMLDivElement;
  btnCloseStudio = document.getElementById('btn-close-studio') as HTMLButtonElement;
  presetAlicia = document.getElementById('preset-alicia') as HTMLButtonElement;
  presetVrm1 = document.getElementById('preset-vrm1') as HTMLButtonElement;
  presetBuiltin = document.getElementById('preset-builtin') as HTMLButtonElement;
  presetMicroduck = document.getElementById('preset-microduck') as HTMLButtonElement;
  vrmUrlInput = document.getElementById('vrm-url-input') as HTMLInputElement;
  btnLoadUrl = document.getElementById('btn-load-url') as HTMLButtonElement;
  btnStudioFile = document.getElementById('btn-studio-file') as HTMLButtonElement;
  colorDuckBody = document.getElementById('color-duck-body') as HTMLInputElement;
  colorDuckAccent = document.getElementById('color-duck-accent') as HTMLInputElement;

  sliderScale = document.getElementById('slider-scale') as HTMLInputElement;
  valScale = document.getElementById('val-scale') as HTMLSpanElement;
  sliderGravity = document.getElementById('slider-gravity') as HTMLInputElement;
  valGravity = document.getElementById('val-gravity') as HTMLSpanElement;
  sliderBounce = document.getElementById('slider-bounce') as HTMLInputElement;
  valBounce = document.getElementById('val-bounce') as HTMLSpanElement;
  chkSoundFx = document.getElementById('chk-sound-fx') as HTMLInputElement;
  sliderSoundVolume = document.getElementById('slider-sound-volume') as HTMLInputElement;
  valSoundVolume = document.getElementById('val-sound-volume') as HTMLSpanElement;
  chkAutoroam = document.getElementById('chk-autoroam') as HTMLInputElement;
  chkLookat = document.getElementById('chk-lookat') as HTMLInputElement;
  chkWinInteract = document.getElementById('chk-win-interact') as HTMLInputElement;
  inputAutoActionSec = document.getElementById('input-auto-action-sec') as HTMLInputElement;
  autoBehaviorsListEl = document.getElementById('auto-behaviors-list') as HTMLDivElement;
  autoBehaviorCountBadge = document.getElementById('auto-behavior-count-badge') as HTMLSpanElement;
  btnAutoBehAll = document.getElementById('btn-auto-beh-all') as HTMLButtonElement;
  btnAutoBehDefault = document.getElementById('btn-auto-beh-default') as HTMLButtonElement;
  btnAutoBehNone = document.getElementById('btn-auto-beh-none') as HTMLButtonElement;
  inputOllamaModel = document.getElementById('input-ollama-model') as HTMLInputElement;
  inputGeminiKey = document.getElementById('input-gemini-key') as HTMLInputElement;
  inputGeminiModel = document.getElementById('input-gemini-model') as HTMLInputElement;
  selectLlmRoute = document.getElementById('select-llm-route') as HTMLSelectElement;
  chkAutocheck = document.getElementById('chk-autocheck') as HTMLInputElement;
  inputAlertCpu = document.getElementById('input-alert-cpu') as HTMLInputElement;
  inputAlertRam = document.getElementById('input-alert-ram') as HTMLInputElement;

  longMemoryPanel = document.getElementById('long-memory-panel') as HTMLDivElement;
  btnOpenLongMem = document.getElementById('btn-open-long-mem') as HTMLButtonElement;
  btnCloseLongMem = document.getElementById('btn-close-long-mem') as HTMLButtonElement;
  lmPresetCute = document.getElementById('lm-preset-cute') as HTMLButtonElement;
  lmPresetDev = document.getElementById('lm-preset-dev') as HTMLButtonElement;
  lmPresetTsun = document.getElementById('lm-preset-tsun') as HTMLButtonElement;
  lmPersonaInput = document.getElementById('lm-persona-input') as HTMLTextAreaElement;
  btnSavePersona = document.getElementById('btn-save-persona') as HTMLButtonElement;
  lmCatSelect = document.getElementById('lm-cat-select') as HTMLSelectElement;
  lmTitleInput = document.getElementById('lm-title-input') as HTMLInputElement;
  lmContentInput = document.getElementById('lm-content-input') as HTMLInputElement;
  btnAddLongMem = document.getElementById('btn-add-long-mem') as HTMLButtonElement;

  fileInput = document.getElementById('vrm-file-input') as HTMLInputElement;

  btnActBlackHole = document.getElementById('btn-act-blackhole') as HTMLButtonElement;
  btnActHat = document.getElementById('btn-act-hat') as HTMLButtonElement;
  btnActBeat = document.getElementById('btn-act-beat') as HTMLButtonElement;
  btnActGoose = document.getElementById('btn-act-goose') as HTMLButtonElement;
  btnActSwim = document.getElementById('btn-act-swim') as HTMLButtonElement;
  btnOpenNotif = document.getElementById('btn-open-notif') as HTMLButtonElement;
  dockBtnP2p = document.getElementById('dock-btn-p2p') as HTMLButtonElement;
  dockBtnTarot = document.getElementById('dock-btn-tarot') as HTMLButtonElement;
  dockTarotReadyDot = document.getElementById('dock-tarot-ready-dot') as HTMLSpanElement;

  notificationPanel = document.getElementById('notification-panel') as HTMLDivElement;
  p2pArenaPanel = document.getElementById('p2p-arena-panel') as HTMLDivElement;
  pcControlModal = document.getElementById('pc-control-modal') as HTMLDivElement;
  ocrTranslateModal = document.getElementById('ocr-translate-modal') as HTMLDivElement;
  toolForgeModal = document.getElementById('tool-forge-modal') as HTMLDivElement;
  tarotModal = document.getElementById('tarot-modal') as HTMLDivElement;
  miniScreenPanel = document.getElementById('mini-screen-panel') as HTMLDivElement;
  btnCloseNotif = document.getElementById('btn-close-notif') as HTMLButtonElement;
  btnCloseP2p = document.getElementById('btn-close-p2p') as HTMLButtonElement;
  notifMasterToggle = document.getElementById('notif-master-toggle') as HTMLInputElement;
  notifTtsToggle = document.getElementById('notif-tts-toggle') as HTMLInputElement;
  notifReactToggle = document.getElementById('notif-react-toggle') as HTMLInputElement;
  tabBtnWinNotif = document.getElementById('tab-btn-win-notif') as HTMLButtonElement;
  tabBtnWebNotif = document.getElementById('tab-btn-web-notif') as HTMLButtonElement;
  tabBtnHistNotif = document.getElementById('tab-btn-hist-notif') as HTMLButtonElement;
  tabContentWinNotif = document.getElementById('tab-content-win-notif') as HTMLDivElement;
  tabContentWebNotif = document.getElementById('tab-content-web-notif') as HTMLDivElement;
  tabContentHistNotif = document.getElementById('tab-content-hist-notif') as HTMLDivElement;
  btnScanWinApps = document.getElementById('btn-scan-win-apps') as HTMLButtonElement;
  btnTestWinNotif = document.getElementById('btn-test-win-notif') as HTMLButtonElement;
  inputNewWinApp = document.getElementById('input-new-win-app') as HTMLInputElement;
  btnAddWinApp = document.getElementById('btn-add-win-app') as HTMLButtonElement;
  containerWinApps = document.getElementById('container-win-apps') as HTMLDivElement;
  btnTestWebNotif = document.getElementById('btn-test-web-notif') as HTMLButtonElement;
  btnCopyWebhookUrl = document.getElementById('btn-copy-webhook-url') as HTMLButtonElement;
  btnCopyCurlCmd = document.getElementById('btn-copy-curl-cmd') as HTMLButtonElement;
  inputNewWebOrigin = document.getElementById('input-new-web-origin') as HTMLInputElement;
  btnAddWebOrigin = document.getElementById('btn-add-web-origin') as HTMLButtonElement;
  containerWebOrigins = document.getElementById('container-web-origins') as HTMLDivElement;
  btnClearNotifHistory = document.getElementById('btn-clear-notif-history') as HTMLButtonElement;
  containerNotifHistory = document.getElementById('container-notif-history') as HTMLDivElement;

  tabBtnStudioSystem = document.getElementById('tab-btn-studio-system') as HTMLButtonElement;
  tabBtnStudioAvatar = document.getElementById('tab-btn-studio-avatar') as HTMLButtonElement;
  tabBtnStudioPhysics = document.getElementById('tab-btn-studio-physics') as HTMLButtonElement;
  tabBtnStudioLlm = document.getElementById('tab-btn-studio-llm') as HTMLButtonElement;
  studioTabSystem = document.getElementById('studio-tab-system') as HTMLDivElement;
  studioTabAvatar = document.getElementById('studio-tab-avatar') as HTMLDivElement;
  studioTabPhysics = document.getElementById('studio-tab-physics') as HTMLDivElement;
  studioTabLlm = document.getElementById('studio-tab-llm') as HTMLDivElement;
  chkCfgVoiceTts = document.getElementById('chk-cfg-voice-tts') as HTMLInputElement;
  btnToggleChatSide = document.getElementById('btn-toggle-chat-side') as HTMLButtonElement;
  selectChatDockSide = document.getElementById('select-chat-dock-side') as HTMLSelectElement;
  inputCfgEnglishMin = document.getElementById('input-cfg-english-min') as HTMLInputElement;
  inputCfgNewsMin = document.getElementById('input-cfg-news-min') as HTMLInputElement;
  inputCfgWeatherMin = document.getElementById('input-cfg-weather-min') as HTMLInputElement;
  inputCfgAppMetricsMin = document.getElementById('input-cfg-app-metrics-min') as HTMLInputElement;
  inputCfgBtcMin = document.getElementById('input-cfg-btc-min') as HTMLInputElement;
  selectCfgWeatherSource = document.getElementById('select-cfg-weather-source') as HTMLSelectElement;
  cfgWeatherApiBox = document.getElementById('cfg-weather-api-box') as HTMLDivElement;
  cfgWeatherCustomBox = document.getElementById('cfg-weather-custom-box') as HTMLDivElement;
  inputCfgWeatherCity = document.getElementById('input-cfg-weather-city') as HTMLInputElement;
  selectCfgWeatherCustomMode = document.getElementById('select-cfg-weather-custom-mode') as HTMLSelectElement;
  inputCfgWeatherTemp = document.getElementById('input-cfg-weather-temp') as HTMLInputElement;
  inputCfgWeatherHum = document.getElementById('input-cfg-weather-hum') as HTMLInputElement;
  inputCfgWeatherLoc = document.getElementById('input-cfg-weather-loc') as HTMLInputElement;
  inputCfgWeatherDesc = document.getElementById('input-cfg-weather-desc') as HTMLInputElement;
  studioOllamaStatus = document.getElementById('studio-ollama-status') as HTMLSpanElement;
  studioGeminiStatus = document.getElementById('studio-gemini-status') as HTMLSpanElement;
  btnScanOllamaModels = document.getElementById('btn-scan-ollama-models') as HTMLButtonElement;
  ollamaModelsChips = document.getElementById('ollama-models-chips') as HTMLDivElement;
  btnToggleGeminiKey = document.getElementById('btn-toggle-gemini-key') as HTMLButtonElement;
}

let typewriterTarget = '';
let typewriterIndex = 0;
let typewriterAcc = 0;

let duckVoiceMuted = localStorage.getItem('mate_duck_voice_muted') === 'true';
let duckVoiceSessionId = 0;
let activeDuckTtsAudio: HTMLAudioElement | null = null;

export function isDuckVoiceMuted(): boolean {
  return duckVoiceMuted;
}

export function stopDuckVoiceTts() {
  duckVoiceSessionId++;
  if (activeDuckTtsAudio) {
    try {
      activeDuckTtsAudio.pause();
      activeDuckTtsAudio.src = '';
    } catch { }
    activeDuckTtsAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch { }
  }
}

export function syncDockVoiceUi() {
  if (chkCfgVoiceTts) {
    chkCfgVoiceTts.checked = !duckVoiceMuted;
  }
}

function syncChatDockSideUi() {
  if (selectChatDockSide) {
    selectChatDockSide.value = appState.chatDockSide;
  }
  if (btnToggleChatSide) {
    btnToggleChatSide.textContent = appState.chatDockSide === 'left' ? 'Bên Phải' : 'Bên Trái';
    btnToggleChatSide.title =
      appState.chatDockSide === 'left'
        ? 'Chat đang đi theo bên Trái nhân vật (Bấm để chuyển sang Phải)'
        : 'Chat đang đi theo bên Phải nhân vật (Bấm để chuyển sang Trái)';
  }
}

function splitVietnameseTtsChunks(text: string): string[] {
  const cleaned = text
    .replace(/\[TOOL:[^\]]*\]/gi, ' ')
    .replace(/^(\[[^\]]+\]\s*)+/g, '')
    .replace(/https?:\/\/\S+/gi, ' liên kết web ')
    .replace(/[`*_#>~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const sentences = cleaned
    .split(/(?<=[.!?;:\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const s of sentences) {
    if (s.length <= 175) {
      chunks.push(s);
    } else {
      const words = s.split(' ');
      let buf = '';
      for (const w of words) {
        if ((buf + ' ' + w).trim().length > 175) {
          if (buf.trim()) chunks.push(buf.trim());
          buf = w;
        } else {
          buf = (buf + ' ' + w).trim();
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
    }
  }
  return chunks.slice(0, 14);
}

function speakBrowserFallbackVi(text: string, sessionId: number): Promise<void> {
  return new Promise((resolve) => {
    if (
      duckVoiceMuted ||
      sessionId !== duckVoiceSessionId ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      resolve();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'vi-VN';
      utter.rate = 1.02;
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
      if (viVoice) utter.voice = viVoice;
      const vol = getSoundVolume();
      utter.volume = vol > 0 ? Math.max(0.45, vol) : 0.85;
      appState.speechLipSyncTimer = Math.max(appState.speechLipSyncTimer, Math.min(3.5, text.length * 0.06));
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

export async function speakVietnameseTts(rawText: string) {
  if (duckVoiceMuted) return;
  const chunks = splitVietnameseTtsChunks(rawText);
  if (chunks.length === 0) return;

  stopDuckVoiceTts();
  const mySession = duckVoiceSessionId;

  for (const chunk of chunks) {
    if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
    try {
      const dataUri = await invoke<string>('fetch_vietnamese_tts_audio', { text: chunk });
      if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
      await new Promise<void>((resolve) => {
        const audio = new Audio(dataUri);
        const vol = getSoundVolume();
        audio.volume = vol > 0 ? Math.max(0.45, vol) : 0.88;
        activeDuckTtsAudio = audio;
        appState.speechLipSyncTimer = Math.max(appState.speechLipSyncTimer, Math.min(4.0, chunk.length * 0.075));
        const cleanup = () => {
          if (activeDuckTtsAudio === audio) {
            activeDuckTtsAudio = null;
          }
          resolve();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        void audio.play().catch(async () => {
          cleanup();
          await speakBrowserFallbackVi(chunk, mySession);
        });
      });
    } catch {
      if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
      await speakBrowserFallbackVi(chunk, mySession);
    }
  }
}

export function speakMessage(msg: string) {
  typewriterTarget = msg;
  typewriterIndex = 0;
  typewriterAcc = 0;
  if (bubbleContent) bubbleContent.textContent = '';
  appState.speechLipSyncTimer = Math.min(2.6, Math.max(0.9, msg.length * 0.032));

  if (!duckVoiceMuted && appState.isBubbleVisible) {
    if (
      msg.startsWith('[HỌC TIẾNG ANH') ||
      msg.startsWith('[ĐỐ VUI') ||
      msg.startsWith('[ÔN TẬP')
    ) {
      window.setTimeout(() => {
        if (typewriterTarget === msg && !duckVoiceMuted) {
          void speakVietnameseTts(msg);
        }
      }, 1350);
    } else {
      void speakVietnameseTts(msg);
    }
  }
}

export function appendStreamMessage(token: string) {
  typewriterTarget += token;
  appState.speechLipSyncTimer = Math.min(2.8, appState.speechLipSyncTimer + token.length * 0.035);
}

export function setStreamSpeechText(text: string) {
  typewriterTarget = text;
  if (typewriterIndex > text.length) {
    typewriterIndex = text.length;
    typewriterAcc = typewriterIndex;
  }
  if (bubbleContent) {
    bubbleContent.textContent = typewriterTarget.slice(0, typewriterIndex);
  }
  appState.speechLipSyncTimer = Math.min(2.8, Math.max(0.8, text.length * 0.02));
}

export function clearSpeechMessage() {
  typewriterTarget = '';
  typewriterIndex = 0;
  typewriterAcc = 0;
  if (bubbleContent) bubbleContent.textContent = '';
}

export function updateTypewriter(delta: number) {
  if (bubbleContent && typewriterIndex < typewriterTarget.length) {
    typewriterAcc += delta * 105;
    const nextIdx = Math.min(typewriterTarget.length, Math.floor(typewriterAcc));
    if (nextIdx > typewriterIndex) {
      typewriterIndex = nextIdx;
      bubbleContent.textContent = typewriterTarget.slice(0, typewriterIndex);
      bubbleContent.scrollTop = bubbleContent.scrollHeight;
    }
  }
}

let pomodoroSeconds = 0;
let pomodoroRunning = false;
let pomodoroInterval: number | null = null;
let pomodoroTaskNote = 'Pomodoro';

let scheduledNotesList: ScheduledNoteEntry[] = [];
let isStickyWidgetOpen = false;
let stickyContentInputEl: HTMLInputElement | null = null;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getCurrentHHMM(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addMinutesHHMM(baseHHMM: string, deltaMin: number): string {
  const d = new Date();
  if (/^\d{2}:\d{2}$/.test(baseHHMM)) {
    const [hh, mm] = baseHHMM.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
  }
  d.setMinutes(d.getMinutes() + deltaMin);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function toggleStickyNotesWidget(forceState?: boolean) {
  ensureStickyNotesWidget();
  isStickyWidgetOpen = forceState !== undefined ? forceState : !isStickyWidgetOpen;
  if (stickyNotesWidget) {
    stickyNotesWidget.style.display = isStickyWidgetOpen ? 'flex' : 'none';
  }
  if (isStickyWidgetOpen) {
    void loadScheduledNotesFromSqlite(false);
    stickyContentInputEl?.focus();
  }
  syncHitboxToRust(true);
}

export function toggleEdgePeekMode(forceState?: boolean): string {
  const next = forceState !== undefined ? forceState : !appState.isEdgePeekMode;
  appState.isEdgePeekMode = next;
  if (dockBtnEdgePeek) {
    dockBtnEdgePeek.classList.toggle('active', next);
    dockBtnEdgePeek.title = next
      ? 'Đang nép mép màn hình (Bấm hoặc Alt+W để quay lại)'
      : 'Nép Mép Màn Hình (Alt+W)';
  }
  if (next) {
    appState.activeWindowTask = null;
    appState.attachedWindowHwnd = null;
    toggleLeftPanel(false);
    toggleRightPanel(false);
    toggleBubbleVisibility(false);
    toggleChatVisibility(false);
    toggleStudioModal(false);
    toggleLongMemoryModal(false);
    toggleNotificationModal(false);
    toggleP2pArenaModal(false);
    if (btnActEdgePeek) btnActEdgePeek.textContent = 'Ra Khỏi Mép (Alt+W)';
    return '[NẤP MÉP MÀN HÌNH] Vịt đã nấp gọn sang mép phải. Rê chuột sát mép phải để vịt thò đầu ra hoặc nhấn Alt+W!';
  } else {
    appState.posX = Math.max(120, Math.min(appState.W - 180, appState.posX - 110));
    if (btnActEdgePeek) btnActEdgePeek.textContent = 'Nấp Mép Màn (Alt+W)';
    toggleBubbleVisibility(true);
    const msg = '[TẬP TRUNG XONG] Vịt đã quay lại giữa màn hình phục vụ bạn!';
    speakMessage(msg);
    updateUiPosition();
    syncHitboxToRust(true);
    return msg;
  }
}

async function migrateLegacyStickyNotes() {
  try {
    const raw = localStorage.getItem('mate_sticky_notes');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item.text === 'string' && item.text.trim()) {
          await invoke('schedule_note_add', {
            content: item.text.trim(),
            scheduleTime: '',
            repeatDaily: false,
          }).catch(() => { });
        }
      }
    }
    localStorage.removeItem('mate_sticky_notes');
  } catch { }
}

export async function loadScheduledNotesFromSqlite(autoOpenIfPending = false): Promise<ScheduledNoteEntry[]> {
  try {
    await migrateLegacyStickyNotes();
    scheduledNotesList = await invoke<ScheduledNoteEntry[]>('schedule_note_list');
    if (autoOpenIfPending && scheduledNotesList.some((n) => !n.is_done)) {
      isStickyWidgetOpen = true;
      if (stickyNotesWidget) stickyNotesWidget.style.display = 'flex';
    }
    renderStickyNotes();
    return scheduledNotesList;
  } catch {
    return [];
  }
}

function ensureStickyNotesWidget() {
  if (stickyNotesWidget) return;
  const host = document.getElementById('app-ui') || document.body;
  const widget = document.createElement('div');
  widget.id = 'sticky-notes-widget';

  const header = document.createElement('div');
  header.className = 'sticky-widget-header';

  const title = document.createElement('div');
  title.className = 'sticky-widget-title';
  title.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/></svg><span>Ghi chú &amp; Lịch hẹn</span>`;

  const actions = document.createElement('div');
  actions.className = 'sticky-widget-actions';

  const btnClearAll = document.createElement('button');
  btnClearAll.type = 'button';
  btnClearAll.className = 'sticky-mini-btn danger';
  btnClearAll.textContent = 'Xóa hết';
  btnClearAll.title = 'Xóa toàn bộ ghi chú và lịch hẹn trong SQLite';
  btnClearAll.addEventListener('click', () => {
    void clearStickyNotes().then((msg) => speakMessage(msg));
  });

  const btnCollapse = document.createElement('button');
  btnCollapse.type = 'button';
  btnCollapse.className = 'sticky-mini-btn';
  btnCollapse.textContent = 'Thu gọn';
  btnCollapse.title = 'Ẩn bảng ghi chú (lịch hẹn vẫn chạy ngầm)';
  btnCollapse.addEventListener('click', () => {
    toggleStickyNotesWidget(false);
  });

  actions.appendChild(btnClearAll);
  actions.appendChild(btnCollapse);
  header.appendChild(title);
  header.appendChild(actions);

  const compose = document.createElement('div');
  compose.className = 'sticky-compose-box';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'sticky-input';
  textInput.placeholder = 'Nhập ghi chú hoặc nội dung cần nhắc...';
  stickyContentInputEl = textInput;

  const rowMid = document.createElement('div');
  rowMid.className = 'sticky-compose-row';

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'sticky-time-input';
  timeInput.title = 'Giờ thông báo nhắc nhở (để trống nếu chỉ ghi chú)';

  const dailyLabel = document.createElement('label');
  dailyLabel.className = 'sticky-daily-label';
  const dailyChk = document.createElement('input');
  dailyChk.type = 'checkbox';
  const dailyTxt = document.createElement('span');
  dailyTxt.textContent = 'Hàng ngày';
  dailyLabel.appendChild(dailyChk);
  dailyLabel.appendChild(dailyTxt);

  const btnAdd = document.createElement('button');
  btnAdd.type = 'button';
  btnAdd.className = 'sticky-add-btn';
  btnAdd.textContent = 'Thêm lịch';

  rowMid.appendChild(timeInput);
  rowMid.appendChild(dailyLabel);
  rowMid.appendChild(btnAdd);

  const chipRow = document.createElement('div');
  chipRow.className = 'sticky-chip-row';
  const presets: Array<{ label: string; mins: number | null }> = [
    { label: '+10p', mins: 10 },
    { label: '+30p', mins: 30 },
    { label: '+1h', mins: 60 },
    { label: 'Không giờ', mins: null },
  ];
  presets.forEach((p) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'sticky-chip-btn';
    c.textContent = p.label;
    c.addEventListener('click', () => {
      if (p.mins === null) {
        timeInput.value = '';
      } else {
        timeInput.value = addMinutesHHMM('', p.mins);
      }
    });
    chipRow.appendChild(c);
  });

  const handleComposeSubmit = () => {
    const val = textInput.value.trim();
    if (!val) {
      textInput.focus();
      return;
    }
    const tVal = timeInput.value.trim();
    const dailyVal = dailyChk.checked;
    textInput.value = '';
    timeInput.value = '';
    dailyChk.checked = false;
    void pinStickyNote(val, false, tVal, dailyVal).then((msg) => speakMessage(msg));
  };

  btnAdd.addEventListener('click', handleComposeSubmit);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleComposeSubmit();
    }
  });

  compose.appendChild(textInput);
  compose.appendChild(rowMid);
  compose.appendChild(chipRow);

  const listEl = document.createElement('div');
  listEl.id = 'sticky-notes-list';

  widget.appendChild(header);
  widget.appendChild(compose);
  widget.appendChild(listEl);
  host.appendChild(widget);

  stickyNotesWidget = widget;
  stickyNotesListEl = listEl;
  renderStickyNotes();
}

function renderStickyNotes() {
  if (!stickyNotesWidget || !stickyNotesListEl) return;
  stickyNotesListEl.innerHTML = '';

  stickyNotesWidget.style.display = isStickyWidgetOpen ? 'flex' : 'none';

  if (scheduledNotesList.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:10.5px;color:#94a3b8;padding:4px 2px;';
    empty.textContent = 'Chưa có ghi chú hay lịch nhắc nào trong SQLite.';
    stickyNotesListEl.appendChild(empty);
    syncHitboxToRust(true);
    return;
  }

  scheduledNotesList.forEach((note) => {
    const card = document.createElement('div');
    card.className = `sticky-note-item${note.is_done ? ' done' : ''}`;

    const hdr = document.createElement('div');
    hdr.className = 'sticky-note-header';

    const leftMeta = document.createElement('div');
    leftMeta.style.cssText = 'display:flex;align-items:center;gap:5px;min-width:0;';

    const doneChk = document.createElement('input');
    doneChk.type = 'checkbox';
    doneChk.checked = note.is_done;
    doneChk.title = 'Đánh dấu đã hoàn thành';
    doneChk.addEventListener('change', () => {
      void invoke('schedule_note_toggle_done', {
        id: note.id,
        isDone: doneChk.checked,
      })
        .then(() => void loadScheduledNotesFromSqlite(false))
        .catch(() => { });
    });

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'sticky-schedule-badge';
    if (note.schedule_time) {
      badgeSpan.textContent = note.repeat_daily
        ? `[HẰNG NGÀY ${note.schedule_time}]`
        : `[HẸN ${note.schedule_time}]`;
    } else {
      badgeSpan.style.color = '#fcd34d';
      badgeSpan.textContent = '[GHI CHÚ]';
    }

    leftMeta.appendChild(doneChk);
    leftMeta.appendChild(badgeSpan);

    const acts = document.createElement('div');
    acts.className = 'sticky-note-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sticky-mini-btn';
    saveBtn.textContent = 'Lưu Desktop';
    saveBtn.title = 'Lưu ghi chú này vào Desktop/Duck_AI_Notes.txt';
    saveBtn.addEventListener('click', () => {
      const label = note.schedule_time ? `Lịch ${note.schedule_time}` : 'Ghi chú';
      void invoke<string>('save_sticky_note_to_desktop', {
        content: note.content,
        title: label,
      })
        .then((p) => {
          playSuccessChimeSound(appState.posX);
          speakMessage(`[GHI CHÚ] Đã lưu ra file: ${p}`);
        })
        .catch((err) => {
          speakMessage(`[LỖI LƯU NOTE] ${String(err)}`);
        });
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'sticky-mini-btn danger';
    delBtn.textContent = 'x';
    delBtn.title = 'Xóa mục này';
    delBtn.addEventListener('click', () => {
      void invoke('schedule_note_delete', { id: note.id })
        .then(() => void loadScheduledNotesFromSqlite(false))
        .catch(() => { });
    });

    acts.appendChild(saveBtn);
    acts.appendChild(delBtn);
    hdr.appendChild(leftMeta);
    hdr.appendChild(acts);

    const txt = document.createElement('div');
    txt.className = 'sticky-note-text';
    txt.textContent = note.content;

    card.appendChild(hdr);
    card.appendChild(txt);
    stickyNotesListEl!.appendChild(card);
  });

  syncHitboxToRust(true);
}

export async function pinStickyNote(
  text: string,
  saveToDesktop = false,
  scheduleTime = '',
  repeatDaily = false
): Promise<string> {
  const cleaned = text.trim();
  if (!cleaned) {
    return '[GHI CHÚ] Nội dung ghi chú đang trống!';
  }
  ensureStickyNotesWidget();
  isStickyWidgetOpen = true;

  const cleanTime = scheduleTime.trim();
  try {
    await invoke<ScheduledNoteEntry>('schedule_note_add', {
      content: cleaned,
      scheduleTime: cleanTime,
      repeatDaily,
    });
    await loadScheduledNotesFromSqlite(false);
  } catch (err) {
    return `[LỖI LƯU LỊCH HẸN] ${String(err)}`;
  }

  playSuccessChimeSound(appState.posX);
  spawnParticles(appState.posX, appState.posY - 100, 10, 0xfbbf24);

  const timeDesc = cleanTime
    ? ` (Nhắc lúc ${cleanTime}${repeatDaily ? ' hàng ngày' : ''})`
    : '';

  if (saveToDesktop) {
    try {
      const savedPath = await invoke<string>('save_sticky_note_to_desktop', {
        content: cleaned,
        title: cleanTime ? `Lịch ${cleanTime}` : 'Ghi chú nhanh',
      });
      return `[GHI CHÚ & LỊCH HẸN] Đã lưu${timeDesc} vào SQLite và xuất file Desktop (${savedPath})!`;
    } catch (err) {
      return `[GHI CHÚ & LỊCH HẸN] Đã lưu${timeDesc} vào SQLite (lỗi ghi file: ${String(err)}).`;
    }
  }
  return `[GHI CHÚ & LỊCH HẸN] Đã lưu "${cleaned.slice(0, 44)}${cleaned.length > 44 ? '...' : ''}"${timeDesc} vào SQLite!`;
}

export async function clearStickyNotes(): Promise<string> {
  await invoke('schedule_note_clear_all').catch(() => { });
  scheduledNotesList = [];
  renderStickyNotes();
  return '[GHI CHÚ & LỊCH HẸN] Đã xóa sạch toàn bộ ghi chú và lịch hẹn trong SQLite!';
}

function checkScheduledNotesTick() {
  if (scheduledNotesList.length === 0) return;
  const nowHHMM = getCurrentHHMM();
  const todayKey = getTodayDateStr();

  for (const note of scheduledNotesList) {
    if (
      !note.is_done &&
      note.schedule_time &&
      note.schedule_time === nowHHMM &&
      note.last_triggered_date !== todayKey
    ) {
      note.last_triggered_date = todayKey;
      void invoke('schedule_note_mark_triggered', {
        id: note.id,
        dateKey: todayKey,
        newScheduleTime: null,
      }).catch(() => { });

      isStickyWidgetOpen = true;
      renderStickyNotes();

      if (!appState.isBubbleVisible) {
        toggleBubbleVisibility(true);
      }
      appState.setState('ALERT');
      appState.setExpression('surprised', 4.5);
      spawnParticles(appState.posX, appState.posY - 100, 14, 0xfbbf24);
      playAlertBeep(appState.posX);
      window.setTimeout(() => playSuccessChimeSound(appState.posX), 260);

      void invoke('post_notification', {
        source: 'web',
        appOrOrigin: 'Lịch hẹn Duck AI',
        title: `Nhắc việc ${note.schedule_time}`,
        body: note.content,
      }).catch(() => { });

      speakMessage(
        `[LỊCH HẸN ${note.schedule_time}] ${note.content} — Bấm "Đồng ý" để đánh dấu Xong, hoặc "Để sau" để báo lại sau 5 phút!`
      );
      showSuggestionButtons(
        () => {
          if (!note.repeat_daily) {
            void invoke('schedule_note_toggle_done', { id: note.id, isDone: true })
              .then(() => void loadScheduledNotesFromSqlite(false))
              .catch(() => { });
          }
          appState.setExpression('happy', 3.0);
          speakMessage(`[HOÀN TẤT LỊCH HẸN] Đã xác nhận xong: "${note.content}"!`);
        },
        () => {
          const snoozeTime = addMinutesHHMM(note.schedule_time, 5);
          note.schedule_time = snoozeTime;
          note.last_triggered_date = '';
          void invoke('schedule_note_mark_triggered', {
            id: note.id,
            dateKey: '',
            newScheduleTime: snoozeTime,
          })
            .then(() => void loadScheduledNotesFromSqlite(false))
            .catch(() => { });
          speakMessage(`[BÁO LẠI] Sẽ nhắc lại việc "${note.content}" vào lúc ${snoozeTime}!`);
        }
      );
      break;
    }
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerBadgeDisplay() {
  if (!timerBadge) return;
  const notePart = pomodoroTaskNote && pomodoroTaskNote !== 'Pomodoro'
    ? ` ${pomodoroTaskNote.slice(0, 14)}${pomodoroTaskNote.length > 14 ? '...' : ''}`
    : '';
  timerBadge.textContent = `${formatTime(Math.max(0, pomodoroSeconds))}${notePart}`;
}

export function stopCustomTimer(): string {
  if (pomodoroInterval !== null) {
    window.clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  const wasRunning = pomodoroRunning;
  pomodoroRunning = false;
  pomodoroSeconds = 0;
  if (timerBadge) timerBadge.style.display = 'none';
  if (btnActTimer) btnActTimer.classList.remove('active');
  return wasRunning
    ? 'Đã tắt bộ đếm hẹn giờ. Khi nào cần nhắc việc hãy gọi tớ nhé!'
    : 'Hiện không có hẹn giờ nào đang chạy.';
}

export function startCustomTimer(minutes: number, note = 'Hẹn giờ'): string {
  if (pomodoroInterval !== null) {
    window.clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  const safeMinutes = Math.max(0.1, Math.min(240, Number.isFinite(minutes) ? minutes : 25));
  pomodoroSeconds = Math.max(5, Math.round(safeMinutes * 60));
  pomodoroTaskNote = note.trim() || 'Hẹn giờ';
  pomodoroRunning = true;

  if (timerBadge) {
    timerBadge.style.display = 'inline-block';
    updateTimerBadgeDisplay();
  }
  if (btnActTimer) btnActTimer.classList.add('active');
  appState.setExpression('happy', 2.5);
  spawnParticles(appState.posX, appState.posY - 90, 8, 0x38bdf8);

  const labelStr = safeMinutes >= 1
    ? `${Math.round(safeMinutes * 10) / 10} phút`
    : `${pomodoroSeconds} giây`;
  const startMsg = `[HẸN GIỜ] Đã đặt đếm ngược ${labelStr} (${pomodoroTaskNote}). Hết giờ tớ sẽ nhảy báo thức ngay!`;
  speakMessage(startMsg);

  pomodoroInterval = window.setInterval(() => {
    pomodoroSeconds--;
    updateTimerBadgeDisplay();
    if (pomodoroSeconds <= 0) {
      const doneNote = pomodoroTaskNote;
      stopCustomTimer();
      appState.setState('ALERT');
      appState.setExpression('surprised', 4.5);
      playAlertBeep(appState.posX);
      window.setTimeout(() => playSuccessChimeSound(appState.posX), 260);
      triggerDance();
      const finishMsg = `[BÁO THỨC HẾT GIỜ] Đã hết ${labelStr}: "${doneNote}"! Đứng dậy thư giãn hoặc xử lý công việc ngay nhé!`;
      speakMessage(finishMsg);
      appState.changeMood(12);
    }
  }, 1000);

  return startMsg;
}

export function togglePomodoro() {
  if (pomodoroRunning) {
    const msg = stopCustomTimer();
    speakMessage(msg);
    return;
  }
  startCustomTimer(25, 'Pomodoro 25p');
}

export function triggerDance() {
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.setState('DANCING');
  spawnParticles(appState.posX, appState.posY - 100, 10, 0xf472b6);
  speakMessage('Lên nhạc nào! Chế độ Idol đang bật.');
  appState.changeMood(6);
}

export function triggerHeadpat() {
  appState.activeWindowTask = null;
  appState.setState('HEADPAT');
  spawnParticles(appState.posX, appState.posY - 140, 10, 0xf472b6);
  appState.changeMood(8);
  speakMessage('Thích quá đi! Cảm ơn bạn đã xoa đầu tớ nhé.');
}

export function toggleLeftPanel(forceState?: boolean) {
  appState.isLeftPanelOpen =
    forceState !== undefined ? forceState : !appState.isLeftPanelOpen;
  leftTelemetryPanel.style.display = appState.isLeftPanelOpen ? 'block' : 'none';
  dockBtnLeft.classList.toggle('active', appState.isLeftPanelOpen);
  if (appState.isLeftPanelOpen) {
    const hw = document.getElementById('card-group-hw');
    const net = document.getElementById('card-net');
    const btc = document.getElementById('card-btc');
    const weather = document.getElementById('card-weather');
    const news = document.getElementById('card-news');
    const eng = document.getElementById('card-english');
    const alerts = document.getElementById('card-alerts');
    const mem = document.getElementById('card-memory');
    const anyVisible =
      (hw && hw.style.display !== 'none') ||
      (net && net.style.display !== 'none') ||
      (btc && btc.style.display !== 'none') ||
      (weather && weather.style.display !== 'none') ||
      (news && news.style.display !== 'none') ||
      (eng && eng.style.display !== 'none') ||
      (alerts && alerts.style.display !== 'none') ||
      (mem && mem.style.display !== 'none');
    if (!anyVisible) {
      showTelemetrySection('all');
      return;
    }
  }
  syncHitboxToRust(true);
}

export function showTelemetrySection(
  mode: 'hw' | 'net' | 'btc' | 'weather' | 'news' | 'english' | 'alert' | 'memory' | 'app_metrics' | 'all'
) {
  const titleEl = document.getElementById('left-panel-title');
  const hwEl = document.getElementById('card-group-hw');
  const netEl = document.getElementById('card-net');
  const btcEl = document.getElementById('card-btc');
  const weatherEl = document.getElementById('card-weather');
  const newsEl = document.getElementById('card-news');
  const engEl = document.getElementById('card-english');
  const alertEl = document.getElementById('card-alerts');
  const memEl = document.getElementById('card-memory');
  const appMetricsEl = document.getElementById('card-group-app-metrics');

  const titles: Record<typeof mode, string> = {
    hw: 'Thông số Phần cứng',
    net: 'Kết nối Mạng & LLM',
    btc: 'Thị trường Bitcoin',
    weather: 'Thời Tiết, Nhiệt Độ & Độ Ẩm',
    news: 'Đọc Tin Tức Mới Live',
    english: 'Học Tiếng Anh Vô Tận (API)',
    alert: 'Cảnh báo Hệ thống',
    memory: 'Trí nhớ & Thói quen (SQLite)',
    app_metrics: 'Hiệu Năng Duck AI Manager',
    all: 'Giám sát & Tiện ích Live',
  };
  if (titleEl) titleEl.textContent = titles[mode];

  if (appMetricsEl)
    appMetricsEl.style.display =
      mode === 'app_metrics' || mode === 'all' || mode === 'hw' ? 'block' : 'none';
  if (hwEl) hwEl.style.display = mode === 'hw' || mode === 'all' ? 'block' : 'none';
  if (netEl) netEl.style.display = mode === 'net' || mode === 'all' ? 'block' : 'none';
  if (btcEl) btcEl.style.display = mode === 'btc' || mode === 'all' ? 'block' : 'none';
  if (weatherEl) weatherEl.style.display = mode === 'weather' || mode === 'all' ? 'block' : 'none';
  if (newsEl) newsEl.style.display = mode === 'news' || mode === 'all' ? 'block' : 'none';
  if (engEl) engEl.style.display = mode === 'english' || mode === 'all' ? 'block' : 'none';
  if (alertEl) alertEl.style.display = mode === 'alert' || mode === 'all' ? 'block' : 'none';
  if (memEl) memEl.style.display = mode === 'memory' || mode === 'all' ? 'block' : 'none';

  appState.isLeftPanelOpen = true;
  leftTelemetryPanel.style.display = 'block';
  dockBtnLeft.classList.add('active');
  syncHitboxToRust(true);
}

let activeSugAccept: (() => void) | null = null;
let activeSugDismiss: (() => void) | null = null;

export function showSuggestionButtons(
  onAccept: () => void,
  onDismiss: () => void,
  acceptLabel = 'Đồng ý',
  dismissLabel = 'Để sau'
) {
  activeSugAccept = onAccept;
  activeSugDismiss = onDismiss;
  if (btnSugAccept) btnSugAccept.textContent = acceptLabel;
  if (btnSugDismiss) btnSugDismiss.textContent = dismissLabel;
  if (suggestionActions) suggestionActions.style.display = 'flex';
  syncHitboxToRust(true);
}

export function hideSuggestionButtons() {
  activeSugAccept = null;
  activeSugDismiss = null;
  if (btnSugAccept) btnSugAccept.textContent = 'Đồng ý';
  if (btnSugDismiss) btnSugDismiss.textContent = 'Để sau';
  if (suggestionActions) suggestionActions.style.display = 'none';
}

let activeDashboardAnalysis: IngestedFileAnalysis | null = null;
let cachedDashboardSummaryMap: Record<string, string> = {};

export function renderDashboardAiSummary(fileName: string, summaryText: string) {
  cachedDashboardSummaryMap[fileName] = summaryText;
  const sec = document.getElementById('fd-ai-summary-section');
  const box = document.getElementById('fd-ai-summary-box');
  if (sec && box && activeDashboardAnalysis?.file_name === fileName) {
    sec.style.display = 'block';
    box.textContent = summaryText;
  }
}

export function setFileDragHoverMode(active: boolean, fileNameHint = '') {
  appState.isFileDragHovering = active;
  const hud = document.getElementById('file-ingest-mouth-hud') as HTMLDivElement | null;
  const sub = document.getElementById('ingest-portal-sub');
  if (active) {
    appState.setExpression('surprised', 2.0);
    if (sub) {
      sub.textContent = fileNameHint || 'PDF / CSV / EXCEL / IMG';
    }
    if (hud) hud.style.display = 'flex';
    void invoke('set_manual_interactive', { interactive: true }).catch(() => { });
  } else {
    if (hud) hud.style.display = 'none';
    if (!appState.blackHoleWarpMode) {
      void invoke('set_manual_interactive', { interactive: false }).catch(() => { });
    }
  }
  updateUiPosition();
  syncHitboxToRust(true);
}

export function closeFileAnalyticsDashboard() {
  const modal = document.getElementById('file-dashboard-modal');
  if (modal) modal.style.display = 'none';
  syncHitboxToRust(true);
}

export function openFileAnalyticsDashboard(analysis: IngestedFileAnalysis) {
  activeDashboardAnalysis = analysis;
  const modal = document.getElementById('file-dashboard-modal');
  if (!modal) return;

  const titleEl = document.getElementById('fd-title');
  const metaEl = document.getElementById('fd-meta');
  const kpiGrid = document.getElementById('fd-kpi-grid');
  const aiSec = document.getElementById('fd-ai-summary-section');
  const aiBox = document.getElementById('fd-ai-summary-box');
  const chartSec = document.getElementById('fd-chart-section');
  const colTabsEl = document.getElementById('fd-col-tabs');
  const typeTabsEl = document.getElementById('fd-chart-type-tabs');
  const scatterControlsEl = document.getElementById('fd-scatter-controls');
  const insightsEl = document.getElementById('fd-expert-insights');
  const chartBars = document.getElementById('fd-chart-bars');
  const statsSec = document.getElementById('fd-stats-section');
  const statsGrid = document.getElementById('fd-stats-grid');
  const tableSec = document.getElementById('fd-table-section');
  const tableWrap = document.getElementById('fd-table-wrap');
  const excerptSec = document.getElementById('fd-excerpt-section');
  const excerptBox = document.getElementById('fd-excerpt-box');

  if (titleEl) titleEl.textContent = `[${analysis.file_type} DASHBOARD] ${analysis.file_name}`;
  if (metaEl) metaEl.textContent = analysis.quick_overview;

  if (aiSec && aiBox) {
    const existingSum = cachedDashboardSummaryMap[analysis.file_name];
    if (existingSum) {
      aiSec.style.display = 'block';
      aiBox.textContent = existingSum;
    } else {
      aiSec.style.display = 'none';
      aiBox.textContent = '';
    }
  }

  if (kpiGrid) {
    kpiGrid.innerHTML = '';
    const kpis = [
      { label: 'Định dạng', value: analysis.file_type },
      { label: 'Dung lượng', value: `${analysis.file_size_kb} KB` },
      { label: analysis.file_type === 'PDF' ? 'Số trang' : 'Số dòng', value: String(analysis.row_count) },
      { label: 'Số cột / Trường', value: String(analysis.col_count) },
    ];
    for (const k of kpis) {
      const box = document.createElement('div');
      box.className = 'fd-kpi-card';
      box.innerHTML = `<div class="fd-kpi-lbl">${k.label}</div><div class="fd-kpi-val">${k.value}</div>`;
      kpiGrid.appendChild(box);
    }
  }

  if (chartSec && chartBars && colTabsEl && typeTabsEl && scatterControlsEl && insightsEl) {
    renderDataExpertDashboardCharts(analysis, {
      chartSec,
      colTabsEl,
      typeTabsEl,
      scatterControlsEl,
      insightsEl,
      chartCanvasEl: chartBars,
    });
  }

  if (statsSec && statsGrid) {
    if (analysis.numeric_stats.length > 0) {
      statsSec.style.display = 'block';
      statsGrid.innerHTML = '';
      for (const st of analysis.numeric_stats.slice(0, 6)) {
        const card = document.createElement('div');
        card.className = 'fd-stat-card';
        card.innerHTML = `<div class="fd-stat-col">${st.column}</div><div class="fd-stat-nums">Min: <b>${st.min}</b> | Avg: <b>${st.avg}</b> | Max: <b>${st.max}</b> | Sum: <b>${st.sum}</b></div>`;
        statsGrid.appendChild(card);
      }
    } else {
      statsSec.style.display = 'none';
    }
  }

  if (tableSec && tableWrap) {
    if (analysis.sample_rows.length > 0 && analysis.columns.length > 0) {
      tableSec.style.display = 'block';
      tableWrap.innerHTML = '';
      const tbl = document.createElement('table');
      tbl.className = 'fd-table';
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      for (const col of analysis.columns.slice(0, 8)) {
        const th = document.createElement('th');
        th.textContent = col;
        hr.appendChild(th);
      }
      thead.appendChild(hr);
      tbl.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const r of analysis.sample_rows.slice(0, 12)) {
        const tr = document.createElement('tr');
        for (let ci = 0; ci < Math.min(8, analysis.columns.length); ci++) {
          const td = document.createElement('td');
          td.textContent = r[ci] ?? '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      tableWrap.appendChild(tbl);
    } else {
      tableSec.style.display = 'none';
    }
  }

  if (excerptSec && excerptBox) {
    if (analysis.raw_excerpt && analysis.file_type !== 'CSV') {
      excerptSec.style.display = 'block';
      excerptBox.textContent = analysis.raw_excerpt;
    } else {
      excerptSec.style.display = 'none';
    }
  }

  modal.style.display = 'flex';
  syncHitboxToRust(true);
}

export function toggleRightPanel(forceState?: boolean) {
  appState.isRightPanelOpen =
    forceState !== undefined ? forceState : !appState.isRightPanelOpen;
  rightActionPanel.style.display = appState.isRightPanelOpen ? 'block' : 'none';
  dockBtnRight.classList.toggle('active', appState.isRightPanelOpen);
  syncHitboxToRust(true);
}

function syncAutoBehaviorUiState() {
  const sec = appState.getAutoActionDelay();
  if (inputAutoActionSec) {
    inputAutoActionSec.value = String(sec);
  }
  document.querySelectorAll('.auto-sec-preset-btn').forEach((btn) => {
    const val = Number(btn.getAttribute('data-sec'));
    btn.classList.toggle('active', val === sec);
  });

  if (autoBehaviorsListEl) {
    autoBehaviorsListEl.classList.toggle('is-disabled', !appState.autoRoamEnabled);
    autoBehaviorsListEl.querySelectorAll<HTMLInputElement>('input[data-auto-behavior]').forEach((inp) => {
      const key = inp.getAttribute('data-auto-behavior') as AutoBehaviorKey | null;
      if (key) {
        inp.checked = appState.isAutoBehaviorEnabled(key);
      }
    });
  }

  let enabledCount = 0;
  for (const item of AUTO_BEHAVIOR_CATALOG) {
    if (appState.isAutoBehaviorEnabled(item.key)) {
      enabledCount++;
    }
  }
  if (autoBehaviorCountBadge) {
    autoBehaviorCountBadge.textContent = appState.autoRoamEnabled
      ? `${enabledCount}/${AUTO_BEHAVIOR_CATALOG.length} đang bật`
      : `${enabledCount}/${AUTO_BEHAVIOR_CATALOG.length} (Đang tắt tổng)`;
  }
}

function renderAutoBehaviorToggles() {
  if (!autoBehaviorsListEl) return;
  autoBehaviorsListEl.innerHTML = '';

  const groups: Array<{ id: 'basic' | 'action'; title: string }> = [
    { id: 'basic', title: 'Di chuyển, Biểu cảm & Đạo cụ' },
    { id: 'action', title: 'Kỹ năng 3D & Tương tác Màn hình' },
  ];

  for (const grp of groups) {
    const header = document.createElement('div');
    header.className = 'auto-behavior-group-label';
    header.textContent = grp.title;
    autoBehaviorsListEl.appendChild(header);

    for (const item of AUTO_BEHAVIOR_CATALOG) {
      if (item.group !== grp.id) continue;
      const label = document.createElement('label');
      label.className = 'auto-behavior-item';

      const textSpan = document.createElement('span');
      textSpan.textContent = item.label;

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.setAttribute('data-auto-behavior', item.key);
      chk.checked = appState.isAutoBehaviorEnabled(item.key);
      chk.addEventListener('change', () => {
        appState.autoBehaviors[item.key] = chk.checked;
        localStorage.setItem('mate_auto_behaviors_json', JSON.stringify(appState.autoBehaviors));
        syncAutoBehaviorUiState();
        void saveStudioConfigToSqlite();
      });

      label.appendChild(textSpan);
      label.appendChild(chk);
      autoBehaviorsListEl.appendChild(label);
    }
  }
}

export interface AvatarStudioConfig {
  active_character_type: string;
  vrm_url: string;
  duck_body_color: string;
  duck_accent_color: string;
  model_scale: number;
  gravity: number;
  bounce_factor: number;
  auto_roam_enabled: boolean;
  look_at_enabled: boolean;
  window_interact_enabled: boolean;
  ollama_model: string;
  gemini_api_key: string;
  gemini_model: string;
  llm_route_mode: string;
  auto_check_enabled: boolean;
  cpu_alert_pct: number;
  ram_alert_gb: number;
  sound_fx_enabled?: boolean;
  sound_volume?: number;
  english_interval_min?: number;
  news_interval_min?: number;
  weather_interval_min?: number;
  app_metrics_interval_min?: number;
  btc_interval_min?: number;
  weather_source_mode?: string;
  weather_custom_mode?: string;
  weather_custom_temp_c?: number;
  weather_custom_humidity_pct?: number;
  weather_custom_location?: string;
  weather_custom_desc?: string;
  voice_tts_enabled?: boolean;
  chat_dock_side?: string;
  auto_action_interval_sec?: number;
  auto_behaviors_json?: string;
}

let currentActiveCharType: string =
  localStorage.getItem('mate_active_character_type') || 'microduck';
let currentStudioVrmUrl: string = '';

export async function saveStudioConfigToSqlite(
  overrideCharType?: string,
  overrideVrmUrl?: string
) {
  if (overrideCharType) {
    currentActiveCharType = overrideCharType;
    localStorage.setItem('mate_active_character_type', overrideCharType);
  }
  if (overrideVrmUrl !== undefined) {
    currentStudioVrmUrl = overrideVrmUrl;
  }

  const config: AvatarStudioConfig = {
    active_character_type: currentActiveCharType,
    vrm_url: currentStudioVrmUrl,
    duck_body_color: appState.duckBodyColor,
    duck_accent_color: appState.duckAccentColor,
    model_scale: appState.modelScale,
    gravity: appState.gravity,
    bounce_factor: appState.bounceFactor,
    auto_roam_enabled: appState.autoRoamEnabled,
    look_at_enabled: appState.lookAtEnabled,
    window_interact_enabled: appState.windowInteractEnabled,
    ollama_model: ollamaModel,
    gemini_api_key: geminiApiKey,
    gemini_model: geminiModel,
    llm_route_mode: llmRouteMode,
    auto_check_enabled: autoCheckEnabled,
    cpu_alert_pct: cpuAlertPct,
    ram_alert_gb: ramAlertGb,
    sound_fx_enabled: isSoundEnabled(),
    sound_volume: getSoundVolume(),
    english_interval_min: appState.englishIntervalMin,
    news_interval_min: appState.newsIntervalMin,
    weather_interval_min: appState.weatherIntervalMin,
    app_metrics_interval_min: appState.appMetricsIntervalMin,
    btc_interval_min: appState.btcIntervalMin,
    weather_source_mode: appState.weatherSourceMode,
    weather_custom_mode: appState.weatherCustomMode,
    weather_custom_temp_c: appState.weatherCustomTempC,
    weather_custom_humidity_pct: appState.weatherCustomHumidityPct,
    weather_custom_location: appState.weatherCustomLocation,
    weather_custom_desc: appState.weatherCustomDesc,
    voice_tts_enabled: !duckVoiceMuted,
    chat_dock_side: appState.chatDockSide,
    auto_action_interval_sec: appState.getAutoActionDelay(),
    auto_behaviors_json: JSON.stringify(appState.autoBehaviors),
  };

  try {
    await invoke('save_avatar_studio_config', { config });
  } catch (err) {
    console.warn('[WARN] save_avatar_studio_config error', err);
  }
}

async function loadStudioConfigFromSqlite() {
  try {
    const cfg = await invoke<AvatarStudioConfig>('get_avatar_studio_config');
    if (!cfg) return;

    currentActiveCharType = cfg.active_character_type || 'microduck';
    currentStudioVrmUrl = cfg.vrm_url || '';
    localStorage.setItem('mate_active_character_type', currentActiveCharType);

    appState.duckBodyColor = cfg.duck_body_color || '#f4f4f6';
    appState.duckAccentColor = cfg.duck_accent_color || '#f97316';
    if (colorDuckBody) colorDuckBody.value = appState.duckBodyColor;
    if (colorDuckAccent) colorDuckAccent.value = appState.duckAccentColor;

    appState.modelScale = cfg.model_scale || 1.0;
    if (sliderScale) sliderScale.value = String(appState.modelScale);
    if (valScale) valScale.textContent = `${appState.modelScale.toFixed(2)}x`;

    appState.gravity = cfg.gravity ?? 0.68;
    if (sliderGravity) sliderGravity.value = String(appState.gravity);
    if (valGravity) valGravity.textContent = appState.gravity.toFixed(2);

    appState.bounceFactor = cfg.bounce_factor ?? 0.42;
    if (sliderBounce) sliderBounce.value = String(appState.bounceFactor);
    if (valBounce) valBounce.textContent = appState.bounceFactor.toFixed(2);

    appState.autoRoamEnabled = cfg.auto_roam_enabled ?? true;
    if (chkAutoroam) chkAutoroam.checked = appState.autoRoamEnabled;

    if (
      typeof cfg.auto_action_interval_sec === 'number' &&
      Number.isFinite(cfg.auto_action_interval_sec) &&
      cfg.auto_action_interval_sec >= 5
    ) {
      appState.autoActionIntervalSec = Math.max(
        5,
        Math.min(300, Math.round(cfg.auto_action_interval_sec))
      );
      localStorage.setItem(
        'mate_auto_action_interval_sec',
        String(appState.autoActionIntervalSec)
      );
    }
    appState.nextRoamDuration = Math.min(
      appState.nextRoamDuration,
      appState.getAutoActionDelay()
    );
    appState.applyAutoBehaviorsJson(cfg.auto_behaviors_json);
    renderAutoBehaviorToggles();
    syncAutoBehaviorUiState();

    appState.lookAtEnabled = cfg.look_at_enabled ?? true;
    if (chkLookat) chkLookat.checked = appState.lookAtEnabled;

    appState.windowInteractEnabled = cfg.window_interact_enabled ?? true;
    if (chkWinInteract) chkWinInteract.checked = appState.windowInteractEnabled;

    if (cfg.sound_fx_enabled !== undefined) {
      setSoundEnabled(cfg.sound_fx_enabled);
    }
    if (chkSoundFx) chkSoundFx.checked = isSoundEnabled();

    if (cfg.sound_volume !== undefined) {
      setSoundVolume(cfg.sound_volume);
    }
    const currentVol = getSoundVolume();
    if (sliderSoundVolume) sliderSoundVolume.value = String(currentVol);
    if (valSoundVolume) valSoundVolume.textContent = `${Math.round(currentVol * 100)}%`;

    if (cfg.voice_tts_enabled !== undefined) {
      duckVoiceMuted = !cfg.voice_tts_enabled;
      localStorage.setItem('mate_duck_voice_muted', String(duckVoiceMuted));
    }
    syncDockVoiceUi();

    if (cfg.chat_dock_side === 'left' || cfg.chat_dock_side === 'right') {
      appState.chatDockSide = cfg.chat_dock_side;
      localStorage.setItem('mate_chat_dock_side', cfg.chat_dock_side);
    }
    syncChatDockSideUi();

    if (typeof cfg.english_interval_min === 'number' && Number.isFinite(cfg.english_interval_min)) {
      appState.englishIntervalMin = Math.max(0, Math.min(360, Math.round(cfg.english_interval_min)));
      localStorage.setItem('mate_english_interval_min', String(appState.englishIntervalMin));
    }
    if (inputCfgEnglishMin) inputCfgEnglishMin.value = String(appState.englishIntervalMin);

    if (typeof cfg.news_interval_min === 'number' && Number.isFinite(cfg.news_interval_min)) {
      appState.newsIntervalMin = Math.max(0, Math.min(360, Math.round(cfg.news_interval_min)));
      localStorage.setItem('mate_news_interval_min', String(appState.newsIntervalMin));
    }
    if (inputCfgNewsMin) inputCfgNewsMin.value = String(appState.newsIntervalMin);

    if (typeof cfg.weather_interval_min === 'number' && Number.isFinite(cfg.weather_interval_min)) {
      appState.weatherIntervalMin = Math.max(0, Math.min(360, Math.round(cfg.weather_interval_min)));
      localStorage.setItem('mate_weather_interval_min', String(appState.weatherIntervalMin));
    }
    if (inputCfgWeatherMin) inputCfgWeatherMin.value = String(appState.weatherIntervalMin);

    if (
      typeof cfg.app_metrics_interval_min === 'number' &&
      Number.isFinite(cfg.app_metrics_interval_min)
    ) {
      appState.appMetricsIntervalMin = Math.max(
        0,
        Math.min(360, Math.round(cfg.app_metrics_interval_min))
      );
      localStorage.setItem('mate_app_metrics_interval_min', String(appState.appMetricsIntervalMin));
    }
    if (inputCfgAppMetricsMin) inputCfgAppMetricsMin.value = String(appState.appMetricsIntervalMin);

    if (typeof cfg.btc_interval_min === 'number' && Number.isFinite(cfg.btc_interval_min)) {
      appState.btcIntervalMin = Math.max(0, Math.min(360, Math.round(cfg.btc_interval_min)));
      localStorage.setItem('mate_btc_interval_min', String(appState.btcIntervalMin));
    }
    if (inputCfgBtcMin) inputCfgBtcMin.value = String(appState.btcIntervalMin);

    if (cfg.weather_source_mode === 'custom' || cfg.weather_source_mode === 'api') {
      appState.weatherSourceMode = cfg.weather_source_mode;
      localStorage.setItem('mate_weather_source_mode', cfg.weather_source_mode);
    }
    if (selectCfgWeatherSource) selectCfgWeatherSource.value = appState.weatherSourceMode;
    if (cfgWeatherApiBox) {
      cfgWeatherApiBox.style.display = appState.weatherSourceMode === 'api' ? 'flex' : 'none';
    }
    if (cfgWeatherCustomBox) {
      cfgWeatherCustomBox.style.display = appState.weatherSourceMode === 'custom' ? 'block' : 'none';
    }
    if (inputCfgWeatherCity) {
      inputCfgWeatherCity.value = localStorage.getItem('mate_weather_city') || appState.weatherCityQuery || 'auto';
    }

    if (
      cfg.weather_custom_mode &&
      (['clear', 'rain', 'hot', 'cold', 'wind', 'night'] as const).includes(
        cfg.weather_custom_mode as WeatherEffectMode
      )
    ) {
      appState.weatherCustomMode = cfg.weather_custom_mode as WeatherEffectMode;
      localStorage.setItem('mate_weather_custom_mode', appState.weatherCustomMode);
    }
    if (selectCfgWeatherCustomMode) selectCfgWeatherCustomMode.value = appState.weatherCustomMode;

    if (typeof cfg.weather_custom_temp_c === 'number' && Number.isFinite(cfg.weather_custom_temp_c)) {
      appState.weatherCustomTempC = Math.max(-30, Math.min(55, cfg.weather_custom_temp_c));
      localStorage.setItem('mate_weather_custom_temp', String(appState.weatherCustomTempC));
    }
    if (inputCfgWeatherTemp) inputCfgWeatherTemp.value = String(appState.weatherCustomTempC);

    if (
      typeof cfg.weather_custom_humidity_pct === 'number' &&
      Number.isFinite(cfg.weather_custom_humidity_pct)
    ) {
      appState.weatherCustomHumidityPct = Math.max(
        0,
        Math.min(100, Math.round(cfg.weather_custom_humidity_pct))
      );
      localStorage.setItem('mate_weather_custom_hum', String(appState.weatherCustomHumidityPct));
    }
    if (inputCfgWeatherHum) inputCfgWeatherHum.value = String(appState.weatherCustomHumidityPct);

    if (cfg.weather_custom_location) {
      appState.weatherCustomLocation = cfg.weather_custom_location;
      localStorage.setItem('mate_weather_custom_loc', cfg.weather_custom_location);
    }
    if (inputCfgWeatherLoc) inputCfgWeatherLoc.value = appState.weatherCustomLocation;

    if (cfg.weather_custom_desc) {
      appState.weatherCustomDesc = cfg.weather_custom_desc;
      localStorage.setItem('mate_weather_custom_desc', cfg.weather_custom_desc);
    }
    if (inputCfgWeatherDesc) inputCfgWeatherDesc.value = appState.weatherCustomDesc;

    if (appState.weatherSourceMode === 'custom') {
      void syncLiveWeather3D('auto', false);
    } else {
      updateStudioWeatherPreviewUi();
    }

    if (vrmUrlInput && currentStudioVrmUrl) {
      vrmUrlInput.value = currentStudioVrmUrl;
    }

    if (cfg.ollama_model) {
      setOllamaModel(cfg.ollama_model);
      if (inputOllamaModel) inputOllamaModel.value = cfg.ollama_model;
    }
    if (cfg.gemini_api_key !== undefined) {
      setGeminiApiKey(cfg.gemini_api_key);
      if (inputGeminiKey) inputGeminiKey.value = cfg.gemini_api_key;
    }
    if (cfg.gemini_model) {
      setGeminiModel(cfg.gemini_model);
      if (inputGeminiModel) inputGeminiModel.value = cfg.gemini_model;
    }
    if (cfg.llm_route_mode) {
      setLlmRouteMode(cfg.llm_route_mode as LlmRouteMode);
      if (selectLlmRoute) selectLlmRoute.value = cfg.llm_route_mode;
    }
    if (cfg.auto_check_enabled !== undefined) {
      setAutoCheckEnabled(cfg.auto_check_enabled);
      if (chkAutocheck) chkAutocheck.checked = cfg.auto_check_enabled;
    }
    if (cfg.cpu_alert_pct) {
      setCpuAlertPct(cfg.cpu_alert_pct, false);
    }
    if (cfg.ram_alert_gb) {
      setRamAlertGb(cfg.ram_alert_gb, false);
    }

    updateUiPosition();

    if (currentActiveCharType === 'idol') {
      if (appState.builtinModelType !== 'idol' || appState.currentVrm || appState.currentGlbScene) {
        createDetailedAnimeCharacter();
      }
      if (btnActDuck) btnActDuck.textContent = 'Đổi Vịt BDX';
    } else if (currentActiveCharType === 'custom_vrm') {
      if (!appState.currentVrm && !appState.currentGlbScene) {
        const cached = await loadCachedVrm();
        if (cached) {
          const blobUrl = URL.createObjectURL(new Blob([cached.buffer]));
          loadVrmFromBlobUrl(blobUrl, cached.name);
        } else if (currentStudioVrmUrl) {
          void loadVrmFromUrl(currentStudioVrmUrl, 'Saved VRM Model');
        }
      }
    } else {
      createMicroDuckCharacter();
      if (btnActDuck) btnActDuck.textContent = 'Đổi Cyber Idol';
    }

    if (rigRoot && !appState.currentVrm && !appState.currentGlbScene) {
      rigRoot.scale.setScalar(appState.modelScale);
    }
    if (appState.currentVrm) {
      applyVrmScaleAndOffset(appState.currentVrm);
    }
    if (appState.currentGlbScene) {
      applyGlbScaleAndOffset(appState.currentGlbScene);
    }
  } catch (err) {
    console.warn('[WARN] loadStudioConfigFromSqlite error', err);
  }
}

let chatHistoryLoadedFromDb = false;

export function toggleBubbleVisibility(forceState?: boolean) {
  appState.isBubbleVisible =
    forceState !== undefined ? forceState : !appState.isBubbleVisible;
  if (speechBubble) {
    speechBubble.style.display = appState.isBubbleVisible ? 'flex' : 'none';
  }
  syncHitboxToRust(true);
}

export function toggleChatVisibility(forceState?: boolean) {
  appState.isChatOpen =
    forceState !== undefined ? forceState : !appState.isChatOpen;
  if (chatDialogPanel) {
    chatDialogPanel.style.display = appState.isChatOpen ? 'flex' : 'none';
  }
  if (dockBtnChat) {
    dockBtnChat.classList.toggle('active', appState.isChatOpen);
  }
  if (btnOpenChatFromBubble) {
    btnOpenChatFromBubble.textContent = appState.isChatOpen ? 'Thu gọn -' : 'Lịch sử +';
  }
  if (appState.isChatOpen) {
    if (!appState.isBubbleVisible) {
      toggleBubbleVisibility(true);
    }
    if (!chatHistoryLoadedFromDb) {
      chatHistoryLoadedFromDb = true;
      void invoke<ChatEntry[]>('memory_get_recent_chats', { limit: 20 })
        .then((entries) => {
          if (entries && entries.length > 0 && chatHistoryList) {
            chatHistoryList.innerHTML = '';
            entries.forEach((entry) => {
              appendChatMessage(
                entry.role === 'user' ? 'user' : 'assistant',
                entry.content
              );
            });
          }
        })
        .catch(() => { });
    }
    if (bubbleInput) {
      setTimeout(() => bubbleInput.focus(), 60);
    }
  }
  updateUiPosition();
  syncHitboxToRust(true);
}

export function appendChatMessage(role: 'user' | 'assistant', text: string) {
  if (!chatHistoryList) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg msg-${role}`;
  const authorTag = document.createElement('div');
  authorTag.className = 'msg-author-tag';
  authorTag.textContent = role === 'user' ? '[BẠN]' : '[AI MATE]';
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'msg-bubble';
  bubbleDiv.textContent = text;
  msgDiv.appendChild(authorTag);
  msgDiv.appendChild(bubbleDiv);
  chatHistoryList.appendChild(msgDiv);
  chatHistoryList.scrollTop = chatHistoryList.scrollHeight;
}

async function refreshStudioLlmUi() {
  if (studioGeminiStatus) {
    const hasKey = Boolean(geminiApiKey.trim());
    studioGeminiStatus.textContent = hasKey ? '[GEMINI: READY]' : '[GEMINI: NO KEY]';
    studioGeminiStatus.style.color = hasKey ? '#6ee7b7' : '#cbd5e1';
  }
  if (!studioOllamaStatus || !ollamaModelsChips) return;

  studioOllamaStatus.textContent = '[OLLAMA: SCANNING]';
  try {
    const models = await invoke<string[]>('list_ollama_models');
    studioOllamaStatus.textContent = `[OLLAMA: ${models.length} MODEL]`;
    studioOllamaStatus.style.color = '#6ee7b7';
    ollamaModelsChips.innerHTML = '';
    models.slice(0, 6).forEach((m) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chat-chip';
      chip.textContent = m;
      if (m === ollamaModel) {
        chip.style.borderColor = '#34d399';
        chip.style.color = '#6ee7b7';
      }
      chip.addEventListener('click', () => {
        if (inputOllamaModel) inputOllamaModel.value = m;
        setOllamaModel(m);
        void saveStudioConfigToSqlite();
        void refreshStudioLlmUi();
      });
      ollamaModelsChips.appendChild(chip);
    });
  } catch {
    studioOllamaStatus.textContent = '[OLLAMA: OFFLINE]';
    studioOllamaStatus.style.color = '#fca5a5';
  }
}

export async function refreshDesktopIconsSelect() {
  if (!selectDesktopIcon) return;
  const list = await fetchDesktopIcons();
  if (!list || !list.icons || list.icons.length === 0) return;
  const prev = selectDesktopIcon.value;
  selectDesktopIcon.innerHTML = [
    '<option value="">Ngẫu nhiên Icon ngoài Desktop...</option>',
    ...list.icons.map((ic) => `<option value="${ic.name}">${ic.name}</option>`),
  ].join('');
  if (prev && list.icons.some((ic) => ic.name === prev)) {
    selectDesktopIcon.value = prev;
  }
}

function closeOtherPopupModals(
  except?: 'studio' | 'memory' | 'notif' | 'p2p' | 'pc' | 'ocr' | 'toolforge' | 'tarot'
) {
  if (except !== 'studio') {
    appState.isStudioOpen = false;
    if (studioPanel) studioPanel.style.display = 'none';
    if (dockBtnStudio) dockBtnStudio.classList.remove('active');
  }
  if (except !== 'memory') {
    appState.isLongMemoryOpen = false;
    if (longMemoryPanel) longMemoryPanel.style.display = 'none';
  }
  if (except !== 'notif') {
    appState.isNotificationManagerOpen = false;
    if (notificationPanel) notificationPanel.style.display = 'none';
  }
  if (except !== 'p2p') {
    appState.isP2pArenaOpen = false;
    if (p2pArenaPanel) p2pArenaPanel.style.display = 'none';
    if (dockBtnP2p) dockBtnP2p.classList.remove('active');
  }
  if (except !== 'pc') {
    appState.isPcControlOpen = false;
    if (pcControlModal) pcControlModal.style.display = 'none';
    if (dockBtnPcControl) dockBtnPcControl.classList.remove('active');
  }
  if (except !== 'ocr') {
    appState.isOcrModalOpen = false;
    if (ocrTranslateModal) ocrTranslateModal.style.display = 'none';
  }
  if (except !== 'toolforge') {
    appState.isToolForgeOpen = false;
    if (toolForgeModal) toolForgeModal.style.display = 'none';
  }
  if (except !== 'tarot') {
    appState.isTarotModalOpen = false;
    if (tarotModal) tarotModal.style.display = 'none';
    if (dockBtnTarot) dockBtnTarot.classList.remove('active');
  }
}

export function toggleStudioModal(forceState?: boolean) {
  appState.isStudioOpen = forceState !== undefined ? forceState : !appState.isStudioOpen;
  if (appState.isStudioOpen) {
    closeOtherPopupModals('studio');
    updateStudioWeatherPreviewUi();
    void refreshStudioLlmUi();
  }
  studioPanel.style.display = appState.isStudioOpen ? 'block' : 'none';
  dockBtnStudio.classList.toggle('active', appState.isStudioOpen);
  syncHitboxToRust(true);
}

export function toggleLongMemoryModal(forceState?: boolean) {
  appState.isLongMemoryOpen =
    forceState !== undefined ? forceState : !appState.isLongMemoryOpen;
  if (appState.isLongMemoryOpen) {
    closeOtherPopupModals('memory');
    void refreshLongMemoryUi();
  }
  longMemoryPanel.style.display = appState.isLongMemoryOpen ? 'block' : 'none';
  syncHitboxToRust(true);
}

export function toggleNotificationModal(forceState?: boolean) {
  appState.isNotificationManagerOpen =
    forceState !== undefined ? forceState : !appState.isNotificationManagerOpen;
  if (appState.isNotificationManagerOpen) {
    closeOtherPopupModals('notif');
    void refreshNotificationUi();
  }
  notificationPanel.style.display = appState.isNotificationManagerOpen ? 'block' : 'none';
  syncHitboxToRust(true);
}

export function toggleP2pArenaModal(forceState?: boolean) {
  appState.isP2pArenaOpen =
    forceState !== undefined ? forceState : !appState.isP2pArenaOpen;
  if (appState.isP2pArenaOpen) {
    closeOtherPopupModals('p2p');
    void refreshP2pStatus();
  }
  if (p2pArenaPanel) {
    p2pArenaPanel.style.display = appState.isP2pArenaOpen ? 'block' : 'none';
  }
  if (dockBtnP2p) {
    dockBtnP2p.classList.toggle('active', appState.isP2pArenaOpen);
  }
  renderP2pArenaUi();
  syncHitboxToRust(true);
}

export function togglePcControlModal(forceState?: boolean) {
  appState.isPcControlOpen =
    forceState !== undefined ? forceState : !appState.isPcControlOpen;
  if (appState.isPcControlOpen) {
    closeOtherPopupModals('pc');
  }
  if (pcControlModal) {
    pcControlModal.style.display = appState.isPcControlOpen ? 'block' : 'none';
  }
  if (dockBtnPcControl) {
    dockBtnPcControl.classList.toggle('active', appState.isPcControlOpen);
  }
  syncHitboxToRust(true);
}

export function toggleOcrTranslateModal(forceState?: boolean) {
  appState.isOcrModalOpen =
    forceState !== undefined ? forceState : !appState.isOcrModalOpen;
  if (appState.isOcrModalOpen) {
    closeOtherPopupModals('ocr');
  }
  if (ocrTranslateModal) {
    ocrTranslateModal.style.display = appState.isOcrModalOpen ? 'block' : 'none';
  }
  syncHitboxToRust(true);
}

function setToolForgeTab(tab: 'forge' | 'skills') {
  const btnForge = document.getElementById('tab-btn-tf-forge');
  const btnSkills = document.getElementById('tab-btn-tf-skills');
  const paneForge = document.getElementById('tf-pane-forge');
  const paneSkills = document.getElementById('tf-pane-skills');
  if (btnForge) btnForge.classList.toggle('active', tab === 'forge');
  if (btnSkills) btnSkills.classList.toggle('active', tab === 'skills');
  if (paneForge) paneForge.style.display = tab === 'forge' ? 'block' : 'none';
  if (paneSkills) paneSkills.style.display = tab === 'skills' ? 'block' : 'none';
}

function setToolForgePipelineLog(text: string) {
  const el = document.getElementById('tf-pipeline-log');
  if (el) {
    el.textContent = text;
    el.scrollTop = el.scrollHeight;
  }
}

function appendToolForgePipelineLog(line: string) {
  const el = document.getElementById('tf-pipeline-log');
  if (el) {
    el.textContent = el.textContent ? `${el.textContent}\n${line}` : line;
    el.scrollTop = el.scrollHeight;
  }
}

function renderToolForgeDraft(draft: ToolForgeDraft | null) {
  const sec = document.getElementById('tf-draft-section');
  const nameInp = document.getElementById('tf-draft-name') as HTMLInputElement | null;
  const idInp = document.getElementById('tf-draft-id') as HTMLInputElement | null;
  const trigInp = document.getElementById('tf-draft-triggers') as HTMLInputElement | null;
  const kwInp = document.getElementById('tf-draft-keywords') as HTMLInputElement | null;
  const argsInp = document.getElementById('tf-draft-test-args') as HTMLInputElement | null;
  const langTag = document.getElementById('tf-draft-lang-tag');
  const codeEd = document.getElementById('tf-code-editor') as HTMLTextAreaElement | null;
  const badge = document.getElementById('tf-verify-badge');
  const reportBox = document.getElementById('tf-sandbox-report');
  const saveBtn = document.getElementById('btn-tf-confirm-save') as HTMLButtonElement | null;

  if (!draft) {
    if (sec) sec.style.display = 'none';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.45';
    }
    return;
  }

  if (sec) sec.style.display = 'block';
  if (nameInp) nameInp.value = draft.name;
  if (idInp) idInp.value = draft.id;
  if (trigInp) trigInp.value = draft.triggers.join(', ');
  if (kwInp) kwInp.value = draft.expectedKeywords.join(', ');
  if (argsInp) argsInp.value = draft.testArgsJson || '{}';
  if (langTag) langTag.textContent = `[${draft.language.toUpperCase()}]`;
  if (codeEd && codeEd.value !== draft.code) codeEd.value = draft.code;

  const sb = draft.sandbox;
  const verified = Boolean(sb?.verified);
  if (badge) {
    badge.className = `badge ${verified ? 'tf-badge-pass' : 'tf-badge-fail'}`;
    if (verified) {
      badge.textContent = `[VERIFIED PASS - ${sb?.duration_ms || 0}ms]`;
    } else if (sb && !sb.static_safe) {
      badge.textContent = '[SAFETY BLOCKED]';
    } else if (sb) {
      badge.textContent = '[SANDBOX FAILED]';
    } else {
      badge.textContent = '[CHƯA KIỂM CHỨNG]';
    }
  }

  if (saveBtn) {
    saveBtn.disabled = !verified;
    saveBtn.style.opacity = verified ? '1' : '0.45';
  }

  if (reportBox) {
    if (!sb) {
      reportBox.textContent =
        '[SANDBOX] Mã nguồn chưa kiểm chứng hoặc vừa chỉnh sửa. Bấm "Chạy Sandbox" trước khi đóng gói.';
    } else {
      const parts: string[] = [
        `Trạng thái: ${sb.verified ? 'PASS (Được phép đóng gói)' : 'FAIL (Bị chặn đóng gói)'} | Exit=${sb.exit_code} | ${sb.duration_ms}ms | Hash=${sb.code_hash}`,
      ];
      if (!sb.static_safe && sb.safety_issues.length > 0) {
        parts.push(`Cảnh báo an toàn: ${sb.safety_issues.join('; ')}`);
      }
      if (sb.failure_reason) {
        parts.push(`Lý do chưa đạt: ${sb.failure_reason}`);
      }
      if (sb.stdout) {
        parts.push(`--- STDOUT ---\n${sb.stdout}`);
      }
      if (sb.stderr) {
        parts.push(`--- STDERR ---\n${sb.stderr}`);
      }
      reportBox.textContent = parts.join('\n');
    }
  }

  if (draft.healLogs.length > 0) {
    setToolForgePipelineLog(draft.healLogs.join('\n'));
  }
}

function renderToolForgeSkillsList() {
  const skills = getCachedCustomSkills();
  const countBadge = document.getElementById('tf-skills-count');
  const container = document.getElementById('tf-skills-list');
  if (countBadge) {
    countBadge.textContent = String(skills.length);
  }
  if (!container) return;

  if (skills.length === 0) {
    container.innerHTML =
      '<div class="dash-sub">Chưa có Skill tùy chỉnh nào được kiểm chứng &amp; lưu. Hãy tạo thử ở tab bên trái!</div>';
    return;
  }

  container.innerHTML = '';
  skills.forEach((sk: CustomSkillRecord) => {
    const card = document.createElement('div');
    card.className = 'tf-skill-card';

    const head = document.createElement('div');
    head.className = 'tf-skill-card-head';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:12px;font-weight:700;color:#f8fafc;';
    nameEl.textContent = sk.name;

    const verBadge = document.createElement('span');
    verBadge.className = `badge ${sk.verified ? 'tf-badge-pass' : 'tf-badge-fail'}`;
    verBadge.style.fontSize = '9px';
    verBadge.textContent = `[v${sk.version} | ${sk.language.toUpperCase()} | ${sk.verified ? 'VERIFIED' : 'UNVERIFIED'
      }]`;

    const statsBadge = document.createElement('span');
    statsBadge.className = 'badge';
    statsBadge.style.cssText = 'font-size:9px;text-transform:none;';
    statsBadge.textContent = `Dùng: ${sk.usage_count} | Tự vá: ${sk.heal_count}`;

    titleWrap.append(nameEl, verBadge, statsBadge);

    const toggleLbl = document.createElement('label');
    toggleLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10.5px;color:#cbd5e1;cursor:pointer;';
    const toggleChk = document.createElement('input');
    toggleChk.type = 'checkbox';
    toggleChk.checked = sk.enabled;
    toggleChk.addEventListener('change', () => {
      void invoke('tool_forge_toggle_skill', {
        id: sk.id,
        enabled: toggleChk.checked,
      })
        .then(() => void refreshCustomSkills())
        .catch(() => { });
    });
    const toggleTxt = document.createElement('span');
    toggleTxt.textContent = 'Bật';
    toggleLbl.append(toggleChk, toggleTxt);

    head.append(titleWrap, toggleLbl);

    const descEl = document.createElement('div');
    descEl.style.cssText = 'font-size:10.5px;color:#94a3b8;line-height:1.35;';
    const trigList = parseTriggers(sk.triggers_json).slice(0, 6).join(', ');
    descEl.textContent = `${sk.description} | Triggers: ${trigList || sk.id}${sk.last_heal_note ? ` | Ghi chú vá: ${sk.last_heal_note}` : ''
      }`;

    const runRow = document.createElement('div');
    runRow.style.cssText = 'display:flex;gap:5px;align-items:center;flex-wrap:wrap;';

    const argsInput = document.createElement('input');
    argsInput.type = 'text';
    argsInput.className = 'studio-input';
    argsInput.style.cssText = 'flex:1;min-width:140px;font-size:10.5px;';
    argsInput.value = sk.test_args_json || '{}';
    argsInput.title = 'Tham số JSON khi chạy thử Skill này';

    const btnRun = document.createElement('button');
    btnRun.type = 'button';
    btnRun.className = 'action-btn';
    btnRun.style.cssText = 'padding:4px 8px;font-size:10.5px;border-color:rgba(52,211,153,0.5);color:#6ee7b7;';
    btnRun.textContent = 'Chạy Ngay';

    const btnLoadDraft = document.createElement('button');
    btnLoadDraft.type = 'button';
    btnLoadDraft.className = 'action-btn';
    btnLoadDraft.style.cssText = 'padding:4px 8px;font-size:10.5px;';
    btnLoadDraft.textContent = 'Mở Sandbox';

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'action-btn';
    btnDel.style.cssText = 'padding:4px 8px;font-size:10.5px;border-color:rgba(248,113,113,0.45);color:#fca5a5;';
    btnDel.textContent = 'Xóa';

    const outPre = document.createElement('div');
    outPre.className = 'tf-report-box';
    outPre.style.display = 'none';

    btnRun.addEventListener('click', async () => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(argsInput.value.trim() || '{}') as Record<string, unknown>;
      } catch {
        outPre.style.display = 'block';
        outPre.textContent = '[ERR] Tham số JSON không hợp lệ.';
        return;
      }
      btnRun.disabled = true;
      btnRun.textContent = 'Đang chạy...';
      outPre.style.display = 'block';
      outPre.textContent = '[RUN] Đang thực thi skill (hỗ trợ tự vá Self-Healing nếu lỗi)...';
      try {
        const resText = await executeSavedSkillWithSelfHeal(sk.id, parsedArgs, (msg) => {
          outPre.textContent = msg;
        });
        outPre.textContent = resText;
        speakMessage(resText);
      } catch (err) {
        outPre.textContent = `[ERR] ${String(err)}`;
      } finally {
        btnRun.disabled = false;
        btnRun.textContent = 'Chạy Ngay';
        renderToolForgeSkillsList();
      }
    });

    btnLoadDraft.addEventListener('click', () => {
      const kws = parseExpectedKeywords(sk.expected_keywords_json);
      const trigs = parseTriggers(sk.triggers_json);
      let schema = [];
      try {
        schema = JSON.parse(sk.params_schema_json || '[]');
      } catch {
        schema = [];
      }
      const loadedDraft: ToolForgeDraft = {
        id: sk.id,
        name: sk.name,
        description: sk.description,
        language: sk.language === 'python' ? 'python' : 'powershell',
        triggers: trigs,
        paramsSchema: schema,
        code: sk.code,
        testArgsJson: sk.test_args_json || '{}',
        expectedKeywords: kws,
        sandbox: null,
        healLogs: [`[EDIT] Nạp lại "${sk.name}" v${sk.version} vào Sandbox để kiểm tra/cải tiến.`],
        originalRequest: sk.description,
      };
      setLatestToolForgeDraft(loadedDraft);
      setToolForgeTab('forge');
      renderToolForgeDraft(loadedDraft);
    });

    btnDel.addEventListener('click', () => {
      void invoke('tool_forge_delete_skill', { id: sk.id })
        .then(() => void refreshCustomSkills())
        .catch(() => { });
    });

    runRow.append(argsInput, btnRun, btnLoadDraft, btnDel);
    card.append(head, descEl, runRow, outPre);
    container.appendChild(card);
  });
}

export function toggleToolForgeModal(forceState?: boolean) {
  appState.isToolForgeOpen =
    forceState !== undefined ? forceState : !appState.isToolForgeOpen;
  if (appState.isToolForgeOpen) {
    closeOtherPopupModals('toolforge');
    void refreshCustomSkills().then(() => renderToolForgeSkillsList());
    renderToolForgeDraft(getLatestToolForgeDraft());
  }
  if (toolForgeModal) {
    toolForgeModal.style.display = appState.isToolForgeOpen ? 'block' : 'none';
  }
  syncHitboxToRust(true);
}

let cachedTarotStatus: TarotStatusResponse | null = null;
let tarotDrawingInFlight = false;

function formatTarotCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setTarotTab(tab: 'today' | 'history') {
  const btnToday = document.getElementById('tab-btn-tarot-today');
  const btnHist = document.getElementById('tab-btn-tarot-history');
  const paneToday = document.getElementById('tarot-pane-today');
  const paneHist = document.getElementById('tarot-pane-history');
  if (btnToday) btnToday.classList.toggle('active', tab === 'today');
  if (btnHist) btnHist.classList.toggle('active', tab === 'history');
  if (paneToday) paneToday.style.display = tab === 'today' ? 'block' : 'none';
  if (paneHist) paneHist.style.display = tab === 'history' ? 'block' : 'none';
}

function renderTarotHistoryList(history: TarotReadingRecord[]) {
  const countEl = document.getElementById('tarot-history-count');
  if (countEl) countEl.textContent = String(history.length);
  const listEl = document.getElementById('tarot-history-list');
  if (!listEl) return;

  if (!history.length) {
    listEl.innerHTML = '<div class="dash-sub">Chưa có quẻ Tarot nào được lưu.</div>';
    return;
  }

  listEl.innerHTML = '';
  for (const rec of history) {
    const card = document.createElement('div');
    card.className = 'tarot-hist-card';
    const dt = new Date(rec.drawn_at_ms);
    const timeStr = `${dt.toLocaleDateString('vi-VN')} ${dt.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
        <strong style="font-size:12px;color:#f8fafc;">${rec.card_name_vi} (${rec.card_name})</strong>
        <span class="badge tarot-tier-${rec.fortune_code}" style="font-size:10px;">${rec.fortune_label} (${rec.luck_score}/100)</span>
      </div>
      <div style="font-size:10.5px;color:#94a3b8;">${timeStr} | ${rec.is_reversed ? 'Ngược Chiều' : 'Thuận Chiều'} | ${rec.can_chi_day}</div>
      <div style="font-size:11px;color:#cbd5e1;line-height:1.4;">${rec.summary_vi}</div>
    `;
    listEl.appendChild(card);
  }
}

function applyTarotReadingToModal(rec: TarotReadingRecord | null, animateFlip: boolean) {
  const revealStage = document.getElementById('tarot-reveal-stage');
  const cardInner = document.getElementById('tarot-card-inner');
  const cardFront = document.getElementById('tarot-card-front');
  const verdictPill = document.getElementById('tarot-card-verdict-pill');
  const nameViEl = document.getElementById('tarot-card-name-vi');
  const nameEnEl = document.getElementById('tarot-card-name-en');
  const orientEl = document.getElementById('tarot-card-orient-tag');
  const fortuneBadge = document.getElementById('tarot-fortune-badge');
  const luckScoreEl = document.getElementById('tarot-luck-score');
  const luckFillEl = document.getElementById('tarot-luck-fill') as HTMLElement | null;
  const luckyStripEl = document.getElementById('tarot-lucky-strip');
  const summaryEl = document.getElementById('tarot-summary-vi');
  const advWorkEl = document.getElementById('tarot-adv-work');
  const advWealthEl = document.getElementById('tarot-adv-wealth');
  const advLoveEl = document.getElementById('tarot-adv-love');
  const advRemedyEl = document.getElementById('tarot-adv-remedy');
  const aiBoxEl = document.getElementById('tarot-ai-box');
  const canChiBadge = document.getElementById('tarot-canchi-badge');
  const sourceBadge = document.getElementById('tarot-source-badge');

  if (!revealStage) return;
  if (!rec) {
    revealStage.style.display = 'none';
    if (canChiBadge) canChiBadge.textContent = 'Can Chi: Sẵn sàng luận quẻ';
    return;
  }

  revealStage.style.display = 'grid';
  if (canChiBadge) canChiBadge.textContent = `${rec.can_chi_day} | ${rec.ngu_hanh}`;
  if (sourceBadge) sourceBadge.textContent = `Nguồn: ${rec.api_source}`;

  const tierClass = `tarot-tier-${rec.fortune_code}`;
  if (cardFront) {
    cardFront.className = `tarot-card-face tarot-card-front ${tierClass}${rec.is_reversed ? ' is-reversed' : ''
      }`;
  }
  if (verdictPill) verdictPill.textContent = rec.fortune_label;
  if (nameViEl) nameViEl.textContent = rec.card_name_vi;
  if (nameEnEl) nameEnEl.textContent = rec.card_name;
  if (orientEl) orientEl.textContent = rec.is_reversed ? 'NGƯỢC CHIỀU' : 'THUẬN CHIỀU';

  if (fortuneBadge) {
    fortuneBadge.className = `badge tarot-tier-badge ${tierClass}`;
    fortuneBadge.textContent = `${rec.fortune_label} (${rec.is_reversed ? 'Ngược' : 'Thuận'})`;
  }
  if (luckScoreEl) luckScoreEl.textContent = `${rec.luck_score}/100`;
  if (luckFillEl) luckFillEl.style.width = `${Math.max(5, Math.min(100, rec.luck_score))}%`;
  if (luckyStripEl) {
    luckyStripEl.textContent = `Màu hợp mệnh: ${rec.lucky_color} | Số may: ${rec.lucky_numbers} | ${rec.arcana_type}`;
  }
  if (summaryEl) summaryEl.textContent = rec.summary_vi;
  if (advWorkEl) advWorkEl.textContent = rec.work_advice;
  if (advWealthEl) advWealthEl.textContent = rec.wealth_advice;
  if (advLoveEl) advLoveEl.textContent = rec.love_advice;
  if (advRemedyEl) advRemedyEl.textContent = rec.remedy_advice;

  if (aiBoxEl) {
    if (rec.ai_deep_reading && rec.ai_deep_reading.trim()) {
      aiBoxEl.style.display = 'block';
      aiBoxEl.textContent = `[LUẬN GIẢI SÂU AI]\n${rec.ai_deep_reading}`;
    } else {
      aiBoxEl.style.display = 'none';
      aiBoxEl.textContent = '';
    }
  }

  if (cardInner) {
    if (animateFlip) {
      cardInner.classList.remove('is-flipped');
      window.setTimeout(() => {
        cardInner.classList.add('is-flipped');
      }, 220);
    } else {
      cardInner.classList.add('is-flipped');
    }
  }
}

function updateTarotCooldownCountdown() {
  const cdBadge = document.getElementById('tarot-cooldown-badge');
  const spreadPicker = document.getElementById('tarot-spread-picker');
  const cur = cachedTarotStatus?.current_reading || null;
  const now = Date.now();
  const remMs = cur && cur.next_draw_at_ms > now ? cur.next_draw_at_ms - now : 0;
  const ready = remMs <= 0;

  if (cachedTarotStatus) {
    cachedTarotStatus.can_draw = ready;
    cachedTarotStatus.remaining_ms = remMs;
  }

  if (dockTarotReadyDot) {
    dockTarotReadyDot.style.display = ready ? 'block' : 'none';
  }
  if (dockBtnTarot) {
    dockBtnTarot.title = ready
      ? 'Bốc Thẻ Tarot & Tử Vi Vận Mệnh (Sẵn sàng quẻ mới!)'
      : `Tarot & Tử Vi (Quẻ tiếp theo sau ${formatTarotCountdown(remMs)})`;
  }

  if (cdBadge) {
    if (ready) {
      cdBadge.className = 'badge tarot-cd-ready';
      cdBadge.textContent = 'Sẵn sàng bốc quẻ mới (Chu kỳ 6h)';
    } else {
      cdBadge.className = 'badge tarot-cd-wait';
      cdBadge.textContent = `Quẻ tiếp theo sau ${formatTarotCountdown(remMs)}`;
    }
  }

  if (spreadPicker) {
    spreadPicker.style.display = ready ? 'block' : 'none';
  }
}

export async function refreshTarotStatusUi(): Promise<TarotStatusResponse | null> {
  try {
    const res = await invoke<TarotStatusResponse>('tarot_get_status');
    cachedTarotStatus = res;
    renderTarotHistoryList(res.history || []);
    applyTarotReadingToModal(res.current_reading, false);
    updateTarotCooldownCountdown();
    if (appState.isTarotModalOpen) syncHitboxToRust(true);
    return res;
  } catch {
    return null;
  }
}

function triggerDuckReactionForTarot(rec: TarotReadingRecord) {
  playTarotFlipSound(appState.posX, rec.fortune_code);
  triggerDuckTarot3DFlipEffect(
    rec.card_name_vi,
    rec.card_name,
    rec.fortune_code,
    rec.fortune_label,
    rec.is_reversed
  );

  if (rec.fortune_code === 'dai_cat') {
    appState.setExpression('happy', 5.0);
    triggerBackflip();
    spawnParticles(appState.posX, appState.posY - 120, 22, 0xfacc15);
  } else if (rec.fortune_code === 'tieu_cat') {
    appState.setExpression('happy', 4.5);
    triggerDance();
    spawnParticles(appState.posX, appState.posY - 120, 16, 0x34d399);
  } else if (rec.fortune_code === 'binh_hoa') {
    appState.setState('WAVING');
    appState.setExpression('happy', 3.8);
    spawnParticles(appState.posX, appState.posY - 110, 12, 0x38bdf8);
  } else if (rec.fortune_code === 'tieu_hung') {
    appState.setState('ALERT');
    appState.setExpression('surprised', 4.2);
    spawnParticles(appState.posX, appState.posY - 110, 14, 0xfb923c);
  } else {
    appState.setState('ALERT');
    appState.setExpression('surprised', 4.8);
    spawnParticles(appState.posX, appState.posY - 110, 18, 0xf87171);
  }
}

async function performTarotDrawAndFlip() {
  if (tarotDrawingInFlight) return;
  tarotDrawingInFlight = true;
  const drawBtn = document.getElementById('btn-tarot-draw-now') as HTMLButtonElement | null;
  if (drawBtn) {
    drawBtn.disabled = true;
    drawBtn.textContent = 'Đang kết nối Tarot API & Lật Thẻ 3D...';
  }
  try {
    const res = await invoke<TarotStatusResponse>('tarot_draw_card');
    cachedTarotStatus = res;
    renderTarotHistoryList(res.history || []);
    const rec = res.current_reading;
    if (rec) {
      applyTarotReadingToModal(rec, true);
      updateTarotCooldownCountdown();
      triggerDuckReactionForTarot(rec);
      const orientText = rec.is_reversed ? 'Ngược Chiều' : 'Thuận Chiều';
      if (res.already_drawn_in_window) {
        speakMessage(
          `[TAROT 6H - ${rec.fortune_label}] Bạn vừa xem quẻ "${rec.card_name_vi}" (${orientText}, ${rec.luck_score}/100) trong chu kỳ 6 giờ này rồi! Chờ hết đồng hồ để bốc lá mới nhé.`
        );
      } else {
        speakMessage(
          `[TAROT 6H - ${rec.fortune_label}] Lá "${rec.card_name_vi}" (${orientText}, ${rec.luck_score}/100): ${rec.summary_vi}`
        );
      }
    }
    syncHitboxToRust(true);
  } catch (err) {
    speakMessage(`[TAROT LỖI] Không thể bốc thẻ lúc này: ${String(err)}`);
  } finally {
    tarotDrawingInFlight = false;
    if (drawBtn) {
      drawBtn.disabled = false;
      drawBtn.textContent = 'Bốc & Lật Quẻ Tarot Ngay';
    }
  }
}

export function toggleTarotModal(forceState?: boolean) {
  appState.isTarotModalOpen =
    forceState !== undefined ? forceState : !appState.isTarotModalOpen;
  if (appState.isTarotModalOpen) {
    closeOtherPopupModals('tarot');
    setTarotTab('today');
    void refreshTarotStatusUi();
  }
  if (tarotModal) {
    tarotModal.style.display = appState.isTarotModalOpen ? 'block' : 'none';
  }
  if (dockBtnTarot) {
    dockBtnTarot.classList.toggle('active', appState.isTarotModalOpen);
  }
  syncHitboxToRust(true);
}

let miniScreenTab: 'web' | 'mirror' = 'web';
let miniMirrorActive = false;
let miniMirrorBusy = false;
let miniMirrorTimer: number | null = null;
let miniDisplayStream: MediaStream | null = null;
let miniPanelCollapsed = false;
let miniWebIsOpen = false;
let miniMirrorWindows: MiniWindowEntry[] = [];
let lastMiniWinFetchAt = 0;

function updateMiniResourceStatus() {
  const el = document.getElementById('mini-resource-status');
  if (!el) return;
  const webPart = miniWebIsOpen
    ? 'WebView Mini: ĐANG CHẠY'
    : 'WebView Mini: ĐÃ TẮT (0 MB RAM)';
  const mirrorPart = miniDisplayStream
    ? 'Chiếu App: WEBRTC 60FPS'
    : miniMirrorActive
    ? 'Chiếu App: ĐANG CHẠY'
    : 'Chiếu App: TẮT (0% CPU)';
  el.textContent = `${webPart} | ${mirrorPart}`;
}

function syncStealthButtonsUi() {
  const sel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
  const hwnd = Number(sel?.value || '0') || 0;
  const entry = miniMirrorWindows.find((w) => w.hwnd === hwnd);
  const stealthBtn = document.getElementById('btn-mini-stealth-toggle');
  if (stealthBtn) {
    stealthBtn.textContent = entry?.is_stealth
      ? 'Hiện Lại App Đang Ẩn'
      : 'Ẩn App (Vẫn Chiếu)';
  }
  const anyStealth = miniMirrorWindows.some((w) => w.is_stealth);
  const restoreBtn = document.getElementById('btn-mini-restore-all');
  if (restoreBtn) {
    restoreBtn.style.display = anyStealth ? 'block' : 'none';
  }
}

async function refreshMiniMirrorWindowSelect(force = false) {
  const sel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
  if (!sel) return;
  const now = performance.now();
  if (!force && now - lastMiniWinFetchAt < 3500) return;
  lastMiniWinFetchAt = now;

  try {
    const windows = await invoke<MiniWindowEntry[]>('mini_screen_list_windows');
    miniMirrorWindows = Array.isArray(windows) ? windows : [];
  } catch {
    return;
  }

  const key = miniMirrorWindows
    .map((w) => `${w.hwnd}:${w.is_minimized ? 1 : 0}:${w.is_stealth ? 1 : 0}:${w.title.slice(0, 16)}`)
    .join('|');
  if (!force && sel.dataset.key === key) {
    syncStealthButtonsUi();
    return;
  }
  sel.dataset.key = key;

  const prevVal = sel.value;
  const preferredHwnd =
    prevVal && prevVal !== '0' && miniMirrorWindows.some((w) => String(w.hwnd) === prevVal)
      ? Number(prevVal)
      : appState.activeWindowHwnd || findTargetWindow()?.hwnd || 0;

  sel.innerHTML = [
    '<option value="0">Chọn app hoặc tab trình duyệt cần chiếu...</option>',
    ...miniMirrorWindows.map((w) => {
      const procTag = w.process_name ? `[${w.process_name}] ` : '';
      const stateTag = w.is_stealth ? '[Đang ẩn] ' : w.is_minimized ? '[Thu nhỏ] ' : '';
      const selectedAttr = w.hwnd === preferredHwnd ? 'selected' : '';
      return `<option value="${w.hwnd}" ${selectedAttr}>${stateTag}${procTag}${w.title.slice(0, 36)}</option>`;
    }),
  ].join('');
  syncStealthButtonsUi();
}

function setMiniScreenModeBadge(label: string) {
  const b = document.getElementById('mini-screen-mode-badge');
  if (b) b.textContent = label;
}

function stopMiniDisplayMedia() {
  if (miniDisplayStream) {
    miniDisplayStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    miniDisplayStream = null;
  }
  const vid = document.getElementById('mini-display-video') as HTMLVideoElement | null;
  if (vid) {
    vid.srcObject = null;
    vid.style.display = 'none';
  }
  const btn = document.getElementById('btn-mini-display-media');
  if (btn) btn.textContent = 'Bắt Tab / Màn 60 FPS';
  updateMiniResourceStatus();
}

function stopMiniWindowMirror() {
  miniMirrorActive = false;
  if (miniMirrorTimer !== null) {
    window.clearTimeout(miniMirrorTimer);
    miniMirrorTimer = null;
  }
  const img = document.getElementById('mini-mirror-img') as HTMLImageElement | null;
  if (img) {
    img.src = '';
    img.style.display = 'none';
  }
  const placeholder = document.getElementById('mini-viewport-placeholder');
  if (placeholder && !miniDisplayStream) {
    placeholder.style.display = 'block';
  }
  const toggleBtn = document.getElementById('btn-mini-mirror-toggle');
  if (toggleBtn) toggleBtn.textContent = 'Bắt Đầu Chiếu App';
  if (!miniDisplayStream) {
    setMiniScreenModeBadge(miniWebIsOpen ? '[WEB MINI ON]' : '[LIVE]');
  }
  updateMiniResourceStatus();
}

async function stepMiniMirrorFrame() {
  if (!miniMirrorActive) return;
  if (!appState.isMiniScreenOpen || miniPanelCollapsed || miniScreenTab !== 'mirror') {
    stopMiniWindowMirror();
    return;
  }
  if (miniMirrorBusy) {
    miniMirrorTimer = window.setTimeout(() => void stepMiniMirrorFrame(), 120);
    return;
  }

  const sel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
  const img = document.getElementById('mini-mirror-img') as HTMLImageElement | null;
  const placeholder = document.getElementById('mini-viewport-placeholder');
  const fpsSel = document.getElementById('select-mini-mirror-fps') as HTMLSelectElement | null;
  const chkStealth = document.getElementById('chk-mini-auto-stealth') as HTMLInputElement | null;
  const fps = Math.max(2, Math.min(10, Number(fpsSel?.value || '6') || 6));
  const hwnd = Number(sel?.value || '0') || appState.activeWindowHwnd || findTargetWindow()?.hwnd || 0;

  if (!hwnd) {
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'Hãy chọn một ứng dụng / trình duyệt ở danh sách phía trên để chiếu.';
    }
    miniMirrorTimer = window.setTimeout(() => void stepMiniMirrorFrame(), 650);
    return;
  }

  miniMirrorBusy = true;
  try {
    const panelW = miniScreenPanel?.offsetWidth || 430;
    const frame = await invoke<CapturedWindowFrame>('mini_screen_capture_window', {
      hwnd,
      maxWidth: Math.min(680, Math.max(300, Math.round(panelW * 1.1))),
      autoStealthMinimized: chkStealth?.checked ?? true,
    });
    if (!miniMirrorActive) return;
    if (frame.is_minimized || !frame.bmp_base64) {
      if (img) img.style.display = 'none';
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = `"${frame.title}" đang thu nhỏ. Bật "Tự ẩn & chiếu cả app đang thu nhỏ" hoặc bấm "Đưa App Lên" để xem.`;
      }
      setMiniScreenModeBadge('[MINIMIZED]');
    } else {
      if (img) {
        img.src = `data:image/bmp;base64,${frame.bmp_base64}`;
        img.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      setMiniScreenModeBadge(frame.is_stealth ? `[XEM ẨN ${fps}FPS]` : `[APP ${fps}FPS]`);
      const targetEntry = miniMirrorWindows.find((w) => w.hwnd === hwnd);
      if (targetEntry && Boolean(frame.is_stealth) !== targetEntry.is_stealth) {
        void refreshMiniMirrorWindowSelect(true);
      }
    }
  } catch (err) {
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = String(err);
    }
    setMiniScreenModeBadge('[WAIT]');
  } finally {
    miniMirrorBusy = false;
    if (miniMirrorActive) {
      miniMirrorTimer = window.setTimeout(() => void stepMiniMirrorFrame(), Math.round(1000 / fps));
    }
  }
}

function startMiniWindowMirror() {
  stopMiniDisplayMedia();
  stopMiniWindowMirror();
  miniMirrorActive = true;
  const toggleBtn = document.getElementById('btn-mini-mirror-toggle');
  if (toggleBtn) toggleBtn.textContent = 'Dừng Chiếu App';
  updateMiniResourceStatus();
  void refreshMiniMirrorWindowSelect(true).then(() => {
    if (miniMirrorActive) void stepMiniMirrorFrame();
  });
}

async function startMiniDisplayMedia() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    speakMessage('[MINI SCREEN] WebView hiện tại không hỗ trợ getDisplayMedia. Hãy dùng nút "Bắt Đầu Chiếu App" hoặc tab "YouTube & Web Mini" nhé!');
    return;
  }
  stopMiniWindowMirror();
  stopMiniDisplayMedia();
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
    miniDisplayStream = stream;
    const vid = document.getElementById('mini-display-video') as HTMLVideoElement | null;
    const img = document.getElementById('mini-mirror-img') as HTMLImageElement | null;
    const placeholder = document.getElementById('mini-viewport-placeholder');
    const btn = document.getElementById('btn-mini-display-media');
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (vid) {
      vid.srcObject = stream;
      vid.style.display = 'block';
    }
    if (btn) btn.textContent = 'Đang Bắt 60 FPS (Click Để Tắt)';
    setMiniScreenModeBadge('[WEBRTC 60FPS]');
    updateMiniResourceStatus();
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopMiniDisplayMedia();
        if (placeholder) {
          placeholder.style.display = 'block';
          placeholder.textContent = 'Phiên bắt Tab / Màn hình đã kết thúc.';
        }
        setMiniScreenModeBadge('[LIVE]');
      });
    });
  } catch (err) {
    speakMessage(`[MINI SCREEN] Bạn đã hủy hoặc WebView chặn chọn nguồn chia sẻ: ${String(err)}`);
  }
}

function setMiniScreenTab(tab: 'web' | 'mirror') {
  miniScreenTab = tab;
  const btnWeb = document.getElementById('tab-btn-mini-web');
  const btnMirror = document.getElementById('tab-btn-mini-mirror');
  const paneWeb = document.getElementById('mini-pane-web');
  const paneMirror = document.getElementById('mini-pane-mirror');
  if (btnWeb) btnWeb.classList.toggle('active', tab === 'web');
  if (btnMirror) btnMirror.classList.toggle('active', tab === 'mirror');
  if (paneWeb) paneWeb.style.display = tab === 'web' ? 'block' : 'none';
  if (paneMirror) paneMirror.style.display = tab === 'mirror' ? 'block' : 'none';
  if (tab === 'mirror') {
    void refreshMiniMirrorWindowSelect(true);
  } else {
    // Tiết kiệm CPU/RAM khi chuyển về Tab Web
    stopMiniWindowMirror();
    stopMiniDisplayMedia();
  }
  syncHitboxToRust(true);
}

function updateMiniWebStatusUi(st: MiniWebStatus) {
  miniWebIsOpen = Boolean(st.is_open);
  const statusEl = document.getElementById('mini-web-status-text');
  const pinChk = document.getElementById('chk-mini-web-pin') as HTMLInputElement | null;
  if (pinChk) pinChk.checked = st.always_on_top;
  if (statusEl) {
    statusEl.textContent = st.is_open
      ? `Đang mở: ${st.title} (${st.width}x${st.height} | ${st.url})`
      : 'WebView Mini chưa khởi chạy (không tốn RAM/CPU nền). Nhấn YouTube hoặc dán link khi cần dùng.';
  }
  if (!miniMirrorActive && !miniDisplayStream) {
    setMiniScreenModeBadge(st.is_open ? '[WEB MINI ON]' : '[LIVE]');
  }
  updateMiniResourceStatus();
}

async function openMiniWebTarget(rawTarget: string) {
  const pinChk = document.getElementById('chk-mini-web-pin') as HTMLInputElement | null;
  const target = rawTarget.trim() || 'youtube';
  const inp = document.getElementById('mini-web-url-input') as HTMLInputElement | null;
  if (inp && rawTarget.trim()) inp.value = target;
  try {
    const st = await invoke<MiniWebStatus>('mini_screen_open_web', {
      target,
      alwaysOnTop: pinChk?.checked ?? true,
    });
    updateMiniWebStatusUi(st);
    speakMessage(`[MINI SCREEN] Đã mở "${st.title}" ở chế độ cửa sổ Mini ghim nổi!`);
  } catch (err) {
    speakMessage(`[MINI SCREEN LỖI] ${String(err)}`);
  }
}

export function toggleMiniScreenPanel(
  forceState?: boolean,
  defaultTab?: 'web' | 'mirror'
) {
  appState.isMiniScreenOpen =
    forceState !== undefined ? forceState : !appState.isMiniScreenOpen;
  if (appState.isMiniScreenOpen) {
    if (defaultTab) {
      setMiniScreenTab(defaultTab);
    } else {
      void refreshMiniMirrorWindowSelect(true);
    }
    void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'status' })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => updateMiniResourceStatus());
  } else {
    stopMiniWindowMirror();
    stopMiniDisplayMedia();
    void invoke('mini_screen_restore_all_stealth').catch(() => {});
    const autoCloseWeb =
      (document.getElementById('chk-mini-web-autoclose') as HTMLInputElement | null)?.checked ??
      true;
    if (autoCloseWeb && miniWebIsOpen) {
      void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'close' })
        .then((st) => updateMiniWebStatusUi(st))
        .catch(() => {});
    }
  }
  if (miniScreenPanel) {
    miniScreenPanel.style.display = appState.isMiniScreenOpen ? 'block' : 'none';
  }
  if (dockBtnMiniScreen) {
    dockBtnMiniScreen.classList.toggle('active', appState.isMiniScreenOpen);
  }
  syncHitboxToRust(true);
}

async function runTranslateOcrModalText(preferAi = false) {
  const srcEl = document.getElementById('ocr-source-text') as HTMLTextAreaElement | null;
  const dstEl = document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null;
  const langSel = document.getElementById('select-ocr-target-lang') as HTMLSelectElement | null;
  const badgeEl = document.getElementById('ocr-engine-badge');
  if (!srcEl || !dstEl) return;

  const text = srcEl.value.trim();
  if (!text) {
    dstEl.value = '';
    if (badgeEl) badgeEl.textContent = 'Trống';
    return;
  }

  const targetLang = langSel?.value || 'vi';
  const langLabels: Record<string, string> = {
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh (English)',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    'zh-CN': 'Tiếng Trung',
    fr: 'Tiếng Pháp',
  };
  const langLabel = langLabels[targetLang] || 'Tiếng Việt';

  dstEl.value = 'Đang dịch...';
  if (badgeEl) badgeEl.textContent = preferAi ? '[AI...]' : '[Dịch...]';

  if (!preferAi) {
    try {
      const res = await invoke<TranslateResult>('translate_text_quick', {
        text,
        targetLang,
      });
      dstEl.value = res.translated_text;
      if (badgeEl) badgeEl.textContent = `${res.engine} (${res.detected_lang}->${targetLang})`;
      return;
    } catch {
      // Fallback sang AI neu mang bi chan
    }
  }

  try {
    const aiRes = await translateTextWithAi(text, langLabel);
    dstEl.value = aiRes.translated;
    if (badgeEl) badgeEl.textContent = aiRes.engine;
  } catch (err) {
    dstEl.value = `[LỖI DỊCH] ${String(err)}`;
    if (badgeEl) badgeEl.textContent = '[LỖI]';
  }
}

function finishSnipOverlayReset() {
  const overlay = document.getElementById('ocr-snip-overlay');
  const rectEl = document.getElementById('ocr-snip-rect');
  if (rectEl) rectEl.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  appState.isOcrSnipMode = false;
  if (!appState.blackHoleWarpMode) {
    void invoke('set_manual_interactive', { interactive: false }).catch(() => { });
  }
  syncHitboxToRust(true);
}

export function startOcrRegionSnip() {
  const overlay = document.getElementById('ocr-snip-overlay');
  const rectEl = document.getElementById('ocr-snip-rect');
  if (!overlay || !rectEl) return;

  closeOtherPopupModals();
  appState.isOcrSnipMode = true;
  rectEl.style.display = 'none';
  overlay.style.display = 'block';
  void invoke('set_manual_interactive', { interactive: true }).catch(() => { });
  syncHitboxToRust(true);
}

export function renderP2pArenaUi() {
  const st = getP2pStatusSnapshot();
  const vitals = getP2pCombatVitals();

  const phaseBadge = document.getElementById('p2p-phase-badge');
  const localEndpoint = document.getElementById('p2p-local-endpoint');
  const roomCodeEl = document.getElementById('p2p-room-code');
  const mobileUrlEl = document.getElementById('p2p-mobile-url');
  const consentBox = document.getElementById('p2p-consent-box');
  const consentText = document.getElementById('p2p-consent-text');
  const btnDisconnect = document.getElementById('btn-p2p-disconnect');
  const battleBox = document.getElementById('p2p-battle-box');
  const peerLabel = document.getElementById('p2p-peer-label');
  const myHpText = document.getElementById('p2p-my-hp-text');
  const myHpFill = document.getElementById('p2p-my-hp-fill');
  const myEnText = document.getElementById('p2p-my-en-text');
  const myEnFill = document.getElementById('p2p-my-en-fill');
  const peerHpText = document.getElementById('p2p-peer-hp-text');
  const peerHpFill = document.getElementById('p2p-peer-hp-fill');
  const peerEnText = document.getElementById('p2p-peer-en-text');
  const peerEnFill = document.getElementById('p2p-peer-en-fill');
  const remoteBox = document.getElementById('p2p-remote-control-box');
  const winnerCd = document.getElementById('p2p-winner-countdown');
  const btnMigrateOut = document.getElementById('btn-p2p-migrate-out') as HTMLButtonElement | null;
  const btnRecall = document.getElementById('btn-p2p-recall') as HTMLButtonElement | null;

  const phaseTags: Record<string, string> = {
    disconnected: '[OFFLINE]',
    hosting: '[HOSTING]',
    waiting_consent: '[CHỜ ĐỒNG Ý]',
    incoming_consent: '[CÓ LỜI MỜI!]',
    connected: '[CONNECTED]',
    pk_duel: '[PK DUEL]',
    winner_control: '[WINNER 60S]',
    victim_controlled: '[BỊ KIỂM SOÁT 60S]',
  };
  if (phaseBadge) phaseBadge.textContent = phaseTags[st.phase] || `[${st.phase.toUpperCase()}]`;
  if (localEndpoint) localEndpoint.textContent = `${st.local_ip}:${st.listen_port}`;
  if (roomCodeEl) roomCodeEl.textContent = st.room_code;
  if (mobileUrlEl) {
    mobileUrlEl.textContent =
      st.mobile_url || `http://${st.local_ip}:${st.listen_port}/?room=${st.room_code}`;
  }
  const altLanBox = document.getElementById('p2p-alt-lan-urls');
  if (altLanBox) {
    const extras = (st.lan_ips || []).filter((ip) => ip && ip !== st.local_ip);
    if (extras.length > 0) {
      altLanBox.style.display = 'flex';
      altLanBox.innerHTML = '<span>IP phụ:</span>';
      extras.forEach((ip) => {
        const altUrl = `http://${ip}:${st.listen_port}/?room=${st.room_code}`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chat-chip';
        b.textContent = `${ip}:${st.listen_port}`;
        b.title = `Copy ${altUrl}`;
        b.addEventListener('click', () => {
          void navigator.clipboard.writeText(altUrl).catch(() => { });
          b.textContent = `Copied ${ip}`;
          setTimeout(() => (b.textContent = `${ip}:${st.listen_port}`), 1400);
        });
        altLanBox.appendChild(b);
      });
    } else {
      altLanBox.style.display = 'none';
      altLanBox.innerHTML = '';
    }
  }

  if (consentBox && consentText) {
    if (st.phase === 'incoming_consent') {
      consentBox.style.display = 'block';
      consentText.textContent = `Máy "${st.pending_peer_name}" (${st.pending_peer_addr}) gửi yêu cầu bắt tay (Handshake). Khi đồng ý, vịt 2 máy có thể nhảy qua lại và PK giành quyền điều khiển chuột/phím 60 giây!`;
    } else {
      consentBox.style.display = 'none';
    }
  }

  const isConnectedOrActive =
    st.phase === 'connected' ||
    st.phase === 'pk_duel' ||
    st.phase === 'winner_control' ||
    st.phase === 'victim_controlled';

  if (btnDisconnect) btnDisconnect.style.display = isConnectedOrActive || st.phase === 'waiting_consent' ? 'inline-flex' : 'none';
  if (battleBox) battleBox.style.display = isConnectedOrActive ? 'block' : 'none';
  if (peerLabel) {
    const modeTag = st.is_sim_mode ? ' [SIM]' : st.is_web_peer ? ' [MOBILE WEB]' : '';
    peerLabel.textContent = st.peer_name ? `${st.peer_name}${modeTag}` : 'Đã kết nối';
  }
  if (myHpText) myHpText.textContent = `${vitals.myHp} / ${vitals.maxHp}`;
  if (myHpFill) myHpFill.style.width = `${Math.max(0, Math.min(100, (vitals.myHp / vitals.maxHp) * 100))}%`;
  if (myEnText) myEnText.textContent = `${Math.round(vitals.myEnergy)} / ${vitals.maxEnergy}`;
  if (myEnFill) myEnFill.style.width = `${Math.max(0, Math.min(100, (vitals.myEnergy / vitals.maxEnergy) * 100))}%`;
  if (peerHpText) peerHpText.textContent = `${vitals.peerHp} / ${vitals.maxHp}`;
  if (peerHpFill) peerHpFill.style.width = `${Math.max(0, Math.min(100, (vitals.peerHp / vitals.maxHp) * 100))}%`;
  if (peerEnText) peerEnText.textContent = `${Math.round(vitals.peerEnergy)} / ${vitals.maxEnergy}`;
  if (peerEnFill) peerEnFill.style.width = `${Math.max(0, Math.min(100, (vitals.peerEnergy / vitals.maxEnergy) * 100))}%`;

  if (btnMigrateOut) btnMigrateOut.disabled = appState.isMigratedOut;
  if (btnRecall) btnRecall.disabled = !appState.isMigratedOut;

  if (remoteBox && winnerCd) {
    const canControl = st.phase === 'winner_control' && st.winner_remaining_sec > 0;
    remoteBox.style.display = canControl ? 'block' : 'none';
    winnerCd.textContent = `${st.winner_remaining_sec}s`;
  }
  syncHitboxToRust(true);
}

let currentNotifSettings: NotificationSettings | null = null;

async function refreshNotificationUi() {
  currentNotifSettings = await fetchNotificationSettings();
  if (!currentNotifSettings) return;

  if (notifMasterToggle) notifMasterToggle.checked = currentNotifSettings.master_enabled;
  if (notifTtsToggle) notifTtsToggle.checked = currentNotifSettings.speech_tts_enabled;
  if (notifReactToggle) notifReactToggle.checked = currentNotifSettings.character_alert_enabled;

  renderWindowsAppsList();
  renderWebOriginsList();
  await renderNotificationHistoryList();
}

function renderWindowsAppsList() {
  if (!containerWinApps || !currentNotifSettings) return;
  containerWinApps.innerHTML = '';

  currentNotifSettings.windows_apps.forEach((app, idx) => {
    const row = document.createElement('div');
    row.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.55); padding: 6px 8px; border-radius: 7px; border: 1px solid rgba(148, 163, 184, 0.14); font-size: 11px;';

    const info = document.createElement('div');
    info.style.cssText = 'display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden;';
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'color: #38bdf8; font-weight: 600; white-space: nowrap;';
    nameSpan.textContent = `[${app.name}]`;
    const idSpan = document.createElement('span');
    idSpan.style.cssText = 'color: #64748b; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    idSpan.textContent = `(${app.app_id})`;
    info.appendChild(nameSpan);
    info.appendChild(idSpan);

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 7px; flex-shrink: 0;';

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'action-btn';
    testBtn.textContent = 'Test';
    testBtn.title = `Gửi thông báo thử cho ${app.name}`;
    testBtn.style.cssText =
      'padding: 2px 6px; font-size: 9.5px; background: rgba(56, 189, 248, 0.16); border-color: rgba(56, 189, 248, 0.35); color: #7dd3fc;';
    testBtn.addEventListener('click', () => {
      void triggerTestNotification('windows', app.name);
    });

    const ttsLabel = document.createElement('span');
    ttsLabel.style.cssText = 'color: #94a3b8; font-size: 10px;';
    ttsLabel.textContent = 'TTS:';

    const ttsCheck = document.createElement('input');
    ttsCheck.type = 'checkbox';
    ttsCheck.checked = app.speech_alert;
    ttsCheck.title = 'Đọc to TTS khi có thông báo';
    ttsCheck.addEventListener('change', () => {
      app.speech_alert = ttsCheck.checked;
      void updateNotificationSettings(currentNotifSettings!);
    });

    const enableLabel = document.createElement('span');
    enableLabel.style.cssText = 'color: #94a3b8; font-size: 10px;';
    enableLabel.textContent = 'Bật:';

    const enableCheck = document.createElement('input');
    enableCheck.type = 'checkbox';
    enableCheck.checked = app.enabled;
    enableCheck.title = 'Bật/Tắt nhận thông báo từ ứng dụng này';
    enableCheck.addEventListener('change', () => {
      app.enabled = enableCheck.checked;
      void updateNotificationSettings(currentNotifSettings!);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn-tiny';
    delBtn.textContent = 'x';
    delBtn.title = 'Xóa ứng dụng';
    delBtn.addEventListener('click', () => {
      currentNotifSettings!.windows_apps.splice(idx, 1);
      void updateNotificationSettings(currentNotifSettings!);
      renderWindowsAppsList();
    });

    controls.appendChild(testBtn);
    controls.appendChild(ttsLabel);
    controls.appendChild(ttsCheck);
    controls.appendChild(enableLabel);
    controls.appendChild(enableCheck);
    controls.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(controls);
    containerWinApps.appendChild(row);
  });
}

function renderWebOriginsList() {
  if (!containerWebOrigins || !currentNotifSettings) return;
  containerWebOrigins.innerHTML = '';

  currentNotifSettings.web_origins.forEach((item, idx) => {
    const row = document.createElement('div');
    row.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.5); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.1); font-size: 11px;';

    const info = document.createElement('div');
    info.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    info.innerHTML = `<span style="color: #c084fc; font-weight: 600;">[${item.name}]</span> <span style="color: #64748b; font-size: 10px;">(${item.origin})</span>`;

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const ttsCheck = document.createElement('input');
    ttsCheck.type = 'checkbox';
    ttsCheck.checked = item.speech_alert;
    ttsCheck.title = 'Đọc to TTS khi có thông báo';
    ttsCheck.addEventListener('change', () => {
      item.speech_alert = ttsCheck.checked;
      void updateNotificationSettings(currentNotifSettings!);
    });

    const enableCheck = document.createElement('input');
    enableCheck.type = 'checkbox';
    enableCheck.checked = item.enabled;
    enableCheck.title = 'Bật/Tắt nhận thông báo từ web origin này';
    enableCheck.addEventListener('change', () => {
      item.enabled = enableCheck.checked;
      void updateNotificationSettings(currentNotifSettings!);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn-tiny';
    delBtn.innerHTML = 'x';
    delBtn.title = 'Xóa web origin';
    delBtn.addEventListener('click', () => {
      currentNotifSettings!.web_origins.splice(idx, 1);
      void updateNotificationSettings(currentNotifSettings!);
      renderWebOriginsList();
    });

    const ttsLabel = document.createElement('span');
    ttsLabel.style.cssText = 'color: #94a3b8; font-size: 10px;';
    ttsLabel.textContent = 'TTS:';

    controls.appendChild(ttsLabel);
    controls.appendChild(ttsCheck);
    controls.appendChild(enableCheck);
    controls.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(controls);
    containerWebOrigins.appendChild(row);
  });
}

async function renderNotificationHistoryList() {
  if (!containerNotifHistory) return;
  const history = await fetchNotificationHistory();
  if (!history || history.length === 0) {
    containerNotifHistory.innerHTML = '<div class="dash-sub">Chưa có thông báo nào được ghi nhận.</div>';
    return;
  }
  containerNotifHistory.innerHTML = '';
  history.forEach((h) => {
    const card = document.createElement('div');
    card.style.cssText =
      'background: rgba(15, 23, 42, 0.6); padding: 7px 9px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.15); font-size: 11px;';
    const timeStr = new Date(h.timestamp * 1000).toLocaleTimeString();
    const badgeColor = h.source === 'windows' || h.source === 'app' ? '#38bdf8' : '#c084fc';
    const sourceTag = h.source === 'windows' || h.source === 'app' ? 'APP' : h.source.toUpperCase();

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 2px;';

    const sourceSpan = document.createElement('span');
    sourceSpan.style.cssText = `color: ${badgeColor}; font-weight: 600;`;
    sourceSpan.textContent = `[${sourceTag}: ${h.app_or_origin}]`;

    const metaSpan = document.createElement('span');
    metaSpan.style.cssText = 'color: #64748b; font-size: 10px; flex-shrink: 0;';
    metaSpan.innerHTML = `${timeStr} ${h.allowed
        ? '<span style="color: #34d399; font-weight: 600;">[SHOW]</span>'
        : '<span style="color: #f87171; font-weight: 600;">[FILTERED]</span>'
      }`;

    topRow.appendChild(sourceSpan);
    topRow.appendChild(metaSpan);

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'color: #f1f5f9; font-weight: 600; margin-bottom: 2px; word-break: break-word;';
    titleDiv.textContent = h.title;

    const bodyDiv = document.createElement('div');
    bodyDiv.style.cssText = 'color: #94a3b8; font-size: 10.5px; line-height: 1.3; word-break: break-word;';
    bodyDiv.textContent = h.body;

    card.appendChild(topRow);
    card.appendChild(titleDiv);
    card.appendChild(bodyDiv);
    containerNotifHistory.appendChild(card);
  });
}

let lastHitboxSync = 0;
let lastHitboxSig = '';
let lastCharHitboxKey = '';
let lastHitboxUiScanAt = 0;

export function syncHitboxToRust(force = false) {
  if (!companionDock) return;
  const now = performance.now();

  const cx = Math.round(appState.posX);
  const cy = Math.round(appState.posY - 85 * appState.modelScale);
  const rad = Math.round(78 * appState.modelScale);
  const isDragging =
    appState.state === 'DRAGGING' ||
    appState.blackHoleWarpMode ||
    appState.isOcrSnipMode ||
    isP2pDuelActive();
  const charKey = `${cx}|${cy}|${rad}|${isDragging ? 1 : 0}`;

  if (!force) {
    if (charKey === lastCharHitboxKey && now - lastHitboxUiScanAt < 450) {
      return;
    }
    if (now - lastHitboxSync < 50) {
      return;
    }
  }
  lastHitboxSync = now;
  lastCharHitboxKey = charKey;
  lastHitboxUiScanAt = now;

  const uiRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  const pushRect = (el: HTMLElement, visible: boolean) => {
    if (!visible || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      uiRects.push({
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  };

  pushRect(leftTelemetryPanel, appState.isLeftPanelOpen);
  pushRect(rightActionPanel, appState.isRightPanelOpen);
  pushRect(speechBubble, appState.isBubbleVisible);
  if (chatDialogPanel && !speechBubble?.contains(chatDialogPanel)) {
    pushRect(chatDialogPanel, appState.isChatOpen);
  }
  pushRect(companionDock, true);
  pushRect(studioPanel, appState.isStudioOpen);
  pushRect(longMemoryPanel, appState.isLongMemoryOpen);
  pushRect(notificationPanel, appState.isNotificationManagerOpen);
  pushRect(p2pArenaPanel, appState.isP2pArenaOpen);
  pushRect(pcControlModal, appState.isPcControlOpen);
  pushRect(ocrTranslateModal, appState.isOcrModalOpen);
  pushRect(toolForgeModal, appState.isToolForgeOpen);
  pushRect(tarotModal, appState.isTarotModalOpen);
  pushRect(miniScreenPanel, appState.isMiniScreenOpen);
  const ocrSnipEl = document.getElementById('ocr-snip-overlay');
  if (ocrSnipEl && appState.isOcrSnipMode) {
    pushRect(ocrSnipEl, true);
  }
  const p2pCtrlEl = document.getElementById('p2p-pk-controller');
  if (p2pCtrlEl && p2pCtrlEl.style.display !== 'none') {
    pushRect(p2pCtrlEl, true);
  }
  const p2pReturnPill = document.getElementById('p2p-return-pill');
  if (p2pReturnPill && p2pReturnPill.style.display !== 'none') {
    pushRect(p2pReturnPill, true);
  }
  const p2pVictimBanner = document.getElementById('p2p-victim-banner');
  if (p2pVictimBanner && p2pVictimBanner.style.display !== 'none') {
    pushRect(p2pVictimBanner, true);
  }
  const fileDashModal = document.getElementById('file-dashboard-modal');
  if (fileDashModal && fileDashModal.style.display !== 'none') {
    pushRect(fileDashModal, true);
  }
  const ingestHud = document.getElementById('file-ingest-mouth-hud');
  if (ingestHud && ingestHud.style.display !== 'none') {
    pushRect(ingestHud, true);
  }
  if (stickyNotesWidget && stickyNotesWidget.style.display !== 'none') {
    pushRect(stickyNotesWidget, true);
  }

  const sig = `${cx}|${cy}|${rad}|${isDragging ? 1 : 0}|${uiRects
    .map((r) => `${r.x},${r.y},${r.w},${r.h}`)
    .join(';')}`;
  if (!force && sig === lastHitboxSig) {
    return;
  }
  lastHitboxSig = sig;

  invoke('update_character_hitbox', {
    x: cx,
    y: cy,
    radius: rad,
    uiRects,
    isDragging,
  }).catch(() => { });
}

export function handleSendMessage() {
  const text = bubbleInput.value.trim();
  if (!text) return;
  bubbleInput.value = '';

  const lower = text.toLowerCase();
  if (lower === 'đổi avatar' || lower === 'mở studio' || lower === 'vrm') {
    toggleStudioModal(true);
    speakMessage('Tớ đã mở Studio 3D cho bạn rồi! Hãy chọn Preset Anime hoặc file .vrm nhé.');
  } else if (lower === 'nhảy' || lower === 'dance') {
    triggerDance();
  } else if (lower === 'leo cửa sổ' || lower === 'jump') {
    triggerJumpToWindow();
  } else if (lower === 'pomodoro' || lower === 'timer') {
    togglePomodoro();
  } else if (lower === 'p2p' || lower === 'mở p2p' || lower === 'pk p2p' || lower === 'đấu p2p') {
    toggleP2pArenaModal(true);
    speakMessage('[P2P ARENA] Đã mở Đấu trường P2P PK & Điều khiển chéo giữa 2 máy!');
  } else {
    void chatWithLocalLlm(text);
  }
}

let uiFollowX = appState.posX;
let uiFollowY = appState.posY;

export function initUi() {
  mountUi();
  bindDomRefs();
  ensureStickyNotesWidget();

  typewriterTarget = bubbleContent.textContent?.trim() || '';
  typewriterIndex = typewriterTarget.length;

  if (appState.builtinModelType === 'microduck') {
    btnActDuck.textContent = 'Đổi Cyber Idol';
  }

  btnCloseLeft.addEventListener('click', () => toggleLeftPanel(false));
  btnCloseRight.addEventListener('click', () => toggleRightPanel(false));
  btnMinimizeBubble.addEventListener('click', () => toggleBubbleVisibility(false));
  if (btnOpenChatFromBubble) {
    btnOpenChatFromBubble.addEventListener('click', () => toggleChatVisibility());
  }
  if (btnCloseChat) {
    btnCloseChat.addEventListener('click', () => toggleChatVisibility(false));
  }
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      if (chatHistoryList) {
        chatHistoryList.innerHTML = '';
        appendChatMessage('assistant', 'Đã làm mới cuộc hội thoại với AI Mate!');
      }
      chatHistoryLoadedFromDb = true;
      void invoke('memory_clear_chat_history').catch(() => { });
    });
  }

  document.querySelectorAll('.chat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-cmd');
      if (cmd && bubbleInput) {
        bubbleInput.value = cmd;
        handleSendMessage();
      }
    });
  });

  dockBtnLeft.addEventListener('click', () => toggleLeftPanel());
  dockBtnChat.addEventListener('click', () => toggleChatVisibility());
  dockBtnRight.addEventListener('click', () => toggleRightPanel());
  dockBtnPcControl?.addEventListener('click', () => togglePcControlModal());
  dockBtnStudio.addEventListener('click', () => toggleStudioModal());
  dockBtnEdgePeek?.addEventListener('click', () => {
    void toggleEdgePeekMode();
  });

  syncDockVoiceUi();
  syncChatDockSideUi();

  btnToggleChatSide?.addEventListener('click', () => {
    appState.chatDockSide = appState.chatDockSide === 'left' ? 'right' : 'left';
    localStorage.setItem('mate_chat_dock_side', appState.chatDockSide);
    syncChatDockSideUi();
    updateUiPosition();
    syncHitboxToRust(true);
    void saveStudioConfigToSqlite();
  });

  selectChatDockSide?.addEventListener('change', () => {
    appState.chatDockSide = selectChatDockSide.value === 'left' ? 'left' : 'right';
    localStorage.setItem('mate_chat_dock_side', appState.chatDockSide);
    syncChatDockSideUi();
    updateUiPosition();
    syncHitboxToRust(true);
    void saveStudioConfigToSqlite();
  });

  document.getElementById('btn-cfg-hide-all')?.addEventListener('click', () => {
    toggleLeftPanel(false);
    toggleRightPanel(false);
    toggleBubbleVisibility(false);
    toggleChatVisibility(false);
    toggleStudioModal(false);
    toggleLongMemoryModal(false);
    toggleNotificationModal(false);
    toggleP2pArenaModal(false);
    togglePcControlModal(false);
    toggleOcrTranslateModal(false);
  });

  document.getElementById('btn-cfg-show-ui')?.addEventListener('click', () => {
    toggleStudioModal(false);
    toggleBubbleVisibility(true);
    toggleRightPanel(true);
    updateUiPosition();
    syncHitboxToRust(true);
  });

  document.getElementById('btn-cfg-open-notif')?.addEventListener('click', () => {
    toggleNotificationModal(true);
  });

  const chkCfgEcoMode = document.getElementById('chk-cfg-eco-mode') as HTMLInputElement | null;
  if (chkCfgEcoMode) {
    chkCfgEcoMode.checked = appState.ecoMode;
    document.body.classList.toggle('eco-mode', appState.ecoMode);
    chkCfgEcoMode.addEventListener('change', () => {
      appState.ecoMode = chkCfgEcoMode.checked;
      localStorage.setItem('mate_eco_mode', String(appState.ecoMode));
      document.body.classList.toggle('eco-mode', appState.ecoMode);
      applyRendererEcoQuality();
      speakMessage(
        appState.ecoMode
          ? '[ECO MODE] Đã bật Chế độ Tiết Kiệm Pin (30 FPS khi đứng yên, tắt kính mờ blur; chạy mượt đầy đủ khi vịt cử động).'
          : '[SMOOTH MODE] Đã bật chế độ Siêu Mượt Native FPS & đồ họa sắc nét (vẫn giữ tối ưu nền RAM/CPU).'
      );
    });
  }

  chkCfgVoiceTts?.addEventListener('change', () => {
    duckVoiceMuted = !chkCfgVoiceTts.checked;
    localStorage.setItem('mate_duck_voice_muted', String(duckVoiceMuted));
    syncDockVoiceUi();
    void saveStudioConfigToSqlite();
    if (duckVoiceMuted) {
      stopDuckVoiceTts();
      typewriterTarget = '[ÂM THANH] Đã tắt giọng đọc của Vịt (chỉ hiển thị chữ).';
      typewriterIndex = typewriterTarget.length;
      typewriterAcc = typewriterTarget.length;
      if (bubbleContent) bubbleContent.textContent = typewriterTarget;
    } else {
      speakMessage('[ÂM THANH] Đã bật lại giọng đọc Tiếng Việt của Vịt!');
    }
  });

  const bindScheduleInput = (
    el: HTMLInputElement | null,
    key: 'english' | 'news' | 'weather' | 'app_metrics' | 'btc',
    storageKey: string,
    assign: (v: number) => void
  ) => {
    el?.addEventListener('change', () => {
      const parsed = Math.max(0, Math.min(360, Math.round(Number(el.value) || 0)));
      el.value = String(parsed);
      assign(parsed);
      localStorage.setItem(storageKey, String(parsed));
      resetContentScheduleTimer(key);
      void saveStudioConfigToSqlite();
      const labelMap: Record<typeof key, string> = {
        english: 'Học Tiếng Anh',
        news: 'Đọc Tin Mới',
        weather: 'Thời Tiết',
        app_metrics: 'Hiệu Năng App',
        btc: 'Giá Bitcoin (BTC)',
      };
      speakMessage(
        parsed === 0
          ? `[CẤU HÌNH] Đã tắt tự động hiển thị ${labelMap[key]}.`
          : `[CẤU HÌNH] Đã đặt chu kỳ ${labelMap[key]} mỗi ${parsed} phút.`
      );
    });
  };

  if (inputCfgEnglishMin) inputCfgEnglishMin.value = String(appState.englishIntervalMin);
  if (inputCfgNewsMin) inputCfgNewsMin.value = String(appState.newsIntervalMin);
  if (inputCfgWeatherMin) inputCfgWeatherMin.value = String(appState.weatherIntervalMin);
  if (inputCfgAppMetricsMin) inputCfgAppMetricsMin.value = String(appState.appMetricsIntervalMin);
  if (inputCfgBtcMin) inputCfgBtcMin.value = String(appState.btcIntervalMin);

  bindScheduleInput(inputCfgEnglishMin, 'english', 'mate_english_interval_min', (v) => {
    appState.englishIntervalMin = v;
  });
  bindScheduleInput(inputCfgNewsMin, 'news', 'mate_news_interval_min', (v) => {
    appState.newsIntervalMin = v;
  });
  bindScheduleInput(inputCfgWeatherMin, 'weather', 'mate_weather_interval_min', (v) => {
    appState.weatherIntervalMin = v;
  });
  bindScheduleInput(inputCfgAppMetricsMin, 'app_metrics', 'mate_app_metrics_interval_min', (v) => {
    appState.appMetricsIntervalMin = v;
  });
  bindScheduleInput(inputCfgBtcMin, 'btc', 'mate_btc_interval_min', (v) => {
    appState.btcIntervalMin = v;
  });

  document.getElementById('btn-cfg-test-english')?.addEventListener('click', () => {
    void triggerScheduledContentNow('english');
  });
  document.getElementById('btn-cfg-test-news')?.addEventListener('click', () => {
    void triggerScheduledContentNow('news');
  });
  document.getElementById('btn-cfg-test-weather')?.addEventListener('click', () => {
    void triggerScheduledContentNow('weather');
  });
  document.getElementById('btn-cfg-test-app-metrics')?.addEventListener('click', () => {
    void triggerScheduledContentNow('app_metrics');
  });
  document.getElementById('btn-cfg-test-btc')?.addEventListener('click', () => {
    void triggerScheduledContentNow('btc');
  });

  const syncWeatherSourceUiBoxes = () => {
    if (selectCfgWeatherSource) selectCfgWeatherSource.value = appState.weatherSourceMode;
    if (cfgWeatherApiBox) {
      cfgWeatherApiBox.style.display = appState.weatherSourceMode === 'api' ? 'flex' : 'none';
    }
    if (cfgWeatherCustomBox) {
      cfgWeatherCustomBox.style.display = appState.weatherSourceMode === 'custom' ? 'block' : 'none';
    }
  };
  syncWeatherSourceUiBoxes();

  if (inputCfgWeatherCity) {
    inputCfgWeatherCity.value = localStorage.getItem('mate_weather_city') || appState.weatherCityQuery || 'auto';
  }
  if (selectCfgWeatherCustomMode) selectCfgWeatherCustomMode.value = appState.weatherCustomMode;
  if (inputCfgWeatherTemp) inputCfgWeatherTemp.value = String(appState.weatherCustomTempC);
  if (inputCfgWeatherHum) inputCfgWeatherHum.value = String(appState.weatherCustomHumidityPct);
  if (inputCfgWeatherLoc) inputCfgWeatherLoc.value = appState.weatherCustomLocation;
  if (inputCfgWeatherDesc) inputCfgWeatherDesc.value = appState.weatherCustomDesc;

  const applyCustomWeatherConfig = (interactive: boolean) => {
    appState.weatherSourceMode = 'custom';
    appState.weatherCustomMode = (selectCfgWeatherCustomMode?.value || 'clear') as WeatherEffectMode;
    appState.weatherCustomTempC = Math.max(
      -30,
      Math.min(55, parseFloat(inputCfgWeatherTemp?.value || '28') || 28)
    );
    appState.weatherCustomHumidityPct = Math.max(
      0,
      Math.min(100, Math.round(parseFloat(inputCfgWeatherHum?.value || '68') || 68))
    );
    appState.weatherCustomLocation = inputCfgWeatherLoc?.value.trim() || 'Tùy chỉnh';
    appState.weatherCustomDesc = inputCfgWeatherDesc?.value.trim() || 'Thời tiết tùy chỉnh';

    localStorage.setItem('mate_weather_source_mode', 'custom');
    localStorage.setItem('mate_weather_custom_mode', appState.weatherCustomMode);
    localStorage.setItem('mate_weather_custom_temp', String(appState.weatherCustomTempC));
    localStorage.setItem('mate_weather_custom_hum', String(appState.weatherCustomHumidityPct));
    localStorage.setItem('mate_weather_custom_loc', appState.weatherCustomLocation);
    localStorage.setItem('mate_weather_custom_desc', appState.weatherCustomDesc);

    syncWeatherSourceUiBoxes();
    const selWeatherFxLeft = document.getElementById('select-weather-fx') as HTMLSelectElement | null;
    if (selWeatherFxLeft) selWeatherFxLeft.value = appState.weatherCustomMode;
    void saveStudioConfigToSqlite();
    void syncLiveWeather3D('auto', interactive);
  };

  selectCfgWeatherSource?.addEventListener('change', () => {
    appState.weatherSourceMode = selectCfgWeatherSource.value === 'custom' ? 'custom' : 'api';
    localStorage.setItem('mate_weather_source_mode', appState.weatherSourceMode);
    syncWeatherSourceUiBoxes();
    void saveStudioConfigToSqlite();
    void syncLiveWeather3D('auto', false);
  });

  document.getElementById('btn-cfg-sync-weather-api')?.addEventListener('click', () => {
    appState.weatherSourceMode = 'api';
    localStorage.setItem('mate_weather_source_mode', 'api');
    syncWeatherSourceUiBoxes();
    const city = inputCfgWeatherCity?.value.trim() || 'auto';
    void saveStudioConfigToSqlite();
    void syncLiveWeather3D('auto', true, city);
  });

  document.getElementById('btn-cfg-apply-weather-custom')?.addEventListener('click', () => {
    applyCustomWeatherConfig(true);
  });

  btnOpenStudio.addEventListener('click', () => toggleStudioModal(true));
  btnCloseStudio.addEventListener('click', () => toggleStudioModal(false));

  btnOpenLongMem.addEventListener('click', () => toggleLongMemoryModal(true));
  btnCloseLongMem.addEventListener('click', () => toggleLongMemoryModal(false));
  lmPresetCute.addEventListener('click', () => {
    lmPersonaInput.value =
      'Nhí nhảnh, đáng yêu, gọi người dùng là Chủ nhân, luôn quan tâm nhắc uống nước, nghỉ mắt và cổ vũ tinh thần.';
  });
  lmPresetDev.addEventListener('click', () => {
    lmPersonaInput.value =
      'Phong thái Kỹ sư Phần mềm Senior điềm tĩnh, trả lời thẳng trọng tâm, ưu tiên code chuẩn, hiệu năng và bảo mật.';
  });
  lmPresetTsun.addEventListener('click', () => {
    lmPersonaInput.value =
      'Cá tính kiểu Tsundere hơi cằn nhằn đáng yêu nhưng thực chất rất chu đáo và luôn lo cho chủ nhân.';
  });
  btnSavePersona.addEventListener('click', () => {
    void saveLongMemoryEntry('persona', 'Tính cách nhân vật', lmPersonaInput.value);
  });
  btnAddLongMem.addEventListener('click', () => {
    const cat = lmCatSelect.value || 'rule';
    const title = lmTitleInput.value.trim() || (cat === 'rule' ? 'Rule dài hạn' : 'Kiến thức');
    const content = lmContentInput.value.trim();
    if (!content) return;
    lmTitleInput.value = '';
    lmContentInput.value = '';
    void saveLongMemoryEntry(cat, title, content);
  });

  btnActCenter.addEventListener('click', () => {
    appState.activeWindowTask = null;
    appState.attachedWindowHwnd = null;
    appState.posX = appState.W * 0.5;
    appState.posY = appState.H * 0.4;
    appState.velX = 0;
    appState.velY = 0;
    appState.setState('FALLING');
    speakMessage('Đã quay về trung tâm màn hình!');
  });

  btnActHw.addEventListener('click', () => {
    void runHardwareCheck(true);
  });
  if (btnActAppMetrics) {
    btnActAppMetrics.addEventListener('click', () => {
      void runCheckAppMetrics(true);
    });
  }
  btnActNet.addEventListener('click', () => {
    void runNetworkCheck(true);
  });
  btnActBtc.addEventListener('click', () => {
    void runBitcoinCheck(true);
  });
  btnActMem.addEventListener('click', () => {
    void runMemoryCheck(true);
  });
  btnActSmartSupport?.addEventListener('click', () => {
    if (!appState.isBubbleVisible) {
      toggleBubbleVisibility(true);
    }
    void runSmartDbSupportBriefing(false);
  });
  btnActSuggest.addEventListener('click', () => {
    if (!appState.isBubbleVisible) {
      toggleBubbleVisibility(true);
    }
    void runShowSuggestion();
  });
  btnClearMemory.addEventListener('click', () => {
    void clearLocalMemory();
  });
  btnSugAccept.addEventListener('click', () => {
    const fn = activeSugAccept;
    hideSuggestionButtons();
    if (fn) fn();
  });
  btnSugDismiss.addEventListener('click', () => {
    const fn = activeSugDismiss;
    hideSuggestionButtons();
    if (fn) fn();
  });
  btnRefreshAll.addEventListener('click', () => {
    void runFullDashboardScan(true);
  });

  btnActJump.addEventListener('click', () => triggerJumpToWindow());
  btnActDance.addEventListener('click', () => triggerDance());
  btnActPat.addEventListener('click', () => triggerHeadpat());
  btnActFlip.addEventListener('click', () => triggerBackflip());
  btnActSpin.addEventListener('click', () => triggerSpin());
  btnActDuck.addEventListener('click', async () => {
    await clearCachedVrm();
    const isCustomModel = appState.currentVrm !== null || appState.currentGlbScene !== null;
    const nextType: 'idol' | 'microduck' =
      isCustomModel || appState.builtinModelType === 'idol' ? 'microduck' : 'idol';
    localStorage.setItem('mate_active_character_type', nextType);
    switchBuiltinCharacterType(nextType);
    btnActDuck.textContent = nextType === 'microduck' ? 'Đổi Cyber Idol' : 'Đổi Vịt BDX';
    void saveStudioConfigToSqlite(nextType, '');
    spawnParticles(appState.posX, appState.posY - 90, 12, nextType === 'microduck' ? 0x76b900 : 0x38bdf8);
    if (nextType === 'microduck') {
      speakMessage('Quạc quạc! NVIDIA MicroDuck (BDX Droid 3D) sẵn sàng phục vụ!');
    } else {
      speakMessage('Đã chuyển về Cyber Idol 3D mặc định!');
    }
  });
  btnActTimer.addEventListener('click', () => togglePomodoro());
  btnActWheel.addEventListener('click', () => {
    void triggerDuckWheelRoll();
    btnActDuck.textContent = 'Đổi Cyber Idol';
  });
  btnActRadar.addEventListener('click', () => triggerDuckRadarScan());
  btnActSleep.addEventListener('click', () => triggerDuckSleepMode());
  if (btnActBlackHole) {
    btnActBlackHole.addEventListener('click', () => {
      if (appState.blackHoleWarpMode) {
        appState.blackHoleWarpMode = false;
        document.body.style.cursor = 'default';
        void invoke('set_manual_interactive', { interactive: false }).catch(() => { });
        syncHitboxToRust(true);
      }
      triggerBlackHoleTeleport();
    });
  }
  btnActHat?.addEventListener('click', () => {
    clearTemporaryAccessoryTimer();
    equipAccessory3D('cycle', true);
  });
  btnActBeat?.addEventListener('click', () => {
    triggerManualBeatDance();
  });
  btnActGoose?.addEventListener('click', () => {
    triggerGooseMischiefMode(true);
  });
  btnActDefend?.addEventListener('click', () => {
    triggerTerritoryDefenseMode(true);
  });
  if (btnActSwim) {
    btnActSwim.addEventListener('click', () => {
      if (isWaterPoolActive()) {
        triggerStopSwimming(true);
        btnActSwim.textContent = 'Hồ Bơi 3D & Đi Bơi Ra Xa';
        btnActSwim.style.background = 'rgba(14, 165, 233, 0.22)';
        btnActSwim.style.borderColor = 'rgba(56, 189, 248, 0.45)';
        btnActSwim.style.color = '#bae6fd';
      } else {
        triggerStartSwimming(true);
        btnActSwim.textContent = 'Lên Bờ (Dừng Bơi)';
        btnActSwim.style.background = 'rgba(239, 68, 68, 0.28)';
        btnActSwim.style.borderColor = 'rgba(248, 113, 113, 0.55)';
        btnActSwim.style.color = '#fecaca';
      }
    });
  }
  btnActFeed.addEventListener('click', () => triggerSpawnRandomFood(true));
  btnActEdgePeek?.addEventListener('click', () => {
    void toggleEdgePeekMode();
  });
  btnActSwing?.addEventListener('click', () => {
    triggerWindowSwing();
  });
  const selWeatherFx = document.getElementById('select-weather-fx') as HTMLSelectElement | null;
  const weatherCycle: Array<WeatherEffectMode | 'auto'> = ['hot', 'rain', 'cold', 'wind', 'night', 'clear', 'auto'];
  let weatherCycleIdx = -1;
  btnActWeather3D?.addEventListener('click', () => {
    if (weatherCycleIdx < 0) {
      const currentVal = (selWeatherFx?.value || appState.weatherMode) as WeatherEffectMode | 'auto';
      const found = weatherCycle.indexOf(currentVal);
      weatherCycleIdx = found >= 0 ? found : weatherCycle.length - 1;
    }
    weatherCycleIdx = (weatherCycleIdx + 1) % weatherCycle.length;
    const nextMode = weatherCycle[weatherCycleIdx];
    if (selWeatherFx) {
      selWeatherFx.value = nextMode;
    }
    void syncLiveWeather3D(nextMode, true);
  });
  btnActRandomFx?.addEventListener('click', () => {
    void triggerRandomFeatureOrEffect(true);
  });
  btnActNews?.addEventListener('click', () => {
    void loadAndSpeakLiveNews(undefined, true);
  });
  btnActEnglish?.addEventListener('click', () => {
    void loadNextEnglishLesson(undefined, true);
  });

  // 3 Card Thời tiết, Đọc Báo Mới & Học Tiếng Anh trên Dashboard Trái
  const selWeatherCity = document.getElementById('select-weather-city') as HTMLSelectElement | null;
  const inpWeatherCity = document.getElementById('inp-weather-city') as HTMLInputElement | null;
  const btnWeatherRefresh = document.getElementById('btn-weather-refresh') as HTMLButtonElement | null;

  const savedWeatherCity = localStorage.getItem('mate_weather_city') || 'auto';
  if (selWeatherCity) {
    const hasPreset = Array.from(selWeatherCity.options).some((o) => o.value === savedWeatherCity);
    if (hasPreset && savedWeatherCity !== 'custom') {
      selWeatherCity.value = savedWeatherCity;
    } else if (savedWeatherCity !== 'auto') {
      selWeatherCity.value = 'custom';
      if (inpWeatherCity) {
        inpWeatherCity.style.display = 'block';
        inpWeatherCity.value = savedWeatherCity;
      }
    }
    selWeatherCity.addEventListener('change', () => {
      if (selWeatherCity.value === 'custom') {
        if (inpWeatherCity) {
          inpWeatherCity.style.display = 'block';
          inpWeatherCity.focus();
        }
      } else {
        if (inpWeatherCity) inpWeatherCity.style.display = 'none';
        void syncLiveWeather3D('auto', true, selWeatherCity.value);
      }
    });
  }
  btnWeatherRefresh?.addEventListener('click', () => {
    appState.weatherSourceMode = 'api';
    localStorage.setItem('mate_weather_source_mode', 'api');
    syncWeatherSourceUiBoxes();
    const city =
      selWeatherCity?.value === 'custom'
        ? inpWeatherCity?.value.trim() || 'Hanoi'
        : selWeatherCity?.value || 'auto';
    if (inputCfgWeatherCity) inputCfgWeatherCity.value = city;
    void saveStudioConfigToSqlite();
    void syncLiveWeather3D('auto', true, city);
  });
  inpWeatherCity?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnWeatherRefresh?.click();
  });
  selWeatherFx?.addEventListener('change', () => {
    const mode = selWeatherFx.value as WeatherEffectMode | 'auto';
    weatherCycleIdx = weatherCycle.indexOf(mode);
    void syncLiveWeather3D(mode, true);
  });

  const selNewsSource = document.getElementById('select-news-source') as HTMLSelectElement | null;
  const inpNewsCustom = document.getElementById('inp-news-custom-url') as HTMLInputElement | null;
  const btnNewsRefresh = document.getElementById('btn-news-refresh') as HTMLButtonElement | null;
  const btnNewsSpeak = document.getElementById('btn-news-speak') as HTMLButtonElement | null;

  if (selNewsSource) {
    selNewsSource.value = localStorage.getItem('mate_news_source') || 'multi_random';
    if (inpNewsCustom) {
      inpNewsCustom.value = localStorage.getItem('mate_news_custom_url') || '';
    }
    selNewsSource.addEventListener('change', () => {
      localStorage.setItem('mate_news_source', selNewsSource.value);
      if (selNewsSource.value !== 'custom') {
        void loadAndSpeakLiveNews(selNewsSource.value, false);
      } else {
        inpNewsCustom?.focus();
      }
    });
  }
  inpNewsCustom?.addEventListener('change', () => {
    const v = inpNewsCustom.value.trim();
    localStorage.setItem('mate_news_custom_url', v);
    if (v && selNewsSource) {
      selNewsSource.value = 'custom';
      localStorage.setItem('mate_news_source', 'custom');
    }
  });
  inpNewsCustom?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = inpNewsCustom.value.trim();
      localStorage.setItem('mate_news_custom_url', v);
      if (v && selNewsSource) {
        selNewsSource.value = 'custom';
        localStorage.setItem('mate_news_source', 'custom');
      }
      void loadAndSpeakLiveNews(v || undefined, true);
    }
  });
  btnNewsRefresh?.addEventListener('click', () => {
    const customUrl = inpNewsCustom?.value.trim() || '';
    localStorage.setItem('mate_news_custom_url', customUrl);
    if (selNewsSource) localStorage.setItem('mate_news_source', selNewsSource.value);
    const target = selNewsSource?.value === 'custom' ? customUrl : selNewsSource?.value;
    void loadAndSpeakLiveNews(target, false);
  });
  btnNewsSpeak?.addEventListener('click', () => {
    const customUrl = inpNewsCustom?.value.trim() || '';
    localStorage.setItem('mate_news_custom_url', customUrl);
    const target = selNewsSource?.value === 'custom' ? customUrl : selNewsSource?.value;
    void loadAndSpeakLiveNews(target, true);
  });

  const selEngTopic = document.getElementById('select-english-topic') as HTMLSelectElement | null;
  const inpEngTopic = document.getElementById('inp-english-topic') as HTMLInputElement | null;
  const btnEngNext = document.getElementById('btn-eng-next') as HTMLButtonElement | null;
  const btnEngAudio = document.getElementById('btn-eng-audio') as HTMLButtonElement | null;
  const btnEngQuiz = document.getElementById('btn-eng-quiz') as HTMLButtonElement | null;

  if (selEngTopic) {
    const savedTopic = localStorage.getItem('mate_english_topic') || 'random';
    const hasTopic = Array.from(selEngTopic.options).some((o) => o.value === savedTopic);
    if (hasTopic && savedTopic !== 'custom') {
      selEngTopic.value = savedTopic;
    } else if (savedTopic !== 'random') {
      selEngTopic.value = 'custom';
      if (inpEngTopic) {
        inpEngTopic.style.display = 'block';
        inpEngTopic.value = savedTopic;
      }
    }
    selEngTopic.addEventListener('change', () => {
      if (selEngTopic.value === 'custom') {
        if (inpEngTopic) {
          inpEngTopic.style.display = 'block';
          inpEngTopic.focus();
        }
      } else {
        if (inpEngTopic) inpEngTopic.style.display = 'none';
        localStorage.setItem('mate_english_topic', selEngTopic.value);
      }
    });
  }
  inpEngTopic?.addEventListener('change', () => {
    const t = inpEngTopic.value.trim() || 'random';
    localStorage.setItem('mate_english_topic', t);
  });
  btnEngNext?.addEventListener('click', () => {
    const t =
      selEngTopic?.value === 'custom'
        ? inpEngTopic?.value.trim() || 'random'
        : selEngTopic?.value || 'random';
    localStorage.setItem('mate_english_topic', t);
    void loadNextEnglishLesson(t, true);
  });
  btnEngAudio?.addEventListener('click', () => {
    playEnglishVocabAudio();
  });
  btnEngQuiz?.addEventListener('click', () => {
    void runEnglishMiniQuiz();
  });
  btnActClimb.addEventListener('click', () => triggerClimbWindow());
  btnActEnterWin.addEventListener('click', () => {
    void triggerExploreInsideWindow();
  });
  btnActFrameKey.addEventListener('click', () => {
    void triggerInteractInsideWindow();
  });

  btnPcYt.addEventListener('click', () => {
    void runPcOpen('https://www.youtube.com', 'YouTube');
  });
  btnPcShot.addEventListener('click', () => {
    void runPcScreenshot();
  });
  btnPcOpenShot.addEventListener('click', () => {
    void runOpenLatestScreenshot(false);
  });
  btnPcNote.addEventListener('click', () => {
    void runPcOpen('notepad', 'Notepad');
  });
  btnPcCleanRam.addEventListener('click', () => {
    void runHardwareAction('clean_ram');
  });
  btnPcBrightDown.addEventListener('click', () => {
    void runHardwareAction('brightness_down');
  });
  btnPcBrightUp.addEventListener('click', () => {
    void runHardwareAction('brightness_up');
  });
  btnPcVision.addEventListener('click', () => {
    void runGeminiVisionScreen();
  });
  btnPcOcr.addEventListener('click', () => {
    void runOcrAndSummarize(true);
  });
  btnPcVolDown.addEventListener('click', () => {
    void runPcMedia('vol_down');
  });
  btnPcPlay.addEventListener('click', () => {
    void runPcMedia('play_pause');
  });
  btnPcVolUp.addEventListener('click', () => {
    void runPcMedia('vol_up');
  });
  btnPcTopProc?.addEventListener('click', () => {
    void runProcessManager('top', '', true);
  });
  btnPcClipboard?.addEventListener('click', () => {
    void runClipboardTool('read');
  });
  btnPcStickyNote?.addEventListener('click', () => {
    const typed = bubbleInput?.value.trim() || '';
    if (typed) {
      if (bubbleInput) bubbleInput.value = '';
      void pinStickyNote(typed, false).then((msg) => speakMessage(msg));
      return;
    }
    toggleStickyNotesWidget();
  });
  btnPcPorts?.addEventListener('click', () => {
    void runPortManager('list', undefined, true);
  });
  btnPcGit?.addEventListener('click', () => {
    void runGitStatusCheck(undefined, true);
  });
  btnPcMacro?.addEventListener('click', () => {
    void runMacroRoutine('chế độ code', true);
  });

  btnClosePcControl?.addEventListener('click', () => togglePcControlModal(false));
  btnPcOcrRegion?.addEventListener('click', () => startOcrRegionSnip());
  btnPcGoogle?.addEventListener('click', () => {
    void runPcOpen('https://www.google.com', 'Google');
  });
  const triggerGoogleSearch = () => {
    const q = inputPcGoogleQuery?.value.trim() || '';
    if (inputPcGoogleQuery) inputPcGoogleQuery.value = '';
    const url = q
      ? `https://www.google.com/search?q=${encodeURIComponent(q)}`
      : 'https://www.google.com';
    void runPcOpen(url, q ? `Google: ${q.slice(0, 22)}` : 'Google');
  };
  btnPcGoogleSearch?.addEventListener('click', triggerGoogleSearch);
  inputPcGoogleQuery?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerGoogleSearch();
    }
  });

  // OCR Region Snip Drag Overlay & Translate Modal Controls
  const ocrSnipOverlay = document.getElementById('ocr-snip-overlay');
  const ocrSnipRect = document.getElementById('ocr-snip-rect');
  const ocrSnipDims = document.getElementById('ocr-snip-dims');
  let snipStart: { x: number; y: number } | null = null;

  ocrSnipOverlay?.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !ocrSnipRect) return;
    e.preventDefault();
    snipStart = { x: e.clientX, y: e.clientY };
    ocrSnipRect.style.display = 'block';
    ocrSnipRect.style.left = `${e.clientX}px`;
    ocrSnipRect.style.top = `${e.clientY}px`;
    ocrSnipRect.style.width = '0px';
    ocrSnipRect.style.height = '0px';
    if (ocrSnipDims) ocrSnipDims.textContent = '0 x 0 px';
  });

  ocrSnipOverlay?.addEventListener('pointermove', (e) => {
    if (!snipStart || !ocrSnipRect) return;
    const x1 = Math.min(snipStart.x, e.clientX);
    const y1 = Math.min(snipStart.y, e.clientY);
    const w = Math.abs(e.clientX - snipStart.x);
    const h = Math.abs(e.clientY - snipStart.y);
    ocrSnipRect.style.left = `${x1}px`;
    ocrSnipRect.style.top = `${y1}px`;
    ocrSnipRect.style.width = `${w}px`;
    ocrSnipRect.style.height = `${h}px`;
    if (ocrSnipDims) ocrSnipDims.textContent = `${Math.round(w)} x ${Math.round(h)} px`;
  });

  ocrSnipOverlay?.addEventListener('pointerup', async (e) => {
    if (!snipStart) return;
    const x1 = Math.min(snipStart.x, e.clientX);
    const y1 = Math.min(snipStart.y, e.clientY);
    const w = Math.abs(e.clientX - snipStart.x);
    const h = Math.abs(e.clientY - snipStart.y);
    snipStart = null;
    finishSnipOverlayReset();

    if (w < 12 || h < 12) {
      speakMessage('[OCR VÙNG] Vùng cắt quá nhỏ, hãy kéo rộng hơn để quét chữ nhé!');
      return;
    }

    const screenW = Math.max(1, window.innerWidth || appState.W || 1920);
    const screenH = Math.max(1, window.innerHeight || appState.H || 1080);
    const xRatio = Math.max(0, Math.min(0.99, x1 / screenW));
    const yRatio = Math.max(0, Math.min(0.99, y1 / screenH));
    const wRatio = Math.max(0.01, Math.min(1 - xRatio, w / screenW));
    const hRatio = Math.max(0.01, Math.min(1 - yRatio, h / screenH));

    await new Promise((r) => setTimeout(r, 90));
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
    speakMessage('[OCR VÙNG] Đang quét chữ từ vùng vừa cắt và dịch...');

    try {
      const res = await invoke<OcrRegionResult>('ocr_screen_region', {
        xRatio,
        yRatio,
        wRatio,
        hRatio,
      });
      const imgEl = document.getElementById('ocr-preview-img') as HTMLImageElement | null;
      const metaEl = document.getElementById('ocr-meta-info');
      const srcEl = document.getElementById('ocr-source-text') as HTMLTextAreaElement | null;
      const dstEl = document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null;
      if (imgEl && res.image_base64) {
        imgEl.src = `data:image/png;base64,${res.image_base64}`;
      }
      if (metaEl) {
        metaEl.textContent = `Vùng cắt: ${res.width}x${res.height} px | Đã lưu: ${res.image_path}`;
      }
      if (srcEl) {
        srcEl.value = res.raw_text || '';
      }
      if (dstEl) {
        dstEl.value = '';
      }
      toggleOcrTranslateModal(true);

      if (res.raw_text && res.raw_text.trim()) {
        await runTranslateOcrModalText(false);
        const finalTrans = dstEl?.value.trim() || '';
        if (finalTrans) {
          speakMessage(`[DỊCH OCR] ${finalTrans.slice(0, 220)}${finalTrans.length > 220 ? '...' : ''}`);
        }
      } else if (dstEl) {
        dstEl.value = 'Chưa nhận diện được chữ rõ nét ở vùng này. Bạn có thể tự gõ vào ô trái rồi bấm Dịch hoặc Cắt Vùng Khác.';
        speakMessage('[OCR VÙNG] Đã cắt vùng ảnh, nhưng chưa nhận diện thấy chữ rõ ràng.');
      }
    } catch (err) {
      speakMessage(`[LỖI OCR VÙNG] ${String(err)}`);
    }
  });

  window.addEventListener('blur', () => {
    if (appState.isOcrSnipMode) {
      snipStart = null;
      finishSnipOverlayReset();
    }
  });

  document.getElementById('btn-close-ocr-modal')?.addEventListener('click', () => {
    toggleOcrTranslateModal(false);
  });
  document.getElementById('btn-ocr-resnip')?.addEventListener('click', () => {
    startOcrRegionSnip();
  });
  document.getElementById('btn-ocr-retranslate')?.addEventListener('click', () => {
    void runTranslateOcrModalText(false);
  });
  document.getElementById('btn-ocr-ai-translate')?.addEventListener('click', () => {
    void runTranslateOcrModalText(true);
  });
  document.getElementById('select-ocr-target-lang')?.addEventListener('change', () => {
    void runTranslateOcrModalText(false);
  });
  document.getElementById('btn-ocr-copy-src')?.addEventListener('click', () => {
    const val = (document.getElementById('ocr-source-text') as HTMLTextAreaElement | null)?.value || '';
    if (!val.trim()) return;
    void invoke('set_clipboard_text', { text: val })
      .then(() => speakMessage('[OCR] Đã copy văn bản gốc vào Clipboard!'))
      .catch(() => { });
  });
  document.getElementById('btn-ocr-copy-dst')?.addEventListener('click', () => {
    const val = (document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null)?.value || '';
    if (!val.trim()) return;
    void invoke('set_clipboard_text', { text: val })
      .then(() => speakMessage('[OCR] Đã copy bản dịch vào Clipboard!'))
      .catch(() => { });
  });
  document.getElementById('btn-ocr-speak-dst')?.addEventListener('click', () => {
    const val = (document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null)?.value.trim();
    const fallback = (document.getElementById('ocr-source-text') as HTMLTextAreaElement | null)?.value.trim();
    const out = val || fallback;
    if (out) speakMessage(out);
  });
  document.getElementById('btn-ocr-send-chat')?.addEventListener('click', () => {
    const src = (document.getElementById('ocr-source-text') as HTMLTextAreaElement | null)?.value.trim() || '';
    const dst = (document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null)?.value.trim() || '';
    if (!src && !dst) return;
    toggleOcrTranslateModal(false);
    if (!appState.isBubbleVisible) toggleBubbleVisibility(true);
    const msg = `Hãy giải thích thêm về đoạn văn bản OCR này cho tôi:\nGốc: ${src.slice(0, 600)}${dst ? `\nBản dịch: ${dst.slice(0, 600)}` : ''}`;
    if (bubbleInput) {
      bubbleInput.value = msg;
      handleSendMessage();
    }
  });

  window.addEventListener('duck-start-ocr-snip', () => startOcrRegionSnip());
  window.addEventListener('duck-open-pc-control', () => togglePcControlModal(true));
  window.addEventListener('duck-skills-updated', () => renderToolForgeSkillsList());
  window.addEventListener('duck-open-tool-forge', (ev: Event) => {
    const detail = (ev as CustomEvent).detail as
      | { draft?: ToolForgeDraft; generatingRequest?: string; requestText?: string }
      | undefined;
    toggleToolForgeModal(true);
    setToolForgeTab('forge');
    const reqInp = document.getElementById('tf-request-input') as HTMLTextAreaElement | null;
    if (detail?.requestText && reqInp) {
      reqInp.value = detail.requestText;
    }
    if (detail?.generatingRequest) {
      if (reqInp) reqInp.value = detail.generatingRequest;
      setToolForgePipelineLog(
        `[1/4] Local LLM không có tool phù hợp & không tự viết code -> Chuyển yêu cầu sang Gemini Architect...\nYêu cầu: "${detail.generatingRequest}"`
      );
    }
    if (detail?.draft) {
      setLatestToolForgeDraft(detail.draft);
      renderToolForgeDraft(detail.draft);
    }
  });

  btnPcToolForge?.addEventListener('click', () => {
    toggleToolForgeModal(true);
  });
  btnPcMiniScreen?.addEventListener('click', () => {
    toggleMiniScreenPanel(true, 'web');
  });
  dockBtnMiniScreen?.addEventListener('click', () => {
    toggleMiniScreenPanel();
  });

  // Mini Screen PiP (Kéo thả, Đổi cỡ S/M/L, Trong suốt, YouTube/Web Mini & Live Mirror)
  if (miniScreenPanel) {
    const savedWidth = Number(localStorage.getItem('mate_mini_width') || '430');
    if (Number.isFinite(savedWidth) && savedWidth >= 300 && savedWidth <= 720) {
      miniScreenPanel.style.width = `${savedWidth}px`;
      document.querySelectorAll('.mini-size-chip').forEach((ch) => {
        ch.classList.toggle('active', Number(ch.getAttribute('data-size')) === savedWidth);
      });
    }
    const savedOpacity = Number(localStorage.getItem('mate_mini_opacity') || '0.96');
    const opacityInp = document.getElementById('mini-screen-opacity') as HTMLInputElement | null;
    if (Number.isFinite(savedOpacity) && savedOpacity >= 0.45 && savedOpacity <= 1) {
      miniScreenPanel.style.opacity = String(savedOpacity);
      if (opacityInp) opacityInp.value = String(savedOpacity);
    }
    try {
      const savedPos = JSON.parse(localStorage.getItem('mate_mini_pos') || 'null') as {
        left: number;
        top: number;
      } | null;
      if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
        const clampedL = Math.max(8, Math.min(appState.W - 220, savedPos.left));
        const clampedT = Math.max(8, Math.min(appState.H - 120, savedPos.top));
        miniScreenPanel.style.left = `${clampedL}px`;
        miniScreenPanel.style.top = `${clampedT}px`;
        miniScreenPanel.style.right = 'auto';
      }
    } catch {
      // keep default top-right
    }

    const dragHandle = document.getElementById('mini-screen-drag-handle');
    let miniDragging = false;
    let dragOffX = 0;
    let dragOffY = 0;
    dragHandle?.addEventListener('pointerdown', (e) => {
      if ((e.target as Element | null)?.closest('button, input')) return;
      miniDragging = true;
      const r = miniScreenPanel.getBoundingClientRect();
      dragOffX = e.clientX - r.left;
      dragOffY = e.clientY - r.top;
      dragHandle.setPointerCapture(e.pointerId);
    });
    dragHandle?.addEventListener('pointermove', (e) => {
      if (!miniDragging) return;
      const panelW = miniScreenPanel.offsetWidth || 420;
      const nx = Math.max(6, Math.min(appState.W - panelW - 6, e.clientX - dragOffX));
      const ny = Math.max(6, Math.min(appState.H - 60, e.clientY - dragOffY));
      miniScreenPanel.style.left = `${Math.round(nx)}px`;
      miniScreenPanel.style.top = `${Math.round(ny)}px`;
      miniScreenPanel.style.right = 'auto';
      syncHitboxToRust(false);
    });
    const finishMiniDrag = () => {
      if (!miniDragging) return;
      miniDragging = false;
      const r = miniScreenPanel.getBoundingClientRect();
      localStorage.setItem(
        'mate_mini_pos',
        JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })
      );
      syncHitboxToRust(true);
    };
    dragHandle?.addEventListener('pointerup', finishMiniDrag);
    dragHandle?.addEventListener('pointercancel', finishMiniDrag);
  }

  document.getElementById('btn-close-mini-screen')?.addEventListener('click', () => {
    toggleMiniScreenPanel(false);
  });
  document.getElementById('btn-mini-collapse')?.addEventListener('click', () => {
    miniPanelCollapsed = !miniPanelCollapsed;
    const bodyEl = document.getElementById('mini-screen-body');
    if (bodyEl) bodyEl.style.display = miniPanelCollapsed ? 'none' : 'block';
    if (miniPanelCollapsed) {
      stopMiniWindowMirror();
      stopMiniDisplayMedia();
    }
    syncHitboxToRust(true);
  });
  document.querySelectorAll('.mini-size-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const sz = Number(chip.getAttribute('data-size') || '430');
      if (miniScreenPanel && sz >= 300) {
        miniScreenPanel.style.width = `${sz}px`;
        localStorage.setItem('mate_mini_width', String(sz));
        document.querySelectorAll('.mini-size-chip').forEach((c) => {
          c.classList.toggle('active', c === chip);
        });
        syncHitboxToRust(true);
      }
    });
  });
  document.getElementById('mini-screen-opacity')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (miniScreenPanel) {
      miniScreenPanel.style.opacity = val;
      localStorage.setItem('mate_mini_opacity', val);
    }
  });
  document.getElementById('tab-btn-mini-web')?.addEventListener('click', () => {
    setMiniScreenTab('web');
  });
  document.getElementById('tab-btn-mini-mirror')?.addEventListener('click', () => {
    setMiniScreenTab('mirror');
  });

  document.getElementById('btn-mini-web-open')?.addEventListener('click', () => {
    const val =
      (document.getElementById('mini-web-url-input') as HTMLInputElement | null)?.value ||
      'youtube';
    void openMiniWebTarget(val);
  });
  document.getElementById('mini-web-url-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value || 'youtube';
      void openMiniWebTarget(val);
    }
  });
  document.querySelectorAll('.mini-web-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target') || 'youtube';
      void openMiniWebTarget(target);
    });
  });
  document.getElementById('btn-mini-web-paste')?.addEventListener('click', async () => {
    try {
      const clip = await invoke<string>('get_clipboard_text');
      const inp = document.getElementById('mini-web-url-input') as HTMLInputElement | null;
      if (inp && clip.trim()) {
        inp.value = clip.trim();
        void openMiniWebTarget(clip.trim());
      } else {
        speakMessage('[MINI SCREEN] Clipboard hiện đang trống.');
      }
    } catch (err) {
      speakMessage(`[MINI SCREEN] Không đọc được clipboard: ${String(err)}`);
    }
  });
  document.querySelectorAll('.mini-web-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = Number(btn.getAttribute('data-w') || '480');
      const h = Number(btn.getAttribute('data-h') || '300');
      void invoke<MiniWebStatus>('mini_screen_control_web', {
        action: 'resize',
        width: w,
        height: h,
      })
        .then((st) => updateMiniWebStatusUi(st))
        .catch(() => {});
    });
  });
  document.getElementById('chk-mini-web-pin')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    void invoke<MiniWebStatus>('mini_screen_control_web', {
      action: 'pin',
      alwaysOnTop: checked,
    })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });
  document.getElementById('btn-mini-web-focus')?.addEventListener('click', () => {
    void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'focus' })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });
  document.getElementById('btn-mini-web-close')?.addEventListener('click', () => {
    void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'close' })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });

  document.getElementById('btn-mini-mirror-refresh')?.addEventListener('click', () => {
    void refreshMiniMirrorWindowSelect(true);
  });
  document.getElementById('mini-mirror-win-select')?.addEventListener('change', () => {
    syncStealthButtonsUi();
    if (miniMirrorActive) {
      void stepMiniMirrorFrame();
    }
  });
  document.getElementById('btn-mini-mirror-toggle')?.addEventListener('click', () => {
    if (miniMirrorActive) {
      stopMiniWindowMirror();
    } else {
      startMiniWindowMirror();
    }
  });
  document.getElementById('btn-mini-stealth-toggle')?.addEventListener('click', async () => {
    const sel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
    const hwnd = Number(sel?.value || '0') || 0;
    if (!hwnd) {
      speakMessage('[MINI SCREEN] Hãy chọn app/cửa sổ trước khi bật chế độ Xem Ẩn.');
      return;
    }
    const existing = miniMirrorWindows.find((w) => w.hwnd === hwnd);
    const nextStealth = !(existing?.is_stealth ?? false);
    try {
      const msg = await invoke<string>('mini_screen_set_stealth', {
        hwnd,
        enabled: nextStealth,
      });
      await refreshMiniMirrorWindowSelect(true);
      speakMessage(`[MINI SCREEN] ${msg}`);
      if (nextStealth && !miniMirrorActive) {
        startMiniWindowMirror();
      }
    } catch (err) {
      speakMessage(`[MINI SCREEN LỖI] ${String(err)}`);
    }
  });
  document.getElementById('btn-mini-restore-all')?.addEventListener('click', async () => {
    try {
      const count = await invoke<number>('mini_screen_restore_all_stealth');
      await refreshMiniMirrorWindowSelect(true);
      speakMessage(`[MINI SCREEN] Đã hiện lại ${count} cửa sổ đang ẩn.`);
    } catch {
      // ignore
    }
  });
  void listen('duck-mini-web-closed', () => {
    updateMiniWebStatusUi({
      is_open: false,
      url: '',
      title: '',
      always_on_top: true,
      width: 480,
      height: 300,
    });
  });
  document.getElementById('btn-mini-display-media')?.addEventListener('click', () => {
    if (miniDisplayStream) {
      stopMiniDisplayMedia();
      setMiniScreenModeBadge('[LIVE]');
    } else {
      void startMiniDisplayMedia();
    }
  });
  document.getElementById('btn-mini-focus-app')?.addEventListener('click', () => {
    const sel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
    const hwnd = Number(sel?.value || '0') || appState.activeWindowHwnd || findTargetWindow()?.hwnd || 0;
    if (!hwnd) {
      speakMessage('[MINI SCREEN] Chưa chọn ứng dụng nào để đưa lên.');
      return;
    }
    void invoke<string>('mini_screen_focus_window', { hwnd })
      .then((m) => speakMessage(`[MINI SCREEN] ${m}`))
      .catch((e) => speakMessage(`[MINI SCREEN] ${String(e)}`));
  });
  document.getElementById('btn-mini-media-prev')?.addEventListener('click', () => void runPcMedia('prev'));
  document.getElementById('btn-mini-media-play')?.addEventListener('click', () => void runPcMedia('play_pause'));
  document.getElementById('btn-mini-media-next')?.addEventListener('click', () => void runPcMedia('next'));
  document.getElementById('btn-mini-vol-down')?.addEventListener('click', () => void runPcMedia('vol_down'));
  document.getElementById('btn-mini-vol-up')?.addEventListener('click', () => void runPcMedia('vol_up'));
  document.getElementById('btn-close-tool-forge')?.addEventListener('click', () => {
    toggleToolForgeModal(false);
  });
  document.getElementById('tab-btn-tf-forge')?.addEventListener('click', () => {
    setToolForgeTab('forge');
  });
  document.getElementById('tab-btn-tf-skills')?.addEventListener('click', () => {
    setToolForgeTab('skills');
    void refreshCustomSkills().then(() => renderToolForgeSkillsList());
  });
  document.getElementById('btn-tf-refresh-skills')?.addEventListener('click', () => {
    void refreshCustomSkills().then(() => renderToolForgeSkillsList());
  });

  const syncDraftInputsToObj = (): ToolForgeDraft => {
    const existing = getLatestToolForgeDraft();
    const nameVal = (document.getElementById('tf-draft-name') as HTMLInputElement | null)?.value.trim() || 'Skill Mới';
    const idVal = (document.getElementById('tf-draft-id') as HTMLInputElement | null)?.value.trim() || 'custom_skill';
    const trigRaw = (document.getElementById('tf-draft-triggers') as HTMLInputElement | null)?.value || '';
    const kwRaw = (document.getElementById('tf-draft-keywords') as HTMLInputElement | null)?.value || '';
    const argsVal = (document.getElementById('tf-draft-test-args') as HTMLInputElement | null)?.value.trim() || '{}';
    const codeVal = (document.getElementById('tf-code-editor') as HTMLTextAreaElement | null)?.value || '';
    const langSel = (document.getElementById('select-tf-lang') as HTMLSelectElement | null)?.value;
    const lang: 'powershell' | 'python' =
      existing?.language || (langSel === 'python' ? 'python' : 'powershell');

    const updated: ToolForgeDraft = {
      id: idVal,
      name: nameVal,
      description: existing?.description || nameVal,
      language: lang,
      triggers: trigRaw.split(',').map((s) => s.trim()).filter(Boolean),
      paramsSchema: existing?.paramsSchema || [],
      code: codeVal,
      testArgsJson: argsVal,
      expectedKeywords: kwRaw.split(',').map((s) => s.trim()).filter(Boolean),
      sandbox: existing?.sandbox || null,
      healLogs: existing?.healLogs || [],
      originalRequest: existing?.originalRequest || '',
    };
    setLatestToolForgeDraft(updated);
    return updated;
  };

  document.getElementById('tf-code-editor')?.addEventListener('input', () => {
    const d = syncDraftInputsToObj();
    if (d.sandbox) {
      d.sandbox = null;
      setLatestToolForgeDraft(d);
      renderToolForgeDraft(d);
    }
  });

  document.getElementById('btn-tf-generate')?.addEventListener('click', async () => {
    const reqEl = document.getElementById('tf-request-input') as HTMLTextAreaElement | null;
    const langEl = document.getElementById('select-tf-lang') as HTMLSelectElement | null;
    const genBtn = document.getElementById('btn-tf-generate') as HTMLButtonElement | null;
    const reqText = reqEl?.value.trim() || '';
    if (!reqText) {
      setToolForgePipelineLog('[WARN] Vui lòng mô tả tool cần tạo trước khi gửi sang Gemini.');
      return;
    }
    const pref = (langEl?.value || 'auto') as 'auto' | 'powershell' | 'python';
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.textContent = 'Gemini Đang Viết & Test Sandbox...';
    }
    setToolForgePipelineLog('');
    try {
      const draft = await forgeNewToolFromRequest(reqText, pref, (line) => {
        appendToolForgePipelineLog(line);
      });
      setLatestToolForgeDraft(draft);
      renderToolForgeDraft(draft);
      syncHitboxToRust(true);
    } catch (err) {
      appendToolForgePipelineLog(`[ERR] ${String(err)}`);
    } finally {
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.textContent = 'Nhờ Gemini Viết & Kiểm Nghiệm Sandbox';
      }
    }
  });

  document.getElementById('btn-tf-run-sandbox')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-tf-run-sandbox') as HTMLButtonElement | null;
    const draft = syncDraftInputsToObj();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang chạy...';
    }
    appendToolForgePipelineLog('[SANDBOX] Bắt đầu kiểm nghiệm cô lập trên máy...');
    try {
      const tested = await runDraftInSandbox(draft);
      renderToolForgeDraft(tested);
      appendToolForgePipelineLog(
        tested.sandbox?.verified
          ? `[SANDBOX PASS] Kiểm chứng đạt (${tested.sandbox.duration_ms}ms, hash=${tested.sandbox.code_hash}).`
          : `[SANDBOX FAIL] ${tested.sandbox?.failure_reason || 'Chưa đạt kiểm chứng.'}`
      );
    } catch (err) {
      appendToolForgePipelineLog(`[SANDBOX ERR] ${String(err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Chạy Sandbox';
      }
    }
  });

  document.getElementById('btn-tf-self-heal')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-tf-self-heal') as HTMLButtonElement | null;
    const draft = syncDraftInputsToObj();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Gemini Đang Vá...';
    }
    try {
      const healed = await selfHealDraftWithGemini(draft, (line) => {
        appendToolForgePipelineLog(line);
      });
      renderToolForgeDraft(healed);
    } catch (err) {
      appendToolForgePipelineLog(`[SELF-HEAL ERR] ${String(err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Tự Vá (Gemini)';
      }
    }
  });

  document.getElementById('btn-tf-confirm-save')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-tf-confirm-save') as HTMLButtonElement | null;
    const draft = syncDraftInputsToObj();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang đóng gói...';
    }
    try {
      const saved = await confirmAndSaveToolDraft(draft);
      appendToolForgePipelineLog(
        `[PACKAGED] Đã đóng gói & lưu skill "${saved.name}" (id=${saved.id}, v${saved.version}) vào SQLite + data/skills/${saved.id}/!`
      );
      speakMessage(
        `[SKILL SAVED] Đã xác nhận & lưu skill "${saved.name}"! Lần sau bạn chỉ cần nhắn dùng (vd "Port 3000 đang bị kẹt, dọn giúp") là Local LLM sẽ gọi ngay tool này.`
      );
      setToolForgeTab('skills');
      renderToolForgeSkillsList();
    } catch (err) {
      appendToolForgePipelineLog(`[GATE BLOCKED] ${String(err)}`);
      renderToolForgeDraft(draft);
    } finally {
      if (btn) {
        btn.textContent = 'Xác Nhận & Đóng Gói Skill';
      }
    }
  });

  if (selectActiveWin) {
    selectActiveWin.addEventListener('change', () => {
      const hwnd = Number(selectActiveWin.value);
      if (hwnd > 0) {
        appState.activeWindowHwnd = hwnd;
        const win = appState.openWindows.find((w) => w.hwnd === hwnd);
        if (win && winTargetName) {
          winTargetName.textContent = win.title;
        }
      } else {
        appState.activeWindowHwnd = null;
      }
    });
  }

  btnWinPushL.addEventListener('click', () => {
    startPhysicalPush(-1);
  });
  btnWinPushR.addEventListener('click', () => {
    startPhysicalPush(1);
  });
  btnWinShrink.addEventListener('click', () => {
    startPhysicalResize('shrink');
  });
  btnWinExpand.addEventListener('click', () => {
    startPhysicalResize('expand');
  });
  btnWinMin.addEventListener('click', () => {
    void performWindowAction('minimize');
  });
  btnWinSplit?.addEventListener('click', () => {
    void arrangeDesktopWindows('split_2');
  });
  btnWinGrid?.addEventListener('click', () => {
    void arrangeDesktopWindows('grid');
  });
  btnWinCascade?.addEventListener('click', () => {
    void arrangeDesktopWindows('cascade');
  });
  btnWinCenter?.addEventListener('click', () => {
    void arrangeDesktopWindows('center');
  });

  if (btnIconRefresh) {
    btnIconRefresh.addEventListener('click', () => {
      void refreshDesktopIconsSelect();
      speakMessage('[ICON DESKTOP] Đã quét lại danh sách ứng dụng ngoài màn hình Desktop!');
    });
  }
  if (btnIconDrag) {
    btnIconDrag.addEventListener('click', () => {
      const iconName = selectDesktopIcon?.value || '';
      void startDragDesktopIcon(iconName);
    });
  }
  if (btnIconCircle) {
    btnIconCircle.addEventListener('click', () => {
      void arrangeDesktopIcons('circle');
    });
  }
  if (btnIconGrid) {
    btnIconGrid.addEventListener('click', () => {
      void arrangeDesktopIcons('grid');
    });
  }
  if (btnIconRestore) {
    btnIconRestore.addEventListener('click', () => {
      void arrangeDesktopIcons('restore');
    });
  }

  btnLoadVrm?.addEventListener('click', () => fileInput?.click());
  btnStudioFile?.addEventListener('click', () => fileInput?.click());

  if (colorDuckBody) {
    colorDuckBody.value = appState.duckBodyColor;
    colorDuckBody.addEventListener('input', () => {
      appState.duckBodyColor = colorDuckBody.value;
      if (appState.builtinModelType === 'microduck' && !appState.currentVrm && !appState.currentGlbScene) {
        createMicroDuckCharacter();
      }
    });
    colorDuckBody.addEventListener('change', () => {
      appState.duckBodyColor = colorDuckBody.value;
      void saveStudioConfigToSqlite();
    });
  }

  if (colorDuckAccent) {
    colorDuckAccent.value = appState.duckAccentColor;
    colorDuckAccent.addEventListener('input', () => {
      appState.duckAccentColor = colorDuckAccent.value;
      if (appState.builtinModelType === 'microduck' && !appState.currentVrm && !appState.currentGlbScene) {
        createMicroDuckCharacter();
      }
    });
    colorDuckAccent.addEventListener('change', () => {
      appState.duckAccentColor = colorDuckAccent.value;
      void saveStudioConfigToSqlite();
    });
  }

  presetAlicia.addEventListener('click', () => {
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('custom_vrm', PRESET_ALICIA_URL);
    void loadVrmFromUrl(PRESET_ALICIA_URL, 'Alicia Solid (.VRM)');
  });

  presetVrm1.addEventListener('click', () => {
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('custom_vrm', PRESET_VRM1_URL);
    void loadVrmFromUrl(PRESET_VRM1_URL, 'Avatar Sample A (.VRM 1.0)');
  });

  presetBuiltin.addEventListener('click', async () => {
    await clearCachedVrm();
    createDetailedAnimeCharacter();
    btnActDuck.textContent = 'Đổi Vịt BDX';
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('idol', '');
    spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    speakMessage('Đã chuyển về Cyber Idol 3D mặc định!');
  });

  presetMicroduck.addEventListener('click', async () => {
    await clearCachedVrm();
    createMicroDuckCharacter();
    btnActDuck.textContent = 'Đổi Cyber Idol';
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('microduck', '');
    spawnParticles(appState.posX, appState.posY - 90, 14, 0x76b900);
    speakMessage('Quạc quạc! Đã kích hoạt NVIDIA MicroDuck (BDX Droid 3D)!');
  });

  btnLoadUrl.addEventListener('click', () => {
    const url = vrmUrlInput.value.trim();
    if (!url) return;
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('custom_vrm', url);
    void loadVrmFromUrl(url, 'Custom URL 3D Model');
  });

  sliderScale.addEventListener('input', () => {
    appState.modelScale = parseFloat(sliderScale.value);
    valScale.textContent = `${appState.modelScale.toFixed(2)}x`;
    if (rigRoot && !appState.currentVrm && !appState.currentGlbScene) {
      rigRoot.scale.setScalar(appState.modelScale);
    }
    if (appState.currentVrm) {
      applyVrmScaleAndOffset(appState.currentVrm);
    }
    if (appState.currentGlbScene) {
      applyGlbScaleAndOffset(appState.currentGlbScene);
    }
  });
  sliderScale.addEventListener('change', () => {
    void saveStudioConfigToSqlite();
  });

  sliderGravity.addEventListener('input', () => {
    appState.gravity = parseFloat(sliderGravity.value);
    valGravity.textContent = appState.gravity.toFixed(2);
  });
  sliderGravity.addEventListener('change', () => {
    void saveStudioConfigToSqlite();
  });

  sliderBounce.addEventListener('input', () => {
    appState.bounceFactor = parseFloat(sliderBounce.value);
    valBounce.textContent = appState.bounceFactor.toFixed(2);
  });
  sliderBounce.addEventListener('change', () => {
    void saveStudioConfigToSqlite();
  });

  chkAutoroam.addEventListener('change', () => {
    appState.autoRoamEnabled = chkAutoroam.checked;
    syncAutoBehaviorUiState();
    void saveStudioConfigToSqlite();
  });

  renderAutoBehaviorToggles();
  syncAutoBehaviorUiState();

  const applyAutoIntervalSec = (rawSec: number) => {
    const cleanSec = Math.max(5, Math.min(300, Math.round(Number.isFinite(rawSec) ? rawSec : 15)));
    appState.autoActionIntervalSec = cleanSec;
    appState.nextRoamDuration = cleanSec;
    appState.stateTimer = 0;
    localStorage.setItem('mate_auto_action_interval_sec', String(cleanSec));
    syncAutoBehaviorUiState();
    void saveStudioConfigToSqlite();
  };

  inputAutoActionSec?.addEventListener('change', () => {
    applyAutoIntervalSec(Number(inputAutoActionSec.value));
  });

  document.querySelectorAll('.auto-sec-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = Number(btn.getAttribute('data-sec'));
      applyAutoIntervalSec(sec);
    });
  });

  const applyAutoBehaviorsBulk = (mode: 'all' | 'default' | 'none') => {
    if (mode === 'default') {
      appState.autoBehaviors = createDefaultAutoBehaviors();
    } else {
      const nextVal = mode === 'all';
      for (const item of AUTO_BEHAVIOR_CATALOG) {
        appState.autoBehaviors[item.key] = nextVal;
      }
    }
    localStorage.setItem('mate_auto_behaviors_json', JSON.stringify(appState.autoBehaviors));
    syncAutoBehaviorUiState();
    void saveStudioConfigToSqlite();
  };

  btnAutoBehAll?.addEventListener('click', () => applyAutoBehaviorsBulk('all'));
  btnAutoBehDefault?.addEventListener('click', () => applyAutoBehaviorsBulk('default'));
  btnAutoBehNone?.addEventListener('click', () => applyAutoBehaviorsBulk('none'));

  chkLookat.addEventListener('change', () => {
    appState.lookAtEnabled = chkLookat.checked;
    void saveStudioConfigToSqlite();
  });

  chkWinInteract.addEventListener('change', () => {
    appState.windowInteractEnabled = chkWinInteract.checked;
    void saveStudioConfigToSqlite();
  });

  chkSoundFx.addEventListener('change', () => {
    setSoundEnabled(chkSoundFx.checked);
    void saveStudioConfigToSqlite();
  });

  sliderSoundVolume.addEventListener('input', () => {
    const vol = parseFloat(sliderSoundVolume.value);
    setSoundVolume(vol);
    if (valSoundVolume) valSoundVolume.textContent = `${Math.round(vol * 100)}%`;
  });
  sliderSoundVolume.addEventListener('change', () => {
    void saveStudioConfigToSqlite();
  });

  inputOllamaModel.value = ollamaModel;
  inputGeminiKey.value = geminiApiKey;
  inputGeminiModel.value = geminiModel;
  selectLlmRoute.value = llmRouteMode;
  chkAutocheck.checked = autoCheckEnabled;
  inputAlertCpu.value = String(cpuAlertPct);
  inputAlertRam.value = String(ramAlertGb);

  inputOllamaModel.addEventListener('change', () => {
    setOllamaModel(inputOllamaModel.value);
    void saveStudioConfigToSqlite();
  });

  inputGeminiKey.addEventListener('change', () => {
    setGeminiApiKey(inputGeminiKey.value);
    void saveStudioConfigToSqlite();
  });

  inputGeminiModel.addEventListener('change', () => {
    setGeminiModel(inputGeminiModel.value);
    void saveStudioConfigToSqlite();
  });

  selectLlmRoute.addEventListener('change', () => {
    setLlmRouteMode(selectLlmRoute.value as LlmRouteMode);
    void saveStudioConfigToSqlite();
  });

  chkAutocheck.addEventListener('change', () => {
    setAutoCheckEnabled(chkAutocheck.checked);
    void saveStudioConfigToSqlite();
  });

  inputAlertCpu.addEventListener('change', () => {
    const val = parseFloat(inputAlertCpu.value);
    if (!Number.isNaN(val)) {
      setCpuAlertPct(val, true);
      void saveStudioConfigToSqlite();
    }
  });

  inputAlertRam.addEventListener('change', () => {
    const val = parseFloat(inputAlertRam.value);
    if (!Number.isNaN(val)) {
      setRamAlertGb(val, true);
      void saveStudioConfigToSqlite();
    }
  });

  const switchStudioTab = (tab: 'system' | 'avatar' | 'physics' | 'llm') => {
    if (tabBtnStudioSystem) tabBtnStudioSystem.classList.toggle('active', tab === 'system');
    if (tabBtnStudioAvatar) tabBtnStudioAvatar.classList.toggle('active', tab === 'avatar');
    if (tabBtnStudioPhysics) tabBtnStudioPhysics.classList.toggle('active', tab === 'physics');
    if (tabBtnStudioLlm) tabBtnStudioLlm.classList.toggle('active', tab === 'llm');
    if (studioTabSystem) studioTabSystem.style.display = tab === 'system' ? 'block' : 'none';
    if (studioTabAvatar) studioTabAvatar.style.display = tab === 'avatar' ? 'block' : 'none';
    if (studioTabPhysics) studioTabPhysics.style.display = tab === 'physics' ? 'block' : 'none';
    if (studioTabLlm) studioTabLlm.style.display = tab === 'llm' ? 'block' : 'none';
    if (tab === 'llm') {
      void refreshStudioLlmUi();
    } else if (tab === 'system') {
      updateStudioWeatherPreviewUi();
    }
  };
  tabBtnStudioSystem?.addEventListener('click', () => switchStudioTab('system'));
  tabBtnStudioAvatar?.addEventListener('click', () => switchStudioTab('avatar'));
  tabBtnStudioPhysics?.addEventListener('click', () => switchStudioTab('physics'));
  tabBtnStudioLlm?.addEventListener('click', () => switchStudioTab('llm'));

  btnScanOllamaModels?.addEventListener('click', () => {
    void refreshStudioLlmUi();
  });

  btnToggleGeminiKey?.addEventListener('click', () => {
    if (!inputGeminiKey) return;
    const isPass = inputGeminiKey.type === 'password';
    inputGeminiKey.type = isPass ? 'text' : 'password';
    btnToggleGeminiKey.textContent = isPass ? 'Ẩn Key' : 'Hiện Key';
  });

  document.querySelectorAll('.gemini-preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const m = chip.getAttribute('data-model');
      if (m && inputGeminiModel) {
        inputGeminiModel.value = m;
        setGeminiModel(m);
        void saveStudioConfigToSqlite();
        void refreshStudioLlmUi();
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (appState.isOcrSnipMode) finishSnipOverlayReset();
      else if (appState.isTarotModalOpen) toggleTarotModal(false);
      else if (appState.isToolForgeOpen) toggleToolForgeModal(false);
      else if (appState.isOcrModalOpen) toggleOcrTranslateModal(false);
      else if (appState.isPcControlOpen) togglePcControlModal(false);
      else if (appState.isP2pArenaOpen) toggleP2pArenaModal(false);
      else if (appState.isNotificationManagerOpen) toggleNotificationModal(false);
      else if (appState.isLongMemoryOpen) toggleLongMemoryModal(false);
      else if (appState.isStudioOpen) toggleStudioModal(false);
      else if (appState.isMiniScreenOpen) toggleMiniScreenPanel(false);
    }
  });

  let chatBlurTimer: number | null = null;
  btnSendMsg.addEventListener('click', handleSendMessage);
  bubbleInput.addEventListener('focus', () => {
    if (chatBlurTimer !== null) {
      window.clearTimeout(chatBlurTimer);
      chatBlurTimer = null;
    }
    appState.isChatting = true;
  });
  bubbleInput.addEventListener('input', () => {
    if (chatBlurTimer !== null) {
      window.clearTimeout(chatBlurTimer);
      chatBlurTimer = null;
    }
    appState.isChatting = true;
  });
  bubbleInput.addEventListener('blur', () => {
    if (chatBlurTimer !== null) {
      window.clearTimeout(chatBlurTimer);
    }
    chatBlurTimer = window.setTimeout(() => {
      if (document.activeElement !== bubbleInput && !isAssistantBusy()) {
        appState.isChatting = false;
      }
    }, 10000);
  });
  bubbleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });

  if (btnOpenNotif) {
    btnOpenNotif.addEventListener('click', () => toggleNotificationModal());
  }
  if (btnCloseNotif) {
    btnCloseNotif.addEventListener('click', () => toggleNotificationModal(false));
  }

  const switchNotifTab = (activeTab: 'win' | 'web' | 'hist') => {
    if (tabBtnWinNotif) tabBtnWinNotif.classList.toggle('active', activeTab === 'win');
    if (tabBtnWebNotif) tabBtnWebNotif.classList.toggle('active', activeTab === 'web');
    if (tabBtnHistNotif) tabBtnHistNotif.classList.toggle('active', activeTab === 'hist');
    if (tabContentWinNotif) tabContentWinNotif.style.display = activeTab === 'win' ? 'block' : 'none';
    if (tabContentWebNotif) tabContentWebNotif.style.display = activeTab === 'web' ? 'block' : 'none';
    if (tabContentHistNotif) tabContentHistNotif.style.display = activeTab === 'hist' ? 'block' : 'none';
    if (activeTab === 'hist') {
      void renderNotificationHistoryList();
    }
  };

  if (tabBtnWinNotif) tabBtnWinNotif.addEventListener('click', () => switchNotifTab('win'));
  if (tabBtnWebNotif) tabBtnWebNotif.addEventListener('click', () => switchNotifTab('web'));
  if (tabBtnHistNotif) tabBtnHistNotif.addEventListener('click', () => switchNotifTab('hist'));

  if (notifMasterToggle) {
    notifMasterToggle.addEventListener('change', () => {
      if (currentNotifSettings) {
        currentNotifSettings.master_enabled = notifMasterToggle.checked;
        void updateNotificationSettings(currentNotifSettings);
      }
    });
  }
  if (notifTtsToggle) {
    notifTtsToggle.addEventListener('change', () => {
      if (currentNotifSettings) {
        currentNotifSettings.speech_tts_enabled = notifTtsToggle.checked;
        void updateNotificationSettings(currentNotifSettings);
      }
    });
  }
  if (notifReactToggle) {
    notifReactToggle.addEventListener('change', () => {
      if (currentNotifSettings) {
        currentNotifSettings.character_alert_enabled = notifReactToggle.checked;
        void updateNotificationSettings(currentNotifSettings);
      }
    });
  }

  const knownAppExeMap: Record<string, string> = {
    zalo: 'Zalo.exe',
    'google chrome': 'chrome.exe',
    'visual studio code': 'Code.exe',
    antigravity: 'antigravity.exe',
    'cursor ide': 'cursor.exe',
    telegram: 'Telegram.exe',
    discord: 'Discord.exe',
    slack: 'slack.exe',
    'microsoft outlook': 'OUTLOOK.EXE',
    'microsoft teams': 'Teams.exe',
    'microsoft edge': 'msedge.exe',
    spotify: 'Spotify.exe',
  };

  if (btnScanWinApps) {
    btnScanWinApps.addEventListener('click', async () => {
      btnScanWinApps.textContent = 'Đang quét...';
      const activeApps = await scanRunningWindowsApps();
      btnScanWinApps.textContent = 'Quét App đang mở';
      if (!currentNotifSettings) {
        currentNotifSettings = await fetchNotificationSettings();
      }
      if (currentNotifSettings && activeApps.length > 0) {
        let addedCount = 0;
        activeApps.forEach((appName) => {
          if (!currentNotifSettings!.windows_apps.some((a) => a.name.toLowerCase() === appName.toLowerCase())) {
            const mappedId = knownAppExeMap[appName.toLowerCase()] || `${appName}.exe`;
            currentNotifSettings!.windows_apps.push({
              app_id: mappedId,
              name: appName,
              enabled: true,
              speech_alert: true,
            });
            addedCount++;
          }
        });
        if (addedCount > 0) {
          await updateNotificationSettings(currentNotifSettings);
          renderWindowsAppsList();
          speakMessage(`[NOTIF] Đã phát hiện và lưu ${addedCount} ứng dụng đang mở vào SQLite!`);
        } else {
          speakMessage('[NOTIF] Toàn bộ ứng dụng đang mở đã có trong cấu hình SQLite!');
        }
      }
    });
  }

  if (btnAddWinApp) {
    btnAddWinApp.addEventListener('click', async () => {
      const name = inputNewWinApp.value.trim();
      if (!name || !currentNotifSettings) return;
      inputNewWinApp.value = '';
      const mappedId = knownAppExeMap[name.toLowerCase()] || (name.includes('.') ? name : `${name}.exe`);
      currentNotifSettings.windows_apps.push({
        app_id: mappedId,
        name,
        enabled: true,
        speech_alert: true,
      });
      await updateNotificationSettings(currentNotifSettings);
      renderWindowsAppsList();
      speakMessage(`[NOTIF] Đã thêm ứng dụng "${name}" vào SQLite!`);
    });
  }

  if (btnTestWinNotif) {
    btnTestWinNotif.addEventListener('click', async () => {
      if (!currentNotifSettings) {
        currentNotifSettings = await fetchNotificationSettings();
      }
      const zaloEnabled = currentNotifSettings.windows_apps.find(
        (a) => a.enabled && a.name.toLowerCase() === 'zalo'
      );
      const firstEnabled =
        zaloEnabled || currentNotifSettings.windows_apps.find((a) => a.enabled);
      const targetApp = firstEnabled ? firstEnabled.name : 'Zalo';
      await triggerTestNotification('windows', targetApp);
    });
  }

  if (btnAddWebOrigin) {
    btnAddWebOrigin.addEventListener('click', async () => {
      const origin = inputNewWebOrigin.value.trim();
      if (!origin || !currentNotifSettings) return;
      inputNewWebOrigin.value = '';
      currentNotifSettings.web_origins.push({
        origin,
        name: origin,
        enabled: true,
        speech_alert: true,
      });
      await updateNotificationSettings(currentNotifSettings);
      renderWebOriginsList();
      speakMessage(`[NOTIF] Đã thêm Web domain "${origin}" vào danh sách theo dõi!`);
    });
  }

  if (btnTestWebNotif) {
    btnTestWebNotif.addEventListener('click', async () => {
      await triggerTestNotification('web', 'github.com');
    });
  }

  if (btnCopyWebhookUrl) {
    btnCopyWebhookUrl.addEventListener('click', () => {
      navigator.clipboard.writeText('http://127.0.0.1:39281/notify');
      btnCopyWebhookUrl.textContent = 'Copied!';
      setTimeout(() => (btnCopyWebhookUrl.textContent = 'Copy URL'), 1500);
    });
  }

  if (btnCopyCurlCmd) {
    btnCopyCurlCmd.addEventListener('click', () => {
      const curlCmd = `curl -X POST http://127.0.0.1:39281/notify -H "Content-Type: application/json" -d "{\\"source\\":\\"web\\",\\"app_or_origin\\":\\"github.com\\",\\"title\\":\\"Build Succeeded\\",\\"body\\":\\"All tests passed successfully\\"}"`;
      navigator.clipboard.writeText(curlCmd);
      btnCopyCurlCmd.textContent = 'Copied!';
      setTimeout(() => (btnCopyCurlCmd.textContent = 'Copy cURL'), 1500);
    });
  }

  if (btnClearNotifHistory) {
    btnClearNotifHistory.addEventListener('click', async () => {
      await clearNotificationHistory();
      await renderNotificationHistoryList();
      speakMessage('[NOTIF] Đã xóa sạch toàn bộ lịch sử thông báo.');
    });
  }

  // Hệ thống Đấu Trường P2P PK, Handshake Đồng Thuận, Nhảy Chéo Màn Hình & Điều Khiển Từ Xa 60s
  dockBtnP2p?.addEventListener('click', () => toggleP2pArenaModal());
  btnCloseP2p?.addEventListener('click', () => toggleP2pArenaModal(false));

  // Hệ thống Tarot & Tử Vi 6 Giờ (nút ngoài cùng cạnh nút PK)
  dockBtnTarot?.addEventListener('click', () => toggleTarotModal());
  document.getElementById('btn-close-tarot')?.addEventListener('click', () => toggleTarotModal(false));
  document.getElementById('tab-btn-tarot-today')?.addEventListener('click', () => setTarotTab('today'));
  document.getElementById('tab-btn-tarot-history')?.addEventListener('click', () => {
    setTarotTab('history');
    void refreshTarotStatusUi();
  });
  document.querySelectorAll('.tarot-pick-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      void performTarotDrawAndFlip();
    });
  });
  document.getElementById('btn-tarot-draw-now')?.addEventListener('click', () => {
    void performTarotDrawAndFlip();
  });
  document.getElementById('btn-tarot-replay-3d')?.addEventListener('click', () => {
    const rec = cachedTarotStatus?.current_reading;
    if (rec) {
      applyTarotReadingToModal(rec, true);
      triggerDuckReactionForTarot(rec);
    }
  });
  document.getElementById('btn-tarot-ai-deep')?.addEventListener('click', async () => {
    const rec = cachedTarotStatus?.current_reading;
    if (!rec) return;
    const btn = document.getElementById('btn-tarot-ai-deep') as HTMLButtonElement | null;
    const aiBox = document.getElementById('tarot-ai-box');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang luận giải Tử Vi x Tarot...';
    }
    const orientStr = rec.is_reversed ? 'Ngược Chiều (Reversed)' : 'Thuận Chiều (Upright)';
    const prompt = `Bạn là bậc thầy Tarot kết hợp Tử Vi Đông Phương. Hãy luận giải ngắn gọn, sắc sảo (4 gạch đầu dòng súc tích bằng tiếng Việt, KHÔNG dùng emoji) cho quẻ hiện tại:
- Lá bài Tarot: ${rec.card_name_vi} (${rec.card_name}) - ${orientStr}
- Ý nghĩa gốc: ${rec.meaning_en || rec.summary_vi}
- Kết quả phân định: ${rec.fortune_label} (${rec.luck_score}/100)
- Tử Vi: ${rec.can_chi_day}, Hành ${rec.ngu_hanh}, Màu hợp mệnh: ${rec.lucky_color}
Hãy đưa ra: (1) Tổng vận 6 giờ tới, (2) Việc nên làm ngay, (3) Điều cần tránh/hóa giải, (4) Một câu nhắn tích cực.`;

    try {
      let aiReply = '';
      try {
        aiReply = await invoke<string>('ask_gemini', {
          apiKey: geminiApiKey || '',
          model: geminiModel,
          systemPrompt: 'Trả lời tiếng Việt tự nhiên, thực tế, không emoji, đúng 4 gạch đầu dòng.',
          messages: [{ role: 'user', content: prompt }],
          jsonMode: false,
        });
      } catch {
        aiReply = await invoke<string>('ask_ollama', {
          model: ollamaModel,
          messages: [
            { role: 'system', content: 'Trả lời tiếng Việt ngắn gọn, không emoji.' },
            { role: 'user', content: prompt },
          ],
        });
      }

      const cleaned = aiReply.trim();
      if (cleaned) {
        rec.ai_deep_reading = cleaned;
        await invoke('tarot_save_ai_reading', { id: rec.id, aiReading: cleaned }).catch(() => { });
        if (aiBox) {
          aiBox.style.display = 'block';
          aiBox.textContent = `[LUẬN GIẢI SÂU AI]\n${cleaned}`;
        }
        syncHitboxToRust(true);
      }
    } catch (err) {
      if (aiBox) {
        aiBox.style.display = 'block';
        aiBox.textContent = `[AI LUẬN GIẢI LỖI] Chưa kết nối được Gemini hoặc Ollama Local: ${String(err)}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Luận Giải Sâu AI (Tử Vi x Tarot)';
      }
    }
  });

  void refreshTarotStatusUi();
  setInterval(() => {
    updateTarotCooldownCountdown();
  }, 1000);
  document.getElementById('btn-minimize-p2p')?.addEventListener('click', () => toggleP2pArenaModal(false));
  document.getElementById('btn-p2p-expand-modal')?.addEventListener('click', () => toggleP2pArenaModal());

  document.getElementById('btn-p2p-return-pill')?.addEventListener('click', () => {
    void recallDuckFromPeer();
  });
  document.getElementById('btn-p2p-emergency-release')?.addEventListener('click', () => {
    void emergencyReleaseP2pControl();
  });
  document.getElementById('btn-p2p-consent-accept')?.addEventListener('click', () => {
    void respondP2pHandshake(true);
  });
  document.getElementById('btn-p2p-consent-reject')?.addEventListener('click', () => {
    void respondP2pHandshake(false);
  });
  document.getElementById('btn-p2p-sim-peer')?.addEventListener('click', () => {
    void startSimPeerTest();
  });
  document.getElementById('btn-p2p-regen-code')?.addEventListener('click', async () => {
    await invoke('p2p_regenerate_room').catch(() => { });
    await refreshP2pStatus();
  });
  document.getElementById('btn-p2p-copy-invite')?.addEventListener('click', (ev) => {
    const st = getP2pStatusSnapshot();
    const txt = `IP: ${st.local_ip}:${st.listen_port} | Ma Phong: ${st.room_code}`;
    void navigator.clipboard.writeText(txt).catch(() => { });
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.textContent = 'Đã Copy Mã Mời!';
    setTimeout(() => (btn.textContent = 'Copy Mã Mời'), 1600);
  });
  document.getElementById('btn-p2p-copy-mobile-url')?.addEventListener('click', (ev) => {
    const st = getP2pStatusSnapshot();
    const url = st.mobile_url || `http://${st.local_ip}:${st.listen_port}/?room=${st.room_code}`;
    void navigator.clipboard.writeText(url).catch(() => { });
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.textContent = 'Đã Copy Link!';
    setTimeout(() => (btn.textContent = 'Copy Link Mobile'), 1600);
    speakMessage(`[MOBILE WEB] Mở trình duyệt trên điện thoại (cùng Wi-Fi) và truy cập: ${url}`);
  });
  document.getElementById('btn-p2p-test-local-web')?.addEventListener('click', () => {
    const st = getP2pStatusSnapshot();
    const testUrl = `http://127.0.0.1:${st.listen_port}/?room=${st.room_code}`;
    void invoke('open_web_or_app', { target: testUrl }).catch(() => { });
    speakMessage(`[MOBILE WEB] Đang mở thử giao diện Mobile Web trên PC tại ${testUrl}`);
  });
  document.getElementById('btn-p2p-open-firewall')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const prev = btn.textContent || 'Mở Firewall LAN';
    btn.textContent = 'Đang xin UAC...';
    btn.disabled = true;
    try {
      const msg = await invoke<string>('p2p_open_firewall_port');
      speakMessage(msg);
      btn.textContent = 'Đã Mở Cổng!';
    } catch (err) {
      speakMessage(`[WARN] ${String(err)}`);
      btn.textContent = 'Chưa Mở Được';
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = prev;
      }, 2400);
    }
  });
  document.getElementById('btn-p2p-scan-lan')?.addEventListener('click', async () => {
    const lanList = document.getElementById('p2p-lan-list');
    if (!lanList) return;
    lanList.style.display = 'flex';
    lanList.innerHTML = '<div class="dash-sub">Đang quét các máy Duck AI trên mạng cục bộ...</div>';
    try {
      const peers = await invoke<LanPeerInfo[]>('p2p_scan_local_peers');
      if (!peers || peers.length === 0) {
        lanList.innerHTML =
          '<div class="dash-sub">Chưa tìm thấy máy khác đang mở cổng LAN (hãy nhập IP:Port thủ công hoặc dùng Giả Lập Máy B).</div>';
        return;
      }
      lanList.innerHTML = '';
      peers.forEach((p) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'action-btn';
        row.style.cssText = 'justify-content: space-between; display: flex; font-size: 10.5px;';
        row.textContent = `${p.name} — [Chọn]`;
        row.addEventListener('click', () => {
          const addrInp = document.getElementById('p2p-target-addr') as HTMLInputElement | null;
          if (addrInp) addrInp.value = p.addr;
        });
        lanList.appendChild(row);
      });
    } catch {
      lanList.innerHTML = '<div class="dash-sub">Lỗi quét LAN.</div>';
    }
  });
  document.getElementById('btn-p2p-connect')?.addEventListener('click', () => {
    const addr = (document.getElementById('p2p-target-addr') as HTMLInputElement | null)?.value.trim() || '';
    const code = (document.getElementById('p2p-target-code') as HTMLInputElement | null)?.value.trim() || '';
    if (!addr || !code) {
      speakMessage('[P2P] Hãy nhập đầy đủ IP:Port và Mã phòng 6 số của máy đối thủ!');
      return;
    }
    void requestP2pHandshake(addr, code);
  });
  document.getElementById('btn-p2p-disconnect')?.addEventListener('click', () => {
    void disconnectP2pRoom();
  });

  const chkAutoMig = document.getElementById('p2p-chk-automigrate') as HTMLInputElement | null;
  chkAutoMig?.addEventListener('change', () => {
    setCrossScreenAutoMigrate(chkAutoMig.checked);
  });
  document.getElementById('btn-p2p-migrate-out')?.addEventListener('click', () => {
    void migrateDuckOutToPeer();
  });
  document.getElementById('btn-p2p-recall')?.addEventListener('click', () => {
    void recallDuckFromPeer();
  });
  document.getElementById('btn-p2p-start-pk')?.addEventListener('click', () => {
    startP2pPkMatch();
  });
  document.getElementById('btn-p2p-skill-sword')?.addEventListener('click', () => {
    performP2pSkill('sword');
  });
  document.getElementById('btn-p2p-skill-laser')?.addEventListener('click', () => {
    performP2pSkill('laser');
  });
  document.getElementById('btn-p2p-skill-thunder')?.addEventListener('click', () => {
    performP2pSkill('thunder');
  });
  document.getElementById('btn-p2p-skill-shield')?.addEventListener('click', () => {
    performP2pSkill('shield');
  });

  const chkLiveMouse = document.getElementById('p2p-chk-livemouse') as HTMLInputElement | null;
  if (chkLiveMouse) {
    setLiveMouseStreamEnabled(chkLiveMouse.checked);
    chkLiveMouse.addEventListener('change', () => {
      setLiveMouseStreamEnabled(chkLiveMouse.checked);
    });
  }

  const touchpad = document.getElementById('p2p-remote-touchpad');
  const touchpadCursor = document.getElementById('p2p-touchpad-cursor');
  const calcNormCoords = (ev: MouseEvent) => {
    if (!touchpad) return { xn: 0.5, yn: 0.5 };
    const r = touchpad.getBoundingClientRect();
    const xn = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width)));
    const yn = Math.max(0, Math.min(1, (ev.clientY - r.top) / Math.max(1, r.height)));
    if (touchpadCursor) {
      touchpadCursor.style.left = `${Math.round(xn * 100)}%`;
      touchpadCursor.style.top = `${Math.round(yn * 100)}%`;
    }
    return { xn, yn };
  };
  touchpad?.addEventListener('mousemove', (ev) => {
    const { xn, yn } = calcNormCoords(ev);
    if (getP2pCombatVitals().liveMouseStreamEnabled) {
      void sendWinnerRemoteCmd('mouse_move', { xNorm: xn, yNorm: yn });
    }
  });
  touchpad?.addEventListener('click', (ev) => {
    const { xn, yn } = calcNormCoords(ev);
    void sendWinnerRemoteCmd('mouse_click', { xNorm: xn, yNorm: yn, button: 'left' });
  });
  touchpad?.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const { xn, yn } = calcNormCoords(ev);
    void sendWinnerRemoteCmd('mouse_click', { xNorm: xn, yNorm: yn, button: 'right' });
  });

  document.getElementById('btn-p2p-remote-type')?.addEventListener('click', () => {
    const inp = document.getElementById('p2p-remote-text') as HTMLInputElement | null;
    const text = inp?.value.trim() || '';
    if (!text) return;
    if (inp) inp.value = '';
    void sendWinnerRemoteCmd('type_text', { text });
  });
  document.getElementById('btn-p2p-cmd-notepad')?.addEventListener('click', () => {
    void sendWinnerRemoteCmd('open_notepad_taunt', {
      text: 'QUAC QUAC! Ban da thua tran P2P va dang bi Vit dieu khien trong 60 giay!',
    });
  });
  document.getElementById('btn-p2p-cmd-jitter')?.addEventListener('click', () => {
    void sendWinnerRemoteCmd('jitter_mouse');
  });
  document.getElementById('btn-p2p-cmd-minimize')?.addEventListener('click', () => {
    void sendWinnerRemoteCmd('minimize_all');
  });
  document.getElementById('btn-p2p-cmd-block')?.addEventListener('click', () => {
    void sendWinnerRemoteCmd('block_input', { durationSec: 8 });
  });

  registerP2pCallbacks(speakMessage, showSuggestionButtons, renderP2pArenaUi, (open) => {
    toggleP2pArenaModal(open);
  });
  void initP2pArena();

  const bindP2pHoldBtn = (id: string, onDown: () => void, onUp: () => void) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('is-active');
      onDown();
    });
    const release = () => {
      el.classList.remove('is-active');
      onUp();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
  };

  bindP2pHoldBtn('btn-p2p-ctrl-left', () => triggerP2pMove('left'), () => triggerP2pMove('stop'));
  bindP2pHoldBtn('btn-p2p-ctrl-right', () => triggerP2pMove('right'), () => triggerP2pMove('stop'));
  bindP2pHoldBtn('btn-p2p-ctrl-rocket', () => triggerP2pMove('rocket_up'), () => triggerP2pMove('rocket_stop'));
  bindP2pHoldBtn('btn-p2p-ctrl-shield', () => setP2pBulletShield(true), () => setP2pBulletShield(false));

  document.getElementById('btn-p2p-ctrl-jump')?.addEventListener('click', () => triggerP2pMove('jump'));
  document.getElementById('btn-p2p-ctrl-slide')?.addEventListener('click', () => triggerP2pMove('dash'));
  document.getElementById('btn-p2p-ctrl-bh')?.addEventListener('click', () => triggerP2pBlackHoleHide());
  document.getElementById('btn-p2p-ctrl-sword')?.addEventListener('click', () => performP2pSkill('sword'));
  document.getElementById('btn-p2p-ctrl-shoot')?.addEventListener('click', () => performP2pSkill('laser'));
  document.getElementById('btn-p2p-ctrl-thunder')?.addEventListener('click', () => performP2pSkill('thunder'));

  window.addEventListener('keydown', (e) => {
    if (!isP2pCombatControlsActive()) return;
    const activeEl = document.activeElement as HTMLElement | null;
    const tag = activeEl?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl?.isContentEditable) {
      return;
    }

    const low = e.key.toLowerCase();
    if (e.key === 'Control') {
      e.preventDefault();
      setP2pBulletShield(true);
      return;
    }
    if (e.shiftKey && (e.key === 'ArrowUp' || low === 'w')) {
      e.preventDefault();
      triggerP2pMove('rocket_up');
      return;
    }
    if (!e.shiftKey && (e.key === 'ArrowUp' || low === 'w' || e.code === 'Space')) {
      e.preventDefault();
      if (!e.repeat) triggerP2pMove('jump');
      return;
    }
    if (e.key === 'ArrowDown' || low === 's') {
      e.preventDefault();
      if (!e.repeat) triggerP2pMove('drop_down');
      return;
    }
    if (e.shiftKey && (e.key === 'ArrowLeft' || low === 'a')) {
      e.preventDefault();
      if (!e.repeat) triggerP2pMove('slide_left');
      return;
    }
    if (e.shiftKey && (e.key === 'ArrowRight' || low === 'd')) {
      e.preventDefault();
      if (!e.repeat) triggerP2pMove('slide_right');
      return;
    }
    if (e.key === 'ArrowLeft' || low === 'a') {
      e.preventDefault();
      triggerP2pMove('left');
      return;
    }
    if (e.key === 'ArrowRight' || low === 'd') {
      e.preventDefault();
      triggerP2pMove('right');
      return;
    }
    if (low === 'b') {
      e.preventDefault();
      if (!e.repeat) triggerP2pBlackHoleHide();
      return;
    }
    if (!e.repeat) {
      if (e.key === '1') performP2pSkill('sword');
      else if (e.key === '2') performP2pSkill('laser');
      else if (e.key === '3') performP2pSkill('thunder');
      else if (e.key === '4') performP2pSkill('shield');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!isP2pCombatControlsActive()) return;
    const low = e.key.toLowerCase();
    if (e.key === 'Control') {
      setP2pBulletShield(false);
    }
    if (e.key === 'Shift' || e.key === 'ArrowUp' || low === 'w') {
      triggerP2pMove('rocket_stop');
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || low === 'a' || low === 'd') {
      triggerP2pMove('stop');
    }
  });

  window.addEventListener('blur', () => {
    if (!isP2pCombatControlsActive()) return;
    triggerP2pMove('stop');
    triggerP2pMove('rocket_stop');
    setP2pBulletShield(false);
  });

  // Nút nạp PDF/CSV/Excel/Ảnh trực tiếp & Dashboard phân tích file
  const anyFileInput = document.getElementById('any-file-input') as HTMLInputElement | null;
  const btnFeedFileBtn = document.getElementById('btn-feed-file-btn') as HTMLButtonElement | null;
  btnFeedFileBtn?.addEventListener('click', () => {
    setFileDragHoverMode(true, 'Đang chờ bạn chọn tệp...');
    anyFileInput?.click();
  });
  window.addEventListener('focus', () => {
    if (appState.isFileDragHovering && anyFileInput && !anyFileInput.files?.length) {
      setTimeout(() => {
        if (appState.isFileDragHovering) setFileDragHoverMode(false);
      }, 280);
    }
  });
  anyFileInput?.addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    setFileDragHoverMode(false);
    if (f) {
      void handleDroppedAnyFile(f);
      anyFileInput.value = '';
    }
  });

  document.getElementById('btn-fd-close')?.addEventListener('click', closeFileAnalyticsDashboard);
  document.getElementById('btn-fd-close-footer')?.addEventListener('click', closeFileAnalyticsDashboard);
  document.getElementById('btn-fd-summarize')?.addEventListener('click', () => {
    if (activeDashboardAnalysis) {
      void summarizeLastIngestedFile(activeDashboardAnalysis);
    }
  });
  document.getElementById('btn-fd-copy')?.addEventListener('click', () => {
    if (activeDashboardAnalysis) {
      const report = `${activeDashboardAnalysis.quick_overview}\n\n${activeDashboardAnalysis.raw_excerpt.slice(0, 1200)}`;
      void invoke<string>('set_clipboard_text', { text: report })
        .then((m) => speakMessage(`[CLIPBOARD] ${m}`))
        .catch(() => { });
    }
  });

  // Nạp cấu hình Notification & Studio 3D Avatar từ SQLite ngay lúc khởi động
  void fetchNotificationSettings().then((s) => {
    currentNotifSettings = s;
  });
  void loadStudioConfigFromSqlite();

  // Khởi động lắng nghe app notifications từ Rust backend
  void listenToDesktopNotifications((item, speechAlert) => {
    if (appState.isNotificationManagerOpen) {
      void renderNotificationHistoryList();
    }
    if (item.app_or_origin === 'Lịch hẹn Duck AI') {
      return;
    }
    if (currentNotifSettings?.character_alert_enabled ?? true) {
      appState.setState('ALERT');
      spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    }
    const sourceTag =
      item.source === 'windows' || item.source === 'app' ? 'APP' : item.source.toUpperCase();
    if (speechAlert) {
      speakMessage(`[${sourceTag} - ${item.app_or_origin}] ${item.title}: ${item.body}`);
    } else {
      speakMessage(`[${sourceTag} - ${item.app_or_origin}] ${item.title}`);
    }
  });

  // Nạp danh sách Ghi chú & Lịch hẹn từ SQLite + kiểm tra chuông nhắc lịch mỗi 10 giây
  void loadScheduledNotesFromSqlite(true);
  setInterval(() => {
    checkScheduledNotesTick();
  }, 10_000);

  // Lắng nghe Global Hotkeys từ Rust (Alt+Q gọi nhanh khung chat + giải phóng khẩn cấp Remote Control, Alt+W nấp mép màn hình)
  void listen<string>('desktop-mate://global-hotkey', (event) => {
    const cmd = event.payload;
    if (cmd === 'summon_chat') {
      void emergencyReleaseP2pControl();
      void invoke('mini_screen_restore_all_stealth').catch(() => {});
      if (appState.isEdgePeekMode) {
        toggleEdgePeekMode(false);
      }
      toggleBubbleVisibility(true);
      appState.isChatting = true;
      updateUiPosition();
      syncHitboxToRust(true);
      setTimeout(() => bubbleInput?.focus(), 40);
    } else if (cmd === 'toggle_edge_peek') {
      toggleEdgePeekMode();
    }
  });

  // Tự động định kỳ cập nhật số đo hiệu năng của App khi mở bảng Dashboard
  setInterval(() => {
    if (appState.isLeftPanelOpen) {
      void runCheckAppMetrics(false);
    }
  }, 2500);

  // Đồng bộ vị trí UI & quét danh sách Icon Desktop lúc khởi tạo
  uiFollowX = appState.posX;
  uiFollowY = appState.posY;
  updateUiPosition();
  setTimeout(() => {
    void refreshDesktopIconsSelect();
  }, 1800);
}

let lastUiMetaSyncAt = 0;

function setPosIfChanged(el: HTMLElement | null | undefined, leftPx: number, topPx: number) {
  if (!el) return;
  const rx = Math.round(leftPx);
  const ry = Math.round(topPx);
  const sig = `${rx},${ry}`;
  if (el.dataset.lastPos === sig) return;
  el.dataset.lastPos = sig;
  el.style.left = `${rx}px`;
  el.style.top = `${ry}px`;
}

export function updateUiPosition(fromAnimLoop = false, delta = 1 / 60) {
  if (!winTargetName) return;
  const nowPerf = performance.now();

  if (!fromAnimLoop || nowPerf - lastUiMetaSyncAt >= 250) {
    lastUiMetaSyncAt = nowPerf;
    const targetWin = findTargetWindow();
    winTargetName.textContent = targetWin
      ? targetWin.title
      : 'Chưa phát hiện cửa sổ nào';

    if (selectActiveWin && appState.openWindows.length > 0) {
      const currentHwnd = appState.activeWindowHwnd || (targetWin ? targetWin.hwnd : 0);
      const optionsKey = appState.openWindows.map((w) => `${w.hwnd}:${w.title.slice(0, 16)}`).join('|');
      if (selectActiveWin.dataset.key !== optionsKey) {
        selectActiveWin.dataset.key = optionsKey;
        const optionsHtml = [
          '<option value="0">Tự động theo cửa sổ click gần nhất...</option>',
          ...appState.openWindows.map((w) => {
            const procTag = w.process_name ? `[${w.process_name}] ` : '';
            const isSel = w.hwnd === currentHwnd ? 'selected' : '';
            return `<option value="${w.hwnd}" ${isSel}>${procTag}${w.title.slice(0, 30)}</option>`;
          }),
        ].join('');
        selectActiveWin.innerHTML = optionsHtml;
      } else if (currentHwnd && selectActiveWin.value !== String(currentHwnd)) {
        selectActiveWin.value = String(currentHwnd);
      }
    }
    if (appState.isMiniScreenOpen && miniScreenTab === 'mirror') {
      void refreshMiniMirrorWindowSelect(false);
    }

    // Đồng bộ nhãn nút Hồ bơi theo trạng thái thực tế
    if (btnActSwim) {
      const swimmingNow = isWaterPoolActive();
      const expectedText = swimmingNow ? 'Lên Bờ (Dừng Bơi)' : 'Hồ Bơi 3D & Đi Bơi Ra Xa';
      if (btnActSwim.textContent !== expectedText) {
        btnActSwim.textContent = expectedText;
        btnActSwim.style.background = swimmingNow ? 'rgba(239, 68, 68, 0.28)' : 'rgba(14, 165, 233, 0.22)';
        btnActSwim.style.borderColor = swimmingNow ? 'rgba(248, 113, 113, 0.55)' : 'rgba(56, 189, 248, 0.45)';
        btnActSwim.style.color = swimmingNow ? '#fecaca' : '#bae6fd';
      }
    }
  }

  const needsMove =
    !fromAnimLoop ||
    Math.abs(appState.posX - uiFollowX) > 0.15 ||
    Math.abs(appState.posY - uiFollowY) > 0.15 ||
    appState.isFileDragHovering;
  if (!needsMove) {
    return;
  }

  const followAlpha = fromAnimLoop
    ? 1 - Math.exp(-16 * Math.min(0.05, Math.max(0.001, delta)))
    : 1;
  uiFollowX += (appState.posX - uiFollowX) * followAlpha;
  uiFollowY += (appState.posY - uiFollowY) * followAlpha;
  if (Math.abs(appState.posX - uiFollowX) <= 0.15) uiFollowX = appState.posX;
  if (Math.abs(appState.posY - uiFollowY) <= 0.15) uiFollowY = appState.posY;

  const s = appState.modelScale || 1.0;
  const gap = Math.round(66 * s);

  // 1. Cụm Thoại Duck + Cửa sổ Chat luôn đi theo bên Trái hoặc bên Phải nhân vật (không đè lên đầu/thân vịt)
  let bubbleDockX = 0;
  let bubbleDockW = 0;
  let actualBubbleSide: 'left' | 'right' = appState.chatDockSide;
  if (appState.isBubbleVisible && speechBubble) {
    const bubbleW = speechBubble.offsetWidth || 320;
    const bubbleH = speechBubble.offsetHeight || 155;
    const maxBubbleTop = Math.max(12, appState.H - bubbleH - 58);
    const charSideGap = Math.round(62 * s);
    const leftCandidate = uiFollowX - charSideGap - bubbleW;
    const rightCandidate = uiFollowX + charSideGap;

    let bubbleLeft: number;
    if (appState.chatDockSide === 'left') {
      if (leftCandidate >= 12) {
        bubbleLeft = leftCandidate;
        actualBubbleSide = 'left';
      } else if (rightCandidate + bubbleW <= appState.W - 12) {
        bubbleLeft = rightCandidate;
        actualBubbleSide = 'right';
      } else {
        bubbleLeft = Math.max(12, Math.min(appState.W - bubbleW - 12, leftCandidate));
        actualBubbleSide = 'left';
      }
    } else {
      if (rightCandidate + bubbleW <= appState.W - 12) {
        bubbleLeft = rightCandidate;
        actualBubbleSide = 'right';
      } else if (leftCandidate >= 12) {
        bubbleLeft = leftCandidate;
        actualBubbleSide = 'left';
      } else {
        bubbleLeft = Math.max(12, Math.min(appState.W - bubbleW - 12, rightCandidate));
        actualBubbleSide = 'right';
      }
    }

    const desiredTop = uiFollowY - Math.round(135 * s) - bubbleH * 0.45;
    const bubbleTop = Math.max(12, Math.min(maxBubbleTop, desiredTop));
    speechBubble.classList.add('side-mode');
    speechBubble.classList.toggle('follow-left', actualBubbleSide === 'left');
    speechBubble.classList.toggle('follow-right', actualBubbleSide === 'right');
    setPosIfChanged(speechBubble, bubbleLeft, bubbleTop);
    bubbleDockX = bubbleLeft;
    bubbleDockW = bubbleW;
  }

  const ingestHud = document.getElementById('file-ingest-mouth-hud');
  if (ingestHud && appState.isFileDragHovering) {
    const hudW = ingestHud.offsetWidth || 206;
    const hudH = ingestHud.offsetHeight || 132;
    const hx = Math.max(12, Math.min(appState.W - hudW - 12, uiFollowX - hudW / 2));
    const hy = Math.max(12, Math.min(appState.H - hudH - 20, uiFollowY - 122 * appState.modelScale - hudH * 0.48));
    setPosIfChanged(ingestHud, hx, hy);
  }

  // 2. Dock điều khiển dưới chân vịt
  if (companionDock) {
    const dockW = companionDock.offsetWidth || 136;
    setPosIfChanged(
      companionDock,
      Math.max(12, Math.min(appState.W - dockW - 12, uiFollowX - dockW / 2)),
      Math.min(appState.H - 46, uiFollowY + 10)
    );
  }

  // 3. Bảng Hành động Phải & Telemetry Trái bám cạnh bên vịt gọn gàng (tránh đè lên cửa sổ Chat đi theo vịt)
  const leftW = (leftTelemetryPanel && leftTelemetryPanel.offsetWidth) || 256;
  const leftH = (leftTelemetryPanel && leftTelemetryPanel.offsetHeight) || 340;
  const rightW = (rightActionPanel && rightActionPanel.offsetWidth) || 248;
  const rightH = (rightActionPanel && rightActionPanel.offsetHeight) || 420;

  let leftX = uiFollowX - gap - leftW;
  let rightX = uiFollowX + gap;

  if (appState.isBubbleVisible && bubbleDockW > 0) {
    if (actualBubbleSide === 'right') {
      const afterBubble = bubbleDockX + bubbleDockW + 10;
      if (afterBubble + rightW <= appState.W - 12) {
        rightX = afterBubble;
      } else {
        rightX = Math.max(12, uiFollowX - gap - rightW);
        if (leftX + leftW > rightX - 10) {
          leftX = Math.max(12, rightX - leftW - 10);
        }
      }
    } else {
      const beforeBubble = bubbleDockX - leftW - 10;
      if (beforeBubble >= 12) {
        leftX = beforeBubble;
      } else {
        leftX = Math.min(appState.W - leftW - 12, uiFollowX + gap);
        if (rightX < leftX + leftW + 10) {
          rightX = Math.min(appState.W - rightW - 12, leftX + leftW + 10);
        }
      }
    }
  } else {
    if (leftX < 12) {
      rightX = Math.min(appState.W - rightW - 12, uiFollowX + gap);
      leftX = Math.min(appState.W - leftW - 12, rightX + rightW + 10);
    } else if (rightX + rightW > appState.W - 12) {
      leftX = Math.max(12, uiFollowX - gap - leftW);
      rightX = Math.max(12, leftX - rightW - 10);
    }
  }

  if (rightX + rightW > appState.W - 12) {
    const anchorLeft =
      appState.isBubbleVisible && bubbleDockW > 0 && actualBubbleSide === 'left'
        ? bubbleDockX
        : uiFollowX - gap;
    rightX = Math.max(12, anchorLeft - rightW - 10);
  }
  if (leftX < 12) {
    const anchorRight =
      appState.isBubbleVisible && bubbleDockW > 0 && actualBubbleSide === 'right'
        ? bubbleDockX + bubbleDockW
        : uiFollowX + gap;
    leftX = Math.min(appState.W - leftW - 12, anchorRight + 10);
  }
  leftX = Math.max(12, Math.min(appState.W - leftW - 12, leftX));
  rightX = Math.max(12, Math.min(appState.W - rightW - 12, rightX));

  if (appState.isLeftPanelOpen && leftTelemetryPanel) {
    const maxLeftY = Math.max(12, appState.H - leftH - 52);
    const leftY = Math.max(12, Math.min(maxLeftY, uiFollowY - leftH * 0.55));
    setPosIfChanged(leftTelemetryPanel, leftX, leftY);
  }

  if (appState.isRightPanelOpen && rightActionPanel) {
    const maxRightY = Math.max(12, appState.H - rightH - 52);
    const rightY = Math.max(12, Math.min(maxRightY, uiFollowY - rightH * 0.48));
    setPosIfChanged(rightActionPanel, rightX, rightY);
  }
}
