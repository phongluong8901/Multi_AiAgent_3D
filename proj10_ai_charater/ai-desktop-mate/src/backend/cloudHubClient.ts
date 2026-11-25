import { invoke } from '@tauri-apps/api/core';
import {
  CloudAuthStatus,
  CloudHubConfigPublic,
  CommunitySkillDoc,
  InstallCommunitySkillResult,
  SyncedChatMessage,
} from '../core/types';

export async function getCloudHubConfig(): Promise<CloudHubConfigPublic> {
  return invoke<CloudHubConfigPublic>('cloud_get_config');
}

export async function saveCloudHubConfig(payload: {
  google_client_id: string;
  google_client_secret?: string;
  cloud_hub_api_url: string;
}): Promise<CloudHubConfigPublic> {
  return invoke<CloudHubConfigPublic>('cloud_save_config', { payload });
}

export async function checkCloudHubHealth(): Promise<{
  ok: boolean;
  mongo_connected?: boolean;
}> {
  return invoke<{ ok: boolean; mongo_connected?: boolean }>('cloud_check_hub_health');
}

export async function getCloudAuthStatus(): Promise<CloudAuthStatus> {
  return invoke<CloudAuthStatus>('cloud_get_auth_status');
}

export async function loginWithGoogleOAuth(): Promise<CloudAuthStatus> {
  return invoke<CloudAuthStatus>('cloud_google_login');
}

export async function logoutGoogleOAuth(): Promise<CloudAuthStatus> {
  return invoke<CloudAuthStatus>('cloud_google_logout');
}

export async function listCommunitySkills(
  query?: string,
  language?: string
): Promise<CommunitySkillDoc[]> {
  return invoke<CommunitySkillDoc[]>('cloud_list_community_skills', {
    query: query ?? null,
    language: language ?? null,
  });
}

export async function publishLocalSkillToCloud(skillId: string): Promise<CommunitySkillDoc> {
  return invoke<CommunitySkillDoc>('cloud_publish_skill', { skillId });
}

export async function installCommunitySkillFromCloudRaw(
  skillKey: string
): Promise<InstallCommunitySkillResult> {
  return invoke<InstallCommunitySkillResult>('cloud_install_community_skill', {
    skillKey,
  });
}

export async function deleteCommunitySkill(skillKey: string): Promise<string> {
  return invoke<string>('cloud_delete_community_skill', { skillKey });
}

export async function toggleStarCommunitySkill(
  skillKey: string
): Promise<{ ok: boolean; stars: number; starred: boolean }> {
  return invoke<{ ok: boolean; stars: number; starred: boolean }>('cloud_toggle_star_skill', {
    skillKey,
  });
}

export async function syncChatPushToCloud(
  msgId: string,
  role: 'user' | 'assistant',
  content: string,
  createdAtMs: number
): Promise<void> {
  await invoke('cloud_sync_chat_push', {
    msgId,
    role,
    content,
    createdAtMs,
  });
}

export async function syncChatStreamChunkToCloud(
  streamId: string,
  token: string,
  done: boolean
): Promise<void> {
  await invoke('cloud_sync_chat_stream_chunk', {
    streamId,
    token,
    done,
  });
}

export async function syncChatPullFromCloud(sinceMs = 0): Promise<SyncedChatMessage[]> {
  return invoke<SyncedChatMessage[]>('cloud_sync_chat_pull', { sinceMs });
}

export async function openWebChatCompanion(): Promise<string> {
  return invoke<string>('cloud_open_web_companion');
}
