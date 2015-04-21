var express = require('express'),
		path = require('path'),
		logger = require('morgan'),
		cookieParser = require('cookie-parser'),
		bodyParser = require('body-parser'),
		request = require('request');

var assets = require('./service/routes/assets');
var cip_proxy = require('./service/routes/cip_proxy');

var app = express();

// A proxy to the CIP - this way we concur challenges with
// same origin policies and www-authenticate headers.
// this has to be registered before the body and cookie parsers.
app.use('/CIP', cip_proxy);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Register the various application routes.
app.use('/asset', assets);
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/frontend/public/templates/index.html');
});

// Serve the static files from the public folder.
app.use(express.static(path.join(__dirname, 'frontend/public')));

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
