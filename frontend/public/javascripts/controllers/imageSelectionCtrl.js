(function() {
	angular
	.module('cropper')
	.controller('imageSelectionCanvasCtrl', ['$scope', function($scope) {

		$scope.image = {
			loaded: false,
			src: $scope.imageSrc,
			width: 1000,
			height: 1000 // Fake it till you know it.
		};

		$scope.canRotate = true;
		$scope.rotationSensibility = 0.5;

		$scope.toggleCanRotate = function() {
			$scope.canRotate = !$scope.canRotate;
		};

		var DRAG_CREATE_THRESHOLD = 10;

		$scope.handlePadding = 8;
		$scope.rotationalHandleRadius = 6;
		$scope.rotationalHandleLength = 15;

		$scope.selectedSelection = undefined;

		$scope.draggingCanvas = false;
		$scope.draggingCanvasFrom = undefined;

		$scope.selectSelection = function(selection) {
			$scope.selectedSelection = selection;
			// Parent controllers might want to know when the selection changes.
			$scope.$emit('selectSelectionChanged', { selection: selection });
		};

		$scope.deselectSelection = function() {
			$scope.selectSelection(undefined);
		};

		// TODO: Might be deleted - it's probably not used.
		$scope.isSelected = function(selection) {
			return $scope.selectedSelection === selection;
		};

		$scope.removeSelection = function(selection) {
			if($scope.isSelected(selection)) {
				$scope.deselectSelection();
			}
			if(typeof(selection) === 'number') {
				// The selection argument is the index.
				$scope.selections.splice(selection, 1);
			} else {
				$scope.selections = $scope.selections.filter(function(someSelection) {
					console.log(someSelection, selection, someSelection !== selection);
					return someSelection !== selection;
				});
			}
		};

		$scope.removeSelectedSelection = function() {
			$scope.selections.forEach(function(selection, index) {
				if($scope.selectedSelection === selection) {
					$scope.selections.splice(index, 1);
				}
			});
			$scope.deselectSelection();
		};

		$scope.dragCreateSelection = function(offsetX, offsetY, handleDirection) {
			$scope.dragging_canvas = false;
			var selection = {
				center_x: offsetX / $scope.image.width,
				center_y: offsetY / $scope.image.height,
				width: 0,
				height: 0,
				rotation: 0
			};
			$scope.selections.push(selection);
			// Wait just a ms for the selection to bind.
			setTimeout(function() {
				$scope.$broadcast('onSelectionDragCreated', {
					selection: selection,
					offsetX: offsetX,
					offsetY: offsetY,
					handleDirection: handleDirection
				});
			}, 1);
		};

		// Manipulating the canvas
		$scope.mouseDown = function(offsetX, offsetY) {
			$scope.draggingCanvas = true;
			$scope.draggingCanvasFrom = new Victor(offsetX, offsetY);
			$scope.deselectSelection();
		};

		$scope.mouseUp = function() {
			$scope.draggingCanvas = false;
		};

		$scope.mouseMove = function(offsetX, offsetY) {
			var nothingSelected = typeof($scope.selectedSelection) === 'undefined';
			if($scope.draggingCanvas && nothingSelected) {
				// The difference between the mouse and the point from which the user
				// initiated the dragging.
				var diff = new Victor(offsetX, offsetY)
					.subtract($scope.draggingCanvasFrom);
				if(diff.length() > DRAG_CREATE_THRESHOLD) {
					// Determine in which direction the user drags.
					var handleDirection = '';
					if(diff.y > 0) {
						handleDirection += 'south';
					} else {
						handleDirection += 'north';
					}
					handleDirection += '-';
					if(diff.x > 0) {
						handleDirection += 'east';
					} else {
						handleDirection += 'west';
					}
					$scope.dragCreateSelection(	$scope.draggingCanvasFrom.x,
																			$scope.draggingCanvasFrom.y,
																			handleDirection);
				}
			}
		};

		// Parent controllers might want to affect the selection.
		$scope.$on('selectSelection', function(e, args) {
			$scope.selectSelection(args.selection);
		});

		// Parent controllers might want to remove selections.
		$scope.$on('removeSelection', function(e, args) {
			$scope.removeSelection(args.selection);
		});

		$(window).keypress(function(e) {
			if(e.keyCode === 127) { // The 'Delete' button
				$scope.removeSelectedSelection();
			}
		});

		// When clicking anywhere outside the canvas, deselect all selections.
		$(document.body).click(function() {
			$scope.$apply(function() {
				$scope.deselectSelection();
			});
		});

	}])
	.directive('imageSelectionCanvas', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/image-selection/canvas.html',
			templateNamespace: 'svg',
			controller: 'imageSelectionCanvasCtrl',
			scope: {
				'imageSrc': '@src',
				'selections': '='
			},
			link: function(scope, element, attrs) {
				$image = element.find('img');
				function updateThumbnailDimensions() {
					scope.$apply(function() {
						scope.image.width = $image.width();
						scope.image.height = $image.height();
						// The following resizing of the svg might not be needed.
						$('svg', element).attr({
							width: scope.image.width,
							height: scope.image.height
						});
						scope.$emit('imageUpdated', { image: scope.image });
					});
				}
				$image.bind('load', function() {
					scope.image.loaded = true;
					updateThumbnailDimensions();
				});
				$(window).bind('resize', updateThumbnailDimensions);
				$(element).bind('click', function(e) {
					// This prevents the click from deselecting.
					e.stopPropagation();
				});
			}
		};
	})
	.controller('imageSelectionCtrl', ['$scope', function($scope) {
		// In pixel
		var MIN_SELECTION_SIZE = 10;

		// The corner in which 
		$scope.grabbed = false;
		$scope.grabbedHandleDirection = undefined;

		$scope.visible = false;
		$scope.hovering = false;

		$scope.deriveScope = function() {
			var selection = $scope.selection;
			var image = $scope.image;

			$scope.maskId = 'Mask-' + $scope.$index;
			$scope.left = (selection.center_x-selection.width/2) * image.width;
			$scope.top = (selection.center_y-selection.height/2) * image.height;
			$scope.width = selection.width * image.width;
			$scope.height = selection.height * image.height;
			$scope.centerX = selection.center_x * image.width;
			$scope.centerY = selection.center_y * image.height;
			var rotationDegrees = 0.0 - selection.rotation * 360.0 / Math.PI / 2.0;
			$scope.rotationStyle = [
				'transform: rotate(' +rotationDegrees+ 'deg)',
				'transform-origin: '+$scope.centerX+ 'px ' +$scope.centerY+ 'px'
			].join(';');
		};

		$scope.handleGrabbed = function(direction, $event) {
			var x = $event.offsetX / $scope.image.width;
			var y = $event.offsetY / $scope.image.height;
			// Make this selection, the selected selection.
			$scope.$parent.selectSelection($scope.selection);

			// Save a copy of the selection when grapped.
			var state = {
				center: new Victor($scope.selection.center_x, $scope.selection.center_y),
				width: $scope.selection.width,
				height: $scope.selection.height,
				at: { x: x, y: y },
				rotation: $scope.selection.rotation
			};

			$scope.grabbedState = state;

			$scope.grabbed = true;
			$scope.grabbedHandleDirection = direction;

			// If this is infact a real $event and not just an object with
			// offsetX and offsetY. Let's make sure this click does not propagate.
			if($event.stopPropagation) {
				$event.stopPropagation();
			}
		};

		$scope.handleReleased = function() {
			$scope.grabbed = false;
			$scope.grabbedHandleDirection = undefined;
		};

		$scope.mouseMoved = function(x, y) {
			if($scope.selected && $scope.grabbed) {

				var grabbedState = $scope.grabbedState;
				var selection = $scope.selection;

				var imageDimensions = new Victor(
					$scope.image.width,
					$scope.image.height
					);

				var viewGrabbedCenter = grabbedState.center.clone()
					.multiply(imageDimensions);

				var viewMouse = new Victor(x, y);
				var mouse = viewMouse.clone().divide(imageDimensions);

				if($scope.grabbedHandleDirection === 'move') {
					// Moving the whole selection.
					selection.center_x = grabbedState.center.x - grabbedState.at.x + mouse.x;
					selection.center_y = grabbedState.center.y - grabbedState.at.y + mouse.y;
					// Keeing the bounds.
					selection.center_x = Math.max(0,selection.center_x);
					selection.center_y = Math.max(0, selection.center_y);
					selection.center_x = Math.min(1, selection.center_x);
					selection.center_y = Math.min(1, selection.center_y);
				} else if($scope.grabbedHandleDirection === 'rotational') {
					var diff = viewMouse.clone().subtract(viewGrabbedCenter);
					// 0-y because a mathematical coordinate system has y growing upwards.
					var radians = Math.atan2(0-diff.y, diff.x);
					var rotationNow = radians - (Math.PI / 2);
					var rotationDiff = rotationNow - grabbedState.rotation;
					// Fixing the bounds.
					if(rotationDiff < 0-Math.PI) {
						rotationDiff += Math.PI * 2;
					}
					rotationDiff *= $scope.rotationSensibility;
					// Subtract a quarter of a turn as the handle is located in the top.
					selection.rotation = grabbedState.rotation + rotationDiff;
				} else {
					var grabbed = {
						west: $scope.grabbedHandleDirection.indexOf('west') >= 0,
						east: $scope.grabbedHandleDirection.indexOf('east') >= 0,
						north: $scope.grabbedHandleDirection.indexOf('north') >= 0,
						south: $scope.grabbedHandleDirection.indexOf('south') >= 0
					};

					// The 0-sin because we are at a computer screen, not a mathematical
					// coordinate system.
					var viewRotationalDirection = new Victor(
						Math.cos($scope.grabbedState.rotation),
						0-Math.sin($scope.grabbedState.rotation)
						);

					var viewDirections = {
						east: viewRotationalDirection.clone(),
						west: viewRotationalDirection.clone().rotateDeg(180),
						north: viewRotationalDirection.clone().rotateDeg(-90),
						south: viewRotationalDirection.clone().rotateDeg(90)
					};

					// Let's have this scaled to the view and with proper care taken
					// towards the rotation.
					var viewSelectionWidthHalf = new Victor(
						$scope.grabbedState.width * imageDimensions.x / 2,
						$scope.grabbedState.width * imageDimensions.x / 2
						);
					var viewSelectionHeightHalf = new Victor(
						$scope.grabbedState.height * imageDimensions.y / 2,
						$scope.grabbedState.height * imageDimensions.y / 2
						);

					var viewOffsets = {
						east: viewDirections.east.clone().multiply(viewSelectionWidthHalf),
						west: viewDirections.west.clone().multiply(viewSelectionWidthHalf),
						north: viewDirections.north.clone().multiply(viewSelectionHeightHalf),
						south: viewDirections.south.clone().multiply(viewSelectionHeightHalf)
					};

					// The mouse location relative to the opposite part of the selection.
					var opposite = viewGrabbedCenter.clone();
					if(grabbed.west) {
						opposite.add(viewOffsets.east);
					} else if(grabbed.east) {
						opposite.add(viewOffsets.west);
					}

					if(grabbed.north) {
						opposite.add(viewOffsets.south);
					} else if(grabbed.south) {
						opposite.add(viewOffsets.north);
					}

					var mousePrime = viewMouse.clone().subtract(opposite);
					// console.log(mousePrime);

					// Let's start with the selection's current width and height.
					var newWidth = grabbedState.width * $scope.image.width;
					var newHeight = grabbedState.height * $scope.image.height;
					// They are how much of mouse prime points in the direction unit
					// vectors pointing towards the handles that were grabbed.
					if(grabbed.west) {
						newWidth = mousePrime.dot(viewDirections.west);
					} else if(grabbed.east) {
						newWidth = mousePrime.dot(viewDirections.east);
					}

					if(grabbed.north) {
						newHeight = mousePrime.dot(viewDirections.north);
					} else if(grabbed.south) {
						newHeight = mousePrime.dot(viewDirections.south);
					}

					// Let's not allow negative values for these guys.
					newWidth = Math.max(newWidth, MIN_SELECTION_SIZE);
					newHeight = Math.max(newHeight, MIN_SELECTION_SIZE);

					// Creating vectors of half width and height to multiply onto
					// directional unit vectors.
					var halfWidthVector = new Victor(newWidth/2.0, newWidth/2.0);
					var halfHeightVector = new Victor(newHeight/2.0, newHeight/2.0);

					// Let's calculate a new center coordinate.
					newCenter = viewGrabbedCenter.clone();
					
					var newCenter = opposite.clone();

					if(grabbed.west) {
						newCenter.add(viewDirections.west.clone().multiply(halfWidthVector));
					} else if(grabbed.east) {
						newCenter.add(viewDirections.east.clone().multiply(halfWidthVector));
					}
					if(grabbed.north) {
						newCenter.add(viewDirections.north.clone().multiply(halfHeightVector));
					} else if(grabbed.south) {
						newCenter.add(viewDirections.south.clone().multiply(halfHeightVector));
					}

					/*
					// Placing a circle for debugging.
					var ns = "http://www.w3.org/2000/svg";
					var circle = document.createElementNS(ns, "circle");
					var $circle = $(circle).attr({
						r: '5',
						cx: opposite.x,
						cy: opposite.y,
						fill: 'green'
					});
					$('.canvas svg').append($circle);
					*/

					// Update the selection with the new values.
					$scope.selection.center_x = newCenter.x / $scope.image.width;
					$scope.selection.center_y = newCenter.y / $scope.image.height;

					// Map the new width and height to ratios of the image width and height.
					$scope.selection.width = newWidth / $scope.image.width;
					$scope.selection.height = newHeight / $scope.image.height;
				}
				// Update the scope selection.
				$scope.selection = selection;
			}
		};

		// Derive the scope when the image loads.
		$scope.$watch('image.loaded', function(nowLoaded, oldLoaded) {
			var justLoaded = nowLoaded && nowLoaded !== oldLoaded;
			if(justLoaded) {
				$scope.deriveScope();
			}
		});

		// Or when the selection changes.
		$scope.$watch('selection', $scope.deriveScope, true);

		// When the selected selection changes
		$scope.$parent.$watch('selectedSelection', function(selectedSelection) {
			// Propagate this value to the current scope
			$scope.selected = selectedSelection === $scope.selection;
			// And hide this outline if something was selected and it wasn't this.
			$scope.visible = typeof(selectedSelection) === 'undefined' || $scope.selected;
		});

		$scope.$on('onSelectionDragCreated', function(e, args) {
			if(args.selection === $scope.selection) {
				// This is the selection that was just added.
				$scope.handleGrabbed(args.handleDirection, {
					offsetX: args.offsetX,
					offsetY: args.offsetY
				});
			}
		});
	}])
	.directive('imageSelectionOutline', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/image-selection/outline.html',
			replace: true,
			templateNamespace: 'svg',
			controller: 'imageSelectionCtrl'
		};
	});
})();