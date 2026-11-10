import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from .memory_map import SpatialMemoryMap
from .online_learner import OnlineLearner
from .topological_map import TopologicalGraph


class CognitiveController:
    """
    Tang Tu Duy Nhan Thuc & Tu Hoc Truc Tuyen Doc Lap (Autonomous Cognitive Brain).
    Dong vai tro la 'Bo nao trung uong' cua tung Agent (Be Bo & Be Bi):
    1. Triet ly Khoi dau Tabula Rasa:
       - Bat dau tu con so 0, khong biet truoc ban do, bep hay lo lua.
    2. Ban do Nhan thuc Khong gian (SpatialMemoryMap):
       - Mo suong mu khi kham pha, nho vet seo tam ly khi gap lo lua / va cham xe.
    3. Mang No-ron Hoc Tang Cuong Lien Tuc (OnlineLearner):
       - Cap nhat gradient truc tiep theo thoi gian thuc tu moi buoc di chuyen va hoc xa hoi.
    4. Ra quyet dinh dua tren Niem tin (Belief-driven Decision Making):
       - Da biet vi tri -> Tim den de giai toa nhu cau (doi, khat, ngu).
       - Chua biet vi tri -> Kich hoat che do thám hiem tim kiem theo huong to mo.
    5. Tien trinh Phat trien Nhan thuc theo 3 Giai doan (Piagetian Stages):
       - Giai doan 1 (0 - 350 buoc): Chap chung & To mo.
       - Giai doan 2 (350 - 1200 buoc): Kham pha & Dinh hinh phan xa.
       - Giai doan 3 (> 1200 buoc): Tu lap & Hop tac dong hanh.
    6. Dieu huong Da tang (Multi-layer Navigation):
       - Do thi Topo A* lap ke hoach dai lo toan cuc.
       - Luc the nang tiep tuyen (Tangential Swerve) be lai tranh dam va vat can.
       - Tranh va cham xe co dong theo thuat toan ORCA / Velocity Obstacle.
       - Residual RL hoa tron hanh dong tu mang no-ron.
    """

    def __init__(self, name: str = "Bé Bo", personality: str = "energetic"):
        """
        Khoi tao bo nao nhan thuc cho Agent.

        Args:
            name (str): Ten cua be ('Bé Bo' hoac 'Bé Bi').
            personality (str): Tinh cach ('energetic' - nang dong to mo, 'cautious_empathic' - than trong thau cam).
        """
        self.name: str = name
        self.personality: str = personality
        self.is_autonomous: bool = True
        self.custom_target: Optional[np.ndarray] = None
        self.custom_target_label: str = ""
        self.current_goal_name: str = "Khám phá thế giới mới"
        self.current_goal_pos: np.ndarray = np.array([10.0, 10.0], dtype=np.float32)

        # Ban do nhan thuc & Ky uc su kien dai han (luoi 100x100 cho dai do thi)
        self.memory = SpatialMemoryMap(grid_size=100)
        # Bo nao hoc tang cuong truc tuyen
        self.online_learner = OnlineLearner(obs_dim=28, act_dim=2)

        self.current_thought: str = (
            "Chào ngày mới! Mình chưa biết gì về thế giới này, cùng đi khám phá nào..."
            if personality == "energetic"
            else "Chào bạn! Mình bắt đầu quan sát và học hỏi từng góc nhỏ..."
        )
        self.thought_timer: float = 0.0
        self.dialogue_cooldown: float = 0.0
        self.avoidance_timer: float = 0.0
        self.avoidance_target: Optional[np.ndarray] = None
        self.exploration_timer: float = 0.0

        # Luu lai transition gan nhat de phuc vu Micro-RLHF tuc thoi
        self.last_obs: Optional[np.ndarray] = None
        self.last_action: Optional[np.ndarray] = None
        self.last_curiosity_bonus: float = 0.0

        # Thong ke hanh trinh sinh hoat
        self.stats: Dict[str, int] = {
            "meals_eaten": 0,
            "water_drank": 0,
            "naps_taken": 0,
            "praises": 0,
            "scoldings": 0,
            "collisions": 0,
            "social_chats": 0,
            "resources_found": 0,
        }

        self.recent_feedback_score: float = 0.0
        self.is_sprinting: bool = False

        # He thong 3 Giai Doan Truong Thanh Nhan Thuc (Piagetian Developmental Stages)
        self.development_step: int = 0
        self.recent_reflections: List[str] = []
        self.last_consolidation_step: int = 0
        self.last_neural_action: Optional[np.ndarray] = None
        self.last_base_action: Optional[np.ndarray] = None
        self.has_reflected_this_sleep: bool = False

        # Ban do Do thi Topo Ngu nghia & Ke hoach Lo trinh Toan cuc A* (Do thi 100x100)
        self.topo_graph = TopologicalGraph(world_size=100.0)
        self.current_waypoints: List[np.ndarray] = []
        self.topo_plan_timer: float = 0.0
        self.is_traffic_avoiding: bool = False

    def get_stage_info(self) -> Dict[str, Any]:
        """
        Xac dinh giai doan truong thanh nhan thuc hien tai va ty le trao quyen cho mang no-ron:
        - Giai doan 1 (0 - 350 buoc): Chap Chung & To Mo (competence: 0.20 - 0.35).
        - Giai doan 2 (350 - 1200 buoc): Kham Pha & Dinh Hinh Phan Xa (competence: 0.35 - 0.70).
        - Giai doan 3 (> 1200 buoc): Tu Lap & Hop Tac Gan Ket (competence: 0.70 - 0.88).

        Returns:
            Dict[str, Any]: Thong tin giai doan, huy hieu, competence va mo ta.
        """
        s = self.development_step
        if s < 350:
            stage_id = 1
            stage_key = "toddler"
            stage_name = "Chập Chững & Tò Mò"
            stage_badge = "[GIAI ĐOẠN 1: CHẬP CHỮNG]"
            competence = 0.20 + (s / 350.0) * 0.15
            desc = "Khám phá sơ khai, bước đi vụng về, nơ-ron học hỏi từ các va chạm đầu tiên."
        elif s < 1200:
            stage_id = 2
            stage_key = "explorer"
            stage_name = "Khám Phá & Định Hình Phản Xạ"
            stage_badge = "[GIAI ĐOẠN 2: KHÁM PHÁ]"
            competence = 0.35 + ((s - 350) / 850.0) * 0.35
            desc = "Thuộc bản đồ đô thị 100x100, ghi nhớ vật cản, phản xạ né tránh tự nhiên mượt mà."
        else:
            stage_id = 3
            stage_key = "autonomous_partner"
            stage_name = "Tự Lập & Hợp Tác Gắn Kết"
            stage_badge = "[GIAI ĐOẠN 3: TỰ LẬP & HỢP TÁC]"
            competence = 0.70 + min(0.18, ((s - 1200) / 2000.0) * 0.18)
            desc = "Tự chủ hoàn toàn, tự đúc kết bài học cuộc sống, sẻ chia và gắn kết đồng hành."

        return {
            "stage_id": stage_id,
            "stage_key": stage_key,
            "stage_name": stage_name,
            "stage_badge": stage_badge,
            "competence": round(float(competence), 3),
            "step": s,
            "desc": desc,
        }

    def reflect_and_consolidate(self, is_night_sleep: bool = False) -> str:
        """
        Co Che Tu Duc Ket Kinh Nghiem & Cung Co Bo Nho (Periodic Experience Synthesis):
        - Kich hoat dinh ky sau moi 120 buoc hoac khi ve Villa ngu ban dem.
        - Goi consolidate_memories() trong OnlineLearner de toi luyen trong so no-ron offline.
        - Sinh cau suy ngam tri thuc chieu sau the hien su phat trien nhan cach.

        Args:
            is_night_sleep (bool): True neu dang trong giac ngu dem tai Villa.

        Returns:
            str: Cau suy ngam tri thuc da sinh ra.
        """
        self.last_consolidation_step = self.development_step
        stage = self.get_stage_info()

        # 1. Kich hoat cung co no-ron offline qua mang no-ron
        c_stats = self.online_learner.consolidate_memories(num_batches=6, batch_size=28)

        # 2. Sinh cau duc ket tri thuc tu nhien dua tren giai doan va trai nghiem
        if is_night_sleep:
            reflection = (
                f"[ĐÚC KẾT BÀI HỌC] Đêm đã về trên thành phố, giấc ngủ sâu tại Villa giúp não bộ củng cố "
                f"{c_stats['consolidated_batches']} đợt ký ức. Tinh thần và cơ thể đã hồi phục tràn đầy!"
            )
        elif stage["stage_id"] == 1:
            reflection = (
                f"[ĐÚC KẾT BÀI HỌC] Sau những bước đi chập chững đầu đời, {self.name} nhận ra khi va đụng thì nên lùi lại "
                f"và quan sát kỹ hơn. Cảm nhận không gian đô thị đã bắt đầu hình thành!"
            )
        elif stage["stage_id"] == 2:
            reflection = (
                f"[ĐÚC KẾT BÀI HỌC] Qua {self.development_step} bước thám hiểm, mình đã quen thuộc các con đường chính "
                f"và các khúc cua quanh xe cộ. Mạng nơ-ron vận động đã thuần thục hơn rất nhiều!"
            )
        else:
            reflection = (
                f"[ĐÚC KẾT BÀI HỌC] Mục tiêu lớn nhất là cùng bạn phát triển và tự lập! "
                f"Biết chia sẻ bữa ăn và cùng nhau dạo bước giúp cuộc sống đô thị luôn ngập tràn niềm vui."
            )

        self.recent_reflections.append(reflection)
        if len(self.recent_reflections) > 8:
            self.recent_reflections.pop(0)

        self.current_thought = reflection
        self.thought_timer = -5.0  # Giu cau suy ngam hien thi uu tien trong 5 giay
        return reflection

    def reset_to_tabula_rasa(self) -> None:
        """Dat lai toan bo tri nho, ban do kham pha va trong so no-ron ve con so 0 ban dau."""
        self.memory.reset()
        self.online_learner.reset_weights()
        self.current_waypoints.clear()
        self.topo_plan_timer = 0.0
        self.custom_target = None
        self.avoidance_timer = 0.0
        self.avoidance_target = None
        self.exploration_timer = 0.0
        self.development_step = 0
        self.current_goal_name = "Bắt đầu khám phá từ con số 0"
        self.current_goal_pos = np.array([10.0, 10.0], dtype=np.float32)
        self.current_thought = f"{self.name} vừa được sinh ra, chưa biết gì về thế giới xung quanh!"

    def set_custom_target(self, x: float, z: float, label: str = "Chỉ định bởi Người Hướng Dẫn") -> None:
        """
        Nhan chi dinh diem dich tuyet doi tu Teacher (qua click chuot tren san 3D).

        Args:
            x (float): Toa do x [0.5 - 99.5].
            z (float): Toa do z [0.5 - 99.5].
            label (str): Nhan mo ta diem chi dinh.
        """
        self.custom_target = np.array([x, z], dtype=np.float32)
        self.custom_target_label = label
        self.current_thought = f"Người hướng dẫn chỉ mình đến vị trí [{x:.1f}, {z:.1f}], mình đang đi tới đó..."

    def clear_custom_target(self) -> None:
        """Huy bo diem chi dinh cua Teacher, tra lai quyen tu chu cho be."""
        self.custom_target = None
        self.custom_target_label = ""

    def receive_feedback(self, is_praise: bool) -> str:
        """
        Xu ly Khen / Phat tu Teacher (Micro-RLHF):
        Thuc hien ngay 2 buoc gradient update truc tiep vao hanh vi vua xay ra.

        Args:
            is_praise (bool): True neu la Khen (+5 diem), False neu la Phat (-8 diem).

        Returns:
            str: Thong diep phan hoi he thong.
        """
        if is_praise:
            self.stats["praises"] += 1
            self.recent_feedback_score += 5.0
            self.memory.add_memory("praise", "Được Teacher khen ngợi! Củng cố hành động vừa làm (+5 điểm).", 0.9)
            if self.last_obs is not None and self.last_action is not None:
                self.online_learner.apply_immediate_feedback(True, self.last_obs, self.last_action)
            self.current_thought = f"Được Teacher khen ngợi, {self.name} vui quá! Mạng nơ-ron đã ghi nhớ hành vi này."
            return f"[KHEN THƯỞNG] {self.name} cảm thấy được yêu thương và nơ-ron được củng cố (+5)"
        else:
            self.stats["scoldings"] += 1
            self.recent_feedback_score -= 8.0
            self.memory.add_memory("scold", "Bị Teacher nhắc nhở! Điều chỉnh giảm xác suất hành vi vừa làm (-8 điểm).", 0.95)
            if self.last_obs is not None and self.last_action is not None:
                self.online_learner.apply_immediate_feedback(False, self.last_obs, self.last_action)
            self.current_thought = f"Teacher nhắc nhở rồi! {self.name} đã cập nhật trọng số thần kinh để tránh lỗi này."
            return f"[NHẮC NHỞ] {self.name} nhận biết hành vi bị phạt và đảo chiều phản xạ (-8)"

    def select_goal_and_thought(
        self,
        robot_pos: np.ndarray,
        food_pos: np.ndarray,
        water_pos: np.ndarray,
        bed_pos: np.ndarray,
        goal_pos: np.ndarray,
        drives: Dict[str, float],
        energy_ratio: float,
        events: Dict[str, Any],
        dt: float,
        peer_pos: Optional[np.ndarray] = None,
        peer_name: str = "Bé Bi",
        peer_events: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, np.ndarray]:
        """
        Danh gia trang thai noi tai, dong luc sinh ton va ban do niem tin de lua chon muc tieu di chuyen:
        - Neu co lenh chi dinh Teacher -> Uu tien tuyet doi di toi do.
        - Neu va cham dau -> Lui lai ra hanh lang an toan.
        - Neu kiet suc hoac dem xuong -> Ve giuong Villa (neu nho) hoac tim kiem giuong.
        - Neu doi/khat -> Tim thuc an/nuoc uong (co hanh vi nhuong nhin neu o Giai doan 3).
        - Neu no am, khoe manh -> Thuc day dong luc to mo (Curiosity Exploration).

        Args:
            robot_pos (np.ndarray): Toa do be hien tai [x, z].
            food_pos (np.ndarray): Toa do bep an thuc te.
            water_pos (np.ndarray): Toa do voi nuoc thuc te.
            bed_pos (np.ndarray): Toa do giuong Villa thuc te.
            goal_pos (np.ndarray): Toa do cot sang xanh trung tam.
            drives (Dict[str, float]): Cac chi so dong luc noi tai.
            energy_ratio (float): Ty le nang luong sinh hoc [0.0 - 1.0].
            events (Dict[str, Any]): Su kien ban than (collided, ate_food,...).
            dt (float): Buoc thoi gian.
            peer_pos (Optional[np.ndarray]): Toa do cua ban be neu co.
            peer_name (str): Ten ban be.
            peer_events (Optional[Dict[str, Any]]): Su kien cua ban be.

        Returns:
            Tuple[str, np.ndarray]: (ten_muc_tieu, toa_do_muc_tieu_2d).
        """
        self.thought_timer += dt
        self.dialogue_cooldown = max(0.0, self.dialogue_cooldown - dt)
        peer_events = peer_events or {}

        # 1. Cap nhat suong mu nhan thuc quanh vi tri be va nhan diem thuong to mo
        self.last_curiosity_bonus = self.memory.update_exploration(robot_pos)

        # 2. Kiem tra phat hien tai nguyen moi neu be vo tinh tim thay
        if self.memory.check_and_discover_resource("food", food_pos, robot_pos):
            self.stats["resources_found"] += 1
            self.current_thought = f"Aha! {self.name} vừa tự mình phát hiện ra Bếp ăn ở đây rồi!"
        if self.memory.check_and_discover_resource("water", water_pos, robot_pos):
            self.stats["resources_found"] += 1
            self.current_thought = "Tìm thấy Vòi nước mát lành rồi! Đã lưu vị trí vào trí nhớ dài hạn."
        if self.memory.check_and_discover_resource("bed", bed_pos, robot_pos):
            self.stats["resources_found"] += 1
            self.current_thought = "Tìm thấy Giường ngủ êm ái rồi, khi nào mệt mình sẽ về đây."

        # 3. Ghi nho vet seo tam ly neu va cham nguy hiem
        if events.get("collided", False):
            self.stats["collisions"] += 1
            self.memory.record_hazard_collision(robot_pos, "Lò lửa nóng")

        # Cap nhat so lieu sinh hoat
        if events.get("ate_food", False):
            self.stats["meals_eaten"] += 1
        if events.get("drank_water", False):
            self.stats["water_drank"] += 1
        if events.get("is_resting", False):
            self.stats["naps_taken"] += 1

        # 0. Lenh chi dinh tuyet doi tu Teacher
        if self.custom_target is not None:
            dist_to_custom = float(np.linalg.norm(robot_pos - self.custom_target))
            if dist_to_custom < 0.65:
                self.current_thought = f"Đã tới điểm chỉ định [{self.custom_target_label}] rồi!"
                self.clear_custom_target()
            else:
                self.current_goal_name = f"Theo lệnh: {self.custom_target_label}"
                self.current_goal_pos = self.custom_target
                return self.current_goal_name, self.current_goal_pos

        peer_dist = float(np.linalg.norm(robot_pos - peer_pos)) if peer_pos is not None else 99.0

        # Hoi thoai & Giao tiep xa hoi khi o gan ban be
        if peer_dist < 2.5 and self.dialogue_cooldown <= 0.0:
            self.dialogue_cooldown = 4.5
            self.stats["social_chats"] += 1

            if peer_events.get("collided", False):
                self.current_thought = f"{peer_name} ơi có sao không? Lò lửa ở đó nóng lắm, tớ cũng từng bị bỏng!"
                return self.current_goal_name, self.current_goal_pos

            # Chia se tai nguyen da kham pha
            if self.memory.discovered_resources["food"]["discovered"]:
                f_pos = self.memory.discovered_resources["food"]["pos"]
                if np.random.rand() < 0.4:
                    self.current_thought = f"{peer_name} ơi, tớ nhớ Bếp ăn ở góc [{f_pos[0]:.1f}, {f_pos[1]:.1f}], qua đó ăn nhé!"
                    return self.current_goal_name, self.current_goal_pos

            greetings = [
                f"Chào {peer_name}! Cùng nhau khám phá xem góc phố kia có gì nhé!",
                f"Đi cùng {peer_name} thấy vui ghê, bớt sợ những chỗ tối hẳn!",
                f"{peer_name} thấy đài phun nước ở quảng trường chưa, đẹp lắm!",
            ]
            self.current_thought = greetings[int(np.random.randint(0, len(greetings)))]

        is_night = bool(events.get("is_night", False))

        # 1. Thoat khoi vung dau / va cham nguy hiem (Tranh ket vinh vien)
        if events.get("collided", False):
            self.stats["collisions"] += 1
            self.avoidance_timer = 1.8
            center_city = np.array([50.0, 50.0], dtype=np.float32)
            towards_center = center_city - robot_pos
            norm = max(float(np.linalg.norm(towards_center)), 0.1)
            self.avoidance_target = np.clip(robot_pos + (towards_center / norm) * 7.0, 10.0, 90.0)

        if self.avoidance_timer > 0.0:
            self.avoidance_timer = max(0.0, self.avoidance_timer - dt)
            dist_to_escape = float(np.linalg.norm(robot_pos - self.avoidance_target)) if self.avoidance_target is not None else 0.0
            if dist_to_escape > 1.2:
                self.current_goal_name = "Lùi lại ra đường thoáng (Tránh kẹt)"
                self.current_goal_pos = self.avoidance_target
                self.current_thought = f"Ai da! Va phải vật cản rồi, {self.name} lùi lại ra làn đường thoáng an toàn!"
                self.is_sprinting = False
                return self.current_goal_name, self.current_goal_pos
            else:
                self.avoidance_timer = 0.0
                self.avoidance_target = None

        # 2. Can Kcal, qua met HOAC DEM XUONG (Chu ky sinh hoc Circadian)
        night_sleep_trigger = is_night and (drives.get("fatigue", 0.0) > 0.32 or energy_ratio < 0.35)
        if energy_ratio < 0.22 or drives.get("fatigue", 0.0) > 0.65 or night_sleep_trigger:
            bed_info = self.memory.discovered_resources["bed"]
            if bed_info["discovered"] and bed_info["pos"] is not None:
                self.current_goal_name = "Về Giường ngủ Villa (Đêm & Nghỉ ngơi)" if is_night else "Về Giường ngủ (Đã nhớ vị trí)"
                self.current_goal_pos = np.array(bed_info["pos"], dtype=np.float32)
                if self.thought_timer > 3.0:
                    if is_night:
                        self.current_thought = f"Trời đã tối mịt rồi, đèn đường đã sáng rực rỡ! {self.name} buồn ngủ quá, về phòng ngủ trong Villa thôi."
                    else:
                        self.current_thought = "Mệt rã rời rồi! May mà nhớ giường ngủ ở góc này, về ngủ một giấc thôi."
                    self.thought_timer = 0.0
            else:
                self.current_goal_name = "Đêm tối: Tìm kiếm giường ngủ trong Villa" if is_night else "Mệt mỏi: Tìm kiếm chỗ ngủ"
                unexplored = self.memory.find_unexplored_direction(robot_pos)
                if unexplored is not None:
                    self.current_goal_pos = np.clip(robot_pos + unexplored * 6.0, 5.0, 95.0)
                if self.thought_timer > 3.0:
                    if is_night:
                        self.current_thought = f"Đêm đã buông xuống khắp các con phố, {self.name} phải đi tìm Villa để ngủ thôi..."
                    else:
                        self.current_thought = "Buồn ngủ quá mà chưa biết giường ở đâu, phải đi tìm một góc êm để nằm."
                    self.thought_timer = 0.0
            self.is_sprinting = False
            return self.current_goal_name, self.current_goal_pos

        # Duc ket kinh nghiem trong giac ngu ban dem tai Villa
        if events.get("is_resting", False):
            if is_night and not self.has_reflected_this_sleep:
                self.reflect_and_consolidate(is_night_sleep=True)
                self.has_reflected_this_sleep = True
        else:
            self.has_reflected_this_sleep = False

        stage_info = self.get_stage_info()
        is_stage3 = stage_info["stage_id"] == 3

        # 3. Doi bung - Tim thuc an (Uu tien nhuong nhin o Giai doan 3)
        if drives.get("hunger", 0.0) > 0.40:
            food_info = self.memory.discovered_resources["food"]
            if food_info["discovered"] and food_info["pos"] is not None:
                target_food = np.array(food_info["pos"], dtype=np.float32)
                self.current_goal_pos = target_food

                if peer_pos is not None:
                    dist_peer = float(np.linalg.norm(peer_pos - target_food))
                    my_dist = float(np.linalg.norm(robot_pos - target_food))

                    # Trong Giai doan 3: Neu ban be dang rat gan Bep, be nhuong ban an truoc
                    if is_stage3 and dist_peer < 3.0 and my_dist > 5.0 and drives.get("hunger", 0.0) < 0.65:
                        self.is_sprinting = False
                        self.current_goal_name = f"Nhường bạn {peer_name} dùng bữa"
                        if self.thought_timer > 3.0:
                            self.current_thought = f"{peer_name} cứ tự nhiên ăn no nhé! {self.name} qua Vòi nước mát giải khát rồi quay lại sau!"
                            self.thought_timer = 0.0
                        return self.current_goal_name, water_pos

                    if dist_peer < 10.0 and my_dist < 10.0:
                        self.is_sprinting = False
                        self.current_goal_name = f"Cùng {peer_name} dùng bữa tại Bếp ăn"
                        if self.thought_timer > 3.0:
                            self.current_thought = f"Tuyệt quá! {self.name} và {peer_name} cùng đến Bếp ăn nạp năng lượng để tiếp tục phát triển!"
                            self.thought_timer = 0.0
                        return self.current_goal_name, self.current_goal_pos

                self.is_sprinting = False
                self.current_goal_name = "Bếp ăn dinh dưỡng (Đã ghi nhớ)"
                if self.thought_timer > 3.0:
                    self.current_thought = "Bụng reo ùng ục! Nhớ vị trí Bếp ăn rồi, tới ăn bánh nạp Kcal!"
                    self.thought_timer = 0.0
            else:
                self.is_sprinting = False
                self.current_goal_name = "Đói bụng: Thám hiểm tìm kiếm thức ăn"
                unexplored = self.memory.find_unexplored_direction(robot_pos)
                if unexplored is not None:
                    self.current_goal_pos = np.clip(robot_pos + unexplored * 6.0, 5.0, 95.0)
                if self.thought_timer > 3.0:
                    self.current_thought = "Bụng đói cồn cào mà chưa biết Bếp ở đâu, phải lùng sục các góc phố tìm thức ăn!"
                    self.thought_timer = 0.0
            return self.current_goal_name, self.current_goal_pos

        # 4. Khat nuoc - Tim nguon nuoc mat lanh
        if drives.get("thirst", 0.0) > 0.40:
            water_info = self.memory.discovered_resources["water"]
            if water_info["discovered"] and water_info["pos"] is not None:
                target_water = np.array(water_info["pos"], dtype=np.float32)
                self.current_goal_pos = target_water

                if peer_pos is not None:
                    dist_peer = float(np.linalg.norm(peer_pos - target_water))
                    my_dist = float(np.linalg.norm(robot_pos - target_water))
                    if dist_peer < 10.0 and my_dist < 10.0:
                        self.is_sprinting = False
                        self.current_goal_name = f"Cùng {peer_name} uống nước mát"
                        if self.thought_timer > 3.0:
                            self.current_thought = f"Tìm thấy nguồn nước mát rồi, cả hai chúng mình cùng uống cho khỏe khoắn nhé {peer_name}!"
                            self.thought_timer = 0.0
                        return self.current_goal_name, self.current_goal_pos

                self.is_sprinting = False
                self.current_goal_name = "Vòi nước mát (Đã ghi nhớ)"
                if self.thought_timer > 3.0:
                    self.current_thought = "Khát khô họng! Nhớ vòi nước mát ở góc này, lại uống cho đã khát."
                    self.thought_timer = 0.0
            else:
                self.is_sprinting = False
                self.current_goal_name = "Khát nước: Tìm kiếm nguồn nước"
                unexplored = self.memory.find_unexplored_direction(robot_pos)
                if unexplored is not None:
                    self.current_goal_pos = np.clip(robot_pos + unexplored * 6.0, 5.0, 95.0)
                if self.thought_timer > 3.0:
                    self.current_thought = "Cổ họng khô quá, phải đi tìm xem có vòi nước nào quanh đây không."
                    self.thought_timer = 0.0
            return self.current_goal_name, self.current_goal_pos

        # 5. Co don (Social Drive)
        if drives.get("social", 0.0) > 0.45 and peer_pos is not None:
            self.current_goal_name = f"Đến tìm bạn {peer_name}"
            self.current_goal_pos = peer_pos
            if self.thought_timer > 3.5:
                self.current_thought = f"Đi một mình thấy buồn quá, lại gần rủ {peer_name} cùng đi thám hiểm thôi!"
                self.thought_timer = 0.0
            return self.current_goal_name, self.current_goal_pos

        # 6. Khi no am & khoe manh -> Dong luc to mo (Intrinsic Curiosity Exploration)
        pct = self.memory.get_exploration_percentage()
        if self.exploration_timer > 0.0 and self.current_goal_pos is not None:
            dist_to_exp = float(np.linalg.norm(robot_pos - self.current_goal_pos))
            if dist_to_exp > 1.2:
                self.exploration_timer = max(0.0, self.exploration_timer - dt)
                return self.current_goal_name, self.current_goal_pos

        unexplored_dir = self.memory.find_unexplored_direction(robot_pos)

        if unexplored_dir is not None and pct < 92.0:
            self.exploration_timer = 7.5  # Giu dich den on dinh trong 7.5 giay
            self.current_goal_name = f"Khám phá góc thành phố ({pct}% bản đồ)"
            self.current_goal_pos = np.clip(robot_pos + unexplored_dir * 8.0, 8.0, 92.0)
            if self.thought_timer > 3.5:
                self.current_thought = (
                    f"Người khỏe khoắn, tràn đầy Kcal! Đi khám phá góc phố chưa biết nào (Đã mở {pct}% thế giới)."
                    if self.personality == "energetic"
                    else f"Mình đi khám phá thêm các góc mới (Đã quan sát {pct}% bản đồ)."
                )
                self.thought_timer = 0.0
        else:
            self.current_goal_name = "Đài phun nước trung tâm"
            self.current_goal_pos = goal_pos
            if self.thought_timer > 3.5:
                self.current_thought = "Bản đồ đã khám phá gần hết! Tiến về đài phun nước ngắm cảnh."
                self.thought_timer = 0.0

        return self.current_goal_name, self.current_goal_pos

    def compute_autonomous_action(
        self,
        robot_pos: np.ndarray,
        target_pos: np.ndarray,
        obstacles: np.ndarray,
        max_speed: float = 1.4,
        peer_pos: Optional[np.ndarray] = None,
        obs_vector: Optional[np.ndarray] = None,
        obstacle_radii: Optional[np.ndarray] = None,
        dynamic_vehicles: Optional[List[Dict[str, Any]]] = None,
    ) -> List[float]:
        """
        Tinh toan vector hanh dong van toc [vx, vz] phoi hop giua nhieu tang dieu khien:
        1. Topo Graph A*: Dinh tuyen Waypoints toan cuc doc theo cac dai lo an toan.
        2. Luc the nang tiep tuyen (Tangential Swerve): Be lai luon qua vat can, khong dam truc dien.
        3. Ne tranh xe co dong (ORCA / Velocity Obstacle): Tinh toan thoi gian va cham de dung nhuong duong hoac luon sang ben.
        4. Luc day bien tuong mem & Kinematic Wall Clamp: Khong bao gio dam xuyen tuong bien 100x100.
        5. Residual RL: Mang no-ron Actor-Critic hoc them phan du de toi uu hanh dong.

        Args:
            robot_pos (np.ndarray): Toa do robot [x, z].
            target_pos (np.ndarray): Toa do dich den.
            obstacles (np.ndarray): Danh sach toa do cac toa nha / vat can.
            max_speed (float): Toc do toi da.
            peer_pos (Optional[np.ndarray]): Toa do cua ban be.
            obs_vector (Optional[np.ndarray]): Vector quan sat 28 chieu dua vao mang no-ron.
            obstacle_radii (Optional[np.ndarray]): Ban kinh vat ly tung vat can.
            dynamic_vehicles (Optional[List[Dict[str, Any]]]): Danh sach xe buyt, taxi dang chay tren pho.

        Returns:
            List[float]: Vector van toc [vx, vz].
        """
        self.development_step += 1
        stage_info = self.get_stage_info()
        competence = stage_info["competence"]

        # Dinh ky tu duc ket bai hoc sau moi 120 buoc di chuyen
        if (self.development_step - self.last_consolidation_step) >= 120:
            self.reflect_and_consolidate()

        n_obs = len(obstacles)
        if obstacle_radii is None or len(obstacle_radii) != n_obs:
            effective_radii = np.full(n_obs, 2.2, dtype=np.float32)
        else:
            effective_radii = obstacle_radii

        # CAP NHAT LO TRINH DO THI TOPO TOAN CUC (A* TOPOLOGICAL GRAPH PLANNING)
        self.topo_plan_timer += 0.05
        if self.topo_plan_timer >= 1.5 or len(self.current_waypoints) == 0:
            self.topo_plan_timer = 0.0
            self.topo_graph.update_edge_costs_from_danger(self.memory.danger_grid)
            self.current_waypoints = self.topo_graph.plan_path(
                start_pos=robot_pos,
                goal_pos=target_pos,
                obstacles=obstacles,
                radii=effective_radii,
            )

        # Lay Waypoint tiep theo tu lo trinh A*
        if self.current_waypoints:
            dist_to_wp = float(np.linalg.norm(robot_pos - self.current_waypoints[0]))
            if dist_to_wp < 1.6 and len(self.current_waypoints) > 1:
                self.current_waypoints.pop(0)
            effective_target = np.copy(self.current_waypoints[0])
        else:
            effective_target = np.copy(target_pos)

        to_target = effective_target - robot_pos
        dist_target = float(np.linalg.norm(to_target))

        if dist_target < 0.35:
            action = [0.0, 0.0]
            self.last_action = np.array(action, dtype=np.float32)
            self.last_base_action = np.array(action, dtype=np.float32)
            self.last_neural_action = np.array(action, dtype=np.float32)
            return action

        # Ray-cast kiem tra vat can chan giua robot va muc tieu
        if dist_target > 0.8:
            target_unit = to_target / dist_target
            closest_blocker = None
            closest_blocker_dist = 999.0
            closest_rad = 2.0

            for obs, rad in zip(obstacles, effective_radii):
                vec_obs = obs - robot_pos
                proj = float(np.dot(vec_obs, target_unit))
                if 0.5 < proj < (dist_target - 0.5):
                    perp = vec_obs - target_unit * proj
                    perp_dist = float(np.linalg.norm(perp))
                    corridor_radius = float(rad) + 1.2
                    if perp_dist < corridor_radius:
                        if proj < closest_blocker_dist:
                            closest_blocker_dist = proj
                            closest_blocker = obs
                            closest_rad = float(rad)

            # Neu co toa nha chan ngay truoc mat, chuyen muc tieu tam thoi lượn ra ngoai ria
            if closest_blocker is not None:
                normal = np.array([-target_unit[1], target_unit[0]], dtype=np.float32)
                waypoint_a = closest_blocker + normal * (closest_rad + 2.6)
                waypoint_b = closest_blocker - normal * (closest_rad + 2.6)

                dist_center_a = float(np.linalg.norm(waypoint_a - np.array([50.0, 50.0])))
                dist_center_b = float(np.linalg.norm(waypoint_b - np.array([50.0, 50.0])))
                if 5.0 <= waypoint_a[0] <= 95.0 and 5.0 <= waypoint_a[1] <= 95.0 and dist_center_a <= dist_center_b:
                    effective_target = waypoint_a
                else:
                    effective_target = waypoint_b

                effective_target = np.clip(effective_target, 5.0, 95.0)
                to_target = effective_target - robot_pos
                dist_target = float(np.linalg.norm(to_target))

        attract_dir = to_target / max(dist_target, 1e-4)
        attract_force = attract_dir * min(max_speed, dist_target * 1.5)

        # 2. Luc day tu vat can thuc te & Ky uc nguy hiem ket hop Tiep Tuyen Be Lai (Tangential Swerve)
        repulse_force = np.zeros(2, dtype=np.float32)

        for obs, rad in zip(obstacles, effective_radii):
            diff = robot_pos - obs
            dist_obs = float(np.linalg.norm(diff))
            safe_clearance = float(rad) + 2.4
            if dist_obs < safe_clearance:
                repulse_dir = diff / max(dist_obs, 1e-4)
                danger_memory = self.memory.get_danger_at(obs)
                multiplier = 4.8 + danger_memory * 5.5
                penetration = (safe_clearance - dist_obs) / 2.4
                strength = (penetration ** 2) * multiplier

                tangent = np.array([-repulse_dir[1], repulse_dir[0]], dtype=np.float32)
                if np.dot(tangent, attract_dir) < 0:
                    tangent = -tangent
                repulse_force += repulse_dir * strength + tangent * (strength * 1.25)

        # 3. Tranh va cham ban be nhe nhang (ton trong khong gian ca nhan)
        if peer_pos is not None:
            peer_diff = robot_pos - peer_pos
            dist_peer = float(np.linalg.norm(peer_diff))
            peer_safety_radius = 1.3
            if 0.01 < dist_peer < peer_safety_radius:
                repulse_peer_dir = peer_diff / dist_peer
                peer_strength = ((peer_safety_radius - dist_peer) / peer_safety_radius) * 2.0
                peer_tangent = np.array([-repulse_peer_dir[1], repulse_peer_dir[0]], dtype=np.float32)
                if np.dot(peer_tangent, attract_dir) < 0:
                    peer_tangent = -peer_tangent
                repulse_force += repulse_peer_dir * peer_strength + peer_tangent * (peer_strength * 0.75)

        # 3b. NE TRANH VA CHAM TUONG HO VAN TOC (ORCA / VELOCITY OBSTACLE) VOI XE CO DONG
        self.is_traffic_avoiding = False
        if dynamic_vehicles:
            for veh in dynamic_vehicles:
                v_pos = np.array(veh["pos"], dtype=np.float32)
                v_vel = np.array(veh["velocity"], dtype=np.float32)
                v_rad = float(veh["radius"])
                rel_pos = v_pos - robot_pos
                dist_v = float(np.linalg.norm(rel_pos))

                if dist_v < 9.0:
                    rel_vel = attract_force - v_vel
                    rel_speed_sq = float(np.dot(rel_vel, rel_vel))
                    combined_rad = 0.45 + v_rad + 1.2

                    if rel_speed_sq > 0.01:
                        t_cpa = -float(np.dot(rel_pos, rel_vel)) / rel_speed_sq
                        if 0.05 < t_cpa < 2.5:
                            closest_dist = float(np.linalg.norm(rel_pos + rel_vel * t_cpa))
                            if closest_dist < combined_rad:
                                self.is_traffic_avoiding = True
                                veh_speed = float(np.linalg.norm(v_vel))
                                if veh_speed > 0.1:
                                    v_unit = v_vel / veh_speed
                                    dodge_normal = np.array([-v_unit[1], v_unit[0]], dtype=np.float32)
                                    if np.dot(dodge_normal, -rel_pos) < 0:
                                        dodge_normal = -dodge_normal
                                else:
                                    dodge_normal = -rel_pos / max(dist_v, 1e-4)

                                avoid_strength = ((combined_rad - closest_dist) / combined_rad) * 4.5
                                repulse_force += dodge_normal * avoid_strength

                                if dist_v < 3.8:
                                    attract_force *= 0.25
                                    if self.thought_timer > 2.5:
                                        self.current_thought = f"{self.name} cẩn thận dừng bước nhường đường cho {veh['name']} chạy qua trước."
                                        self.thought_timer = 0.0

        # 4. Tranh tuong rao bien dai do thi 100x100
        wall_margin = 6.5
        world_size = 100.0

        # Tuong Tay (x = 0)
        if robot_pos[0] < wall_margin:
            depth = (wall_margin - robot_pos[0]) / wall_margin
            repulse_force[0] += (depth ** 1.6) * 8.5
            if attract_force[0] < 0:
                attract_force[0] *= max(0.0, (robot_pos[0] - 1.5) / (wall_margin - 1.5))
        # Tuong Dong (x = 100)
        elif robot_pos[0] > (world_size - wall_margin):
            depth = (robot_pos[0] - (world_size - wall_margin)) / wall_margin
            repulse_force[0] -= (depth ** 1.6) * 8.5
            if attract_force[0] > 0:
                attract_force[0] *= max(0.0, (world_size - 1.5 - robot_pos[0]) / (wall_margin - 1.5))

        # Tuong Nam (z = 0)
        if robot_pos[1] < wall_margin:
            depth = (wall_margin - robot_pos[1]) / wall_margin
            repulse_force[1] += (depth ** 1.6) * 8.5
            if attract_force[1] < 0:
                attract_force[1] *= max(0.0, (robot_pos[1] - 1.5) / (wall_margin - 1.5))
        # Tuong Bac (z = 100)
        elif robot_pos[1] > (world_size - wall_margin):
            depth = (robot_pos[1] - (world_size - wall_margin)) / wall_margin
            repulse_force[1] -= (depth ** 1.6) * 8.5
            if attract_force[1] > 0:
                attract_force[1] *= max(0.0, (world_size - 1.5 - robot_pos[1]) / (wall_margin - 1.5))

        # Luc dinh huong nen tang (Base Planning Force)
        base_force = attract_force + repulse_force
        norm = float(np.linalg.norm(base_force))
        if norm > max_speed:
            base_force = (base_force / norm) * max_speed

        self.last_base_action = np.asarray(base_force, dtype=np.float32)

        # 5. RESIDUAL REINFORCEMENT LEARNING (RRL) - TRAO QUYEN LAI CHO MANG NO-RON
        if obs_vector is not None:
            self.last_obs = np.asarray(obs_vector, dtype=np.float32)
            final_action, neural_action, _ = self.online_learner.get_residual_action(
                obs=self.last_obs,
                base_action=base_force,
                competence_factor=competence,
                max_speed=max_speed,
                deterministic=False,
            )
            self.last_neural_action = np.asarray(neural_action, dtype=np.float32)
        else:
            final_action = base_force
            self.last_neural_action = np.zeros(2, dtype=np.float32)

        # BẢO VỆ ĐỘNG HỌC TUYỆT ĐỐI (Kinematic Wall Safety Clamp):
        # Khong bao gio cho phep no-ron hay nhieu day be lun sau vao tuong rao bien
        if robot_pos[0] < 3.5 and final_action[0] < 0.6:
            final_action[0] = max(0.8, final_action[0] + 1.6)
        elif robot_pos[0] > (world_size - 3.5) and final_action[0] > -0.6:
            final_action[0] = min(-0.8, final_action[0] - 1.6)

        if robot_pos[1] < 3.5 and final_action[1] < 0.6:
            final_action[1] = max(0.8, final_action[1] + 1.6)
        elif robot_pos[1] > (world_size - 3.5) and final_action[1] > -0.6:
            final_action[1] = min(-0.8, final_action[1] - 1.6)

        # Nhieu kham pha tu nhien (giam dan tu Giai doan 1 xuong Giai doan 3)
        motor_noise_scale = 0.08 if stage_info["stage_id"] == 1 else 0.03 if stage_info["stage_id"] == 2 else 0.01
        noise = (np.random.rand(2).astype(np.float32) - 0.5) * motor_noise_scale
        final_action = np.clip(final_action + noise, -max_speed, max_speed)

        action_list = [round(float(final_action[0]), 3), round(float(final_action[1]), 3)]
        self.last_action = np.array(action_list, dtype=np.float32)
        return action_list

    def to_dict(self) -> Dict[str, Any]:
        """
        Dong goi du lieu toan dien cua bo nao nhan thuc de truyen ve frontend qua WebSocket.

        Returns:
            Dict[str, Any]: Du lieu tu duy, loi noi, tien trinh giai doan va vi mach than kinh.
        """
        stage_info = self.get_stage_info()
        return {
            "name": self.name,
            "personality": self.personality,
            "is_autonomous": self.is_autonomous,
            "is_sprinting": self.is_sprinting,
            "current_goal_name": self.current_goal_name,
            "current_goal_pos": self.current_goal_pos.tolist(),
            "current_thought": self.current_thought,
            "has_custom_target": self.custom_target is not None,
            "custom_target": self.custom_target.tolist() if self.custom_target is not None else None,
            "development_step": self.development_step,
            "stage_info": stage_info,
            "competence": stage_info["competence"],
            "recent_reflections": list(self.recent_reflections),
            "last_neural_action": self.last_neural_action.tolist() if self.last_neural_action is not None else [0.0, 0.0],
            "last_base_action": self.last_base_action.tolist() if self.last_base_action is not None else [0.0, 0.0],
            "stats": dict(self.stats),
            "memory": self.memory.to_dict(),
            "online_learner": self.online_learner.to_dict(),
            "current_waypoints": [
                [round(float(w[0]), 2), round(float(w[1]), 2)]
                for w in self.current_waypoints
            ],
            "is_traffic_avoiding": self.is_traffic_avoiding,
        }
