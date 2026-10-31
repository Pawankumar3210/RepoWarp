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
import type { Theme } from "../../types/domain";
import type { GraphEdge, GraphLayout, GraphNode } from "../../features/history/graphLayout";
import { SCENE_THEMES } from "../../styles/themeTokens";
import { formatDate, shortSha, truncate } from "../../utils/format";
import { registerSceneCapture } from "../shared/sceneCapture";
import { SceneUnavailable } from "../shared/SceneUnavailable";
import { supportsWebGL } from "../shared/webgl";
import { fitCamera, focusCamera, panCamera } from "../shared/cameraFraming";
import { SceneLabel, SceneLabelLayer } from "../shared/SceneLabel";
import { NebulaField } from "../shared/NebulaField";
import { escapeHtml } from "../../utils/html";
import { useSceneBus } from "../../store/sceneBus";
import { cn } from "../../utils/cn";

export interface HistorySceneProps {
  layout: GraphLayout;
  selectedSha: string | null;
  onSelect?: (sha: string) => void;
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

interface SceneProps extends Omit<HistorySceneProps, "className"> {
  themeColors: (typeof SCENE_THEMES)[Theme];
}

const SELECTED_GOLD = "#ffb347";
const UP = new THREE.Vector3(0, 1, 0);

function colorForNode(
  node: GraphNode,
  colors: (typeof SCENE_THEMES)[Theme],
): string {
  return node.isMerge
    ? colors.merge
    : node.tags.length > 0
      ? colors.tag
    : colors.lanePalette[node.lane % colors.lanePalette.length] ?? colors.node;
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

function edgeCurve(from: GraphNode, to: GraphNode, type: GraphEdge["type"]): THREE.QuadraticBezierCurve3 {
  const start = new THREE.Vector3(from.x, from.y, from.z);
  const end = new THREE.Vector3(to.x, to.y, to.z);
  const lift = type === "merge" ? 0.7 : type === "boundary" ? 0.18 : 0.32;
  const sway = Math.min(2.4, Math.abs(end.z - start.z) * 0.38 + 0.85);
  const control = new THREE.Vector3(
    (from.x + to.x) / 2,
    Math.max(from.y, to.y) + lift,
    (from.z + to.z) / 2 + Math.sign(to.z - from.z || 1) * sway * (type === "merge" ? 1.15 : 1),
  );
  return new THREE.QuadraticBezierCurve3(start, control, end);
}

function PolarDisc({
  center,
  radius,
  colors,
}: {
  center: THREE.Vector3;
  radius: number;
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const rings = useMemo(() => {
    const count = 7;
    return Array.from({ length: count }, (_, index) => ((index + 1) / count) * radius);
  }, [radius]);

  const spokes = useMemo(() => {
    const count = 24;
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return [
        new THREE.Vector3(center.x, 0.01, center.z),
        new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          0.01,
          center.z + Math.sin(angle) * radius,
        ),
      ] as const;
    });
  }, [center, radius]);

