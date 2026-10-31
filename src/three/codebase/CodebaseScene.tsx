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
import { NebulaField } from "../shared/NebulaField";
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

const UP = new THREE.Vector3(0, 1, 0);

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

function IslandField({
  clusters,
  selectedClusterPath,
  colors,
}: {
  clusters: CodebaseCluster[];
  selectedClusterPath: string | null;
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const deckRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const keelRef = useRef<THREE.InstancedMesh>(null);
  const rimRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const deck = deckRef.current;
    const body = bodyRef.current;
    const keel = keelRef.current;
    const rim = rimRef.current;
    if (!deck || !body || !keel || !rim) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const rimColor = new THREE.Color();
    clusters.forEach((cluster, index) => {
      const selected = cluster.path === selectedClusterPath;
      const yaw = ((cluster.path.length * 17) % 12) * 0.02;
      dummy.rotation.set(0, yaw, 0);
      dummy.position.set(cluster.x, cluster.y + 0.08, cluster.z);
      dummy.scale.set(cluster.width, 0.16, cluster.depth);
      dummy.updateMatrix();
      deck.setMatrixAt(index, dummy.matrix);
      color.set(selected ? colors.selection : colors.platform);
      deck.setColorAt(index, color);

      dummy.position.set(cluster.x, cluster.y - 0.72, cluster.z);
      dummy.scale.set(cluster.width * 0.94, 1.55, cluster.depth * 0.94);
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      color.set(selected ? "#14324c" : colors.backgroundDeep);
      body.setColorAt(index, color);

      dummy.position.set(cluster.x, cluster.y - 1.62, cluster.z);
      dummy.scale.set(cluster.width * 0.62, 0.9, cluster.depth * 0.62);
      dummy.updateMatrix();
      keel.setMatrixAt(index, dummy.matrix);
      color.set(colors.backgroundDeep);
      keel.setColorAt(index, color);

      dummy.position.set(cluster.x, cluster.y + 0.17, cluster.z);
      dummy.scale.set(cluster.width * 1.02, 0.035, cluster.depth * 1.02);
      dummy.updateMatrix();
      rim.setMatrixAt(index, dummy.matrix);
      rimColor.set(selected ? colors.selection : colors.platformEdge);
      rim.setColorAt(index, rimColor);
    });
    for (const mesh of [deck, body, keel, rim]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [clusters, colors, selectedClusterPath]);

  const count = Math.max(1, clusters.length);

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.92} metalness={0.08} />
      </instancedMesh>
      <instancedMesh ref={keelRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={1} metalness={0.04} />
      </instancedMesh>
      <instancedMesh ref={deckRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.55}
          metalness={0.18}
          emissive={colors.platformEdge}
          emissiveIntensity={colors.additiveGlow ? 0.18 : 0.04}
        />
      </instancedMesh>
      <instancedMesh ref={rimRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={colors.additiveGlow ? 0.55 : 0.42}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </instancedMesh>
    </group>
  );
}

function EnergyBridges({
  clusters,
  colors,
}: {
  clusters: CodebaseCluster[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const byPath = useMemo(
    () => new Map(clusters.map((cluster) => [cluster.path, cluster])),
    [clusters],
  );

  const pieces = useMemo(() => {
    const result: Array<{ mid: THREE.Vector3; dir: THREE.Vector3; length: number }> = [];
    for (const cluster of clusters) {
      if (cluster.isRoot) continue;
      const parent = byPath.get(cluster.parentPath);
      if (!parent) continue;
      const start = new THREE.Vector3(parent.x, parent.y + 0.22, parent.z);
      const end = new THREE.Vector3(cluster.x, cluster.y + 0.22, cluster.z);
      const control = new THREE.Vector3(
        (start.x + end.x) / 2,
        Math.max(start.y, end.y) + 1.15,
        (start.z + end.z) / 2,
      );
      const curve = new THREE.QuadraticBezierCurve3(start, control, end);
      const points = curve.getPoints(8);
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        if (!a || !b) continue;
        const dir = b.clone().sub(a);
        const length = dir.length();
        if (length < 0.001) continue;
        result.push({
          mid: a.clone().add(b).multiplyScalar(0.5),
          dir: dir.normalize(),
          length,
        });
      }
    }
    return result;
  }, [byPath, clusters]);

  useLayoutEffect(() => {
    const mesh = coreRef.current;
    if (!mesh) return;
    const color = new THREE.Color(colors.edge);
    pieces.forEach((piece, index) => {
      dummy.position.copy(piece.mid);
      dummy.quaternion.setFromUnitVectors(UP, piece.dir);
      dummy.scale.set(0.035, piece.length, 0.035);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [colors.edge, dummy, pieces]);

  if (pieces.length === 0) return null;

  return (
    <instancedMesh ref={coreRef} args={[undefined, undefined, pieces.length]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 6]} />
      <meshBasicMaterial
        transparent
        opacity={colors.additiveGlow ? 0.72 : 0.45}
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
      const isSelected = file.path === selectedPath;
      const scaleXZ = isHovered || isSelected ? 1.18 : 1;
      const scaleY = isHovered ? 1.08 : 1;
      dummy.position.set(file.x, file.y + (file.height * (scaleY - 1)) / 2, file.z);
      dummy.scale.set(file.width * scaleXZ, file.height * scaleY, file.depth * scaleXZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(colorForFile(file, colors));
      if (isHovered) color.lerp(hoverColor, 0.4);
      if (isSelected) color.lerp(selectionColor, 0.55);
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
      <meshStandardMaterial
        roughness={0.18}
        metalness={0.28}
        transparent
        opacity={colors.additiveGlow ? 0.62 : 0.86}
        emissive={colors.node}
        emissiveIntensity={colors.additiveGlow ? 0.22 : 0.04}
        toneMapped={false}
      />
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
      dummy.position.set(file.x, file.y + file.height / 2 + 0.02, file.z);
      dummy.scale.set(file.width * 1.05, 0.04, file.depth * 1.05);
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
        opacity={colors.additiveGlow ? 0.85 : 0.7}
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
    <Billboard position={[file.x, file.y + file.height / 2 + 0.12, file.z]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[Math.max(file.width * 1.4, 0.2), Math.max(file.width * 1.4, 0.2) + 0.035, 32, 1, 0, Math.PI * 1.45]} />
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
      dummy.position.set(file.x, file.y + file.height / 2 + 0.16, file.z);
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
      <octahedronGeometry args={[0.1, 0]} />
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
      {visible.map((cluster) => {
        const selected = cluster.files.some((file) => file.path === selectedPath);
        const size = cluster.files.reduce((sum, file) => sum + (file.size ?? 0), 0);
        return (
          <SceneLabel
            key={`cluster-${cluster.path || "root"}`}
            x={cluster.x}
            y={cluster.y + 1.15 + (selected ? 0.35 : 0)}
            z={cluster.z}
            priority={selected ? 3 : 0}
            html={
              selected
                ? `<div class="glass max-w-[16rem] rounded-xl px-3 py-2"><p class="truncate text-[0.7rem] font-semibold text-ink">${escapeHtml(truncate(cluster.isRoot ? "repository root" : `${cluster.name}/`, 28))}</p><p class="mt-0.5 text-[0.55rem] text-faint">${cluster.fileCount} files · ${escapeHtml(formatBytes(size || null))}</p></div>`
                : `<span class="chip !h-[1.3rem] !border-line/60 !bg-panel/85 !text-[0.54rem] !text-muted backdrop-blur">${escapeHtml(truncate(cluster.isRoot ? "repository root" : cluster.name, 22))}<span class="text-faint">${cluster.descendantFileCount}</span></span>`
            }
          />
        );
      })}
    </>
  );
}

function SelectedFile({
  file,
  cluster,
  colors,
  reduced,
  preview,
}: {
  file: CodebaseFileNode;
  cluster: CodebaseCluster | null;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
  preview: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reduced) return;
    const time = state.clock.elapsedTime;
    if (ringRef.current) {
      const scale = 1 + (Math.sin(time * 2.1) + 1) * 0.16;
      ringRef.current.scale.setScalar(scale);
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.z = -time * 1.05;
    }
  });

  return (
    <group>
      {cluster ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cluster.x, cluster.y + 0.2, cluster.z]}>
          <planeGeometry args={[cluster.width * 1.08, cluster.depth * 1.08]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.12}
            depthWrite={false}
            toneMapped={false}
            blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
          />
        </mesh>
      ) : null}
      <Billboard position={[file.x, file.y + file.height / 2 + 0.08, file.z]}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.28, 0.36, 48]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={orbitRef}>
          <ringGeometry args={[0.4, 0.425, 48, 1, 0, Math.PI * 1.4]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <pointLight
        position={[file.x, file.y + file.height / 2 + 0.2, file.z]}
        color={colors.selection}
        intensity={colors.additiveGlow ? 2.2 : 0.3}
        distance={6}
        decay={2}
      />
      <mesh position={[file.x, file.y, file.z]}>
        <boxGeometry args={[file.width * 1.28, file.height * 1.06, file.depth * 1.28]} />
        <meshBasicMaterial
          color={colors.selection}
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <SceneLabel
        x={file.x}
        y={file.y + file.height / 2 + (preview ? 1.05 : 0.72)}
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
        0.8,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );
  const radius = useMemo(
    () =>
      Math.max(
        6,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxZ - layout.bounds.minZ) / 2,
        layout.bounds.maxHeight * 1.6,
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
      direction: new THREE.Vector3(0.48, 0.82, 0.68).normalize(),
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
      new THREE.Vector3(file.x, file.y, file.z),
      distance,
      new THREE.Vector3(0.48, 0.7, 0.58).normalize(),
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
  const selectedCluster = selectedFile
    ? layout.clusters.find((cluster) => cluster.path === selectedFile.clusterPath) ?? null
    : null;

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
        6,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxZ - layout.bounds.minZ) / 2,
        layout.bounds.maxHeight * 1.6,
      ),
    [layout],
  );

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
          radius * (themeColors.additiveGlow ? 0.95 : 1.8),
          radius * (themeColors.additiveGlow ? 3.4 : 5.8),
        ]}
      />
      <ambientLight intensity={themeColors.additiveGlow ? 0.58 : 1} />
      <hemisphereLight
        args={[themeColors.text, themeColors.platform, themeColors.additiveGlow ? 0.55 : 0.85]}
      />
      <directionalLight
        position={[center.x + radius * 0.4, radius * 1.5, center.z + radius * 0.35]}
        intensity={themeColors.additiveGlow ? 1.45 : 1.85}
        color={themeColors.text}
      />
      <pointLight
        position={[center.x, 6, center.z]}
        color={themeColors.selection}
        intensity={themeColors.additiveGlow ? 1.6 : 0.3}
        distance={radius * 2}
        decay={2}
      />
      <NebulaField center={center} radius={radius} colors={themeColors} reduced={Boolean(reduceMotion)} />
      <IslandField
        clusters={layout.clusters}
        selectedClusterPath={selectedCluster?.path ?? null}
        colors={themeColors}
      />
      <EnergyBridges clusters={layout.clusters} colors={themeColors} />
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
          cluster={selectedCluster}
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
            y={hoveredFile.y + hoveredFile.height / 2 + 0.38}
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
        camera={{ position: [18, 22, 24], fov: 42, near: 0.1, far: 4000 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#000000"), 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
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
