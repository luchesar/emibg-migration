var gulp = require('gulp'), 
    nodemon = require('gulp-nodemon'),
    jshint = require('gulp-jshint');

gulp.task('lint', function () {
  gulp.src('./**/*.js')
    .pipe(jshint())
})
 
gulp.task('dev', function () {
  nodemon({ script: 'server.js',
            ext: 'js',
            ignore: ['ignored.js'],
            tasks: ['lint'] })
    .on('restart', function () {
      console.log('restarted!')
    })
})
