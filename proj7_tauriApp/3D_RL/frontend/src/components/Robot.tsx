import { useTrainingStore } from "../stores/useTrainingStore";

export default function Robot() {
    const robot = useTrainingStore((s) => s.robot);

    return (
        <mesh position={[robot[0], 0.35, robot[1]]} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.7, 20]} />
            <meshStandardMaterial color="#3b82f6" metalness={0.3} roughness={0.4} />
        </mesh>
    );
}