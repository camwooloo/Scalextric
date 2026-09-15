import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const ktx2 = new KTX2Loader().setTranscoderPath("/decoders/").setWorkerLimit(2);
export function configureModelRenderer(renderer) {
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
}
const cache = new Map();
const references = new Map(),
  assets = new Map();
function trimCache() {
  for (const [key, asset] of assets) {
    if (assets.size <= 4) break;
    if (references.get(key)) continue;
    const resources = new Set();
    asset.scene.traverse((o) => {
      if (o.geometry) resources.add(o.geometry);
      for (const m of [o.material].flat().filter(Boolean)) {
        resources.add(m);
        for (const value of Object.values(m))
          if (value?.isTexture) resources.add(value);
      }
    });
    resources.forEach((r) => r.dispose());
    assets.delete(key);
    cache.delete(key);
    references.delete(key);
  }
}
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = 64;
shadowCanvas.height = 64;
const ctx = shadowCanvas.getContext("2d"),
  gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
gradient.addColorStop(0, "rgba(0,0,0,.5)");
gradient.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
const contactGeometry = new THREE.PlaneGeometry(1.6, 2.6),
  contactMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
export async function loadCar(spec) {
  const cacheKey =
    spec.id + (spec.lowDetail && !spec.sharedModel ? "-low" : "");
  if (!cache.has(cacheKey))
    cache.set(
      cacheKey,
      loader.loadAsync(`/models/${cacheKey}.glb`).catch((e) => {
        cache.delete(cacheKey);
        throw e;
      }),
    );
  references.set(cacheKey, (references.get(cacheKey) || 0) + 1);
  let gltf;
  try {
    gltf = await cache.get(cacheKey);
  } catch (e) {
    references.set(cacheKey, Math.max(0, (references.get(cacheKey) || 1) - 1));
    throw e;
  }
  assets.set(cacheKey, gltf);
  const model = gltf.scene.clone(true);
  model.updateMatrixWorld(true);
  const originalSize = new THREE.Box3()
    .setFromObject(model)
    .getSize(new THREE.Vector3());
  if (originalSize.x > originalSize.z) model.rotation.y += Math.PI / 2;
  model.rotation.y += spec.modelRotation || 0;
  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model),
    size = bounds.getSize(new THREE.Vector3());
  // Source files use different axes and units. Normalise to a 1:32-sized slot car.
  const length = spec.modelLength || 2.2;
  model.scale.multiplyScalar(length / Math.max(size.x, size.z));
  model.updateMatrixWorld(true);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.add(
    new THREE.Vector3(-center.x, 0.085 - bounds.min.y, -center.z),
  );
  model.traverse((o) => {
    if (o.isMesh) {
      // Static scenery owns the cached shadow map; cars use a cheap contact shadow.
      o.castShadow = false;
      o.receiveShadow = false;
      for (const material of [o.material].flat().filter(Boolean)) {
        // Glass should not trigger a second render of the whole scene in adaptive mode.
        material.forceSinglePass = true;
        if (!material.transparent && material.roughness !== undefined) {
          material.roughness = Math.max(0.28, material.roughness);
          if (material.clearcoatRoughness !== undefined)
            material.clearcoatRoughness = Math.max(
              0.22,
              material.clearcoatRoughness,
            );
        }
        if ((spec.lowDetail || spec.sharedModel) && material.transmission > 0) {
          material.transmission = 0;
          material.opacity = 0.38;
          material.transparent = true;
          material.depthWrite = false;
          material.needsUpdate = true;
        }
      }
    }
  });
  const car = new THREE.Group();
  car.add(model);
  const contact = new THREE.Mesh(contactGeometry, contactMaterial);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.025;
  car.add(contact);
  car.userData.cacheKey = cacheKey;
  car.userData.spec = spec.id;
  car.userData.height = bounds.max.y - bounds.min.y;
  trimCache();
  return car;
}
// Only evict unused cache entries; active car instances retain their shared resources.
export function releaseCar(car) {
  car?.removeFromParent();
  const key = car?.userData.cacheKey;
  if (key) references.set(key, Math.max(0, (references.get(key) || 1) - 1));
  trimCache();
}
