import asyncio
import time
from typing import Dict, Any, List, Optional
import numpy as np
from ..trainers.ppo_trainer import PPOTrainer, ppo_trainer
from ..trainers.bc_trainer import BCTrainer, bc_trainer
from ..envs.child_world_env import ChildWorldEnv
from ..brain.cognitive_controller import CognitiveController
from ..core.persistence import persistence_manager
from ..core.websocket_manager import manager


class TrainingService:
    """
    Dich vu Dieu phoi Trung uong (Central Simulation & Training Orchestrator).
    Ket noi toan bo cac khoi chuc nang cua backend:
    - ChildWorldEnv: Moi truong the gioi dai do thi 100m x 100m.
    - CognitiveController: 2 bo nao nhan thuc doc lap cho Be Bo (Agent 1) va Be Bi (Agent 2).
    - PPOTrainer: Huan luyen hoc tang cuong ngoai tuyen (Offline RL) qua Stable-Baselines3.
    - BCTrainer: Huan luyen hoc bat chuoc tu thi pham (Behavioral Cloning).
    - PersistenceManager: Luu tru JSON va SQLite.
    - ConnectionManager (WebSocket): Phat song du lieu realtime (22-25 Hz) cho Frontend.
    - Vong lap Tu hanh Sinh ton (Autonomous Life Loop): Mo phong cuoc song song hanh doc lap.
    """

    def __init__(self):
        """Khoi tao dich vu dieu phoi mo phong va nap lai trang thai da luu neu co."""
        self.trainer: PPOTrainer = ppo_trainer
        self.bc_trainer: BCTrainer = bc_trainer
        self.world_env = ChildWorldEnv(persist_internal=True)

        # Hai não bộ trẻ em độc lập tích hợp bản đồ nhận thức và mạng nơ-ron tự học trực tuyến
        self.cognitive = CognitiveController(name="Bé Bo", personality="energetic")
        self.cognitive2 = CognitiveController(name="Bé Bi", personality="cautious_empathic")

        self.interactive_step: int = 0

        # Chế độ chính sách vận động: "online_rl" (tự học liên tục), "heuristic" (tiềm năng), "bc" (mô hình bắt chước), "ppo" (mô hình offline)
        self.policy_mode: str = "online_rl"

        # Trạng thái vòng lặp tự hành sinh tồn (Autonomous Life)
        self.is_autonomous_life_active: bool = False
        self.simulation_speed: float = 1.0  # 1.0x, 2.0x, 0.0x (paused)
        self.last_events1: Dict[str, Any] = {}
        self.last_events2: Dict[str, Any] = {}

        # Tự động nạp trạng thái cũ từ ổ đĩa nếu có
        saved = persistence_manager.load_agent_state()
        if saved:
            self.world_env.import_state(saved)
            self.interactive_step = int(saved.get("step", 0))

        if self.bc_trainer.is_model_available():
            self.bc_trainer.load_model()

    @property
    def is_training(self) -> bool:
        """Kiem tra xem co tien trinh huan luyen PPO hoac BC nao dang chay khong."""
        return self.trainer.is_training or self.bc_trainer.is_training

    @property
    def is_playing(self) -> bool:
        """Kiem tra xem co tien trinh bieu dien play nao dang chay khong."""
        return self.trainer.is_playing or self.bc_trainer.is_playing

    def get_current_snapshot(self, mode: str = "idle", reward: float = 0.0) -> Dict[str, Any]:
        info = self.world_env.get_info()
        return {
            "type": "state",
            "mode": mode if not self.is_autonomous_life_active else "autonomous",
            "step": self.interactive_step,
            "reward": float(reward),
            # Vị trí hai bé
            "robot": info["robot"],
            "robot2": info["robot2"],
            "peer_dist": info["peer_dist"],
            "near_peer": info["near_peer"],
            # Các khu vực sinh hoạt
            "goal": info["goal"],
            "food": info["food"],
            "water": info["water"],
            "bed": info["bed"],
            "play": info.get("play", [14.0, 44.0]),
            "pool": info.get("pool", [45.0, 14.0]),
            "park": info.get("park", [14.0, 44.0]),
            "obstacles": info["obstacles"],
            "city_obstacles": info.get("city_obstacles", []),
            "city_obstacle_radii": info.get("city_obstacle_radii", []),
            "dist": info["dist_to_goal"],
            "food_capacity": info.get("food_capacity", 100.0),
            "water_capacity": info.get("water_capacity", 100.0),
            "food_time_left": info.get("food_time_left", 60.0),
            "water_time_left": info.get("water_time_left", 75.0),
            "food_max_time": info.get("food_max_time", 60.0),
            "water_max_time": info.get("water_max_time", 75.0),
            "depleted_spots": info.get("depleted_spots", []),
            "food_respawned": info.get("food_respawned", False),
            "water_respawned": info.get("water_respawned", False),
            "race_stats": info.get("race_stats", {}),
            "is_racing": info.get("is_racing", False),
            "world_size": info.get("world_size", 60.0),
            # Chu kỳ Ngày / Đêm sinh học đô thị
            "time_of_day": info.get("time_of_day", 8.5),
            "is_night": info.get("is_night", False),
            "day_phase": info.get("day_phase", "day"),
            # Tương tác & Sự kiện của Bé 1 (Bo)
            "collided": info["collided"],
            "ate_food": info["ate_food"],
            "drank_water": info["drank_water"],
            "is_resting": info["is_resting"],
            # Tương tác & Sự kiện của Bé 2 (Bi)
            "collided2": info.get("collided2", False),
            "ate_food2": info.get("ate_food2", False),
            "drank_water2": info.get("drank_water2", False),
            "is_resting2": info.get("is_resting2", False),
            # Năng lượng & Tâm lý hai bé
            "energy_state": info["energy_state"],
            "energy_state2": info["energy_state2"],
            "drives_state": info["drives_state"],
            "drives_state2": info["drives_state2"],
            # Tư duy & Lời nói của Bé 1 (Bo)
            "cognitive_state": self.cognitive.to_dict(),
            "current_thought": self.cognitive.current_thought,
            "current_goal_name": self.cognitive.current_goal_name,
            "current_goal_pos": self.cognitive.current_goal_pos.tolist(),
            # Tư duy & Lời nói của Bé 2 (Bi)
            "cognitive_state2": self.cognitive2.to_dict(),
            "current_thought2": self.cognitive2.current_thought,
            "current_goal_name2": self.cognitive2.current_goal_name,
            "current_goal_pos2": self.cognitive2.current_goal_pos.tolist(),
            # Thông tin chung
            "demo_count": persistence_manager.get_demo_count(),
            "is_autonomous_life": self.is_autonomous_life_active,
            "simulation_speed": self.simulation_speed,
            "policy_mode": self.policy_mode,
            "has_bc_model": self.bc_trainer.is_model_available(),
            # Phương tiện giao thông động đô thị
            "dynamic_vehicles": info.get("dynamic_vehicles", []),
            "traffic_collision1": info.get("traffic_collision1", False),
            "traffic_collision2": info.get("traffic_collision2", False),
            # Lộ trình đồ thị topo toàn cục A*
            "bo_topo_path": [
                [round(float(w[0]), 2), round(float(w[1]), 2)]
                for w in self.cognitive.current_waypoints
            ],
            "bi_topo_path": [
                [round(float(w[0]), 2), round(float(w[1]), 2)]
                for w in self.cognitive2.current_waypoints
            ],
            "topo_nodes": self.cognitive.topo_graph.to_dict()["nodes"],
        }

    def set_policy_mode(self, mode: str) -> str:
        if mode in ["online_rl", "heuristic", "bc", "ppo"]:
            self.policy_mode = mode
        return self.policy_mode

    def reset_brains_to_tabula_rasa(self) -> Dict[str, Any]:
        """Đặt lại toàn bộ não bộ, bản đồ khám phá và trọng số nơ-ron về con số 0 ban đầu."""
        self.cognitive.reset_to_tabula_rasa()
        self.cognitive2.reset_to_tabula_rasa()
        self.world_env.reset()
        self.interactive_step = 0
        return self.get_current_snapshot(mode="tabula_rasa")

    def autonomous_step(self) -> Dict[str, Any]:
        """
        Thực hiện chu kỳ nhận thức & vận động song hành:
        1. Đánh giá nhu cầu nội tại và vị trí của nhau -> chọn mục tiêu theo trí nhớ & niềm tin.
        2. Tính toán lực điều hướng kết hợp mạng nơ-ron tự học và né tránh lò lửa.
        3. Thực thi một bước học tăng cường trực tuyến (Online Continual RL Backprop).
        """
        info_before = self.world_env.get_info()
        pos1 = self.world_env.robot_pos
        pos2 = self.world_env.robot2_pos

        # Cập nhật nhận thức tài nguyên cho Bé Bo (tìm thấy mới hoặc phát hiện cạn kiệt)
        self.cognitive.memory.check_resource_status(
            "food", self.world_env.food_pos, pos1, self.world_env.food_capacity
        )
        self.cognitive.memory.check_resource_status(
            "water", self.world_env.water_pos, pos1, self.world_env.water_capacity
        )
        self.cognitive.memory.check_resource_status(
            "bed", self.world_env.bed_pos, pos1, 100.0
        )

        # Cập nhật nhận thức tài nguyên cho Bé Bi
        self.cognitive2.memory.check_resource_status(
            "food", self.world_env.food_pos, pos2, self.world_env.food_capacity
        )
        self.cognitive2.memory.check_resource_status(
            "water", self.world_env.water_pos, pos2, self.world_env.water_capacity
        )
        self.cognitive2.memory.check_resource_status(
            "bed", self.world_env.bed_pos, pos2, 100.0
        )

        # 1. Bé Bo (Agent 1) nhận thức & ra quyết định dựa trên niềm tin bản đồ
        goal_name1, goal_pos1 = self.cognitive.select_goal_and_thought(
            robot_pos=pos1,
            food_pos=self.world_env.food_pos,
            water_pos=self.world_env.water_pos,
            bed_pos=self.world_env.bed_pos,
            goal_pos=self.world_env.goal_pos,
            drives=info_before["drives_state"]["drives"],
            energy_ratio=info_before["energy_state"]["energy_ratio"],
            events=self.last_events1,
            dt=self.world_env.dt,
            peer_pos=pos2,
            peer_name="Bé Bi",
            peer_events=self.last_events2,
        )

        # 2. Bé Bi (Agent 2) nhận thức & ra quyết định dựa trên niềm tin bản đồ
        goal_name2, goal_pos2 = self.cognitive2.select_goal_and_thought(
            robot_pos=pos2,
            food_pos=self.world_env.food_pos,
            water_pos=self.world_env.water_pos,
            bed_pos=self.world_env.bed_pos,
            goal_pos=self.world_env.goal_pos,
            drives=info_before["drives_state2"]["drives"],
            energy_ratio=info_before["energy_state2"]["energy_ratio"],
            events=self.last_events2,
            dt=self.world_env.dt,
            peer_pos=pos1,
            peer_name="Bé Bo",
            peer_events=self.last_events1,
        )

        obs1_before = self.world_env._get_obs()

        # Lấy danh sách phương tiện giao thông động hiện tại
        dynamic_veh_list = self.world_env.get_dynamic_vehicles()

        # Tính lực vận động cho Bé Bo
        if self.policy_mode == "bc" and self.bc_trainer.model is not None:
            action1 = self.bc_trainer.predict(obs1_before)
        elif self.policy_mode == "ppo" and self.trainer.model is not None:
            pred_act, _ = self.trainer.model.predict(obs1_before, deterministic=True)
            action1 = pred_act
        else:
            action1 = self.cognitive.compute_autonomous_action(
                robot_pos=pos1,
                target_pos=goal_pos1,
                obstacles=self.world_env.city_obstacles,
                max_speed=self.world_env.max_speed,
                peer_pos=pos2,
                obs_vector=obs1_before,
                obstacle_radii=self.world_env.city_obstacle_radii,
                dynamic_vehicles=dynamic_veh_list,
            )

        # Bé Bi luôn tự hành khám phá, học hỏi và tương tác né va chạm
        action2 = self.cognitive2.compute_autonomous_action(
            robot_pos=pos2,
            target_pos=goal_pos2,
            obstacles=self.world_env.city_obstacles,
            max_speed=self.world_env.max_speed,
            peer_pos=pos1,
            obs_vector=obs1_before,
            obstacle_radii=self.world_env.city_obstacle_radii,
            dynamic_vehicles=dynamic_veh_list,
        )

        self.interactive_step += 1
        obs1_after, reward, terminated, _, info_after = self.world_env.step_dual(
            np.array(action1, dtype=np.float32),
            np.array(action2, dtype=np.float32),
        )

        # THỰC THI HỌC TĂNG CƯỜNG TRỰC TUYẾN THEO THỜI GIAN THỰC (Continual Online RL)
        total_reward1 = reward + self.cognitive.last_curiosity_bonus
        if self.cognitive.recent_feedback_score != 0.0:
            total_reward1 += self.cognitive.recent_feedback_score
            self.cognitive.recent_feedback_score = 0.0

        # Ghi nhận trải nghiệm và cập nhật gradient nơ-ron cho Bé Bo
        self.cognitive.online_learner.record_transition(
            obs=obs1_before,
            action=np.array(action1, dtype=np.float32),
            reward=total_reward1,
            next_obs=obs1_after,
            done=terminated,
        )
        self.cognitive.online_learner.learn_step(batch_size=20)

        # Ghi nhận trải nghiệm và cập nhật gradient nơ-ron cho Bé Bi
        total_reward2 = 0.0 + self.cognitive2.last_curiosity_bonus
        if info_after.get("collided2", False):
            total_reward2 -= 45.0
        if info_after.get("ate_food2", False):
            total_reward2 += 4.5
        if info_after.get("drank_water2", False):
            total_reward2 += 3.5
        if info_after.get("near_peer", False):
            total_reward2 += 0.5

        self.cognitive2.online_learner.record_transition(
            obs=obs1_before,
            action=np.array(action2, dtype=np.float32),
            reward=total_reward2,
            next_obs=obs1_after,
            done=terminated,
        )
        self.cognitive2.online_learner.learn_step(batch_size=20)

        # 2. HỌC QUAN SÁT XÃ HỘI ĐA TÁC TỬ (CROSS-AGENT SOCIAL OBSERVATIONAL RL)
        # Bé Bo quan sát và học gián tiếp từ thành công hay va chạm của Bé Bi
        if info_after.get("collided2", False):
            self.cognitive.online_learner.record_social_observation(
                peer_obs=obs1_before,
                peer_action=np.array(action2, dtype=np.float32),
                peer_reward=-40.0,
                peer_next_obs=obs1_after,
                peer_done=False,
                event_type="vicarious_collision",
            )
        elif info_after.get("ate_food2", False):
            self.cognitive.online_learner.record_social_observation(
                peer_obs=obs1_before,
                peer_action=np.array(action2, dtype=np.float32),
                peer_reward=5.0,
                peer_next_obs=obs1_after,
                peer_done=False,
                event_type="vicarious_food",
            )
        elif info_after.get("drank_water2", False):
            self.cognitive.online_learner.record_social_observation(
                peer_obs=obs1_before,
                peer_action=np.array(action2, dtype=np.float32),
                peer_reward=4.0,
                peer_next_obs=obs1_after,
                peer_done=False,
                event_type="vicarious_water",
            )

        # Bé Bi quan sát và học gián tiếp từ Bé Bo
        if info_after.get("collided", False):
            self.cognitive2.online_learner.record_social_observation(
                peer_obs=obs1_before,
                peer_action=np.array(action1, dtype=np.float32),
                peer_reward=-40.0,
                peer_next_obs=obs1_after,
                peer_done=False,
                event_type="vicarious_collision",
            )
        elif info_after.get("ate_food", False):
            self.cognitive2.online_learner.record_social_observation(
                peer_obs=obs1_before,
                peer_action=np.array(action1, dtype=np.float32),
                peer_reward=5.0,
                peer_next_obs=obs1_after,
                peer_done=False,
                event_type="vicarious_food",
            )
        elif info_after.get("drank_water", False):
            self.cognitive2.online_learner.record_social_observation(
                peer_obs=obs1_before,
                peer_action=np.array(action1, dtype=np.float32),
                peer_reward=4.0,
                peer_next_obs=obs1_after,
                peer_done=False,
                event_type="vicarious_water",
            )

        # 4. GIẤC MỘNG TÁI HIỆN BAN ĐÊM (HIPPOCAMPAL SLEEP DREAM REPLAY)
        # Kích hoạt tái hiện giấc mộng định kỳ trong chu kỳ đêm hoặc khi nghỉ ngơi
        is_night = info_after.get("is_night", False)
        is_resting1 = info_after.get("is_resting", False)
        is_resting2 = info_after.get("is_resting2", False)

        if (is_night or is_resting1 or is_resting2) and (self.interactive_step % 20 == 0):
            dream1 = self.cognitive.online_learner.dream_replay(num_cycles=4, batch_size=20)
            dream2 = self.cognitive2.online_learner.dream_replay(num_cycles=4, batch_size=20)
            if dream1.get("dream_replayed", False) and (is_night or is_resting1):
                self.cognitive.current_thought = f"[GIẤC MỘNG TÁI HIỆN] {dream1['topic']}"
            if dream2.get("dream_replayed", False) and (is_night or is_resting2):
                self.cognitive2.current_thought = f"[GIẤC MỘNG TÁI HIỆN] {dream2['topic']}"
        elif not is_night and not is_resting1 and self.cognitive.online_learner.dream_state["is_dreaming"]:
            self.cognitive.online_learner.dream_state["is_dreaming"] = False
        elif not is_night and not is_resting2 and self.cognitive2.online_learner.dream_state["is_dreaming"]:
            self.cognitive2.online_learner.dream_state["is_dreaming"] = False

        # Lưu lại sự kiện cho bước tiếp theo
        self.last_events1 = {
            "collided": info_after["collided"],
            "ate_food": info_after["ate_food"],
            "drank_water": info_after["drank_water"],
            "is_resting": info_after["is_resting"],
            "near_peer": info_after["near_peer"],
        }
        self.last_events2 = {
            "collided": info_after.get("collided2", False),
            "ate_food": info_after.get("ate_food2", False),
            "drank_water": info_after.get("drank_water2", False),
            "is_resting": info_after.get("is_resting2", False),
            "near_peer": info_after["near_peer"],
        }

        if terminated:
            self.world_env.reset()

        return self.get_current_snapshot(mode="autonomous", reward=reward)

    async def run_autonomous_life_loop(self):
        """Vòng lặp chạy nền mô phỏng cuộc sống tự hành của hai bé (22-25 Hz)."""
        self.is_autonomous_life_active = True
        consecutive_errors = 0
        while self.is_autonomous_life_active and not self.is_training and not self.is_playing:
            try:
                if self.simulation_speed > 0.0:
                    snapshot = self.autonomous_step()
                    await manager.broadcast(snapshot)
                    consecutive_errors = 0
                    sleep_time = max(0.015, 0.045 / self.simulation_speed)
                    await asyncio.sleep(sleep_time)
                else:
                    await asyncio.sleep(0.15)
            except Exception as e:
                consecutive_errors += 1
                import traceback
                print(f"[ERROR] Exception in autonomous step #{self.interactive_step}: {e}")
                traceback.print_exc()
                if consecutive_errors > 10:
                    print("[ERROR] Quá 10 lỗi liên tiếp trong vòng lặp tự hành, tạm dừng vòng lặp.")
                    self.is_autonomous_life_active = False
                    break
                await asyncio.sleep(0.2)

    def toggle_autonomous_life(self, active: Optional[bool] = None) -> bool:
        if active is None:
            self.is_autonomous_life_active = not self.is_autonomous_life_active
        else:
            self.is_autonomous_life_active = bool(active)
        return self.is_autonomous_life_active

    def set_simulation_speed(self, speed: float) -> float:
        self.simulation_speed = float(max(0.0, min(5.0, speed)))
        return self.simulation_speed

    def teacher_give_feedback(self, is_praise: bool, target: str = "both") -> str:
        msgs = []
        if target in ("both", "bo", "1"):
            msgs.append(self.cognitive.receive_feedback(is_praise))
        if target in ("both", "bi", "2"):
            msgs.append(self.cognitive2.receive_feedback(is_praise))
        return " | ".join(msgs)

    def teacher_set_target(
        self, x: float, z: float, label: str = "Chỉ định bởi Người Hướng Dẫn", target: str = "both"
    ) -> Dict[str, Any]:
        if target in ("both", "bo", "1"):
            self.cognitive.set_custom_target(x, z, label)
        if target in ("both", "bi", "2"):
            self.cognitive2.set_custom_target(x, z, label)
        return self.get_current_snapshot(mode="teacher_order")

    def teacher_step(self, action: List[float], record: bool = True) -> Dict[str, Any]:
        """Lái Bé Bo trực tiếp bằng phím WASD từ Teacher."""
        obs_before = self.world_env._get_obs().tolist()
        act_arr = np.array(action[:2], dtype=np.float32)

        self.interactive_step += 1
        _, reward, terminated, _, info = self.world_env.step(act_arr)

        demo_count = persistence_manager.get_demo_count()
        if record and float(np.linalg.norm(act_arr)) > 0.01:
            demo_count = persistence_manager.record_demonstration(
                obs=obs_before,
                action=act_arr.tolist(),
                drives=info["drives_state"]["drives"],
                energy=info["energy_state"]["energy"],
                reward=float(reward),
            )

        if terminated:
            self.world_env.reset()

        snap = self.get_current_snapshot(mode="teacher", reward=reward)
        snap["demo_count"] = demo_count
        snap["current_thought"] = "Người hướng dẫn đang trực tiếp dắt tay mình đi..."
        return snap

    def generate_expert_demonstrations(self, count: int = 150) -> int:
        return self.bc_trainer.auto_generate_expert_demos(
            count=count,
            env_cls=ChildWorldEnv,
            cognitive_cls=CognitiveController,
        )

    def train_behavioral_cloning(self, epochs: int = 35) -> Dict[str, Any]:
        res = self.bc_trainer.train(epochs=epochs)
        if res.get("status") == "completed":
            self.policy_mode = "bc"
        return res

    def load_bc_model(self) -> bool:
        ok = self.bc_trainer.load_model()
        if ok:
            self.policy_mode = "bc"
        return ok

    def feed_agent(self, kcal: float = 250.0, target: str = "both") -> Dict[str, Any]:
        if target in ("both", "bo", "1"):
            self.world_env.energy_sys.eat(kcal=kcal)
            self.world_env.drive_sys.drives["hunger"] = float(
                max(0.0, self.world_env.drive_sys.drives["hunger"] - 0.35)
            )
            self.cognitive.current_thought = "Được người hướng dẫn cho ăn bánh, Bo no bụng rồi!"
        if target in ("both", "bi", "2"):
            self.world_env.energy_sys2.eat(kcal=kcal)
            self.world_env.drive_sys2.drives["hunger"] = float(
                max(0.0, self.world_env.drive_sys2.drives["hunger"] - 0.35)
            )
            self.cognitive2.current_thought = "Cảm ơn người hướng dẫn, Bi cũng được ăn no rồi!"
        return self.get_current_snapshot(mode="idle")

    def rest_agent(self, target: str = "both") -> Dict[str, Any]:
        if target in ("both", "bo", "1"):
            self.world_env.energy_sys.rest(duration_sec=3.0)
            self.world_env.drive_sys.drives["fatigue"] = self.world_env.energy_sys.fatigue
            self.cognitive.current_thought = "Người hướng dẫn vỗ về cho Bo nghỉ ngơi, mình thấy dễ chịu lắm."
        if target in ("both", "bi", "2"):
            self.world_env.energy_sys2.rest(duration_sec=3.0)
            self.world_env.drive_sys2.drives["fatigue"] = self.world_env.energy_sys2.fatigue
            self.cognitive2.current_thought = "Bi cũng được nghỉ ngơi hồi phục năng lượng rồi!"
        return self.get_current_snapshot(mode="idle")

    def save_state(self) -> Dict[str, Any]:
        state = self.world_env.export_state()
        state["step"] = self.interactive_step
        ok = persistence_manager.save_agent_state(state)
        return {
            "status": "saved" if ok else "error",
            "demo_count": persistence_manager.get_demo_count(),
            "state": self.get_current_snapshot(),
        }

    def load_state(self) -> Dict[str, Any]:
        saved = persistence_manager.load_agent_state()
        if not saved:
            return {"status": "not_found", "state": self.get_current_snapshot()}
        self.world_env.import_state(saved)
        self.interactive_step = int(saved.get("step", self.interactive_step))
        return {
            "status": "loaded",
            "demo_count": persistence_manager.get_demo_count(),
            "state": self.get_current_snapshot(),
        }

    def reset_world(self, full_reset: bool = True) -> Dict[str, Any]:
        if full_reset:
            self.world_env.persist_internal = False
            self.world_env.reset()
            self.world_env.persist_internal = True
            self.interactive_step = 0
            self.cognitive.clear_custom_target()
            self.cognitive2.clear_custom_target()
        else:
            self.world_env.reset()
        return self.get_current_snapshot(mode="idle")

    def clear_demos(self) -> int:
        return persistence_manager.clear_demonstrations()

    def start_training(self, timesteps: int = 10000, n_envs: int = 1):
        if self.is_training:
            return False
        self.is_autonomous_life_active = False
        self.trainer.train(total_timesteps=timesteps, n_envs=n_envs)
        return True

    def load_model(self, model_name: str = "obstacle_ppo_latest") -> bool:
        ok = self.trainer.load_model(model_name)
        if ok:
            self.policy_mode = "ppo"
        return ok

    def start_play(self, episodes: int = 3):
        if self.trainer.model is None:
            raise ValueError("No model loaded")
        self.is_autonomous_life_active = False
        self.trainer.play(episodes=episodes)
        return True

    def trigger_dream_replay(self, target: str = "both") -> Dict[str, Any]:
        """Kích hoạt cưỡng bức một chu kỳ Giấc Mộng Tái Hiện Ban Đêm (Hippocampal Sleep Dream Replay)."""
        res1 = {}
        res2 = {}
        if target in ("both", "bo", "1"):
            res1 = self.cognitive.online_learner.dream_replay(num_cycles=6, batch_size=24)
            if res1.get("dream_replayed", False):
                self.cognitive.current_thought = f"[GIẤC MỘNG CƯỠNG BỨC] {res1['topic']}"
        if target in ("both", "bi", "2"):
            res2 = self.cognitive2.online_learner.dream_replay(num_cycles=6, batch_size=24)
            if res2.get("dream_replayed", False):
                self.cognitive2.current_thought = f"[GIẤC MỘNG CƯỠNG BỨC] {res2['topic']}"
        return {
            "status": "success",
            "bo_dream": res1,
            "bi_dream": res2,
            "snapshot": self.get_current_snapshot(),
        }

    def stop_play(self):
        self.trainer.is_playing = False


training_service = TrainingService()
