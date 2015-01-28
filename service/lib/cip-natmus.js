var cip = require('cip-js');
var cache = require('memory-cache');

var NatMusConfig = {
	endpoint: "http://cumulus.natmus.dk/CIP/",
	constants: {
		catch_all_alias: "any",
		layout_alias: "web"
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

exports.config = NatMusConfig;

exports.client = function (req, next) {
	var jsessionid = req.cookies.jsessionid;
	if(jsessionid) {
		var cache_key = 'cip-natmus-client-' + jsessionid;
		var client = cache.get(cache_key);
		// Cache miss?
		if(!client) {
			client = new cip.CIPClient(NatMusConfig);
			client.jsessionid = jsessionid;
			cache.put(cache_key, client, CACHE_TIME);
		}
		return client;
	} else {
		var err = new Error("No jsessionid is sat - have you authenticated?");
		err.status = 401;
		next(err);
		return null;
	}
};

exports.wrap_proxy = function( url ) {
	return url.replace( NatMusConfig.endpoint, "/CIP/" );
};