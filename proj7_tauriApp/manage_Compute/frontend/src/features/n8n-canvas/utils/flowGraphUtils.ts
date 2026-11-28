import type { Node, Edge } from '@xyflow/react';

export interface ConnectedProcessInfo {
    pid: number;
    name: string;
    memory_mb?: number;
    cpu_percent?: number;
}

/**
 * Tìm kiếm tiến trình đang liên kết trong chuỗi đồ thị (cả upstream và downstream).
 * Giúp các node Alert Guard, Service Action và PC Automation tự động nhận diện
 * tiến trình đầu vào (ví dụ chrome.exe [PID 1892]).
 */
export function findConnectedProcess(
    nodeId: string,
    nodes: Node[],
    edges: Edge[]
): ConnectedProcessInfo | null {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
        const currId = queue.shift()!;
        if (visited.has(currId)) continue;
        visited.add(currId);

        // Lấy tất cả các cạnh nối vào hoặc nối ra từ node hiện tại
        const connectedEdges = edges.filter(
            (e) => e.target === currId || e.source === currId
        );

        for (const edge of connectedEdges) {
            const neighborId = edge.target === currId ? edge.source : edge.target;
            const neighborNode = nodes.find((n) => n.id === neighborId);

            if (neighborNode) {
                if (neighborNode.type === 'process_node') {
                    return {
                        pid: Number(neighborNode.data?.pid || 0),
                        name: String(neighborNode.data?.name || 'Process'),
                        memory_mb: Number(neighborNode.data?.memory_mb || 0),
                        cpu_percent: Number(neighborNode.data?.cpu_percent || 0),
                    };
                }

                if (!visited.has(neighborNode.id)) {
                    queue.push(neighborNode.id);
                }
            }
        }
    }

    return null;
}

