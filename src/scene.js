import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadCar, releaseCar, configureModelRenderer } from "./car-models";
export class World {
  constructor(el) {
    this.el = el;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#1c2525");
    this.scene.fog = new THREE.Fog("#1c2525", 60, 140);
    this.renderer = new THREE.WebGLRenderer({
      antialias: devicePixelRatio < 1.5,
      powerPreference: "high-performance",
    });
    configureModelRenderer(this.renderer);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
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
    this.hemi = new THREE.HemisphereLight(0xdbe8ea, 0x34443c, 1.3);
    this.scene.add(this.hemi);
    let sun = new THREE.DirectionalLight(0xffefdb, 3);
    sun.position.set(-15, 35, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
    });
    sun.shadow.bias = -0.0004;
    this.sun = sun;
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
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
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
    this.renderer.shadowMap.needsUpdate = true;
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
        new THREE.Vector3(
          p[0],
          config.bridge ? (config.heights?.[i] ?? (i === 2 ? 3.5 : 0)) : 0,
          p[1],
        ),
    );
    this.curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    this.length = this.curve.getLength();
    this.setDiorama(config);
    this.box(
      42,
      0.7,
      26,
      0,
      -0.7,
      0,
      config.theme === "coast"
        ? 0xc2b997
        : config.theme === "alpine"
          ? 0x405443
          : 0x465741,
    );
    this.box(42.4, 0.35, 26.4, 0, -1.2, 0, 0x172320);
    const n = 700;
    const asphalt = this.makeTexture("asphalt");
    const ribbon = (a, b, height, color, parity = null) => {
      let vs = [],
        uv = [],
        ix = [];
      for (let i = 0; i <= n; i++) {
        let p = this.curve.getPointAt(i / n),
          t = this.curve.getTangentAt(i / n),
          normal = new THREE.Vector3(-t.z, 0, t.x).normalize();
        for (let off of [a, b]) {
          vs.push(p.x + normal.x * off, p.y + height, p.z + normal.z * off);
          uv.push(((i / n) * this.length) / 3, (off - a) / (b - a));
        }
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
      geom.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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
      if (color === 0x363b3c) {
        mesh.material.map = asphalt;
        mesh.material.bumpMap = asphalt;
        mesh.material.bumpScale = 0.012;
      }
      if (color === 0x9a9f9b) {
        mesh.material.metalness = 0.85;
        mesh.material.roughness = 0.23;
      }
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
    const backSign = sign.clone();
    backSign.position.z = -0.12;
    backSign.rotation.y = Math.PI;
    gate.add(backSign);
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
      if (close || z < -8.8 || z > 9.3) continue;
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

    this.addDetails(config);
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
  makeTexture(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    let seed = 4281;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (kind === "wood") {
      ctx.fillStyle = "#665041";
      ctx.fillRect(0, 0, 256, 256);
      for (let j = 0; j < 1000; j++) {
        ctx.strokeStyle = `rgba(${random() > 0.5 ? "205,171,125" : "27,20,16"},${random() * 0.15})`;
        ctx.beginPath();
        let y = random() * 256;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(60, y + random() * 5, 180, y - random() * 5, 256, y);
        ctx.stroke();
      }
    } else {
      const data = ctx.createImageData(256, 256);
      for (let j = 0; j < data.data.length; j += 4) {
        let v = 135 + random() * 55;
        data.data[j] = v;
        data.data[j + 1] = v;
        data.data[j + 2] = v;
        data.data[j + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    return texture;
  }
  setDiorama(config) {
    this.night = config.theme === "night";
    this.scene.background.set(this.night ? "#101923" : "#202c29");
    this.scene.fog.color.copy(this.scene.background);
    this.sun.color.set(this.night ? 0x9dbbff : 0xffefd8);
    this.sun.intensity = this.night ? 0.35 : 3.2;
    this.hemi.intensity = this.night ? 0.18 : 1.3;
    this.scene.environmentIntensity = this.night ? 0.25 : 0.8;
    const desk = this.box(46, 0.55, 30, 0, -1.75, 0, 0x99775c);
    desk.material.map = this.makeTexture("wood");
    desk.material.roughness = 0.42;
    for (const x of [-18, 18])
      for (const z of [-11, 11]) this.box(0.55, 4, 0.55, x, -4, z, 0x262b29);
    const floor = this.box(180, 0.25, 180, 0, -6.15, 0, 0x1e2926);
    floor.castShadow = false;
  }
  label(
    text,
    x,
    y,
    z,
    width = 3,
    rotation = 0,
    bg = "#e8e4d6",
    color = "#26372f",
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "italic 900 55px Arial";
    ctx.fillText(text, 256, 83);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.6,
      }),
    );
    panel.position.set(x, y, z);
    panel.rotation.y = rotation;
    panel.material.side = THREE.FrontSide;
    this.track.add(panel);
    const back = panel.clone();
    back.rotation.y += Math.PI;
    back.position.x -= Math.sin(rotation) * 0.012;
    back.position.z -= Math.cos(rotation) * 0.012;
    this.track.add(back);
  }
  addDetails(config) {
    // Moulded crash barriers and clip-in stanchions follow the slot-car circuit.
    if (config.borders !== false) {
      for (const side of [-1, 1]) {
        const railPoints = [];
        for (let j = 0; j <= 180; j++) {
          const p = this.curve.getPointAt(j / 180),
            t = this.curve.getTangentAt(j / 180);
          p.x -= t.z * side * 1.64;
          p.z += t.x * side * 1.64;
          p.y += 0.46;
          railPoints.push(p);
        }
        const rail = new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(railPoints),
            360,
            0.035,
            5,
            false,
          ),
          new THREE.MeshStandardMaterial({
            color: 0xd6d7cb,
            metalness: 0.5,
            roughness: 0.35,
          }),
        );
        this.track.add(rail);
        for (let j = 0; j < this.length / 2; j++) {
          const { p, t } = this.pose(j / (this.length / 2), side * 1.64);
          let post = this.box(0.07, 0.42, 0.09, p.x, p.y + 0.22, p.z, 0xbabfb6);
          post.rotation.y = Math.atan2(t.x, t.z);
        }
      }
    }
    const road = this.curve.getSpacedPoints(140);
    const clear = (x, z, r) =>
      road.every((p) => Math.hypot(x - p.x, z - p.z) > r);
    // Tall lighting rigs, visible lights at night, and floodlit pit buildings.
    for (const [x, z] of [
      [-19, -11],
      [19, -11],
      [-19, 11],
      [19, 11],
    ]) {
      this.box(0.15, 5, 0.15, x, 2.2, z, 0x4b5553);
      this.box(1.1, 0.2, 0.45, x, 4.8, z, 0x29312f);
      for (const dx of [-0.32, 0, 0.32]) {
        const lamp = this.box(0.25, 0.12, 0.28, x + dx, 4.7, z, 0xf3ead2);
        lamp.material.emissive.set(0xffe1ad);
        lamp.material.emissiveIntensity = this.night ? 4 : 0.7;
      }
      if (this.night) {
        let light = new THREE.PointLight(0xf8dab0, 300, 32, 2);
        light.position.set(x, 4.4, z);
        this.track.add(light);
      }
    }
    const garages = [
      [-10, -11.5],
      [-5, -11.5],
      [0, -11.5],
    ];
    for (const [x, z] of garages) {
      if (!clear(x, z, 2.5)) continue;
      this.box(4, 1.35, 1.8, x, 0.35, z, 0xe0e0d5);
      this.box(4.2, 0.14, 2, x, 1.1, z, 0x283735);
      for (let j = 0; j < 3; j++) {
        this.box(
          0.95,
          0.8,
          0.035,
          x - 1.25 + j * 1.25,
          0.3,
          z + 0.92,
          0x222e2e,
        );
        this.box(
          0.9,
          0.09,
          0.05,
          x - 1.25 + j * 1.25,
          0.77,
          z + 0.94,
          0xff7c3a,
        );
      }
      this.label("PIT LANE", x, 0.95, z + 0.95, 2.6, 0, "#253733", "#efede1");
      this.box(3.7, 0.16, 1.5, x, 1.32, z, 0x9ba994);
    }
    // Trackside billboards and marshal huts in clear areas.
    for (const [x, z, text] of [
      [-11, 10, "SLOT CLUB"],
      [10, -11, "1:32 RACING"],
      [8, 11, "FULL THROTTLE"],
    ]) {
      if (!clear(x, z, 1.5)) continue;
      this.label(text, x, 1, z, 3.5, Math.PI, "#e8643b", "#fff3df");
      for (const dx of [-1.4, 1.4])
        this.box(0.06, 1.4, 0.06, x + dx, 0.3, z, 0x5b6259);
    }
    // Tree canopies, rocks and small tyre stacks add miniature scale cues.
    for (let j = 0; j < 45; j++) {
      const x = Math.sin(j * 93.7) * 19,
        z = Math.cos(j * 41.3) * 11;
      if (!clear(x, z, 2.6) || z < -8.8 || z > 9.3) continue;
      for (let k = 0; k < 3; k++) {
        const leaves = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.45 + k * 0.12, 1),
          new THREE.MeshStandardMaterial({
            color:
              config.theme === "coast"
                ? 0x68744b
                : [0x415b37, 0x536b42, 0x3e5434][j % 3],
            roughness: 1,
          }),
        );
        leaves.position.set(x + (k - 1) * 0.22, 1.5 + k * 0.28, z);
        leaves.castShadow = true;
        this.track.add(leaves);
      }
    }
    for (let j = 0; j < 14; j++) {
      const u = j / 14,
        { p, t } = this.pose(u, 2.1);
      if (p.y > 0.2) continue;
      for (let k = 0; k < 3; k++) {
        const tyre = new THREE.Mesh(
          new THREE.TorusGeometry(0.17, 0.065, 6, 12),
          new THREE.MeshStandardMaterial({
            color: j % 3 ? 0x202726 : 0xdddfcf,
            roughness: 0.92,
          }),
        );
        tyre.rotation.x = Math.PI / 2;
        tyre.position.set(p.x, p.y + 0.1 + k * 0.11, p.z);
        this.track.add(tyre);
      }
    }
    // Bridge beams follow the raised road, with regularly spaced supports.
    for (let j = 0; j < 70; j++) {
      const p = this.curve.getPointAt(j / 70);
      if (p.y > 0.7) {
        this.box(0.16, p.y, 0.16, p.x, p.y / 2 - 0.15, p.z, 0x778276);
        this.box(2.7, 0.12, 0.18, p.x, p.y - 0.12, p.z, 0xa3aa9a).rotation.y =
          Math.atan2(
            this.curve.getTangentAt(j / 70).x,
            this.curve.getTangentAt(j / 70).z,
          );
      }
    }
  }

  setCars(spec, opponent) {
    const key = `${spec.id}|${opponent.id}|${this.lowDetail}`;
    if (this.carsKey === key && this.carReady) return this.carReady;
    this.carsKey = key;
    const token = Symbol();
    this.carToken = token;
    this.carReady = Promise.allSettled([
      loadCar({ ...spec, lowDetail: this.lowDetail }),
      loadCar({ ...opponent, lowDetail: this.lowDetail }),
    ]).then((results) => {
      const failure = results.find((r) => r.status === "rejected");
      const vehicles = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);
      if (failure) {
        vehicles.forEach(releaseCar);
        throw failure.reason;
      }
      if (this.carToken !== token) {
        vehicles.forEach(releaseCar);
        return;
      }
      this.vehicles.forEach(releaseCar);
      this.vehicles = vehicles;
      this.vehicles.forEach((v) => this.scene.add(v));
    });
    this.carReady.catch((error) => {
      if (this.carToken === token) this.carsKey = null;
      console.error("Car model could not load", error);
    });
    return this.carReady;
  }
  async prepare() {
    await this.carReady;
    await this.renderer.compileAsync(this.scene, this.camera);
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
      v.rotateX(-Math.asin(t.y));
      v.visible =
        i === 0
          ? !(state.racing && state.cam === "Bumper")
          : !state.racing || state.opponent;
      if (i === 0 && state.off > 0) {
        v.position.addScaledVector(state.fly, Math.min(state.off * 5, 6));
        v.position.y += Math.max(
          0,
          Math.sin(Math.min(state.off / 1.5, 1) * Math.PI) * 2,
        );
        v.rotation.y += Math.min(state.off, 1.5) * 5;
        v.rotation.z = Math.min(state.off, 1.5) * 2;
      }
    });
    let target = new THREE.Vector3(),
      pos = new THREE.Vector3();
    if (state.racing) {
      let { p, t } = this.pose(state.progress, -0.6);
      target.copy(p).addScaledVector(t, 3);
      if (state.cam === "Bumper") {
        pos.copy(p).addScaledVector(t, 1.15);
        pos.y += 0.23;
        target.y += 0.23;
      } else if (state.cam === "Cockpit") {
        const height = this.vehicles[0]?.userData.height || 0.7;
        pos
          .copy(p)
          .addScaledVector(t, 0.02)
          .add(new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(0.14));
        pos.y += 0.085 + height * 0.9;
        target.y = pos.y - 0.22;
      } else if (state.cam === "Chase") {
        pos.copy(p).addScaledVector(t, -6.5);
        pos.y += 4.2;
        target.copy(p).addScaledVector(t, 1.4);
        target.y += 0.5;
      } else {
        pos.copy(p).add(new THREE.Vector3(12, 17, 14));
        target.copy(p);
      }
    } else {
      let a = 0.1 + Math.sin(time * 0.025) * 0.1;
      pos.set(29 * Math.cos(a), 29, 35 + Math.sin(a) * 7);
      target.set(0, 0, 0);
    }
    const desiredFov =
      state.racing && ["Cockpit", "Bumper"].includes(state.cam)
        ? 65
        : state.racing && state.cam === "Chase"
          ? 45
          : 39;
    if (this.camera.fov !== desiredFov) {
      this.camera.fov = desiredFov;
      this.camera.updateProjectionMatrix();
    }
    if (
      state.racing &&
      (this.lastCam !== state.cam || ["Cockpit", "Bumper"].includes(state.cam))
    )
      this.camera.position.copy(pos);
    else
      this.camera.position.lerp(
        pos,
        1 - Math.exp(-dt * (state.racing ? 6 : 2)),
      );
    this.lastCam = state.racing ? state.cam : null;
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  }
}
