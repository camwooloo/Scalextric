import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
export function makeCar(spec) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: 0.55,
    roughness: 0.25,
    clearcoat: 1,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x10171a,
    roughness: 0.3,
    metalness: 0.5,
  });
  function box(w, h, d, x, y, z, m) {
    let o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  const mini = spec.id === "mini",
    muscle = spec.id === "ford";
  box(1.02, 0.25, mini ? 1.7 : 2.1, 0, 0.32, 0, paint);
  box(0.93, 0.2, 1.8, 0, 0.49, 0, paint);
  let cabin = box(
    0.77,
    mini ? 0.47 : 0.34,
    mini ? 1.02 : 0.86,
    0,
    0.73,
    mini ? -0.08 : -0.12,
    dark,
  );
  cabin.rotation.x = -0.08;
  box(0.74, 0.07, 0.66, 0, mini ? 1 : 0.92, -0.18, paint);
  box(
    0.18,
    0.012,
    0.64,
    0,
    mini ? 1.04 : 0.963,
    -0.18,
    new THREE.MeshStandardMaterial({ color: 0xf6f0df }),
  );
  box(
    0.18,
    0.015,
    0.64,
    0,
    0.61,
    0.62,
    new THREE.MeshStandardMaterial({ color: 0xf6f0df }),
  );
  if (!mini) {
    box(1.15, 0.07, 0.23, 0, 0.8, -0.91, dark);
    for (let x of [-0.4, 0.4]) box(0.045, 0.23, 0.04, x, 0.67, -0.91, dark);
  }
  for (let x of [-0.53, 0.53])
    for (let z of [-0.64, 0.64]) {
      let wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.17, 16),
        dark,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.28, z);
      g.add(wheel);
      let rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.175, 8),
        new THREE.MeshStandardMaterial({
          color: 0xb9bdba,
          metalness: 0.9,
          roughness: 0.2,
        }),
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(wheel.position);
      g.add(rim);
    }
  const lights = new THREE.MeshStandardMaterial({
    color: 0xfff3cd,
    emissive: 0xffedb6,
    emissiveIntensity: 2,
  });
  for (let x of [-0.33, 0.33]) {
    box(0.22, 0.085, 0.035, x, 0.5, mini ? 0.86 : 1.055, lights);
    box(
      0.22,
      0.06,
      0.035,
      x,
      0.49,
      -1.055,
      new THREE.MeshStandardMaterial({ color: 0xfe3022, emissive: 0xff2211 }),
    );
  }
  if (muscle) box(0.65, 0.045, 0.3, 0, 0.63, 0.5, dark);
  return g;
}
export class World {
  constructor(el) {
    this.el = el;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#1c2525");
    this.scene.fog = new THREE.Fog("#1c2525", 60, 140);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    el.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 200);
    this.camera.position.set(33, 36, 42);
    this.camera.lookAt(0, 0, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xdbe8ea, 0x34443c, 1.3));
    let sun = new THREE.DirectionalLight(0xffefdb, 3);
    sun.position.set(-15, 35, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
    });
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.track = new THREE.Group();
    this.scene.add(this.track);
    this.vehicles = [];
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(el);
    this.resize();
  }
  resize() {
    let w = this.el.clientWidth,
      h = this.el.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  box(w, h, d, x, y, z, color, parent = this.track) {
    let m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.83 }),
    );
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  build(config) {
    while (this.track.children.length) {
      let c = this.track.children[0];
      this.track.remove(c);
      c.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    let pts = config.points.map(
      (p, i) =>
        new THREE.Vector3(p[0], config.bridge && i === 2 ? 3.5 : 0, p[1]),
    );
    this.curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    this.length = this.curve.getLength();
    this.box(39, 0.7, 24, 0, -0.7, 0, 0x566455);
    this.box(39.4, 0.35, 24.4, 0, -1.2, 0, 0x172320);
    const n = 700;
    const ribbon = (a, b, height, color, parity = null) => {
      let vs = [],
        ix = [];
      for (let i = 0; i <= n; i++) {
        let p = this.curve.getPointAt(i / n),
          t = this.curve.getTangentAt(i / n),
          normal = new THREE.Vector3(-t.z, 0, t.x).normalize();
        for (let off of [a, b])
          vs.push(p.x + normal.x * off, p.y + height, p.z + normal.z * off);
        if (
          i < n &&
          (parity === null ||
            Math.floor(((i / n) * this.length) / 1.35) % 2 === parity)
        ) {
          let j = i * 2;
          ix.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
        }
      }
      let geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(vs, 3));
      geom.setIndex(ix);
      geom.computeVertexNormals();
      let mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.88,
          side: THREE.DoubleSide,
        }),
      );
      mesh.receiveShadow = true;
      this.track.add(mesh);
    };
    ribbon(-1.42, 1.42, 0.035, 0x101918);
    ribbon(-1.2, 1.2, 0.05, 0x363b3c);
    for (let lane of [-0.6, 0.6]) {
      ribbon(lane - 0.022, lane + 0.022, 0.065, 0x070a0b);
      for (let off of [-0.072, 0.072])
        ribbon(lane + off - 0.015, lane + off + 0.015, 0.067, 0x9a9f9b);
    }
    for (let off of [-1.17, 1.17])
      ribbon(off - 0.025, off + 0.025, 0.075, 0xd2cbbb);
    for (let i = 0; i < Math.round(this.length / 1.35); i++) {
      let u = i / Math.round(this.length / 1.35),
        p = this.curve.getPointAt(u),
        t = this.curve.getTangentAt(u);
      let seam = this.box(2.4, 0.008, 0.018, p.x, p.y + 0.077, p.z, 0x161c1c);
      seam.rotation.y = Math.atan2(t.x, t.z);
    }
    if (config.borders !== false) {
      for (const side of [-1, 1]) {
        ribbon(side * 1.23, side * 1.53, 0.105, 0xe96c45, 0);
        ribbon(side * 1.23, side * 1.53, 0.105, 0xefe9da, 1);
      }
    }
    for (let i = 0; i < 10; i++) {
      let p = this.curve.getPointAt(i / 10);
      if (p.y > 0.5) this.box(0.28, p.y, 0.28, p.x, p.y / 2, p.z, 0x858c83);
    }
    const start = this.curve.getPointAt(0),
      tan = this.curve.getTangentAt(0);
    let gate = new THREE.Group();
    gate.position.copy(start);
    gate.rotation.y = Math.atan2(tan.x, tan.z);
    this.track.add(gate);
    for (let x of [-1.8, 1.8])
      this.box(0.14, 2.5, 0.14, x, 1.2, 0, 0xc6c9bc, gate);
    this.box(3.8, 0.55, 0.22, 0, 2.5, 0, 0xe8e5d9, gate);
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 2; j++)
        this.box(
          0.24,
          0.012,
          0.2,
          -1.08 + i * 0.24,
          0.082,
          j * 0.2,
          i % 2 === j ? 0xffffff : 0x101414,
          gate,
        );
    let canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e8e5d9";
    ctx.fillRect(0, 0, 512, 80);
    ctx.fillStyle = "#202c29";
    ctx.font = "italic 900 43px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SLOT CLUB", 256, 56);
    let sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.5),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        side: THREE.DoubleSide,
      }),
    );
    sign.position.set(0, 2.5, 0.12);
    gate.add(sign);
    // Miniature trees and trackside architecture.
    for (let i = 0; i < 48; i++) {
      let x = Math.sin(i * 93.7) * 18,
        z = Math.cos(i * 41.3) * 10.5;
      let close = false;
      for (let j = 0; j < 120; j++) {
        let p = this.curve.getPointAt(j / 120);
        if (Math.hypot(x - p.x, z - p.z) < 2.5) {
          close = true;
          break;
        }
      }
      if (close) continue;
      let h = 1.1 + (i % 4) * 0.25;
      this.box(0.1, h, 0.1, x, h / 2 - 0.2, z, 0x705d47);
      let tree = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, h, 7),
        new THREE.MeshStandardMaterial({
          color: [0x344a3e, 0x415946, 0x6c795a][i % 3],
        }),
      );
      tree.position.set(x, h * 0.8, z);
      tree.castShadow = true;
      this.track.add(tree);
    }
    for (let i = 0; i < 3; i++) {
      this.box(2.7, 0.7, 1.2, 3 + i * 3, 0, 10, 0x929c8c);
      this.box(2.8, 0.13, 1.7, 3 + i * 3, 0.6, 10, 0xd9d9c7);
      for (let j = 0; j < 5; j++)
        this.box(0.35, 0.2, 0.4, 2 + i * 3 + j * 0.45, 0.47, 9.6, 0xec6a3c);
    }
    this.box(4, 0.65, 2, -8, 0, -10, 0xe5dfcd);
    this.box(4.3, 0.12, 2.3, -8, 0.4, -10, 0x24302e);
    // Batch static meshes by material to keep mobile draw calls low.
    this.track.updateMatrixWorld(true);
    const batches = new Map(),
      original = [];
    this.track.traverse((o) => {
      if (!o.isMesh || o.material.map) return;
      const key = [
        o.material.color.getHex(),
        o.material.roughness,
        o.material.side,
      ].join("/");
      if (!batches.has(key))
        batches.set(key, { material: o.material.clone(), geometries: [] });
      batches
        .get(key)
        .geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      original.push(o);
    });
    for (const o of original) {
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
    }
    for (const { material, geometries } of batches.values()) {
      const geometry = mergeGeometries(geometries);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.track.add(mesh);
      geometries.forEach((g) => g.dispose());
    }
  }
  setCars(spec, opponent) {
    this.vehicles.forEach((v) => {
      this.scene.remove(v);
      v.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    });
    this.vehicles = [makeCar(spec), makeCar(opponent)];
    this.vehicles.forEach((v) => this.scene.add(v));
  }
  pose(u, lane) {
    u = ((u % 1) + 1) % 1;
    let p = this.curve.getPointAt(u),
      t = this.curve.getTangentAt(u);
    p.add(new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(lane));
    return { p, t };
  }
  draw(state, dt, time) {
    this.vehicles.forEach((v, i) => {
      let { p, t } = this.pose(i ? state.ai : state.progress, i ? 0.6 : -0.6);
      v.position.copy(p);
      v.rotation.set(0, Math.atan2(t.x, t.z), 0);
      if (i === 0 && state.off > 0) {
        v.position.addScaledVector(state.fly, Math.min(state.off * 5, 6));
        v.position.y += Math.max(
          0,
          Math.sin(Math.min(state.off / 1.5, 1) * Math.PI) * 2,
        );
        v.rotation.y += state.off * 5;
        v.rotation.z = state.off * 2;
      }
    });
    let target = new THREE.Vector3(),
      pos = new THREE.Vector3();
    if (state.racing) {
      let { p, t } = this.pose(state.progress, -0.6);
      target.copy(p).addScaledVector(t, 3);
      if (state.cam === "Bumper") {
        pos.copy(p).addScaledVector(t, 1.15);
        pos.y += 0.55;
        target.y += 0.5;
      } else if (state.cam === "Cockpit") {
        pos.copy(p).addScaledVector(t, 0.15);
        pos.y += 1.03;
        target.y += 0.95;
      } else if (state.cam === "Chase") {
        pos.copy(p).addScaledVector(t, -5);
        pos.y += 3;
        target.y += 0.6;
      } else {
        pos.copy(p).add(new THREE.Vector3(12, 17, 14));
        target.copy(p);
      }
    } else {
      let a = 0.1 + Math.sin(time * 0.025) * 0.1;
      pos.set(29 * Math.cos(a), 29, 35 + Math.sin(a) * 7);
      target.set(0, 0, 0);
    }
    this.camera.position.lerp(pos, 1 - Math.exp(-dt * (state.racing ? 6 : 2)));
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  }
}
