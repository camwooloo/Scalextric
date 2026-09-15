import {NodeIO}from'@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';import{flatten,join,prune,weld,meshopt}from'@gltf-transform/functions';import{MeshoptDecoder,MeshoptEncoder}from'meshoptimizer';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const path=process.argv[2];if(!path)throw Error('A model path is required');const doc=await io.read(path);
for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const copy=mesh.clone();for(const p of copy.listPrimitives()){copy.removePrimitive(p);copy.addPrimitive(p.clone());}node.setMesh(copy);}
await doc.transform(flatten(),join({keepNamed:false,keepMeshes:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high'}));await io.write(path,doc);
