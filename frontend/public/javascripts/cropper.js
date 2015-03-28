(function() {
	angular
	.module('cropper', ['ui.router', 'cip', 'infinite-scroll'])
	.config(['$urlRouterProvider', '$stateProvider',
	function($urlRouterProvider, $stateProvider) {

		$urlRouterProvider.otherwise('/search//');

		function ensureSignIn(cip, $state) {
			return cip.hasSession()
			.then(function(has_session) {
				if(!has_session) {
					console.debug("The user has no session - redirect to signIn.");
					$state.go('signIn');
				} else {
					console.debug("The user has a session.");
				}
			});
		}

		function signOut(cip, $state) {
			return cip.signOut().then(function() {
				$state.go('signIn');
			});
		}

		var catalogs;

		$stateProvider
		.state('signIn', {
			url: '/signin',
			templateUrl: 'templates/signin.html',
			controller: 'signinCtrl'
		})
		.state('signOut', {
			url: '/signout',
			onEnter: ['cip', '$state', signOut]
		})
		.state('search', {
			url: '/search/:catalog_alias/:term',
			templateUrl: 'templates/search.html',
			controller: 'searchCtrl',
			resolve: {
				catalogs: ['cip', function(cip) {
					if(!catalogs) {
						return cip.getCatalogs()
						.then(function(catalogs_response) {
							catalogs = {};
							catalogs_response.forEach(function(catalog) {
								catalogs[catalog.alias] = catalog.name;
							});
							return catalogs;
						});
					}
					return catalogs;
				}]
			},
			onEnter: ['cip', '$state', ensureSignIn]
		})
		.state('asset', {
			url: '/asset/:catalog_alias/:asset_id',
			templateUrl: 'templates/asset.html',
			controller: 'assetCtrl',
			resolve: {
				asset: ['cip', '$state', '$stateParams', function(cip, $state, $stateParams) {
					var asset = cip.getAsset($stateParams.catalog_alias, $stateParams.asset_id)
					.then(null, function(err) {
						console.error(err);
						signOut(cip, $state);
					});
					return asset;
				}]
			},
			onEnter: ['cip', '$state', ensureSignIn]
		});
	}])
	.run(['$rootScope', '$state', function($rootScope, $state) {
		$rootScope.messages = [];
		$rootScope.showMessage = function(style, body) {
			if( typeof body === 'string' ) {
				body = [ body ];
			}
			$rootScope.messages.push({
				style: style,
				body: body.join('')
			});
		};

		$rootScope.removeMessage = function($index) {
			$rootScope.messages.splice($index, 1);
		};

		/*
		$rootScope.showMessage('success', 'We are just testing here .. 1');
		$rootScope.showMessage('warning', 'We are just testing here .. 2');
		$rootScope.showMessage('danger', 'We are just testing here .. 3');
		*/
	
		// If a state change error occurs due to Unauthorized, change to the signIn state.
		$rootScope.$on('$stateChangeError',
		function (event, toState, toParams, fromState, fromParams, error) {
			if(error.indexOf('Unauthorized') !== -1) {
				event.preventDefault();
				$state.go('signIn');
			}
		});
		$rootScope.$on('$stateChangeSuccess',
		function (ev, to, toParams, from, fromParams) {
			// Save the params of the last search when leaving the state.
			if(from.name === 'search') {
				$rootScope.previous_search = fromParams;
			}
		});
	}]);
})();