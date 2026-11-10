import heapq
import math
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np


def segment_intersects_circle(
    p1: np.ndarray, p2: np.ndarray, center: np.ndarray, radius: float
) -> bool:
    """
    Kiem tra hinh hoc: Doan thang p1-p2 co cat qua hinh tron tam center ban kinh radius hay khong.
    Dung de phat hien canh do thi bi toa nha cat qua, tranh va cham trong quy hoach duong di.

    Args:
        p1 (np.ndarray): Toa do diem dau [x, z].
        p2 (np.ndarray): Toa do diem cuoi [x, z].
        center (np.ndarray): Toa do tam vat the [x, z].
        radius (float): Ban kinh hieu dung cua vat the.

    Returns:
        bool: True neu doan thang cat hinh tron, False neu thong thoang.
    """
    v = p2 - p1
    v_len_sq = float(np.dot(v, v))
    if v_len_sq < 1e-6:
        return float(np.linalg.norm(p1 - center)) < radius
    t = float(np.clip(np.dot(center - p1, v) / v_len_sq, 0.0, 1.0))
    closest = p1 + t * v
    dist = float(np.linalg.norm(center - closest))
    return dist < radius


class TopologicalNode:
    """
    Dai dien cho mot nut giao lo hoac mot dia danh trong ban do do thi topo do thi.

    Thuoc tinh:
    - node_id: Dinh danh duy nhat cua nut (vi du: 'int_2_2', 'lm_villa').
    - name: Ten hien thi de hieu (vi du: 'Giao lo [50, 50]', 'Biet thu Villa').
    - pos: Toa do 2D [x, z] tren ban do the gioi.
    - node_type: Loai nut ('intersection' hoac 'landmark').
    - neighbors: Dict anh xa {neighbor_id: base_distance} the hien cac canh noi truc tiep.
    """

    def __init__(
        self,
        node_id: str,
        name: str,
        pos: Tuple[float, float],
        node_type: str = "intersection",
    ):
        self.node_id = node_id
        self.name = name
        self.pos = np.array(pos, dtype=np.float32)
        self.node_type = node_type
        self.discovered: bool = False
        self.neighbors: Dict[str, float] = {}  # neighbor_id -> base_distance


