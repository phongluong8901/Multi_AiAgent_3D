import numpy as np
import time
from typing import Dict, Any, List, Optional, Tuple


class SpatialMemoryMap:
    """
    Ban do Nhan thuc Khong gian & Ky uc Su kien (Episodic Spatial Belief Map).
    Mo phong co che nao bo tre em theo thuyet Tabula Rasa:
    - Bat dau tu con so 0: Khong biet truoc vi tri bep an, giuong ngu hay lo lua.
    - Suong mu nhan thuc (Fog of War): Khai pha tung met vuong tren ban do 100x100.
    - Ban do nguy hiem (Danger / Trauma Map): Khi va cham lo lua hoac xe co, ghi dau vet seo tam ly.
    - Phat hien tai nguyen (Resource Discovery): Ghi nhan vi tri thuc an, nuoc uong khi den gan (Aha! Moment).
    - Dong luc to mo noi tai (Intrinsic Curiosity): Thuong them diem khi buoc vao vung dat chua tung den.
    - Nhat ky ky uc su kien (Episodic Memories): Luu lai 30 ky uc quan trong nhat trong ngay.
    """

    def __init__(self, grid_size: int = 100):
        """
        Khoi tao luoi nhan thuc khong gian voi kich thuoc grid_size x grid_size.

        Args:
            grid_size (int): Kich thuoc ma tran luoi (mac dinh 100 cho the gioi 100x100m).
        """
        self.grid_size = grid_size
        # 0.0 = Suong mu chua biet gi, 1.0 = Da kham pha thong thao
        self.exploration_grid = np.zeros((grid_size, grid_size), dtype=np.float32)
        # 0.0 = An toan, 1.0 = Vung nguy hiem tung va cham (lo lua, xe co)
        self.danger_grid = np.zeros((grid_size, grid_size), dtype=np.float32)

        # Tri nho ve cac diem tai nguyen (Chi duoc danh dau sau khi tu tim ra)
        self.discovered_resources: Dict[str, Dict[str, Any]] = {
            "food": {"discovered": False, "pos": None, "name": "Bếp ăn & Nhà hàng"},
            "water": {"discovered": False, "pos": None, "name": "Vòi nước mát bên hồ bơi"},
            "bed": {"discovered": False, "pos": None, "name": "Giường ngủ Villa"},
            "play": {"discovered": False, "pos": None, "name": "Sân chơi công viên"},
            "pool": {"discovered": False, "pos": None, "name": "Khu hồ bơi xanh mát"},
            "park": {"discovered": False, "pos": None, "name": "Công viên cây xanh"},
        }

        # Danh muc toan bo cac vi tri tai nguyen tung xuat hien (active hoac depleted)
        self.discovered_history: List[Dict[str, Any]] = []

        # Nhat ky ky uc su kien quan trong (Episodic Memories)
        self.episodic_memories: List[Dict[str, Any]] = []
        self.max_memories: int = 30

    def reset(self) -> None:
        """Dat lai toan bo tri nho khong gian va ky uc su kien ve con so 0 (Tabula Rasa)."""
        self.exploration_grid.fill(0.0)
        self.danger_grid.fill(0.0)
        for k in self.discovered_resources:
            self.discovered_resources[k]["discovered"] = False
            self.discovered_resources[k]["pos"] = None
        self.discovered_history.clear()
        self.episodic_memories.clear()
        self.add_memory(
            event_type="birth",
            text="Bắt đầu cuộc đời từ con số 0: Chưa biết gì về thế giới xung quanh.",
            importance=1.0,
        )

    def add_memory(self, event_type: str, text: str, importance: float = 0.5) -> None:
        """
        Luu mot ky uc su kien dang nho vao nhat ky nao bo cua be.

        Args:
            event_type (str): Loai su kien ('discovery', 'danger', 'social', 'feedback', 'milestone').
            text (str): Noi dung mieu ta su kien.
            importance (float): Do quan trong cua ky uc [0.0, 1.0].
        """
        memory_item = {
            "id": int(time.time() * 1000) % 1_000_000,
            "time": time.strftime("%H:%M:%S"),
            "type": event_type,
            "text": text,
            "importance": round(float(importance), 2),
        }
        self.episodic_memories.insert(0, memory_item)
        if len(self.episodic_memories) > self.max_memories:
            self.episodic_memories.pop()

    def update_exploration(self, robot_pos: np.ndarray, radius: float = 2.4) -> float:
        """
        Cap nhat suong mu nhan thuc quanh toa do vi tri cua be.

        Args:
            robot_pos (np.ndarray): Toa do [x, z] hien tai cua robot.
            radius (float): Ban kinh quan sat cua be (met), mac dinh 2.4m.

        Returns:
            float: Intrinsic Curiosity Bonus (diem thuong to mo neu kham pha ra vung dat moi).
        """
        rx, rz = robot_pos[0], robot_pos[1]
        gx = int(np.clip(rx, 0, self.grid_size - 1))
        gz = int(np.clip(rz, 0, self.grid_size - 1))

        # Tinh toan do moi la cua o hien tai
        prev_visited = self.exploration_grid[gx, gz]
        curiosity_reward = max(0.0, float(1.0 - prev_visited)) * 2.5

        # Lan toa tam nhin quang hoc quanh be
        min_x = max(0, int(rx - radius))
        max_x = min(self.grid_size, int(rx + radius + 1))
        min_z = max(0, int(rz - radius))
        max_z = min(self.grid_size, int(rz + radius + 1))

        for x in range(min_x, max_x):
            for z in range(min_z, max_z):
                dist = np.hypot(x - rx, z - rz)
                if dist <= radius:
                    intensity = 1.0 - (dist / radius) * 0.4
                    self.exploration_grid[x, z] = min(
                        1.0, self.exploration_grid[x, z] + intensity * 0.4
                    )

        # Phai mo nhe cac vet seo nguy hiem theo thoi gian (Forgetting curve)
        self.danger_grid *= 0.9995

        return curiosity_reward

    def record_hazard_collision(self, robot_pos: np.ndarray, hazard_name: str = "Lò lửa") -> None:
        """
        Ghi nhan vet seo tam ly khi be bi va cham dau hoac bi phong nong.

        Args:
            robot_pos (np.ndarray): Toa do [x, z] noi xay ra tai nan.
            hazard_name (str): Ten loai vat can nguy hiem.
        """
        rx, rz = robot_pos[0], robot_pos[1]
        radius = 2.0
        min_x = max(0, int(rx - radius))
        max_x = min(self.grid_size, int(rx + radius + 1))
        min_z = max(0, int(rz - radius))
        max_z = min(self.grid_size, int(rz + radius + 1))

        for x in range(min_x, max_x):
            for z in range(min_z, max_z):
                dist = np.hypot(x - rx, z - rz)
                if dist <= radius:
                    weight = 1.0 - (dist / radius) * 0.3
                    self.danger_grid[x, z] = min(1.0, self.danger_grid[x, z] + weight * 0.9)

        self.add_memory(
            event_type="danger",
            text=f"Va chạm đau tại [{rx:.1f}, {rz:.1f}]! Đã ghi nhớ vùng này là nguy hiểm ({hazard_name}).",
            importance=0.95,
        )

    def check_and_discover_resource(
        self, resource_type: str, actual_pos: np.ndarray, robot_pos: np.ndarray
    ) -> bool:
        """
        Kiem tra neu be tien du gan mot tai nguyen chua biet -> Kich hoat phat hien moi (Aha! Moment).

        Args:
            resource_type (str): Loai tai nguyen ('food', 'water', 'bed',...).
            actual_pos (np.ndarray): Toa do thuc te cua tai nguyen trong moi truong.
            robot_pos (np.ndarray): Toa do hien tai cua robot.

        Returns:
            bool: True neu vua phat hien moi hoac cap nhat thanh cong.
        """
        return self.check_resource_status(resource_type, actual_pos, robot_pos, capacity=100.0)

    def check_resource_status(
        self,
        resource_type: str,
        actual_pos: np.ndarray,
        robot_pos: np.ndarray,
        capacity: float = 100.0,
    ) -> bool:
        """
        Kiem tra tinh hop le cua nguon tai nguyen:
        - Neu be den vi tri cu ma tai nguyen da doi cho khac (> 2.0m) hoac can kiet:
          Danh dau can kiet (depleted) va kich hoat thám hiem tim nguon moi.
        - Neu be den gan vi tri thuc te moi cua tai nguyen:
          Ghi nhan phat hien moi (Aha! Moment) va luu vao lich su.

        Args:
            resource_type (str): Loai tai nguyen ('food', 'water',...).
            actual_pos (np.ndarray): Toa do thuc te hien tai trong moi truong.
            robot_pos (np.ndarray): Toa do hien tai cua robot.
            capacity (float): Dung luong con lai cua tai nguyen.

        Returns:
            bool: True neu co su thay doi trang thai nhan thuc tai nguyen.
        """
        res = self.discovered_resources.get(resource_type)
        if not res:
            return False

        # 1. Kiem tra vi tri tai nguyen cu be dang ghi nho trong dau
        if res["discovered"] and res["pos"] is not None:
            remembered_pos = np.array(res["pos"], dtype=np.float32)
            dist_to_remembered = float(np.linalg.norm(robot_pos - remembered_pos))

            # Neu be da di toi vi tri cu ma tai nguyen thuc te da chuyen di hoac can kiet
            dist_actual_to_remembered = float(np.linalg.norm(actual_pos - remembered_pos))
            if dist_to_remembered < 1.8 and (dist_actual_to_remembered > 2.0 or capacity <= 0.0):
                # Cap nhat trang thai trong lich su
                for item in self.discovered_history:
                    if item.get("type") == resource_type and item.get("status") == "active":
                        if float(np.linalg.norm(np.array(item["pos"]) - remembered_pos)) < 1.5:
                            item["status"] = "depleted"

                res["discovered"] = False
                res["pos"] = None
                self.add_memory(
                    event_type="discovery",
                    text=f"Ơ kìa! Điểm {res['name']} tại [{remembered_pos[0]:.1f}, {remembered_pos[1]:.1f}] đã cạn kiệt! Đã lưu vị trí cạn vào bản đồ. Phải thám hiểm tìm nguồn mới.",
                    importance=0.88,
                )
                return True

        # 2. Kiem tra phat hien tai nguyen moi khi be tien den gan
        if not res["discovered"]:
            dist_to_actual = float(np.linalg.norm(robot_pos - actual_pos))
            if dist_to_actual < 1.8 and capacity > 0.0:
                res["discovered"] = True
                res["pos"] = actual_pos.tolist()

                # Luu vao danh muc cac vi tri da tim thay
                self.discovered_history.append({
                    "type": resource_type,
                    "pos": actual_pos.tolist(),
                    "status": "active",
                    "name": res["name"],
                    "time": time.strftime("%H:%M:%S"),
                })
                if len(self.discovered_history) > 15:
                    self.discovered_history.pop(0)

                self.add_memory(
                    event_type="discovery",
                    text=f"Aha! Tự mình tìm thấy nguồn {res['name']} mới tại [{actual_pos[0]:.1f}, {actual_pos[1]:.1f}]!",
                    importance=0.90,
                )
                return True

        return False

    def get_exploration_percentage(self) -> float:
        """
        Tinh ty le phan tram ban do ma be da kham pha duoc (o co muc do > 0.35).

        Returns:
            float: Ty le phan tram [0.0 - 100.0%].
        """
        explored_cells = np.count_nonzero(self.exploration_grid > 0.35)
        total_cells = self.grid_size * self.grid_size
        return round(float(explored_cells / total_cells) * 100.0, 1)

    def get_danger_at(self, pos: np.ndarray) -> float:
        """
        Tra ve do nguy hiem ma be ghi nho tai toa do pos.

        Args:
            pos (np.ndarray): Toa do can kiem tra [x, z].

        Returns:
            float: Gia tri do nguy hiem [0.0 - 1.0].
        """
        gx = int(np.clip(pos[0], 0, self.grid_size - 1))
        gz = int(np.clip(pos[1], 0, self.grid_size - 1))
        return float(self.danger_grid[gx, gz])

    def find_unexplored_direction(self, robot_pos: np.ndarray) -> Optional[np.ndarray]:
        """
        Tim huong vector don vi dan toi cum o dat chua kham pha gan nhat (Curiosity Vector).
        Chi tim kiem trong pham vi an toan cach tuong bien it nhat 7m de tranh bi hut ve goc tuong.

        Args:
            robot_pos (np.ndarray): Toa do hien tai cua robot.

        Returns:
            Optional[np.ndarray]: Vector don vi 2D huong ve vung dat moi, hoac None neu da kham pha het.
        """
        margin = 7
        safe_mask = (self.exploration_grid < 0.28) & (self.danger_grid < 0.3)
        safe_submask = np.zeros_like(safe_mask, dtype=bool)
        safe_submask[margin : self.grid_size - margin, margin : self.grid_size - margin] = True

        valid_unexplored = np.argwhere(safe_mask & safe_submask)
        if len(valid_unexplored) == 0:
            safe_submask_idx = np.argwhere(safe_submask)
            if len(safe_submask_idx) == 0:
                return None
            valid_unexplored = safe_submask_idx

        # Chon trong 8 cum o chua kham pha gan nhat de tao tinh da dang ngau nhien
        dists = np.linalg.norm(valid_unexplored - robot_pos, axis=1)
        nearest_k = np.argsort(dists)[: min(8, len(dists))]
        chosen_idx = valid_unexplored[nearest_k[np.random.randint(0, len(nearest_k))]]

        target_pt = chosen_idx.astype(np.float32)
        direction = target_pt - robot_pos
        norm = np.linalg.norm(direction)
        if norm > 0.1:
            return direction / norm
        return None

    def to_dict(self) -> Dict[str, Any]:
        """
        Dong goi du lieu tri nho de gui qua WebSocket cho frontend hien thi.
        Nen luoi exploration va danger theo ty le 6:1 de tiet kiem bang thong mang.

        Returns:
            Dict[str, Any]: Du lieu tri nho rut gon.
        """
        sampled_grid = (self.exploration_grid[::6, ::6] > 0.3).astype(int).tolist()
        danger_sampled = (self.danger_grid[::6, ::6] > 0.3).astype(int).tolist()

        return {
            "exploration_pct": self.get_exploration_percentage(),
            "discovered_resources": {
                k: {"discovered": v["discovered"], "pos": v["pos"], "name": v["name"]}
                for k, v in self.discovered_resources.items()
            },
            "discovered_history": list(self.discovered_history),
            "recent_memories": self.episodic_memories[:6],
            "mini_explored_grid": sampled_grid,
            "mini_danger_grid": danger_sampled,
        }
