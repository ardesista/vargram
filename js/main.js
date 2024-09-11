window.onload = function() {
  var L = 50;
  var scene, sliders = {}, pieces = [], camera;
  var slidersInit = { a: 1/2, b: 1/2, c: 1/2, d: 1/3, e: 1/2, f: 1/2 };
  var piecesMaterials = [
    buildPieceMaterial(0xff0000), // ROSSO
    buildPieceMaterial(0x2f88d0), // AZZURRO
    buildPieceMaterial(0xffaeb9), // ROSA
    buildPieceMaterial(0x00ffb2), // VERDE ACQUA
    buildPieceMaterial(0x000099), // BLU SCURO
    buildPieceMaterial(0xffcc33), // GIALLO
    buildPieceMaterial(0xf5f5dc), // PANNA
  ];

  function getPiecesCoords(L, sliders) {
    // var yC = (sliders.a * sliders.c - sliders.a * sliders.b) / (L - sliders.b);
    // var yD = (yC - L) * sliders.d / sliders.c + L;
    // var yE = yD * sliders.e / sliders.d;
    // var yF = (L - yD) * sliders.f / (L - sliders.d) + L - L * (L - yD) / (L - sliders.d);
    //
    // return [
    //   [ sliders.b, 0, L, sliders.a, L, 0 ],
    //   [ 0, 0, 0, L, sliders.d, yD ],
    //   [ 0, L, L, L, sliders.d, yD ],
    //   [ sliders.d, yD, sliders.c, yC, sliders.e, yE ],
    //   [ L, sliders.a, sliders.f, yF, L, L ],
    //   [ sliders.e, yE, sliders.c, yC, sliders.b, 0, 0, 0 ],
    //   [ sliders.f, yF, L, sliders.a, sliders.c, yC, sliders.d, yD ]
    // ];

    function lerp(a, b, t) {
      return [ t * b[0] + (1 - t) * a[0], t * b[1] + (1 - t) * a[1] ];
    }

    var ZERO = [ 0, 0 ], X = [ L, 0 ], Y = [ 0, L ], G = [ L, L ];
    var A = lerp(X, G, sliders.a);
    var B = lerp(ZERO, X, sliders.b);
    var C = lerp(A, B, sliders.c);
    var D = lerp(C, Y, sliders.d);
    var E = lerp(ZERO, D, sliders.e);
    var F = lerp(D, G, sliders.f);

    return [
      [ B, A, X ],
      [ ZERO, Y, D ],
      [ D, G, Y ],
      [ D, C, E ],
      [ A, F, G ],
      [ ZERO, E, C, B ],
      [ D, F, A, C ]
    ];
  }

  function getPieceShape(L, sliders, id) {
    var coords = getPiecesCoords(L, sliders)[id];
    var shape = new THREE.Shape();
    shape.moveTo(coords[0][0], coords[0][1]);
    for(var i = 1; i < coords.length; i++)
      shape.lineTo(coords[i][0], coords[i][1]);
    return shape;
  }

  function buildPieceMaterial(color) {
    return Physijs.createMaterial(new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0,
      shading: THREE.FlatShading
    }), 0.99, 0.125);
  }

  function centerGeometry(geometry, centroid) {
    if(!centroid) {
      centroid = new THREE.Vector3(0, 0, 0);
      for(var i = 0; i < geometry.vertices.length; i++)
        centroid.add(geometry.vertices[i]);
      centroid.divideScalar(geometry.vertices.length);
    }
    geometry.translate(-centroid.x, -centroid.y, -centroid.z);
    geometry.verticesNeedUpdate = true;
    geometry.computeBoundingBox();
    return centroid;
  }

  function updatePieces(pieces, L, sliders, piecesMaterials, scene) {
    var pos, rot, mesh;
    for(var i = 0; i < piecesMaterials.length; i++) {
      // Create geometry and mesh from geometry and material
      var geometry = new THREE.ExtrudeGeometry(getPieceShape(L, sliders, i), { amount: 0.06 * L, bevelEnabled: false });
      var centroid = centerGeometry(geometry);

      mesh = new Physijs.ConvexMesh(geometry, piecesMaterials[i], 1000);
      mesh.userData.centroid = centroid;

      if(i >= pieces.length) {
        pos = new THREE.Vector3(centroid.x - L / 2, centroid.z, centroid.y - L / 2);
        rot = new THREE.Vector3(Math.PI / 2, 0, 0);
        pieces.push(mesh);
      }
      else {
        // Update existing geometry
        //pos = pieces[i].position;
        pos = new THREE.Vector3(centroid.x + pieces[i].position.x - pieces[i].userData.centroid.x, pieces[i].position.y, centroid.y + pieces[i].position.z - pieces[i].userData.centroid.y);
        rot = { x: pieces[i].rotation.x, y: pieces[i].rotation.y, z: pieces[i].rotation.z };
        scene.remove(pieces[i]);
        pieces[i] = mesh;
      }

      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.copy(pos);
      mesh.rotation.set(rot.x, rot.y, rot.z);
      scene.add(pieces[i]);
    }

    return pieces;
  }

  function explodePieces(pieces, amount) {
    var centroid = new THREE.Vector3(0, 0, 0);
    for(var i = 0; i < pieces.length; i++)
      centroid.add(pieces[i].position);
    centroid.divideScalar(pieces.length);

    var p = new THREE.Vector3();
    for(var i = 0; i < pieces.length; i++) {
      pieces[i].position.add(p.copy(pieces[i].position).sub(centroid).multiplyScalar(amount));
      pieces[i].__dirtyPosition = pieces[i].__dirtyRotation = true;
    }
  }

  function reset() {
    for(var k in slidersInit)
      sliders[k] = slidersInit[k];

    while(pieces.length > 0)
      scene.remove(pieces.pop());

    pieces = updatePieces(pieces, L, sliders, piecesMaterials, scene);
    camera.position.set(0, 65, 25);
    camera.lookAt(ground.position);
    camera.dispatchEvent({ type: 'reset' });
  }

  //////////////////////////////////////////////////////////////////////////////
  // Scene setup ///////////////////////////////////////////////////////////////
  //

  // Init physics
  Physijs.scripts.worker = 'js/physijs_worker.js';
  Physijs.scripts.ammo = 'ammo.js';

  scene = new Physijs.Scene();
  scene.setGravity(new THREE.Vector3(0, -50, 0));

  // Lights: soft ambient white light
  scene.add(new THREE.AmbientLight(0xe0e0e0));

  // Lights: spot white light
  var light = new THREE.PointLight(0xfffef2, 0.5, 200, 2);
  light.position.set(0, 100, 0);
  light.castShadow = true;
  light.shadow.bias = 0.0001;
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  scene.add(light);

  // Ground
  var groundMaterial = Physijs.createMaterial(
    new THREE.MeshStandardMaterial({ color: 0xbcc1e0, metalness: 0, shading: THREE.FlatShading }),
    .99, // high friction
    .2 // low restitution
  );

  var ground = new Physijs.PlaneMesh(new THREE.PlaneGeometry(2500, 2500), groundMaterial, 0);
  ground.position.set(0, 0, 0);
  ground.rotation.set(-Math.PI / 2, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // // Test cube
  // var cube = new Physijs.BoxMesh(new THREE.BoxGeometry(1, 1, 1), groundMaterial);
  //
  // cube.position.set(0, 5.5, 2);
  // cube.rotation.set(0.125, 0.007, 0.4242);
  // cube.castShadow = cube.receiveShadow = true;
  // scene.add(cube);

  // Main (scene) update function
  scene.update = function(dt) {
    for(var i = 0; i < pieces.length; i++) {
      var l = pieces[i].getLinearVelocity().length();
      if(l > 30)
        pieces[i].setLinearVelocity(pieces[i].getLinearVelocity().normalize().multiplyScalar(30));

      var l = pieces[i].getAngularVelocity().length();
      if(l > 50)
        pieces[i].setAngularVelocity(pieces[i].getAngularVelocity().normalize().multiplyScalar(50));
    }

    // cube.rotation.x += dt / 128;
    // cube.rotation.y += dt / 512;
  };

  //////////////////////////////////////////////////////////////////////////////
  // Camera setup //////////////////////////////////////////////////////////////
  //
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.125, 1024);
  reset();

  //////////////////////////////////////////////////////////////////////////////
  // GUI setup /////////////////////////////////////////////////////////////////
  //
  var gui = new dat.GUI({ autoPlace: false });
  var customContainer = document.getElementById('dat-gui');
  customContainer.appendChild(gui.domElement);

  function slidersChange(v) {
    updatePieces(pieces, L, sliders, piecesMaterials, scene);
  }

  for(var k in slidersInit)
    gui.add(sliders, k, 0.1, 0.9).onChange(slidersChange).listen();

  gui.add({
    Explode: function() {
      explodePieces(pieces, 0.25);
    }
  }, 'Explode');

  gui.add({
    Export: function() {
      var exporter = new THREE.OBJExporter();
      var exportedScene = new THREE.Scene();

      for(var i = 0; i < pieces.length; i++)
        exportedScene.add(pieces[i].clone());

      var blob = new Blob([ exporter.parse(exportedScene) ], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "vargram.obj");
    }
  }, 'Export');

  gui.add({
    Flick: function() {
      var centroid = new THREE.Vector3(0, 0, 0);
      var impNorm = new THREE.Vector3(0, 0, 0);
      var offset = new THREE.Vector3(0, 0, 0);
      for(var i = 0; i < pieces.length; i++)
        centroid.add(pieces[i].position);
      centroid.divideScalar(pieces.length);

      for(var i = 0; i < pieces.length; i++) {
        impNorm.copy(pieces[i].position).sub(centroid).normalize().multiplyScalar(3);
        //offset.copy(pieces[i].position);
        offset.x = (Math.random() - 0.5) * L / 8;
        offset.z = (Math.random() - 0.5) * L / 8;
        impNorm.y = 8;
        pieces[i].applyImpulse(impNorm.multiplyScalar(20000), offset);
      }
    }
  }, 'Flick');

  gui.add({ Reset: reset }, 'Reset');

  //////////////////////////////////////////////////////////////////////////////
  // Update-render loop ////////////////////////////////////////////////////////
  //
  (function(scene, camera) {
    var canvas = document.getElementById('renderer');

    // Controls setup
    var controls = new THREE.OrbitControls(camera, canvas);

    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.25;
    controls.minPolarAngle = -Math.PI / 4;
  	controls.maxPolarAngle = 7 * Math.PI / 16;

    camera.addEventListener('reset', function(event) {
      controls.reset();
    });

		var pieceControls = new THREE.PieceControls(pieces, camera, canvas);
    var selectionTween;

		pieceControls.addEventListener('dragstart', function(event) {
      controls.enabled = false;
      // selectionTween = new TWEEN.Tween(event.object.position).to({ y: 1 }, 200);
      // selectionTween.start();
    });

		pieceControls.addEventListener('dragend', function(event) {
      controls.enabled = true;
      // selectionTween.stop();
      // selectionTween = new TWEEN.Tween(event.object.position).to({ y: event.object.geometry.boundingBox.max.z }, 200);
      // selectionTween.start();
    });
    pieceControls.addEventListener('drag', function(event) {
      // if(event.object.position.y < event.object.geometry.boundingBox.max.z)
      //   event.object.position.y = event.object.geometry.boundingBox.max.z;
    });

    // Renderer setup
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: canvas });

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);

    // Rendering function
    function render(t) {
    	requestAnimationFrame(render);
      //TWEEN.update();
      controls.update();
      scene.simulate(undefined, 2);
      scene.update(t - scene.t);
      scene.t = t;
    	renderer.render(scene, camera);
    }

    scene.t = performance.now();
    requestAnimationFrame(render);
  })(scene, camera);
};