class TopologicalGraph:
    """
    Ban do Nhan thuc Do thi Khong gian Ngu nghia (Topological Semantic Graph SLAM).
    Bieu dien mang luoi cac giao lo dai lo do thi va cac dia danh trong diem:
    - Giai thuat A* tim lo trinh toan cuc (Global Path Planning) an toan, khong dam xuyen qua toa nha.
    - Cap nhat trong so thich nghi (Adaptive Cost Weighting) theo vet seo tam ly (danger_grid).
    - Lam muot lo trinh bang ky thuat rut ngan diem Waypoint (Waypoint Shortcutting).
    - Cung cap danh sach Waypoints dan duong cho bo dieu khien no-ron cuc bo.
    """

    def __init__(self, world_size: float = 100.0):
        """
        Khoi tao do thi topo voi mang luoi dai lo va dia danh mac dinh.

        Args:
            world_size (float): Kich thuoc ban do the gioi (mac dinh 100.0m).
        """
        self.world_size = world_size
        self.nodes: Dict[str, TopologicalNode] = {}
        self.edge_danger_weights: Dict[Tuple[str, str], float] = {}
        self._build_default_city_graph()

    def _build_default_city_graph(self):
        """Khoi tao mang luoi giao lo tren cac dai lo chinh cua dai do thi 100x100."""
        # 5 truc dai lo va tuyen pho ket noi
        avenues = [22.0, 36.0, 50.0, 64.0, 78.0]

        # 1. Tao cac nut giao lo (Intersections)
        for i, x in enumerate(avenues):
            for j, z in enumerate(avenues):
                node_id = f"int_{i}_{j}"
                name = f"Giao lộ [{int(x)}, {int(z)}]"
                self.nodes[node_id] = TopologicalNode(
                    node_id=node_id,
                    name=name,
                    pos=(x, z),
                    node_type="intersection",
                )

        # 2. Tao cac nut dia danh do thi noi bat (Landmarks)
        landmarks = [
            ("lm_villa", "Biệt thự Villa gia đình", (12.0, 12.0)),
            ("lm_fountain", "Đài phun nước trung tâm", (50.0, 50.0)),
            ("lm_sky_a", "Tháp đôi chọc trời Tây", (40.0, 40.0)),
            ("lm_sky_b", "Tháp đôi chọc trời Đông", (60.0, 40.0)),
            ("lm_mall", "Đại siêu thị Mega Mall", (74.0, 40.0)),
            ("lm_petrol", "Cây xăng đô thị", (90.0, 40.0)),
            ("lm_food", "Phố ẩm thực & Nhà hàng", (74.0, 58.0)),
            ("lm_cineplex", "Rạp phim Cineplex", (90.0, 60.0)),
            ("lm_lake", "Hồ nước sinh thái công viên", (14.0, 78.0)),
            ("lm_play", "Sân chơi trẻ em công viên", (12.0, 90.0)),
            ("lm_basketball", "Sân bóng rổ đô thị", (26.0, 90.0)),
            ("lm_hospital", "Bệnh viện Đa Khoa Quốc Tế", (74.0, 76.0)),
            ("lm_fire", "Trạm cứu hỏa", (90.0, 76.0)),
            ("lm_pool", "Khu hồ bơi resort", (72.0, 14.0)),
            ("lm_opera", "Nhà hát Lớn Opera House", (50.0, 76.0)),
            ("lm_school", "Trường tiểu học đô thị", (12.0, 50.0)),
        ]
        for lid, lname, lpos in landmarks:
            self.nodes[lid] = TopologicalNode(
                node_id=lid,
                name=lname,
                pos=lpos,
                node_type="landmark",
            )

        # 3. Ket noi cac giao lo lan can theo truc ngang va doc
        for i in range(len(avenues)):
            for j in range(len(avenues)):
                curr_id = f"int_{i}_{j}"
                # Noi sang phai
                if i + 1 < len(avenues):
                    right_id = f"int_{i+1}_{j}"
                    dist = float(
                        np.linalg.norm(
                            self.nodes[curr_id].pos - self.nodes[right_id].pos
                        )
                    )
                    self._add_bidirectional_edge(curr_id, right_id, dist)
                # Noi xuong duoi
                if j + 1 < len(avenues):
                    down_id = f"int_{i}_{j+1}"
                    dist = float(
                        np.linalg.norm(
                            self.nodes[curr_id].pos - self.nodes[down_id].pos
                        )
                    )
                    self._add_bidirectional_edge(curr_id, down_id, dist)

        # 4. Noi cac dia danh vao giao lo gan nhat
        for lid, _, lpos in landmarks:
            lpos_arr = np.array(lpos, dtype=np.float32)
            closest_int = None
            min_d = 999.0
            for i in range(len(avenues)):
                for j in range(len(avenues)):
                    nid = f"int_{i}_{j}"
                    d = float(np.linalg.norm(lpos_arr - self.nodes[nid].pos))
                    if d < min_d:
                        min_d = d
                        closest_int = nid
            if closest_int is not None:
                self._add_bidirectional_edge(lid, closest_int, min_d)

    def _add_bidirectional_edge(self, n1: str, n2: str, dist: float):
        """Noi canh vo huong hai chieu giua hai nut n1 va n2."""
        self.nodes[n1].neighbors[n2] = dist
        self.nodes[n2].neighbors[n1] = dist

    def prune_blocked_edges(
        self,
        obstacles: np.ndarray,
        radii: np.ndarray,
        safety_margin: float = 0.8,
    ):
        """
        Loai bo cac canh do thi bi toa nha cat qua khoi mang luoi di chuyen.

        Args:
            obstacles (np.ndarray): Mang toa do cac toa nha [N, 2].
            radii (np.ndarray): Mang ban kinh cac toa nha [N].
            safety_margin (float): Vung dem an toan them vao ban kinh.
        """
        for nid, node in list(self.nodes.items()):
            to_remove = []
            for neighbor_id in list(node.neighbors.keys()):
                neighbor = self.nodes[neighbor_id]
                blocked = False
                for obs, rad in zip(obstacles, radii):
                    if segment_intersects_circle(
                        node.pos, neighbor.pos, obs, float(rad) + safety_margin
                    ):
                        blocked = True
                        break
                if blocked:
                    to_remove.append(neighbor_id)
            for r in to_remove:
                if r in node.neighbors:
                    del node.neighbors[r]

    def update_edge_costs_from_danger(self, danger_grid: np.ndarray):
        """
        Cap nhat trong so phat cho cac canh do thi chay sat qua vung nguy hiem / lo lua.

        Args:
            danger_grid (np.ndarray): Luoi ma tran nguy hiem tu SpatialMemoryMap.
        """
        self.edge_danger_weights.clear()
        grid_size = danger_grid.shape[0]

        for n1_id, node in self.nodes.items():
            for n2_id in node.neighbors:
                p1 = node.pos
                p2 = self.nodes[n2_id].pos
                # Lay 4 mau diem doc theo canh
                max_danger = 0.0
                for alpha in [0.2, 0.4, 0.6, 0.8]:
                    sample = p1 + alpha * (p2 - p1)
                    gx = int(np.clip(sample[0], 0, grid_size - 1))
                    gz = int(np.clip(sample[1], 0, grid_size - 1))
                    max_danger = max(max_danger, float(danger_grid[gx, gz]))

                edge_key = tuple(sorted([n1_id, n2_id]))
                self.edge_danger_weights[edge_key] = max_danger

    def has_line_of_sight(
        self,
        p1: np.ndarray,
        p2: np.ndarray,
        obstacles: np.ndarray,
        radii: np.ndarray,
        safety_margin: float = 0.9,
    ) -> bool:
        """
        Kiem tra duong di thang giua hai diem co thong thoang khong bi vat can nao can.

        Args:
            p1 (np.ndarray): Toa do diem bat dau.
            p2 (np.ndarray): Toa do diem ket thuc.
            obstacles (np.ndarray): Mang toa do cac toa nha.
            radii (np.ndarray): Ban kinh cac toa nha.
            safety_margin (float): Vung dem an toan.

        Returns:
            bool: True neu thong thoang (co tam nhin truc tiep Line-of-Sight).
        """
        for obs, rad in zip(obstacles, radii):
            if segment_intersects_circle(
                p1, p2, obs, float(rad) + safety_margin
            ):
                return False
        return True

    def find_nearest_visible_node(
        self,
        pos: np.ndarray,
        obstacles: np.ndarray,
        radii: np.ndarray,
    ) -> Optional[str]:
        """
        Tim nut do thi gan nhat ma vi tri pos co the nhin thay truc tiep khong bi chan.

        Args:
            pos (np.ndarray): Toa do can ket noi vao do thi.
            obstacles (np.ndarray): Cac vat can.
            radii (np.ndarray): Ban kinh vat can.

        Returns:
            Optional[str]: ID nut do thi phu hop nhat.
        """
        best_node = None
        best_dist = 999.0

        for nid, node in self.nodes.items():
            d = float(np.linalg.norm(pos - node.pos))
            if d < best_dist and d < 18.0:
                if self.has_line_of_sight(pos, node.pos, obstacles, radii):
                    best_dist = d
                    best_node = nid

        # Fallback nut gan nhat neu khong co nut nao co Line-of-Sight hoan hao
        if best_node is None:
            for nid, node in self.nodes.items():
                d = float(np.linalg.norm(pos - node.pos))
                if d < best_dist:
                    best_dist = d
                    best_node = nid

        return best_node

    def plan_path(
        self,
        start_pos: np.ndarray,
        goal_pos: np.ndarray,
        obstacles: np.ndarray,
        radii: np.ndarray,
    ) -> List[np.ndarray]:
        """
        Quy hoach lo trinh toan cuc A* tren do thi Topo (Global A* Path Planning):
        1. Neu khoang cach ngan (< 12m) va co tam nhin truc tiep -> Di thang toi dich.
        2. Neu xa hoac bi toa nha chan -> Tim duong ngan nhat qua cac nut giao lo an toan.
        3. Lam muot lo trinh bang Waypoint Shortcutting.

        Args:
            start_pos (np.ndarray): Toa do xuat phat cua robot.
            goal_pos (np.ndarray): Toa do dich den can toi.
            obstacles (np.ndarray): Danh sach toa do cac vat can / toa nha.
            radii (np.ndarray): Ban kinh vat ly cua tung toa nha.

        Returns:
            List[np.ndarray]: Danh sach cac Waypoints ke tiep [wp1, wp2, ..., goal].
        """
        start_2d = np.array([start_pos[0], start_pos[1]], dtype=np.float32)
        goal_2d = np.array([goal_pos[0], goal_pos[1]], dtype=np.float32)
        dist_direct = float(np.linalg.norm(goal_2d - start_2d))

        # Kiem tra di thang neu co Line of Sight
        if dist_direct < 12.0 and self.has_line_of_sight(
            start_2d, goal_2d, obstacles, radii
        ):
            return [goal_2d]

        # Tim nut do thi ket noi diem dau va diem cuoi
        start_node_id = self.find_nearest_visible_node(
            start_2d, obstacles, radii
        )
        goal_node_id = self.find_nearest_visible_node(
            goal_2d, obstacles, radii
        )

        if start_node_id is None or goal_node_id is None:
            return [goal_2d]

        if start_node_id == goal_node_id:
            return [self.nodes[goal_node_id].pos, goal_2d]

        # Giai thuat A* tim duong tren Topo Graph
        open_set: List[Tuple[float, str]] = []
        heapq.heappush(open_set, (0.0, start_node_id))

        came_from: Dict[str, str] = {}
        g_score: Dict[str, float] = {start_node_id: 0.0}
        f_score: Dict[str, float] = {
            start_node_id: float(
                np.linalg.norm(
                    self.nodes[start_node_id].pos - self.nodes[goal_node_id].pos
                )
            )
        }

        found = False
        while open_set:
            _, current = heapq.heappop(open_set)

            if current == goal_node_id:
                found = True
                break

            curr_node = self.nodes[current]
            for neighbor_id, base_dist in curr_node.neighbors.items():
                edge_key = tuple(sorted([current, neighbor_id]))
                danger_penalty = self.edge_danger_weights.get(edge_key, 0.0)
                # Phat trong so nang neu canh do gan vung nguy hiem
                edge_cost = base_dist * (1.0 + 6.0 * danger_penalty)
                tentative_g = g_score[current] + edge_cost

                if (
                    neighbor_id not in g_score
                    or tentative_g < g_score[neighbor_id]
                ):
                    came_from[neighbor_id] = current
                    g_score[neighbor_id] = tentative_g
                    h_cost = float(
                        np.linalg.norm(
                            self.nodes[neighbor_id].pos
                            - self.nodes[goal_node_id].pos
                        )
                    )
                    f_score[neighbor_id] = tentative_g + h_cost
                    heapq.heappush(open_set, (f_score[neighbor_id], neighbor_id))

        if not found:
            return [self.nodes[goal_node_id].pos, goal_2d]

        # Tai hien chuoi Waypoints tu came_from
        curr = goal_node_id
        path_nodes = [curr]
        while curr in came_from:
            curr = came_from[curr]
            path_nodes.append(curr)
        path_nodes.reverse()

        waypoints: List[np.ndarray] = []
        for nid in path_nodes:
            waypoints.append(self.nodes[nid].pos)
        waypoints.append(goal_2d)

        # Lam muot Waypoints (Shortcutting)
        smoothed = [start_2d]
        curr_idx = 0
        while curr_idx < len(waypoints) - 1:
            next_idx = len(waypoints) - 1
            while next_idx > curr_idx + 1:
                if self.has_line_of_sight(
                    waypoints[curr_idx],
                    waypoints[next_idx],
                    obstacles,
                    radii,
                ):
                    break
                next_idx -= 1
            smoothed.append(waypoints[next_idx])
            curr_idx = next_idx

        # Bo diem xuat phat dau tien de chi giu lai cac muc tieu ke tiep
        return smoothed[1:] if len(smoothed) > 1 else [goal_2d]

    def to_dict(self) -> Dict[str, Any]:
        """
        Xuat du lieu do thi phuc vu hien thi 3D tren Frontend.

        Returns:
            Dict[str, Any]: Danh sach nut, canh va tong so phan tu.
        """
        nodes_data = []
        for nid, node in self.nodes.items():
            nodes_data.append({
                "id": node.node_id,
                "name": node.name,
                "pos": [round(float(node.pos[0]), 2), round(float(node.pos[1]), 2)],
                "type": node.node_type,
                "discovered": node.discovered,
            })
        edges_data = []
        visited = set()
        for nid, node in self.nodes.items():
            for neighbor_id, dist in node.neighbors.items():
                pair = tuple(sorted([nid, neighbor_id]))
                if pair not in visited:
                    visited.add(pair)
                    edges_data.append({
                        "source": pair[0],
                        "target": pair[1],
                        "distance": round(dist, 2),
                    })
        return {
            "nodes": nodes_data,
            "edges": edges_data,
            "total_nodes": len(nodes_data),
            "total_edges": len(edges_data),
        }
