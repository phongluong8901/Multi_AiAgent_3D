import collections
import random
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim


# ==============================================================================
# 1. MO HINH THE GIOI & MODULE TO MO NOI TAI (ICM)
# ==============================================================================

class WorldModelICM(nn.Module):
    """
    World Model & Intrinsic Curiosity Module (ICM) theo kien truc Pathak et al.
    Bao gom:
    - Feature Encoder phi(s): Chuyen vector quan sat 28 chieu sang khong gian dac trung 64 chieu.
    - Forward Dynamics Model: Du doan trang thai tuong lai phi(s_{t+1}) tu phi(s_t) va hanh dong a_t.
    - Inverse Dynamics Model: Du doan hanh dong a_t tu phi(s_t) va phi(s_{t+1}) de loai bo yeu to khong kiem soat duoc.
    - Curiosity Reward: Sai so du doan cua Forward Model (Prediction Error) = Thuong to mo noi tai.
    - Surprise Metric: Do luong muc do 'bat ngo' (tanh cua forward error) truoc cac tinh huong moi la.
    """

    def __init__(self, obs_dim: int = 28, act_dim: int = 2, feature_dim: int = 64, eta: float = 0.25):
        """
        Khoi tao cac khoi mang nơ-ron cua ICM.

        Args:
            obs_dim (int): So chieu vector quan sat (28).
            act_dim (int): So chieu vector hanh dong van toc (2: [vx, vz]).
            feature_dim (int): So chieu khong gian dac trung an phi(s) (64).
            eta (float): He so can bang diem thuong to mo.
        """
        super().__init__()
        self.eta = eta
        self.feature_dim = feature_dim

        # 1. Feature Encoder: Nen thong tin khong gian trang thai
        self.encoder = nn.Sequential(
            nn.Linear(obs_dim, 128),
            nn.LayerNorm(128),
            nn.LeakyReLU(0.1),
            nn.Linear(128, feature_dim),
            nn.LayerNorm(feature_dim),
            nn.LeakyReLU(0.1),
        )

        # 2. Forward Dynamics Model: phi(s_t) + a_t -> phi(s_{t+1})
        self.forward_model = nn.Sequential(
            nn.Linear(feature_dim + act_dim, 96),
            nn.LayerNorm(96),
            nn.LeakyReLU(0.1),
            nn.Linear(96, feature_dim),
        )

        # 3. Inverse Dynamics Model: phi(s_t) + phi(s_{t+1}) -> a_t
        self.inverse_model = nn.Sequential(
            nn.Linear(feature_dim * 2, 96),
            nn.LayerNorm(96),
            nn.LeakyReLU(0.1),
            nn.Linear(96, act_dim),
            nn.Tanh(),
        )

    def forward(self, obs: torch.Tensor, next_obs: torch.Tensor, action: torch.Tensor):
        """
        Lan truyen tien qua ca 3 khoi: Encoder, Forward Model va Inverse Model.

        Args:
            obs (torch.Tensor): Vector quan sat tai s_t [B, obs_dim].
            next_obs (torch.Tensor): Vector quan sat tai s_{t+1} [B, obs_dim].
            action (torch.Tensor): Hanh dong da thuc thi a_t [B, act_dim].

        Returns:
            Tuple[torch.Tensor, torch.Tensor, torch.Tensor]: phi_next, pred_phi_next, pred_action.
        """
        phi_t = self.encoder(obs)
        phi_next = self.encoder(next_obs)

        # Du doan trang thai ke tiep
        forward_in = torch.cat([phi_t, action], dim=-1)
        pred_phi_next = self.forward_model(forward_in)

        # Du doan hanh dong da gay ra su thay doi trang thai
        inverse_in = torch.cat([phi_t, phi_next], dim=-1)
        pred_action = self.inverse_model(inverse_in)

        return phi_next, pred_phi_next, pred_action

    def compute_intrinsic_reward(
        self,
        obs: torch.Tensor,
        action: torch.Tensor,
        next_obs: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Tinh diem thuong to mo noi tai (Intrinsic Curiosity Reward) va sai so du doan.

        Args:
            obs (torch.Tensor): Quan sat s_t.
            action (torch.Tensor): Hanh dong a_t.
            next_obs (torch.Tensor): Quan sat s_{t+1}.

        Returns:
            Tuple[torch.Tensor, torch.Tensor, torch.Tensor]: (intrinsic_reward, forward_err, inverse_err).
        """
        phi_next, pred_phi_next, pred_action = self.forward(obs, next_obs, action)

        # Forward loss: Sai so du doan giua thuc te phi(s_{t+1}) va ky vong
        forward_err = 0.5 * torch.sum((pred_phi_next - phi_next) ** 2, dim=-1, keepdim=True)
        intrinsic_reward = self.eta * forward_err

        # Inverse loss: Sai so du doan hanh dong
        inverse_err = 0.5 * torch.sum((pred_action - action) ** 2, dim=-1, keepdim=True)

        return intrinsic_reward, forward_err, inverse_err


# ==============================================================================
# 2. BO DEM TRAI NGHIEM UU TIEN (PER) VOI SURPRISE BIAS
# ==============================================================================

class PrioritizedReplayBuffer:
    """
    Bo Dem Trai Nghiem Uu Tien theo Do Bat Ngo va TD-Error (Prioritized Experience Replay - PER):
    - Do uu tien: p_i = (|TD_error| + 0.2 * surprise + epsilon)^alpha.
    - Xac suat lay mau: P(i) = p_i / sum(p_k).
    - Importance Sampling Weights: w_i = (N * P(i))^(-beta) / max(w) de triet tieu do lech gradient.
    """

    def __init__(self, capacity: int = 5000, alpha: float = 0.6, beta_start: float = 0.4):
        """
        Khoi tao bo dem PER.

        Args:
            capacity (int): Dung luong toi da cua bo dem (5000).
            alpha (float): He so mu quy dinh muc do uu tien ngat nghèo [0.0 = deu, 1.0 = hoan toan uu tien].
            beta_start (float): He so Importance Sampling ban dau, tang dan toi 1.0.
        """
        self.capacity = capacity
        self.alpha = alpha
        self.beta = beta_start
        self.beta_increment = 0.0005
        self.buffer: List[Dict[str, Any]] = []
        self.priorities = np.zeros((capacity,), dtype=np.float32)
        self.pos = 0
        self.epsilon = 1e-4

    def __len__(self) -> int:
        return len(self.buffer)

    def add(
        self,
        obs: np.ndarray,
        action: np.ndarray,
        reward: float,
        next_obs: np.ndarray,
        done: bool,
        is_social: bool = False,
        surprise: float = 0.0,
        td_error: Optional[float] = None,
    ) -> None:
        """
        Them mot mau kinh nghiem vao bo dem.

        Args:
            obs (np.ndarray): Quan sat s_t.
            action (np.ndarray): Hanh dong a_t.
            reward (float): Tong thuong (ngoai tai + to mo noi tai).
            next_obs (np.ndarray): Quan sat s_{t+1}.
            done (bool): Co bao hieu ket thuc tap.
            is_social (bool): True neu la mau hoc quan sat tu ban be.
            surprise (float): Muc do bat ngo duoc danh gia tu ICM.
            td_error (Optional[float]): Sai so Temporal-Difference ban dau neu co.
        """
        max_p = self.priorities.max() if len(self.buffer) > 0 else 1.0
        if max_p <= 0.0:
            max_p = 1.0

        item = {
            "obs": np.asarray(obs, dtype=np.float32),
            "action": np.asarray(action, dtype=np.float32),
            "reward": float(reward),
            "next_obs": np.asarray(next_obs, dtype=np.float32),
            "done": bool(done),
            "is_social": bool(is_social),
            "surprise": float(surprise),
        }

        if len(self.buffer) < self.capacity:
            self.buffer.append(item)
        else:
            self.buffer[self.pos] = item

        # Tinh priority ban dau dua tren TD-error hoac Max priority hien tai
        if td_error is not None:
            priority = (abs(td_error) + 0.2 * surprise + self.epsilon) ** self.alpha
        else:
            priority = max_p

        self.priorities[self.pos] = float(priority)
        self.pos = (self.pos + 1) % self.capacity

    def sample(self, batch_size: int = 24) -> Tuple[List[int], List[Dict[str, Any]], np.ndarray]:
        """
        Lay mau mot batch co trong so theo phan phoi xac suat do uu tien.

        Args:
            batch_size (int): Kich thuoc batch can lay mau (mac dinh 24).

        Returns:
            Tuple[List[int], List[Dict[str, Any]], np.ndarray]: (indices, samples, is_weights).
        """
        n = len(self.buffer)
        if n == 0:
            return [], [], np.array([], dtype=np.float32)

        prios = self.priorities[:n]
        probs = prios / prios.sum()

        indices = np.random.choice(n, batch_size, p=probs)
        samples = [self.buffer[idx] for idx in indices]

        # Importance Sampling Weights
        self.beta = min(1.0, self.beta + self.beta_increment)
        weights = (n * probs[indices]) ** (-self.beta)
        weights = weights / (weights.max() + 1e-8)

        return list(indices), samples, weights.astype(np.float32)

    def update_priorities(self, indices: List[int], td_errors: np.ndarray, surprises: Optional[np.ndarray] = None) -> None:
        """
        Cap nhat lai do uu tien cua cac mau vua huan luyen dua tren TD-error moi nhat.

        Args:
            indices (List[int]): Chi so cac phan tu can cap nhat.
            td_errors (np.ndarray): Mang gia tri tuyet doi TD-error.
            surprises (Optional[np.ndarray]): Mang muc do bat ngo tuong ung.
        """
        for idx, td in zip(indices, td_errors):
            surp = surprises[idx] if (surprises is not None and idx < len(surprises)) else 0.0
            p = (abs(float(td)) + 0.2 * float(surp) + self.epsilon) ** self.alpha
            self.priorities[idx] = float(p)

    def get_top_salient(self, k: int = 12) -> List[Dict[str, Any]]:
        """
        Lay ra k ky uc co do uu tien cao nhat phuc vu co che Giac Mong Tai Hien Ban Dem.

        Args:
            k (int): So luong ky uc tieu bieu can lay.

        Returns:
            List[Dict[str, Any]]: Danh sach cac ky uc bat ngo va cam xuc nhat.
        """
        n = len(self.buffer)
        if n == 0:
            return []
        top_indices = np.argsort(self.priorities[:n])[-min(k, n):]
        return [self.buffer[idx] for idx in top_indices]

    def clear(self) -> None:
        """Xoa sach bo dem trai nghiem."""
        self.buffer.clear()
        self.priorities.fill(0.0)
        self.pos = 0


# ==============================================================================
# 3. MANG NO-RON ACTOR-CRITIC LIEN TUC
# ==============================================================================

class OnlineActorCritic(nn.Module):
    """
    Mang No-ron Actor-Critic lien tuc (Continuous Action Space):
    - Backbone chung (Shared MLP): Trich xuat dac trung quan sat 28 chieu.
    - Actor Head: Tinh toan mean cua van toc [vx, vz] va log_std dung phan phoi Gaussian.
    - Critic Head: Danh gia gia tri ky vong V(s) de tinh Advantage trong gradient update.
    """

    def __init__(self, obs_dim: int = 28, act_dim: int = 2, max_speed: float = 2.4):
        super().__init__()
        self.max_speed = max_speed

        self.shared = nn.Sequential(
            nn.Linear(obs_dim, 128),
            nn.LayerNorm(128),
            nn.LeakyReLU(0.1),
            nn.Linear(128, 64),
            nn.LayerNorm(64),
            nn.LeakyReLU(0.1),
        )

        self.actor_mean = nn.Sequential(
            nn.Linear(64, act_dim),
            nn.Tanh(),
        )
        self.actor_log_std = nn.Parameter(torch.ones(act_dim) * -0.5)
        self.critic = nn.Linear(64, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Lan truyen tien:
        Args:
            x (torch.Tensor): Vector quan sat [B, obs_dim].
        Returns:
            Tuple[torch.Tensor, torch.Tensor, torch.Tensor]: (action_mean, action_std, value).
        """
        feat = self.shared(x)
        action_mean = self.actor_mean(feat) * self.max_speed
        value = self.critic(feat)
        return action_mean, self.actor_log_std.exp(), value


# ==============================================================================
# 4. BO NAO TU HOC NO-RON TONG HOP (ONLINE CONTINUAL LEARNER)
# ==============================================================================

class OnlineLearner:
    """
    Bo Nao Tu Hoc Truc Tuyen Toan Dien (Online Continual Reinforcement Learning Brain):
    1. World Model & Intrinsic Curiosity Module (ICM): Tinh diem thuong to mo va bat ngo.
    2. Cross-Agent Social Observational RL: Hoc quan sat tu thanh cong va that bai cua ban be.
    3. Prioritized Experience Replay (PER): Luu tru va uu tien cac ky uc bat ngo.
    4. Hippocampal Sleep Dream Replay: Tai hien va cung co nơ-ron ban dem khi be ve Villa ngu.
    """

    def __init__(self, obs_dim: int = 28, act_dim: int = 2, lr: float = 7e-4, max_speed: float = 2.4):
        """
        Khoi tao bo nao tu hoc truc tuyen.

        Args:
            obs_dim (int): So chieu quan sat (28).
            act_dim (int): So chieu hanh dong (2).
            lr (float): Toc do hoc cua Actor-Critic (7e-4).
            max_speed (float): Toc do di chuyen toi da cua be.
        """
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.max_speed = max_speed

        # Mang chinh sach Actor-Critic
        self.model = OnlineActorCritic(obs_dim=obs_dim, act_dim=act_dim, max_speed=max_speed).to(self.device)
        self.optimizer = optim.AdamW(self.model.parameters(), lr=lr, weight_decay=1e-4)

        # Mo hinh the gioi & Dong luc to mo ICM
        self.icm = WorldModelICM(obs_dim=obs_dim, act_dim=act_dim, feature_dim=64, eta=0.30).to(self.device)
        self.icm_optimizer = optim.AdamW(self.icm.parameters(), lr=5e-4, weight_decay=1e-4)

        # Bo dem trai nghiem uu tien theo do bat ngo
        self.per_buffer = PrioritizedReplayBuffer(capacity=5000, alpha=0.6)
        self.buffer = collections.deque(maxlen=4000)

        self.gamma: float = 0.98

        # Chi so do luong vi mach no-ron (Neural Circuit Metrics)
        self.total_online_updates: int = 0
        self.latest_loss: float = 0.0
        self.latest_value: float = 0.0
        self.latest_curiosity_bonus: float = 0.0
        self.latest_surprise_score: float = 0.0
        self.world_model_loss: float = 0.0
        self.step_counter: int = 0
        self.is_active: bool = True

        # Chi so hoc quan sat xa hoi (Social Learning Metrics)
        self.social_learning_events: int = 0
        self.last_social_reward: float = 0.0

        # Chi so giac mong tai hien ban dem (Dream Replay Metrics)
        self.dream_state = {
            "is_dreaming": False,
            "dream_topic": "Chưa có giấc mộng",
            "dream_cycles": 0,
            "replayed_memories": 0,
            "synaptic_plasticity_rate": 0.0,
            "last_dream_loss": 0.0,
        }

    def reset_weights(self) -> None:
        """Khoi tao lai toan bo trong so mang no-ron ve con so 0 ban dau (Tabula Rasa)."""
        for layer in list(self.model.modules()) + list(self.icm.modules()):
            if isinstance(layer, nn.Linear):
                nn.init.orthogonal_(layer.weight, gain=np.sqrt(2))
                if layer.bias is not None:
                    nn.init.constant_(layer.bias, 0.0)
        self.per_buffer.clear()
        self.buffer.clear()
        self.total_online_updates = 0
        self.latest_loss = 0.0
        self.latest_value = 0.0
        self.latest_curiosity_bonus = 0.0
        self.latest_surprise_score = 0.0
        self.world_model_loss = 0.0
        self.social_learning_events = 0
        self.dream_state["is_dreaming"] = False
        self.dream_state["dream_cycles"] = 0
        self.dream_state["dream_topic"] = "Tabula Rasa: Tâm trí trong sáng"

    def select_action(self, obs: np.ndarray, deterministic: bool = False) -> Tuple[np.ndarray, float]:
        """
        Chon hanh dong tu mang Actor-Critic dua tren quan sat obs.

        Args:
            obs (np.ndarray): Vector quan sat 28 chieu.
            deterministic (bool): True neu lay ky vong mean, False neu lay mau ngau nhien Gaussian.

        Returns:
            Tuple[np.ndarray, float]: (action, estimated_value).
        """
        self.model.eval()
        with torch.no_grad():
            x = torch.as_tensor(obs, dtype=torch.float32, device=self.device).unsqueeze(0)
            mean, std, val = self.model(x)
            v = float(val.item())
            self.latest_value = v

            if deterministic:
                action = mean.squeeze(0).cpu().numpy()
            else:
                dist = torch.distributions.Normal(mean, std)
                sample = dist.sample()
                action = sample.squeeze(0).cpu().numpy()

            clipped_action = np.clip(action, -self.max_speed, self.max_speed)
            return clipped_action, v

    def get_residual_action(
        self,
        obs: np.ndarray,
        base_action: np.ndarray,
        competence_factor: float = 0.35,
        max_speed: float = 2.4,
        deterministic: bool = False,
    ) -> Tuple[np.ndarray, np.ndarray, float]:
        """
        Hoc Tang Cuong Phan Du (Residual RL): Tron hanh dong quy hoach nen (base_action)
        voi hanh dong tu mang no-ron theo ti le nang luc competence_factor.

        Args:
            obs (np.ndarray): Vector quan sat 28 chieu.
            base_action (np.ndarray): Hanh dong tu luc the nang & Topo Graph A*.
            competence_factor (float): Ty le trao quyen cho mang no-ron [0.05 - 0.88].
            max_speed (float): Gioi han toc do toi da.
            deterministic (bool): Che do hanh dong.

        Returns:
            Tuple[np.ndarray, np.ndarray, float]: (final_action, neural_action, value).
        """
        neural_action, val = self.select_action(obs, deterministic=deterministic)
        alpha = float(np.clip(competence_factor, 0.05, 0.88))

        base_act = np.asarray(base_action, dtype=np.float32)
        blended = (1.0 - alpha) * base_act + alpha * neural_action
        final_action = np.clip(blended, -max_speed, max_speed)
        return final_action, neural_action, val

    def compute_curiosity_and_surprise(
        self, obs: np.ndarray, action: np.ndarray, next_obs: np.ndarray
    ) -> Tuple[float, float]:
        """
        Tinh toan thuong to mo va do bat ngo tu World Model ICM:
        - curiosity_bonus: Cong truc tiep vao reward de thuc day tinh to mo kham pha.
        - surprise_score: Chuan hoa do bat ngo [0.0, 1.0] de tang do uu tien trong bo dem PER.

        Args:
            obs (np.ndarray): Quan sat s_t.
            action (np.ndarray): Hanh dong a_t.
            next_obs (np.ndarray): Quan sat s_{t+1}.

        Returns:
            Tuple[float, float]: (curiosity_bonus, surprise_score).
        """
        self.icm.eval()
        with torch.no_grad():
            t_obs = torch.as_tensor(obs, dtype=torch.float32, device=self.device).unsqueeze(0)
            t_act = torch.as_tensor(action, dtype=torch.float32, device=self.device).unsqueeze(0)
            t_nobs = torch.as_tensor(next_obs, dtype=torch.float32, device=self.device).unsqueeze(0)

            int_rew, f_err, _ = self.icm.compute_intrinsic_reward(t_obs, t_act, t_nobs)
            c_bonus = float(int_rew.item())
            surprise = float(torch.tanh(f_err).item())

            self.latest_curiosity_bonus = round(c_bonus, 3)
            self.latest_surprise_score = round(surprise, 3)
            return c_bonus, surprise

    def record_transition(
        self,
        obs: np.ndarray,
        action: np.ndarray,
        reward: float,
        next_obs: np.ndarray,
        done: bool,
        feedback_weight: float = 0.0,
    ) -> None:
        """
        Ghi nhan trai nghiem ca nhan vao Bo Dem PER va Bo Dem Vong Tron.

        Args:
            obs (np.ndarray): s_t.
            action (np.ndarray): a_t.
            reward (float): r_t (bao gom diem thuong the gioi + thuong to mo).
            next_obs (np.ndarray): s_{t+1}.
            done (bool): Co bao ket thuc.
            feedback_weight (float): He so phan hoi khen thuong.
        """
        c_bonus, surprise = self.compute_curiosity_and_surprise(obs, action, next_obs)
        total_reward = reward + c_bonus

        self.per_buffer.add(
            obs=obs,
            action=action,
            reward=total_reward,
            next_obs=next_obs,
            done=done,
            is_social=False,
            surprise=surprise,
        )

        self.buffer.append(
            (
                np.asarray(obs, dtype=np.float32),
                np.asarray(action, dtype=np.float32),
                float(total_reward),
                np.asarray(next_obs, dtype=np.float32),
                bool(done),
                float(feedback_weight),
            )
        )

    def record_social_observation(
        self,
        peer_obs: np.ndarray,
        peer_action: np.ndarray,
        peer_reward: float,
        peer_next_obs: np.ndarray,
        peer_done: bool,
        event_type: str = "vicarious",
    ) -> None:
        """
        Hoc Quan Sat Xa Hoi Da Tac Tu (Cross-Agent Social Observational RL):
        Khi quan sat thay ban be thanh cong (an no, uong nuoc) hoac vap nga (va cham dau),
        ghi nhan trai nghiem gian tiep voi he so chiet khau xa hoi (social_discount = 0.75).

        Args:
            peer_obs (np.ndarray): Quan sat cua ban.
            peer_action (np.ndarray): Hanh dong ban da thuc hien.
            peer_reward (float): Diem thuong ban nhan duoc.
            peer_next_obs (np.ndarray): Trang thai ke tiep cua ban.
            peer_done (bool): Co ket thuc cua ban.
            event_type (str): Loai su kien quan sat ('vicarious_collision', 'vicarious_food',...).
        """
        social_discount = 0.75
        effective_reward = float(peer_reward * social_discount)

        _, surprise = self.compute_curiosity_and_surprise(peer_obs, peer_action, peer_next_obs)
        surprise_bonus = max(surprise, 0.45 if abs(peer_reward) > 3.0 else 0.2)

        self.per_buffer.add(
            obs=peer_obs,
            action=peer_action,
            reward=effective_reward,
            next_obs=peer_next_obs,
            done=peer_done,
            is_social=True,
            surprise=surprise_bonus,
        )

        self.social_learning_events += 1
        self.last_social_reward = round(effective_reward, 2)

    def learn_step(self, batch_size: int = 24) -> Optional[float]:
        """
        Thuc hien mot buoc toi uu hoa gradient descent truc tuyen:
        - Lay mau co trong so tu Prioritized Replay Buffer (PER).
        - Cap nhat ca Actor-Critic va World Model ICM dong thoi.
        - Cap nhat lai Priorities trong PER dua tren TD-error moi nhat.

        Args:
            batch_size (int): Kich thuoc batch can cap nhat.

        Returns:
            Optional[float]: Gia tri loss tong hop sau buoc hoc, hoac None neu chua du du lieu.
        """
        if not self.is_active or len(self.per_buffer) < batch_size:
            return None

        self.step_counter += 1
        if self.step_counter % 2 != 0:
            return None

        indices, batch, weights = self.per_buffer.sample(batch_size)
        if len(batch) == 0:
            return None

        obs_b = torch.as_tensor(np.array([b["obs"] for b in batch]), dtype=torch.float32, device=self.device)
        act_b = torch.as_tensor(np.array([b["action"] for b in batch]), dtype=torch.float32, device=self.device)
        rew_b = torch.as_tensor(np.array([b["reward"] for b in batch]), dtype=torch.float32, device=self.device).unsqueeze(1)
        next_obs_b = torch.as_tensor(np.array([b["next_obs"] for b in batch]), dtype=torch.float32, device=self.device)
        done_b = torch.as_tensor(np.array([b["done"] for b in batch]), dtype=torch.float32, device=self.device).unsqueeze(1)
        is_weights = torch.as_tensor(weights, dtype=torch.float32, device=self.device).unsqueeze(1)

        # A. Cap nhat Actor-Critic voi Importance Sampling Weights
        self.model.train()
        self.optimizer.zero_grad()

        mean, std, values = self.model(obs_b)
        with torch.no_grad():
            _, _, next_values = self.model(next_obs_b)
            targets = rew_b + (1.0 - done_b) * self.gamma * next_values

        td_error = targets - values
        critic_loss = (is_weights * td_error.pow(2)).mean()

        dist = torch.distributions.Normal(mean, std)
        log_prob = dist.log_prob(act_b).sum(dim=-1, keepdim=True)
        advantage = td_error.detach()
        actor_loss = -(is_weights * log_prob * advantage).mean()

        ac_loss = critic_loss + 0.5 * actor_loss
        ac_loss.backward()
        nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
        self.optimizer.step()

        # B. Cap nhat World Model ICM
        self.icm.train()
        self.icm_optimizer.zero_grad()
        _, f_err, inv_err = self.icm.compute_intrinsic_reward(obs_b, act_b, next_obs_b)
        icm_loss = 0.8 * f_err.mean() + 0.2 * inv_err.mean()
        icm_loss.backward()
        nn.utils.clip_grad_norm_(self.icm.parameters(), max_norm=1.0)
        self.icm_optimizer.step()

        # C. Cap nhat lai Priorities trong PER Buffer
        td_errs_np = td_error.detach().squeeze(-1).abs().cpu().numpy()
        surp_np = torch.tanh(f_err).detach().squeeze(-1).cpu().numpy()
        self.per_buffer.update_priorities(indices, td_errs_np, surp_np)

        self.total_online_updates += 1
        self.latest_loss = round(float(ac_loss.item()), 4)
        self.world_model_loss = round(float(icm_loss.item()), 4)
        return self.latest_loss

    def apply_immediate_feedback(self, is_praise: bool, last_obs: np.ndarray, last_action: np.ndarray) -> float:
        """
        Micro-RLHF cap toc theo phan hoi Khen / Phat cua Teacher:
        Thuc hien ngay 2 buoc gradient update truc tiep vao hanh vi vua xay ra.

        Args:
            is_praise (bool): True neu la khen thuong (+5), False neu la phat (-8).
            last_obs (np.ndarray): Quan sat ngay truoc khi co phan hoi.
            last_action (np.ndarray): Hanh dong can duoc tang/giam xac suat.

        Returns:
            float: Gia tri loss cua buoc cap nhat tuc thi.
        """
        self.model.train()
        x = torch.as_tensor(last_obs, dtype=torch.float32, device=self.device).unsqueeze(0)
        a = torch.as_tensor(last_action, dtype=torch.float32, device=self.device).unsqueeze(0)

        adv_multiplier = 4.0 if is_praise else -6.0
        for _ in range(2):
            self.optimizer.zero_grad()
            mean, std, _ = self.model(x)
            dist = torch.distributions.Normal(mean, std)
            log_prob = dist.log_prob(a).sum()
            loss = -log_prob * adv_multiplier
            loss.backward()
            self.optimizer.step()

        self.total_online_updates += 2
        return float(loss.item())

    def dream_replay(self, num_cycles: int = 5, batch_size: int = 24) -> Dict[str, Any]:
        """
        Giac Mong Tai Hien Ban Dem (Hippocampal Sleep Dream Replay):
        Khi be ve Villa ngu hoac khi dem xuong tren thanh pho:
        - Trich xuat cac ky uc co do bat ngo (Surprise) va TD-error cao nhat trong ngay.
        - Thuc hien chuoi gradient updates toc do cao (Fast Synaptic Replay).
        - Tra ve chu de giac mo va thong so bien doi xi-nap than kinh (Synaptic Plasticity).

        Args:
            num_cycles (int): So chu ky huan luyen tai hien.
            batch_size (int): Kich thuoc batch moi chu ky.

        Returns:
            Dict[str, Any]: Thong tin giac mong gom chu de, chu ky, avg_loss va synaptic_rate.
        """
        if len(self.per_buffer) < 2:
            self.dream_state["is_dreaming"] = False
            return {"dream_replayed": False, "reason": "Chưa đủ ký ức để mơ"}

        actual_batch = min(batch_size, len(self.per_buffer))
        self.dream_state["is_dreaming"] = True
        self.dream_state["dream_cycles"] += 1

        dream_losses: List[float] = []
        salient_memories = self.per_buffer.get_top_salient(k=18)

        # Xac dinh chu de giac mo dua tren ky uc cam xuc nhat
        if salient_memories:
            top_mem = salient_memories[-1]
            if top_mem.get("is_social", False):
                topic = "Mơ về khoảnh khắc cùng bạn vượt qua thử thách trên phố"
            elif top_mem.get("reward", 0) < -10.0:
                topic = "Mơ về pha va chạm giao thông và cách bẻ lái tránh vật cản"
            elif top_mem.get("reward", 0) > 3.0:
                topic = "Mơ về bữa ăn ngon lành và làn nước mát lành sau hành trình"
            else:
                topic = "Mơ về những góc phố mới lạ vừa khám phá trong thành phố"
        else:
            topic = "Giấc ngủ êm đềm củng cố mạng nơ-ron nhận thức"

        self.dream_state["dream_topic"] = topic

        for _ in range(num_cycles):
            loss = self.learn_step(batch_size=actual_batch)
            if loss is not None:
                dream_losses.append(loss)

        avg_dream_loss = float(np.mean(dream_losses)) if dream_losses else self.latest_loss
        self.dream_state["last_dream_loss"] = round(avg_dream_loss, 4)
        self.dream_state["replayed_memories"] += len(salient_memories)
        self.dream_state["synaptic_plasticity_rate"] = round(float(np.clip(0.12 + 0.05 * len(dream_losses), 0.1, 0.95)), 2)

        return {
            "dream_replayed": True,
            "topic": topic,
            "cycles": num_cycles,
            "avg_loss": self.dream_state["last_dream_loss"],
            "synaptic_rate": self.dream_state["synaptic_plasticity_rate"],
        }

    def consolidate_memories(self, num_batches: int = 5, batch_size: int = 28) -> Dict[str, Any]:
        """
        Cung co bo nho offline dinh ky sau moi 120 buoc (tuong thich he thong phat trien).

        Args:
            num_batches (int): So luot batch huan luyen.
            batch_size (int): Kich thuoc batch.

        Returns:
            Dict[str, Any]: Ket qua huan luyen giac mong.
        """
        res = self.dream_replay(num_cycles=num_batches, batch_size=batch_size)
        res["consolidated_batches"] = num_batches
        return res

    def to_dict(self) -> Dict[str, Any]:
        """
        Dong goi toan bo thong so vi mach than kinh gui qua WebSocket cho NeuralCircuitDashboard.

        Returns:
            Dict[str, Any]: Chi so updates, loss, value, buffer_size, curiosity, surprise, dream_state.
        """
        return {
            "total_online_updates": self.total_online_updates,
            "latest_loss": self.latest_loss,
            "latest_value": round(self.latest_value, 2),
            "buffer_size": len(self.per_buffer),
            "is_active": self.is_active,
            "curiosity_bonus": self.latest_curiosity_bonus,
            "surprise_metric": self.latest_surprise_score,
            "world_model_loss": self.world_model_loss,
            "social_learning_events": self.social_learning_events,
            "last_social_reward": self.last_social_reward,
            "dream_state": dict(self.dream_state),
        }
