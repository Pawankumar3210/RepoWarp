import { Component, useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Scene } from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  clampLabelElements,
  registerLabelElement,
} from "./sceneLabelRegistry";

export function SceneLabelLayer() {
  const { gl, scene, camera, size } = useThree();
  const layer = useMemo(() => {
    const renderer = new CSS2DRenderer();
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.zIndex = "5";
    return renderer;
  }, []);

  useLayoutEffect(() => {
    const parent = gl.domElement.parentNode;
    if (!parent) return;
    parent.appendChild(layer.domElement);
    return () => {
      layer.domElement.remove();
    };
  }, [gl, layer]);

  useLayoutEffect(() => {
    layer.setSize(size.width, size.height);
  }, [layer, size.height, size.width]);

  useFrame(() => {
    layer.render(scene, camera);
    clampLabelElements(layer.domElement.parentElement);
  });

  return null;
}

interface SceneLabelProps {
  x: number;
  y: number;
  z: number;
  html: string;
  className?: string;
  priority?: number;
}

interface SceneLabelNodeProps extends SceneLabelProps {
  scene: Scene;
}

class SceneLabelNode extends Component<SceneLabelNodeProps> {
  private element: HTMLDivElement | null = null;
  private object: CSS2DObject | null = null;

  componentDidMount() {
    const element = document.createElement("div");
    const object = new CSS2DObject(element);
    object.center.set(0.5, 0.5);
    object.position.set(this.props.x, this.props.y, this.props.z);
    element.className = this.props.className ?? "";
    element.dataset.labelPriority = String(this.props.priority ?? 0);
    element.innerHTML = this.props.html;
    this.element = element;
    this.object = object;
    this.props.scene.add(object);
    this.unregister = registerLabelElement(element);
  }

  private unregister: (() => void) | null = null;

  componentDidUpdate(previous: SceneLabelNodeProps) {
    const { object, element } = this;
    if (!object || !element) return;
    if (
      previous.x !== this.props.x ||
      previous.y !== this.props.y ||
      previous.z !== this.props.z
    ) {
      object.position.set(this.props.x, this.props.y, this.props.z);
    }
    if (previous.html !== this.props.html) element.innerHTML = this.props.html;
    if (previous.className !== this.props.className) {
      element.className = this.props.className ?? "";
    }
    if (previous.priority !== this.props.priority) {
      element.dataset.labelPriority = String(this.props.priority ?? 0);
    }
  }

  componentWillUnmount() {
    if (this.object) this.props.scene.remove(this.object);
    this.unregister?.();
    this.unregister = null;
    this.element?.remove();
    this.object = null;
    this.element = null;
  }

  render() {
    return null;
  }
}

export function SceneLabel(props: SceneLabelProps) {
  const { scene } = useThree();
  return <SceneLabelNode scene={scene} {...props} />;
}
