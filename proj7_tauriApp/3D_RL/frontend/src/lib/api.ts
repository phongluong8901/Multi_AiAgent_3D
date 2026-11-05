const API_BASE = "http://localhost:8000/api";

export async function startTraining(timesteps = 80000, nEnvs = 1) {
    const res = await fetch(
        `${API_BASE}/train/start?timesteps=${timesteps}&n_envs=${nEnvs}`,
        { method: "POST" }
    );
    return res.json();
}

export async function loadModel(modelName = "obstacle_ppo_latest") {
    const res = await fetch(
        `${API_BASE}/model/load?model_name=${modelName}`,
        { method: "POST" }
    );
    return res.json();
}

export async function startPlay(episodes = 3) {
    const res = await fetch(
        `${API_BASE}/play/start?episodes=${episodes}`,
        { method: "POST" }
    );
    return res.json();
}

export async function stopPlay() {
    const res = await fetch(`${API_BASE}/play/stop`, { method: "POST" });
    return res.json();
}

export async function getStatus() {
    const res = await fetch(`${API_BASE}/train/status`);
    return res.json();
}

export async function feedAgent(kcal = 250) {
    const res = await fetch(`${API_BASE}/state/feed?kcal=${kcal}`, {
        method: "POST",
    });
    return res.json();
}

export async function restAgent() {
    const res = await fetch(`${API_BASE}/state/rest`, { method: "POST" });
    return res.json();
}

export async function saveAgentState() {
    const res = await fetch(`${API_BASE}/state/save`, { method: "POST" });
    return res.json();
}

export async function loadAgentState() {
    const res = await fetch(`${API_BASE}/state/load`, { method: "POST" });
    return res.json();
}

export async function resetAgentState(fullReset = true) {
    const res = await fetch(`${API_BASE}/state/reset?full_reset=${fullReset}`, {
        method: "POST",
    });
    return res.json();
}

export async function clearDemos() {
    const res = await fetch(`${API_BASE}/demos/clear`, { method: "POST" });
    return res.json();
}
