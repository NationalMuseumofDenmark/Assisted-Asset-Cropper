var node_process;

module.exports = function(grunt) {

	var bootstrap_path = './node_modules/bootstrap';
	var angular_path = './node_modules/angular';
	var angular_ui_router_path = './node_modules/angular-ui-router';
	var angular_cookies_path = './node_modules/angular-cookies';
	var angular_infinite_scroll_path = './node_modules/ng-infinite-scroll';
	var angular_animate_path = './node_modules/angular-animate';
	var cip_js_path = './node_modules/cip-js';

	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-express-server');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-env');
	grunt.loadNpmTasks('grunt-text-replace');

	// Project configuration.
	//grunt.config.merge({
	grunt.config.merge({
		pkg: grunt.file.readJSON('package.json'),
		less: {
			cropper: {
				options: {
					paths: ["less"]
				},
				files: [
					{
						expand: true,     // Enable dynamic expansion.
						cwd: 'less/',      // Src matches are relative to this path.
						//src: ['**/*.less', '!bootstrap.less', '!variables.less'], // Actual pattern(s) to match.
						src: ['app.less'], // Actual pattern(s) to match.
						dest: 'public/stylesheets/',   // Destination path prefix.
						ext: '.css',   // Dest filepaths will have this extension.
					},
				],
			}
		},
		copy: {
			bootstrap: {
				files: [
					{expand: true, src: [bootstrap_path + '/dist/js/*'], flatten: true, dest: 'public/javascripts/lib/', filter: 'isFile'},
					{expand: true, src: [bootstrap_path + '/dist/fonts/*'], flatten: true, dest: 'public/fonts/', filter: 'isFile'},
				]
			},
			angular: {
				files: [
					{expand: true, src: [
						angular_path + '/angular.min.js',
						angular_path + '/angular.min.js.map',
						angular_ui_router_path + '/release/angular-ui-router.min.js',
						angular_cookies_path + '/angular-cookies.min.js',
						angular_cookies_path + '/angular-cookies.min.js.map',
						angular_infinite_scroll_path + '/build/ng-infinite-scroll.min.js',
					], flatten: true, dest: 'public/javascripts/lib/'}
				]
			},
			cip_js: {
				files: [
					{expand: true, src: [cip_js_path + '/dist/cip.min.js'], flatten: true, dest: 'public/javascripts/lib/', filter: 'isFile'},
				]
			}
		},
		express: {
			options: {
				// Override defaults here
				delay: 1
			},
			dev: {
				options: {
					script: './bin/www'
				},
			},
		},
		watch: {
			publics: {
				files: [
					'app.js',
					'Gruntfile.js',
					'javascripts/**/*.js',
					'less/**/*.less',
					'views/**/*.hbs'
				],
				tasks: ['public', 'express:dev'],
				options: {
					spawn: false,
				},
			},
		},
		replace: {
			angular: {
				src: 'public/javascripts/lib/angular.min.js',
				overwrite: true,
				replacements: [{
					from: 'sourceMappingURL=angular.min.js.map',
					to: 'sourceMappingURL=/javascripts/lib/angular.min.js.map'
				}]
			}
		}
	});

	// CIP-js
	grunt.registerTask('bootstrap-npm-install', function() {
		var done = this.async();
		grunt.util.spawn({
			cmd: 'npm',
			args: ['install'],
			opts: {
				stdio: 'inherit',
				cwd: bootstrap_path
			},
		}, done);
	});

	// Bootstrap
	grunt.registerTask('bootstrap-dist', function() {
		var done = this.async();
		grunt.util.spawn({
			grunt: true,
			args: ['--gruntfile', bootstrap_path + '/Gruntfile.js', 'dist'],
			opts: {
				stdio: 'inherit'
			},
		}, done);
	});

	// CIP-js
	grunt.registerTask('build-cip-js', function() {
		var done = this.async();
		grunt.util.spawn({
			cmd: 'bash',
			args: ['build.sh'],
			opts: {
				stdio: 'inherit',
				cwd: cip_js_path
			},
		}, done);
	});

	// Prepare bootstrap to be copied.
	grunt.registerTask('bootstrap-prepare', ['bootstrap-npm-install', 'bootstrap-dist']);
	grunt.registerTask('bootstrap', ['bootstrap-prepare', 'copy:bootstrap']);
	// Copy the Angular browser-side framework
	grunt.registerTask('angular', ['copy:angular', 'replace:angular']);
	// Build and copy CIP JS
	grunt.registerTask('cip-js', ['build-cip-js', 'copy:cip_js']);
	// Build and copy all the libs to the /public folder.
	grunt.registerTask('libs', ['bootstrap', 'angular', 'cip-js']);
	// Build and copy all local public files
	grunt.registerTask('public', ['less']);
	// The default task is to install libs, turn less to css and concat
	// relevant javascript into a single file.
	grunt.registerTask('default', ['libs', 'public']);

	// Use "grunt start" when developing, to reload the express app when
	// files are changing in the folder structure.
	grunt.registerTask('start', ['express:dev', 'watch']);

	require('time-grunt')(grunt);
};


