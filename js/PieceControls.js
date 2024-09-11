/*
 * @author zz85 / https://github.com/zz85
 * @author mrdoob / http://mrdoob.com
 * Running this will allow you to drag three.js objects around the screen.

 *
 * Goatama MODded. May the FSM bless you!
 *
*/

THREE.PieceControls = function(_objects, _camera, _domElement) {
  var _plane = new THREE.Plane();
  var _raycaster = new THREE.Raycaster();

  var _mouse = new THREE.Vector2();
  var _offset = new THREE.Vector3();
  var _intersection = new THREE.Vector3();

  var _selected = null, _hovered = null;
	var _c = 0;

  //
  var scope = this;

  function activate() {
    _domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    _domElement.addEventListener('mousedown', onDocumentMouseDown, false);
    _domElement.addEventListener('mouseup', onDocumentMouseUp, false);
  }

  function deactivate() {
    _domElement.removeEventListener('mousemove', onDocumentMouseMove, false);
    _domElement.removeEventListener('mousedown', onDocumentMouseDown, false);
    _domElement.removeEventListener('mouseup', onDocumentMouseUp, false);
  }

  function dispose() {
    deactivate();
  }

  function onDocumentMouseMove(event) {
    event.preventDefault();

    _mouse.x = (event.clientX / _domElement.width) * 2 - 1;
    _mouse.y = -(event.clientY / _domElement.height) * 2 + 1;

    _raycaster.setFromCamera(_mouse, _camera);

    if(_selected && scope.enabled) {
			if(_raycaster.ray.intersectPlane(_plane, _intersection)) {
				if(event.buttons == 1) {
	        //_selected.position.copy(_intersection.sub(_offset));
					var p = new THREE.Vector3(_intersection.x - _offset.x, 0, _intersection.z - _offset.z);
					_selected.applyCentralForce(p.multiplyScalar(100000));
					_offset = _intersection.clone();
				}
				else {
					var a = Math.atan2(_offset.z - _selected.position.z, _offset.x - _selected.position.x) -
						Math.atan2(_intersection.z - _selected.position.z, _intersection.x - _selected.position.x);

					_selected.setAngularVelocity({ x: 0, y: a > 0 ? 1 : -1, z: 0 });
					_offset = _intersection.clone();
				}

				// if(_c++ == 50) {
				// 	_offset = _intersection.clone();
				// 	_c = 0;
				// }

				return;
			}
    }

    _raycaster.setFromCamera(_mouse, _camera);

    var intersects = _raycaster.intersectObjects(_objects);

    if(intersects.length > 0) {
      var object = intersects[0].object;

      _plane.setFromNormalAndCoplanarPoint(_camera.getWorldDirection(_plane.normal), object.position);
      if(_hovered !== object) {
        scope.dispatchEvent({
          type: 'hoveron',
          object: object
        });

        _domElement.style.cursor = 'pointer';
        _hovered = object;
      }
    }
		else {
      if(_hovered !== null) {
        scope.dispatchEvent({
          type: 'hoveroff',
          object: _hovered
        });

        _domElement.style.cursor = 'auto';
        _hovered = null;
      }
    }
  }

  function onDocumentMouseDown(event) {
    event.preventDefault();

    _raycaster.setFromCamera(_mouse, _camera);

    var intersects = _raycaster.intersectObjects(_objects);

    if(intersects.length > 0) {
      _selected = intersects[0].object;
      if(_raycaster.ray.intersectPlane(_plane, _intersection))
        _offset.copy(_intersection);

      _domElement.style.cursor = 'move';

      scope.dispatchEvent({
        type: 'dragstart',
        object: _selected
      });
    }
  }

  function onDocumentMouseUp(event) {
    event.preventDefault();

    if(_selected) {
      scope.dispatchEvent({
        type: 'dragend',
        object: _selected
      });

      _selected = null;
    }

    _domElement.style.cursor = 'auto';
  }

  activate();

  // API

  this.enabled = true;
  this.activate = activate;
  this.deactivate = deactivate;
  this.dispose = dispose;

  // Backward compatibility

  this.setObjects = function() {
    console.error('THREE.PieceControls: setObjects() has been removed.');
  };

  this.on = function(type, listener) {
    console.warn('THREE.PieceControls: on() has been deprecated. Use addEventListener() instead.');
    scope.addEventListener(type, listener);
  };

  this.off = function(type, listener) {
    console.warn('THREE.PieceControls: off() has been deprecated. Use removeEventListener() instead.');
    scope.removeEventListener(type, listener);
  };

  this.notify = function(type) {
    console.error('THREE.PieceControls: notify() has been deprecated. Use dispatchEvent() instead.');
    scope.dispatchEvent({
      type: type
    });
  };
};

THREE.PieceControls.prototype = Object.create(THREE.EventDispatcher.prototype);
THREE.PieceControls.prototype.constructor = THREE.PieceControls;
