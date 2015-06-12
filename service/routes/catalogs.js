var express = require('express'),
		cip = require('../lib/cip-natmus'),
		router = express.Router();


router.get('/', function(req, res, next) {
	// Localizing parameters
	cip.client(req, next)
	.then(function (cip_client) {
		cip_client.ciprequest(
			"metadata/getcatalogs", {}, function(response) {
			var catalogs = [];
			if(response.catalogs) {
				// Add in the aliases on the catalogs.
				catalogs = response.catalogs.map(function(catalog) {
					catalog.alias = cip_client.config.catalog_aliases[catalog.name];
					return catalog;
				});
			}
			res.send(catalogs);
		});
	}, next);
});

module.exports = router;
