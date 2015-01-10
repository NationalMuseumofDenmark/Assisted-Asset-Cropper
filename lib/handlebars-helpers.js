var path = require('path'),
		fs = require('graceful-fs');

exports.stylesheets = function (options) {
	if(!this.stylesheets) {
		this.stylesheets = [];
	}
	var stylesheets = options.fn(this);
	stylesheets = stylesheets.split('\n');
	for(s in stylesheets.reverse()) {
		var stylesheet = stylesheets[s];
		if(stylesheet.length > 0) {
			this.stylesheets.push(stylesheet);
		}
	}
};

exports.javascripts = function (options) {
	if(!this.javascripts) {
		this.javascripts = [];
	}
	var javascripts = options.fn(this);
	javascripts = javascripts.split('\n');
	for(s in javascripts.reverse()) {
		var javascript = javascripts[s];
		if(javascript.length > 0) {
			this.javascripts.push(javascript);
		}
	}
};

exports.render_stylesheets = function () {
	var result = '';
	for(var s in this.stylesheets.reverse()) {
		var stylesheet = this.stylesheets[s];
		result += '<link rel="stylesheet" href="/stylesheets/' +stylesheet+ '.css" />\n';
	}
	return result;
};
exports.render_javascripts = function () {
	var result = '';
	for(var s in this.javascripts.reverse()) {
		var javascript = this.javascripts[s];
		result += '<script type="text/javascript" src="/javascripts/' +javascript+ '.js"></script>\n';
	}
	return result;
};

var hbs;
exports.set_handlebars = function (handlebars) {
	hbs = handlebars;
};

exports.partial_source = function (options) {
	var partial = options.fn(this);
	var partialPath = path.resolve(hbs.partialsDir + partial + hbs.extname);
	var partialSource = fs.readFileSync(partialPath, 'utf8');
	return '<script id="' +partial+ '-template" type="text/x-handlebars-template">\n' +
		partialSource + '\n</script>';
};