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
					console.error("Error logging in:", err);
					deferred.reject('Could not sign in: ' + err);
				});

				return deferred.promise;
			}

			return {
				// Get the authenticated user.
				get: function() {
					var deferred = $q.defer();

					var token = store.get('token');
					// Do we already have a token, i.e. is the user logged in?
					if (token) {
						// Is this token still fresh?
						if (!jwtHelper.isTokenExpired(token)) {
							// If auth don't know yet - let's tell
							if (!auth.isAuthenticated) {
								auth.authenticate(store.get('profile'), token);
							}
							// Resolve the promise with this users profile and token.
							deferred.resolve({
								profile: store.get('profile'),
								token: token
							});
						} else {
							// The users action is needed.
							deferred.resolve( login() );
						}
					} else {
						// The users action is needed.
						deferred.resolve( login() );
					}

					return deferred.promise;
				},
				// Sign out and forget about the user.
				forget: function() {
					auth.signout();
					store.remove('profile');
					store.remove('token');
				}
			};
	}]);
