(function() {

	var CROPPING_STATUS_FIELD = '{bf7a30ac-e53b-4147-95e0-aea8c71340ca}',
			FILENAME_FIELD = 'name';

	angular
		.module('cropper')
		.factory('assets', ['$http', '$q', 'user', 'store', function($http, $q, user, store) {

			var BASE_URL = '/';
			function url(paths) {
				if(typeof(paths) === 'string') {
					paths = [paths];
				}

				return BASE_URL + paths.join('/');
			}

			var assets = {};

			assets.getCatalogs = function() {
				return user.get().then(function() {
					return $http.get( url('catalogs') )
					.then(function(response) {
						return response.data;
					});
				});
			};

			assets.doSearch = function(catalog_alias, term) {
				return user.get().then(function() {
					return $http({
						url: url(['asset', 'search', catalog_alias]),
						params: {
							term: term
						}
					}).then(function(response) {
						return response.data;
					});
				});
			};

			assets.getSearchResults = function(collection_id, count, offset) {
				return user.get().then(function() {
					return $http({
						url: url([
							'asset',
							'search-results',
							collection_id,
							count,
							offset
						]),
					}).then(function(response) {
						return response.data;
					});
				});
			};

			assets.transformAssetMetadata = function(asset) {
				var result = {
					id: asset.id,
					name: asset.name,
					cropping_status: asset[CROPPING_STATUS_FIELD],
					filename: asset[FILENAME_FIELD]
				};

				return result;
			};

			assets.get = function(catalog_alias, asset_id) {
				return user.get().then(function() {
					return $http({
						url: url([
							'asset',
							catalog_alias,
							asset_id
						]),
					}).then(function(response) {
						var asset = response.data;
						asset.metadata = assets.transformAssetMetadata(asset);
						asset.catalog_alias = catalog_alias;
						asset.getThumbnailURL = assets.getThumbnailURL;
						asset.getThumbnailURL.bind(asset);
						return asset;
					});
				});
			};

			assets.getThumbnailURL = function(size) {
				return '/' + [
					'asset',
					this.catalog_alias,
					this.id,
					'thumbnail',
					size
				].join('/') + '?jwt=' + store.get('token');
			};

			return assets;
		}]);
})();