import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import Robot from "./Robot";
import Goal from "./Goal";
import Obstacles from "./Obstacles";

export default function Scene3D() {
    return (
        <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
            <Canvas
                shadows
                camera={{ position: [11, 9, 11], fov: 42 }}
            >
                <ambientLight intensity={0.45} />
                <directionalLight
                    position={[8, 14, 6]}
                    intensity={1.3}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />

                <Grid
                    infiniteGrid
                    cellSize={1}
                    sectionSize={5}
                    fadeDistance={35}
                    cellColor="#334155"
                    sectionColor="#64748b"
                />

                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, 0, 5]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>

                <Robot />
                <Goal />
                <Obstacles />

                <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}

