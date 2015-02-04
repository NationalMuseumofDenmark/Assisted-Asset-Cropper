(function() {
	angular
		.module('cropper')
		.controller('signinCtrl', ['$scope', '$http', '$state', 'cip',
			function($scope, $http, $state, cip) {

			$scope.signed_in = true;
			$scope.busy = false;
			$scope.remember = false;

			function redirect() {
				$state.go('search');
			}

			$scope.signIn = function() {
				$scope.busy = true;
				cip.signIn($scope.username, $scope.password).then(function() {
					$scope.signed_in = true;
					$scope.busy = false;
					console.debug("The user signed in successfully - redirect!");
					redirect();
				}, function() {
					$scope.signed_in = false;
					$scope.busy = false;
				});
			};

			// Redirect if the user is already signed in.
			cip.isSignedIn().then(function(signed_in) {
				if(signed_in) {
					console.debug("User already has a session - redirect!");
					redirect();
				}
			});
		}]);
})();