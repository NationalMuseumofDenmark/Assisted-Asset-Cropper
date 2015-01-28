var express = require('express'),
    cip = require('../lib/cip-natmus'),
    router = express.Router();
/**
 * ALL requests going to this route is tunneled through to the Cumulus CIP
 * instance. Calling this enpoint instead of the CIP directly takes care
 * of same-origin trouble and replaces any www-authenticate headers
 * with a custom header value, which doesn't trigger the users browser
 * to show an authentication dialog.
 * @param  {Object}   req  The request object.
 * @param  {Object}   res  The response object.
 * @param  {Function} next This function can be called to propagate the request
 *                         or errors.
 * @return {void}          Nothing in particular.
 */
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
