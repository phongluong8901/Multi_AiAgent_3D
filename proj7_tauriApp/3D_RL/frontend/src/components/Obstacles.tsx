import { useTrainingStore } from "../stores/useTrainingStore";

export default function Obstacles() {
    const obstacles = useTrainingStore((s) => s.obstacles);

    return (
        <>
            {obstacles.map((obs, i) => (
                <mesh key={i} position={[obs[0], 0.6, obs[1]]} castShadow>
                    <boxGeometry args={[1.25, 1.2, 1.25]} />
                    <meshStandardMaterial color="#ef4444" />
                </mesh>
            ))}
        </>
    );
}