var node_process;

module.exports = function(grunt) {

	var bootstrap_path = './node_modules/bootstrap';

	// Project configuration.
	//grunt.config.merge({
	grunt.config.merge({
		pkg: grunt.file.readJSON('package.json'),
		less: {
			cropper: {
				options: {
					paths: ["public/stylesheets"]
				},
				files: {
					"public/stylesheets/style.css": "public/stylesheets/style.less"
				}
			}
		},
		copy: {
			distBootstrap: {
				files: [
					{expand: true, src: [bootstrap_path + '/dist/js/*'], flatten: true, dest: 'public/javascripts/', filter: 'isFile'},
					//{expand: true, src: [bootstrap_path + '/dist/css/*'], flatten: true, dest: 'public/stylesheets/', filter: 'isFile'},
					{expand: true, src: [bootstrap_path + '/dist/fonts/*'], flatten: true, dest: 'public/fonts/', filter: 'isFile'},
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

	// Bootstrap
	grunt.registerTask('dist-bootstrap', function() {
		var done = this.async();
		grunt.util.spawn({
			grunt: true,
			args: ['--gruntfile', bootstrap_path + '/Gruntfile.js', 'dist'],
			opts: {
				stdio: 'inherit'
			},
		}, done);
	});

	// Default task(s).
	grunt.registerTask('start', ['express:dev', 'watch']);

	grunt.registerTask('default', ['dist-bootstrap', 'less:cropper', 'copy:distBootstrap']);

	require('time-grunt')(grunt);

};


