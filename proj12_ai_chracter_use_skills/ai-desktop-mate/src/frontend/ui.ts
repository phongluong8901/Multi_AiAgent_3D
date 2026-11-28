import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  initProj12BrainUi,
  refresh9RouterStudioUi,
  refreshProj11PacksUi,
} from './features/proj12BrainUi';
import {
  initWorkspaceChatUi,
  isLightboxModalOpen,
  isWorkspaceModalOpen,
  renderRichMarkdownHtml,
  setStudioEngine,
  switchWorkspaceTab,
  toggleWorkspaceModal,
} from './features/workspaceChatUi';
import { appState, PRESET_ALICIA_URL, PRESET_VRM1_URL } from '../core/state';
import { applyRendererEcoQuality } from '../core/scene';
import {
  CLIP_CATALOG,
  ClipGroup,
  fireAnimationTrigger,
  getClipById,
  playRandomClipFromDeck,
  previewClip,
  stopLoopingClipById,
} from '../core/animationBinder';
import {
  AUTO_BEHAVIOR_CATALOG,
  AutoBehaviorKey,
  ChatEntry,
  CloudAuthStatus,
  CommunitySkillDoc,
  createDefaultAutoBehaviors,
  CustomSkillRecord,
  IngestedFileAnalysis,
  OcrRegionResult,
  ScheduledNoteEntry,
  TarotReadingRecord,
  TarotStatusResponse,
  ToolForgeDraft,
  TranslateResult,
  WeatherEffectMode,
} from '../core/types';
import {
  SPECIAL_3D_EFFECT_CATALOG,
  spawnParticles,
  spawnScanEffect,
  triggerDuckTarot3DFlipEffect,
  triggerRandomSpecial3DEffect,
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
  triggerAutoBehaviorNow,
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
  triggerWindowPaperCrash,
  triggerHulkRageMode,
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
  P2pStatus,
  migrateDuckOutToPeer,
  openUltraViewModal,
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
  toggleUltraViewExpand,
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
  translateCurrentEnglishLesson,
  translateTextWithAi,
  triggerRandomFeatureOrEffect,
  triggerScheduledContentNow,
  saveLongMemoryEntry,
  saveColabCloudConfig,
  scanColabCloudModels,
  setAutoCheckEnabled,
  setColabCloudModel,
  setCpuAlertPct,
  setGeminiApiKey,
  setGeminiModel,
  setLlmRouteMode,
  setOllamaModel,
  setRamAlertGb,
  updateStudioWeatherPreviewUi,
  colabCloudModel,
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
import { renderQrCodeSvg } from './components/qrCodeSvg';
import { DialogInteractOptions, makeDialogDraggable } from './dialogs/dragHelper';
import {
  initProactiveErrorWatcher,
  initVoicePushToTalk,
} from './features/voiceAndErrorWatcher';
import {
  initAutomationRulesUi,
  refreshAutomationRulesUi,
  refreshAutomationSkillSelect,
} from './features/automationRulesUi';
import { initPinnedChatFilesUi } from './features/pinnedChatFiles';
import {
  isDuckVoiceMuted,
  setDuckVoiceMuted,
  speakEnglishTts,
  speakVietnameseTts,
  stopDuckVoiceTts,
} from './features/voiceTts';
import {
  handleIncomingNotificationForReply,
  initNotificationAutoReplyUi,
  syncNotificationAutoReplyForm,
} from './features/notificationAutoReplyUi';
import { initWebRemoteSyncLoop } from './features/webRemoteSyncUi';
import {
  dockMiniScreenIntoPcControl,
  initMiniScreenUi,
  pauseDockedMiniMirrorCapture,
  refreshMiniMirrorWindowsIfOpen,
  toggleMiniScreenPanel,
  undockMiniScreenFromPcControl,
} from './features/miniScreenUi';
import {
  AgentWorkflowTrace,
  buildToolForgePromptFromTrace,
} from '../backend/agentLoop';
import {
  buildVerifiedDraftFromAgentTrace,
  checkCloudHubHealth,
  confirmAndSaveToolDraft,
  createBlankToolDraft,
  deleteCommunitySkill,
  executeSavedSkillWithSelfHeal,
  forgeNewToolFromRequest,
  getCachedCustomSkills,
  getCloudAuthStatus,
  getCloudHubConfig,
  getLatestToolForgeDraft,
  installCommunitySkillFromCloud,
  listCommunitySkills,
  loginWithGoogleOAuth,
  logoutGoogleOAuth,
  openWebChatCompanion,
  parseExpectedKeywords,
  parseTriggers,
  publishLocalSkillToCloud,
  refreshCustomSkills,
  runDraftInSandbox,
  runDraftLiveTest,
  saveCloudHubConfig,
  selfHealDraftWithGemini,
  setLatestToolForgeDraft,
  toggleStarCommunitySkill,
} from '../backend/toolForge';

export {
  isDuckVoiceMuted,
  speakVietnameseTts,
  stopDuckVoiceTts,
  toggleMiniScreenPanel,
};

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
let dockBtnToggle!: HTMLButtonElement;
let dockToggleReadyDot!: HTMLSpanElement;
let dockBtnP2p!: HTMLButtonElement;
let dockBtnTarot!: HTMLButtonElement;
let dockTarotReadyDot!: HTMLSpanElement;
let isDockExpanded = false;
let btnCloseNotif!: HTMLButtonElement;
let btnCloseP2p!: HTMLButtonElement;
let notifMasterToggle!: HTMLInputElement;
let notifTtsToggle!: HTMLInputElement;
let notifReactToggle!: HTMLInputElement;
let tabBtnWinNotif!: HTMLButtonElement;
let tabBtnWebNotif!: HTMLButtonElement;
let tabBtnHistNotif!: HTMLButtonElement;
let tabBtnAutoreplyNotif!: HTMLButtonElement;
let tabContentWinNotif!: HTMLDivElement;
let tabContentWebNotif!: HTMLDivElement;
let tabContentHistNotif!: HTMLDivElement;
let tabContentAutoreplyNotif!: HTMLDivElement;
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
  dockBtnToggle = document.getElementById('dock-btn-toggle') as HTMLButtonElement;
  dockToggleReadyDot = document.getElementById('dock-toggle-ready-dot') as HTMLSpanElement;
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
  tabBtnAutoreplyNotif = document.getElementById('tab-btn-autoreply-notif') as HTMLButtonElement;
  tabContentWinNotif = document.getElementById('tab-content-win-notif') as HTMLDivElement;
  tabContentWebNotif = document.getElementById('tab-content-web-notif') as HTMLDivElement;
  tabContentHistNotif = document.getElementById('tab-content-hist-notif') as HTMLDivElement;
  tabContentAutoreplyNotif = document.getElementById('tab-content-autoreply-notif') as HTMLDivElement;
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

export function syncDockVoiceUi() {
  if (chkCfgVoiceTts) {
    chkCfgVoiceTts.checked = !isDuckVoiceMuted();
  }
}

let dockHitboxSettleTimer: number | null = null;
let dockSwoopCleanupTimer: number | null = null;

// Trạng thái vật lý quả bóng đồng hành (Companion Orb) lẽo đẽo theo sau vịt khi thu gọn
let orbInited = false;
let orbX = 0;
let orbY = 0;
let orbVelX = 0;
let orbVelY = 0;
let orbTrailDir = 1;
let orbMovingHoldSec = 0;
let prevDuckTrackX = 0;
let prevDuckTrackY = 0;
let lastBubbleTopPx = 0;
let isOrbHovered = false;
let orbSettled = true;

export function isCompanionOrbSettling(): boolean {
  return !isDockExpanded && !orbSettled && !isOrbHovered;
}

export function toggleCompanionDock(forceState?: boolean) {
  const next = forceState !== undefined ? forceState : !isDockExpanded;
  if (next === isDockExpanded && companionDock?.classList.contains('is-expanded') === next) {
    return;
  }

  const prevOrbCenterX = orbX || appState.posX;
  const prevOrbCenterY = orbY || appState.posY - 60;

  isDockExpanded = next;
  if (companionDock) {
    companionDock.style.transform = '';
    companionDock.classList.remove('dock-swoop-in');
    companionDock.classList.toggle('is-expanded', isDockExpanded);
  }
  if (dockBtnToggle) {
    dockBtnToggle.setAttribute('aria-expanded', String(isDockExpanded));
    dockBtnToggle.title = isDockExpanded
      ? 'Thu gọn Menu (Thả bóng bay theo Vịt)'
      : 'Quả Cầu Công Cụ (Bấm để mở Menu dưới chân Vịt)';
  }

  if (dockSwoopCleanupTimer !== null) {
    window.clearTimeout(dockSwoopCleanupTimer);
    dockSwoopCleanupTimer = null;
  }

  if (isDockExpanded) {
    orbSettled = true;
    updateUiPosition();
    if (companionDock && !document.body.classList.contains('eco-mode')) {
      const rect = companionDock.getBoundingClientRect();
      const feetCx = rect.left + rect.width / 2;
      const feetCy = rect.top + rect.height / 2;
      const fromX = Math.round(prevOrbCenterX - feetCx);
      const fromY = Math.round(prevOrbCenterY - feetCy);
      companionDock.style.setProperty('--dock-from-x', `${fromX}px`);
      companionDock.style.setProperty('--dock-from-y', `${fromY}px`);
      companionDock.classList.add('dock-swoop-in');
      dockSwoopCleanupTimer = window.setTimeout(() => {
        dockSwoopCleanupTimer = null;
        companionDock?.classList.remove('dock-swoop-in');
      }, 260);
    }
  } else {
    // Thu gọn từ dưới chân vịt -> bật nảy lên như quả bóng rồi bay về sau lưng vịt
    const launchSide = appState.chatDockSide === 'left' ? 1 : -1;
    orbX = appState.posX;
    orbY = Math.min(appState.H - 26, appState.posY + 18);
    orbVelX = launchSide * 95;
    orbVelY = -165;
    orbSettled = false;
    isOrbHovered = false;
    window.dispatchEvent(new CustomEvent('duck-wake-loop'));
    updateUiPosition();
  }

  syncHitboxToRust(true);
  if (dockHitboxSettleTimer !== null) {
    window.clearTimeout(dockHitboxSettleTimer);
  }
  dockHitboxSettleTimer = window.setTimeout(() => {
    dockHitboxSettleTimer = null;
    updateUiPosition();
    syncHitboxToRust(true);
  }, 250);
}

function syncChatDockSideUi() {
  if (selectChatDockSide) {
    selectChatDockSide.value = appState.chatDockSide;
  }
  if (btnToggleChatSide) {
    btnToggleChatSide.title =
      appState.chatDockSide === 'left'
        ? 'Chat đang đi theo bên Trái nhân vật (Bấm để chuyển sang Phải)'
        : 'Chat đang đi theo bên Phải nhân vật (Bấm để chuyển sang Trái)';
  }
}

export function setBubbleThinkingState(active: boolean, label = 'Duck AI đang suy luận...') {
  const bar = document.getElementById('bubble-thinking-bar');
  const lbl = document.getElementById('bubble-thinking-label');
  if (lbl && label) lbl.textContent = label;
  if (bar) {
    const nextDisplay = active ? 'flex' : 'none';
    if (bar.style.display !== nextDisplay) {
      bar.style.display = nextDisplay;
      speechBubble?.classList.toggle('is-thinking', active);
      updateUiPosition();
    }
  }
}

export function speakMessage(msg: string) {
  setBubbleThinkingState(false);
  typewriterTarget = msg;
  typewriterIndex = 0;
  typewriterAcc = 0;
  if (bubbleContent) bubbleContent.textContent = '';
  appState.speechLipSyncTimer = Math.min(2.6, Math.max(0.9, msg.length * 0.032));
  updateUiPosition();

  if (!isDuckVoiceMuted() && appState.isBubbleVisible) {
    if (
      msg.startsWith('[HỌC TIẾNG ANH') ||
      msg.startsWith('[ĐỐ VUI') ||
      msg.startsWith('[ÔN TẬP')
    ) {
      window.setTimeout(() => {
        if (typewriterTarget === msg && !isDuckVoiceMuted()) {
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
  window.dispatchEvent(
    new CustomEvent('duck-ws-stream-chunk', { detail: { text: typewriterTarget } })
  );
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
  window.dispatchEvent(
    new CustomEvent('duck-ws-stream-chunk', { detail: { text } })
  );
  appState.speechLipSyncTimer = Math.min(2.8, Math.max(0.8, text.length * 0.02));
  updateUiPosition();
}

export function clearSpeechMessage() {
  typewriterTarget = '';
  typewriterIndex = 0;
  typewriterAcc = 0;
  if (bubbleContent) bubbleContent.textContent = '';
  updateUiPosition();
}

export function isTypewriterActive(): boolean {
  return typewriterIndex < typewriterTarget.length;
}

export function updateTypewriter(delta: number) {
  if (bubbleContent && typewriterIndex < typewriterTarget.length) {
    typewriterAcc += delta * 105;
    const nextIdx = Math.min(typewriterTarget.length, Math.floor(typewriterAcc));
    if (nextIdx > typewriterIndex) {
      typewriterIndex = nextIdx;
      bubbleContent.textContent = typewriterTarget.slice(0, typewriterIndex);
      bubbleContent.scrollTop = bubbleContent.scrollHeight;
      if (speechBubble && speechBubble.offsetHeight !== lastBubbleLayoutH) {
        updateUiPosition();
      }
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
    fireAnimationTrigger('event', 'panel:sticky-notes-widget', 'enter');
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
    toggleCompanionDock(false);
    toggleLeftPanel(false);
    toggleRightPanel(false);
    toggleBubbleVisibility(false);
    toggleChatVisibility(false);
    toggleWorkspaceModal(false);
    toggleStudioModal(false);
    toggleLongMemoryModal(false);
    toggleNotificationModal(false);
    toggleP2pArenaModal(false);
    if (btnActEdgePeek) btnActEdgePeek.textContent = 'Ra Khỏi Mép (Alt+W)';
    fireAnimationTrigger('tool', 'edge_peek', 'success');
    return '[NẤP MÉP MÀN HÌNH] Vịt đã nấp gọn sang mép phải. Rê chuột sát mép phải để vịt thò đầu ra hoặc nhấn Alt+W!';
  } else {
    stopLoopingClipById('focus_guard');
    appState.posX = Math.max(120, Math.min(appState.W - 180, appState.posX - 110));
    if (btnActEdgePeek) btnActEdgePeek.textContent = 'Nấp Mép Màn (Alt+W)';
    toggleBubbleVisibility(true);
    fireAnimationTrigger('tool', 'edge_peek', 'start');
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
  makeDialogDraggable(widget, '.sticky-widget-header', syncHitboxToRust, {
    minWidth: 260,
    minHeight: 200,
  });
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
        .then(() => {
          if (doneChk.checked) fireAnimationTrigger('tool', 'sticky_note', 'success');
          return loadScheduledNotesFromSqlite(false);
        })
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
  fireAnimationTrigger('tool', 'sticky_note', 'start');
  try {
    await invoke<ScheduledNoteEntry>('schedule_note_add', {
      content: cleaned,
      scheduleTime: cleanTime,
      repeatDaily,
    });
    await loadScheduledNotesFromSqlite(false);
  } catch (err) {
    fireAnimationTrigger('tool', 'sticky_note', 'error');
    return `[LỖI LƯU LỊCH HẸN] ${String(err)}`;
  }

  fireAnimationTrigger('tool', 'sticky_note', 'success');
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
      fireAnimationTrigger('event', 'schedule_alarm', 'enter');
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
          fireAnimationTrigger('tool', 'sticky_note', 'success');
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
  updateUiPosition();
  syncHitboxToRust(true);
}

export function hideSuggestionButtons() {
  activeSugAccept = null;
  activeSugDismiss = null;
  if (btnSugAccept) btnSugAccept.textContent = 'Đồng ý';
  if (btnSugDismiss) btnSugDismiss.textContent = 'Để sau';
  if (suggestionActions) suggestionActions.style.display = 'none';
  updateUiPosition();
  syncHitboxToRust(true);
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
  closeOtherPopupModals('filedash');

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
    void import('./components/dataChartEngine').then(({ renderDataExpertDashboardCharts }) => {
      renderDataExpertDashboardCharts(analysis, {
        chartSec,
        colTabsEl,
        typeTabsEl,
        scatterControlsEl,
        insightsEl,
        chartCanvasEl: chartBars,
      });
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
  fireAnimationTrigger('event', 'panel:file-dashboard-modal', 'enter');
  syncHitboxToRust(true);
}

export function toggleRightPanel(forceState?: boolean) {
  appState.isRightPanelOpen = false;
  if (rightActionPanel) rightActionPanel.style.display = 'none';
  dockBtnRight?.classList.remove('active');
  if (forceState !== false) {
    window.dispatchEvent(new CustomEvent('duck-open-anim-manager', { detail: { tab: 'actions' } }));
  }
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

  const clipCount = AUTO_BEHAVIOR_CATALOG.filter((x) => x.group === 'clip3d').length;
  const groups: Array<{ id: 'clip3d' | 'basic' | 'action'; title: string }> = [
    { id: 'clip3d', title: `Hoạt Ảnh Đa Pha & Đạo Cụ 3D Mới (${clipCount})` },
    { id: 'basic', title: 'Di Chuyển, Biểu Cảm & Đạo Cụ Cơ Bản' },
    { id: 'action', title: 'Kỹ Năng 3D & Tương Tác Màn Hình' },
  ];

  const playIconSvg = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;

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

      const controls = document.createElement('div');
      controls.className = 'auto-beh-controls';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'auto-beh-play-btn';
      playBtn.title = `Chạy thử: ${item.label}`;
      playBtn.innerHTML = playIconSvg;
      playBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        triggerAutoBehaviorNow(item.key, true);
      });

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

      controls.appendChild(playBtn);
      controls.appendChild(chk);
      label.appendChild(textSpan);
      label.appendChild(controls);
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

function syncStudioAvatarActiveUi() {
  const isMicro = currentActiveCharType === 'microduck';
  const isIdol = currentActiveCharType === 'idol';
  const isAlicia =
    currentActiveCharType === 'custom_vrm' && currentStudioVrmUrl === PRESET_ALICIA_URL;
  const isVrm1 =
    currentActiveCharType === 'custom_vrm' && currentStudioVrmUrl === PRESET_VRM1_URL;
  presetMicroduck?.classList.toggle('active', isMicro);
  presetBuiltin?.classList.toggle('active', isIdol);
  presetAlicia?.classList.toggle('active', isAlicia);
  presetVrm1?.classList.toggle('active', isVrm1);
}

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
    voice_tts_enabled: !isDuckVoiceMuted(),
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
      setDuckVoiceMuted(!cfg.voice_tts_enabled);
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
      if (inputAlertCpu) inputAlertCpu.value = String(cpuAlertPct);
    }
    if (cfg.ram_alert_gb) {
      setRamAlertGb(cfg.ram_alert_gb, false);
      if (inputAlertRam) inputAlertRam.value = String(ramAlertGb);
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
    syncStudioAvatarActiveUi();

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
    if (appState.isBubbleVisible) {
      // Nếu khung chat từng bị kéo ra sát mép hoặc tụt xuống ngoài màn hình thì tự kéo lại vào tầm nhìn
      const r = speechBubble.getBoundingClientRect();
      if (
        r.bottom > (appState.H || window.innerHeight) + 20 ||
        r.top < 0 ||
        r.left < -40 ||
        r.right > (appState.W || window.innerWidth) + 40
      ) {
        speechBubble.classList.remove('dialog-dragged');
        speechBubble.style.left = '';
        speechBubble.style.top = '';
        speechBubble.style.right = '';
        speechBubble.style.bottom = '';
      }
    }
  }
  if (dockBtnChat) {
    dockBtnChat.classList.toggle('active', appState.isBubbleVisible || isWorkspaceModalOpen());
  }
  if (appState.isBubbleVisible) {
    updateUiPosition();
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
  bubbleDiv.className = 'msg-bubble dws-md';
  if (role === 'assistant') {
    bubbleDiv.innerHTML = renderRichMarkdownHtml(text);
  } else {
    bubbleDiv.textContent = text;
  }
  msgDiv.appendChild(authorTag);
  msgDiv.appendChild(bubbleDiv);
  chatHistoryList.appendChild(msgDiv);
  chatHistoryList.scrollTop = chatHistoryList.scrollHeight;
}

async function refreshStudioLlmUi() {
  document.querySelectorAll('.gemini-preset-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.getAttribute('data-model') === geminiModel);
  });
  if (studioGeminiStatus) {
    const hasKey = Boolean(geminiApiKey.trim());
    studioGeminiStatus.textContent = hasKey ? '[GEMINI: READY]' : '[GEMINI: NO KEY]';
    studioGeminiStatus.style.color = hasKey ? '#6ee7b7' : '#cbd5e1';
  }
  if (!studioOllamaStatus || !ollamaModelsChips) return;

  studioOllamaStatus.textContent = '[OLLAMA: SCANNING]';
  if (btnScanOllamaModels) {
    btnScanOllamaModels.disabled = true;
    btnScanOllamaModels.textContent = 'Đang quét...';
  }
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
  } finally {
    if (btnScanOllamaModels) {
      btnScanOllamaModels.disabled = false;
      btnScanOllamaModels.textContent = 'Quét Model Ollama';
    }
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
  except?:
    | 'studio'
    | 'memory'
    | 'notif'
    | 'p2p'
    | 'pc'
    | 'ocr'
    | 'toolforge'
    | 'workspace'
    | 'tarot'
    | 'anim'
    | 'filedash'
    | 'english'
    | 'dropzone'
) {
  if (except !== 'workspace' && except !== 'toolforge' && isWorkspaceModalOpen()) {
    toggleWorkspaceModal(false);
  }
  if (except !== 'anim') {
    window.dispatchEvent(new CustomEvent('duck-close-anim-manager'));
  }
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
  if (except !== 'filedash') {
    const fileDashModal = document.getElementById('file-dashboard-modal');
    if (fileDashModal) fileDashModal.style.display = 'none';
  }
  if (except !== 'english') {
    hideEnglishCoachFast();
  }
  if (except !== 'dropzone') {
    hideSmartDropzoneFast();
  }
}

export function toggleStudioModal(forceState?: boolean) {
  appState.isStudioOpen = forceState !== undefined ? forceState : !appState.isStudioOpen;
  if (appState.isStudioOpen) {
    closeOtherPopupModals('studio');
    updateStudioWeatherPreviewUi();
    syncStudioAvatarActiveUi();
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
    syncNotificationAutoReplyForm();
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

let currentPcControlTab: 'main' | 'mini' | 'qr' = 'main';
let cachedQrDeckUrl = '';

function scoreLanIpCandidate(ip: string): number {
  if (!ip || ip === '127.0.0.1' || ip === '0.0.0.0') return 0;
  if (ip.startsWith('169.254.') || ip.startsWith('192.168.56.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 2;
  if (ip.startsWith('10.')) return 4;
  if (ip.startsWith('192.168.')) return 5;
  return 3;
}

async function refreshPcQrDeckUi(preferredIp?: string) {
  try {
    const st = await invoke<P2pStatus>('p2p_get_status');
    const rawIps = [...(st.lan_ips || []), st.local_ip].filter(Boolean);
    const uniqueIps = Array.from(new Set(rawIps)).sort(
      (a, b) => scoreLanIpCandidate(b) - scoreLanIpCandidate(a)
    );
    if (uniqueIps.length === 0) {
      uniqueIps.push('127.0.0.1');
    }

    const selEl = document.getElementById('select-pc-qr-ip') as HTMLSelectElement | null;
    const prevChoice = preferredIp || selEl?.value || '';
    const chosenIp = uniqueIps.includes(prevChoice) ? prevChoice : uniqueIps[0];

    if (selEl) {
      selEl.innerHTML = uniqueIps
        .map((ip) => {
          const tag =
            ip.startsWith('192.168.') && !ip.startsWith('192.168.56.')
              ? ' (Wi-Fi / LAN)'
              : ip.startsWith('10.')
                ? ' (LAN)'
                : '';
          return `<option value="${ip}">${ip}${tag}</option>`;
        })
        .join('');
      selEl.value = chosenIp;
    }

    const deckUrl = `http://${chosenIp}:${st.listen_port}/deck?pin=${st.room_code}`;
    cachedQrDeckUrl = deckUrl;

    const pinBadge = document.getElementById('pc-qr-pin-badge');
    if (pinBadge) pinBadge.textContent = `PIN: ${st.room_code}`;

    const urlLbl = document.getElementById('pc-qr-url-label');
    if (urlLbl) urlLbl.textContent = deckUrl;

    const qrBox = document.getElementById('pc-qr-svg-box');
    if (qrBox) {
      qrBox.innerHTML = renderQrCodeSvg(deckUrl, 172);
    }
    syncHitboxToRust(true);
  } catch (err) {
    console.warn('[WARN] refreshPcQrDeckUi error', err);
  }
}

export function setPcControlTab(tab: 'main' | 'mini' | 'qr') {
  currentPcControlTab = tab;
  document.getElementById('tab-btn-pc-main')?.classList.toggle('active', tab === 'main');
  document.getElementById('tab-btn-pc-mini')?.classList.toggle('active', tab === 'mini');
  document.getElementById('tab-btn-pc-qr')?.classList.toggle('active', tab === 'qr');
  const paneMain = document.getElementById('pc-pane-main');
  const paneMini = document.getElementById('pc-pane-mini');
  const paneQr = document.getElementById('pc-pane-qr');
  if (paneMain) paneMain.style.display = tab === 'main' ? 'block' : 'none';
  if (paneMini) paneMini.style.display = tab === 'mini' ? 'block' : 'none';
  if (paneQr) paneQr.style.display = tab === 'qr' ? 'block' : 'none';
  if (tab === 'mini') {
    dockMiniScreenIntoPcControl();
  } else {
    pauseDockedMiniMirrorCapture();
  }
  if (tab === 'qr') {
    void refreshPcQrDeckUi();
  }
  syncHitboxToRust(true);
}

export function togglePcControlModal(forceState?: boolean, tab?: 'main' | 'mini' | 'qr') {
  appState.isPcControlOpen =
    forceState !== undefined ? forceState : !appState.isPcControlOpen;
  if (appState.isPcControlOpen) {
    closeOtherPopupModals('pc');
  } else {
    pauseDockedMiniMirrorCapture();
  }
  if (pcControlModal) {
    pcControlModal.style.display = appState.isPcControlOpen ? 'block' : 'none';
  }
  if (dockBtnPcControl) {
    dockBtnPcControl.classList.toggle('active', appState.isPcControlOpen);
  }
  if (appState.isPcControlOpen) {
    const nextTab = tab ?? currentPcControlTab;
    if (tab || nextTab === 'mini' || nextTab === 'qr') {
      setPcControlTab(nextTab);
    }
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

function setToolForgeTab(tab: 'forge' | 'skills' | 'packs' | 'cloud' | 'auto') {
  if (tab === 'forge') {
    switchWorkspaceTab('studio');
    setStudioEngine('sandbox');
    syncHitboxToRust(true);
    return;
  }
  switchWorkspaceTab('hub');
  const btnSkills = document.getElementById('tab-btn-tf-skills');
  const btnPacks = document.getElementById('tab-btn-tf-packs');
  const btnCloud = document.getElementById('tab-btn-tf-cloud');
  const btnAuto = document.getElementById('tab-btn-tf-auto');
  const paneSkills = document.getElementById('tf-pane-skills');
  const panePacks = document.getElementById('tf-pane-packs');
  const paneCloud = document.getElementById('tf-pane-cloud');
  const paneAuto = document.getElementById('tf-pane-auto');
  if (btnSkills) btnSkills.classList.toggle('active', tab === 'skills');
  if (btnPacks) btnPacks.classList.toggle('active', tab === 'packs');
  if (btnCloud) btnCloud.classList.toggle('active', tab === 'cloud');
  if (btnAuto) btnAuto.classList.toggle('active', tab === 'auto');
  if (paneSkills) paneSkills.style.display = tab === 'skills' ? 'flex' : 'none';
  if (panePacks) panePacks.style.display = tab === 'packs' ? 'flex' : 'none';
  if (paneCloud) paneCloud.style.display = tab === 'cloud' ? 'flex' : 'none';
  if (paneAuto) paneAuto.style.display = tab === 'auto' ? 'flex' : 'none';
  syncHitboxToRust(true);
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

const lastSkillRunOutputs = new Map<string, string>();
let cachedCloudAuth: CloudAuthStatus | null = null;
let cachedCloudSkills: CommunitySkillDoc[] = [];
const myPublishedCloudSkills = new Map<string, CommunitySkillDoc>();
let hasFetchedCloudSkillsOnce = false;
let cloudSkillsSyncInFlight = false;
let lastSavedDraftSig = '';

function isOwnedByCurrentCloudUser(doc: CommunitySkillDoc): boolean {
  if (!cachedCloudAuth?.logged_in) return false;
  if (doc.author_sub && cachedCloudAuth.sub && doc.author_sub === cachedCloudAuth.sub) {
    return true;
  }
  return Boolean(
    doc.author_email &&
    cachedCloudAuth.email &&
    doc.author_email.toLowerCase() === cachedCloudAuth.email.toLowerCase()
  );
}

function rebuildMyPublishedCloudSkillsMap(items: CommunitySkillDoc[]) {
  myPublishedCloudSkills.clear();
  for (const doc of items) {
    if (isOwnedByCurrentCloudUser(doc)) {
      myPublishedCloudSkills.set(doc.id, doc);
    }
  }
}

function getSkillCloudSyncStatus(
  sk: CustomSkillRecord
): 'not_published' | 'synced' | 'needs_update' {
  if (!cachedCloudAuth?.logged_in) return 'not_published';
  const cloudDoc = myPublishedCloudSkills.get(sk.id);
  if (!cloudDoc) return 'not_published';
  const sameHash = Boolean(sk.code_hash && cloudDoc.code_hash === sk.code_hash);
  const sameVer = (cloudDoc.version || 1) === sk.version;
  const sameName = cloudDoc.name.trim() === sk.name.trim();
  const sameDesc = cloudDoc.description.trim() === sk.description.trim();
  return sameHash && sameVer && sameName && sameDesc ? 'synced' : 'needs_update';
}

function computeDraftSaveSig(d: ToolForgeDraft): string {
  return `${d.id.trim()}|${d.name.trim()}|${d.language}|${d.triggers.join(',')}|${d.sandbox?.code_hash || ''}`;
}

async function syncCloudSkillsCacheSilent(force = false): Promise<void> {
  if (!cachedCloudAuth?.logged_in || cloudSkillsSyncInFlight) return;
  if (!force && hasFetchedCloudSkillsOnce) return;
  cloudSkillsSyncInFlight = true;
  try {
    const items = await listCommunitySkills(undefined, 'all');
    cachedCloudSkills = items;
    hasFetchedCloudSkillsOnce = true;
    rebuildMyPublishedCloudSkillsMap(items);
    renderToolForgeSkillsList();
    const cloudPane = document.getElementById('tf-pane-cloud');
    if (cloudPane && cloudPane.style.display !== 'none') {
      renderCloudSkillsList(items);
    }
  } catch {
    // offline or cold-start failure: preserve local state silently
  } finally {
    cloudSkillsSyncInFlight = false;
  }
}

function renderToolForgeDraft(draft: ToolForgeDraft | null) {
  const sec = document.getElementById('tf-draft-section');
  const nameInp = document.getElementById('tf-draft-name') as HTMLInputElement | null;
  const idInp = document.getElementById('tf-draft-id') as HTMLInputElement | null;
  const trigInp = document.getElementById('tf-draft-triggers') as HTMLInputElement | null;
  const kwInp = document.getElementById('tf-draft-keywords') as HTMLInputElement | null;
  const argsInp = document.getElementById('tf-draft-test-args') as HTMLInputElement | null;
  const liveArgsInp = document.getElementById('tf-live-test-args') as HTMLInputElement | null;
  const langTag = document.getElementById('tf-draft-lang-tag');
  const codeEd = document.getElementById('tf-code-editor') as HTMLTextAreaElement | null;
  const badge = document.getElementById('tf-verify-badge');
  const liveBadge = document.getElementById('tf-live-test-badge');
  const reportBox = document.getElementById('tf-sandbox-report');
  const liveReportBox = document.getElementById('tf-live-test-report');
  const saveBtn = document.getElementById('btn-tf-confirm-save') as HTMLButtonElement | null;

  if (!draft) {
    if (sec) sec.style.display = 'none';
    if (saveBtn) {
      saveBtn.className = 'studio-btn-primary';
      saveBtn.textContent = 'Xác Nhận & Đóng Gói Skill';
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.45';
    }
    return;
  }

  if (sec) sec.style.display = 'block';
  if (nameInp && document.activeElement !== nameInp) nameInp.value = draft.name;
  if (idInp && document.activeElement !== idInp) idInp.value = draft.id;
  if (trigInp && document.activeElement !== trigInp) trigInp.value = draft.triggers.join(', ');
  if (kwInp && document.activeElement !== kwInp) kwInp.value = draft.expectedKeywords.join(', ');
  if (argsInp && document.activeElement !== argsInp) argsInp.value = draft.testArgsJson || '{}';
  if (liveArgsInp && document.activeElement !== liveArgsInp) {
    liveArgsInp.value = draft.liveTestArgsJson ?? draft.testArgsJson ?? '{}';
  }
  if (langTag) langTag.textContent = `[${draft.language.toUpperCase()}]`;
  const langSelEl = document.getElementById('select-tf-lang') as HTMLSelectElement | null;
  if (langSelEl && (langSelEl.value === 'powershell' || langSelEl.value === 'python')) {
    langSelEl.value = draft.language;
  }
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
    const alreadyPackagedSame =
      verified && Boolean(lastSavedDraftSig) && computeDraftSaveSig(draft) === lastSavedDraftSig;
    if (alreadyPackagedSame) {
      saveBtn.className = 'studio-btn-primary btn-cloud-synced';
      saveBtn.textContent = 'Đã Đóng Gói Skill';
      saveBtn.disabled = true;
      saveBtn.style.opacity = '';
    } else {
      saveBtn.className = 'studio-btn-primary';
      saveBtn.textContent = 'Xác Nhận & Đóng Gói Skill';
      saveBtn.disabled = !verified;
      saveBtn.style.opacity = verified ? '1' : '0.45';
    }
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

  const lt = draft.liveTest ?? null;
  if (liveBadge) {
    if (!lt) {
      liveBadge.className = 'badge tf-badge-warn';
      liveBadge.textContent = '[CHƯA TEST THẬT]';
    } else if (lt.ok) {
      liveBadge.className = 'badge tf-badge-pass';
      liveBadge.textContent = `[USER TEST PASS - ${lt.duration_ms}ms]`;
    } else if (lt.timed_out) {
      liveBadge.className = 'badge tf-badge-fail';
      liveBadge.textContent = '[USER TEST TIMEOUT]';
    } else {
      liveBadge.className = 'badge tf-badge-fail';
      liveBadge.textContent = `[USER TEST FAIL - Exit ${lt.exit_code}]`;
    }
  }

  if (liveReportBox) {
    if (!lt) {
      liveReportBox.textContent =
        '[USER TEST] Chưa chạy kiểm nghiệm thực tế. Hãy kiểm tra tham số JSON ở trên và bấm "Test Chạy Thật" để xem kết quả & hành động thật trên máy trước khi đóng gói.';
    } else {
      const liveParts: string[] = [
        `Trạng thái chạy thật (DUCK_SANDBOX_MODE=0): ${lt.ok ? 'PASS (Exit=0)' : 'FAIL'} | Exit=${lt.exit_code}${lt.timed_out ? ' (TIMEOUT)' : ''} | ${lt.duration_ms}ms`,
        `Tham số đã chạy: ${draft.liveTestArgsJson ?? draft.testArgsJson ?? '{}'}`,
      ];
      if (lt.error_summary) {
        liveParts.push(`Lỗi: ${lt.error_summary}`);
      }
      if (lt.stdout) {
        liveParts.push(`--- STDOUT (KẾT QUẢ THẬT) ---\n${lt.stdout}`);
      }
      if (lt.stderr) {
        liveParts.push(`--- STDERR ---\n${lt.stderr}`);
      }
      liveParts.push(
        lt.ok
          ? '[XÁC NHẬN] Hãy đối chiếu kết quả và hành động thực tế trên máy xem đã đúng ý chưa trước khi bấm "Xác Nhận & Đóng Gói Skill".'
          : '[GỢI Ý] Nếu kết quả hoặc hành động chạy thật chưa đúng, hãy bấm "Tự Vá (Gemini)" để AI sửa theo log chạy thật.'
      );
      liveReportBox.textContent = liveParts.join('\n');
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

    const cloudStatus = sk.verified ? getSkillCloudSyncStatus(sk) : 'not_published';

    const statsBadge = document.createElement('span');
    statsBadge.className = 'badge';
    statsBadge.style.cssText = 'font-size:9px;text-transform:none;';
    statsBadge.textContent = `Dùng: ${sk.usage_count} | Tự vá: ${sk.heal_count}`;

    titleWrap.append(nameEl, verBadge, statsBadge);

    if (cloudStatus === 'synced') {
      const cloudBadge = document.createElement('span');
      cloudBadge.className = 'badge tf-badge-cloud';
      cloudBadge.style.fontSize = '9px';
      cloudBadge.textContent = '[ĐÃ LÊN CLOUD]';
      titleWrap.appendChild(cloudBadge);
    } else if (cloudStatus === 'needs_update') {
      const cloudBadge = document.createElement('span');
      cloudBadge.className = 'badge tf-badge-warn';
      cloudBadge.style.fontSize = '9px';
      cloudBadge.textContent = '[CÓ BẢN MỚI LOCAL]';
      titleWrap.appendChild(cloudBadge);
    }

    const toggleLbl = document.createElement('label');
    toggleLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10.5px;color:#cbd5e1;cursor:pointer;';
    const toggleChk = document.createElement('input');
    toggleChk.type = 'checkbox';
    toggleChk.checked = sk.enabled;
    toggleChk.addEventListener('change', async () => {
      toggleChk.disabled = true;
      try {
        await invoke('tool_forge_toggle_skill', {
          id: sk.id,
          enabled: toggleChk.checked,
        });
        await refreshCustomSkills();
        refreshAutomationSkillSelect();
      } catch {
        toggleChk.checked = !toggleChk.checked;
      } finally {
        toggleChk.disabled = false;
      }
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
    const prevOut = lastSkillRunOutputs.get(sk.id);
    if (prevOut) {
      outPre.style.display = 'block';
      outPre.textContent = prevOut;
    } else {
      outPre.style.display = 'none';
    }

    btnRun.addEventListener('click', async () => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(argsInput.value.trim() || '{}') as Record<string, unknown>;
      } catch {
        const errTxt = '[ERR] Tham số JSON không hợp lệ.';
        lastSkillRunOutputs.set(sk.id, errTxt);
        outPre.style.display = 'block';
        outPre.textContent = errTxt;
        return;
      }
      btnRun.disabled = true;
      btnRun.textContent = 'Đang chạy...';
      const initMsg = '[RUN] Đang thực thi skill (hỗ trợ tự vá Self-Healing nếu lỗi)...';
      lastSkillRunOutputs.set(sk.id, initMsg);
      outPre.style.display = 'block';
      outPre.textContent = initMsg;
      try {
        const resText = await executeSavedSkillWithSelfHeal(sk.id, parsedArgs, (msg) => {
          lastSkillRunOutputs.set(sk.id, msg);
          outPre.textContent = msg;
        });
        lastSkillRunOutputs.set(sk.id, resText);
        outPre.textContent = resText;
        speakMessage(resText);
      } catch (err) {
        const errMsg = `[ERR] ${String(err)}`;
        lastSkillRunOutputs.set(sk.id, errMsg);
        outPre.textContent = errMsg;
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
        liveTest: null,
        liveTestArgsJson: sk.test_args_json || '{}',
        healLogs: [`[EDIT] Nạp lại "${sk.name}" v${sk.version} vào Sandbox để kiểm tra/cải tiến.`],
        originalRequest: sk.description,
      };
      setLatestToolForgeDraft(loadedDraft);
      setToolForgeTab('forge');
      renderToolForgeDraft(loadedDraft);
    });

    btnDel.addEventListener('click', async () => {
      btnDel.disabled = true;
      btnDel.textContent = 'Đang xóa...';
      try {
        await invoke('tool_forge_delete_skill', { id: sk.id });
        lastSkillRunOutputs.delete(sk.id);
        await refreshCustomSkills();
        renderToolForgeSkillsList();
        refreshAutomationSkillSelect();
        if (hasFetchedCloudSkillsOnce) {
          renderCloudSkillsList(cachedCloudSkills);
        }
      } catch (err) {
        const errMsg = `[DELETE ERR] ${String(err)}`;
        lastSkillRunOutputs.set(sk.id, errMsg);
        outPre.style.display = 'block';
        outPre.textContent = errMsg;
        btnDel.disabled = false;
        btnDel.textContent = 'Xóa';
      }
    });

    const btnPublish = document.createElement('button');
    btnPublish.type = 'button';
    if (!sk.verified) {
      btnPublish.className = 'action-btn';
      btnPublish.style.cssText = 'padding:4px 8px;font-size:10.5px;';
      btnPublish.disabled = true;
      btnPublish.textContent = 'Chưa Kiểm Chứng';
      btnPublish.title = 'Cần kiểm chứng Sandbox trước khi đẩy lên Cloud';
    } else if (cloudStatus === 'synced') {
      btnPublish.className = 'action-btn btn-cloud-synced';
      btnPublish.style.cssText = 'padding:4px 8px;font-size:10.5px;';
      btnPublish.disabled = true;
      btnPublish.textContent = 'Đã Đẩy Cloud';
      btnPublish.title = 'Skill này đã đồng bộ bản mới nhất lên MongoDB Cloud';
    } else if (cloudStatus === 'needs_update') {
      btnPublish.className = 'action-btn';
      btnPublish.style.cssText = 'padding:4px 8px;font-size:10.5px;border-color:rgba(251,191,36,0.55);color:#fde68a;';
      btnPublish.textContent = 'Cập Nhật Cloud';
      btnPublish.title = 'Bản local đã thay đổi — bấm để cập nhật lên MongoDB Cloud';
    } else {
      btnPublish.className = 'action-btn';
      btnPublish.style.cssText = 'padding:4px 8px;font-size:10.5px;border-color:rgba(16,185,129,0.5);color:#6ee7b7;';
      btnPublish.textContent = 'Đẩy Lên Cloud';
      btnPublish.title = 'Đăng Skill đã kiểm chứng lên MongoDB để chia sẻ';
    }

    btnPublish.addEventListener('click', async () => {
      if (!cachedCloudAuth?.logged_in) {
        setToolForgeTab('cloud');
        void refreshCloudHubUi();
        setCloudStatusLog('[AUTH] Bạn cần đăng nhập Google trước khi đẩy Skill lên MongoDB.');
        return;
      }
      const prevLabel = btnPublish.textContent || 'Đẩy Lên Cloud';
      btnPublish.disabled = true;
      btnPublish.textContent = 'Đang đẩy...';
      outPre.style.display = 'block';
      outPre.textContent = '[CLOUD] Đang đẩy Skill lên MongoDB...';
      fireAnimationTrigger('tool', 'cloud_hub', 'start');
      try {
        const doc = await publishLocalSkillToCloud(sk.id);
        myPublishedCloudSkills.set(doc.id, doc);
        const existIdx = cachedCloudSkills.findIndex((x) => x.skill_key === doc.skill_key);
        if (existIdx >= 0) {
          cachedCloudSkills[existIdx] = doc;
        } else {
          cachedCloudSkills.unshift(doc);
        }
        fireAnimationTrigger('tool', 'cloud_hub', 'success');
        const okMsg = `[CLOUD PUBLISHED] Đã đẩy "${doc.name}" (key=${doc.skill_key}) lên MongoDB!`;
        lastSkillRunOutputs.set(sk.id, okMsg);
        speakMessage(okMsg);
        renderToolForgeSkillsList();
        if (hasFetchedCloudSkillsOnce) {
          renderCloudSkillsList(cachedCloudSkills);
        }
      } catch (err) {
        fireAnimationTrigger('tool', 'cloud_hub', 'error');
        const errMsg = `[CLOUD ERR] ${String(err)}`;
        lastSkillRunOutputs.set(sk.id, errMsg);
        outPre.textContent = errMsg;
        btnPublish.disabled = false;
        btnPublish.textContent = prevLabel;
      }
    });

    runRow.append(argsInput, btnRun, btnLoadDraft, btnPublish, btnDel);
    card.append(head, descEl, runRow, outPre);
    container.appendChild(card);
  });
}

function setCloudStatusLog(text: string) {
  const el = document.getElementById('tf-cloud-status-log');
  if (el) {
    el.textContent = text;
  }
}

function renderCloudAuthUi(auth: CloudAuthStatus) {
  cachedCloudAuth = auth;
  window.dispatchEvent(new CustomEvent('duck-cloud-auth-changed', { detail: auth }));
  const headerBadge = document.getElementById('tf-auth-header-badge');
  const authInfo = document.getElementById('tf-cloud-auth-info');
  const btnLogin = document.getElementById('btn-tf-google-login') as HTMLButtonElement | null;
  const btnLogout = document.getElementById('btn-tf-google-logout') as HTMLButtonElement | null;

  if (auth.logged_in) {
    if (headerBadge) {
      headerBadge.className = 'badge tf-badge-pass';
      headerBadge.textContent = `[GOOGLE: ${auth.email}]`;
    }
    if (authInfo) {
      authInfo.textContent = `[ONLINE] Đang đăng nhập: ${auth.name} (${auth.email})`;
      authInfo.style.color = '#6ee7b7';
    }
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-flex';
  } else {
    if (headerBadge) {
      headerBadge.className = 'badge tf-badge-warn';
      headerBadge.textContent = '[OFFLINE / GUEST]';
    }
    if (authInfo) {
      authInfo.textContent =
        '[GUEST] App chạy bình thường không cần đăng nhập. Đăng nhập Google để đẩy lên / kéo xuống Skill từ MongoDB.';
      authInfo.style.color = '#cbd5e1';
    }
    if (btnLogin) btnLogin.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'none';
  }
}

function renderCloudSkillsList(items: CommunitySkillDoc[]) {
  cachedCloudSkills = items;
  items.forEach((doc) => {
    if (isOwnedByCurrentCloudUser(doc)) {
      myPublishedCloudSkills.set(doc.id, doc);
    }
  });
  const container = document.getElementById('tf-cloud-skills-list');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML =
      '<div class="dash-sub">Không tìm thấy Skill cộng đồng nào khớp bộ lọc trên MongoDB.</div>';
    return;
  }

  const localSkills = getCachedCustomSkills();
  const userStarIds = [cachedCloudAuth?.sub, cachedCloudAuth?.email]
    .filter((x): x is string => Boolean(x && x.trim()))
    .map((x) => x.trim());

  container.innerHTML = '';
  items.forEach((doc) => {
    const card = document.createElement('div');
    card.className = 'tf-skill-card';

    const head = document.createElement('div');
    head.className = 'tf-skill-card-head';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:12px;font-weight:700;color:#f8fafc;';
    nameEl.textContent = doc.name;

    const langBadge = document.createElement('span');
    langBadge.className = 'badge tf-badge-pass';
    langBadge.style.fontSize = '9px';
    langBadge.textContent = `[v${doc.version || 1} | ${String(doc.language).toUpperCase()}]`;

    const dlBadge = document.createElement('span');
    dlBadge.className = 'badge';
    dlBadge.style.cssText = 'font-size:9px;text-transform:none;';
    dlBadge.textContent = `Tải: ${doc.downloads || 0}`;

    titleWrap.append(nameEl, langBadge, dlBadge);

    const localMatch = localSkills.find((s) => s.id === doc.id);
    const isSameInstalled = Boolean(
      localMatch && localMatch.code_hash && localMatch.code_hash === doc.code_hash
    );
    const hasOlderLocal = Boolean(localMatch && !isSameInstalled);
    if (isSameInstalled) {
      const localBadge = document.createElement('span');
      localBadge.className = 'badge tf-badge-cloud';
      localBadge.style.fontSize = '9px';
      localBadge.textContent = '[ĐÃ CÀI LOCAL]';
      titleWrap.appendChild(localBadge);
    } else if (hasOlderLocal) {
      const localBadge = document.createElement('span');
      localBadge.className = 'badge tf-badge-warn';
      localBadge.style.fontSize = '9px';
      localBadge.textContent = '[CÓ BẢN MỚI]';
      titleWrap.appendChild(localBadge);
    }

    const authorEl = document.createElement('span');
    authorEl.style.cssText = 'font-size:10px;color:#94a3b8;';
    authorEl.textContent = doc.author_name || doc.author_email || 'Community';

    head.append(titleWrap, authorEl);

    const descEl = document.createElement('div');
    descEl.style.cssText = 'font-size:10.5px;color:#cbd5e1;';
    descEl.textContent = doc.description || doc.id;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px;';

    const btnPull = document.createElement('button');
    btnPull.type = 'button';
    if (isSameInstalled) {
      btnPull.className = 'action-btn btn-cloud-synced';
      btnPull.style.cssText = 'padding:4px 10px;font-size:10.5px;';
      btnPull.disabled = true;
      btnPull.textContent = 'Đã Cài Đặt';
      btnPull.title = 'Skill này đã được cài đặt trên máy với mã nguồn giống bản Cloud';
    } else if (hasOlderLocal) {
      btnPull.className = 'studio-btn-primary';
      btnPull.style.cssText = 'padding:4px 10px;font-size:10.5px;';
      btnPull.textContent = 'Cập Nhật Về Máy';
      btnPull.title = 'Tải bản mới từ Cloud và kiểm nghiệm Sandbox lại';
    } else {
      btnPull.className = 'studio-btn-primary';
      btnPull.style.cssText = 'padding:4px 10px;font-size:10.5px;';
      btnPull.textContent = 'Kéo Về & Test Sandbox';
    }

    btnPull.addEventListener('click', async () => {
      const prevPullLabel = btnPull.textContent || 'Kéo Về & Test Sandbox';
      btnPull.disabled = true;
      btnPull.textContent = 'Đang kéo & test...';
      setCloudStatusLog(`[PULL] Đang tải "${doc.name}" từ MongoDB và kiểm nghiệm Sandbox trên máy...`);
      fireAnimationTrigger('tool', 'cloud_hub', 'start');
      try {
        const res = await installCommunitySkillFromCloud(doc.skill_key);
        doc.downloads = (doc.downloads || 0) + 1;
        fireAnimationTrigger('tool', 'cloud_hub', 'success');
        setCloudStatusLog(
          `[INSTALLED] Đã cài "${res.skill.name}" (Sandbox PASS ${res.sandbox.duration_ms}ms) vào Kho Skill Đã Lưu!`
        );
        speakMessage(`[CLOUD HUB] Đã tải & kiểm chứng thành công skill "${res.skill.name}"!`);
        renderToolForgeSkillsList();
        renderCloudSkillsList(cachedCloudSkills);
        refreshAutomationSkillSelect();
      } catch (err) {
        fireAnimationTrigger('tool', 'cloud_hub', 'error');
        setCloudStatusLog(`[PULL ERR] ${String(err)}`);
        btnPull.disabled = false;
        btnPull.textContent = prevPullLabel;
      }
    });

    const btnInspect = document.createElement('button');
    btnInspect.type = 'button';
    btnInspect.className = 'action-btn';
    btnInspect.style.cssText = 'padding:4px 9px;font-size:10.5px;';
    btnInspect.textContent = 'Nạp Vào Editor';
    btnInspect.addEventListener('click', () => {
      const kws = parseExpectedKeywords(doc.expected_keywords_json);
      const trigs = parseTriggers(doc.triggers_json);
      let schema = [];
      try {
        schema = JSON.parse(doc.params_schema_json || '[]');
      } catch {
        schema = [];
      }
      const loadedDraft: ToolForgeDraft = {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        language: doc.language === 'python' ? 'python' : 'powershell',
        triggers: trigs,
        paramsSchema: schema,
        code: doc.code,
        testArgsJson: doc.test_args_json || '{}',
        expectedKeywords: kws,
        sandbox: null,
        liveTest: null,
        liveTestArgsJson: doc.test_args_json || '{}',
        healLogs: [`[CLOUD] Nạp mã nguồn "${doc.name}" từ ${doc.author_email || 'cộng đồng'}. Hãy kiểm tra và bấm "Chạy Sandbox" trước khi lưu.`],
        originalRequest: doc.description,
      };
      setLatestToolForgeDraft(loadedDraft);
      setToolForgeTab('forge');
      renderToolForgeDraft(loadedDraft);
    });

    btnRow.append(btnPull, btnInspect);

    const btnStar = document.createElement('button');
    btnStar.type = 'button';
    btnStar.className = 'action-btn';
    const applyStarStyle = (starred: boolean, count: number) => {
      btnStar.textContent = starred ? `Đã Star (${count})` : `Star (${count})`;
      btnStar.style.cssText = starred
        ? 'padding:4px 9px;font-size:10.5px;border-color:rgba(250,204,21,0.75);background:rgba(234,179,8,0.22);color:#fef08a;'
        : 'padding:4px 9px;font-size:10.5px;border-color:rgba(250,204,21,0.45);color:#fde68a;';
    };
    const initialStarred = Boolean(
      cachedCloudAuth?.logged_in &&
      Array.isArray(doc.starred_by) &&
      userStarIds.some((uid) => doc.starred_by!.includes(uid))
    );
    applyStarStyle(initialStarred, doc.stars || 0);
    btnStar.addEventListener('click', async () => {
      if (!cachedCloudAuth?.logged_in) {
        setCloudStatusLog('[AUTH] Bạn cần đăng nhập Google trước khi Star skill.');
        return;
      }
      btnStar.disabled = true;
      try {
        const res = await toggleStarCommunitySkill(doc.skill_key);
        doc.stars = res.stars;
        const primaryTag = cachedCloudAuth.sub || cachedCloudAuth.email;
        const curList = Array.isArray(doc.starred_by) ? [...doc.starred_by] : [];
        if (res.starred) {
          if (primaryTag && !curList.includes(primaryTag)) curList.push(primaryTag);
          doc.starred_by = curList;
        } else {
          doc.starred_by = curList.filter((t) => !userStarIds.includes(t));
        }
        applyStarStyle(res.starred, res.stars);
      } catch (err) {
        setCloudStatusLog(`[STAR ERR] ${String(err)}`);
      } finally {
        btnStar.disabled = false;
      }
    });
    btnRow.appendChild(btnStar);

    if (isOwnedByCurrentCloudUser(doc)) {
      const btnDeleteCloud = document.createElement('button');
      btnDeleteCloud.type = 'button';
      btnDeleteCloud.className = 'action-btn';
      btnDeleteCloud.style.cssText = 'padding:4px 9px;font-size:10.5px;border-color:rgba(248,113,113,0.45);color:#fca5a5;';
      btnDeleteCloud.textContent = 'Xóa (Của Tôi)';
      btnDeleteCloud.addEventListener('click', async () => {
        btnDeleteCloud.disabled = true;
        btnDeleteCloud.textContent = 'Đang xóa...';
        try {
          await deleteCommunitySkill(doc.skill_key);
          if (myPublishedCloudSkills.get(doc.id)?.skill_key === doc.skill_key) {
            myPublishedCloudSkills.delete(doc.id);
          }
          setCloudStatusLog(`[CLOUD DELETED] Đã xóa "${doc.name}" khỏi MongoDB.`);
          renderCloudSkillsList(cachedCloudSkills.filter((x) => x.skill_key !== doc.skill_key));
          renderToolForgeSkillsList();
        } catch (err) {
          setCloudStatusLog(`[DELETE ERR] ${String(err)}`);
          btnDeleteCloud.disabled = false;
          btnDeleteCloud.textContent = 'Xóa (Của Tôi)';
        }
      });
      btnRow.appendChild(btnDeleteCloud);
    }

    card.append(head, descEl, btnRow);
    container.appendChild(card);
  });
}

async function refreshCloudHubUi() {
  const healthBadge = document.getElementById('tf-hub-health-badge');
  try {
    const [auth, cfg] = await Promise.all([getCloudAuthStatus(), getCloudHubConfig()]);
    renderCloudAuthUi(auth);
    const clientInp = document.getElementById('tf-cfg-google-client-id') as HTMLInputElement | null;
    const hubUrlInp = document.getElementById('tf-cfg-hub-url') as HTMLInputElement | null;
    const secretInp = document.getElementById('tf-cfg-google-secret') as HTMLInputElement | null;

    if (clientInp && document.activeElement !== clientInp) clientInp.value = cfg.google_client_id;
    if (hubUrlInp && document.activeElement !== hubUrlInp) hubUrlInp.value = cfg.cloud_hub_api_url;
    if (secretInp && cfg.has_google_client_secret) {
      secretInp.placeholder = 'Đã lưu Client Secret (nhập mới nếu muốn thay)';
    }

    if (healthBadge) {
      try {
        const h = await checkCloudHubHealth();
        if (h.ok && h.mongo_connected) {
          healthBadge.className = 'badge tf-badge-pass';
          healthBadge.textContent = '[HUB: ONLINE | MONGODB OK]';
        } else if (h.ok) {
          healthBadge.className = 'badge tf-badge-warn';
          healthBadge.textContent = '[HUB: ONLINE | NO DB]';
        } else {
          healthBadge.className = 'badge tf-badge-fail';
          healthBadge.textContent = '[HUB: ERROR]';
        }
      } catch {
        healthBadge.className = 'badge tf-badge-fail';
        healthBadge.textContent = '[HUB: OFFLINE]';
      }
    }
  } catch (err) {
    setCloudStatusLog(`[CLOUD ERR] ${String(err)}`);
    if (healthBadge) {
      healthBadge.className = 'badge tf-badge-fail';
      healthBadge.textContent = '[HUB: OFFLINE]';
    }
  }
}

export function toggleToolForgeModal(forceState?: boolean) {
  const next =
    forceState !== undefined ? forceState : !(isWorkspaceModalOpen() && appState.isToolForgeOpen);
  appState.isToolForgeOpen = next;
  if (next) {
    toggleWorkspaceModal(true, 'studio', 'sandbox');
    void refreshCustomSkills().then(() => renderToolForgeSkillsList());
    void refreshCloudHubUi().then(() => {
      if (cachedCloudAuth?.logged_in) {
        void syncCloudSkillsCacheSilent(false);
      }
    });
    renderToolForgeDraft(getLatestToolForgeDraft());
  } else if (forceState === false && toolForgeModal) {
    toolForgeModal.style.display = 'none';
  }
  syncHitboxToRust(true);
}

let cachedTarotStatus: TarotStatusResponse | null = null;
let displayedTarotReading: TarotReadingRecord | null = null;
let tarotDrawingInFlight = false;
let tarotFlipTimer: number | null = null;
let lastTarotReadyState: boolean | null = null;

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
  syncHitboxToRust(true);
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
    card.title = 'Nhấn để xem lại chi tiết quẻ này';
    card.addEventListener('click', () => {
      displayedTarotReading = rec;
      applyTarotReadingToModal(rec, true);
      setTarotTab('today');
    });
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
    if (tarotFlipTimer !== null) {
      window.clearTimeout(tarotFlipTimer);
      tarotFlipTimer = null;
    }
    if (animateFlip) {
      cardInner.classList.remove('is-flipped');
      void cardInner.offsetWidth;
      tarotFlipTimer = window.setTimeout(() => {
        tarotFlipTimer = null;
        cardInner.classList.add('is-flipped');
      }, 160);
    } else {
      cardInner.classList.add('is-flipped');
    }
  }
}

function updateTarotCooldownCountdown() {
  const cur = cachedTarotStatus?.current_reading || null;
  const now = Date.now();
  const remMs = cur && cur.next_draw_at_ms > now ? cur.next_draw_at_ms - now : 0;
  const ready = remMs <= 0;

  if (cachedTarotStatus) {
    cachedTarotStatus.can_draw = ready;
    cachedTarotStatus.remaining_ms = remMs;
  }

  if (ready !== lastTarotReadyState || appState.isTarotModalOpen) {
    lastTarotReadyState = ready;
    if (dockTarotReadyDot) {
      dockTarotReadyDot.style.display = ready ? 'block' : 'none';
    }
    if (dockToggleReadyDot) {
      dockToggleReadyDot.style.display = ready ? 'block' : 'none';
    }
    if (dockBtnTarot) {
      dockBtnTarot.title = ready
        ? 'Bốc Thẻ Tarot & Tử Vi Vận Mệnh (Sẵn sàng quẻ mới!)'
        : `Tarot & Tử Vi (Quẻ tiếp theo sau ${formatTarotCountdown(remMs)})`;
    }
  }

  if (!appState.isTarotModalOpen) {
    return;
  }

  const cdBadge = document.getElementById('tarot-cooldown-badge');
  const spreadPicker = document.getElementById('tarot-spread-picker');
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
    displayedTarotReading = res.current_reading;
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
    fireAnimationTrigger('event', 'tarot_good', 'enter');
    spawnParticles(appState.posX, appState.posY - 120, 22, 0xfacc15);
  } else if (rec.fortune_code === 'tieu_cat') {
    appState.setExpression('happy', 4.5);
    triggerDance();
    fireAnimationTrigger('event', 'tarot_good', 'enter');
    spawnParticles(appState.posX, appState.posY - 120, 16, 0x34d399);
  } else if (rec.fortune_code === 'binh_hoa') {
    appState.setState('WAVING');
    appState.setExpression('happy', 3.8);
    spawnParticles(appState.posX, appState.posY - 110, 12, 0x38bdf8);
  } else if (rec.fortune_code === 'tieu_hung') {
    appState.setState('ALERT');
    appState.setExpression('surprised', 4.2);
    fireAnimationTrigger('event', 'tarot_bad', 'enter');
    spawnParticles(appState.posX, appState.posY - 110, 14, 0xfb923c);
  } else {
    appState.setState('ALERT');
    appState.setExpression('surprised', 4.8);
    fireAnimationTrigger('event', 'tarot_bad', 'enter');
    spawnParticles(appState.posX, appState.posY - 110, 18, 0xf87171);
  }
}

async function performTarotDrawAndFlip(force = false) {
  if (tarotDrawingInFlight) return;
  tarotDrawingInFlight = true;
  fireAnimationTrigger('tool', 'tarot', 'start');
  let tarotOk = false;
  const drawBtn = document.getElementById('btn-tarot-draw-now') as HTMLButtonElement | null;
  const forceBtn = document.getElementById('btn-tarot-force-draw') as HTMLButtonElement | null;
  const replayBtn = document.getElementById('btn-tarot-replay-3d') as HTMLButtonElement | null;
  const aiDeepBtn = document.getElementById('btn-tarot-ai-deep') as HTMLButtonElement | null;
  const pickBtns = Array.from(document.querySelectorAll('.tarot-pick-card')) as HTMLButtonElement[];
  if (drawBtn) {
    drawBtn.disabled = true;
    drawBtn.textContent = 'Đang kết nối Tarot API & Lật Thẻ 3D...';
  }
  if (forceBtn) {
    forceBtn.disabled = true;
    forceBtn.textContent = 'Đang bốc quẻ...';
  }
  if (replayBtn) replayBtn.disabled = true;
  if (aiDeepBtn) aiDeepBtn.disabled = true;
  pickBtns.forEach((b) => {
    b.disabled = true;
  });
  try {
    const res = await invoke<TarotStatusResponse>('tarot_draw_card', { force });
    cachedTarotStatus = res;
    renderTarotHistoryList(res.history || []);
    const rec = res.current_reading;
    if (rec) {
      tarotOk = true;
      displayedTarotReading = rec;
      applyTarotReadingToModal(rec, true);
      updateTarotCooldownCountdown();
      triggerDuckReactionForTarot(rec);
      const orientText = rec.is_reversed ? 'Ngược Chiều' : 'Thuận Chiều';
      if (res.already_drawn_in_window) {
        speakMessage(
          `[TAROT 6H - ${rec.fortune_label}] Bạn vừa xem quẻ "${rec.card_name_vi}" (${orientText}, ${rec.luck_score}/100) trong chu kỳ 6 giờ này rồi! Bấm "Bốc Quẻ Mới Ngay" nếu muốn rút tiếp nhé.`
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
    fireAnimationTrigger('tool', 'tarot', tarotOk ? 'success' : 'error');
    tarotDrawingInFlight = false;
    if (drawBtn) {
      drawBtn.disabled = false;
      drawBtn.textContent = 'Bốc & Lật Quẻ Tarot Ngay';
    }
    if (forceBtn) {
      forceBtn.disabled = false;
      forceBtn.textContent = 'Bốc Quẻ Mới Ngay';
    }
    if (replayBtn) replayBtn.disabled = false;
    if (aiDeepBtn) aiDeepBtn.disabled = false;
    pickBtns.forEach((b) => {
      b.disabled = false;
    });
  }
}

type EngCoachModule = typeof import('./features/englishCoachUi');
let englishCoachModulePromise: Promise<EngCoachModule> | null = null;

function loadEnglishCoachModule(): Promise<EngCoachModule> {
  if (!englishCoachModulePromise) {
    englishCoachModulePromise = import('./features/englishCoachUi').then((mod) => {
      mod.initEnglishCoachUi({
        closeOthers: () => closeOtherPopupModals('english'),
        syncHitbox: () => syncHitboxToRust(true),
      });
      return mod;
    });
  }
  return englishCoachModulePromise;
}

function hideEnglishCoachFast() {
  appState.isEnglishCoachOpen = false;
  const el = document.getElementById('english-coach-modal');
  if (el) el.style.display = 'none';
  document.getElementById('dock-btn-english')?.classList.remove('active');
  document.getElementById('btn-open-english-coach')?.classList.remove('active');
}

type SmartDropzoneModule = typeof import('./features/smartDropzoneUi');
let smartDropzoneModulePromise: Promise<SmartDropzoneModule> | null = null;

function loadSmartDropzoneModule(): Promise<SmartDropzoneModule> {
  if (!smartDropzoneModulePromise) {
    smartDropzoneModulePromise = import('./features/smartDropzoneUi').then((mod) => {
      mod.initSmartDropzoneUi({
        closeOthers: () => closeOtherPopupModals('dropzone'),
        syncHitbox: () => syncHitboxToRust(true),
        openDashboard: (analysis) => openFileAnalyticsDashboard(analysis),
        openOcrWithText: (txt, imagePath) => {
          const srcEl = document.getElementById('ocr-source-text') as HTMLTextAreaElement | null;
          const dstEl = document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null;
          const metaEl = document.getElementById('ocr-meta-info');
          if (metaEl) {
            metaEl.textContent = imagePath
              ? `Tệp ảnh thả vào: ${imagePath}`
              : 'Quét từ Hộp Thả File Thông Minh';
          }
          if (srcEl) srcEl.value = txt;
          if (dstEl) dstEl.value = '';
          toggleOcrTranslateModal(true);
          if (txt.trim()) {
            void runTranslateOcrModalText(false);
          }
        },
        sendChatPrompt: (prompt) => {
          if (!appState.isBubbleVisible) toggleBubbleVisibility(true);
          if (bubbleInput) {
            bubbleInput.value = prompt;
            handleSendMessage();
          }
        },
        speakMessage,
      });
      return mod;
    });
  }
  return smartDropzoneModulePromise;
}

function hideSmartDropzoneFast() {
  appState.isSmartDropzoneOpen = false;
  const el = document.getElementById('smart-dropzone-modal');
  if (el) el.style.display = 'none';
}

export function toggleEnglishCoachModalLazy(
  forceState?: boolean,
  options?: { tab?: 'learn' | 'srs' | 'quiz' | 'speak'; wordQuery?: string }
) {
  if (forceState === false) {
    hideEnglishCoachFast();
    syncHitboxToRust(true);
    return;
  }
  void loadEnglishCoachModule().then((mod) => {
    mod.toggleEnglishCoachModal(forceState, options);
  });
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

let ocrTranslateSeq = 0;

async function runTranslateOcrModalText(preferAi = false) {
  const srcEl = document.getElementById('ocr-source-text') as HTMLTextAreaElement | null;
  const dstEl = document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null;
  const langSel = document.getElementById('select-ocr-target-lang') as HTMLSelectElement | null;
  const badgeEl = document.getElementById('ocr-engine-badge');
  const btnQuick = document.getElementById('btn-ocr-retranslate') as HTMLButtonElement | null;
  const btnAi = document.getElementById('btn-ocr-ai-translate') as HTMLButtonElement | null;
  if (!srcEl || !dstEl) return;

  const text = srcEl.value.trim();
  if (!text) {
    dstEl.value = '';
    if (badgeEl) badgeEl.textContent = 'Trống';
    return;
  }

  const seq = ++ocrTranslateSeq;
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
  if (btnQuick) btnQuick.disabled = true;
  if (btnAi) btnAi.disabled = true;
  if (langSel) langSel.disabled = true;

  try {
    if (!preferAi) {
      try {
        const res = await invoke<TranslateResult>('translate_text_quick', {
          text,
          targetLang,
        });
        if (seq !== ocrTranslateSeq) return;
        dstEl.value = res.translated_text;
        if (badgeEl) badgeEl.textContent = `${res.engine} (${res.detected_lang}->${targetLang})`;
        return;
      } catch {
        // Fallback sang AI neu mang bi chan
      }
    }

    try {
      const aiRes = await translateTextWithAi(text, langLabel);
      if (seq !== ocrTranslateSeq) return;
      dstEl.value = aiRes.translated;
      if (badgeEl) badgeEl.textContent = aiRes.engine;
    } catch (err) {
      if (seq !== ocrTranslateSeq) return;
      dstEl.value = `[LỖI DỊCH] ${String(err)}`;
      if (badgeEl) badgeEl.textContent = '[LỖI]';
    }
  } finally {
    if (seq === ocrTranslateSeq) {
      if (btnQuick) btnQuick.disabled = false;
      if (btnAi) btnAi.disabled = false;
      if (langSel) langSel.disabled = false;
    }
  }
}

let bubbleHiddenForSnip = false;

function finishSnipOverlayReset() {
  const overlay = document.getElementById('ocr-snip-overlay');
  const rectEl = document.getElementById('ocr-snip-rect');
  if (rectEl) rectEl.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  appState.isOcrSnipMode = false;
  if (bubbleHiddenForSnip) {
    bubbleHiddenForSnip = false;
    if (speechBubble && appState.isBubbleVisible) speechBubble.style.display = 'flex';
    if (companionDock) companionDock.style.display = 'flex';
  }
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
  if (speechBubble && speechBubble.style.display !== 'none') {
    bubbleHiddenForSnip = true;
    speechBubble.style.display = 'none';
  }
  if (companionDock) companionDock.style.display = 'none';
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

  const btnConnect = document.getElementById('btn-p2p-connect') as HTMLButtonElement | null;
  if (btnConnect) {
    if (st.phase === 'waiting_consent') {
      btnConnect.disabled = true;
      btnConnect.textContent = 'Đang Chờ Đồng Ý...';
    } else if (isConnectedOrActive) {
      btnConnect.disabled = true;
      btnConnect.textContent = 'Đã Kết Nối Phòng';
    } else {
      btnConnect.disabled = false;
      btnConnect.textContent = 'Gửi Yêu Cầu Handshake';
    }
  }
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
      'display: flex; justify-content: space-between; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.5); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.1); font-size: 11px;';

    const info = document.createElement('div');
    info.style.cssText = 'display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden;';
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'color: #c084fc; font-weight: 600; white-space: nowrap;';
    nameSpan.textContent = `[${item.name}]`;
    const origSpan = document.createElement('span');
    origSpan.style.cssText = 'color: #64748b; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    origSpan.textContent = `(${item.origin})`;
    info.append(nameSpan, origSpan);

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 7px; flex-shrink: 0;';

    const ttsCheck = document.createElement('input');
    ttsCheck.type = 'checkbox';
    ttsCheck.checked = item.speech_alert;
    ttsCheck.title = 'Đọc to TTS khi có thông báo';
    ttsCheck.addEventListener('change', () => {
      item.speech_alert = ttsCheck.checked;
      void updateNotificationSettings(currentNotifSettings!);
    });

    const enableLabel = document.createElement('span');
    enableLabel.style.cssText = 'color: #94a3b8; font-size: 10px;';
    enableLabel.textContent = 'Bật:';

    const enableCheck = document.createElement('input');
    enableCheck.type = 'checkbox';
    enableCheck.checked = item.enabled;
    enableCheck.title = 'Bật/Tắt nhận thông báo từ web origin này';
    enableCheck.addEventListener('change', () => {
      item.enabled = enableCheck.checked;
      void updateNotificationSettings(currentNotifSettings!);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn-tiny';
    delBtn.textContent = 'x';
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
    controls.appendChild(enableLabel);
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
  const orbHitKey = isDockExpanded
    ? 'exp'
    : `${Math.round(orbX / 6)},${Math.round(orbY / 6)}`;
  const charKey = `${cx}|${cy}|${rad}|${isDragging ? 1 : 0}|${orbHitKey}`;

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

  const pushRect = (el: HTMLElement | null | undefined, visible: boolean, allowFullscreen = false) => {
    if (!visible || !el) return;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const vw = appState.W || window.innerWidth || 1920;
    const vh = appState.H || window.innerHeight || 1080;
    if (!allowFullscreen && r.width >= vw - 10 && r.height >= vh - 10) {
      return;
    }
    uiRects.push({
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  };

  if (!isWorkspaceModalOpen() && appState.isToolForgeOpen) {
    appState.isToolForgeOpen = false;
  }

  pushRect(leftTelemetryPanel, appState.isLeftPanelOpen);
  pushRect(rightActionPanel, appState.isRightPanelOpen);
  pushRect(speechBubble, appState.isBubbleVisible);
  if (chatDialogPanel && !speechBubble?.contains(chatDialogPanel)) {
    pushRect(chatDialogPanel, appState.isChatOpen);
  }
  if (isDockExpanded) {
    pushRect(companionDock, true);
  } else {
    const orbEl = dockBtnToggle || companionDock;
    if (orbEl) {
      const r = orbEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const pad = 7;
        uiRects.push({
          x: Math.round(r.left - pad),
          y: Math.round(r.top - pad),
          w: Math.round(r.width + pad * 2),
          h: Math.round(r.height + pad * 2),
        });
      }
    }
  }
  pushRect(studioPanel, appState.isStudioOpen);
  pushRect(longMemoryPanel, appState.isLongMemoryOpen);
  pushRect(notificationPanel, appState.isNotificationManagerOpen);
  pushRect(p2pArenaPanel, appState.isP2pArenaOpen);
  pushRect(pcControlModal, appState.isPcControlOpen);
  pushRect(ocrTranslateModal, appState.isOcrModalOpen);
  pushRect(toolForgeModal, appState.isToolForgeOpen);
  pushRect(tarotModal, appState.isTarotModalOpen);
  pushRect(miniScreenPanel, appState.isMiniScreenOpen);
  const englishCoachEl = document.getElementById('english-coach-modal');
  if (englishCoachEl && appState.isEnglishCoachOpen) {
    pushRect(englishCoachEl, true);
  }
  const smartDropzoneEl = document.getElementById('smart-dropzone-modal');
  if (smartDropzoneEl && appState.isSmartDropzoneOpen) {
    pushRect(smartDropzoneEl, true);
  }
  const ocrSnipEl = document.getElementById('ocr-snip-overlay');
  if (ocrSnipEl && appState.isOcrSnipMode) {
    pushRect(ocrSnipEl, true, true);
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
  const p2pUltraViewModal = document.getElementById('p2p-ultraview-modal');
  if (p2pUltraViewModal && p2pUltraViewModal.style.display !== 'none') {
    pushRect(p2pUltraViewModal, true);
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
  const animManagerEl = document.getElementById('anim-manager-modal');
  if (animManagerEl && animManagerEl.style.display !== 'none') {
    pushRect(animManagerEl, true);
  }
  const dwsModalEl = document.getElementById('duck-workspace-modal');
  if (dwsModalEl && isWorkspaceModalOpen()) {
    pushRect(dwsModalEl, true);
  }
  const dwsLightboxEl = document.getElementById('duck-lightbox-modal');
  if (dwsLightboxEl && isLightboxModalOpen()) {
    pushRect(dwsLightboxEl, true, true);
  }

  if (force && !appState.isFileDragHovering && !appState.isOcrSnipMode && !appState.blackHoleWarpMode) {
    invoke('set_manual_interactive', { interactive: false }).catch(() => { });
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
  fireAnimationTrigger('event', 'chat_send', 'enter');

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
  } else if (
    lower === 'quản lý hoạt ảnh' ||
    lower === 'hoạt ảnh' ||
    lower === 'animation manager' ||
    lower === 'anim manager'
  ) {
    window.dispatchEvent(new CustomEvent('duck-open-anim-manager'));
    speakMessage('[ANIM MANAGER] Đã mở Quản lý Hoạt Ảnh & Gắn kết Tool / Trạng thái!');
  } else {
    void chatWithLocalLlm(text);
  }
}

let uiFollowX = appState.posX;
let uiFollowY = appState.posY;
let lastBubbleLayoutW = 0;
let lastBubbleLayoutH = 0;

export function initUi() {
  mountUi();
  bindDomRefs();
  ensureStickyNotesWidget();

  window.addEventListener('duck-close-other-modals', () => {
    closeOtherPopupModals('anim');
    syncHitboxToRust(true);
  });

  typewriterTarget = bubbleContent.textContent?.trim() || '';
  typewriterIndex = typewriterTarget.length;

  if (appState.builtinModelType === 'microduck') {
    btnActDuck.textContent = 'Đổi Cyber Idol';
  }

  btnCloseLeft.addEventListener('click', () => toggleLeftPanel(false));
  btnCloseRight?.addEventListener('click', () => toggleRightPanel(false));
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

  dockBtnToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCompanionDock();
  });
  companionDock?.addEventListener('pointerenter', () => {
    if (!isDockExpanded) {
      isOrbHovered = true;
      orbVelX = 0;
      orbVelY = 0;
      if (companionDock) companionDock.style.transform = '';
    }
  });
  companionDock?.addEventListener('pointerleave', () => {
    if (isOrbHovered) {
      isOrbHovered = false;
      orbSettled = false;
      window.dispatchEvent(new CustomEvent('duck-wake-loop'));
    }
  });
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!isDockExpanded || !companionDock) return;
      const target = e.target as Node | null;
      if (target && companionDock.contains(target)) return;
      toggleCompanionDock(false);
    },
    { passive: true }
  );
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDockExpanded) {
      toggleCompanionDock(false);
    }
  });

  window.addEventListener('duck-chat-switch-compact', () => {
    toggleBubbleVisibility(true);
  });

  // Tự động ẩn tạm các khung overlay (Workspace Chat, Bubble, Dock) khi AI thực thi skill chụp ảnh / Zalo / GUI
  let tempHideSavedWs = false;
  let tempHideSavedBubble = false;
  let tempHideDepth = 0;
  window.addEventListener('duck-overlay-temp-hide', (ev: Event) => {
    const hide = Boolean((ev as CustomEvent<{ hide?: boolean }>).detail?.hide);
    const dwsEl = document.getElementById('duck-workspace-modal');
    if (hide) {
      if (tempHideDepth === 0) {
        tempHideSavedWs = isWorkspaceModalOpen();
        tempHideSavedBubble = Boolean(speechBubble && speechBubble.style.display !== 'none');
        if (tempHideSavedWs && dwsEl) dwsEl.style.display = 'none';
        if (tempHideSavedBubble && speechBubble) speechBubble.style.display = 'none';
        if (companionDock) companionDock.style.display = 'none';
        syncHitboxToRust(true);
      }
      tempHideDepth += 1;
    } else {
      tempHideDepth = Math.max(0, tempHideDepth - 1);
      if (tempHideDepth === 0) {
        if (tempHideSavedWs && dwsEl) dwsEl.style.display = 'flex';
        if (tempHideSavedBubble && speechBubble && appState.isBubbleVisible) {
          speechBubble.style.display = 'flex';
        }
        if (companionDock) companionDock.style.display = 'flex';
        tempHideSavedWs = false;
        tempHideSavedBubble = false;
        syncHitboxToRust(true);
      }
    }
  });

  dockBtnLeft.addEventListener('click', () => toggleLeftPanel());
  dockBtnChat.addEventListener('click', () => {
    if (isWorkspaceModalOpen()) {
      toggleWorkspaceModal(false);
      toggleBubbleVisibility(true);
    } else {
      toggleBubbleVisibility();
    }
  });
  dockBtnRight?.addEventListener('click', () => toggleRightPanel());
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
    toggleCompanionDock(false);
    toggleLeftPanel(false);
    toggleRightPanel(false);
    toggleBubbleVisibility(false);
    toggleChatVisibility(false);
    toggleWorkspaceModal(false);
    toggleStudioModal(false);
    toggleLongMemoryModal(false);
    toggleNotificationModal(false);
    toggleP2pArenaModal(false);
    togglePcControlModal(false);
    toggleOcrTranslateModal(false);
    toggleToolForgeModal(false);
    toggleWorkspaceModal(false);
    toggleTarotModal(false);
    toggleEnglishCoachModalLazy(false);
    hideSmartDropzoneFast();
    toggleMiniScreenPanel(false);
    closeFileAnalyticsDashboard();
    toggleStickyNotesWidget(false);
    window.dispatchEvent(new CustomEvent('duck-close-anim-manager'));
  });

  document.getElementById('btn-cfg-show-ui')?.addEventListener('click', () => {
    toggleStudioModal(false);
    toggleBubbleVisibility(true);
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

  const chkCfgAudioBeat3d = document.getElementById(
    'chk-cfg-audio-beat-3d'
  ) as HTMLInputElement | null;
  if (chkCfgAudioBeat3d) {
    chkCfgAudioBeat3d.checked = appState.audioVisualizer3dEnabled;
    chkCfgAudioBeat3d.addEventListener('change', () => {
      appState.audioVisualizer3dEnabled = chkCfgAudioBeat3d.checked;
      localStorage.setItem('mate_audio_viz_3d', String(appState.audioVisualizer3dEnabled));
      speakMessage(
        appState.audioVisualizer3dEnabled
          ? '[BEAT SYNC 3D] Đã bật Sân Khấu Sóng Nhạc 3D & Cảm Ứng Nhịp Bass theo âm thanh hệ thống.'
          : '[BEAT SYNC 3D] Đã tắt Sân Khấu Sóng Nhạc 3D dưới chân Vịt.'
      );
    });
  }

  chkCfgVoiceTts?.addEventListener('change', () => {
    const muteNow = !chkCfgVoiceTts.checked;
    setDuckVoiceMuted(muteNow);
    syncDockVoiceUi();
    void saveStudioConfigToSqlite();
    if (muteNow) {
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
    syncHitboxToRust(true);
  });

  document.getElementById('btn-cfg-sync-weather-api')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    appState.weatherSourceMode = 'api';
    localStorage.setItem('mate_weather_source_mode', 'api');
    syncWeatherSourceUiBoxes();
    const city = inputCfgWeatherCity?.value.trim() || 'auto';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang tải...';
    }
    try {
      await saveStudioConfigToSqlite();
      await syncLiveWeather3D('auto', true, city);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lấy API Ngay';
      }
    }
  });

  document.getElementById('btn-cfg-apply-weather-custom')?.addEventListener('click', () => {
    applyCustomWeatherConfig(true);
  });

  btnOpenStudio.addEventListener('click', () => toggleStudioModal(true));
  btnCloseStudio.addEventListener('click', () => toggleStudioModal(false));

  btnOpenLongMem.addEventListener('click', () => toggleLongMemoryModal(true));
  btnCloseLongMem.addEventListener('click', () => toggleLongMemoryModal(false));
  const LM_PRESET_CUTE_TEXT =
    'Nhí nhảnh, đáng yêu, gọi người dùng là Chủ nhân, luôn quan tâm nhắc uống nước, nghỉ mắt và cổ vũ tinh thần.';
  const LM_PRESET_DEV_TEXT =
    'Phong thái Kỹ sư Phần mềm Senior điềm tĩnh, trả lời thẳng trọng tâm, ưu tiên code chuẩn, hiệu năng và bảo mật.';
  const LM_PRESET_TSUN_TEXT =
    'Cá tính kiểu Tsundere hơi cằn nhằn đáng yêu nhưng thực chất rất chu đáo và luôn lo cho chủ nhân.';
  const syncLongMemoryPresetActiveUi = () => {
    const val = lmPersonaInput?.value.trim() || '';
    lmPresetCute?.classList.toggle('active', val === LM_PRESET_CUTE_TEXT);
    lmPresetDev?.classList.toggle('active', val === LM_PRESET_DEV_TEXT);
    lmPresetTsun?.classList.toggle('active', val === LM_PRESET_TSUN_TEXT);
  };
  lmPersonaInput.addEventListener('input', syncLongMemoryPresetActiveUi);
  window.addEventListener('duck-long-memory-updated', () => {
    syncLongMemoryPresetActiveUi();
    if (appState.isLongMemoryOpen) {
      syncHitboxToRust(true);
    }
  });
  lmPresetCute.addEventListener('click', () => {
    lmPersonaInput.value = LM_PRESET_CUTE_TEXT;
    syncLongMemoryPresetActiveUi();
  });
  lmPresetDev.addEventListener('click', () => {
    lmPersonaInput.value = LM_PRESET_DEV_TEXT;
    syncLongMemoryPresetActiveUi();
  });
  lmPresetTsun.addEventListener('click', () => {
    lmPersonaInput.value = LM_PRESET_TSUN_TEXT;
    syncLongMemoryPresetActiveUi();
  });
  btnSavePersona.addEventListener('click', async () => {
    btnSavePersona.disabled = true;
    btnSavePersona.textContent = 'Đang lưu...';
    try {
      await saveLongMemoryEntry('persona', 'Tính cách nhân vật', lmPersonaInput.value);
      syncLongMemoryPresetActiveUi();
      btnSavePersona.textContent = 'Đã Lưu!';
      window.setTimeout(() => {
        if (btnSavePersona.textContent === 'Đã Lưu!') {
          btnSavePersona.textContent = 'Lưu Prompt Tính Cách';
        }
      }, 1200);
    } finally {
      btnSavePersona.disabled = false;
      if (btnSavePersona.textContent === 'Đang lưu...') {
        btnSavePersona.textContent = 'Lưu Prompt Tính Cách';
      }
    }
  });
  btnAddLongMem.addEventListener('click', async () => {
    const cat = lmCatSelect.value || 'rule';
    const title = lmTitleInput.value.trim() || (cat === 'rule' ? 'Rule dài hạn' : 'Kiến thức');
    const content = lmContentInput.value.trim();
    if (!content) return;
    btnAddLongMem.disabled = true;
    btnAddLongMem.textContent = 'Đang thêm...';
    try {
      lmTitleInput.value = '';
      lmContentInput.value = '';
      await saveLongMemoryEntry(cat, title, content);
      btnAddLongMem.textContent = 'Đã Thêm!';
      window.setTimeout(() => {
        if (btnAddLongMem.textContent === 'Đã Thêm!') {
          btnAddLongMem.textContent = 'Thêm';
        }
      }, 1200);
    } finally {
      btnAddLongMem.disabled = false;
      if (btnAddLongMem.textContent === 'Đang thêm...') {
        btnAddLongMem.textContent = 'Thêm';
      }
    }
  });
  lmContentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddLongMem.click();
    }
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
    syncStudioAvatarActiveUi();
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
  document.getElementById('btn-act-paper-crash')?.addEventListener('click', () => {
    triggerWindowPaperCrash();
  });
  document.getElementById('btn-act-hulk')?.addEventListener('click', () => {
    triggerHulkRageMode();
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

  // Kho Hoạt ảnh Đa Pha & Hiệu ứng 3D Mới trên Bảng Phải
  const selQuick3dClip = document.getElementById('select-quick-3d-clip') as HTMLSelectElement | null;
  const selQuick3dFx = document.getElementById('select-quick-3d-fx') as HTMLSelectElement | null;
  const btnPlayQuick3dClip = document.getElementById('btn-play-quick-3d-clip') as HTMLButtonElement | null;
  const btnRandom3dClip = document.getElementById('btn-random-3d-clip') as HTMLButtonElement | null;
  const btnPlayQuick3dFx = document.getElementById('btn-play-quick-3d-fx') as HTMLButtonElement | null;

  const applyClipMoodUi = (clip: { id: string; label: string; defaultDuration: number; description: string }) => {
    const expr =
      clip.id === 'dramatic_flop' ||
        clip.id === 'shy_sit' ||
        clip.id === 'sad' ||
        clip.id === 'facepalm' ||
        clip.id === 'head_shake'
        ? 'sad'
        : clip.id === 'startled_hop' ||
          clip.id === 'dizzy_spin' ||
          clip.id === 'surprise' ||
          clip.id === 'shiver' ||
          clip.id === 'sneeze'
          ? 'surprised'
          : 'happy';
    appState.setExpression(expr, clip.defaultDuration + 0.4);
    appState.changeMood(3);
    if (selQuick3dClip) selQuick3dClip.value = clip.id;
    speakMessage(`[3D] ${clip.label}: ${clip.description}`);
  };

  const runQuick3dClip = (clipId: string) => {
    const clip = getClipById(clipId);
    if (!clip) return;
    previewClip(clipId);
    applyClipMoodUi(clip);
  };

  if (selQuick3dClip) {
    const grpLabels: Record<ClipGroup, string> = {
      emotion: 'Cảm xúc & Xã hội',
      lifelike: 'Chờ & Sinh học',
      motion: 'Vật lý & Vui nhộn',
      work: 'Làm việc & AI',
      special: 'Đặc biệt',
    };
    const groups: ClipGroup[] = ['work', 'emotion', 'special', 'motion', 'lifelike'];
    selQuick3dClip.innerHTML = groups
      .map(
        (g) =>
          `<optgroup label="${grpLabels[g]}">${CLIP_CATALOG.filter((c) => c.group === g)
            .map((c) => `<option value="${c.id}">${c.label}${c.featured ? ' [3D]' : ''}</option>`)
            .join('')}</optgroup>`
      )
      .join('');
    selQuick3dClip.value = 'ai_thinking_orbit';
  }

  if (selQuick3dFx) {
    selQuick3dFx.innerHTML = SPECIAL_3D_EFFECT_CATALOG.map(
      (f) => `<option value="${f.id}">${f.label}</option>`
    ).join('');
  }

  document.querySelectorAll<HTMLButtonElement>('#right-action-panel [data-play-clip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.playClip;
      if (id) runQuick3dClip(id);
    });
  });

  btnPlayQuick3dClip?.addEventListener('click', () => {
    if (selQuick3dClip?.value) runQuick3dClip(selQuick3dClip.value);
  });

  btnRandom3dClip?.addEventListener('click', () => {
    const pick = playRandomClipFromDeck();
    applyClipMoodUi(pick);
  });

  btnPlayQuick3dFx?.addEventListener('click', () => {
    const fxId = selQuick3dFx?.value;
    const chosen = triggerRandomSpecial3DEffect(appState.posX, appState.posY, fxId);
    const meta = SPECIAL_3D_EFFECT_CATALOG.find((x) => x.id === chosen);
    appState.setExpression('happy', 2.8);
    speakMessage(`[FX 3D] Đã kích hoạt hiệu ứng: ${meta?.label || chosen}!`);
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
  document.getElementById('btn-eng-translate')?.addEventListener('click', () => {
    void translateCurrentEnglishLesson();
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
    fireAnimationTrigger('tool', 'ocr', 'start');
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
    speakMessage('[OCR VÙNG] Đang quét chữ từ vùng vừa cắt và dịch...');
    let ocrOk = false;

    try {
      const res = await invoke<OcrRegionResult>('ocr_screen_region', {
        xRatio,
        yRatio,
        wRatio,
        hRatio,
      });
      ocrOk = true;
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
    } finally {
      fireAnimationTrigger('tool', 'ocr', ocrOk ? 'success' : 'error');
      window.setTimeout(() => {
        if (appState.state === 'SCANNING') {
          appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
        }
      }, 600);
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
  document.getElementById('btn-ocr-copy-src')?.addEventListener('click', (ev) => {
    const val = (document.getElementById('ocr-source-text') as HTMLTextAreaElement | null)?.value || '';
    if (!val.trim()) return;
    const btn = ev.currentTarget as HTMLButtonElement | null;
    void invoke('set_clipboard_text', { text: val })
      .then(() => {
        speakMessage('[OCR] Đã copy văn bản gốc vào Clipboard!');
        if (btn) {
          btn.textContent = 'Đã Copy!';
          window.setTimeout(() => {
            btn.textContent = 'Copy Gốc';
          }, 1300);
        }
      })
      .catch(() => { });
  });
  document.getElementById('btn-ocr-copy-dst')?.addEventListener('click', (ev) => {
    const val = (document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null)?.value || '';
    if (!val.trim()) return;
    const btn = ev.currentTarget as HTMLButtonElement | null;
    void invoke('set_clipboard_text', { text: val })
      .then(() => {
        speakMessage('[OCR] Đã copy bản dịch vào Clipboard!');
        if (btn) {
          btn.textContent = 'Đã Copy!';
          window.setTimeout(() => {
            btn.textContent = 'Copy Bản Dịch';
          }, 1300);
        }
      })
      .catch(() => { });
  });
  document.getElementById('btn-ocr-speak-dst')?.addEventListener('click', () => {
    const val = (document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null)?.value.trim();
    const fallback = (document.getElementById('ocr-source-text') as HTMLTextAreaElement | null)?.value.trim();
    const out = val || fallback;
    if (out) speakMessage(out);
  });
  document.getElementById('btn-ocr-save-vocab')?.addEventListener('click', () => {
    const src = (document.getElementById('ocr-source-text') as HTMLTextAreaElement | null)?.value.trim() || '';
    const dst = (document.getElementById('ocr-translated-text') as HTMLTextAreaElement | null)?.value.trim() || '';
    const textForWord = /[a-zA-Z]{2,}/.test(src) ? src : dst;
    if (!textForWord) return;
    void loadEnglishCoachModule().then((mod) => mod.openEnglishCoachWithWord(textForWord));
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

  window.addEventListener('duck-open-english-coach', (ev: Event) => {
    const detail = (ev as CustomEvent).detail as
      | { tab?: 'learn' | 'srs' | 'quiz' | 'speak'; wordQuery?: string }
      | undefined;
    toggleEnglishCoachModalLazy(true, detail);
  });
  window.addEventListener('duck-smart-dropzone-open', (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { items?: Array<File | string> } | undefined;
    if (detail?.items && detail.items.length > 0) {
      void loadSmartDropzoneModule().then((mod) => {
        mod.openSmartDropzoneForItems(detail.items || []);
      });
    }
  });
  window.addEventListener('duck-start-ocr-snip', () => startOcrRegionSnip());
  window.addEventListener('duck-open-pc-control', () => togglePcControlModal(true));
  window.addEventListener('duck-skills-updated', () => {
    renderToolForgeSkillsList();
    refreshAutomationSkillSelect();
  });
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

  // Gợi ý đóng gói quy trình Agent vừa hoàn thành thành Tool/Skill dùng lại
  let pendingAgentTrace: AgentWorkflowTrace | null = null;
  const suggestBar = document.getElementById('agent-suggest-tool-bar');
  const suggestText = document.getElementById('agent-suggest-tool-text');
  const btnSaveAsTool = document.getElementById('btn-agent-save-as-tool');
  const btnDismissTool = document.getElementById('btn-agent-dismiss-tool');

  window.addEventListener('duck-agent-suggest-tool', (ev: Event) => {
    const trace = (ev as CustomEvent).detail as AgentWorkflowTrace | undefined;
    if (!trace || !suggestBar) return;
    pendingAgentTrace = trace;
    if (suggestText) {
      const shortGoal = trace.goal.length > 42 ? `${trace.goal.slice(0, 42)}...` : trace.goal;
      suggestText.textContent = `[GỢI Ý TOOL] Lưu "${shortGoal}" thành Tool?`;
    }
    suggestBar.style.display = 'flex';
  });

  btnDismissTool?.addEventListener('click', () => {
    if (suggestBar) suggestBar.style.display = 'none';
    pendingAgentTrace = null;
  });

  btnSaveAsTool?.addEventListener('click', async () => {
    if (!pendingAgentTrace) return;
    const trace = pendingAgentTrace;
    const reqText = buildToolForgePromptFromTrace(trace);
    if (suggestBar) suggestBar.style.display = 'none';
    pendingAgentTrace = null;

    const instantDraft = await buildVerifiedDraftFromAgentTrace(trace);
    if (instantDraft) {
      window.dispatchEvent(
        new CustomEvent('duck-open-tool-forge', {
          detail: { draft: instantDraft, requestText: reqText },
        })
      );
      return;
    }

    window.dispatchEvent(
      new CustomEvent('duck-open-tool-forge', { detail: { requestText: reqText } })
    );
    setTimeout(() => {
      document.getElementById('btn-tf-generate')?.click();
    }, 150);
  });

  btnPcToolForge?.addEventListener('click', () => {
    toggleToolForgeModal(true);
  });
  document.getElementById('tab-btn-pc-main')?.addEventListener('click', () => {
    setPcControlTab('main');
  });
  document.getElementById('tab-btn-pc-mini')?.addEventListener('click', () => {
    setPcControlTab('mini');
  });
  document.getElementById('tab-btn-pc-qr')?.addEventListener('click', () => {
    setPcControlTab('qr');
  });
  document.getElementById('select-pc-qr-ip')?.addEventListener('change', (ev) => {
    const ip = (ev.currentTarget as HTMLSelectElement | null)?.value || '';
    void refreshPcQrDeckUi(ip);
  });
  document.getElementById('btn-pc-qr-copy')?.addEventListener('click', (ev) => {
    if (!cachedQrDeckUrl) return;
    const btn = ev.currentTarget as HTMLButtonElement | null;
    void invoke('set_clipboard_text', { text: cachedQrDeckUrl }).then(() => {
      speakMessage(`[QR DECK] Đã copy link điều khiển điện thoại: ${cachedQrDeckUrl}`);
      if (btn) {
        btn.textContent = 'Đã Copy Link!';
        window.setTimeout(() => {
          btn.textContent = 'Copy Link Mobile';
        }, 1500);
      }
    });
  });
  document.getElementById('btn-pc-qr-open')?.addEventListener('click', () => {
    const testUrl = cachedQrDeckUrl || 'http://127.0.0.1:39282/deck';
    void invoke('open_web_or_app', { target: testUrl }).catch(() => { });
  });
  document.getElementById('btn-pc-qr-regen')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      await invoke('p2p_regenerate_room');
      await refreshPcQrDeckUi();
      speakMessage('[QR DECK] Đã tạo mã PIN mới cho Mobile Remote Deck!');
    } catch (err) {
      speakMessage(`[QR DECK ERR] ${String(err)}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  document.getElementById('btn-pc-qr-firewall')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    const prev = btn?.textContent || 'Mở Cổng Firewall LAN';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang xin quyền...';
    }
    try {
      const msg = await invoke<string>('p2p_open_firewall_port');
      speakMessage(msg);
      if (btn) btn.textContent = 'Đã Mở Cổng!';
    } catch (err) {
      speakMessage(`[FIREWALL] ${String(err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        window.setTimeout(() => {
          btn.textContent = prev;
        }, 2200);
      }
    }
  });
  btnPcMiniScreen?.addEventListener('click', () => {
    setPcControlTab('mini');
  });
  document.getElementById('btn-pc-undock-mini')?.addEventListener('click', () => {
    togglePcControlModal(false);
    undockMiniScreenFromPcControl();
  });
  dockBtnMiniScreen?.addEventListener('click', () => {
    toggleMiniScreenPanel();
  });

  initMiniScreenUi({
    getMiniScreenPanel: () => miniScreenPanel,
    getDockBtnMiniScreen: () => dockBtnMiniScreen,
    syncHitboxToRust,
    speakMessage,
    runPcMedia,
    findTargetWindow,
  });

  const bindDialogDrag = (
    el: HTMLElement | null,
    handleSelector = '.panel-header',
    opts?: DialogInteractOptions
  ) => makeDialogDraggable(el, handleSelector, syncHitboxToRust, opts);

  bindDialogDrag(speechBubble, '.bubble-header', {
    minWidth: 290,
    minHeight: 118,
    keepFollowOnResize: true,
  });
  bindDialogDrag(leftTelemetryPanel, '.panel-header', { minWidth: 235, minHeight: 180 });
  bindDialogDrag(rightActionPanel, '.panel-header', { minWidth: 235, minHeight: 200 });
  bindDialogDrag(studioPanel, '.panel-header', { minWidth: 340, minHeight: 260 });
  bindDialogDrag(longMemoryPanel, '.panel-header', { minWidth: 320, minHeight: 240 });
  bindDialogDrag(notificationPanel, '.panel-header', { minWidth: 340, minHeight: 250 });
  bindDialogDrag(p2pArenaPanel, '.panel-header', { minWidth: 340, minHeight: 260 });
  bindDialogDrag(pcControlModal, '.panel-header', { minWidth: 360, minHeight: 260 });
  bindDialogDrag(ocrTranslateModal, '.panel-header', { minWidth: 380, minHeight: 260 });
  bindDialogDrag(toolForgeModal, '.panel-header', { minWidth: 360, minHeight: 260 });
  bindDialogDrag(tarotModal, '.panel-header', { minWidth: 360, minHeight: 280 });
  bindDialogDrag(document.getElementById('english-coach-modal'), '.panel-header', {
    minWidth: 380,
    minHeight: 280,
  });
  bindDialogDrag(document.getElementById('smart-dropzone-modal'), '.panel-header', {
    minWidth: 340,
    minHeight: 220,
  });
  bindDialogDrag(document.getElementById('anim-manager-modal'), '.panel-header', {
    minWidth: 420,
    minHeight: 300,
  });
  bindDialogDrag(document.getElementById('file-dashboard-modal'), '.fd-header', {
    minWidth: 380,
    minHeight: 260,
  });
  bindDialogDrag(document.getElementById('p2p-ultraview-modal'), '.p2p-uv-topbar', {
    minWidth: 420,
    minHeight: 280,
  });

  document.getElementById('btn-close-tool-forge')?.addEventListener('click', () => {
    toggleToolForgeModal(false);
  });
  document.getElementById('tab-btn-tf-forge')?.addEventListener('click', () => {
    setToolForgeTab('forge');
  });
  document.getElementById('tab-btn-tf-skills')?.addEventListener('click', () => {
    setToolForgeTab('skills');
    void refreshCustomSkills().then(() => renderToolForgeSkillsList());
    void syncCloudSkillsCacheSilent(false);
  });
  document.getElementById('tab-btn-tf-packs')?.addEventListener('click', () => {
    setToolForgeTab('packs');
    void refreshProj11PacksUi(false);
  });
  document.getElementById('tab-btn-studio-llm')?.addEventListener('click', () => {
    void refresh9RouterStudioUi();
  });
  const fetchCloudSkillsNow = async () => {
    const btn = document.getElementById('btn-tf-cloud-fetch') as HTMLButtonElement | null;
    const q = (document.getElementById('tf-cloud-search') as HTMLInputElement | null)?.value.trim() || '';
    const lang = (document.getElementById('tf-cloud-lang-filter') as HTMLSelectElement | null)?.value || 'all';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang tải...';
    }
    setCloudStatusLog('[CLOUD] Đang kết nối MongoDB Atlas Data API...');
    try {
      const items = await listCommunitySkills(q || undefined, lang);
      renderCloudSkillsList(items);
      if (!q && lang === 'all') {
        hasFetchedCloudSkillsOnce = true;
        rebuildMyPublishedCloudSkillsMap(items);
        renderToolForgeSkillsList();
      }
      setCloudStatusLog(`[CLOUD OK] Đã tải ${items.length} Skill từ MongoDB.`);
    } catch (err) {
      const msg = String(err);
      setCloudStatusLog(`[CLOUD ERR] ${msg}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Tải Danh Sách';
      }
    }
  };
  document.getElementById('tab-btn-tf-cloud')?.addEventListener('click', async () => {
    setToolForgeTab('cloud');
    await refreshCloudHubUi();
    if (cachedCloudAuth?.logged_in && !hasFetchedCloudSkillsOnce) {
      void fetchCloudSkillsNow();
    }
  });
  const autoDeps = {
    speakMessage,
    runQuickBuiltinAction: async (actionId: string) => {
      if (actionId === 'builtin:clean_ram') return invoke<string>('hardware_action', { action: 'clean_ram' });
      if (actionId === 'builtin:check_git') return invoke<string>('check_git_status', { path: null });
      if (actionId === 'builtin:check_ports') return invoke<string>('manage_ports', { action: 'list', port: null });
      if (actionId === 'builtin:top_proc') return invoke<string>('manage_processes', { action: 'top_ram', target: null });
      if (actionId === 'builtin:weather_3d') return syncLiveWeather3D('auto', false);
      return 'Đã chạy.';
    },
  };
  document.getElementById('tab-btn-tf-auto')?.addEventListener('click', () => {
    setToolForgeTab('auto');
    void refreshAutomationRulesUi(autoDeps);
  });
  initAutomationRulesUi(autoDeps);
  initProj12BrainUi(speakMessage);
  initWorkspaceChatUi({
    onSendChat: (txt) => {
      if (bubbleInput) {
        bubbleInput.value = txt;
        handleSendMessage();
      }
    },
    onSyncHitbox: () => syncHitboxToRust(true),
    onSpeak: speakMessage,
    onBeforeOpen: () => {
      closeOtherPopupModals('workspace');
      if (appState.isBubbleVisible) {
        toggleBubbleVisibility(false);
      }
    },
    onOpenWebChat: () => {
      void handleOpenWebChat();
    },
  });
  document.getElementById('btn-open-rich-workspace')?.addEventListener('click', () => {
    toggleWorkspaceModal(true, 'chat');
  });
  document.getElementById('btn-open-studio-from-bubble')?.addEventListener('click', () => {
    toggleWorkspaceModal(true, 'studio', 'python');
    void refreshProj11PacksUi(false);
  });
  document.getElementById('dws-tab-btn-hub')?.addEventListener('click', () => {
    void refreshProj11PacksUi(false);
    void refreshCustomSkills().then(() => renderToolForgeSkillsList());
  });
  document.getElementById('btn-open-rich-workspace-sub')?.addEventListener('click', () => {
    toggleWorkspaceModal(true, 'chat');
  });
  window.addEventListener('duck-ws-assistant-message', (ev: Event) => {
    const detail = (ev as CustomEvent<{ meta?: { image_paths?: string[]; suggested_skill?: { module_name: string } | null; trace?: Array<{ ok: boolean }> } }>).detail;
    const m = detail?.meta;
    if (!m || !chatHistoryList) return;
    const hasImg = (m.image_paths?.length || 0) > 0;
    const hasSug = Boolean(m.suggested_skill);
    const hasErr = (m.trace || []).some((t) => !t.ok);
    if (hasImg || hasSug || hasErr) {
      const quickBar = document.createElement('div');
      quickBar.style.cssText = 'margin:4px 0 8px;display:flex;gap:5px;flex-wrap:wrap;';
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'chat-chip';
      openBtn.style.cssText = 'border-color:rgba(56,189,248,0.55);color:#7dd3fc;';
      openBtn.textContent = hasSug
        ? `[ĐỀ XUẤT TỰ ĐẺ SKILL: ${m.suggested_skill!.module_name}] -> Mở Workspace +`
        : hasImg
          ? `[XEM ${m.image_paths!.length} ẢNH BIỂU ĐỒ] -> Mở Workspace +`
          : '[TOOL LỖI: TỰ VÁ 1-CLICK] -> Mở Workspace +';
      openBtn.addEventListener('click', () => toggleWorkspaceModal(true, 'chat'));
      quickBar.appendChild(openBtn);
      chatHistoryList.appendChild(quickBar);
      chatHistoryList.scrollTop = chatHistoryList.scrollHeight;
    }
  });
  document.getElementById('tf-auth-header-badge')?.addEventListener('click', async () => {
    setToolForgeTab('cloud');
    await refreshCloudHubUi();
    if (cachedCloudAuth?.logged_in && !hasFetchedCloudSkillsOnce) {
      void fetchCloudSkillsNow();
    }
  });
  document.getElementById('btn-tf-refresh-skills')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang làm mới...';
    }
    try {
      await refreshCustomSkills();
      await syncCloudSkillsCacheSilent(true);
      renderToolForgeSkillsList();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Làm Mới';
      }
    }
  });
  document.getElementById('btn-tf-toggle-cloud-cfg')?.addEventListener('click', () => {
    const box = document.getElementById('tf-cloud-config-box');
    if (box) {
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
      syncHitboxToRust(true);
    }
  });
  document.getElementById('btn-tf-save-cloud-cfg')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    const clientId = (document.getElementById('tf-cfg-google-client-id') as HTMLInputElement | null)?.value.trim() || '';
    const clientSecret = (document.getElementById('tf-cfg-google-secret') as HTMLInputElement | null)?.value.trim() || '';
    const hubUrl = (document.getElementById('tf-cfg-hub-url') as HTMLInputElement | null)?.value.trim() || 'https://duck-ai-3p5a.onrender.com';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
    }
    try {
      await saveCloudHubConfig({
        google_client_id: clientId,
        google_client_secret: clientSecret || undefined,
        cloud_hub_api_url: hubUrl,
      });
      await refreshCloudHubUi();
      setCloudStatusLog('[CONFIG] Đã lưu cấu hình Google OAuth & Cloud Hub URL vào SQLite.');
      if (cachedCloudAuth?.logged_in) {
        hasFetchedCloudSkillsOnce = false;
        void fetchCloudSkillsNow();
      }
    } catch (err) {
      setCloudStatusLog(`[CONFIG ERR] ${String(err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lưu Cấu Hình';
      }
    }
  });
  document.getElementById('btn-tf-google-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-tf-google-login') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang chờ trình duyệt...';
    }
    setCloudStatusLog('[OAUTH] Đang mở trình duyệt Google để đăng nhập (callback loopback kiểu VS Code)...');
    try {
      const auth = await loginWithGoogleOAuth();
      renderCloudAuthUi(auth);
      fireAnimationTrigger('event', 'cloud_login', 'enter');
      setCloudStatusLog(`[OAUTH PASS] Đăng nhập thành công: ${auth.email}`);
      speakMessage(`[GOOGLE OAUTH] Xin chào ${auth.name}! Bạn đã sẵn sàng đồng bộ Skill với MongoDB.`);
      hasFetchedCloudSkillsOnce = false;
      void fetchCloudSkillsNow();
    } catch (err) {
      setCloudStatusLog(`[OAUTH ERR] ${String(err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Đăng Nhập Google';
      }
    }
  });
  document.getElementById('btn-tf-google-logout')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      const auth = await logoutGoogleOAuth();
      renderCloudAuthUi(auth);
      cachedCloudSkills = [];
      myPublishedCloudSkills.clear();
      hasFetchedCloudSkillsOnce = false;
      renderToolForgeSkillsList();
      const listEl = document.getElementById('tf-cloud-skills-list');
      if (listEl) {
        listEl.innerHTML =
          '<div class="dash-sub">Đã đăng xuất. App vẫn hoạt động offline bình thường; đăng nhập Google lại để kéo/đẩy Skill từ MongoDB.</div>';
      }
      setCloudStatusLog('[OAUTH] Đã đăng xuất khỏi tài khoản Google.');
    } catch (err) {
      setCloudStatusLog(`[OAUTH ERR] ${String(err)}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  document.getElementById('btn-tf-cloud-fetch')?.addEventListener('click', () => {
    void fetchCloudSkillsNow();
  });
  document.getElementById('tf-cloud-lang-filter')?.addEventListener('change', () => {
    if (cachedCloudAuth?.logged_in) {
      void fetchCloudSkillsNow();
    }
  });
  document.getElementById('tf-cloud-search')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      void fetchCloudSkillsNow();
    }
  });

  const handleOpenWebChat = async () => {
    try {
      const base = await openWebChatCompanion();
      setCloudStatusLog(`[WEB CHAT] Đã mở giao diện Web Chat Sync tại ${base}`);
    } catch (err) {
      speakMessage(`[WEB CHAT ERR] ${String(err)}`);
    }
  };
  document.getElementById('btn-tf-open-web-chat')?.addEventListener('click', () => {
    void handleOpenWebChat();
  });
  document.getElementById('btn-open-web-chat-bubble')?.addEventListener('click', () => {
    void handleOpenWebChat();
  });

  const voiceAndWatcherCb = {
    bubbleInput,
    btnSendMsg,
    speakMessage,
    toggleBubbleVisibility,
    showSuggestionButtons,
  };
  initVoicePushToTalk(voiceAndWatcherCb);
  initProactiveErrorWatcher(voiceAndWatcherCb);

  // Web <-> Desktop Chat & Remote Agent/Rule Sync (chỉ chạy khi đã đăng nhập Google)
  initWebRemoteSyncLoop({
    getBubbleInput: () => bubbleInput,
    getBtnSendMsg: () => btnSendMsg,
    toggleBubbleVisibility,
    appendChatMessage,
    speakMessage,
    autoDeps,
  });
  void getCloudAuthStatus()
    .then((auth) => {
      renderCloudAuthUi(auth);
    })
    .catch(() => { });

  const syncDraftInputsToObj = (): ToolForgeDraft => {
    const existing = getLatestToolForgeDraft();
    const nameVal = (document.getElementById('tf-draft-name') as HTMLInputElement | null)?.value.trim() || 'Skill Mới';
    const idVal = (document.getElementById('tf-draft-id') as HTMLInputElement | null)?.value.trim() || 'custom_skill';
    const trigRaw = (document.getElementById('tf-draft-triggers') as HTMLInputElement | null)?.value || '';
    const kwRaw = (document.getElementById('tf-draft-keywords') as HTMLInputElement | null)?.value || '';
    const argsVal = (document.getElementById('tf-draft-test-args') as HTMLInputElement | null)?.value.trim() || '{}';
    const liveArgsRaw = (document.getElementById('tf-live-test-args') as HTMLInputElement | null)?.value.trim();
    const liveArgsVal = liveArgsRaw && liveArgsRaw.length > 0 ? liveArgsRaw : argsVal;
    const codeVal = (document.getElementById('tf-code-editor') as HTMLTextAreaElement | null)?.value || '';
    const langSel = (document.getElementById('select-tf-lang') as HTMLSelectElement | null)?.value;
    const lang: 'powershell' | 'python' =
      langSel === 'python' || langSel === 'powershell'
        ? langSel
        : existing?.language || 'powershell';
    const langChanged = Boolean(existing && existing.language !== lang);

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
      sandbox: langChanged ? null : existing?.sandbox || null,
      liveTest: langChanged ? null : existing?.liveTest ?? null,
      liveTestArgsJson: liveArgsVal,
      healLogs: existing?.healLogs || [],
      originalRequest: existing?.originalRequest || '',
    };
    setLatestToolForgeDraft(updated);
    return updated;
  };

  const invalidateDraftSandboxOnly = (d: ToolForgeDraft) => {
    d.sandbox = null;
    d.liveTest = null;
    setLatestToolForgeDraft(d);
    const badge = document.getElementById('tf-verify-badge');
    const liveBadge = document.getElementById('tf-live-test-badge');
    const saveBtn = document.getElementById('btn-tf-confirm-save') as HTMLButtonElement | null;
    const reportBox = document.getElementById('tf-sandbox-report');
    const liveReportBox = document.getElementById('tf-live-test-report');
    const langTag = document.getElementById('tf-draft-lang-tag');
    if (langTag) langTag.textContent = `[${d.language.toUpperCase()}]`;
    if (badge) {
      badge.className = 'badge tf-badge-fail';
      badge.textContent = '[CHƯA KIỂM CHỨNG]';
    }
    if (liveBadge) {
      liveBadge.className = 'badge tf-badge-warn';
      liveBadge.textContent = '[CHƯA TEST THẬT]';
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.45';
    }
    if (reportBox) {
      reportBox.textContent =
        '[SANDBOX] Mã nguồn hoặc tham số vừa thay đổi. Bấm "Chạy Sandbox" để kiểm chứng lại trước khi đóng gói.';
    }
    if (liveReportBox) {
      liveReportBox.textContent =
        '[USER TEST] Mã nguồn vừa thay đổi. Bấm "Test Chạy Thật" để kiểm nghiệm lại kết quả thực tế.';
    }
  };

  const onDraftMetaInput = () => {
    const updated = syncDraftInputsToObj();
    renderToolForgeDraft(updated);
  };
  document.getElementById('tf-draft-name')?.addEventListener('input', onDraftMetaInput);
  document.getElementById('tf-draft-id')?.addEventListener('input', onDraftMetaInput);
  document.getElementById('tf-draft-triggers')?.addEventListener('input', onDraftMetaInput);
  document.getElementById('tf-code-editor')?.addEventListener('input', () => {
    invalidateDraftSandboxOnly(syncDraftInputsToObj());
  });
  document.getElementById('tf-draft-test-args')?.addEventListener('input', () => {
    invalidateDraftSandboxOnly(syncDraftInputsToObj());
  });
  document.getElementById('tf-draft-keywords')?.addEventListener('input', () => {
    invalidateDraftSandboxOnly(syncDraftInputsToObj());
  });
  document.getElementById('select-tf-lang')?.addEventListener('change', () => {
    if (getLatestToolForgeDraft()) {
      invalidateDraftSandboxOnly(syncDraftInputsToObj());
    }
  });
  document.getElementById('tf-live-test-args')?.addEventListener('input', () => {
    const existing = getLatestToolForgeDraft();
    if (!existing) return;
    const val = (document.getElementById('tf-live-test-args') as HTMLInputElement | null)?.value ?? '';
    setLatestToolForgeDraft({
      ...existing,
      liveTestArgsJson: val,
    });
  });

  document.getElementById('btn-tf-new-manual')?.addEventListener('click', () => {
    const langSel = (document.getElementById('select-tf-lang') as HTMLSelectElement | null)?.value;
    const lang: 'powershell' | 'python' = langSel === 'python' ? 'python' : 'powershell';
    const blank = createBlankToolDraft(lang);
    setLatestToolForgeDraft(blank);
    renderToolForgeDraft(blank);
    syncHitboxToRust(true);
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
    fireAnimationTrigger('tool', 'forge_tool', 'start');
    try {
      const draft = await forgeNewToolFromRequest(reqText, pref, (line) => {
        appendToolForgePipelineLog(line);
      });
      setLatestToolForgeDraft(draft);
      renderToolForgeDraft(draft);
      fireAnimationTrigger('tool', 'forge_tool', draft.sandbox?.verified ? 'success' : 'error');
      syncHitboxToRust(true);
    } catch (err) {
      fireAnimationTrigger('tool', 'forge_tool', 'error');
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
    fireAnimationTrigger('tool', 'forge_tool', 'start');
    try {
      const tested = await runDraftInSandbox(draft);
      renderToolForgeDraft(tested);
      fireAnimationTrigger('tool', 'forge_tool', tested.sandbox?.verified ? 'success' : 'error');
      appendToolForgePipelineLog(
        tested.sandbox?.verified
          ? `[SANDBOX PASS] Kiểm chứng đạt (${tested.sandbox.duration_ms}ms, hash=${tested.sandbox.code_hash}).`
          : `[SANDBOX FAIL] ${tested.sandbox?.failure_reason || 'Chưa đạt kiểm chứng.'}`
      );
    } catch (err) {
      fireAnimationTrigger('tool', 'forge_tool', 'error');
      appendToolForgePipelineLog(`[SANDBOX ERR] ${String(err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Chạy Sandbox';
      }
    }
  });

  document.getElementById('btn-tf-run-live-test')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-tf-run-live-test') as HTMLButtonElement | null;
    const liveArgsInp = document.getElementById('tf-live-test-args') as HTMLInputElement | null;
    const liveReportBox = document.getElementById('tf-live-test-report');
    const draft = syncDraftInputsToObj();
    const liveArgsRaw = (liveArgsInp?.value ?? draft.liveTestArgsJson ?? draft.testArgsJson ?? '{}').trim() || '{}';
    try {
      JSON.parse(liveArgsRaw);
    } catch {
      const errMsg = '[USER TEST ERR] Tham số JSON không hợp lệ.';
      if (liveReportBox) liveReportBox.textContent = errMsg;
      appendToolForgePipelineLog(errMsg);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang chạy thật...';
    }
    appendToolForgePipelineLog('[USER TEST] Đang chạy trực tiếp trên máy (DUCK_SANDBOX_MODE=0)...');
    try {
      const tested = await runDraftLiveTest(draft, liveArgsRaw);
      renderToolForgeDraft(tested);
      appendToolForgePipelineLog(
        tested.liveTest?.ok
          ? `[USER TEST PASS] Chạy thật hoàn tất (${tested.liveTest.duration_ms}ms, Exit=0).`
          : `[USER TEST FAIL] Exit=${tested.liveTest?.exit_code ?? -1} | ${tested.liveTest?.error_summary || 'Chưa đạt.'}`
      );
      syncHitboxToRust(true);
    } catch (err) {
      const errMsg = `[USER TEST ERR] ${String(err)}`;
      if (liveReportBox) liveReportBox.textContent = errMsg;
      appendToolForgePipelineLog(errMsg);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Test Chạy Thật';
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
      lastSavedDraftSig = computeDraftSaveSig(draft);
      renderToolForgeDraft(draft);
      appendToolForgePipelineLog(
        `[PACKAGED] Đã đóng gói & lưu skill "${saved.name}" (id=${saved.id}, v${saved.version}) vào SQLite + data/skills/${saved.id}/!`
      );
      speakMessage(
        `[SKILL SAVED] Đã xác nhận & lưu skill "${saved.name}"! Lần sau bạn chỉ cần nhắn dùng (vd "Port 3000 đang bị kẹt, dọn giúp") là Local LLM sẽ gọi ngay tool này.`
      );
      refreshAutomationSkillSelect();
      setToolForgeTab('skills');
      renderToolForgeSkillsList();
      if (hasFetchedCloudSkillsOnce) {
        renderCloudSkillsList(cachedCloudSkills);
      }
    } catch (err) {
      appendToolForgePipelineLog(`[GATE BLOCKED] ${String(err)}`);
      renderToolForgeDraft(draft);
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
    syncStudioAvatarActiveUi();
    void loadVrmFromUrl(PRESET_ALICIA_URL, 'Alicia Solid (.VRM)');
  });

  presetVrm1.addEventListener('click', () => {
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('custom_vrm', PRESET_VRM1_URL);
    syncStudioAvatarActiveUi();
    void loadVrmFromUrl(PRESET_VRM1_URL, 'Avatar Sample A (.VRM 1.0)');
  });

  presetBuiltin.addEventListener('click', async () => {
    await clearCachedVrm();
    createDetailedAnimeCharacter();
    btnActDuck.textContent = 'Đổi Vịt BDX';
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('idol', '');
    syncStudioAvatarActiveUi();
    spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    speakMessage('Đã chuyển về Cyber Idol 3D mặc định!');
  });

  presetMicroduck.addEventListener('click', async () => {
    await clearCachedVrm();
    createMicroDuckCharacter();
    btnActDuck.textContent = 'Đổi Cyber Idol';
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('microduck', '');
    syncStudioAvatarActiveUi();
    spawnParticles(appState.posX, appState.posY - 90, 14, 0x76b900);
    speakMessage('Quạc quạc! Đã kích hoạt NVIDIA MicroDuck (BDX Droid 3D)!');
  });

  btnLoadUrl.addEventListener('click', () => {
    const url = vrmUrlInput.value.trim();
    if (!url) return;
    toggleStudioModal(false);
    void saveStudioConfigToSqlite('custom_vrm', url);
    syncStudioAvatarActiveUi();
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
    void refreshStudioLlmUi();
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
    } else if (tab === 'avatar') {
      syncStudioAvatarActiveUi();
    }
    syncHitboxToRust(true);
  };
  tabBtnStudioSystem?.addEventListener('click', () => switchStudioTab('system'));
  tabBtnStudioAvatar?.addEventListener('click', () => switchStudioTab('avatar'));
  tabBtnStudioPhysics?.addEventListener('click', () => switchStudioTab('physics'));
  tabBtnStudioLlm?.addEventListener('click', () => switchStudioTab('llm'));

  btnScanOllamaModels?.addEventListener('click', () => {
    void refreshStudioLlmUi();
  });

  const renderColabScanUi = (res: {
    online: boolean;
    tunnel_url: string;
    default_model: string;
    models: string[];
    error: string;
  }) => {
    const colabStatusBadge = document.getElementById('studio-colab-status');
    const colabUrlInp = document.getElementById('input-colab-url') as HTMLInputElement | null;
    const colabModelInp = document.getElementById('input-colab-model') as HTMLInputElement | null;
    const chipsBox = document.getElementById('colab-models-chips');

    if (colabUrlInp && document.activeElement !== colabUrlInp && res.tunnel_url) {
      colabUrlInp.value = res.tunnel_url;
    }
    if (colabModelInp && document.activeElement !== colabModelInp) {
      colabModelInp.value = colabCloudModel || res.default_model;
    }
    if (colabStatusBadge) {
      if (res.online) {
        colabStatusBadge.className = 'badge tf-badge-pass';
        colabStatusBadge.textContent = `[COLAB: ONLINE (${res.models.length})]`;
      } else {
        colabStatusBadge.className = 'badge tf-badge-warn';
        colabStatusBadge.textContent = '[COLAB: OFFLINE]';
      }
    }
    if (chipsBox) {
      chipsBox.innerHTML = '';
      if (res.online && res.models.length > 0) {
        res.models.forEach((m) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `chat-chip${m === colabCloudModel ? ' active' : ''}`;
          btn.textContent = m;
          btn.addEventListener('click', () => {
            setColabCloudModel(m);
            if (colabModelInp) colabModelInp.value = m;
            void saveColabCloudConfig(colabUrlInp?.value || res.tunnel_url, m, true);
            renderColabScanUi(res);
          });
          chipsBox.appendChild(btn);
        });
      } else if (res.error) {
        const note = document.createElement('span');
        note.style.cssText = 'font-size:10px;color:#94a3b8;';
        note.textContent = res.error;
        chipsBox.appendChild(note);
      }
    }
  };

  document.getElementById('btn-scan-colab')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-scan-colab') as HTMLButtonElement | null;
    const colabUrlInp = document.getElementById('input-colab-url') as HTMLInputElement | null;
    const colabModelInp = document.getElementById('input-colab-model') as HTMLInputElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang quét...';
    }
    try {
      const urlVal = colabUrlInp?.value.trim() || '';
      const modVal = colabModelInp?.value.trim() || colabCloudModel;
      const res = urlVal
        ? await saveColabCloudConfig(urlVal, modVal, true)
        : await scanColabCloudModels();
      renderColabScanUi(res);
      if (res.online) {
        speakMessage(`[COLAB GPU] Đã quét thấy ${res.models.length} model trên Colab (${res.models[0]}).`);
      }
    } catch {
      // silent when offline
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Quét GPU Colab';
      }
    }
  });

  // Quét ngầm Colab GPU khi khởi động: có thì dùng, không bật Colab thì bỏ qua êm
  void scanColabCloudModels()
    .then((res) => renderColabScanUi(res))
    .catch(() => { });

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
      const uvModal = document.getElementById('p2p-ultraview-modal');
      const fileDash = document.getElementById('file-dashboard-modal');
      if (appState.isOcrSnipMode) finishSnipOverlayReset();
      else if (uvModal && uvModal.style.display !== 'none') openUltraViewModal(false);
      else if (fileDash && fileDash.style.display !== 'none') closeFileAnalyticsDashboard();
      else if (appState.isSmartDropzoneOpen) {
        hideSmartDropzoneFast();
        syncHitboxToRust(true);
      }
      else if (appState.isEnglishCoachOpen) toggleEnglishCoachModalLazy(false);
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

  const switchNotifTab = (activeTab: 'win' | 'web' | 'hist' | 'autoreply') => {
    if (tabBtnWinNotif) tabBtnWinNotif.classList.toggle('active', activeTab === 'win');
    if (tabBtnWebNotif) tabBtnWebNotif.classList.toggle('active', activeTab === 'web');
    if (tabBtnHistNotif) tabBtnHistNotif.classList.toggle('active', activeTab === 'hist');
    if (tabBtnAutoreplyNotif) tabBtnAutoreplyNotif.classList.toggle('active', activeTab === 'autoreply');
    if (tabContentWinNotif) tabContentWinNotif.style.display = activeTab === 'win' ? 'block' : 'none';
    if (tabContentWebNotif) tabContentWebNotif.style.display = activeTab === 'web' ? 'block' : 'none';
    if (tabContentHistNotif) tabContentHistNotif.style.display = activeTab === 'hist' ? 'block' : 'none';
    if (tabContentAutoreplyNotif) tabContentAutoreplyNotif.style.display = activeTab === 'autoreply' ? 'flex' : 'none';
    if (activeTab === 'hist') {
      void renderNotificationHistoryList();
    } else if (activeTab === 'autoreply') {
      syncNotificationAutoReplyForm();
    }
    syncHitboxToRust(true);
  };

  if (tabBtnWinNotif) tabBtnWinNotif.addEventListener('click', () => switchNotifTab('win'));
  if (tabBtnWebNotif) tabBtnWebNotif.addEventListener('click', () => switchNotifTab('web'));
  if (tabBtnHistNotif) tabBtnHistNotif.addEventListener('click', () => switchNotifTab('hist'));
  if (tabBtnAutoreplyNotif) tabBtnAutoreplyNotif.addEventListener('click', () => switchNotifTab('autoreply'));

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
      btnScanWinApps.disabled = true;
      btnScanWinApps.textContent = 'Đang quét...';
      try {
        const activeApps = await scanRunningWindowsApps();
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
      } finally {
        btnScanWinApps.disabled = false;
        btnScanWinApps.textContent = 'Quét App đang mở';
      }
    });
  }

  if (btnAddWinApp) {
    btnAddWinApp.addEventListener('click', async () => {
      const name = inputNewWinApp.value.trim();
      if (!name) return;
      if (!currentNotifSettings) {
        currentNotifSettings = await fetchNotificationSettings();
      }
      if (!currentNotifSettings) return;
      if (currentNotifSettings.windows_apps.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
        speakMessage(`[NOTIF] Ứng dụng "${name}" đã có trong danh sách rồi!`);
        inputNewWinApp.value = '';
        return;
      }
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
    inputNewWinApp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddWinApp.click();
      }
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
      await renderNotificationHistoryList();
    });
  }

  if (btnAddWebOrigin) {
    btnAddWebOrigin.addEventListener('click', async () => {
      const origin = inputNewWebOrigin.value.trim();
      if (!origin) return;
      if (!currentNotifSettings) {
        currentNotifSettings = await fetchNotificationSettings();
      }
      if (!currentNotifSettings) return;
      if (currentNotifSettings.web_origins.some((w) => w.origin.toLowerCase() === origin.toLowerCase())) {
        speakMessage(`[NOTIF] Web domain "${origin}" đã có trong danh sách rồi!`);
        inputNewWebOrigin.value = '';
        return;
      }
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
    inputNewWebOrigin?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddWebOrigin.click();
      }
    });
  }

  if (btnTestWebNotif) {
    btnTestWebNotif.addEventListener('click', async () => {
      await triggerTestNotification('web', 'github.com');
      await renderNotificationHistoryList();
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
  document.getElementById('dock-btn-english')?.addEventListener('click', () => toggleEnglishCoachModalLazy());
  document.getElementById('btn-open-english-coach')?.addEventListener('click', () => toggleEnglishCoachModalLazy(true, { tab: 'learn' }));
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
    void performTarotDrawAndFlip(false);
  });
  document.getElementById('btn-tarot-force-draw')?.addEventListener('click', () => {
    void performTarotDrawAndFlip(true);
  });
  document.getElementById('btn-tarot-replay-3d')?.addEventListener('click', () => {
    const rec = displayedTarotReading || cachedTarotStatus?.current_reading;
    if (rec) {
      applyTarotReadingToModal(rec, true);
      triggerDuckReactionForTarot(rec);
    }
  });
  document.getElementById('btn-tarot-ai-deep')?.addEventListener('click', async () => {
    const rec = displayedTarotReading || cachedTarotStatus?.current_reading;
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
        const histMatch = cachedTarotStatus?.history?.find((h) => h.id === rec.id);
        if (histMatch) histMatch.ai_deep_reading = cleaned;
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
  document.getElementById('btn-p2p-regen-code')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      await invoke('p2p_regenerate_room').catch(() => { });
      await refreshP2pStatus();
    } finally {
      if (btn) btn.disabled = false;
    }
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
  document.getElementById('btn-p2p-scan-lan')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement | null;
    const lanList = document.getElementById('p2p-lan-list');
    if (!lanList) return;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang quét...';
    }
    lanList.style.display = 'flex';
    lanList.innerHTML = '<div class="dash-sub">Đang quét các máy Duck AI trên mạng cục bộ...</div>';
    syncHitboxToRust(true);
    try {
      const peers = await invoke<LanPeerInfo[]>('p2p_scan_local_peers');
      if (!peers || peers.length === 0) {
        lanList.innerHTML =
          '<div class="dash-sub">Chưa tìm thấy máy khác đang mở cổng LAN (hãy nhập IP:Port thủ công hoặc dùng Giả Lập Máy B).</div>';
        syncHitboxToRust(true);
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
      syncHitboxToRust(true);
    } catch {
      lanList.innerHTML = '<div class="dash-sub">Lỗi quét LAN.</div>';
      syncHitboxToRust(true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Quét LAN';
      }
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
  document.getElementById('p2p-target-code')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-p2p-connect')?.click();
    }
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
  document.getElementById('p2p-remote-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-p2p-remote-type')?.click();
    }
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

  // Cửa sổ UltraViewer P2P trực tiếp 60s
  document.getElementById('btn-p2p-open-ultraview')?.addEventListener('click', () => {
    toggleP2pArenaModal(false);
    openUltraViewModal(true);
  });
  document.getElementById('btn-p2p-uv-size')?.addEventListener('click', () => {
    toggleUltraViewExpand();
  });
  document.getElementById('btn-p2p-uv-close')?.addEventListener('click', () => {
    openUltraViewModal(false);
    toggleP2pArenaModal(true);
  });

  const uvViewport = document.getElementById('p2p-uv-viewport');
  const uvCursor = document.getElementById('p2p-uv-cursor');
  const uvChkMouse = document.getElementById('p2p-uv-chk-mouse') as HTMLInputElement | null;
  const uvChkKbd = document.getElementById('p2p-uv-chk-kbd') as HTMLInputElement | null;
  const uvChkSimExec = document.getElementById('p2p-uv-chk-sim-exec') as HTMLInputElement | null;

  const calcUvNormCoords = (ev: MouseEvent | PointerEvent | WheelEvent) => {
    if (!uvViewport) return { xn: 0.5, yn: 0.5 };
    const r = uvViewport.getBoundingClientRect();
    const xn = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width)));
    const yn = Math.max(0, Math.min(1, (ev.clientY - r.top) / Math.max(1, r.height)));
    if (uvCursor) {
      uvCursor.style.left = `${Math.round(xn * 100)}%`;
      uvCursor.style.top = `${Math.round(yn * 100)}%`;
    }
    return { xn, yn };
  };

  const resolveUvMouseButton = (
    ev: MouseEvent | PointerEvent
  ): 'left' | 'right' | 'middle' | 'sim_preview' => {
    if (getP2pStatusSnapshot().is_sim_mode && !uvChkSimExec?.checked) {
      return 'sim_preview';
    }
    if (ev.button === 2) return 'right';
    if (ev.button === 1) return 'middle';
    return 'left';
  };

  uvViewport?.addEventListener('pointermove', (ev) => {
    const { xn, yn } = calcUvNormCoords(ev);
    if (uvChkMouse?.checked) {
      void sendWinnerRemoteCmd('mouse_move', { xNorm: xn, yNorm: yn, silent: true });
    }
  });
  uvViewport?.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    uvViewport.focus();
    const { xn, yn } = calcUvNormCoords(ev);
    if (uvChkMouse?.checked) {
      void sendWinnerRemoteCmd('mouse_down', {
        xNorm: xn,
        yNorm: yn,
        button: resolveUvMouseButton(ev),
        silent: true,
      });
    }
  });
  uvViewport?.addEventListener('pointerup', (ev) => {
    ev.preventDefault();
    const { xn, yn } = calcUvNormCoords(ev);
    if (uvChkMouse?.checked) {
      void sendWinnerRemoteCmd('mouse_up', {
        xNorm: xn,
        yNorm: yn,
        button: resolveUvMouseButton(ev),
        silent: true,
      });
    }
  });
  uvViewport?.addEventListener('dblclick', (ev) => {
    ev.preventDefault();
    const { xn, yn } = calcUvNormCoords(ev);
    if (uvChkMouse?.checked) {
      void sendWinnerRemoteCmd('mouse_dblclick', {
        xNorm: xn,
        yNorm: yn,
        button: resolveUvMouseButton(ev),
        silent: true,
      });
    }
  });
  uvViewport?.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
  });
  uvViewport?.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const { xn, yn } = calcUvNormCoords(ev);
      if (uvChkMouse?.checked) {
        const delta = Math.max(-360, Math.min(360, Math.round(-ev.deltaY)));
        void sendWinnerRemoteCmd('mouse_wheel', {
          xNorm: xn,
          yNorm: yn,
          button: resolveUvMouseButton(ev),
          wheelDelta: delta,
          silent: true,
        });
      }
    },
    { passive: false }
  );

  uvViewport?.addEventListener('keydown', (ev) => {
    if (!uvChkKbd?.checked) return;
    ev.preventDefault();
    ev.stopPropagation();
    const vk = ev.keyCode || 0;
    if (vk >= 8 && vk <= 254) {
      void sendWinnerRemoteCmd('key_down', { vk, silent: true });
    }
  });
  uvViewport?.addEventListener('keyup', (ev) => {
    if (!uvChkKbd?.checked) return;
    ev.preventDefault();
    ev.stopPropagation();
    const vk = ev.keyCode || 0;
    if (vk >= 8 && vk <= 254) {
      void sendWinnerRemoteCmd('key_up', { vk, silent: true });
    }
  });

  document.querySelectorAll('[data-uv-hotkey]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hk = btn.getAttribute('data-uv-hotkey') || '';
      if (hk) {
        void sendWinnerRemoteCmd('hotkey', { text: hk });
      }
    });
  });

  const sendUvInputText = () => {
    const inp = document.getElementById('p2p-uv-text-input') as HTMLInputElement | null;
    const text = inp?.value || '';
    if (!text.trim()) return;
    if (inp) inp.value = '';
    void sendWinnerRemoteCmd('type_text', { text, silent: true });
  };
  document.getElementById('btn-p2p-uv-send-text')?.addEventListener('click', sendUvInputText);
  document.getElementById('p2p-uv-text-input')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      sendUvInputText();
    }
  });
  document.getElementById('btn-p2p-uv-notepad')?.addEventListener('click', () => {
    void sendWinnerRemoteCmd('open_notepad_taunt', {
      text: 'QUAC QUAC! Ban da thua tran P2P va dang bi dieu khien qua UltraViewer 60 giay!',
    });
  });
  document.getElementById('btn-p2p-uv-jitter')?.addEventListener('click', () => {
    void sendWinnerRemoteCmd('jitter_mouse');
  });
  document.getElementById('btn-p2p-uv-block')?.addEventListener('click', () => {
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
    const files = Array.from((e.target as HTMLInputElement).files || []).slice(0, 5);
    setFileDragHoverMode(false);
    if (files.length > 0) {
      anyFileInput.value = '';
      void (async () => {
        for (const f of files) {
          await handleDroppedAnyFile(f);
        }
      })();
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

  initNotificationAutoReplyUi({
    speakMessage,
    appendChatMessage,
    toggleBubbleVisibility,
  });

  initPinnedChatFilesUi({
    openDashboard: (analysis) => openFileAnalyticsDashboard(analysis),
    summarizeFile: (analysis) => {
      void summarizeLastIngestedFile(analysis);
    },
    syncHitbox: () => {
      updateUiPosition();
      syncHitboxToRust(true);
    },
    updatePlaceholder: (text) => {
      if (bubbleInput) bubbleInput.placeholder = text;
    },
    speakMessage,
  });

  if (typeof ResizeObserver !== 'undefined' && speechBubble) {
    const bubbleResizeObserver = new ResizeObserver(() => {
      if (!appState.isBubbleVisible) return;
      updateUiPosition();
      syncHitboxToRust(true);
    });
    bubbleResizeObserver.observe(speechBubble);
  }

  window.addEventListener('duck-focus-chat-input', () => {
    if (!appState.isBubbleVisible) {
      toggleBubbleVisibility(true);
    }
    appState.isChatting = true;
    updateUiPosition();
    syncHitboxToRust(true);
    setTimeout(() => {
      bubbleInput?.focus();
    }, 60);
  });

  // Khởi động lắng nghe app notifications từ Rust backend
  void listenToDesktopNotifications((item, speechAlert) => {
    if (appState.isNotificationManagerOpen) {
      void renderNotificationHistoryList();
    }
    if (item.app_or_origin === 'Lịch hẹn Duck AI') {
      return;
    }
    void handleIncomingNotificationForReply(item);
    if (currentNotifSettings?.character_alert_enabled ?? true) {
      appState.setState('ALERT');
      spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
      fireAnimationTrigger('event', 'notif_incoming', 'enter');
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
      void invoke('mini_screen_restore_all_stealth').catch(() => { });
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

  // Lắng nghe lệnh điều khiển từ điện thoại qua Mobile QR Remote Deck
  void listen<{ cmd?: string; text?: string; word?: string }>(
    'desktop-mate://mobile-deck-cmd',
    (event) => {
      const payload = event.payload || {};
      if (payload.cmd === 'beat_dance') {
        triggerManualBeatDance();
      } else if (payload.cmd === 'speak_word' && payload.text) {
        void speakEnglishTts(payload.text, false);
      } else if (payload.cmd === 'send_chat' && payload.text) {
        if (!appState.isBubbleVisible) toggleBubbleVisibility(true);
        if (bubbleInput) {
          bubbleInput.value = payload.text;
          handleSendMessage();
        }
      } else if (payload.cmd === 'vocab_updated') {
        spawnParticles(appState.posX, appState.posY - 95, 8, 0x34d399);
      }
    }
  );

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
    refreshMiniMirrorWindowsIfOpen();

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

  const curBubbleW = appState.isBubbleVisible && speechBubble ? speechBubble.offsetWidth : 0;
  const curBubbleH = appState.isBubbleVisible && speechBubble ? speechBubble.offsetHeight : 0;
  const bubbleSizeChanged =
    curBubbleW !== lastBubbleLayoutW || curBubbleH !== lastBubbleLayoutH;

  const needsMove =
    !fromAnimLoop ||
    Math.abs(appState.posX - uiFollowX) > 0.15 ||
    Math.abs(appState.posY - uiFollowY) > 0.15 ||
    appState.isFileDragHovering ||
    bubbleSizeChanged ||
    isCompanionOrbSettling();
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
  const viewportW = Math.min(appState.W || window.innerWidth, window.innerWidth || appState.W);
  const viewportH = Math.min(appState.H || window.innerHeight, window.innerHeight || appState.H);

  // 1. Cụm Thoại Duck + Cửa sổ Chat luôn đi theo bên Trái hoặc bên Phải nhân vật (không đè lên đầu/thân vịt)
  let bubbleDockX = 0;
  let bubbleDockW = 0;
  let actualBubbleSide: 'left' | 'right' = appState.chatDockSide;
  if (appState.isBubbleVisible && speechBubble) {
    const bubbleW = curBubbleW || speechBubble.offsetWidth || 320;
    const bubbleH = curBubbleH || speechBubble.offsetHeight || 155;
    const maxBubbleTop = Math.max(12, viewportH - bubbleH - 58);
    const charSideGap = Math.round(62 * s);
    const leftCandidate = uiFollowX - charSideGap - bubbleW;
    const rightCandidate = uiFollowX + charSideGap;

    let bubbleLeft: number;
    if (appState.chatDockSide === 'left') {
      if (leftCandidate >= 12) {
        bubbleLeft = leftCandidate;
        actualBubbleSide = 'left';
      } else if (rightCandidate + bubbleW <= viewportW - 12) {
        bubbleLeft = rightCandidate;
        actualBubbleSide = 'right';
      } else {
        bubbleLeft = Math.max(12, Math.min(viewportW - bubbleW - 12, leftCandidate));
        actualBubbleSide = 'left';
      }
    } else {
      if (rightCandidate + bubbleW <= viewportW - 12) {
        bubbleLeft = rightCandidate;
        actualBubbleSide = 'right';
      } else if (leftCandidate >= 12) {
        bubbleLeft = leftCandidate;
        actualBubbleSide = 'left';
      } else {
        bubbleLeft = Math.max(12, Math.min(viewportW - bubbleW - 12, rightCandidate));
        actualBubbleSide = 'right';
      }
    }

    const desiredTop = uiFollowY - Math.round(135 * s) - bubbleH * 0.45;
    const bubbleTop = Math.max(12, Math.min(maxBubbleTop, desiredTop));
    speechBubble.classList.add('side-mode');
    speechBubble.classList.toggle('follow-left', actualBubbleSide === 'left');
    speechBubble.classList.toggle('follow-right', actualBubbleSide === 'right');
    if (!speechBubble.classList.contains('dialog-dragged')) {
      setPosIfChanged(speechBubble, bubbleLeft, bubbleTop);
      bubbleDockX = bubbleLeft;
    } else {
      const br = speechBubble.getBoundingClientRect();
      bubbleDockX = br.left;
    }
    bubbleDockW = bubbleW;
    lastBubbleTopPx = bubbleTop;
    lastBubbleLayoutW = curBubbleW;
    lastBubbleLayoutH = curBubbleH;
  } else {
    lastBubbleTopPx = 0;
    lastBubbleLayoutW = 0;
    lastBubbleLayoutH = 0;
  }

  if (bubbleSizeChanged) {
    syncHitboxToRust(true);
  }

  const ingestHud = document.getElementById('file-ingest-mouth-hud');
  if (ingestHud && appState.isFileDragHovering) {
    const hudW = ingestHud.offsetWidth || 206;
    const hudH = ingestHud.offsetHeight || 132;
    const hx = Math.max(12, Math.min(appState.W - hudW - 12, uiFollowX - hudW / 2));
    const hy = Math.max(12, Math.min(appState.H - hudH - 20, uiFollowY - 122 * appState.modelScale - hudH * 0.48));
    setPosIfChanged(ingestHud, hx, hy);
  }

  // 2. Quả bóng đồng hành (khi thu gọn: bay lẽo đẽo theo sau vịt) / Thanh Dock (khi mở rộng: đậu dưới chân vịt)
  if (companionDock) {
    const dockW = companionDock.offsetWidth || 36;
    const dockH = companionDock.offsetHeight || 36;

    if (isDockExpanded) {
      setPosIfChanged(
        companionDock,
        Math.max(12, Math.min(viewportW - dockW - 12, uiFollowX - dockW / 2)),
        Math.max(12, Math.min(viewportH - dockH - 8, uiFollowY + 10))
      );
    } else {
      const dt = Math.min(0.05, Math.max(0.001, delta));
      if (!orbInited) {
        orbInited = true;
        prevDuckTrackX = appState.posX;
        prevDuckTrackY = appState.posY;
        const initSide = actualBubbleSide === 'right' ? -1 : 1;
        orbTrailDir = -initSide;
        orbX = Math.max(24, Math.min(viewportW - 24, appState.posX + initSide * Math.round(54 * s)));
        orbY = Math.max(24, Math.min(viewportH - 28, appState.posY - Math.round(64 * s)));
      }

      const duckStepX = appState.posX - prevDuckTrackX;
      const duckStepY = appState.posY - prevDuckTrackY;
      prevDuckTrackX = appState.posX;
      prevDuckTrackY = appState.posY;

      if (Math.abs(duckStepX) > 0.35) {
        orbTrailDir = duckStepX > 0 ? 1 : -1;
        orbMovingHoldSec = 0.7;
      } else if (
        appState.state === 'WALKING' ||
        appState.state === 'PUSHING' ||
        appState.state === 'PULLING'
      ) {
        orbTrailDir = appState.walkDir >= 0 ? 1 : -1;
        orbMovingHoldSec = 0.7;
      } else if (fromAnimLoop) {
        orbMovingHoldSec = Math.max(0, orbMovingHoldSec - dt);
      }

      // Phía sau lưng vịt theo hướng di chuyển; khi vịt đứng nghỉ thì né sang bên trống đối diện khung Chat
      let sideSign = -orbTrailDir;
      const isActivelyMoving =
        orbMovingHoldSec > 0 ||
        appState.state === 'DRAGGING' ||
        appState.state === 'FALLING' ||
        appState.state === 'JUMPING' ||
        appState.state === 'FLYING_ROCKET' ||
        appState.state === 'PARACHUTING' ||
        appState.state === 'SWIMMING';

      if (!isActivelyMoving && appState.isBubbleVisible && bubbleDockW > 0) {
        sideSign = actualBubbleSide === 'left' ? 1 : -1;
      }

      const baseDistX = Math.round((isActivelyMoving ? 62 : 52) * s);
      if (uiFollowX + sideSign * baseDistX < 28) sideSign = 1;
      if (uiFollowX + sideSign * baseDistX > viewportW - 28) sideSign = -1;

      const velLagX = Math.max(-34, Math.min(34, duckStepX * 2.4));
      const velLagY = Math.max(-32, Math.min(32, duckStepY * 2.1));
      let targetOrbX = appState.posX + sideSign * baseDistX - velLagX;
      const horizStretch = Math.abs(targetOrbX - orbX);
      const arcSagY = Math.min(22, horizStretch * 0.14);
      let targetOrbY = appState.posY - Math.round(64 * s) - velLagY + arcSagY;

      // Tránh bị che khuất bởi bong bóng thoại khi vịt đi ngược hướng
      if (appState.isBubbleVisible && bubbleDockW > 0) {
        const bLeft = bubbleDockX - 20;
        const bRight = bubbleDockX + bubbleDockW + 20;
        const bTop = lastBubbleTopPx - 20;
        const bBottom = lastBubbleTopPx + (curBubbleH || 155) + 22;
        if (
          targetOrbX > bLeft &&
          targetOrbX < bRight &&
          targetOrbY > bTop &&
          targetOrbY < bBottom
        ) {
          if (bBottom <= viewportH - 26) {
            targetOrbY = bBottom;
          } else if (bTop >= 28) {
            targetOrbY = bTop;
          }
        }
      }

      targetOrbX = Math.max(24, Math.min(viewportW - 24, targetOrbX));
      targetOrbY = Math.max(24, Math.min(viewportH - 26, targetOrbY));

      if (!isOrbHovered) {
        const dx = targetOrbX - orbX;
        const dy = targetOrbY - orbY;
        const dist = Math.hypot(dx, dy);

        if (!fromAnimLoop && dist > 420) {
          // Nhảy tức thời khi mới khởi tạo hoặc dịch chuyển quá xa ngoài vòng lặp
          orbX = targetOrbX;
          orbY = targetOrbY;
          orbVelX = 0;
          orbVelY = 0;
          orbSettled = true;
        } else {
          // Lò xo đàn hồi mềm (Underdamped Spring-Damper) tạo cảm giác bóng lơ lửng đuổi theo có quán tính & nảy nhẹ
          const stiffness = 28;
          const damping = 5.6;
          orbVelX += (dx * stiffness - orbVelX * damping) * dt;
          orbVelY += (dy * stiffness - orbVelY * damping) * dt;

          const maxSpd = 1500;
          const curSpd = Math.hypot(orbVelX, orbVelY);
          if (curSpd > maxSpd) {
            const ratio = maxSpd / curSpd;
            orbVelX *= ratio;
            orbVelY *= ratio;
          }

          orbX += orbVelX * dt;
          orbY += orbVelY * dt;

          const remDist = Math.hypot(targetOrbX - orbX, targetOrbY - orbY);
          const newSpd = Math.hypot(orbVelX, orbVelY);

          if (remDist < 0.45 && newSpd < 6) {
            orbX = targetOrbX;
            orbY = targetOrbY;
            orbVelX = 0;
            orbVelY = 0;
            if (companionDock.style.transform) {
              companionDock.style.transform = '';
            }
            if (!orbSettled) {
              orbSettled = true;
              syncHitboxToRust(true);
            }
          } else {
            const wasSettled = orbSettled;
            orbSettled = false;
            if (wasSettled && !fromAnimLoop) {
              window.dispatchEvent(new CustomEvent('duck-wake-loop'));
            }
            if (!document.body.classList.contains('eco-mode') && newSpd > 18) {
              const stretch = Math.min(0.15, newSpd / 2400);
              const tiltDeg = Math.max(-18, Math.min(18, orbVelX * 0.032));
              companionDock.style.transform = `rotate(${tiltDeg.toFixed(1)}deg) scale(${(
                1 +
                stretch * 0.65
              ).toFixed(3)}, ${(1 - stretch * 0.45).toFixed(3)})`;
            } else if (companionDock.style.transform) {
              companionDock.style.transform = '';
            }
          }
        }
      }

      setPosIfChanged(companionDock, orbX - dockW / 2, orbY - dockH / 2);
    }
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

  if (appState.isLeftPanelOpen && leftTelemetryPanel && !leftTelemetryPanel.classList.contains('dialog-dragged')) {
    const maxLeftY = Math.max(12, appState.H - leftH - 52);
    const leftY = Math.max(12, Math.min(maxLeftY, uiFollowY - leftH * 0.55));
    setPosIfChanged(leftTelemetryPanel, leftX, leftY);
  }

  if (appState.isRightPanelOpen && rightActionPanel && !rightActionPanel.classList.contains('dialog-dragged')) {
    const maxRightY = Math.max(12, appState.H - rightH - 52);
    const rightY = Math.max(12, Math.min(maxRightY, uiFollowY - rightH * 0.48));
    setPosIfChanged(rightActionPanel, rightX, rightY);
  }
}
