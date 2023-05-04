import * as THREE from "three";
import axios from "axios";

import Stats from "three/addons/libs/stats.module.js";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { facecapModel } from "./mapVertices";

init();

function init() {
  let defaultAnimation;
  let mixer;
  let customClip;

  const clock = new THREE.Clock();
  const times = [0, 3];
  const values = Array.from({ length: 520 }, () => Math.random());

  const customTrack = new THREE.NumberKeyframeTrack(
    "mesh_2.morphTargetInfluences",
    times,
    values
  );
  customClip = new THREE.AnimationClip("blink", -1, [customTrack]);

  const container = document.createElement("div");
  document.body.appendChild(container);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    20
  );
  camera.position.set(-1.8, 0.8, 3);

  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  container.appendChild(renderer.domElement);

  const ktx2Loader = new KTX2Loader()
    .setTranscoderPath("./node_modules/three/examples/jsm/libs/basis/")
    .detectSupport(renderer);

  new GLTFLoader()
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder)
    .load("/facecap.glb", (gltf) => {
      console.log("gltf", gltf);

      const mesh = gltf.scene.children[0];
      scene.add(mesh);
      console.log("mesh", mesh);

      defaultAnimation = gltf.animations[0];
      console.log(customClip);
      mixer = new THREE.AnimationMixer(mesh);
      // mixer.clipAction(customClip).play();
      mixer.timeScale = 1;
      // GUI

      const head = mesh.getObjectByName("mesh_2");
      const influences = head.morphTargetInfluences;

      const gui = new GUI();
      gui.close();

      for (const [key, value] of Object.entries(head.morphTargetDictionary)) {
        console.log(key, value);
        gui
          .add(influences, value, 0, 1, 0.01)
          .name(key.replace("blendShape1.", ""))
          .listen(influences);
      }
    });

  const environment = new RoomEnvironment();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);

  scene.background = new THREE.Color(0x666666);
  scene.environment = pmremGenerator.fromScene(environment).texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 2.5;
  controls.maxDistance = 5;
  controls.minAzimuthAngle = -Math.PI / 2;
  controls.maxAzimuthAngle = Math.PI / 2;
  controls.maxPolarAngle = Math.PI / 1.8;
  controls.target.set(0, 0.15, -0.2);

  const stats = new Stats();
  container.appendChild(stats.dom);

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (mixer) {
      mixer.update(delta);
    }

    renderer.render(scene, camera);

    controls.update();

    stats.update();
  });

  // Toggle animation
  let playing = false;
  document
    .getElementById("playButton")
    .addEventListener("mousedown", function () {
      let animation;

      if (playing) {
        console.log("show play default");
        animation = mixer.clipAction(defaultAnimation);
      } else {
        console.log("show play custom");
        animation = mixer.clipAction(customClip);
      }
      animation.setLoop(THREE.LoopOnce);
      animation.clampWhenFinished = true;
      animation.enable = true;

      animation.reset().play();
      playing = !playing;
    });

  // Create animation from text
  document
    .getElementById("text-submit-button")
    .addEventListener("mousedown", async () => {
      let input = document.getElementById("text-input");

      const host = "http://localhost:5000";
      const { data } = await axios.post(host + "/talk", { text: input.value });
      console.log(data);

      let timeFrames = Array.from(
        { length: 52 * data.blendData.length },
        () => 0.5
      );

      data.blendData.forEach((blendData, i) => {
        Object.keys(blendData.blendshapes).forEach((key) => {
          let newKey = "";
          if (key === "jawLeft" || key === "jawRight") newKey = key;
          else if (key === "mouthRight" || key === "mouthLeft") {
            newKey = key;
          } else if (key.endsWith("Right")) {
            newKey = key.replace("Right", "_R");
          } else if (key.endsWith("Left")) {
            newKey = key.replace("Left", "_L");
          } else newKey = key;

          const index = facecapModel[newKey] + i * 52;
          if (index >= 0) {
            timeFrames[index] = data.blendData[i].blendshapes[key];
          }
        });
      });

      // console.log(timeFrames);

      const times = [0, 2];
      const values = timeFrames;

      const customTrack = new THREE.NumberKeyframeTrack(
        "mesh_2.morphTargetInfluences",
        times,
        values
      );
      customClip = new THREE.AnimationClip("audioclip", -1, [customTrack]);
      let animation = mixer.clipAction(customClip);
      animation.setLoop(THREE.LoopOnce);
      animation.clampWhenFinished = true;
      animation.enable = true;

      animation.reset().play();
      // console.log(Object.keys(data.blendData[0].blendshapes).length);

      input.value = "";
    });
}
