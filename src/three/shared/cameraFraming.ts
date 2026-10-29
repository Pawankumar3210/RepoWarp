import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface FitCameraOptions {
  center: THREE.Vector3;
  radius: number;
  direction: THREE.Vector3;
  nearDivisor: number;
  minFar: number;
  farFactor: number;
  minDistance: number;
  maxDistanceFactor: number;
}

export function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  options: FitCameraOptions,
): void {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = Math.max(0.55, camera.aspect);
  const distance =
    (options.radius / Math.sin(fov / 2) / aspect) * 1.12;
  camera.position
    .copy(options.center)
    .addScaledVector(options.direction, distance);
  camera.near = Math.max(0.1, distance / options.nearDivisor);
  camera.far = Math.max(options.minFar, distance * options.farFactor);
  camera.updateProjectionMatrix();
  controls.target.copy(options.center);
  controls.minDistance = options.minDistance;
  controls.maxDistance = Math.max(
    options.minDistance * 18,
    distance * options.maxDistanceFactor,
  );
  controls.update();
}

export function focusCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  target: THREE.Vector3,
  distance: number,
  direction: THREE.Vector3,
): void {
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(direction, distance);
  controls.update();
}

export function panCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  x: number,
  y: number,
): void {
  if (x === 0 && y === 0) return;
  const distance = camera.position.distanceTo(controls.target);
  const step = THREE.MathUtils.clamp(distance * 0.14, 0.7, 16);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const offset = right.multiplyScalar(x * step).add(up.multiplyScalar(y * step));
  camera.position.add(offset);
  controls.target.add(offset);
  controls.update();
}
