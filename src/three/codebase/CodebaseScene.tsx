import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Billboard,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { FileChangeStatus, Theme } from "../../types/domain";
import type {
  CodebaseCluster,
  CodebaseFileNode,
  CodebaseLayout,
} from "../../features/snapshots/codebaseLayout";
import { SCENE_THEMES } from "../../styles/themeTokens";
import { formatBytes, truncate } from "../../utils/format";
import { registerSceneCapture } from "../shared/sceneCapture";
import { SceneUnavailable } from "../shared/SceneUnavailable";
import { supportsWebGL } from "../shared/webgl";
import { fitCamera, focusCamera, panCamera } from "../shared/cameraFraming";
import { SceneLabel, SceneLabelLayer } from "../shared/SceneLabel";
import { escapeHtml } from "../../utils/html";
import { useSceneBus } from "../../store/sceneBus";
import { cn } from "../../utils/cn";

export interface CodebaseSceneProps {
  layout: CodebaseLayout;
  selectedPath: string | null;
  onSelect?: (path: string) => void;
  theme: Theme;
  showGrid?: boolean;
  reduceMotion?: boolean;
  interactive?: boolean;
  autoRotate?: boolean;
  preview?: boolean;
  capture?: boolean;
  neutralPreview?: boolean;
  className?: string;
}

interface SceneProps extends Omit<CodebaseSceneProps, "className"> {
  themeColors: (typeof SCENE_THEMES)[Theme];
}

const CHANGE_COLORS: Record<FileChangeStatus, string> = {
  added: "#6ee7a8",
  removed: "#ff7b8f",
  modified: "#ffc978",
  renamed: "#b694ff",
  copied: "#64d8ff",
  changed: "#8ca6c4",
  unchanged: "#7f96b3",
};

function colorForFile(
  file: CodebaseFileNode,
  colors: (typeof SCENE_THEMES)[Theme],
): string {
  return colors.fileCategories[file.category] ?? colors.node;
}

function CaptureBridge() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    registerSceneCapture(() => {
      gl.render(scene, camera);
      return gl.domElement;
    });
    return () => registerSceneCapture(null);
  }, [camera, gl, scene]);
  return null;
}

