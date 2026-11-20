import '../styles/base.css';
import '../styles/panels.css';
import '../styles/bubble-studio.css';

import { leftTelemetryPanelHtml } from './leftTelemetryPanel';
import { rightActionPanelHtml } from './rightActionPanel';
import { speechBubbleHtml } from './speechBubble';
import { studioModalHtml } from './studioModal';
import { longMemoryModalHtml } from './longMemoryModal';
import { notificationModalHtml } from './notificationModal';
import { p2pArenaModalHtml } from './p2pArenaModal';
import { pcControlModalHtml } from './pcControlModal';
import { ocrTranslateModalHtml } from './ocrTranslateModal';
import { toolForgeModalHtml } from './toolForgeModal';
import { tarotModalHtml } from './tarotModal';
import { miniScreenPanelHtml } from './miniScreenPanel';

let mounted = false;

export function mountUi() {
  if (mounted) return;
  const root = document.getElementById('app-ui');
  if (!root) return;
  root.innerHTML = [
    leftTelemetryPanelHtml,
    rightActionPanelHtml,
    speechBubbleHtml,
    studioModalHtml,
    longMemoryModalHtml,
    notificationModalHtml,
    p2pArenaModalHtml,
    pcControlModalHtml,
    ocrTranslateModalHtml,
    toolForgeModalHtml,
    tarotModalHtml,
    miniScreenPanelHtml,
  ].join('\n');
  mounted = true;
}

