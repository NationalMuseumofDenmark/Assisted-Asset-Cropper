var node_process;

module.exports = function(grunt) {

	var bootstrap_path = './node_modules/bootstrap';
	var cip_js_path = './node_modules/cip-js';

	// Project configuration.
	//grunt.config.merge({
	grunt.config.merge({
		pkg: grunt.file.readJSON('package.json'),
		less: {
			cropper: {
				options: {
					paths: ["public/less"]
				},
				/*
				files: {
					"public/stylesheets/style.css": "public/less/style.less",
					"public/stylesheets/partials/searchbar.css": "public/less/partials/searchbar.less",
				}
				*/
				files: [
					{
						expand: true,     // Enable dynamic expansion.
						cwd: 'public/less/',      // Src matches are relative to this path.
						src: ['**/*.less', '!bootstrap.less', '!variables.less'], // Actual pattern(s) to match.
						dest: 'public/stylesheets/',   // Destination path prefix.
						ext: '.css',   // Dest filepaths will have this extension.
					},
				],
			}
		},
		copy: {
			distBootstrap: {
				files: [
					{expand: true, src: [bootstrap_path + '/dist/js/*'], flatten: true, dest: 'public/javascripts/lib/', filter: 'isFile'},
					//{expand: true, src: [bootstrap_path + '/dist/css/*'], flatten: true, dest: 'public/stylesheets/', filter: 'isFile'},
					{expand: true, src: [bootstrap_path + '/dist/fonts/*'], flatten: true, dest: 'public/fonts/', filter: 'isFile'},
				]
			},
			distCIPJS: {
				files: [
					{expand: true, src: [cip_js_path + '/dist/cip.min.js'], flatten: true, dest: 'public/javascripts/lib/', filter: 'isFile'},
				]
			}
		},
		watch: {
			publics: {
				files: ['public/**', 'Gruntfile.js', '**/*.js', '**/*.hjs'],
				tasks: ['less:cropper', 'express:dev'],
				options: {
					spawn: false,
				},
			},
		},
		express: {
			options: {
				// Override defaults here
				delay: 1
			},
			dev: {
				options: {
					script: './bin/www'
				}
			},
		}
	});

	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-express-server');

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

	// Default task(s).
	grunt.registerTask('start', ['express:dev', 'watch']);
	grunt.registerTask('bootstrap-prepare', ['bootstrap-npm-install', 'bootstrap-dist']);
	grunt.registerTask('cip-js', ['build-cip-js', 'copy:distCIPJS']);

	grunt.registerTask('default', ['bootstrap-prepare', 'less:cropper', 'copy:distBootstrap', 'cip-js']);

	require('time-grunt')(grunt);

};


