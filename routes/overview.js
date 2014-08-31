var express = require('express');
var router = express.Router();
var cip = require('../lib/cip-natmus');

/* GET home page. */
router.get('/', function(req, res) {
	cip.session(function( client ) {
  	res.render('overview', { jsessionid: client.jsessionid });
	});
});

module.exports = router;
