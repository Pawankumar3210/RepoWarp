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
import type { Theme } from "../../types/domain";
import type { GraphEdge, GraphLayout, GraphNode } from "../../features/history/graphLayout";
import { SCENE_THEMES } from "../../styles/themeTokens";
import { formatDate, shortSha, truncate } from "../../utils/format";
import { registerSceneCapture } from "../shared/sceneCapture";
import { SceneUnavailable } from "../shared/SceneUnavailable";
import { supportsWebGL } from "../shared/webgl";
import { fitCamera, focusCamera, panCamera } from "../shared/cameraFraming";
import { SceneLabel, SceneLabelLayer } from "../shared/SceneLabel";
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

function buildEdgeGeometry(
  edges: GraphEdge[],
  nodes: Map<string, GraphNode>,
  colors: (typeof SCENE_THEMES)[Theme],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colorValues: number[] = [];
  const curveColor = new THREE.Color();
  const segments = 12;

  for (const edge of edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) continue;
    const start = new THREE.Vector3(from.x, from.y, from.z);
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const control = new THREE.Vector3(
      (from.x + to.x) / 2,
      from.y,
      (from.z + to.z) / 2,
    );
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const points = curve.getPoints(segments);
    const laneColor =
      colors.lanePalette[edge.lane % colors.lanePalette.length] ?? colors.edge;
    curveColor.set(
      edge.type === "merge"
        ? colors.mergeEdge
        : edge.type === "boundary"
          ? colors.boundary
          : laneColor,
    );
    for (let index = 0; index < points.length - 1; index += 1) {
      const point = points[index];
      const next = points[index + 1];
      if (!point || !next) continue;
      positions.push(point.x, point.y, point.z, next.x, next.y, next.z);
      colorValues.push(
        curveColor.r,
        curveColor.g,
        curveColor.b,
        curveColor.r,
        curveColor.g,
        curveColor.b,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colorValues, 3));
  geometry.computeBoundingSphere();
  return geometry;
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
    const stride = Math.max(1, Math.ceil(edges.length / 56));
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
      const start = new THREE.Vector3(from.x, from.y, from.z);
      const end = new THREE.Vector3(to.x, to.y, to.z);
      const control = new THREE.Vector3(
        (from.x + to.x) / 2,
        from.y,
        (from.z + to.z) / 2,
      );
      const colorValue =
        edge.type === "merge"
          ? colors.mergeEdge
          : edge.type === "boundary"
            ? colors.boundary
            : colors.lanePalette[edge.lane % colors.lanePalette.length] ?? colors.edge;
      result.push({
        curve: new THREE.QuadraticBezierCurve3(start, control, end),
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
      dummy.scale.setScalar(0.72 + Math.sin(t * Math.PI) * 0.55);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (streams.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, streams.length]} frustumCulled={false}>
      <sphereGeometry args={[0.045, 6, 6]} />
      <meshBasicMaterial
        transparent
        opacity={colors.additiveGlow ? 0.7 : 0.42}
        depthWrite={false}
        toneMapped={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

function EdgePulse({
  from,
  to,
  color,
  reduced,
  offset,
}: {
  from: GraphNode;
  to: GraphNode;
  color: string;
  reduced: boolean;
  offset: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const start = new THREE.Vector3(from.x, from.y, from.z);
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const control = new THREE.Vector3(
      (from.x + to.x) / 2,
      from.y,
      (from.z + to.z) / 2,
    );
    return new THREE.QuadraticBezierCurve3(start, control, end);
  }, [from, to]);

  useFrame((state) => {
    if (!ref.current) return;
    if (reduced) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const t = (state.clock.elapsedTime * 0.22 + offset) % 1;
    ref.current.position.copy(curve.getPoint(t));
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 6 + offset * 8) * 0.18;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.075, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
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
  const beamRef = useRef<THREE.Mesh>(null);
  const commit = layout.commitsBySha.get(node.sha);
  const floorY = layout.bounds.minY - 4;
  const position: [number, number, number] = [node.x, node.y, node.z];
  const beamHeight = Math.max(0.1, node.y - floorY);

  useFrame((state) => {
    if (reduced) return;
    const time = state.clock.elapsedTime;
    if (pulseRef.current) {
      const scale = 1 + (Math.sin(time * 2.4) + 1) * 0.22;
      pulseRef.current.scale.setScalar(scale);
      const material = pulseRef.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.44 - (scale - 1) * 0.75;
      }
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.z = time * 0.9;
      orbitRef.current.rotation.x = Math.sin(time * 0.5) * 0.35;
    }
    if (beamRef.current) {
      const material = beamRef.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.1 + (Math.sin(time * 2.1) + 1) * 0.045;
      }
    }
  });

  return (
    <group>
      <mesh ref={beamRef} position={[node.x, floorY + beamHeight / 2, node.z]}>
        <cylinderGeometry args={[0.018, 0.05, beamHeight, 6, 1, true]} />
        <meshBasicMaterial
          color={colors.selection}
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </mesh>
      <Line
        points={[
          [node.x, floorY, node.z],
          [node.x, node.y - 0.28, node.z],
        ]}
        color={colors.selection}
        transparent
        opacity={0.22}
        lineWidth={1}
      />
      <Billboard position={position}>
        <mesh ref={pulseRef}>
          <ringGeometry args={[0.34, 0.43, 48]} />
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
          <ringGeometry args={[0.4, 0.425, 48, 1, 0, Math.PI * 1.35]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.62}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <ringGeometry args={[0.28, 0.33, 48]} />
          <meshBasicMaterial
            color={colors.selection}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <circleGeometry args={[0.22, 32]} />
          <meshBasicMaterial color={colors.selection} toneMapped={false} />
        </mesh>
      </Billboard>
      <pointLight
        position={position}
        color={colors.selection}
        intensity={colors.additiveGlow ? 2.4 : 0.35}
        distance={7}
        decay={2}
      />
      {showLabel && commit ? (
        <SceneLabel
          x={node.x}
          y={node.y + (preview ? 1.1 : 0.92)}
          z={node.z}
          priority={4}
          html={`<div class="glass flex max-w-[18rem] items-center gap-2 rounded-xl px-2.5 py-1.5${preview ? " scale-90" : ""}"><span class="h-1.5 w-1.5 shrink-0 rounded-full" style="background:${colors.selection}"></span><span class="truncate text-[0.7rem] font-semibold text-ink">${escapeHtml(truncate(commit.subject, 46))}</span><span class="shrink-0 font-mono text-[0.58rem] text-faint">${escapeHtml(shortSha(commit.sha, 6))}</span></div>`}
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
  const glowRef = useRef<THREE.Points>(null);

  const glowGeometry = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const colorValues = new Float32Array(nodes.length * 3);
    const color = new THREE.Color();
    nodes.forEach((node, index) => {
      positions[index * 3] = node.x;
      positions[index * 3 + 1] = node.y;
      positions[index * 3 + 2] = node.z;
      color.set(colorForNode(node, colors));
      colorValues[index * 3] = color.r;
      colorValues[index * 3 + 1] = color.g;
      colorValues[index * 3 + 2] = color.b;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colorValues, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }, [nodes, colors]);

  useEffect(() => () => glowGeometry.dispose(), [glowGeometry]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hoverColor = new THREE.Color(colors.hover);
    const selectionColor = new THREE.Color(colors.selection);
    nodes.forEach((node, index) => {
      const isHovered = node.sha === hoveredSha;
      const isSelected = node.sha === selectedSha;
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(isHovered ? 1.62 : node.isMerge ? 1.34 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(colorForNode(node, colors));
      if (isHovered) color.lerp(hoverColor, 0.62);
      if (isSelected) color.lerp(selectionColor, 0.5);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
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
        <octahedronGeometry args={[0.26, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <points ref={glowRef} geometry={glowGeometry} frustumCulled={false}>
        <pointsMaterial
          size={1.25}
          sizeAttenuation
          vertexColors
          transparent
          opacity={colors.additiveGlow ? 0.26 : 0.13}
          depthWrite={false}
          blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
    </group>
  );
}

function NodeShells({
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
      dummy.rotation.set(0.35, node.lane * 0.7, 0.2);
      dummy.scale.setScalar(node.isMerge ? 1.8 : 1.55);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
      <icosahedronGeometry args={[0.22, 0]} />
      <meshBasicMaterial
        color={colors.node}
        wireframe
        transparent
        opacity={colors.additiveGlow ? 0.24 : 0.14}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function WarpBeacons({
  nodes,
  floorY,
  colors,
}: {
  nodes: GraphNode[];
  floorY: number;
  colors: (typeof SCENE_THEMES)[Theme];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    nodes.forEach((node, index) => {
      const height = Math.max(0.2, node.y - floorY);
      dummy.position.set(node.x, floorY + height / 2, node.z);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(colorForNode(node, colors));
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [colors, floorY, nodes]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.012, 0.032, 1, 6, 1, true]} />
      <meshBasicMaterial
        transparent
        opacity={colors.additiveGlow ? 0.22 : 0.14}
        depthWrite={false}
        toneMapped={false}
        blending={colors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

function HoverMarker({
  node,
  floorY,
  colors,
  reduced,
}: {
  node: GraphNode;
  floorY: number;
  colors: (typeof SCENE_THEMES)[Theme];
  reduced: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current || reduced) return;
    ringRef.current.rotation.z = state.clock.elapsedTime * 1.4;
  });

  return (
    <group>
      <Line
        points={[
          [node.x, floorY, node.z],
          [node.x, node.y, node.z],
        ]}
        color={colors.hover}
        transparent
        opacity={0.16}
        lineWidth={1}
      />
      <Billboard position={[node.x, node.y, node.z]}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.27, 0.305, 32, 1, 0, Math.PI * 1.55]} />
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
      dummy.rotation.set(0.4, 0.7, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, nodes.length]}>
      <octahedronGeometry args={[0.19, 0]} />
      <meshBasicMaterial
        color={colors.boundary}
        wireframe
        transparent
        opacity={0.52}
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
      <torusGeometry args={[0.29, 0.012, 8, 40]} />
      <meshBasicMaterial
        color={colors.tag}
        transparent
        opacity={0.72}
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
        (layout.bounds.minY + layout.bounds.maxY) / 2,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );

  const radius = useMemo(
    () =>
      Math.max(
        6,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxY - layout.bounds.minY) * 1.2,
        (layout.bounds.maxZ - layout.bounds.minZ) * 1.8,
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
      direction: new THREE.Vector3(0.5, 0.38, 0.78).normalize(),
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
      new THREE.Vector3(0.55, 0.42, 0.72).normalize(),
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
  const edgeGeometry = useMemo(
    () => buildEdgeGeometry(layout.edges, nodeMap, themeColors),
    [layout.edges, nodeMap, themeColors],
  );
  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  const selectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return layout.edges.filter(
      (edge) => edge.from === selectedNode.id || edge.to === selectedNode.id,
    );
  }, [layout.edges, selectedNode]);

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
        (layout.bounds.minY + layout.bounds.maxY) / 2,
        (layout.bounds.minZ + layout.bounds.maxZ) / 2,
      ),
    [layout],
  );
  const radius = useMemo(
    () =>
      Math.max(
        6,
        (layout.bounds.maxX - layout.bounds.minX) / 2,
        (layout.bounds.maxY - layout.bounds.minY) * 1.2,
        (layout.bounds.maxZ - layout.bounds.minZ) * 1.8,
      ),
    [layout],
  );
  const floorY = layout.bounds.minY - 4;

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
          radius * (themeColors.additiveGlow ? 0.9 : 2.2),
          radius * (themeColors.additiveGlow ? 3.6 : 6.4),
        ]}
      />
      <ambientLight intensity={themeColors.additiveGlow ? 0.85 : 1.1} />
      <directionalLight
        position={[center.x + radius, radius * 1.6, center.z + radius]}
        intensity={themeColors.additiveGlow ? 1.5 : 1.8}
        color={themeColors.text}
      />
      <Line
        points={[
          [layout.bounds.minX - 3, floorY + 0.01, 0],
          [layout.bounds.maxX + 3, floorY + 0.01, 0],
        ]}
        color={themeColors.edgeDim}
        transparent
        opacity={0.42}
        lineWidth={1}
      />
      <WarpBeacons nodes={layout.commitNodes} floorY={floorY} colors={themeColors} />
      <lineSegments geometry={edgeGeometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={themeColors.additiveGlow ? 0.7 : 0.72}
          depthWrite={false}
          toneMapped={themeColors.additiveGlow}
          blending={themeColors.additiveGlow ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </lineSegments>
      <EdgeStreams
        edges={layout.edges}
        nodes={nodeMap}
        colors={themeColors}
        reduced={Boolean(reduceMotion)}
      />
      {selectedEdges.map((edge, index) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        return (
          <group key={`selected-${edge.id}`}>
            <Line
              points={[
                [from.x, from.y + 0.01, from.z],
                [(from.x + to.x) / 2, from.y + 0.01, (from.z + to.z) / 2],
                [to.x, to.y + 0.01, to.z],
              ]}
              color={themeColors.selection}
              transparent
              opacity={0.82}
              lineWidth={1.7}
            />
            <EdgePulse
              from={from}
              to={to}
              color={themeColors.selection}
              reduced={Boolean(reduceMotion)}
              offset={index * 0.23}
            />
          </group>
        );
      })}
      <NodeShells nodes={layout.commitNodes} colors={themeColors} />
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
            floorY={floorY}
            colors={themeColors}
            reduced={Boolean(reduceMotion)}
          />
          <SceneLabel
            x={hoveredNode.x}
            y={hoveredNode.y + 0.48}
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
        camera={{ position: [0, 12, 26], fov: 45, near: 0.1, far: 4000 }}
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
