import { useTrainingStore } from "../stores/useTrainingStore";

export default function Goal() {
    const goal = useTrainingStore((s) => s.goal);

    return (
        <mesh position={[goal[0], 0.35, goal[1]]} castShadow>
            <sphereGeometry args={[0.45, 24, 24]} />
            <meshStandardMaterial color="#22c55e" roughness={0.3} metalness={0.2} />
        </mesh>
    );
}

