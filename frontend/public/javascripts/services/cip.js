(function() {
	var NatMusConfig = {
		// endpoint: "http://cumulus.natmus.dk/CIP/",
		endpoint: "/CIP/",
		constants: {
				catch_all_alias: "any",
				layout_alias: "Registrering"
		},
		catalog_aliases: {
			"Alle": "ALL",
			"Antiksamlingen": "AS",
			"Bevaringsafdelingen": "BA",
			"Danmarks Middelalder og Renæssance": "DMR",
			"Danmarks Nyere Tid": "DNT",
			"Etnografisk samling": "ES",
			"Frihedsmuseet": "FHM",
			"Den Kgl. Mønt- og Medaljesamling": "KMM",
			"Musikmuseet": "MUM",
			"Cropper": "Cropper"
		}
	};

	var CROPPING_STATUS_FIELD = '{bf7a30ac-e53b-4147-95e0-aea8c71340ca}',
			FILENAME_FIELD = 'name'; // This changed from {af4b2e00-5f6a-11d2-8f20-0000c0e166dc}

	var cip_client = new CIPClient(NatMusConfig);

	angular
		.module('cip', ['ngCookies'])
		.factory('cip', ['$q', '$cookies', function($q, $cookies) {
			var cip = {};
			cip_client.jsessionid = $cookies.jsessionid;

			cip.signIn = function(username, password) {
				// First - we close any existing sessions by signing out.
				return cip.signOut().then(function() {
					var deferred = $q.defer();

					cip_client.session_open(
						username,
						password,
						function(response) {
							cip.isSignedIn()
							.then(function(signed_in) {
								if(signed_in) {
									$cookies.jsessionid = cip_client.jsessionid;
									deferred.resolve(signed_in);
								} else {
									deferred.reject('Could not create a session.');
								}
							}, deferred.reject );
						}, deferred.reject );

					return deferred.promise;
				});
			};

			cip.signOut = function(username, password) {
				var deferred = $q.defer();

				// Clear any existing cookies.
				//eraseCookie('jsessionid');

				if(cip_client.jsessionid) {
					cip_client.ciprequest("session/close", {},
						function(response) {
							cip_client.jsessionid = null;
							$cookies.jsessionid = null;
							deferred.resolve(true);
						},
						function(response) {
							// Apparently it will fail - because the qwest library will fails
							// JSON parsing empty responses.
							cip_client.jsessionid = null;
							deferred.resolve(true);
						}
					);
				} else {
					deferred.resolve(true);
				}

				return deferred.promise;
			};

			cip.isSignedIn = function() {
				var deferred = $q.defer();

				if(!cip_client.jsessionid) {
					deferred.resolve(false);
				} else {
					cip_client.ciprequest("metadata/getcatalogs", {}, function( response ) {
						deferred.resolve(true);
					}, function(response) {
						deferred.resolve(false);
					});
				}

				return deferred.promise;
			};

			cip.hasSession = function() {
				var deferred = $q.defer();

				deferred.resolve( cip_client.jsessionid && true );

				return deferred.promise;
			};

			cip.getCatalogs = function() {
				var deferred = $q.defer();

				cip_client.get_catalogs(function(catalogs) {
					deferred.resolve(catalogs);
				}, deferred.reject);

				return deferred.promise;
			};

			cip.search = function(catalog_alias, term) {
				var deferred = $q.defer();

				var catalog = new CIPCatalog(this, { alias: catalog_alias });
				var table = new cip_table.CIPTable(cip_client, catalog, "AssetRecords");

				var query_string = CROPPING_STATUS_FIELD + ' == 1';

				cip_client.advancedsearch(
					table,
					query_string,
					term,
					CROPPING_STATUS_FIELD+":descending",
					deferred.resolve,
					deferred.reject
				);

				return deferred.promise;
			};

			cip.transformAssetMetadata = function(asset) {
				var result = {
					id: asset.fields.id,
					name: asset.fields.name,
					cropping_status: asset.fields[CROPPING_STATUS_FIELD],
					filename: asset.fields[FILENAME_FIELD],
				};

				return result;
			};

			cip.getAsset = function(catalog_alias, asset_id) {
				var deferred = $q.defer();
				
				cip_client.get_asset(
					catalog_alias,
					asset_id,
					true,
					function(asset) {
						asset.metadata = cip.transformAssetMetadata(asset);
						deferred.resolve(asset);
					},
					deferred.reject
				);

				return deferred.promise;
			};

			return cip;
		}]);
})();