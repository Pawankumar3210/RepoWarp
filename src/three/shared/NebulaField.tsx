import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneTheme } from "../../styles/themeTokens";

function createNebulaTexture(): THREE.CanvasTexture {
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, size, size);
    const clouds = [
      { x: 0.5, y: 0.5, r: 0.5, alpha: 0.9 },
      { x: 0.34, y: 0.42, r: 0.32, alpha: 0.55 },
      { x: 0.68, y: 0.58, r: 0.38, alpha: 0.48 },
      { x: 0.52, y: 0.3, r: 0.22, alpha: 0.34 },
    ];
    for (const cloud of clouds) {
      const gradient = context.createRadialGradient(
        cloud.x * size,
        cloud.y * size,
        0,
        cloud.x * size,
        cloud.y * size,
        cloud.r * size,
      );
      gradient.addColorStop(0, `rgba(255,255,255,${cloud.alpha})`);
      gradient.addColorStop(0.45, `rgba(255,255,255,${cloud.alpha * 0.34})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function NebulaField({
  center,
  radius,
  colors,
  reduced,
}: {
  center: THREE.Vector3;
  radius: number;
  colors: SceneTheme;
  reduced: boolean;
}) {
  const texture = useMemo(() => createNebulaTexture(), []);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    if (reduced || !groupRef.current) return;
    const time = state.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(time * 0.025) * 0.035;
    groupRef.current.position.x = center.x + Math.sin(time * 0.018) * radius * 0.015;
  });

  const blending = colors.additiveGlow
    ? THREE.AdditiveBlending
    : THREE.NormalBlending;
  const strength = colors.additiveGlow ? 1 : 0.46;

  return (
    <group ref={groupRef} position={[center.x, center.y, center.z]}>
      <sprite
        renderOrder={-10}
        position={[0, radius * 0.08, -radius * 0.8]}
        scale={[radius * 4.1, radius * 2.1, 1]}
      >
        <spriteMaterial
          map={texture}
          color={colors.edge}
          transparent
          opacity={0.2 * strength}
          depthWrite={false}
          depthTest={false}
          blending={blending}
          toneMapped={false}
        />
      </sprite>
      <sprite
        renderOrder={-9}
        position={[radius * 0.42, radius * 0.12, -radius * 0.35]}
        scale={[radius * 2.7, radius * 1.55, 1]}
      >
        <spriteMaterial
          map={texture}
          color={colors.mergeEdge}
          transparent
          opacity={0.15 * strength}
          depthWrite={false}
          depthTest={false}
          blending={blending}
          toneMapped={false}
        />
      </sprite>
      <sprite
        renderOrder={-8}
        position={[-radius * 0.46, -radius * 0.08, radius * 0.15]}
        scale={[radius * 2.1, radius * 1.25, 1]}
      >
        <spriteMaterial
          map={texture}
          color={colors.tag}
          transparent
          opacity={0.09 * strength}
          depthWrite={false}
          depthTest={false}
          blending={blending}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}
