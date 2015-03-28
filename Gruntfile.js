var node_process;

module.exports = function(grunt) {

	var BOOTSTRAP_PATH = './bower_components/bootstrap';
	var CIP_JS_PATH = './node_modules/cip-js';
	var FRONTEND_PUBLIC_PATH = './frontend/public';

	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-express-server');
	grunt.loadNpmTasks('grunt-env');
	grunt.loadNpmTasks('grunt-text-replace');

	grunt.config.merge({
		pkg: grunt.file.readJSON('package.json'),
		less: {
			cropper: {
				options: {
					paths: ["less"]
				},
				files: [
					{
						expand: true, // Enable dynamic expansion.
						cwd: './frontend/less/', // Src matches are relative to this path.
						src: ['app.less'], // Actual pattern(s) to match.
						dest: './frontend/public/stylesheets/', // Destination path prefix.
						ext: '.css', // Dest filepaths will have this extension.
					},
				],
			}
		},
		copy: {
			bootstrap: {
				files: [
					{
						expand: true,
						src: [BOOTSTRAP_PATH + '/dist/fonts/*'],
						flatten: true,
						dest: FRONTEND_PUBLIC_PATH + '/fonts/',
						filter: 'isFile'
					},
				]
			},
			cip_js: {
				files: [
					{
						expand: true,
						src: [CIP_JS_PATH + '/dist/cip.min.js'],
						flatten: true,
						dest: FRONTEND_PUBLIC_PATH + '/javascripts/lib/',
						filter: 'isFile'
					},
				]
			},
		},
		express: {
			options: {
				// Override defaults here - might no longer be needed.
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
					'frontend/**/*.less',
					'frontend/**/*.js'
				],
				tasks: ['public', 'express:dev'],
				options: {
					spawn: false,
				},
			},
		},
		uglify: {
			javascript_libs: {
				options: {
					mangle: {
						except: ['jQuery']
					},
					sourceMap: true
				},
				files: {
					'./frontend/public/javascripts/lib/libs.min.js': [
						'bower_components/jquery/dist/jquery.js',
						'bower_components/angular/angular.js',
						'bower_components/angular-ui-router/release/angular-ui-router.js',
						'bower_components/angular-cookies/angular-cookies.js',
						'bower_components/ngInfiniteScroll/build/ng-infinite-scroll.js',
					]
				}
			}
		},
	});

	// CIP-js
	grunt.registerTask('build-cip-js', function() {
		var done = this.async();
		grunt.util.spawn({
			cmd: 'bash',
			args: ['build.sh'],
			opts: {
				stdio: 'inherit',
				cwd: CIP_JS_PATH
			},
		}, done);
	});

	// Build and copy CIP JS
	grunt.registerTask('cip-js', ['build-cip-js', 'copy:cip_js']);
	// Build and copy all the libs to the /public folder.
	grunt.registerTask('libs', ['uglify', 'cip-js']);
	// Build and copy all local public files
	grunt.registerTask('public', ['less']);

	grunt.registerTask('default', ['libs', 'public']);

	// Use "grunt start" when developing, to reload the express app when
	// files are changing in the folder structure.
	grunt.registerTask('start', ['express:dev', 'watch']);

	require('time-grunt')(grunt);
};


