import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any, Optional, Tuple
from ..internal.energy import EnergySystem
from ..internal.drives import DriveSystem


class ChildWorldEnv(gym.Env):
    """
    Moi Truong Mo Phong AI Tre Em Da Tac Tu (Child World Multi-Agent Environment).
    Mo phong the gioi dai do thi 100m x 100m cho hai be (Be Bo va Be Bi):
    - Khong gian 100m x 100m voi 36 cong trinh kien truc va xe co giao thong dong.
    - He thong dong ho dem nguoc tai nguyen va co che tai sinh (Respawn) linh hoat.
    - Cuoc dua tranh gianh thuc an / nuoc uong (Competitive / Cooperative Foraging).
    - Chu ky ngay / dem sinh hoc (Circadian Cycle: dawn, day, sunset, night).
    - He thong the chat Kcal (EnergySystem) va tam ly noi tai (DriveSystem) doc lap.
    - Vector quan sat chuan Gymnasium 28 chieu tuong thich tuyet doi voi PPO va BC.
    """

    metadata = {"render_modes": ["human"]}

    def __init__(self, persist_internal: bool = False):
        """
        Khoi tao moi truong the gioi dai do thi.

        Args:
            persist_internal (bool): True neu muon giu nguyen muc Kcal va tam ly
                                    khi reset giua cac episode, False neu reset ve mac dinh.
        """
        super().__init__()
        self.world_size: float = 100.0
        self.robot_radius: float = 0.45
        self.goal_radius: float = 1.40
        self.zone_radius: float = 2.00
        self.obstacle_radius: float = 2.20
        self.max_speed: float = 2.8
        self.dt: float = 0.05
        self.persist_internal: bool = persist_internal

        # Các khu vực chính trong Đại Đô Thị 100x100 (Megacity Map)
        self.bed_pos = np.array([12.0, 12.0], dtype=np.float32)       # Biệt thự Villa gia đình
        self.pool_pos = np.array([72.0, 14.0], dtype=np.float32)     # Khu Hồ Bơi Resort & Tắm Nắng
        self.park_pos = np.array([14.0, 78.0], dtype=np.float32)     # Đại Công Viên Cây Xanh Sinh Thái
        self.play_pos = np.array([12.0, 90.0], dtype=np.float32)     # Sân chơi trẻ em cầu trượt xích đu
        self.water_pos = np.array([68.0, 14.0], dtype=np.float32)    # Quầy Nước Mát Giải Khát bên hồ bơi
        self.food_pos = np.array([74.0, 58.0], dtype=np.float32)     # Phố Ẩm Thực Shophouse & Nhà Hàng
        self.goal_pos = np.array([50.0, 50.0], dtype=np.float32)     # Đài phun nước quảng trường trung tâm

        # Vị trí hai bé trong thành phố 100x100
        self.robot_pos = np.array([14.0, 20.0], dtype=np.float32)    # Bé Bo
        self.robot2_pos = np.array([70.0, 70.0], dtype=np.float32)  # Bé Bi

        # Chu kỳ Ngày / Đêm sinh học (Circadian Rhythm & Day/Night Cycle)
        self.time_of_day: float = 8.5
        self.day_cycle_duration_seconds: float = 120.0

        # Trạng thái dung lượng và đồng hồ đếm ngược tài nguyên (Food & Water Timers)
        self.food_capacity: float = 100.0
        self.food_max_capacity: float = 100.0
        self.food_step_timer: int = 0
        self.food_lifetime_steps: int = 1500  # 75.0 giây tự biến mất nếu không ai dùng (đô thị 100x100)

        self.water_capacity: float = 100.0
        self.water_max_capacity: float = 100.0
        self.water_step_timer: int = 0
        self.water_lifetime_steps: int = 1800  # 90.0 giây tự biến mất nếu không ai dùng (đô thị 100x100)

        # Bộ đếm hồi chiêu ăn uống giữa các khẩu phần (tránh cạn kiệt trong 0.2s)
        self.agent1_eat_cooldown: int = 0
        self.agent1_drink_cooldown: int = 0
        self.agent2_eat_cooldown: int = 0
        self.agent2_drink_cooldown: int = 0
        self.bite_cooldown_steps: int = 14  # 0.7s giữa các lần ăn/uống
        self.portion_capacity: float = 15.0  # Mỗi lần ăn/uống tiêu thụ 15% dung lượng (đủ cho gần 7 khẩu phần)

        # Bảng thành tích cuộc đua tranh giành tài nguyên (Competitive Race Stats)
        self.race_stats = {
            "bo_wins": 0,
            "bi_wins": 0,
            "bo_food_wins": 0,
            "bi_food_wins": 0,
            "bo_water_wins": 0,
            "bi_water_wins": 0,
            "total_contests": 0,
            "last_winner": None,
        }

        # Lịch sử các vị trí tài nguyên đã từng xuất hiện và đã cạn kiệt
        self.depleted_spots: list = []

        # 36 Vật thể Kiến Trúc Đô Thị & Vật Lý Thành Phố 100x100 (City Physical Obstacles)
        self.city_obstacles = np.array(
            [
                # Khối Tây Nam (Khu Dân Cư Biệt Thự & Nhà Phố)
                [12.0, 12.0],  # 0. Biệt thự Villa gia đình
                [24.0, 10.0],  # 1. Cụm nhà phố liền kề 1
                [10.0, 24.0],  # 2. Cụm nhà phố liền kề 2
                [24.0, 24.0],  # 3. Chung cư mini dân cư
                # Khối Nam Trung Tâm (Cơ quan hành chính & Bưu điện)
                [50.0, 12.0],  # 4. Trạm biến áp & Bưu điện thành phố
                [38.0, 24.0],  # 5. Tòa nhà văn phòng tài chính Nam
                [62.0, 24.0],  # 6. Trung tâm văn hóa nghệ thuật
                # Khối Đông Nam (Resort nghỉ dưỡng & Bãi biển nhân tạo)
                [72.0, 14.0],  # 7. Mép hồ bơi resort nước sâu
                [86.0, 10.0],  # 8. Khách sạn Hoàng Gia Luxury
                [78.0, 26.0],  # 9. Quầy bar giải khát ven hồ
                [90.0, 24.0],  # 10. Chòi cứu hộ & khu thể thao bãi biển
                # Khối Tây Trung Tâm (Giáo dục & Thư viện)
                [12.0, 50.0],  # 11. Trường tiểu học đô thị
                [24.0, 40.0],  # 12. Thư viện cộng đồng thành phố
                [24.0, 60.0],  # 13. Nhà thi đấu thể thao đa năng
                # Khối Trung Tâm / Downtown (Cao ốc chọc trời & Quảng trường)
                [50.0, 50.0],  # 14. Đài phun nước quảng trường trung tâm
                [40.0, 40.0],  # 15. Tháp đôi chọc trời Tây (Sky Tower A)
                [60.0, 40.0],  # 16. Tháp đôi chọc trời Đông (Sky Tower B)
                [40.0, 60.0],  # 17. Trụ sở ngân hàng thành phố
                [60.0, 60.0],  # 18. Tháp đồng hồ thị chính
                # Khối Đông Trung Tâm (Thương mại Mega Mall & Dịch vụ)
                [74.0, 40.0],  # 19. Đại siêu thị Mega Mall
                [90.0, 40.0],  # 20. Cây xăng đô thị (Petrol Station)
                [74.0, 60.0],  # 21. Dãy Shophouse Cafe & Bakery
                [90.0, 60.0],  # 22. Rạp chiếu phim Cineplex
                # Khối Tây Bắc (Đại Công Viên Sinh Thái & Thể Thao)
                [14.0, 78.0],  # 23. Mép hồ nước sinh thái công viên
                [26.0, 74.0],  # 24. Cầu vòm gỗ & bến thuyền đạp vịt
                [12.0, 90.0],  # 25. Cụm xích đu & cầu trượt trẻ em
                [26.0, 90.0],  # 26. Sân bóng rổ đô thị rào lưới
                # Khối Bắc Trung Tâm (Văn hóa, Bảo tàng & Nhà hát)
                [50.0, 76.0],  # 27. Nhà hát Lớn Opera House
                [38.0, 90.0],  # 28. Bảo tàng Khoa học & Lịch sử
                [62.0, 90.0],  # 29. Vườn bách thảo nhà kính Botanical
                # Khối Đông Bắc (Y tế, Cứu hỏa & Đại học)
                [74.0, 76.0],  # 30. Bệnh viện Đa Khoa Quốc Tế
                [90.0, 76.0],  # 31. Trạm cứu hỏa khẩn cấp Fire Station
                [74.0, 90.0],  # 32. Khu giảng đường Đại học Campus
                [90.0, 90.0],  # 33. Viện nghiên cứu khoa học & Thiên văn đài
                # Vật thể phụ trợ
                [34.0, 50.0],  # 34. Bến xe buýt trung tâm phía Tây
                [66.0, 50.0],  # 35. Bến xe buýt trung tâm phía Đông
            ],
            dtype=np.float32,
        )

        # Bán kính vật lý va chạm riêng biệt cho từng loại vật thể đô thị
        self.city_obstacle_radii = np.array(
            [
                3.6, 2.8, 2.8, 3.2,
                3.0, 3.2, 3.2,
                4.2, 3.8, 2.2, 2.8,
                3.8, 3.0, 3.2,
                3.2, 3.8, 3.8, 3.5, 3.0,
                4.2, 3.6, 3.4, 3.6,
                4.5, 2.6, 3.2, 3.4,
                4.0, 3.6, 3.4,
                4.2, 3.4, 4.0, 3.5,
                2.0, 2.0,
            ],
            dtype=np.float32,
        )

        # 6 vật thể gần nhất phục vụ vector quan sát gym 28 chiều
        self.num_obstacles = 6
        self.obstacles = self.city_obstacles[:6]

        # Không gian hành động vận tốc liên tục [vx, vz]
        self.action_space = spaces.Box(
            low=-self.max_speed,
            high=self.max_speed,
            shape=(2,),
            dtype=np.float32,
        )

        # Vector quan sát chuẩn gym (Agent 1): robot(2) + goal(2) + food(2) + water(2) + bed(2) + obstacles(12) + internal(6) = 28
        obs_dim = 2 + 2 + 2 + 2 + 2 + (self.num_obstacles * 2) + 6
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(obs_dim,),
            dtype=np.float32,
        )

        # Hệ thống nội tại độc lập cho từng bé
        self.energy_sys = EnergySystem(energy=800.0, energy_max=1000.0)      # Bé Bo
        self.energy_sys2 = EnergySystem(energy=820.0, energy_max=1000.0)     # Bé Bi

        self.drive_sys = DriveSystem()                                       # Bé Bo
        self.drive_sys2 = DriveSystem()                                      # Bé Bi

        self.episode_steps: int = 0
        self.max_episode_steps: int = 1000

        # Khởi tạo vị trí ngẫu nhiên không gần nhau cho hai bé ngay từ đầu trong đô thị 100x100
        self.spawn_random_agents(min_separation=22.0)

        # Hệ thống Phương tiện Giao thông Động đô thị 100x100 (Dynamic Traffic Vehicles)
        self.dynamic_vehicles = [
            {
                "id": "bus_1",
                "name": "Xe buýt điện xanh",
                "type": "bus",
                "pos": np.array([50.0, 10.0], dtype=np.float32),
                "dir": np.array([0.0, 1.0], dtype=np.float32),
                "speed": 2.8,
                "radius": 2.2,
                "axis": 1,  # 1 = z (Bắc - Nam trên đại lộ chính x=50)
                "min_bound": 8.0,
                "max_bound": 92.0,
                "yaw": 0.0,
                "color": "#2563eb",
            },
            {
                "id": "bus_2",
                "name": "Xe buýt đỏ 2 tầng",
                "type": "bus",
                "pos": np.array([10.0, 50.0], dtype=np.float32),
                "dir": np.array([1.0, 0.0], dtype=np.float32),
                "speed": 2.6,
                "radius": 2.2,
                "axis": 0,  # 0 = x (Đông - Tây trên đại lộ chính z=50)
                "min_bound": 8.0,
                "max_bound": 92.0,
                "yaw": 1.57,
                "color": "#dc2626",
            },
            {
                "id": "taxi_1",
                "name": "Taxi vàng Tây",
                "type": "taxi",
                "pos": np.array([22.0, 85.0], dtype=np.float32),
                "dir": np.array([0.0, -1.0], dtype=np.float32),
                "speed": 3.2,
                "radius": 1.6,
                "axis": 1,  # 1 = z (Dọc đại lộ Tây x=22)
                "min_bound": 8.0,
                "max_bound": 92.0,
                "yaw": 3.14,
                "color": "#eab308",
            },
            {
                "id": "taxi_2",
                "name": "Taxi vàng Đông",
                "type": "taxi",
                "pos": np.array([78.0, 15.0], dtype=np.float32),
                "dir": np.array([0.0, 1.0], dtype=np.float32),
                "speed": 3.2,
                "radius": 1.6,
                "axis": 1,  # 1 = z (Dọc đại lộ Đông x=78)
                "min_bound": 8.0,
                "max_bound": 92.0,
                "yaw": 0.0,
                "color": "#facc15",
            },
            {
                "id": "ambulance",
                "name": "Xe cấp cứu ưu tiên",
                "type": "ambulance",
                "pos": np.array([90.0, 78.0], dtype=np.float32),
                "dir": np.array([-1.0, 0.0], dtype=np.float32),
                "speed": 3.5,
                "radius": 1.9,
                "axis": 0,  # 0 = x (Dọc đại lộ Bắc z=78)
                "min_bound": 8.0,
                "max_bound": 92.0,
                "yaw": -1.57,
                "color": "#ffffff",
            },
            {
                "id": "van_1",
                "name": "Xe tải giao hàng nhanh",
                "type": "van",
                "pos": np.array([12.0, 22.0], dtype=np.float32),
                "dir": np.array([1.0, 0.0], dtype=np.float32),
                "speed": 2.4,
                "radius": 1.8,
                "axis": 0,  # 0 = x (Dọc đại lộ Nam z=22)
                "min_bound": 8.0,
                "max_bound": 92.0,
                "yaw": 1.57,
                "color": "#10b981",
            },
            {
                "id": "patrol_1",
                "name": "Robot tuần tra an ninh",
                "type": "patrol_bot",
                "pos": np.array([50.0, 36.0], dtype=np.float32),
                "dir": np.array([0.0, 1.0], dtype=np.float32),
                "speed": 1.8,
                "radius": 1.3,
                "axis": 1,  # 1 = z (Quanh quảng trường trung tâm x=50)
                "min_bound": 36.0,
                "max_bound": 64.0,
                "yaw": 0.0,
                "color": "#a855f7",
            },
        ]
        self.traffic_collision1: bool = False
        self.traffic_collision2: bool = False

    def update_dynamic_traffic(self, dt: float):
        """Cập nhật vị trí và góc quay của các phương tiện giao thông trên các đại lộ."""
        for v in self.dynamic_vehicles:
            pos = v["pos"]
            direction = v["dir"]
            speed = v["speed"]
            axis = v["axis"]
            pos[axis] += direction[axis] * speed * dt

            # Đổi hướng khi chạm mốc đại lộ
            if pos[axis] >= v["max_bound"]:
                pos[axis] = v["max_bound"]
                direction[axis] = -1.0
            elif pos[axis] <= v["min_bound"]:
                pos[axis] = v["min_bound"]
                direction[axis] = 1.0

            # Tính góc quay yaw theo hướng di chuyển
            v["yaw"] = float(np.arctan2(direction[0], direction[1]))

    def get_dynamic_vehicles(self) -> list:
        """Trả về danh sách dữ liệu xe cộ giao thông."""
        return [
            {
                "id": v["id"],
                "name": v["name"],
                "type": v["type"],
                "pos": [round(float(v["pos"][0]), 2), round(float(v["pos"][1]), 2)],
                "velocity": [
                    round(float(v["dir"][0] * v["speed"]), 2),
                    round(float(v["dir"][1] * v["speed"]), 2),
                ],
                "yaw": round(float(v["yaw"]), 2),
                "radius": float(v["radius"]),
                "color": v["color"],
            }
            for v in self.dynamic_vehicles
        ]

    def get_safe_random_pos(
        self,
        min_wall_dist: float = 3.5,
        min_obs_dist: float = 2.0,
        avoid_points: Optional[list] = None,
        min_avoid_dist: float = 5.0,
    ) -> np.ndarray:
        """
        Sinh tọa độ ngẫu nhiên an toàn trong bản đồ đô thị 60x60:
        - Cách tường biên ít nhất min_wall_dist.
        - Cách tất cả các tòa nhà, xe cộ, hồ bơi ít nhất min_obs_dist + radius.
        - Cách các điểm chỉ định (avoid_points) ít nhất min_avoid_dist.
        """
        if avoid_points is None:
            avoid_points = []

        for _ in range(350):
            rx = float(np.random.uniform(min_wall_dist, self.world_size - min_wall_dist))
            rz = float(np.random.uniform(min_wall_dist, self.world_size - min_wall_dist))
            candidate = np.array([rx, rz], dtype=np.float32)

            # Kiểm tra khoảng cách tới toàn bộ vật thể đô thị
            obs_safe = True
            for obs, rad in zip(self.city_obstacles, self.city_obstacle_radii):
                if float(np.linalg.norm(candidate - obs)) < (rad + min_obs_dist):
                    obs_safe = False
                    break
            if not obs_safe:
                continue

            # Kiểm tra khoảng cách tới các điểm cần tránh
            avoid_safe = True
            for pt in avoid_points:
                if pt is not None and float(np.linalg.norm(candidate - np.asarray(pt, dtype=np.float32))) < min_avoid_dist:
                    avoid_safe = False
                    break
            if not avoid_safe:
                continue

            return np.array([round(rx, 2), round(rz, 2)], dtype=np.float32)

        # Fallback an toàn nếu vùng quá đông
        return np.array([float(np.random.uniform(5.0, 55.0)), float(np.random.uniform(5.0, 55.0))], dtype=np.float32)

    def spawn_random_agents(self, min_separation: float = 14.0) -> Tuple[np.ndarray, np.ndarray]:
        """
        Sinh vị trí ngẫu nhiên cho Bé Bo và Bé Bi trong thành phố 60x60:
        - Đảm bảo an toàn không kẹt vào nhà cửa hay xe cộ.
        - Đảm bảo khoảng cách giữa 2 bé không gần nhau (>= min_separation m).
        """
        pos1 = self.get_safe_random_pos(min_wall_dist=4.0, min_obs_dist=2.2)
        pos2 = self.get_safe_random_pos(
            min_wall_dist=4.0,
            min_obs_dist=2.2,
            avoid_points=[pos1],
            min_avoid_dist=min_separation,
        )
        self.robot_pos = pos1
        self.robot2_pos = pos2
        return pos1, pos2

    def respawn_resource(self, resource_type: str) -> np.ndarray:
        """
        Khi tài nguyên cạn kiệt hoặc hết thời gian đồng hồ, di chuyển tài nguyên đến vị trí ngẫu nhiên mới:
        - Lưu vị trí cũ vào danh sách lịch sử vị trí đã cạn kiệt.
        - Đặt lại đồng hồ đếm ngược và làm đầy lại dung lượng tài nguyên về 100%.
        """
        if resource_type == "food":
            self.depleted_spots.append({
                "type": "food",
                "pos": self.food_pos.tolist(),
                "step": self.episode_steps,
            })
            if len(self.depleted_spots) > 20:
                self.depleted_spots.pop(0)

            # Sinh tọa độ mới cách vị trí cũ ít nhất 10.0m trong thành phố 60x60
            new_pos = self.get_safe_random_pos(
                min_wall_dist=4.0,
                min_obs_dist=2.5,
                avoid_points=[self.food_pos, self.water_pos, self.bed_pos, self.pool_pos, self.park_pos],
                min_avoid_dist=10.0,
            )
            self.food_pos = new_pos
            self.food_capacity = self.food_max_capacity
            self.food_step_timer = 0
            return new_pos

        elif resource_type == "water":
            self.depleted_spots.append({
                "type": "water",
                "pos": self.water_pos.tolist(),
                "step": self.episode_steps,
            })
            if len(self.depleted_spots) > 20:
                self.depleted_spots.pop(0)

            new_pos = self.get_safe_random_pos(
                min_wall_dist=4.0,
                min_obs_dist=2.5,
                avoid_points=[self.food_pos, self.water_pos, self.bed_pos, self.pool_pos, self.park_pos],
                min_avoid_dist=10.0,
            )
            self.water_pos = new_pos
            self.water_capacity = self.water_max_capacity
            self.water_step_timer = 0
            return new_pos

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        # Sinh vị trí ngẫu nhiên cho hai bé trong thành phố 60x60 (khoảng cách tối thiểu 14m)
        self.spawn_random_agents(min_separation=14.0)
        self.goal_pos = self.get_safe_random_pos(
            min_wall_dist=4.0,
            min_obs_dist=2.5,
            avoid_points=[self.robot_pos, self.robot2_pos, self.pool_pos],
            min_avoid_dist=8.0,
        )
        self.episode_steps = 0

        if not self.persist_internal:
            self.energy_sys = EnergySystem(energy=800.0, energy_max=1000.0)
            self.energy_sys2 = EnergySystem(energy=820.0, energy_max=1000.0)
            self.drive_sys = DriveSystem()
            self.drive_sys2 = DriveSystem()

        return self._get_obs(), self.get_info()

    def _get_obs(self) -> np.ndarray:
        internal_vec = np.array(
            [
                self.energy_sys.energy_ratio,
                self.drive_sys.drives["hunger"],
                self.drive_sys.drives["thirst"],
                self.drive_sys.drives["fatigue"],
                self.drive_sys.drives["pain"],
                self.drive_sys.drives["curiosity"],
            ],
            dtype=np.float32,
        )
        # Lựa chọn 6 vật thể đô thị gần nhất với Bé Bo để đưa vào vector nơ-ron 28 chiều
        dists = np.linalg.norm(self.city_obstacles - self.robot_pos, axis=1)
        closest_indices = np.argsort(dists)[:6]
        self.obstacles = self.city_obstacles[closest_indices]

        return np.concatenate(
            [
                self.robot_pos,
                self.goal_pos,
                self.food_pos,
                self.water_pos,
                self.bed_pos,
                self.obstacles.flatten(),
                internal_vec,
            ]
        ).astype(np.float32)

    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Hàm step đơn cho Agent 1 tương thích Gym PPO."""
        return self.step_dual(action1=action, action2=np.zeros(2, dtype=np.float32))

    def step_dual(
        self, action1: np.ndarray, action2: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """
        Thực hiện một bước đồng bộ cho cả hai bé:
        - Cập nhật tọa độ di chuyển.
        - Xử lý lực tránh va chạm đè lên nhau.
        - Cập nhật Năng lượng Kcal và Nhu cầu Drives (bao gồm Social / Loneliness).
        - Kiểm tra tương tác với môi trường và tương tác xã hội giữa hai bé.
        """
        self.episode_steps += 1

        # 1. Cập nhật di chuyển cho Bé 1 (Bo)
        act1 = np.clip(np.asarray(action1, dtype=np.float32), -self.max_speed, self.max_speed)
        alpha_m1 = self.energy_sys.alpha_motor
        eff_act1 = act1 * alpha_m1
        force_norm1 = float(np.linalg.norm(eff_act1) / self.max_speed)
        self.robot_pos = self.robot_pos + eff_act1 * self.dt
        self.robot_pos = np.clip(self.robot_pos, 0.5, self.world_size - 0.5)

        # 2. Cập nhật di chuyển cho Bé 2 (Bi)
        act2 = np.clip(np.asarray(action2, dtype=np.float32), -self.max_speed, self.max_speed)
        alpha_m2 = self.energy_sys2.alpha_motor
        eff_act2 = act2 * alpha_m2
        force_norm2 = float(np.linalg.norm(eff_act2) / self.max_speed)
        self.robot2_pos = self.robot2_pos + eff_act2 * self.dt
        self.robot2_pos = np.clip(self.robot2_pos, 0.5, self.world_size - 0.5)

        # 3. Tránh đè lên nhau (Soft Physical Separation)
        peer_vec = self.robot_pos - self.robot2_pos
        peer_dist = float(np.linalg.norm(peer_vec))
        min_personal_space = 0.65
        if peer_dist < min_personal_space and peer_dist > 0.001:
            push_dir = peer_vec / peer_dist
            overlap = (min_personal_space - peer_dist) * 0.5
            self.robot_pos += push_dir * overlap
            self.robot2_pos -= push_dir * overlap
            self.robot_pos = np.clip(self.robot_pos, 0.5, self.world_size - 0.5)
            self.robot2_pos = np.clip(self.robot2_pos, 0.5, self.world_size - 0.5)
            peer_dist = float(np.linalg.norm(self.robot_pos - self.robot2_pos))

        near_peer = peer_dist < 2.5

        # 4. Tương tác môi trường & Cạnh tranh tài nguyên
        dist_to_goal1 = float(np.linalg.norm(self.robot_pos - self.goal_pos))
        dist_to_food1 = float(np.linalg.norm(self.robot_pos - self.food_pos))
        dist_to_water1 = float(np.linalg.norm(self.robot_pos - self.water_pos))
        dist_to_bed1 = float(np.linalg.norm(self.robot_pos - self.bed_pos))

        dist_to_goal2 = float(np.linalg.norm(self.robot2_pos - self.goal_pos))
        dist_to_food2 = float(np.linalg.norm(self.robot2_pos - self.food_pos))
        dist_to_water2 = float(np.linalg.norm(self.robot2_pos - self.water_pos))
        dist_to_bed2 = float(np.linalg.norm(self.robot2_pos - self.bed_pos))

        # Vật lý va chạm thực tế với toàn bộ kiến trúc & xe cộ thành phố (City Physical Collisions)
        collided1 = False
        hazard_prox1 = 0.0
        for obs, rad in zip(self.city_obstacles, self.city_obstacle_radii):
            diff = self.robot_pos - obs
            dist = float(np.linalg.norm(diff))
            thresh = self.robot_radius + rad
            if dist < thresh:
                collided1 = True
                if dist > 0.001:
                    normal = diff / dist
                    self.robot_pos = obs + normal * (thresh + 0.12)
                    self.robot_pos = np.clip(self.robot_pos, 1.2, self.world_size - 1.2)
            if dist < (thresh + 2.5):
                hazard_prox1 = max(hazard_prox1, (thresh + 2.5 - dist) / 2.5)

        # Kiểm tra va chạm với 4 bức tường biên thành phố 60x60 cho Bé Bo
        wall_thresh = 0.9
        if self.robot_pos[0] < wall_thresh:
            collided1 = True
            hazard_prox1 = 1.0
            self.robot_pos[0] = 1.25
        elif self.robot_pos[0] > (self.world_size - wall_thresh):
            collided1 = True
            hazard_prox1 = 1.0
            self.robot_pos[0] = self.world_size - 1.25

        if self.robot_pos[1] < wall_thresh:
            collided1 = True
            hazard_prox1 = 1.0
            self.robot_pos[1] = 1.25
        elif self.robot_pos[1] > (self.world_size - wall_thresh):
            collided1 = True
            hazard_prox1 = 1.0
            self.robot_pos[1] = self.world_size - 1.25

        collided2 = False
        hazard_prox2 = 0.0
        for obs, rad in zip(self.city_obstacles, self.city_obstacle_radii):
            diff = self.robot2_pos - obs
            dist = float(np.linalg.norm(diff))
            thresh = self.robot_radius + rad
            if dist < thresh:
                collided2 = True
                if dist > 0.001:
                    normal = diff / dist
                    self.robot2_pos = obs + normal * (thresh + 0.12)
                    self.robot2_pos = np.clip(self.robot2_pos, 1.2, self.world_size - 1.2)
            if dist < (thresh + 2.5):
                hazard_prox2 = max(hazard_prox2, (thresh + 2.5 - dist) / 2.5)

        # Kiểm tra va chạm với 4 bức tường biên thành phố 60x60 cho Bé Bi
        if self.robot2_pos[0] < wall_thresh:
            collided2 = True
            hazard_prox2 = 1.0
            self.robot2_pos[0] = 1.25
        elif self.robot2_pos[0] > (self.world_size - wall_thresh):
            collided2 = True
            hazard_prox2 = 1.0
            self.robot2_pos[0] = self.world_size - 1.25

        if self.robot2_pos[1] < wall_thresh:
            collided2 = True
            hazard_prox2 = 1.0
            self.robot2_pos[1] = 1.25
        elif self.robot2_pos[1] > (self.world_size - wall_thresh):
            collided2 = True
            hazard_prox2 = 1.0
            self.robot2_pos[1] = self.world_size - 1.25

        # Cập nhật và kiểm tra va chạm xe cộ đô thị di chuyển (Dynamic Traffic)
        self.update_dynamic_traffic(self.dt)
        traffic_collision1 = False
        for v in self.dynamic_vehicles:
            diff_v = self.robot_pos - v["pos"]
            dist_v = float(np.linalg.norm(diff_v))
            thresh_v = self.robot_radius + v["radius"]
            if dist_v < thresh_v:
                collided1 = True
                traffic_collision1 = True
                if dist_v > 0.001:
                    norm_v = diff_v / dist_v
                    self.robot_pos = v["pos"] + norm_v * (thresh_v + 0.35)
                    self.robot_pos = np.clip(self.robot_pos, 1.2, self.world_size - 1.2)
                self.energy_sys.burn(kcal=25.0)
                self.drive_sys.drives["pain"] = 1.0

        traffic_collision2 = False
        for v in self.dynamic_vehicles:
            diff_v = self.robot2_pos - v["pos"]
            dist_v = float(np.linalg.norm(diff_v))
            thresh_v = self.robot_radius + v["radius"]
            if dist_v < thresh_v:
                collided2 = True
                traffic_collision2 = True
                if dist_v > 0.001:
                    norm_v = diff_v / dist_v
                    self.robot2_pos = v["pos"] + norm_v * (thresh_v + 0.35)
                    self.robot2_pos = np.clip(self.robot2_pos, 1.2, self.world_size - 1.2)
                self.energy_sys2.burn(kcal=25.0)
                self.drive_sys2.drives["pain"] = 1.0

        self.traffic_collision1 = traffic_collision1
        self.traffic_collision2 = traffic_collision2

        # Giảm bộ đếm hồi chiêu ăn uống giữa các khẩu phần (tránh cạn kiệt trong 0.2s)
        if self.agent1_eat_cooldown > 0:
            self.agent1_eat_cooldown -= 1
        if self.agent1_drink_cooldown > 0:
            self.agent1_drink_cooldown -= 1
        if self.agent2_eat_cooldown > 0:
            self.agent2_eat_cooldown -= 1
        if self.agent2_drink_cooldown > 0:
            self.agent2_drink_cooldown -= 1

        # CUỘC ĐUA TRANH GIÀNH THỨC ĂN (FOOD RACE CONTEST)
        ate_food1 = False
        ate_food2 = False
        won_food_race1 = False
        won_food_race2 = False
        lost_food_race1 = False
        lost_food_race2 = False

        in_food_zone1 = dist_to_food1 < self.zone_radius and self.food_capacity > 0
        in_food_zone2 = dist_to_food2 < self.zone_radius and self.food_capacity > 0

        if in_food_zone1 and in_food_zone2:
            # Hai bé cùng tới Bếp ăn một lúc -> Cuộc đua nước rút! Ai gần hơn dù chỉ 1mm sẽ giành chiến thắng
            if dist_to_food1 <= dist_to_food2:
                if self.agent1_eat_cooldown == 0:
                    self.race_stats["total_contests"] += 1
                    self.agent1_eat_cooldown = self.bite_cooldown_steps
                    portion = min(self.food_capacity, self.portion_capacity)
                    self.food_capacity = max(0.0, self.food_capacity - portion)
                    self.energy_sys.eat(kcal=35.0)
                    ate_food1 = True
                    won_food_race1 = True
                    lost_food_race2 = True
                    self.race_stats["bo_wins"] += 1
                    self.race_stats["bo_food_wins"] += 1
                    self.race_stats["last_winner"] = "bo"
                    self.food_step_timer = max(0, self.food_step_timer - 300)
            else:
                if self.agent2_eat_cooldown == 0:
                    self.race_stats["total_contests"] += 1
                    self.agent2_eat_cooldown = self.bite_cooldown_steps
                    portion = min(self.food_capacity, self.portion_capacity)
                    self.food_capacity = max(0.0, self.food_capacity - portion)
                    self.energy_sys2.eat(kcal=35.0)
                    ate_food2 = True
                    won_food_race2 = True
                    lost_food_race1 = True
                    self.race_stats["bi_wins"] += 1
                    self.race_stats["bi_food_wins"] += 1
                    self.race_stats["last_winner"] = "bi"
                    self.food_step_timer = max(0, self.food_step_timer - 300)
        elif in_food_zone1:
            if self.agent1_eat_cooldown == 0:
                self.agent1_eat_cooldown = self.bite_cooldown_steps
                portion = min(self.food_capacity, self.portion_capacity)
                self.food_capacity = max(0.0, self.food_capacity - portion)
                self.energy_sys.eat(kcal=25.0)
                ate_food1 = True
                self.food_step_timer = max(0, self.food_step_timer - 300)
                if dist_to_food2 < 6.0:  # Bé Bi cũng đang phi tới nhưng bị Bo nẫng tay trên
                    self.race_stats["total_contests"] += 1
                    self.race_stats["bo_wins"] += 1
                    self.race_stats["bo_food_wins"] += 1
                    self.race_stats["last_winner"] = "bo"
                    won_food_race1 = True
                    lost_food_race2 = True
        elif in_food_zone2:
            if self.agent2_eat_cooldown == 0:
                self.agent2_eat_cooldown = self.bite_cooldown_steps
                portion = min(self.food_capacity, self.portion_capacity)
                self.food_capacity = max(0.0, self.food_capacity - portion)
                self.energy_sys2.eat(kcal=25.0)
                ate_food2 = True
                self.food_step_timer = max(0, self.food_step_timer - 300)
                if dist_to_food1 < 6.0:  # Bé Bo cũng đang phi tới nhưng bị Bi nẫng tay trên
                    self.race_stats["total_contests"] += 1
                    self.race_stats["bi_wins"] += 1
                    self.race_stats["bi_food_wins"] += 1
                    self.race_stats["last_winner"] = "bi"
                    won_food_race2 = True
                    lost_food_race1 = True

        # CUỘC ĐUA TRANH GIÀNH VÒI NƯỚC (WATER RACE CONTEST)
        drank_water1 = False
        drank_water2 = False
        won_water_race1 = False
        won_water_race2 = False
        lost_water_race1 = False
        lost_water_race2 = False

        in_water_zone1 = dist_to_water1 < self.zone_radius and self.water_capacity > 0
        in_water_zone2 = dist_to_water2 < self.zone_radius and self.water_capacity > 0

        if in_water_zone1 and in_water_zone2:
            if dist_to_water1 <= dist_to_water2:
                if self.agent1_drink_cooldown == 0:
                    self.race_stats["total_contests"] += 1
                    self.agent1_drink_cooldown = self.bite_cooldown_steps
                    portion = min(self.water_capacity, self.portion_capacity)
                    self.water_capacity = max(0.0, self.water_capacity - portion)
                    drank_water1 = True
                    won_water_race1 = True
                    lost_water_race2 = True
                    self.race_stats["bo_wins"] += 1
                    self.race_stats["bo_water_wins"] += 1
                    self.race_stats["last_winner"] = "bo"
                    self.water_step_timer = max(0, self.water_step_timer - 300)
            else:
                if self.agent2_drink_cooldown == 0:
                    self.race_stats["total_contests"] += 1
                    self.agent2_drink_cooldown = self.bite_cooldown_steps
                    portion = min(self.water_capacity, self.portion_capacity)
                    self.water_capacity = max(0.0, self.water_capacity - portion)
                    drank_water2 = True
                    won_water_race2 = True
                    lost_water_race1 = True
                    self.race_stats["bi_wins"] += 1
                    self.race_stats["bi_water_wins"] += 1
                    self.race_stats["last_winner"] = "bi"
                    self.water_step_timer = max(0, self.water_step_timer - 300)
        elif in_water_zone1:
            if self.agent1_drink_cooldown == 0:
                self.agent1_drink_cooldown = self.bite_cooldown_steps
                portion = min(self.water_capacity, self.portion_capacity)
                self.water_capacity = max(0.0, self.water_capacity - portion)
                drank_water1 = True
                self.water_step_timer = max(0, self.water_step_timer - 300)
                if dist_to_water2 < 6.0:
                    self.race_stats["total_contests"] += 1
                    self.race_stats["bo_wins"] += 1
                    self.race_stats["bo_water_wins"] += 1
                    self.race_stats["last_winner"] = "bo"
                    won_water_race1 = True
                    lost_water_race2 = True
        elif in_water_zone2:
            if self.agent2_drink_cooldown == 0:
                self.agent2_drink_cooldown = self.bite_cooldown_steps
                portion = min(self.water_capacity, self.portion_capacity)
                self.water_capacity = max(0.0, self.water_capacity - portion)
                drank_water2 = True
                self.water_step_timer = max(0, self.water_step_timer - 300)
                if dist_to_water1 < 6.0:
                    self.race_stats["total_contests"] += 1
                    self.race_stats["bi_wins"] += 1
                    self.race_stats["bi_water_wins"] += 1
                    self.race_stats["last_winner"] = "bi"
                    won_water_race2 = True
                    lost_water_race1 = True

        is_resting1 = dist_to_bed1 < (self.zone_radius + 0.2) and force_norm1 < 0.25
        is_resting2 = dist_to_bed2 < (self.zone_radius + 0.2) and force_norm2 < 0.25

        # TIẾN TRÌNH CHU KỲ NGÀY / ĐÊM ĐÔ THỊ (DAY/NIGHT ADVANCEMENT)
        time_delta_hours = (24.0 / self.day_cycle_duration_seconds) * self.dt
        self.time_of_day = round(float((self.time_of_day + time_delta_hours) % 24.0), 3)

        is_night = bool(self.time_of_day >= 19.5 or self.time_of_day < 5.0)
        if 5.0 <= self.time_of_day < 7.0:
            day_phase = "dawn"
        elif 7.0 <= self.time_of_day < 17.5:
            day_phase = "day"
        elif 17.5 <= self.time_of_day < 19.5:
            day_phase = "sunset"
        else:
            day_phase = "night"

        # CẬP NHẬT ĐỒNG HỒ ĐẾM NGƯỢC THỜI GIAN CHO TÀI NGUYÊN (COUNTDOWN TIMERS)
        self.food_step_timer += 1
        self.water_step_timer += 1
        food_respawned = False
        water_respawned = False

        if self.food_capacity <= 0.0 or self.food_step_timer >= self.food_lifetime_steps:
            self.respawn_resource("food")
            food_respawned = True

        if self.water_capacity <= 0.0 or self.water_step_timer >= self.water_lifetime_steps:
            self.respawn_resource("water")
            water_respawned = True

        # 6. Cập nhật Năng lượng Kcal cho cả hai bé
        self.energy_sys.step(
            dt=self.dt,
            motor_force_norm=force_norm1,
            cognitive_load=0.15,
            stress_level=self.drive_sys.drives["fear"],
            is_resting=is_resting1,
        )
        self.energy_sys2.step(
            dt=self.dt,
            motor_force_norm=force_norm2,
            cognitive_load=0.15,
            stress_level=self.drive_sys2.drives["fear"],
            is_resting=is_resting2,
        )

        # 7. Cập nhật Nhu cầu Drives
        events1 = {
            "collided": collided1,
            "hazard_proximity": hazard_prox1,
            "ate_food": ate_food1,
            "drank_water": drank_water1,
            "is_resting": is_resting1,
            "near_peer": near_peer,
            "peer_in_pain": collided2,
            "won_race": won_food_race1 or won_water_race1,
            "lost_race": lost_food_race1 or lost_water_race1,
            "is_night": is_night,
            "time_of_day": self.time_of_day,
        }
        events2 = {
            "collided": collided2,
            "hazard_proximity": hazard_prox2,
            "ate_food": ate_food2,
            "drank_water": drank_water2,
            "is_resting": is_resting2,
            "near_peer": near_peer,
            "peer_in_pain": collided1,
            "won_race": won_food_race2 or won_water_race2,
            "lost_race": lost_food_race2 or lost_water_race2,
            "is_night": is_night,
            "time_of_day": self.time_of_day,
        }

        self.drive_sys.step(dt=self.dt, energy_sys=self.energy_sys, events=events1)
        self.drive_sys2.step(dt=self.dt, energy_sys=self.energy_sys2, events=events2)

        # ĐIỂM THƯỞNG HỌC TĂNG CƯỜNG HƯỚNG TỚI PHÁT TRIỂN NỘI TẠI & TỰ LẬP (DEVELOPMENTAL SHAPING)
        reward = -0.04 - (dist_to_goal1 / self.world_size) * 0.08 - 0.015 * force_norm1
        terminated = False
        if ate_food1 and self.drive_sys.drives["hunger"] > 0.25:
            reward += 6.0
        if drank_water1 and self.drive_sys.drives["thirst"] > 0.25:
            reward += 5.0
        if is_resting1 and self.drive_sys.drives["fatigue"] > 0.4:
            reward += 3.5
        if near_peer:
            reward += 1.5  # Thưởng gắn kết bạn bè và giao tiếp xã hội tích cực

        if collided1:
            reward -= 45.0
            terminated = bool(getattr(self, "is_gym_training", False))
        elif dist_to_goal1 < self.goal_radius:
            reward += 100.0
            terminated = True

        truncated = self.episode_steps >= self.max_episode_steps

        # Tính thời gian đếm ngược còn lại (giây)
        food_time_left = max(0.0, round((self.food_lifetime_steps - self.food_step_timer) * self.dt, 1))
        water_time_left = max(0.0, round((self.water_lifetime_steps - self.water_step_timer) * self.dt, 1))
        food_max_time = round(self.food_lifetime_steps * self.dt, 1)
        water_max_time = round(self.water_lifetime_steps * self.dt, 1)

        info = self.get_info(
            dist_to_goal1=dist_to_goal1,
            collided1=collided1,
            ate_food1=ate_food1,
            drank_water1=drank_water1,
            is_resting1=is_resting1,
            collided2=collided2,
            ate_food2=ate_food2,
            drank_water2=drank_water2,
            is_resting2=is_resting2,
            peer_dist=peer_dist,
            near_peer=near_peer,
            food_respawned=food_respawned,
            water_respawned=water_respawned,
            food_time_left=food_time_left,
            water_time_left=water_time_left,
            food_max_time=food_max_time,
            water_max_time=water_max_time,
            won_food_race1=won_food_race1,
            won_food_race2=won_food_race2,
            won_water_race1=won_water_race1,
            won_water_race2=won_water_race2,
        )

        return self._get_obs(), float(reward), terminated, truncated, info

    def get_info(
        self,
        dist_to_goal1: Optional[float] = None,
        collided1: bool = False,
        ate_food1: bool = False,
        drank_water1: bool = False,
        is_resting1: bool = False,
        collided2: bool = False,
        ate_food2: bool = False,
        drank_water2: bool = False,
        is_resting2: bool = False,
        peer_dist: Optional[float] = None,
        near_peer: Optional[bool] = None,
        food_respawned: bool = False,
        water_respawned: bool = False,
        food_time_left: Optional[float] = None,
        water_time_left: Optional[float] = None,
        food_max_time: Optional[float] = None,
        water_max_time: Optional[float] = None,
        won_food_race1: bool = False,
        won_food_race2: bool = False,
        won_water_race1: bool = False,
        won_water_race2: bool = False,
    ) -> Dict[str, Any]:
        if dist_to_goal1 is None:
            dist_to_goal1 = float(np.linalg.norm(self.robot_pos - self.goal_pos))
        if peer_dist is None:
            peer_dist = float(np.linalg.norm(self.robot_pos - self.robot2_pos))
        if near_peer is None:
            near_peer = peer_dist < 3.5

        if food_time_left is None:
            food_time_left = max(0.0, round((self.food_lifetime_steps - self.food_step_timer) * self.dt, 1))
        if water_time_left is None:
            water_time_left = max(0.0, round((self.water_lifetime_steps - self.water_step_timer) * self.dt, 1))
        if food_max_time is None:
            food_max_time = round(self.food_lifetime_steps * self.dt, 1)
        if water_max_time is None:
            water_max_time = round(self.water_lifetime_steps * self.dt, 1)

        is_racing = (
            float(np.linalg.norm(self.robot_pos - self.food_pos)) < 10.0
            and float(np.linalg.norm(self.robot2_pos - self.food_pos)) < 10.0
        ) or (
            float(np.linalg.norm(self.robot_pos - self.water_pos)) < 10.0
            and float(np.linalg.norm(self.robot2_pos - self.water_pos)) < 10.0
        )

        return {
            "dist_to_goal": float(dist_to_goal1),
            "collided": bool(collided1),
            "ate_food": bool(ate_food1),
            "drank_water": bool(drank_water1),
            "is_resting": bool(is_resting1),
            "robot": self.robot_pos.tolist(),
            "robot2": self.robot2_pos.tolist(),
            "peer_dist": round(float(peer_dist), 2),
            "near_peer": bool(near_peer),
            "collided2": bool(collided2),
            "ate_food2": bool(ate_food2),
            "drank_water2": bool(drank_water2),
            "is_resting2": bool(is_resting2),
            "goal": self.goal_pos.tolist(),
            "food": self.food_pos.tolist(),
            "water": self.water_pos.tolist(),
            "bed": self.bed_pos.tolist(),
            "play": self.play_pos.tolist(),
            "pool": self.pool_pos.tolist(),
            "park": self.park_pos.tolist(),
            "obstacles": self.city_obstacles.tolist(),
            "city_obstacles": self.city_obstacles.tolist(),
            "city_obstacle_radii": self.city_obstacle_radii.tolist(),
            "world_size": self.world_size,
            "food_capacity": round(float(self.food_capacity), 1),
            "water_capacity": round(float(self.water_capacity), 1),
            "food_time_left": float(food_time_left),
            "water_time_left": float(water_time_left),
            "food_max_time": float(food_max_time),
            "water_max_time": float(water_max_time),
            "food_respawned": bool(food_respawned),
            "water_respawned": bool(water_respawned),
            "depleted_spots": list(self.depleted_spots),
            "race_stats": dict(self.race_stats),
            "is_racing": bool(is_racing),
            "time_of_day": round(float(self.time_of_day), 2),
            "is_night": bool(self.time_of_day >= 19.5 or self.time_of_day < 5.0),
            "day_phase": (
                "dawn" if 5.0 <= self.time_of_day < 7.0
                else "day" if 7.0 <= self.time_of_day < 17.5
                else "sunset" if 17.5 <= self.time_of_day < 19.5
                else "night"
            ),
            "won_food_race1": bool(won_food_race1),
            "won_food_race2": bool(won_food_race2),
            "won_water_race1": bool(won_water_race1),
            "won_water_race2": bool(won_water_race2),
            "energy_state": self.energy_sys.to_dict(),
            "energy_state2": self.energy_sys2.to_dict(),
            "drives_state": self.drive_sys.to_dict(),
            "drives_state2": self.drive_sys2.to_dict(),
            "dynamic_vehicles": self.get_dynamic_vehicles(),
            "traffic_collision1": bool(getattr(self, "traffic_collision1", False)),
            "traffic_collision2": bool(getattr(self, "traffic_collision2", False)),
        }

    def export_state(self) -> Dict[str, Any]:
        return {
            "robot": self.robot_pos.tolist(),
            "robot2": self.robot2_pos.tolist(),
            "goal": self.goal_pos.tolist(),
            "food": self.food_pos.tolist(),
            "water": self.water_pos.tolist(),
            "bed": self.bed_pos.tolist(),
            "obstacles": self.obstacles.tolist(),
            "world_size": self.world_size,
            "time_of_day": self.time_of_day,
            "food_capacity": self.food_capacity,
            "water_capacity": self.water_capacity,
            "depleted_spots": self.depleted_spots,
            "energy_state": self.energy_sys.to_dict(),
            "energy_state2": self.energy_sys2.to_dict(),
            "drives_state": self.drive_sys.to_dict(),
            "drives_state2": self.drive_sys2.to_dict(),
            "dynamic_vehicles": self.get_dynamic_vehicles(),
            "traffic_collision1": bool(getattr(self, "traffic_collision1", False)),
            "traffic_collision2": bool(getattr(self, "traffic_collision2", False)),
        }

    def import_state(self, state: Dict[str, Any]) -> None:
        if not state:
            return
        # Luôn đảm bảo thế giới đô thị là 100x100m
        self.world_size = 100.0
        if "robot" in state and len(state["robot"]) == 2:
            r_pos = np.array(state["robot"], dtype=np.float32)
            if 0.5 <= r_pos[0] <= 99.5 and 0.5 <= r_pos[1] <= 99.5:
                self.robot_pos = r_pos
        if "robot2" in state and len(state["robot2"]) == 2:
            r2_pos = np.array(state["robot2"], dtype=np.float32)
            if 0.5 <= r2_pos[0] <= 99.5 and 0.5 <= r2_pos[1] <= 99.5:
                self.robot2_pos = r2_pos
        if "goal" in state and len(state["goal"]) == 2:
            self.goal_pos = np.array(state["goal"], dtype=np.float32)
        if "food" in state and len(state["food"]) == 2 and float(state.get("world_size", 100.0)) >= 100.0:
            self.food_pos = np.array(state["food"], dtype=np.float32)
        if "water" in state and len(state["water"]) == 2 and float(state.get("world_size", 100.0)) >= 100.0:
            self.water_pos = np.array(state["water"], dtype=np.float32)
        if "time_of_day" in state:
            self.time_of_day = float(state["time_of_day"])
        if "food_capacity" in state:
            self.food_capacity = float(state["food_capacity"])
        if "water_capacity" in state:
            self.water_capacity = float(state["water_capacity"])
        if "depleted_spots" in state:
            self.depleted_spots = list(state["depleted_spots"])
        if "energy_state" in state:
            self.energy_sys.load_dict(state["energy_state"])
        if "energy_state2" in state:
            self.energy_sys2.load_dict(state["energy_state2"])
        if "drives_state" in state:
            self.drive_sys.load_dict(state["drives_state"])
        if "drives_state2" in state:
            self.drive_sys2.load_dict(state["drives_state2"])
