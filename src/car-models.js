import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
export async function loadCar(spec) {
  const cacheKey = spec.id + (spec.lowDetail ? "-low" : "");
  if (!cache.has(cacheKey))
    cache.set(
      cacheKey,
      loader.loadAsync(`/models/${cacheKey}.glb`).catch((e) => {
        cache.delete(cacheKey);
        throw e;
      }),
    );
  const gltf = await cache.get(cacheKey);
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
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const car = new THREE.Group();
  car.add(model);
  car.userData.spec = spec.id;
  car.userData.height = bounds.max.y - bounds.min.y;
  return car;
}
// Meshes and textures belong to the model cache; changing cars never disposes shared resources.
export function releaseCar(car) {
  car?.removeFromParent();
}
