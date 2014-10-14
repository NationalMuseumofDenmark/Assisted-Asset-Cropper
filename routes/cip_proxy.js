var express = require('express');
var router = express.Router();
var cip = require('../lib/cip-natmus');

router.all('/*', function(req, res) {
  var url = cip.config.endpoint + req.url.substring(1);

  // Replace the 'www-authenticate' header to prevent browsers to
  // popup an authentication dialog.
  res.originalWriteHead = res.writeHead;
  res.writeHead = function(statusCode, reasonPhrase, headers) {
  	if(statusCode === 401) {
	    res.header('www-authenticate', 'CIPBasic realm="CIP"');
	  }
    res.originalWriteHead(statusCode, reasonPhrase, headers);
  }

  req.pipe(request(url)).pipe(res);
});

module.exports = router;
