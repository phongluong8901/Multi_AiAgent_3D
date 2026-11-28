import math
import random
from typing import Dict, Any, List, Tuple, Optional


class Navigation3DEnv:
    """
    Gym-like 3D Grid Arena Navigation Environment for Reinforcement Learning.
    The agent learns to navigate around obstacles to reach a target goal position.
    """
    ACTIONS = {
        0: "FORWARD",
        1: "BACKWARD",
        2: "TURN_LEFT",
        3: "TURN_RIGHT",
        4: "FORWARD_LEFT",
        5: "FORWARD_RIGHT"
    }

    def __init__(
        self,
        arena_size: float = 20.0,
        max_steps: int = 150,
        agent_radius: float = 0.5,
        goal_radius: float = 0.9,
        lidar_range: float = 8.0,
        lidar_beams: int = 8
    ):
        self.arena_size = arena_size
        self.half_size = arena_size / 2.0
        self.max_steps = max_steps
        self.agent_radius = agent_radius
        self.goal_radius = goal_radius
        self.lidar_range = lidar_range
        self.lidar_beams = lidar_beams

        # Vị trí Agent
        self.agent_x: float = 0.0
        self.agent_z: float = 0.0
        self.agent_heading: float = 0.0  # Radian (0 = hướng trục +X)

        # Đích đến
        self.goal_x: float = 0.0
        self.goal_z: float = 0.0

        # Danh sách chướng ngại vật [{x, z, radius}]
        self.obstacles: List[Dict[str, float]] = []

        self.current_step: int = 0
        self.prev_distance: float = 0.0
        self.min_distance: float = 0.0
        self.prev_angle_diff: float = 0.0
        self.prev_front_dist: Optional[float] = None
        self.episode_collisions: int = 0
        self.stall_steps: int = 0
        self.current_map: str = "office"
        self.set_map("office")

    OFFICE_OBSTACLES = [
        # 1. PHÒNG QUẢN LÝ & ĐIỀU HÀNH (Tây Bắc: X < 0, Z < 0)
        {"x": -9.5, "z": -8.0, "radius": 1.4, "type": "desk"},       # Bàn Giám đốc
        {"x": -5.5, "z": -8.0, "radius": 1.4, "type": "desk"},       # Bàn Điều phối
        {"x": -9.5, "z": -4.0, "radius": 1.4, "type": "desk"},       # Bàn Quản lý PM
        {"x": -5.5, "z": -3.5, "radius": 1.4, "type": "roundtable"}, # Bàn họp nhỏ
        {"x": -13.2, "z": -5.25, "radius": 1.1, "type": "cabinet"},  # Tủ tài liệu
        {"x": -13.2, "z": -9.5, "radius": 0.9, "type": "plant"},     # Cây cảnh
        {"x": -3.5, "z": -9.5, "radius": 0.9, "type": "plant"},      # Cây cảnh

        # 2. PHÒNG NGHIÊN CỨU & TÌM KIẾM (Đông Bắc: X > 0, Z < 0)
        {"x": 5.5, "z": -8.0, "radius": 1.4, "type": "desk"},        # Bàn AI Lab
        {"x": 9.5, "z": -8.0, "radius": 1.4, "type": "desk"},        # Bàn Web Crawler
        {"x": 5.5, "z": -4.0, "radius": 1.4, "type": "desk"},        # Bàn Knowledge Graph
        {"x": 9.5, "z": -4.0, "radius": 1.4, "type": "desk"},        # Bàn Data Research
        {"x": 13.2, "z": -9.0, "radius": 1.0, "type": "server"},     # Server Rack 1
        {"x": 13.2, "z": -6.0, "radius": 1.0, "type": "server"},     # Server Rack 2
        {"x": 13.2, "z": -4.0, "radius": 1.0, "type": "server"},     # Server Rack 3
        {"x": 3.5, "z": -9.5, "radius": 0.9, "type": "plant"},       # Cây cảnh
        {"x": 13.2, "z": -1.2, "radius": 0.9, "type": "plant"},      # Cây cảnh

        # 3. PHÒNG PHÂN TÍCH & ĐÁNH GIÁ (Đông Nam: X > 0, Z > 0)
        {"x": 5.5, "z": 4.0, "radius": 1.4, "type": "desk"},         # Bàn Analyst
        {"x": 9.5, "z": 4.0, "radius": 1.4, "type": "desk"},         # Bàn Metric QA
        {"x": 5.5, "z": 8.0, "radius": 1.4, "type": "desk"},         # Bàn Evaluator
        {"x": 9.5, "z": 8.0, "radius": 1.4, "type": "desk"},         # Bàn Audit
        {"x": 13.2, "z": 2.5, "radius": 1.1, "type": "cabinet"},     # Tủ tài liệu
        {"x": 3.5, "z": 9.5, "radius": 0.9, "type": "plant"},        # Cây cảnh
        {"x": 13.2, "z": 9.5, "radius": 0.9, "type": "plant"},       # Cây cảnh

        # 4. KHU VỰC LOUNGE & NGHỈ NGƠI (Tây Nam: X < 0, Z > 0)
        {"x": -9.0, "z": 4.5, "radius": 1.8, "type": "sofa"},        # Ghế Sofa
        {"x": -6.0, "z": 4.0, "radius": 1.5, "type": "roundtable"},  # Bàn tròn hội ý
        {"x": -8.5, "z": 8.5, "radius": 2.1, "type": "pingpong"},    # Bàn bóng bàn
        {"x": -3.5, "z": 1.5, "radius": 1.2, "type": "coffee"},      # Quầy trà cafe
        {"x": -13.2, "z": 1.5, "radius": 0.9, "type": "plant"},      # Cây cảnh
        {"x": -13.2, "z": 9.5, "radius": 0.9, "type": "plant"},      # Cây cảnh

        # 5. TƯỜNG NGĂN VÀ VÁCH KÍNH CÓ CỬA RA VÀO (PARTITIONS & WALLS)
        # Tường ngăn Tây (giữa Quản lý & Lounge)
        {"x": -11.5, "z": 0.0, "radius": 1.2, "type": "wall"},
        {"x": -8.25, "z": 0.0, "radius": 1.2, "type": "wall"},
        {"x": -5.0, "z": 0.0, "radius": 1.2, "type": "wall"},
        # Tường ngăn Đông (giữa Nghiên cứu & Phân tích)
        {"x": 5.0, "z": 0.0, "radius": 1.2, "type": "wall"},
        {"x": 8.25, "z": 0.0, "radius": 1.2, "type": "wall"},
        {"x": 11.5, "z": 0.0, "radius": 1.2, "type": "wall"},
        # Vách kính dọc Tây (chừa cửa tại Z = -2.8 và Z = 1.5)
        {"x": -2.5, "z": -8.5, "radius": 1.1, "type": "partition"},
        {"x": -2.5, "z": -5.5, "radius": 1.1, "type": "partition"},
        {"x": -2.5, "z": -0.8, "radius": 1.0, "type": "partition"},
        {"x": -2.5, "z": 5.0, "radius": 1.1, "type": "partition"},
        {"x": -2.5, "z": 8.0, "radius": 1.1, "type": "partition"},
        # Vách kính dọc Đông (chừa cửa tại Z = -2.8 và Z = 2.8)
        {"x": 2.5, "z": -8.5, "radius": 1.1, "type": "partition"},
        {"x": 2.5, "z": -5.5, "radius": 1.1, "type": "partition"},
        {"x": 2.5, "z": 0.0, "radius": 1.0, "type": "partition"},
        {"x": 2.5, "z": 6.0, "radius": 1.1, "type": "partition"},
        {"x": 2.5, "z": 9.0, "radius": 1.1, "type": "partition"},
    ]

    def set_map(self, map_name: str = "office"):
        """Chuyển đổi bản đồ môi trường: 'office' (Văn phòng thật 28x22m) hoặc 'grid' (Sa bàn cơ bản 20x20m)"""
        self.current_map = map_name
        if map_name == "office":
            self.arena_size = 28.0
            self.half_x = 13.6
            self.half_z = 10.6
            self.half_size = 13.6
            self.max_steps = 200
            self.obstacles = [dict(o) for o in self.OFFICE_OBSTACLES]
        else:
            self.arena_size = 20.0
            self.half_x = 9.6
            self.half_z = 9.6
            self.half_size = 9.6
            self.max_steps = 150
            self.default_obstacles_layout()

    def default_obstacles_layout(self):
        """Khởi tạo chướng ngại vật mặc định quanh sa bàn"""
        self.obstacles = [
            {"x": -4.0, "z": -3.0, "radius": 1.2, "type": "pillar"},
            {"x": 4.0, "z": -4.0, "radius": 1.4, "type": "pillar"},
            {"x": 0.0, "z": 0.0, "radius": 1.5, "type": "pillar"},
            {"x": -4.5, "z": 4.0, "radius": 1.3, "type": "pillar"},
            {"x": 4.5, "z": 4.0, "radius": 1.3, "type": "pillar"},
            {"x": 0.0, "z": 6.0, "radius": 1.1, "type": "pillar"},
            {"x": -6.0, "z": 0.0, "radius": 1.2, "type": "pillar"},
            {"x": 6.0, "z": 0.0, "radius": 1.2, "type": "pillar"},
        ]

    # Danh sách các toạ độ lối đi an toàn thông thoáng tuyệt đối (cách xa mọi bàn ghế >= 1.0m)
    OFFICE_ROOM_POIS = {
        "nw": [  # Phòng Quản lý & Điều hành (Tây Bắc)
            {"x": -7.5, "z": -6.0, "name": "Lối đi giữa phòng Quản lý"},
            {"x": -10.0, "z": -6.0, "name": "Lối đi phía tây Quản lý"},
            {"x": -5.0, "z": -6.0, "name": "Lối đi cạnh bàn Điều phối"},
            {"x": -8.0, "z": -2.2, "name": "Lối đi trước bàn PM"},
            {"x": -4.5, "z": -2.2, "name": "Cạnh cửa phòng Quản lý"},
            {"x": -10.5, "z": -2.2, "name": "Góc tài liệu Quản lý"},
        ],
        "ne": [  # Phòng Nghiên cứu & AI Lab (Đông Bắc)
            {"x": 7.5, "z": -6.0, "name": "Lối đi giữa phòng AI Lab"},
            {"x": 10.0, "z": -6.0, "name": "Lối đi phía đông AI Lab"},
            {"x": 5.0, "z": -6.0, "name": "Lối đi cạnh bàn AI Lab"},
            {"x": 8.0, "z": -2.2, "name": "Lối đi trước bàn Data Research"},
            {"x": 4.5, "z": -2.2, "name": "Cạnh cửa phòng AI Lab"},
            {"x": 11.2, "z": -3.5, "name": "Lối đi trước Server Rack"},
        ],
        "se": [  # Phòng Phân tích & Đánh giá (Đông Nam)
            {"x": 7.5, "z": 6.0, "name": "Lối đi giữa phòng Phân tích"},
            {"x": 10.0, "z": 6.0, "name": "Lối đi phía đông Phân tích"},
            {"x": 5.0, "z": 6.0, "name": "Lối đi cạnh bàn Analyst"},
            {"x": 8.0, "z": 2.2, "name": "Lối đi trước bàn QA"},
            {"x": 4.5, "z": 2.2, "name": "Cạnh cửa phòng Phân tích"},
            {"x": 11.2, "z": 5.0, "name": "Lối đi cạnh cửa sổ Phân tích"},
        ],
        "sw": [  # Khu vực Lounge & Nghỉ ngơi (Tây Nam)
            {"x": -8.0, "z": 3.0, "name": "Khoảng trống trước Sofa Lounge"},
            {"x": -5.0, "z": 3.0, "name": "Khoảng trống cạnh quầy Coffee"},
            {"x": -4.5, "z": 2.2, "name": "Cạnh cửa Lounge"},
            {"x": -8.0, "z": 6.5, "name": "Lối đi giữa Bàn tròn & Bóng bàn"},
            {"x": -5.5, "z": 6.5, "name": "Lối đi phía đông Lounge"},
            {"x": -10.5, "z": 6.5, "name": "Góc thư giãn Lounge"},
        ],
        "corridor": [  # Hành lang trung tâm
            {"x": 0.0, "z": -7.5, "name": "Hành lang Bắc"},
            {"x": 0.0, "z": -3.0, "name": "Nút giao cửa Bắc"},
            {"x": 0.0, "z": 0.0, "name": "Trung tâm Văn phòng"},
            {"x": 0.0, "z": 2.5, "name": "Nút giao cửa Nam"},
            {"x": 0.0, "z": 7.5, "name": "Hành lang Nam"},
        ]
    }

    def _get_zone(self, x: float, z: float) -> str:
        if abs(x) <= 2.2:
            return "corridor"
        if z <= 0:
            return "nw" if x < 0 else "ne"
        return "sw" if x < 0 else "se"

    def _is_position_safe(self, x: float, z: float, clearance: float = 0.55) -> bool:
        """Kiểm tra toạ độ an toàn, không đè lên bàn ghế hay tường"""
        if abs(x) >= (self.half_x - self.agent_radius - clearance) or abs(z) >= (self.half_z - self.agent_radius - clearance):
            return False
        for obs in self.obstacles:
            dist = math.hypot(x - obs["x"], z - obs["z"])
            if dist < (obs.get("radius", 1.0) + self.agent_radius + clearance):
                return False
        return True

    def _sample_office_pos(self, zone: str, is_goal: bool = False) -> Tuple[float, float]:
        """Lấy một vị trí lối đi an toàn tuyệt đối trong phân khu chỉ định"""
        pois = self.OFFICE_ROOM_POIS.get(zone, self.OFFICE_ROOM_POIS["corridor"])
        clearance = 0.35 if is_goal else 0.55

        for _ in range(30):
            p = random.choice(pois)
            noise_r = 0.45 if is_goal else 0.3
            x = p["x"] + random.uniform(-noise_r, noise_r)
            z = p["z"] + random.uniform(-noise_r, noise_r)
            if self._is_position_safe(x, z, clearance):
                return round(x, 2), round(z, 2)

        p = random.choice(pois)
        return p["x"], p["z"]

    def set_custom_obstacles(self, obstacles: List[Dict[str, float]]):
        if obstacles is not None:
            self.obstacles = obstacles

    def _find_safe_pos(self, z_min: float, z_max: float, min_clearance: float = 0.9) -> Tuple[float, float]:
        """Tìm vị trí ngẫu nhiên an toàn trong ranh giới phòng 28x22m, không đè tường hay vật cản"""
        limit_x = self.half_x - 2.0
        min_z = max(-self.half_z + 1.8, z_min)
        max_z = min(self.half_z - 1.8, z_max)

        for _ in range(80):
            x = random.uniform(-limit_x, limit_x)
            z = random.uniform(min_z, max_z)
            blocked = False
            for obs in self.obstacles:
                dx = x - obs["x"]
                dz = z - obs["z"]
                dist = math.sqrt(dx * dx + dz * dz)
                if dist < (obs.get("radius", 1.0) + self.agent_radius + min_clearance):
                    blocked = True
                    break
            if not blocked:
                return x, z
        return 0.0, max(min_z, min(max_z, 0.0))

    def reset(
        self,
        agent_start: Optional[Tuple[float, float]] = None,
        goal_pos: Optional[Tuple[float, float]] = None,
        episode_num: int = 1
    ) -> Dict[str, Any]:
        """Reset môi trường về trạng thái bắt đầu episode mới với Curriculum Learning mượt mà"""
        self.current_step = 0
        self.episode_collisions = 0
        self.stall_steps = 0

        curriculum = min(1.0, max(0.0, (episode_num - 1) / 180.0))

        if self.current_map == "office":
            room_keys = ["nw", "ne", "se", "sw"]
            selected_zone = random.choice(room_keys) if random.random() < 0.85 else "corridor"

            if agent_start is not None:
                self.agent_x, self.agent_z = agent_start
                agent_zone = self._get_zone(self.agent_x, self.agent_z)
            else:
                self.agent_x, self.agent_z = self._sample_office_pos(selected_zone, is_goal=False)
                agent_zone = selected_zone

            if goal_pos is not None:
                self.goal_x, self.goal_z = goal_pos
            else:
                same_room_prob = 0.95 - 0.12 * curriculum
                if agent_zone in room_keys and random.random() < same_room_prob:
                    target_zone = agent_zone
                else:
                    target_zone = "corridor"

                min_goal_dist = 2.0 + 0.6 * curriculum
                max_goal_dist = 5.5 + 6.5 * curriculum
                chosen = False
                for _ in range(40):
                    gx, gz = self._sample_office_pos(target_zone, is_goal=True)
                    d = math.hypot(gx - self.agent_x, gz - self.agent_z)
                    if min_goal_dist <= d <= max_goal_dist:
                        self.goal_x, self.goal_z = gx, gz
                        chosen = True
                        break
                if not chosen:
                    for _ in range(30):
                        gx, gz = self._sample_office_pos(target_zone, is_goal=True)
                        if math.hypot(gx - self.agent_x, gz - self.agent_z) >= 2.0:
                            self.goal_x, self.goal_z = gx, gz
                            chosen = True
                            break
                if not chosen:
                    self.goal_x, self.goal_z = self._sample_office_pos(target_zone, is_goal=True)

            ideal_heading = math.atan2(self.goal_z - self.agent_z, self.goal_x - self.agent_x)
            spread = math.pi * (0.4 + 0.6 * curriculum)
            self.agent_heading = (ideal_heading + random.uniform(-spread, spread)) % (2 * math.pi)

        else:
            if agent_start is not None:
                self.agent_x, self.agent_z = agent_start
            else:
                spawn_north = random.random() < 0.5
                if spawn_north:
                    self.agent_x, self.agent_z = self._find_safe_pos(
                        z_min=-self.half_z + 2.0,
                        z_max=-2.5,
                        min_clearance=0.9
                    )
                else:
                    self.agent_x, self.agent_z = self._find_safe_pos(
                        z_min=2.5,
                        z_max=self.half_z - 2.0,
                        min_clearance=0.9
                    )

            self.agent_heading = random.uniform(0, 2 * math.pi)

            if goal_pos is not None:
                self.goal_x, self.goal_z = goal_pos
            else:
                max_r = min(9.5, 3.5 + curriculum * 6.0)
                placed = False
                for _ in range(60):
                    ang = self.agent_heading + random.uniform(-2.0, 2.0)
                    r = random.uniform(2.8, max_r)
                    gx = self.agent_x + r * math.cos(ang)
                    gz = self.agent_z + r * math.sin(ang)

                    if abs(gx) < (self.half_x - 2.0) and abs(gz) < (self.half_z - 1.8):
                        hit = False
                        for obs in self.obstacles:
                            if math.sqrt((gx - obs["x"]) ** 2 + (gz - obs["z"]) ** 2) < (obs.get("radius", 1.0) + 1.1):
                                hit = True
                                break
                        if not hit:
                            self.goal_x, self.goal_z = gx, gz
                            placed = True
                            break

                if not placed:
                    z_target_min = -self.half_z + 2.0 if self.agent_z < 0 else 1.5
                    z_target_max = -1.5 if self.agent_z < 0 else self.half_z - 2.0
                    self.goal_x, self.goal_z = self._find_safe_pos(z_min=z_target_min, z_max=z_target_max, min_clearance=1.0)

        self.prev_distance = self._calc_distance_to_goal()
        self.min_distance = self.prev_distance
        self.prev_angle_diff = abs(self._calc_angle_to_goal())
        self.prev_front_dist = None
        return self.get_observation()

    def _calc_distance_to_goal(self) -> float:
        dx = self.goal_x - self.agent_x
        dz = self.goal_z - self.agent_z
        return math.sqrt(dx * dx + dz * dz)

    def _calc_angle_to_goal(self) -> float:
        """Tính góc lệch tương đối giữa hướng đi của Agent và hướng tới Goal (-pi -> pi)"""
        dx = self.goal_x - self.agent_x
        dz = self.goal_z - self.agent_z
        target_angle = math.atan2(dz, dx)
        diff = target_angle - self.agent_heading
        while diff > math.pi:
            diff -= 2 * math.pi
        while diff < -math.pi:
            diff += 2 * math.pi
        return diff

    def _get_lidar_readings(self) -> List[float]:
        """
        Bắn tia LIDAR C-Space theo 8 hướng đo khoảng cách thực tế từ mép cơ thể Agent
        tới mép chướng ngại vật (tính cả agent_radius để cảm biến không bị mù góc vai).
        """
        readings = []
        angle_step = (2 * math.pi) / self.lidar_beams
        eff_wall_x = self.half_x - self.agent_radius
        eff_wall_z = self.half_z - self.agent_radius

        for i in range(self.lidar_beams):
            beam_angle = self.agent_heading + (i * angle_step)
            cos_b = math.cos(beam_angle)
            sin_b = math.sin(beam_angle)

            min_dist = self.lidar_range

            # 1. Khoảng cách tới tường biên
            if cos_b > 1e-6:
                dist_wall = max(0.0, (eff_wall_x - self.agent_x) / cos_b)
                if dist_wall < min_dist:
                    min_dist = dist_wall
            elif cos_b < -1e-6:
                dist_wall = max(0.0, (-eff_wall_x - self.agent_x) / cos_b)
                if dist_wall < min_dist:
                    min_dist = dist_wall

            if sin_b > 1e-6:
                dist_wall = max(0.0, (eff_wall_z - self.agent_z) / sin_b)
                if dist_wall < min_dist:
                    min_dist = dist_wall
            elif sin_b < -1e-6:
                dist_wall = max(0.0, (-eff_wall_z - self.agent_z) / sin_b)
                if dist_wall < min_dist:
                    min_dist = dist_wall

            # 2. Khoảng cách C-Space tới từng chướng ngại vật tròn (cộng bán kính Agent)
            for obs in self.obstacles:
                ox, oz = obs["x"], obs["z"]
                eff_rad = obs.get("radius", 1.0) + self.agent_radius
                dx = ox - self.agent_x
                dz = oz - self.agent_z
                proj = dx * cos_b + dz * sin_b
                if proj > 0:
                    perp_sq = (dx * dx + dz * dz) - (proj * proj)
                    if perp_sq < (eff_rad * eff_rad):
                        chord = math.sqrt(max(0.0, (eff_rad * eff_rad) - perp_sq))
                        hit_dist = max(0.0, proj - chord)
                        if hit_dist < min_dist:
                            min_dist = hit_dist

            readings.append(round(min_dist, 3))

        return readings

    def check_collision(self, x: float, z: float) -> bool:
        """Kiểm tra xem vị trí (x, z) có đâm vào chướng ngại vật hoặc tường không"""
        if abs(x) >= (self.half_x - self.agent_radius) or abs(z) >= (self.half_z - self.agent_radius):
            return True

        for obs in self.obstacles:
            dx = x - obs["x"]
            dz = z - obs["z"]
            dist = math.sqrt(dx * dx + dz * dz)
            if dist <= (obs.get("radius", 1.0) + self.agent_radius):
                return True
        return False

    def _try_tangential_slide(self, desired_heading: float, step_dist: float) -> Tuple[bool, float, float, float]:
        """
        Cơ chế trượt tiếp tuyến vật lý (Collider Sliding):
        Khi bước đi thẳng bị vướng mép bàn ghế, thử trượt sang hướng tiếp tuyến thông thoáng
        để Agent lách qua mượt mà thay vì bị kẹt cứng tại chỗ.
        """
        for angle_offset in [0.45, -0.45, 0.85, -0.85, 1.25, -1.25]:
            cand_heading = (desired_heading + angle_offset) % (2 * math.pi)
            cand_x = self.agent_x + (step_dist * 0.65) * math.cos(cand_heading)
            cand_z = self.agent_z + (step_dist * 0.65) * math.sin(cand_heading)
            if not self.check_collision(cand_x, cand_z):
                return True, cand_x, cand_z, cand_heading
        return False, self.agent_x, self.agent_z, desired_heading

    def step(self, action: int) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
        """
        Thực thi 1 bước hành động (Action) trong môi trường:
        Action:
            0: FORWARD
            1: BACKWARD
            2: TURN_LEFT
            3: TURN_RIGHT
            4: FORWARD_LEFT
            5: FORWARD_RIGHT
        """
        self.current_step += 1
        speed = 0.65
        turn_speed = 0.55

        new_x = self.agent_x
        new_z = self.agent_z
        new_heading = self.agent_heading
        move_dist = 0.0

        if action == 0:  # Tiến
            move_dist = speed
            new_x += move_dist * math.cos(self.agent_heading)
            new_z += move_dist * math.sin(self.agent_heading)
        elif action == 1:  # Lùi
            move_dist = speed * 0.45
            new_x -= move_dist * math.cos(self.agent_heading)
            new_z -= move_dist * math.sin(self.agent_heading)
        elif action == 2:  # Xoay trái
            new_heading += turn_speed
        elif action == 3:  # Xoay phải
            new_heading -= turn_speed
        elif action == 4:  # Vừa tiến vừa rẽ trái
            new_heading += turn_speed * 0.8
            move_dist = speed * 0.8
            new_x += move_dist * math.cos(new_heading)
            new_z += move_dist * math.sin(new_heading)
        elif action == 5:  # Vừa tiến vừa rẽ phải
            new_heading -= turn_speed * 0.8
            move_dist = speed * 0.8
            new_x += move_dist * math.cos(new_heading)
            new_z += move_dist * math.sin(new_heading)

        new_heading = new_heading % (2 * math.pi)
        slid_past = False

        if action in [2, 3]:
            is_collision = False
            self.agent_heading = new_heading
        else:
            raw_collision = self.check_collision(new_x, new_z)
            if not raw_collision:
                is_collision = False
                self.agent_heading = new_heading
                self.agent_x = new_x
                self.agent_z = new_z
            else:
                # Nếu đang rẽ (action 4, 5) mà quệt mép bàn ghế -> trượt tiếp tuyến quanh mép bàn
                if action in [4, 5]:
                    ok, sx, sz, sh = self._try_tangential_slide(new_heading, move_dist)
                    if ok:
                        is_collision = False
                        slid_past = True
                        self.agent_x = sx
                        self.agent_z = sz
                        self.agent_heading = sh
                    else:
                        is_collision = False
                        self.agent_heading = new_heading
                else:
                    is_collision = True
                    self.agent_heading = new_heading

        curr_distance = self._calc_distance_to_goal()
        signed_angle = self._calc_angle_to_goal()
        angle_diff = abs(signed_angle)
        lidar_readings = self._get_lidar_readings()
        front_dist = min(lidar_readings[0], lidar_readings[1] * 1.1, lidar_readings[7] * 1.1)

        # ==================== REWARD SHAPING CHỐNG GIAN LẬN (POTENTIAL-BASED + MILESTONE) ====================
        reward = -0.05

        # 1. Potential-based distance shaping
        progress = self.prev_distance - curr_distance
        if front_dist < 1.4:
            reward += max(-1.0, progress * 7.5)
        else:
            reward += progress * 8.5

        # 2. Thưởng cột mốc kỷ lục mới (Monotonic Best-Distance Bonus)
        if curr_distance < self.min_distance:
            new_best_gain = self.min_distance - curr_distance
            reward += new_best_gain * 7.0
            self.min_distance = curr_distance
            self.stall_steps = 0
        else:
            self.stall_steps += 1

        # 3. Phạt hành vi đi lùi vô lý khi phía trước thông thoáng
        if action == 1 and front_dist > 1.4:
            reward -= 0.7

        if slid_past:
            reward -= 0.25  # Phạt nhẹ khi quệt vai vào mép bàn

        # 4. Thưởng xoay mũi hướng về phía Goal & định hướng né vật cản
        angle_improvement = self.prev_angle_diff - angle_diff
        if front_dist >= 1.2:
            reward += angle_improvement * 1.6
            reward += math.cos(angle_diff) * 0.25
        else:
            left_space = lidar_readings[1] + 0.7 * lidar_readings[2]
            right_space = lidar_readings[7] + 0.7 * lidar_readings[6]
            if action in [2, 4] and left_space >= right_space:
                reward += 0.4
            elif action in [3, 5] and right_space > left_space:
                reward += 0.4

        # 5. Cảnh báo sớm khoảng cách an toàn LIDAR C-Space
        if front_dist < 1.2:
            reward -= (1.2 - front_dist) * 1.5
            if self.prev_front_dist is not None and front_dist > self.prev_front_dist:
                reward += (front_dist - self.prev_front_dist) * 3.5

        if self.stall_steps > 18:
            reward -= 0.25

        self.prev_front_dist = front_dist
        self.prev_angle_diff = angle_diff

        done = False
        info = {
            "step": self.current_step,
            "action_name": self.ACTIONS.get(action, "UNKNOWN"),
            "distance": round(curr_distance, 3),
            "collision": False,
            "goal_reached": False,
            "reason": "running"
        }

        if is_collision:
            self.episode_collisions += 1
            info["collision"] = True
            # Nảy lùi theo hướng ngược lại với hướng vừa di chuyển và xoay nhẹ về hướng thoáng
            rebound_dir = -1.0 if action != 1 else 1.0
            rebound_x = self.agent_x + rebound_dir * 0.18 * math.cos(new_heading)
            rebound_z = self.agent_z + rebound_dir * 0.18 * math.sin(new_heading)
            if not self.check_collision(rebound_x, rebound_z):
                self.agent_x = rebound_x
                self.agent_z = rebound_z

            left_space = lidar_readings[1] + lidar_readings[2]
            right_space = lidar_readings[7] + lidar_readings[6]
            deflect = 0.45 if left_space >= right_space else -0.45
            self.agent_heading = (self.agent_heading + deflect) % (2 * math.pi)

            if self.episode_collisions < 6:
                reward = -2.5 * self.episode_collisions
                info["reason"] = f"bump_{self.episode_collisions}"
            else:
                reward = -18.0
                done = True
                info["reason"] = "collision"
        elif curr_distance <= self.goal_radius:
            efficiency_bonus = max(0.0, (self.max_steps - self.current_step) / self.max_steps) * 30.0
            reward = 150.0 + efficiency_bonus
            done = True
            info["goal_reached"] = True
            info["reason"] = "goal_reached"
        elif self.current_step >= self.max_steps:
            reward = -6.0
            done = True
            info["reason"] = "timeout"

        self.prev_distance = curr_distance
        obs = self.get_observation()
        return obs, reward, done, info

    def get_observation(self) -> Dict[str, Any]:
        """Trả về toàn bộ vector quan sát để Agent RL suy luận & Three.js render"""
        lidar = self._get_lidar_readings()
        dist = self._calc_distance_to_goal()
        angle = self._calc_angle_to_goal()

        return {
            "agent": {
                "x": round(self.agent_x, 3),
                "z": round(self.agent_z, 3),
                "heading": round(self.agent_heading, 3),
                "heading_deg": round(math.degrees(self.agent_heading), 1)
            },
            "goal": {
                "x": round(self.goal_x, 3),
                "z": round(self.goal_z, 3),
                "distance": round(dist, 3),
                "angle_diff": round(angle, 3)
            },
            "lidar": lidar,
            "obstacles": self.obstacles,
            "arena_size": self.arena_size,
            "step": self.current_step
        }