  const grid = useMemo(() => {
    const values: number[] = [];
    const step = Math.max(1.6, radius / 10);
    for (let x = center.x - radius; x <= center.x + radius + 0.01; x += step) {
      values.push(x, 0.012, center.z - radius, x, 0.012, center.z + radius);
    }
    for (let z = center.z - radius; z <= center.z + radius + 0.01; z += step) {
      values.push(center.x - radius, 0.012, z, center.x + radius, 0.012, z);
    }
    return new Float32Array(values);
  }, [center, radius]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]}>
        <circleGeometry args={[radius, 72]} />
        <meshBasicMaterial
          color={colors.platform}
          transparent
          opacity={colors.additiveGlow ? 0.22 : 0.34}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.04, center.z]}>
        <ringGeometry args={[radius * 0.98, radius * 1.035, 80]} />
        <meshBasicMaterial
          color={colors.platformEdge}
          transparent
          opacity={colors.additiveGlow ? 0.55 : 0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </mesh>
      {rings.map((ring) => (
        <mesh
          key={`ring-${ring.toFixed(2)}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[center.x, 0.018, center.z]}
        >
          <ringGeometry args={[ring - 0.018, ring + 0.018, 80]} />
          <meshBasicMaterial
            color={colors.gridMajor}
            transparent
            opacity={colors.additiveGlow ? 0.28 : 0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {spokes.map((points, index) => (
        <line key={`spoke-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([
                points[0].x, points[0].y, points[0].z,
                points[1].x, points[1].y, points[1].z,
              ]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={colors.gridMinor}
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </line>
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[grid, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={colors.gridMinor}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function SparkField({
  center,
  radius,
  colors,
}: {
  center: THREE.Vector3;
  radius: number;
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const geometry = useMemo(() => {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 8.13;
      const dist = ((index * 17) % 100) / 100 * radius * 0.92;
      positions[index * 3] = center.x + Math.cos(angle) * dist;
      positions[index * 3 + 1] = 0.08 + ((index * 13) % 7) * 0.04;
      positions[index * 3 + 2] = center.z + Math.sin(angle * 1.37) * dist;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [center, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={colors.node}
        size={0.08}
        sizeAttenuation
        transparent
        opacity={colors.additiveGlow ? 0.45 : 0.22}
        depthWrite={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}

function EdgeTubes({
  edges,
  nodes,
  colors,
  selectedId,
}: {
  edges: GraphEdge[];
  nodes: Map<string, GraphNode>;
  colors: (typeof SCENE_THEMES)[Theme];
  selectedId: string | null;
}) {
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const segments = edges.length > 420 ? 6 : 10;

  const pieces = useMemo(() => {
    const result: Array<{
      mid: THREE.Vector3;
      dir: THREE.Vector3;
      length: number;
      color: THREE.Color;
      selected: boolean;
    }> = [];
    for (const edge of edges) {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) continue;
      const curve = edgeCurve(from, to, edge.type);
      const points = curve.getPoints(segments);
      const selected = selectedId === from.id || selectedId === to.id;
      const color = new THREE.Color(
        selected
          ? SELECTED_GOLD
          : edge.type === "merge"
            ? colors.mergeEdge
            : edge.type === "boundary"
              ? colors.boundary
              : colors.lanePalette[edge.lane % colors.lanePalette.length] ?? colors.edge,
      );
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        if (!a || !b) continue;
        const dir = b.clone().sub(a);
        const length = dir.length();
        if (length < 0.001) continue;
        dir.normalize();
        result.push({
          mid: a.clone().add(b).multiplyScalar(0.5),
          dir,
          length,
          color,
          selected,
        });
      }
    }
    return result;
  }, [colors, edges, nodes, segments, selectedId]);

  useLayoutEffect(() => {
    const core = coreRef.current;
    const glow = glowRef.current;
    if (!core || !glow) return;
    pieces.forEach((piece, index) => {
      dummy.position.copy(piece.mid);
      dummy.quaternion.setFromUnitVectors(UP, piece.dir);
      dummy.scale.set(piece.selected ? 0.055 : 0.042, piece.length, piece.selected ? 0.055 : 0.042);
      dummy.updateMatrix();
      core.setMatrixAt(index, dummy.matrix);
      core.setColorAt(index, piece.color);
      dummy.scale.set(piece.selected ? 0.13 : 0.1, piece.length, piece.selected ? 0.13 : 0.1);
      dummy.updateMatrix();
      glow.setMatrixAt(index, dummy.matrix);
      glow.setColorAt(index, piece.color);
    });
    core.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    core.computeBoundingSphere();
    glow.computeBoundingSphere();
  }, [dummy, pieces]);

  if (pieces.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={coreRef} args={[undefined, undefined, pieces.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 7]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, pieces.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 7]} />
        <meshBasicMaterial
          transparent
          opacity={colors.additiveGlow ? 0.22 : 0.16}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </instancedMesh>
    </group>
  );
}

function EdgeStreams({
  edges,
  nodes,
  colors,
  reduced,
}: {
  edges: GraphEdge[];
  nodes: Map<string, GraphNode>;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const streams = useMemo(() => {
    const stride = Math.max(1, Math.ceil(edges.length / 48));
    const result: Array<{
      curve: THREE.QuadraticBezierCurve3;
      color: THREE.Color;
      offset: number;
    }> = [];
    edges.forEach((edge, index) => {
      if (index % stride !== 0) return;
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) return;
      const colorValue =
        edge.type === "merge"
          ? colors.mergeEdge
          : edge.type === "boundary"
            ? colors.boundary
            : colors.lanePalette[edge.lane % colors.lanePalette.length] ?? colors.edge;
      result.push({
        curve: edgeCurve(from, to, edge.type),
        color: new THREE.Color(colorValue),
        offset: (index * 0.173) % 1,
      });
    });
    return result;
  }, [colors, edges, nodes]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    streams.forEach((stream, index) => {
      stream.curve.getPoint(stream.offset, dummy.position);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, stream.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, streams]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reduced) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    streams.forEach((stream, index) => {
      const t = (state.clock.elapsedTime * 0.18 + stream.offset) % 1;
      stream.curve.getPoint(t, dummy.position);
      dummy.scale.setScalar(0.85 + Math.sin(t * Math.PI) * 0.7);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (streams.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, streams.length]} frustumCulled={false}>
      <sphereGeometry args={[0.055, 8, 8]} />
      <meshBasicMaterial
        transparent
        opacity={colors.additiveGlow ? 0.85 : 0.5}
        depthWrite={false}
        toneMapped={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

function SelectedMarker({
  node,
  layout,
  colors,
  reduced,
  showLabel,
  preview,
}: {
  node: GraphNode;
  layout: GraphLayout;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
  showLabel: boolean;
  preview: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Mesh>(null);
  const commit = layout.commitsBySha.get(node.sha);
  const position: [number, number, number] = [node.x, node.y, node.z];

  useFrame((state) => {
    if (reduced) return;
    const time = state.clock.elapsedTime;
    if (pulseRef.current) {
      const scale = 1 + (Math.sin(time * 2.4) + 1) * 0.22;
      pulseRef.current.scale.setScalar(scale);
      const material = pulseRef.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.5 - (scale - 1) * 0.7;
      }
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.z = time * 0.9;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[node.x, 0.03, node.z]}>
        <circleGeometry args={[0.55, 28]} />
        <meshBasicMaterial
          color={SELECTED_GOLD}
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </mesh>
      <Billboard position={position}>
        <mesh ref={pulseRef}>
          <ringGeometry args={[0.34, 0.44, 48]} />
          <meshBasicMaterial
            color={SELECTED_GOLD}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={orbitRef}>
          <ringGeometry args={[0.46, 0.49, 48, 1, 0, Math.PI * 1.35]} />
          <meshBasicMaterial
            color={SELECTED_GOLD}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <mesh position={position}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshBasicMaterial color={SELECTED_GOLD} toneMapped={false} />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshBasicMaterial
          color={SELECTED_GOLD}
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </mesh>
      <pointLight
        position={position}
        color={SELECTED_GOLD}
        intensity={colors.additiveGlow ? 2.8 : 0.4}
        distance={8}
        decay={2}
      />
      {showLabel && commit ? (
        <SceneLabel
          x={node.x}
          y={node.y + (preview ? 1.15 : 0.98)}
          z={node.z}
          priority={4}
          html={`<div class="glass flex max-w-[20rem] flex-col gap-0.5 rounded-xl px-3 py-2${preview ? " scale-90" : ""}"><p class="truncate text-[0.72rem] font-semibold text-ink">${escapeHtml(truncate(commit.subject, 48))}</p><p class="font-mono text-[0.55rem] text-faint">${escapeHtml(formatDate(commit.committedAt))} · ${escapeHtml(shortSha(commit.sha, 6))}</p></div>`}
        />
      ) : null}
    </group>
  );
}

function NodeCloud({
  nodes,
  colors,
  selectedSha,
  hoveredSha,
  onHover,
  onSelect,
  interactive,
}: {
  nodes: GraphNode[];
  colors: (typeof SCENE_THEMES)[Theme];
  selectedSha: string | null;
  hoveredSha: string | null;
  onHover: (sha: string | null) => void;
  onSelect?: (sha: string) => void;
  interactive: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (!mesh || !halo) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hoverColor = new THREE.Color(colors.hover);
    const selectionColor = new THREE.Color(SELECTED_GOLD);
    nodes.forEach((node, index) => {
      const isHovered = node.sha === hoveredSha;
      const isSelected = node.sha === selectedSha;
      const scale = isSelected ? 0 : isHovered ? 1.35 : node.isMerge ? 1.22 : 1;
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      dummy.scale.setScalar(scale === 0 ? 0 : scale * 1.85);
      dummy.updateMatrix();
      halo.setMatrixAt(index, dummy.matrix);
      color.set(colorForNode(node, colors));
      if (isHovered) color.lerp(hoverColor, 0.45);
      if (isSelected) color.lerp(selectionColor, 1);
      mesh.setColorAt(index, color);
      halo.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    halo.computeBoundingSphere();
  }, [nodes, colors, hoveredSha, selectedSha]);

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (event.instanceId == null) return;
    const node = nodes[event.instanceId];
    onHover(node?.sha ?? null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    event.stopPropagation();
    if (event.instanceId == null) return;
    const node = nodes[event.instanceId];
    if (node) onSelect?.(node.sha);
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(1, nodes.length)]}
        onPointerMove={interactive ? handleMove : undefined}
        onPointerOut={interactive ? () => onHover(null) : undefined}
        onClick={interactive ? handleClick : undefined}
      >
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={haloRef}
        args={[undefined, undefined, Math.max(1, nodes.length)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={colors.additiveGlow ? 0.28 : 0.16}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </instancedMesh>
    </group>
  );
}

function HoverMarker({
  node,
  colors,
  reduced,
}: {
  node: GraphNode;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current || reduced) return;
    ringRef.current.rotation.z = state.clock.elapsedTime * 1.4;
  });

  return (
    <Billboard position={[node.x, node.y, node.z]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.28, 0.32, 32, 1, 0, Math.PI * 1.55]} />
        <meshBasicMaterial
          color={colors.hover}
          transparent
          opacity={0.86}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

function BoundaryMarkers({
  nodes,
  colors,
}: {
  nodes: GraphNode[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    nodes.forEach((node, index) => {
      dummy.position.set(node.x, node.y, node.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, nodes.length]}>
      <sphereGeometry args={[0.12, 10, 10]} />
      <meshBasicMaterial
        color={colors.boundary}
        transparent
        opacity={0.55}
        wireframe
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function TagRings({
  nodes,
  colors,
}: {
  nodes: GraphNode[];
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    nodes.forEach((node, index) => {
      dummy.position.set(node.x, node.y, node.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, nodes.length]}>
      <torusGeometry args={[0.3, 0.012, 8, 40]} />
      <meshBasicMaterial
        color={colors.tag}
        transparent
        opacity={0.78}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function CameraRig({
  layout,
  interactive,
  autoRotate,
  reduced,
  controlsRef,
}: {
  layout: GraphLayout;
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
        0.45,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );

  const radius = useMemo(
    () =>
      Math.max(
        8,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxZ - layout.bounds.minZ) / 2 + 2,
        6,
      ),
    [layout],
  );
  const previousLayoutRef = useRef<GraphLayout | null>(null);
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
      direction: new THREE.Vector3(0.28, 0.72, 0.78).normalize(),
      nearDivisor: 500,
      minFar: 600,
      farFactor: 8,
      minDistance: 1.4,
      maxDistanceFactor: 2.4,
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
    if (focusView !== "history" || !focusId) return;
    const node = layout.nodes.find((candidate) => candidate.sha === focusId);
    const controls = controlsRef.current;
    if (!node || !controls) return;
    const distance = Math.min(34, Math.max(5, radius * 0.24));
    focusCamera(
      camera as THREE.PerspectiveCamera,
      controls,
      new THREE.Vector3(node.x, node.y, node.z),
      distance,
      new THREE.Vector3(0.4, 0.62, 0.72).normalize(),
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
      autoRotateSpeed={0.4}
    />
  );
}

function HistorySceneContent({
  layout,
  selectedSha,
  onSelect,
  themeColors,
  reduceMotion,
  interactive,
  autoRotate,
  preview,
  capture,
}: SceneProps) {
  const [hoveredSha, setHoveredSha] = useState<string | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const nodesBySha = useMemo(
    () => new Map(layout.nodes.map((node) => [node.sha, node])),
    [layout.nodes],
  );
  const nodeMap = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );
  const selectedNode = selectedSha ? nodesBySha.get(selectedSha) : undefined;
  const hoveredNode =
    hoveredSha && hoveredSha !== selectedSha ? nodesBySha.get(hoveredSha) : undefined;
  const hoveredCommit = hoveredSha ? layout.commitsBySha.get(hoveredSha) : undefined;

  const tagNodes = useMemo(
    () => layout.commitNodes.filter((node) => node.tags.length > 0),
    [layout.commitNodes],
  );

  const labeledNodes = useMemo(() => {
    if (preview) return [];
    return layout.commitNodes
      .filter((node) => node.refs.length > 0 && node.sha !== selectedSha)
      .slice(0, 8);
  }, [layout.commitNodes, preview, selectedSha]);

  const center = useMemo(
    () =>
      new THREE.Vector3(
        (layout.bounds.minX + layout.bounds.maxX) / 2,
        0.2,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );
  const radius = useMemo(
    () =>
      Math.max(
        8,
        Math.hypot(
          (layout.bounds.maxX - layout.bounds.minX) / 2,
          (layout.bounds.maxZ - layout.bounds.minZ) / 2,
        ) + 4,
      ),
    [layout],
  );

  useEffect(() => {
    if (!interactive) return;
    document.body.style.cursor = hoveredSha ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredSha, interactive]);

  return (
    <>
      {capture ? <CaptureBridge /> : null}
      <SceneLabelLayer />
      <fog
        attach="fog"
        args={[
          themeColors.fog,
          radius * (themeColors.additiveGlow ? 0.85 : 2.0),
          radius * (themeColors.additiveGlow ? 3.2 : 6.0),
        ]}
      />
      <ambientLight intensity={themeColors.additiveGlow ? 0.7 : 1.05} />
      <directionalLight
        position={[center.x + radius * 0.4, radius * 1.1, center.z + radius * 0.3]}
        intensity={themeColors.additiveGlow ? 1.35 : 1.7}
        color={themeColors.text}
      />
      <pointLight
        position={[center.x, 3.2, center.z]}
        color={themeColors.node}
        intensity={themeColors.additiveGlow ? 1.8 : 0.35}
        distance={radius * 1.6}
        decay={2}
      />
      <NebulaField center={center} radius={radius} colors={themeColors} reduced={Boolean(reduceMotion)} />
      <PolarDisc center={center} radius={radius} colors={themeColors} />
      <SparkField center={center} radius={radius} colors={themeColors} />
      <EdgeTubes
        edges={layout.edges}
        nodes={nodeMap}
        colors={themeColors}
        selectedId={selectedNode?.id ?? null}
      />
      <EdgeStreams
        edges={layout.edges}
        nodes={nodeMap}
        colors={themeColors}
        reduced={Boolean(reduceMotion)}
      />
      <NodeCloud
        nodes={layout.commitNodes}
        colors={themeColors}
        selectedSha={selectedSha}
        hoveredSha={hoveredSha}
        onHover={setHoveredSha}
        onSelect={onSelect}
        interactive={Boolean(interactive)}
      />
      <BoundaryMarkers nodes={layout.boundaryNodes} colors={themeColors} />
      <TagRings nodes={tagNodes} colors={themeColors} />
      {selectedNode ? (
        <SelectedMarker
          node={selectedNode}
          layout={layout}
          colors={themeColors}
          reduced={Boolean(reduceMotion)}
          showLabel
          preview={Boolean(preview)}
        />
      ) : null}
      {hoveredNode && hoveredCommit ? (
        <group>
          <HoverMarker
            node={hoveredNode}
            colors={themeColors}
            reduced={Boolean(reduceMotion)}
          />
          <SceneLabel
            x={hoveredNode.x}
            y={hoveredNode.y + 0.52}
            z={hoveredNode.z}
            priority={5}
            html={`<div class="glass max-w-[16rem] rounded-lg px-2.5 py-1.5"><p class="truncate text-[0.68rem] font-semibold text-ink">${escapeHtml(truncate(hoveredCommit.subject, 48))}</p><p class="mt-0.5 font-mono text-[0.55rem] text-faint">${escapeHtml(shortSha(hoveredCommit.sha, 7))} · ${escapeHtml(formatDate(hoveredCommit.committedAt))}</p></div>`}
          />
        </group>
      ) : null}
      {labeledNodes.map((node) => (
        <SceneLabel
          key={`ref-${node.sha}`}
          x={node.x}
          y={node.y + 0.48}
          z={node.z}
          priority={1}
          html={`<span class="chip chip-aqua !h-[1.35rem] !text-[0.55rem]">${escapeHtml(truncate(node.refs[0] ?? "branch", 18))}${node.refs.length > 1 ? ` +${node.refs.length - 1}` : ""}</span>`}
        />
      ))}
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

export function HistoryScene({
  layout,
  selectedSha,
  onSelect,
  theme,
  reduceMotion = false,
  interactive = true,
  autoRotate = false,
  preview = false,
  capture = false,
  className,
  neutralPreview = false,
}: HistorySceneProps) {
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
          ? `Interactive 3D history graph with ${layout.commitNodes.length} commits. Orbit, zoom, and select a node.`
          : "Preview of a 3D commit history graph"
      }
      style={interactive ? undefined : { pointerEvents: "none" }}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 16, 22], fov: 42, near: 0.1, far: 4000 }}
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
        <HistorySceneContent
          layout={layout}
          selectedSha={selectedSha}
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
