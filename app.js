var express = require('express'),
		path = require('path'),
		favicon = require('static-favicon'),
		logger = require('morgan'),
		cookieParser = require('cookie-parser'),
		bodyParser = require('body-parser'),
		request = require('request'),
		i18n = require("i18n");

// var index = require('./routes/index');
//var overview = require('./routes/overview');
var assets = require('./routes/assets');
//var signin = require('./routes/signin');
//var index = require('./routes/index');
var cip_proxy = require('./routes/cip_proxy');

var app = express();
/*
// Save this i18n initialization for the routes to use.
app.set('i18n', i18n);

// Initialize the i18n library.
i18n.configure({
	locales:['en', 'da'],
	defaultLocale: process.env.LOCALE ? process.env.LOCALE : 'en',
	directory: __dirname + '/locales',
	updateFiles: app.get('env') === 'development'
});
*/

// A proxy to the CIP - this way we concur challenges with
// same origin policies and www-authenticate headers.
// this has to be registered before the body and cookie parsers.
app.use('/CIP', cip_proxy);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());

//app.use(i18n.init);

// Register the various application routes.
//app.use('/', signin);
//app.use('/overview', overview);
app.use('/asset', assets);
app.get('/', function(req, res) {
  res.sendfile('public/templates/index.html');
});

// Serve the static files from the public folder.
app.use(express.static(path.join(__dirname, 'public')));

// Set the scripts that needs to be loaded into every view.
//app.set('view options', { locals: { scripts: ['jquery.js'] } });
app.use(function(err, req, res, next) {
	// Redirect to the signin page.
	if(err.status === 401) {
		res.redirect('/');
	}
	next(err);
});

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

/// error handlers
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(logger('dev'));
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send({
			title: "An error occurred in development mode",
			message: err.message,
			error: err
		});
	});
} else {
	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send({
			title: "An error occurred",
			message: err.message,
			error: {}
		});
	});
}

module.exports = app;
