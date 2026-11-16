import '../styles/base.css';
import '../styles/panels.css';
import '../styles/bubble-studio.css';

import { leftTelemetryPanelHtml } from './leftTelemetryPanel';
import { rightActionPanelHtml } from './rightActionPanel';
import { speechBubbleHtml } from './speechBubble';
import { studioModalHtml } from './studioModal';
import { longMemoryModalHtml } from './longMemoryModal';

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
  ].join('\n');
  mounted = true;
}

