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