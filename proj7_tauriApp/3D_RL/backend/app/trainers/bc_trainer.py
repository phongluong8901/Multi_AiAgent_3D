import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from ..core.persistence import persistence_manager
from ..core.config import settings, BASE_DIR
from ..core.websocket_manager import manager


class BCPolicyNetwork(nn.Module):
    """
    Mang no-ron chinh sach cho Behavioral Cloning (Hoc bat chuoc tu Teacher).
    Kien truc MLP 3 lop:
    - Input: Vector quan sat 28 chieu (robot, goal, food, water, bed, obstacles, internal state).
    - Hidden: 128 -> LayerNorm -> LeakyReLU -> 64 -> LayerNorm -> LeakyReLU.
    - Output: Vector van toc [vx, vz] 2 chieu qua Tanh() nhan max_speed (1.4m/s).
    """

    def __init__(self, obs_dim: int = 28, act_dim: int = 2, max_speed: float = 1.4):
        """
        Khoi tao mang BCPolicyNetwork.

        Args:
            obs_dim (int): So chieu quan sat (28).
            act_dim (int): So chieu hanh dong van toc (2).
            max_speed (float): Toc do toi da.
        """
        super().__init__()
        self.max_speed = max_speed
        self.net = nn.Sequential(
            nn.Linear(obs_dim, 128),
            nn.LayerNorm(128),
            nn.LeakyReLU(0.1),
            nn.Linear(128, 64),
            nn.LayerNorm(64),
            nn.LeakyReLU(0.1),
            nn.Linear(64, act_dim),
            nn.Tanh(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Lan truyen tien: s -> a in [-max_speed, max_speed]."""
        return self.net(x) * self.max_speed


class BCTrainer:
    """
    Huan luyen vien Hoc Bat Chuoc (Imitation Learning / Behavioral Cloning).
    Hoc truc tiep tu kho du lieu thi pham (Demonstrations) cua Nguoi Huong Dan:
    - Tu dong nap du lieu tu SQLite (bang demonstrations).
    - Huan luyen giam sat (Supervised Learning) bang MSELoss toi uu hoa AdamW.
    - Ban telemetry tien do huan luyen % va Loss qua WebSocket ve frontend theo thoi gian thuc.
    - Luu checkpoint tai models/bc_policy_latest.pt de dung suy luan tuc thi.
    """

    def __init__(self):
        """Khoi tao BCTrainer va xac dinh duong dan checkpoint."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[BCPolicyNetwork] = None
        self.model_path = BASE_DIR / "models" / "bc_policy_latest.pt"
        self.is_training: bool = False
        self.is_playing: bool = False
        self._ensure_model_dir()

    def _ensure_model_dir(self):
        """Dam bao thu muc chua mo hinh ton tai."""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)

    def is_model_available(self) -> bool:
        """Kiem tra xem file mo hinh checkpoint bc_policy_latest.pt da ton tai chua."""
        return self.model_path.exists()

    def load_model(self) -> bool:
        """
        Nap trong so mo hinh tu file bc_policy_latest.pt vao bo nho.

        Returns:
            bool: True neu nap thanh cong, False neu that bai hoac chua co file.
        """
        if not self.model_path.exists():
            return False
        try:
            net = BCPolicyNetwork().to(self.device)
            state_dict = torch.load(str(self.model_path), map_location=self.device)
            net.load_state_dict(state_dict)
            net.eval()
            self.model = net
            return True
        except Exception:
            return False

    def predict(self, obs: np.ndarray) -> np.ndarray:
        """
        Du doan vector van toc [vx, vz] tu vector quan sat obs.

        Args:
            obs (np.ndarray): Vector quan sat 28 chieu.

        Returns:
            np.ndarray: Vector van toc du doan [-1.4, 1.4].
        """
        if self.model is None:
            if not self.load_model():
                return np.zeros(2, dtype=np.float32)
        with torch.no_grad():
            x = torch.as_tensor(obs, dtype=torch.float32, device=self.device).unsqueeze(0)
            act = self.model(x).squeeze(0).cpu().numpy()
            return np.clip(act, -1.4, 1.4)

    def auto_generate_expert_demos(
        self,
        count: int = 150,
        env_cls=None,
        cognitive_cls=None,
    ) -> int:
        """
        Tu dong tao ra cac mau thi pham chat luong cao tu bo dieu huong chuyen gia
        de nguoi dung co the ngay lap tuc thu nghiem Huan Luyen Bat Chuoc ma khong can lai bang tay.

        Args:
            count (int): So luong buoc mau thi pham can sinh (mac dinh 150).
            env_cls: Lop moi truong (mac dinh ChildWorldEnv).
            cognitive_cls: Lop bo nao chuyen gia (mac dinh CognitiveController).

        Returns:
            int: Tong so mau thi pham hien co sau khi sinh.
        """
        from ..envs.child_world_env import ChildWorldEnv
        from ..brain.cognitive_controller import CognitiveController

        env = (env_cls or ChildWorldEnv)(persist_internal=False)
        cognitive = (cognitive_cls or CognitiveController)()

        env.reset()
        targets = [
            ("food", env.food_pos),
            ("water", env.water_pos),
            ("bed", env.bed_pos),
            ("goal", env.goal_pos),
        ]

        target_idx = 0
        recorded = 0

        for _ in range(count):
            t_name, t_pos = targets[target_idx % len(targets)]
            obs_before = env._get_obs().tolist()

            # Bo dieu khien chuyen gia tinh toan luc day ne vat can
            act = cognitive.compute_autonomous_action(
                robot_pos=env.robot_pos,
                target_pos=t_pos,
                obstacles=env.obstacles,
                max_speed=env.max_speed,
            )

            _, reward, terminated, _, info = env.step(np.array(act, dtype=np.float32))

            persistence_manager.record_demonstration(
                obs=obs_before,
                action=act,
                drives=info["drives_state"]["drives"],
                energy=info["energy_state"]["energy"],
                reward=float(reward),
            )
            recorded += 1

            dist = np.linalg.norm(env.robot_pos - t_pos)
            if dist < 1.2 or terminated:
                target_idx += 1
                if terminated:
                    env.reset()

        return persistence_manager.get_demo_count()

    def train(self, epochs: int = 35, batch_size: int = 32, lr: float = 1e-3) -> Dict[str, Any]:
        """
        Thuc hien qua trinh huan luyen Behavioral Cloning tu tap du lieu thi pham.

        Args:
            epochs (int): So luot epoch huan luyen (mac dinh 35).
            batch_size (int): Kich thuoc batch (mac dinh 32).
            lr (float): Toc do hoc cua AdamW (mac dinh 1e-3).

        Returns:
            Dict[str, Any]: Ket qua huan luyen gom status, loss, epochs, count, model_path.
        """
        demos = persistence_manager.load_all_demonstrations()
        valid_demos = [d for d in demos if len(d.get("obs", [])) == 28 and len(d.get("action", [])) == 2]

        if len(valid_demos) < 10:
            return {
                "status": "not_enough_data",
                "count": len(valid_demos),
                "message": "[CẢNH BÁO] Cần ít nhất 10 mẫu thị phạm hợp lệ (28 chiều) để huấn luyện Bắt Chước.",
            }

        self.is_training = True
        try:
            obs_list = [d["obs"] for d in valid_demos]
            act_list = [d["action"] for d in valid_demos]

            x_train = torch.as_tensor(obs_list, dtype=torch.float32, device=self.device)
            y_train = torch.as_tensor(act_list, dtype=torch.float32, device=self.device)

            dataset = TensorDataset(x_train, y_train)
            loader = DataLoader(dataset, batch_size=min(batch_size, len(dataset)), shuffle=True)

            model = BCPolicyNetwork().to(self.device)
            optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
            criterion = nn.MSELoss()

            model.train()
            final_loss = 0.0

            for ep in range(epochs):
                ep_loss = 0.0
                batches = 0
                for bx, by in loader:
                    optimizer.zero_grad()
                    pred = model(bx)
                    loss = criterion(pred, by)
                    loss.backward()
                    optimizer.step()
                    ep_loss += loss.item()
                    batches += 1

                final_loss = ep_loss / max(1, batches)

                # Ban telemetry tien do huan luyen qua WebSocket ve giao dien
                try:
                    manager.broadcast_sync(
                        {
                            "type": "bc_progress",
                            "epoch": ep + 1,
                            "total_epochs": epochs,
                            "pct": round(((ep + 1) / epochs) * 100, 1),
                            "loss": round(final_loss, 5),
                            "count": len(demos),
                        }
                    )
                except Exception:
                    pass

            self.model = model
            try:
                self._ensure_model_dir()
                torch.save(model.state_dict(), str(self.model_path))
            except Exception:
                pass

            try:
                manager.broadcast_sync(
                    {
                        "type": "bc_done",
                        "message": f"[THÀNH CÔNG] Huấn luyện Behavioral Cloning hoàn tất ({epochs} epochs, Loss: {final_loss:.4f})",
                        "loss": round(final_loss, 4),
                        "count": len(demos),
                    }
                )
            except Exception:
                pass

            return {
                "status": "completed",
                "loss": round(final_loss, 4),
                "epochs": epochs,
                "count": len(demos),
                "model_path": str(self.model_path),
            }
        finally:
            self.is_training = False


# The hien singleton toan cuc
bc_trainer = BCTrainer()
