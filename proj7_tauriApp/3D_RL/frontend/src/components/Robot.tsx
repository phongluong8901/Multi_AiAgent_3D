import { useTrainingStore } from "../stores/useTrainingStore";

export default function Robot() {
    const robot = useTrainingStore((s) => s.robot);
    const collided = useTrainingStore((s) => s.collided);
    const isResting = useTrainingStore((s) => s.isResting);
    const drives = useTrainingStore((s) => s.drivesState.drives);
    const energyRatio = useTrainingStore((s) => s.energyState.energy_ratio);

    let bodyColor = "#3b82f6"; // Default healthy blue
    if (collided || drives.pain > 0.35) {
        bodyColor = "#f43f5e"; // Pain / Collision rose-red
    } else if (isResting) {
        bodyColor = "#818cf8"; // Resting indigo
    } else if (drives.hunger > 0.65 || energyRatio < 0.25) {
        bodyColor = "#f59e0b"; // Hungry / Low energy amber
    }

    return (
        <group position={[robot[0], 0, robot[1]]}>
            {/* Body cylinder */}
            <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.28, 0.32, 0.65, 24]} />
                <meshStandardMaterial color={bodyColor} metalness={0.25} roughness={0.35} />
            </mesh>

            {/* Head sphere */}
            <mesh position={[0, 0.82, 0]} castShadow>
                <sphereGeometry args={[0.22, 24, 24]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
            </mesh>

            {/* Ground aura ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.36, 0.44, 28]} />
                <meshBasicMaterial color={bodyColor} />
            </mesh>
        </group>
    );
}
