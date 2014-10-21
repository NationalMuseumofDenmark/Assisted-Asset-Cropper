var express = require('express');
var router = express.Router(),
		i18n = require('i18n'),
		__ = i18n.__;

/**
 * GET the sign in page.
 * @param  {Object}   req  The request object.
 * @param  {Object}   res  The response object.
 * @param  {Function} next This function can be called to propagate the request
 *                         or errors.
 * @return {void}          Nothing in particular.
 */
router.get('/', function(req, res) {
  res.render('signin', {
  	title: __("Sign into %s", __("Assisted asset cropper"))
  });
});

module.exports = router;
