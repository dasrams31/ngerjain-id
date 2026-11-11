"use client";

import { Float, MeshDistortMaterial, RoundedBox, Torus } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// Three shapes for the three service lines: a blob (ML), a block (web), a ring (mentoring).
export default function HeroScene() {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);

  const speed = reduced ? 0 : 1.4;

  return (
    <Canvas
      camera={{ position: [0, 0, 6.8], fov: 40 }}
      dpr={[1, 1.75]}
      frameloop={reduced ? "demand" : "always"}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 5, 3]} intensity={2.2} />
      <directionalLight position={[-4, -2, -2]} intensity={0.6} color="#ffd9c7" />

      <Float speed={speed} rotationIntensity={0.6} floatIntensity={1.1}>
        <mesh position={[0.2, 0.15, 0]}>
          <icosahedronGeometry args={[1.25, 24]} />
          <MeshDistortMaterial color="#ff5b1f" roughness={0.25} metalness={0.05} distort={reduced ? 0 : 0.35} speed={2} />
        </mesh>
      </Float>

      <Float speed={speed * 0.8} rotationIntensity={1} floatIntensity={0.8}>
        <RoundedBox args={[0.9, 0.9, 0.9]} radius={0.14} position={[-1.45, -1.0, -0.6]} rotation={[0.5, 0.6, 0]}>
          <meshStandardMaterial color="#151515" roughness={0.4} />
        </RoundedBox>
      </Float>

      <Float speed={speed * 1.1} rotationIntensity={1.2} floatIntensity={0.9}>
        <Torus args={[0.55, 0.16, 24, 64]} position={[1.35, 1.15, -0.4]} rotation={[1.1, 0.2, 0]}>
          <meshStandardMaterial color="#e8e2d4" roughness={0.3} />
        </Torus>
      </Float>
    </Canvas>
  );
}