function PlatformGeometry({
  clusters,
  center,
  width,
  depth,
  colors,
}: {
  clusters: CodebaseCluster[];
  center: THREE.Vector3;
  width: number;
  depth: number;
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const positions = useMemo(() => {
    const values: number[] = [];
    for (const cluster of clusters) {
      const x0 = cluster.x - cluster.width / 2;
      const x1 = cluster.x + cluster.width / 2;
      const z0 = cluster.z - cluster.depth / 2;
      const z1 = cluster.z + cluster.depth / 2;
      const y = 0.09;
      values.push(
        x0, y, z0, x1, y, z0,
        x1, y, z0, x1, y, z1,
        x1, y, z1, x0, y, z1,
        x0, y, z1, x0, y, z0,
      );
    }
    return new Float32Array(values);
  }, [clusters]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.16, center.z]}>
        <planeGeometry args={[width * 1.25, depth * 1.3]} />
        <meshBasicMaterial
          color={colors.platform}
          transparent
          opacity={colors.additiveGlow ? 0.2 : 0.3}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={colors.platformEdge}
          transparent
          opacity={colors.additiveGlow ? 0.5 : 0.68}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function PlatformSlabs({
  clusters,
  colors,
}: {
  clusters: CodebaseCluster[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    clusters.forEach((cluster, index) => {
      dummy.position.set(cluster.x, 0.02, cluster.z);
      dummy.scale.set(cluster.width, 0.1, cluster.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [clusters]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, clusters.length)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={colors.platform}
        transparent
        opacity={colors.additiveGlow ? 0.42 : 0.58}
        roughness={0.9}
        metalness={0.08}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function ScanSweep({
  center,
  width,
  minZ,
  maxZ,
  colors,
  reduced,
}: {
  center: THREE.Vector3;
  width: number;
  minZ: number;
  maxZ: number;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const depth = Math.max(1, maxZ - minZ);

  useFrame((state) => {
    if (!ref.current) return;
    if (reduced) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const t = (state.clock.elapsedTime * 0.055) % 1;
    ref.current.position.z = minZ + t * depth;
    const material = ref.current.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.08 + Math.sin(t * Math.PI) * 0.22;
    }
  });

  return (
    <mesh ref={ref} position={[center.x, 0.12, minZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width * 1.35, 0.07]} />
      <meshBasicMaterial
        color={colors.edge}
        transparent
        opacity={0.16}
        depthWrite={false}
        toneMapped={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  );
}

function ClusterBeacons({
  clusters,
  colors,
}: {
  clusters: CodebaseCluster[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    clusters.forEach((cluster, index) => {
      const height = 1.8 + Math.min(5, Math.sqrt(Math.max(1, cluster.descendantFileCount)) * 0.45);
      dummy.position.set(cluster.x, height / 2, cluster.z);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [clusters]);

  if (clusters.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, clusters.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.015, 0.055, 1, 6, 1, true]} />
      <meshBasicMaterial
        color={colors.platformEdge}
        transparent
        opacity={colors.additiveGlow ? 0.2 : 0.18}
        depthWrite={false}
        toneMapped={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

function FileCity({
  files,
  colors,
  selectedPath,
  hoveredPath,
  onHover,
  onSelect,
  interactive,
}: {
  files: CodebaseFileNode[];
  colors: (typeof SCENE_THEMES)[Theme];
  selectedPath: string | null;
  hoveredPath: string | null;
  onHover: (path: string | null) => void;
  onSelect?: (path: string) => void;
  interactive: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hoverColor = new THREE.Color(colors.hover);
    const selectionColor = new THREE.Color(colors.selection);
    files.forEach((file, index) => {
      const isHovered = file.path === hoveredPath;
      const scaleXZ = isHovered ? 1.28 : 1;
      const scaleY = isHovered ? 1.1 : 1;
      dummy.position.set(file.x, (file.height * scaleY) / 2 + 0.14, file.z);
      dummy.scale.set(file.width * scaleXZ, file.height * scaleY, file.depth * scaleXZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(colorForFile(file, colors));
      if (isHovered) color.lerp(hoverColor, 0.55);
      if (file.path === selectedPath) color.lerp(selectionColor, 0.45);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [colors, files, hoveredPath, selectedPath]);

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (event.instanceId == null) return;
    onHover(files[event.instanceId]?.path ?? null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    event.stopPropagation();
    if (event.instanceId == null) return;
    const file = files[event.instanceId];
    if (file) onSelect?.(file.path);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(1, files.length)]}
      onPointerMove={interactive ? handleMove : undefined}
      onPointerOut={interactive ? () => onHover(null) : undefined}
      onClick={interactive ? handleClick : undefined}
    >
      <boxGeometry args={[1, 1, 1]} />
      {colors.additiveGlow ? (
        <meshStandardMaterial
          roughness={0.36}
          metalness={0.22}
          emissive={colors.node}
          emissiveIntensity={0.045}
          toneMapped={false}
        />
      ) : (
        <meshBasicMaterial toneMapped={false} />
      )}
    </instancedMesh>
  );
}

function FileCaps({
  files,
  colors,
}: {
  files: CodebaseFileNode[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    files.forEach((file, index) => {
      dummy.position.set(file.x, file.height + 0.155, file.z);
      dummy.scale.set(file.width * 1.35, 0.035, file.depth * 1.35);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(colorForFile(file, colors));
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [colors, files]);

  if (files.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, files.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        transparent
        opacity={colors.additiveGlow ? 0.9 : 0.84}
        toneMapped={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

function HoverFileMarker({
  file,
  colors,
  reduced,
}: {
  file: CodebaseFileNode;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current || reduced) return;
    ringRef.current.rotation.z = -state.clock.elapsedTime * 1.2;
  });

  return (
    <group>
      <Line
        points={[
          [file.x, 0.12, file.z],
          [file.x, file.height + 0.42, file.z],
        ]}
        color={colors.hover}
        transparent
        opacity={0.2}
        lineWidth={1}
      />
      <Billboard position={[file.x, file.height + 0.18, file.z]}>
        <mesh ref={ringRef}>
          <ringGeometry args={[Math.max(file.width * 1.5, 0.22), Math.max(file.width * 1.5, 0.22) + 0.035, 32, 1, 0, Math.PI * 1.45]} />
          <meshBasicMaterial
            color={colors.hover}
            transparent
            opacity={0.82}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function ChangeMarkers({
  files,
  colors,
}: {
  files: CodebaseFileNode[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const changed = useMemo(
    () => files.filter((file) => file.changeStatus && file.changeStatus !== "unchanged"),
    [files],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    changed.forEach((file, index) => {
      dummy.position.set(file.x, file.height + 0.28, file.z);
      dummy.scale.setScalar(file.changeStatus === "removed" ? 1.15 : 0.85);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(CHANGE_COLORS[file.changeStatus ?? "changed"] ?? colors.tag);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [changed, colors]);

  if (changed.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, changed.length]}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function ClusterLabels({
  clusters,
  selectedPath,
}: {
  clusters: CodebaseCluster[];
  selectedPath: string | null;
}) {
  const visible = useMemo(
    () =>
      clusters
        .filter(
          (cluster) =>
            cluster.isRoot ||
            cluster.level <= 1 ||
            cluster.files.some((file) => file.path === selectedPath),
        )
        .slice(0, 32),
    [clusters, selectedPath],
  );

  return (
    <>
      {visible.map((cluster) => (
        <SceneLabel
          key={`cluster-${cluster.path || "root"}`}
          x={cluster.x}
          y={0.32}
          z={cluster.z + cluster.depth / 2 + 0.35}
          priority={0}
          html={`<span class="chip !h-[1.3rem] !border-line/60 !bg-panel/85 !text-[0.54rem] !text-muted backdrop-blur">${escapeHtml(truncate(cluster.isRoot ? "repository root" : cluster.name, 22))}<span class="text-faint">${cluster.descendantFileCount}</span></span>`}
        />
      ))}
    </>
  );
}

function SelectedFile({
  file,
  colors,
  reduced,
  preview,
}: {
  file: CodebaseFileNode;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
  preview: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reduced) return;
    const time = state.clock.elapsedTime;
    if (ringRef.current) {
      const scale = 1 + (Math.sin(time * 2.1) + 1) * 0.2;
      ringRef.current.scale.setScalar(scale);
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.z = -time * 1.05;
      orbitRef.current.rotation.x = Math.sin(time * 0.55) * 0.4;
    }
    if (beamRef.current) {
      const material = beamRef.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.1 + (Math.sin(time * 2.3) + 1) * 0.05;
      }
    }
  });

  return (
    <group>
      <mesh ref={beamRef} position={[file.x, (file.height + 0.5) / 2, file.z]}>
        <cylinderGeometry args={[0.014, 0.045, file.height + 0.5, 6, 1, true]} />
        <meshBasicMaterial
          color={colors.selection}
          transparent
          opacity={0.13}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </mesh>
      <Line
        points={[
          [file.x, 0.1, file.z],
          [file.x, file.height + 0.5, file.z],
        ]}
        color={colors.selection}
        transparent
        opacity={0.32}
        lineWidth={1}
      />
      <Billboard position={[file.x, 0.16, file.z]}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.36, 0.47, 48]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={orbitRef}>
          <ringGeometry args={[0.42, 0.445, 48, 1, 0, Math.PI * 1.4]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.68}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <ringGeometry args={[0.27, 0.32, 48]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <pointLight
        position={[file.x, file.height + 0.18, file.z]}
        color={colors.selection}
        intensity={colors.additiveGlow ? 2.2 : 0.3}
        distance={5.5}
        decay={2}
      />
      <mesh position={[file.x, file.height + 0.14, file.z]}>
        <boxGeometry args={[file.width * 1.5, file.height, file.depth * 1.5]} />
        <meshBasicMaterial
          color={colors.selection}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <SceneLabel
        x={file.x}
        y={file.height + (preview ? 1.1 : 0.8)}
        z={file.z}
        priority={4}
        html={`<div class="glass max-w-[17rem] rounded-lg px-2.5 py-1.5"><p class="truncate font-mono text-[0.61rem] font-medium text-ink">${escapeHtml(truncate(file.path, 54))}</p><p class="mt-0.5 flex items-center gap-1.5 text-[0.55rem] text-faint"><span>${escapeHtml(file.category)}</span><span aria-hidden="true">·</span><span>${escapeHtml(formatBytes(file.size))}</span>${file.changeStatus ? `<span aria-hidden="true">·</span><span style="color:${CHANGE_COLORS[file.changeStatus]}">${escapeHtml(file.changeStatus)}</span>` : ""}</p></div>`}
      />
    </group>
  );
}

function CameraRig({
  layout,
  interactive,
  autoRotate,
  reduced,
  controlsRef,
}: {
  layout: CodebaseLayout;
  interactive: boolean;
  autoRotate: boolean;
  reduced: boolean;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const fitNonce = useSceneBus((state) => state.fitNonce);
  const resetNonce = useSceneBus((state) => state.resetNonce);
  const panNonce = useSceneBus((state) => state.panNonce);
  const panX = useSceneBus((state) => state.panX);
  const panY = useSceneBus((state) => state.panY);
  const focusNonce = useSceneBus((state) => state.focusNonce);
  const focusView = useSceneBus((state) => state.focusView);
  const focusId = useSceneBus((state) => state.focusId);

  const center = useMemo(
    () =>
      new THREE.Vector3(
        (layout.bounds.minX + layout.bounds.maxX) / 2,
        0.4,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );
  const radius = useMemo(
    () =>
      Math.max(
        5,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxZ - layout.bounds.minZ) / 2,
        layout.bounds.maxHeight * 2,
      ),
    [layout],
  );
  const previousLayoutRef = useRef<CodebaseLayout | null>(null);
  const previousFitNonce = useRef(fitNonce);
  const previousResetNonce = useRef(resetNonce);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const previousLayout = previousLayoutRef.current;
    if (previousLayout && fitNonce === previousFitNonce.current && resetNonce === previousResetNonce.current) {
      const direction = camera.position.clone().sub(controls.target).normalize();
      const distance = camera.position.distanceTo(controls.target);
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.update();
      previousLayoutRef.current = layout;
      return;
    }
    fitCamera(camera as THREE.PerspectiveCamera, controls, {
      center,
      radius,
      direction: new THREE.Vector3(0.5, 0.78, 0.64).normalize(),
      nearDivisor: 600,
      minFar: 700,
      farFactor: 7,
      minDistance: 1.2,
      maxDistanceFactor: 2.5,
    });
    previousLayoutRef.current = layout;
    previousFitNonce.current = fitNonce;
    previousResetNonce.current = resetNonce;
  }, [camera, center, controlsRef, fitNonce, layout, radius, resetNonce]);

  const lastPanNonce = useRef(0);
  useEffect(() => {
    if (panNonce === lastPanNonce.current) return;
    lastPanNonce.current = panNonce;
    const controls = controlsRef.current;
    if (!controls) return;
    panCamera(camera as THREE.PerspectiveCamera, controls, panX, panY);
  }, [camera, controlsRef, panNonce, panX, panY]);

  const lastFocusNonce = useRef(0);
  useEffect(() => {
    if (focusNonce === lastFocusNonce.current) return;
    lastFocusNonce.current = focusNonce;
    if (focusView !== "codebase" || !focusId) return;
    const file = layout.files.find((candidate) => candidate.path === focusId);
    const controls = controlsRef.current;
    if (!file || !controls) return;
    const distance = Math.min(30, Math.max(4.5, radius * 0.22));
    focusCamera(
      camera as THREE.PerspectiveCamera,
      controls,
      new THREE.Vector3(file.x, file.height * 0.6, file.z),
      distance,
      new THREE.Vector3(0.5, 0.64, 0.58).normalize(),
    );
  }, [camera, controlsRef, focusId, focusNonce, focusView, layout, radius]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      panSpeed={1.05}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
      enablePan={interactive}
      enableRotate={interactive}
      enableZoom={interactive}
      autoRotate={autoRotate && !reduced}
      autoRotateSpeed={0.42}
      maxPolarAngle={Math.PI * 0.49}
    />
  );
}

function CodebaseSceneContent({
  layout,
  selectedPath,
  onSelect,
  themeColors,
  reduceMotion,
  interactive,
  autoRotate,
  preview,
  capture,
}: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const selectedFile = selectedPath
    ? layout.files.find((file) => file.path === selectedPath)
    : undefined;
  const hoveredFile =
    hoveredPath && hoveredPath !== selectedPath
      ? layout.files.find((file) => file.path === hoveredPath)
      : undefined;

  const center = useMemo(
    () =>
      new THREE.Vector3(
        (layout.bounds.minX + layout.bounds.maxX) / 2,
        0,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );
  const radius = useMemo(
    () =>
      Math.max(
        5,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxZ - layout.bounds.minZ) / 2,
        layout.bounds.maxHeight * 2,
      ),
    [layout],
  );
  const width = Math.max(8, layout.bounds.maxX - layout.bounds.minX);
  const depth = Math.max(8, layout.bounds.maxZ - layout.bounds.minZ);

  useEffect(() => {
    if (!interactive) return;
    document.body.style.cursor = hoveredPath ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredPath, interactive]);

  return (
    <>
      {capture ? <CaptureBridge /> : null}
      <SceneLabelLayer />
      <fog
        attach="fog"
        args={[
          themeColors.fog,
          radius * (themeColors.additiveGlow ? 1.1 : 2.0),
          radius * (themeColors.additiveGlow ? 3.8 : 6.2),
        ]}
      />
      <ambientLight intensity={themeColors.additiveGlow ? 0.7 : 1.05} />
      <hemisphereLight
        args={[themeColors.text, themeColors.platform, themeColors.additiveGlow ? 0.6 : 0.9]}
      />
      <directionalLight
        position={[center.x + radius, radius * 1.4, center.z + radius * 0.5]}
        intensity={themeColors.additiveGlow ? 1.6 : 1.9}
        color={themeColors.text}
      />
      <PlatformGeometry
        clusters={layout.clusters}
        center={center}
        width={width}
        depth={depth}
        colors={themeColors}
      />
      <ScanSweep
        center={center}
        width={width}
        minZ={layout.bounds.minZ - 1}
        maxZ={layout.bounds.maxZ + 1}
        colors={themeColors}
        reduced={Boolean(reduceMotion)}
      />
      <PlatformSlabs clusters={layout.clusters} colors={themeColors} />
      <ClusterBeacons clusters={layout.clusters} colors={themeColors} />
      <FileCity
        files={layout.files}
        colors={themeColors}
        selectedPath={selectedPath}
        hoveredPath={hoveredPath}
        onHover={setHoveredPath}
        onSelect={onSelect}
        interactive={Boolean(interactive)}
      />
      <FileCaps files={layout.files} colors={themeColors} />
      <ChangeMarkers files={layout.files} colors={themeColors} />
      <ClusterLabels clusters={layout.clusters} selectedPath={selectedPath} />
      {selectedFile ? (
        <SelectedFile
          file={selectedFile}
          colors={themeColors}
          reduced={Boolean(reduceMotion)}
          preview={Boolean(preview)}
        />
      ) : null}
      {hoveredFile ? (
        <group>
          <HoverFileMarker
            file={hoveredFile}
            colors={themeColors}
            reduced={Boolean(reduceMotion)}
          />
          <SceneLabel
            x={hoveredFile.x}
            y={hoveredFile.height + 0.42}
            z={hoveredFile.z}
            priority={5}
            html={`<div class="glass max-w-[16rem] rounded-lg px-2.5 py-1.5"><p class="truncate font-mono text-[0.61rem] font-medium text-ink">${escapeHtml(truncate(hoveredFile.path, 50))}</p><p class="mt-0.5 text-[0.55rem] text-faint">${escapeHtml(formatBytes(hoveredFile.size))}</p></div>`}
          />
        </group>
      ) : null}
      <CameraRig
        layout={layout}
        interactive={Boolean(interactive)}
        autoRotate={Boolean(autoRotate)}
        reduced={Boolean(reduceMotion)}
        controlsRef={controlsRef}
      />
    </>
  );
}

export function CodebaseScene({
  layout,
  selectedPath,
  onSelect,
  theme,
  reduceMotion = false,
  interactive = true,
  autoRotate = false,
  preview = false,
  capture = false,
  neutralPreview = false,
  className,
}: CodebaseSceneProps) {
  const themeColors = useMemo(
    () => (neutralPreview ? { ...SCENE_THEMES[theme], additiveGlow: false } : SCENE_THEMES[theme]),
    [neutralPreview, theme],
  );
  const [webglAvailable] = useState(supportsWebGL);

  if (!webglAvailable) {
    return (
      <div className={cn("h-full w-full", className)}>
        <SceneUnavailable />
      </div>
    );
  }

  return (
    <div
      className={cn("h-full w-full", className)}
      role={interactive ? "application" : "img"}
      aria-label={
        interactive
          ? `Interactive 3D codebase landscape with ${layout.totalFiles} files. Orbit, zoom, and select a file.`
          : "Preview of a 3D historical codebase landscape"
      }
      style={interactive ? undefined : { pointerEvents: "none" }}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [18, 20, 24], fov: 45, near: 0.1, far: 4000 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#000000"), 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
        }}
      >
        <CodebaseSceneContent
          layout={layout}
          selectedPath={selectedPath}
          onSelect={onSelect}
          theme={theme}
          themeColors={themeColors}
          reduceMotion={reduceMotion}
          interactive={interactive}
          autoRotate={autoRotate}
          preview={preview}
          capture={capture}
        />
      </Canvas>
    </div>
  );
}
