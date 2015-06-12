angular
	.module('cropper')
	.factory('user', [
		'$q', 'store', 'jwtHelper', 'auth',
		function($q, store, jwtHelper, auth) {
			function login() {
				var deferred = $q.defer();

				auth.signin({
					// No options at the moment ...
				}, function(profile, token) {
					store.set('profile', profile);
					store.set('token', token);
					deferred.resolve({
						profile: profile,
						token: token
					});
				}, function(err) {
					console.error("Error :(", err);
					deferred.reject('Could not sign in: ' + err);
				});

				return deferred.promise;
			}

			return {
				get: function() {
					var deferred = $q.defer();

					var token = store.get('token');
					if (token) {
						if (!jwtHelper.isTokenExpired(token)) {
							if (!auth.isAuthenticated) {
								auth.authenticate(store.get('profile'), token);
							}
							// Resolve the promise with this.
							deferred.resolve({
								profile: store.get('profile'),
								token: token
							});
						} else {
							deferred.resolve( login() );
						}
					} else {
						deferred.resolve( login() );
					}

					return deferred.promise;
				},
				forget: function() {
					auth.signout();
					store.remove('profile');
					store.remove('token');
				}
			};
	}]);
