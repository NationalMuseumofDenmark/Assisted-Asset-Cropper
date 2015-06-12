var cip = require('cip-js'),
		cache = require('memory-cache'),
		Q = require('q');

var settings = require('../../settings.json');

var NatMusConfig = {
	endpoint: "http://cumulus.natmus.dk/CIP/",
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

var CACHE_TIME = 1000 * 60 * 5;

var CROPPING_STATUS_FIELD = '{bf7a30ac-e53b-4147-95e0-aea8c71340ca}',
		FILENAME_FIELD = 'name';

exports.config = NatMusConfig;

exports.client = function () {
	var deferred = Q.defer();
	var cache_key = 'cip-client';
	var client = cache.get(cache_key);
	// Cache miss?
	if(!client) {
		//console.log('Cache miss - creating a new CIP client.');
		client = new cip.CIPClient(NatMusConfig);
		client.session_open(settings.cip.username, settings.cip.password, function() {
			cache.put(cache_key, client, CACHE_TIME);
			deferred.resolve(client);
		}, function(response) {
			deferred.reject(response);
		});
	} else {
		//console.log('Returning client from cache.');
		deferred.resolve(client);
	}

	return deferred.promise;
};

exports.wrap_proxy = function( url ) {
	return url.replace( NatMusConfig.endpoint, "/CIP/" );
};

exports.search = function(cip_client, catalog_alias, term) {
	var deferred = Q.defer();

	var catalog = {
		alias: catalog_alias
	};

	var table = {
		cip: cip_client,
		catalog: catalog,
		name: "AssetRecords"
	};

	var query_string = CROPPING_STATUS_FIELD + ' == 1';

	cip_client.advancedsearch(
		table,
		query_string,
		term,
		CROPPING_STATUS_FIELD+":descending",
		function(response) {
			deferred.resolve(response);
		},
		deferred.reject
	);

	return deferred.promise;
};

exports.searchResults = function(client, collection_id, count, offset) {
	var deferred = Q.defer();

	var layoutAlias = client.config.constants.layout_alias;

	client.ciprequest([
		'metadata',
		'getfieldvalues',
		layoutAlias
	], {
		collection: collection_id,
		maxreturned: count,
		startindex: offset
	}, function(response) {
		deferred.resolve(response.items);
	}, deferred.reject);

	return deferred.promise;

};